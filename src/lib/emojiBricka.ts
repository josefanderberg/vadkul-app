/**
 * EVENTETS EGEN EMOJI PÅ KARTANS BRICKA (Josef 1/11 2026: "Det är en symbol
 * på eventmarkören. typ den generella fotbollen, men när jag klickar på
 * eventet så är det en sån dykarmask"). Webbens markör ritar eventets emoji
 * (v2MapBricka.eventEmoji) - appens förbakade brickor bar bara kategorins.
 *
 * MapLibre RN kan inte rita färg-emoji och kan inte lägga två bilder i EN
 * symbol. Två lager (kropp + emoji) ger fel ordning när brickor överlappar:
 * emojin bakom skulle ritas ovanpå brickan framför - samma fel som det gamla
 * badge-lagret hade. Därför sätts brickan ihop till EN bild här: den
 * förbakade kroppen utan emoji (kropp-*) + emojin för sig (emoji/<id>.png,
 * webbens position), båda ur scripts/baka-brickor.mjs. Webben ritar emojin
 * sist och utan skugga, så resultatet är webbens bricka.
 *
 * Här bor den rena delen (id:n, PNG in/ut, sammansättningen, vilken bild en
 * bricka ska ha); disken och kön bor i lib/useEmojiBrickor.
 */
import { unzlibSync, zlibSync } from 'fflate';
import { EMOJI_LÄGE } from './emojiNycklar.generated';

/** Emojins id: kodpunkterna utan VS16 (U+FE0F), hex med bindestreck - så
 *  "🍽" och "🍽️" blir samma. Samma regel som baka-brickor.mjs. */
export function emojiId(emoji: string): string {
    return Array.from(emoji)
        .map(c => c.codePointAt(0)!)
        .filter(cp => cp !== 0xfe0f)
        .map(cp => cp.toString(16))
        .join('-');
}

/** Avskiljaren i en sammansatt bilds nyckel: `<brickans ikon>~<emojins id>`. */
const SKILJE = '~';

/**
 * Bilden en bricka ska ha för att visa `emoji`, eller '' när den förbakade
 * brickan (`ikon`, som bär `brickansEmoji`) redan visar rätt - eller när
 * emojin inte är bakad (då får kategorins bricka stå kvar).
 */
export function emojiBild(ikon: string, emoji: string, brickansEmoji: string): string {
    const id = emojiId(emoji);
    if (!id || id === emojiId(brickansEmoji) || !EMOJI_LÄGE[id]) return '';
    return `${ikon}${SKILJE}${id}`;
}

/** Delarna i en sammansatt bild: kroppen (kropp-<kategori>[-variant]) och emojins id. */
export function emojiBildDelar(nyckel: string): { kropp: string; id: string } | null {
    const i = nyckel.indexOf(SKILJE);
    if (i < 0 || !nyckel.startsWith('bricka-')) return null;
    return { kropp: `kropp-${nyckel.slice('bricka-'.length, i)}`, id: nyckel.slice(i + 1) };
}

/** Filnamnet i diskcachen - nyckeln med `_` i stället för `~`. */
export function emojiBildFil(nyckel: string): string {
    return `${nyckel.replace(SKILJE, '_')}.png`;
}

/**
 * Brickorna med de sammansatta bilder som är KLARA (inlästa i kartan). Övriga
 * behåller kategorins bricka tills deras bild finns - MapLibre visar en tom
 * platshållare medan en bild läses in, så nyckeln byts först när den är klar.
 */
export function medEmojiBilder<P extends { ikon: string; emojiBild: string }>(
    fc: GeoJSON.FeatureCollection<GeoJSON.Point, P>,
    klara: ReadonlySet<string>,
): GeoJSON.FeatureCollection<GeoJSON.Point, P> {
    if (klara.size === 0) return fc;
    return {
        ...fc,
        features: fc.features.map(f =>
            f.properties.emojiBild && klara.has(f.properties.emojiBild)
                ? { ...f, properties: { ...f.properties, ikon: f.properties.emojiBild } }
                : f,
        ),
    };
}

// ── PNG in och ut ─────────────────────────────────────────────────────────
// Brickans delar kommer från Chromes toDataURL: 8 bitar, RGBA, utan
// interlace. Ut går en lika enkel PNG (filter 0 på alla rader).

export interface Rgba {
    bredd: number;
    höjd: number;
    /** RGBA, rad för rad, INTE förmultiplicerad. */
    data: Uint8Array;
}

const SIGNATUR = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const läs32 = (b: Uint8Array, i: number) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;

