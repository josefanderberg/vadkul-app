/**
 * Sätter ihop brickorna med eventets egen emoji (lib/emojiBricka) och sparar
 * dem som PNG i cachemappen, så kartans <Images> kan läsa dem som file://.
 * Delarna (kropp + emoji) är förbakade assets: expo-asset ger en lokal fil
 * även för Androids inbäddade resurser och för bilder som kommit via OTA.
 *
 * Kön tar en bild i taget och släpper JS-tråden mellan dem. Nya önskemål går
 * först (de syns nu); de valda varianterna (förladdning) får vänta. En bild
 * som redan finns på disken (från en tidigare start) läses bara in. Mappen
 * heter efter BAKNING, så en ny bakning börjar om och gamla mappar rensas.
 *
 * Bytet på kartan sker i två steg: först registreras filen i <Images>, sedan
 * - när MapLibre hunnit läsa den - blir nyckeln KLAR och brickan byter bild.
 * Annars visar MapLibre en tom platshållare och brickan blinkar bort.
 * Misslyckas något får kategorins bricka stå kvar.
 */
import { Asset } from 'expo-asset';
import { Directory, File, Paths } from 'expo-file-system';
import { useEffect, useRef, useState } from 'react';
import type { ImageRequireSource } from 'react-native';
import { EMOJI_KÄLLOR, KROPP_KÄLLOR } from './emojiBilder.generated';
import { avkodaPng, emojiBildDelar, emojiBildFil, kodaPng, läggPå, type Rgba } from './emojiBricka';
import { BAKNING, EMOJI_LÄGE } from './emojiNycklar.generated';

const MAPP = 'brickor-';
/** Hur ofta färdiga bilder lämnas till kartan (en omritning per omgång). */
const LÄMNA_MS = 100;
/** Tid för MapLibre att läsa in en ny fil innan brickan byter till den. */
const KLAR_EFTER_MS = 250;

const delar = new Map<string, Promise<Rgba>>();
function läsDel(nyckel: string, källa: ImageRequireSource): Promise<Rgba> {
    let p = delar.get(nyckel);
    if (!p) {
        p = (async () => {
            const asset = await Asset.fromModule(källa).downloadAsync();
            if (!asset.localUri) throw new Error(`ingen lokal fil för ${nyckel}`);
            return avkodaPng(await new File(asset.localUri).bytes());
        })();
        delar.set(nyckel, p);
        p.catch(() => delar.delete(nyckel));
    }
    return p;
}

let städat = false;
function mapp(): Directory {
    const dir = new Directory(Paths.cache, `${MAPP}${BAKNING}`);
    if (!städat) {
        städat = true;
        try {
            for (const x of new Directory(Paths.cache).list()) {
                if (x instanceof Directory && x.name.startsWith(MAPP) && x.name !== dir.name) x.delete();
            }
        } catch {
            /* städningen är en artighet - nästa start försöker igen */
        }
    }
    dir.create({ intermediates: true, idempotent: true });
    return dir;
}

/** Den sammansatta bilden som file://-uri - skapas om den inte redan finns. */
async function skapa(nyckel: string): Promise<string> {
    const del = emojiBildDelar(nyckel);
    const kroppKälla = del && KROPP_KÄLLOR[del.kropp];
    const emojiKälla = del && EMOJI_KÄLLOR[del.id];
    const läge = del && EMOJI_LÄGE[del.id];
    if (!del || !kroppKälla || !emojiKälla || !läge) throw new Error(`okänd bricka ${nyckel}`);
    const dir = mapp();
    const fil = new File(dir, emojiBildFil(nyckel));
    if (fil.exists) return fil.uri;
    const [kropp, emoji] = await Promise.all([läsDel(del.kropp, kroppKälla), läsDel(del.id, emojiKälla)]);
    const png = kodaPng(läggPå(kropp, emoji, läge.x, läge.y));
    // Skriv till en tillfällig fil och flytta: en avbruten skrivning får
    // aldrig lämna en halv PNG som nästa start tror är klar.
    const tmp = new File(dir, `${emojiBildFil(nyckel)}.tmp`);
    if (tmp.exists) tmp.delete();
    tmp.write(png);
    await tmp.move(fil);
    return fil.uri;
}

/**
 * `önskade` - sammansatta nycklar i prioritetsordning; `förladda` - de som
 * kan vänta (valda varianter). Ger `bilder` (nyckel → file://-uri, till
 * <Images>) och `klara` (nycklar som brickorna får byta till).
 */
export function useEmojiBrickor(
    önskade: readonly string[],
    förladda: readonly string[] = [],
): { bilder: Readonly<Record<string, string>>; klara: ReadonlySet<string> } {
    const [bilder, setBilder] = useState<Readonly<Record<string, string>>>({});
    const [klara, setKlara] = useState<ReadonlySet<string>>(() => new Set());
    const k = useRef({
        kända: new Set<string>(),
        först: [] as string[],
        sist: [] as string[],
        nya: {} as Record<string, string>,
        igång: false,
        lämna: null as ReturnType<typeof setTimeout> | null,
        levande: true,
    });

    useEffect(() => {
        const s = k.current;
        s.levande = true;
        return () => {
            s.levande = false;
            if (s.lämna) clearTimeout(s.lämna);
        };
    }, []);

    useEffect(() => {
        const s = k.current;
        const nyaFörst = önskade.filter(n => n && !s.kända.has(n));
        for (const n of nyaFörst) s.kända.add(n);
        const nyaSist = förladda.filter(n => n && !s.kända.has(n));
        for (const n of nyaSist) s.kända.add(n);
        if (!nyaFörst.length && !nyaSist.length) return;
        s.först.unshift(...nyaFörst);
        s.sist.push(...nyaSist);

        const lämna = () => {
            s.lämna = null;
            const tillägg = s.nya;
            s.nya = {};
            const nycklar = Object.keys(tillägg);
            if (!nycklar.length || !s.levande) return;
            setBilder(b => ({ ...b, ...tillägg }));
            setTimeout(() => {
                if (s.levande) setKlara(prev => new Set([...prev, ...nycklar]));
            }, KLAR_EFTER_MS);
        };
        const kör = async () => {
            if (s.igång) return;
            s.igång = true;
            try {
                while (s.levande) {
                    const nyckel = s.först.shift() ?? s.sist.shift();
                    if (!nyckel) break;
                    try {
                        s.nya[nyckel] = await skapa(nyckel);
                        if (!s.lämna) s.lämna = setTimeout(lämna, LÄMNA_MS);
                    } catch {
                        /* kategorins bricka får stå kvar */
                    }
                    await new Promise(r => setTimeout(r, 0));
                }
            } finally {
                s.igång = false;
            }
        };
        void kör();
    }, [önskade, förladda]);

    return { bilder, klara };
}