export function avkodaPng(png: Uint8Array): Rgba {
    for (let i = 0; i < 8; i++) if (png[i] !== SIGNATUR[i]) throw new Error('inte en PNG');
    let bredd = 0;
    let höjd = 0;
    let kanaler = 0;
    const idat: Uint8Array[] = [];
    let idatLängd = 0;
    for (let p = 8; p + 8 <= png.length; ) {
        const längd = läs32(png, p);
        const typ = String.fromCharCode(png[p + 4], png[p + 5], png[p + 6], png[p + 7]);
        const innehåll = png.subarray(p + 8, p + 8 + längd);
        if (typ === 'IHDR') {
            bredd = läs32(innehåll, 0);
            höjd = läs32(innehåll, 4);
            const [djup, färgtyp, , , interlace] = innehåll.subarray(8, 13);
            kanaler = färgtyp === 6 ? 4 : färgtyp === 2 ? 3 : 0;
            if (djup !== 8 || !kanaler || interlace !== 0) throw new Error(`PNG-formatet stöds inte (${djup}/${färgtyp}/${interlace})`);
        } else if (typ === 'IDAT') {
            idat.push(innehåll);
            idatLängd += längd;
        } else if (typ === 'IEND') {
            break;
        }
        p += 12 + längd;
    }
    const komprimerat = new Uint8Array(idatLängd);
    let o = 0;
    for (const d of idat) {
        komprimerat.set(d, o);
        o += d.length;
    }
    const rå = unzlibSync(komprimerat);
    const rad = bredd * kanaler;
    if (rå.length < (rad + 1) * höjd) throw new Error('PNG:ens bilddata är för kort');
    const avfiltrerat = new Uint8Array(rad * höjd);
    for (let y = 0; y < höjd; y++) {
        const filter = rå[y * (rad + 1)];
        const in0 = y * (rad + 1) + 1;
        const ut0 = y * rad;
        for (let x = 0; x < rad; x++) {
            const v = rå[in0 + x];
            const a = x >= kanaler ? avfiltrerat[ut0 + x - kanaler] : 0;
            const b = y > 0 ? avfiltrerat[ut0 - rad + x] : 0;
            const c = y > 0 && x >= kanaler ? avfiltrerat[ut0 - rad + x - kanaler] : 0;
            let f: number;
            if (filter === 0) f = 0;
            else if (filter === 1) f = a;
            else if (filter === 2) f = b;
            else if (filter === 3) f = (a + b) >> 1;
            else if (filter === 4) {
                const pa = Math.abs(b - c);
                const pb = Math.abs(a - c);
                const pc = Math.abs(a + b - 2 * c);
                f = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
            } else throw new Error(`okänt PNG-filter ${filter}`);
            avfiltrerat[ut0 + x] = (v + f) & 0xff;
        }
    }
    if (kanaler === 4) return { bredd, höjd, data: avfiltrerat };
    const data = new Uint8Array(bredd * höjd * 4);
    for (let i = 0, j = 0; i < avfiltrerat.length; i += 3, j += 4) {
        data[j] = avfiltrerat[i];
        data[j + 1] = avfiltrerat[i + 1];
        data[j + 2] = avfiltrerat[i + 2];
        data[j + 3] = 255;
    }
    return { bredd, höjd, data };
}

let crcTabell: Uint32Array | null = null;
function crc32(bytes: Uint8Array, start: number, slut: number): number {
    if (!crcTabell) {
        crcTabell = new Uint32Array(256);
        for (let n = 0; n < 256; n++) {
            let c = n;
            for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
            crcTabell[n] = c >>> 0;
        }
    }
    let c = 0xffffffff;
    for (let i = start; i < slut; i++) c = crcTabell[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

function skriv32(b: Uint8Array, i: number, v: number) {
    b[i] = v >>> 24;
    b[i + 1] = (v >>> 16) & 0xff;
    b[i + 2] = (v >>> 8) & 0xff;
    b[i + 3] = v & 0xff;
}

export function kodaPng(bild: Rgba): Uint8Array {
    const rad = bild.bredd * 4;
    const rå = new Uint8Array((rad + 1) * bild.höjd);
    for (let y = 0; y < bild.höjd; y++) rå.set(bild.data.subarray(y * rad, (y + 1) * rad), y * (rad + 1) + 1);
    // Nivå 3: uppmätt snabbast av de komprimerande nivåerna och lika liten
    // som 6 (~17 kB mot 148 kB okomprimerat) - mest genomskinliga pixlar.
    const idat = zlibSync(rå, { level: 3 });
    const ihdr = new Uint8Array(13);
    skriv32(ihdr, 0, bild.bredd);
    skriv32(ihdr, 4, bild.höjd);
    ihdr.set([8, 6, 0, 0, 0], 8);
    const bitar: [string, Uint8Array][] = [['IHDR', ihdr], ['IDAT', idat], ['IEND', new Uint8Array(0)]];
    const ut = new Uint8Array(8 + bitar.reduce((s, [, d]) => s + 12 + d.length, 0));
    ut.set(SIGNATUR, 0);
    let p = 8;
    for (const [typ, d] of bitar) {
        skriv32(ut, p, d.length);
        for (let i = 0; i < 4; i++) ut[p + 4 + i] = typ.charCodeAt(i);
        ut.set(d, p + 8);
        skriv32(ut, p + 8 + d.length, crc32(ut, p + 4, p + 8 + d.length));
        p += 12 + d.length;
    }
    return ut;
}

/** `emoji` ovanpå `kropp` med övre vänstra hörnet i (x, y) - canvasens
 *  source-over, som när webben ritar emojin på brickan. Ny bild; kroppen rörs inte. */
export function läggPå(kropp: Rgba, emoji: Rgba, x: number, y: number): Rgba {
    const d = new Uint8Array(kropp.data);
    for (let ey = 0; ey < emoji.höjd; ey++) {
        const ky = y + ey;
        if (ky < 0 || ky >= kropp.höjd) continue;
        for (let ex = 0; ex < emoji.bredd; ex++) {
            const kx = x + ex;
            if (kx < 0 || kx >= kropp.bredd) continue;
            const s = (ey * emoji.bredd + ex) * 4;
            const sa = emoji.data[s + 3];
            if (sa === 0) continue;
            const t = (ky * kropp.bredd + kx) * 4;
            if (sa === 255) {
                d[t] = emoji.data[s];
                d[t + 1] = emoji.data[s + 1];
                d[t + 2] = emoji.data[s + 2];
                d[t + 3] = 255;
                continue;
            }
            const as = sa / 255;
            const ad = (d[t + 3] / 255) * (1 - as);
            const ao = as + ad;
            for (let k = 0; k < 3; k++) d[t + k] = Math.round((emoji.data[s + k] * as + d[t + k] * ad) / ao);
            d[t + 3] = Math.round(ao * 255);
        }
    }
    return { bredd: kropp.bredd, höjd: kropp.höjd, data: d };
}
