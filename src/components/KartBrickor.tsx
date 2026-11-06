/**
 * Kartans event-brickor: källan "events" med etiketterna, brickorna och
 * "+N"-badgarna, plus TONLAGRET. Egen komponent för att den tickar med
 * webbens rytm (lib/brickCykel, Josef 6/11: "webben har mycket bättre
 * övergång"): EN multibricka i taget byter ram var halvsekund och den gamla
 * bilden tonas bort ovanpå den nya; var 1,6 s får EN hög av överlappande
 * brickor en ny överst, och den tonas in. Taktslaget bor här och tonerna i
 * BrickTon, så bara de ritas om - inte hela kartskärmen med kortet.
 *
 * Tickar bara när något kan röra sig, när kartan är skärmen man ser (inte
 * under en modal) och när appen är framme.
 */
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useIsFocused } from 'expo-router';
import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import type { Expression, FilterSpecification } from '@maplibre/maplibre-react-native';
import {
    brickHögar,
    CYKEL_STEG_MS,
    CYKEL_TON_MS,
    medCykel,
    nästaFront,
    nästaIRunda,
    visadBild,
    växlande,
    överstIHögarna,
    Z_STEG_MS,
    Z_TON_MS,
    type ÖverlappsHög,
} from '@/lib/brickCykel';
import { BADGE_X, BADGE_Y, BRICKA_ICON_SIZE } from '@/lib/brickor';
import type { BrickProps } from '@/lib/kartlager';

const GRUPP_FILTER: FilterSpecification = ['>', ['get', 'antal'], 1];
/** Passerade grupper får ingen text (en etikett över en släckt bricka svävar). */
const ETIKETT_FILTER: FilterSpecification = ['all', ['!', ['get', 'past']], ['!', ['get', 'vald']]];
const VALD_FILTER: FilterSpecification = ['==', ['get', 'vald'], true];

export const ETIKETT_STIL = {
    textFont: ['Montserrat Medium', 'Open Sans Bold'],
    textSize: ['interpolate', ['linear'], ['zoom'], 9, 11, 13, 12.5, 16, 13.5] as unknown as Expression,
    // Spetsen står på koordinaten → texten börjar strax under den.
    textAnchor: 'top' as const,
    textOffset: [0, 0.35],
    textMaxWidth: 12,
    // Lägst placeras först och vinner kollisionen.
    symbolSortKey: ['get', 'etikettPrio'] as unknown as Expression,
    textColor: '#ffffff',
    textHaloColor: 'rgba(51,65,85,0.8)',
    textHaloWidth: 2,
};

function useAppFramme(): boolean {
    const [framme, setFramme] = useState(AppState.currentState === 'active');
    useEffect(() => {
        const sub = AppState.addEventListener('change', s => setFramme(s === 'active'));
        return () => sub.remove();
    }, []);
    return framme;
}

type Brickor = GeoJSON.FeatureCollection<GeoJSON.Point, BrickProps>;

export function KartBrickor({
    brickor,
    zoom,
    klara,
}: {
    brickor: Brickor;
    zoom: number;
    /** Sammansatta emojibilder som MapLibre har läst in (lib/useEmojiBrickor). */
    klara: ReadonlySet<string>;
}) {
    const högar = useMemo(() => brickHögar(brickor, zoom), [brickor, zoom]);
    const cyklande = useMemo(() => växlande(brickor), [brickor]);
    const rör = cyklande.length > 0 || högar.length > 0;
    const synlig = useIsFocused();
    const framme = useAppFramme();

    // Vilken ram varje växlande bricka står på, och vem som ligger överst i
    // varje hög (hög-id → bricka). Okänd = ram 0 / den naturliga toppen.
    const [ramIndex, setRamIndex] = useState<ReadonlyMap<string, number>>(() => new Map());
    const [fronter, setFronter] = useState<ReadonlyMap<string, string>>(() => new Map());
    const ton = useRef<BrickTonRef>(null);

    // Det senaste läget för taktslagens återanrop (de registreras en gång).
    const läge = useRef({ brickor, högar, cyklande, klara, ramIndex, fronter });
    useEffect(() => {
        läge.current = { brickor, högar, cyklande, klara, ramIndex, fronter };
    });
    const senastBricka = useRef<string | null>(null);
    const senastHög = useRef<string | null>(null);

    // EMOJIVÄXLINGEN: en bricka per slag, i tur och ordning.
    useEffect(() => {
        if (!rör || !synlig || !framme) return;
        const iv = setInterval(() => {
            const s = läge.current;
            const id = nästaIRunda(s.cyklande, senastBricka.current);
            if (!id) return;
            senastBricka.current = id;
            const f = s.brickor.features.find(x => x.properties.id === id);
            const ramar = f?.properties.ramar;
            if (!f || !ramar || ramar.length < 2) return;
            const gammal = visadBild(f.properties, s.ramIndex, s.klara);
            const nya = new Map(s.ramIndex).set(id, ((s.ramIndex.get(id) ?? 0) + 1) % ramar.length);
            s.ramIndex = nya;
            setRamIndex(nya);
            if (visadBild(f.properties, nya, s.klara) === gammal) return;
            // En bricka som ligger UNDER en granne byter rakt av - en tonande
            // kopia skulle synas ovanpå grannen.
            const iHög = s.högar.some(h => h.members.includes(id));
            if (iHög && !överstIHögarna(s.högar, s.fronter).has(id)) return;
            ton.current?.lägg({
                nyckel: `ram:${id}`,
                koord: f.geometry.coordinates as [number, number],
                ikon: gammal,
                från: 1,
                till: 0,
                ms: CYKEL_TON_MS,
            });
        }, CYKEL_STEG_MS);
        return () => clearInterval(iv);
    }, [rör, synlig, framme]);

    // Z-VÄXLINGEN: en hög per slag, i tur och ordning.
    useEffect(() => {
        if (!rör || !synlig || !framme) return;
        const iv = setInterval(() => {
            const s = läge.current;
            const ids = s.högar.map(h => h.id);
            // Högar som försvunnit (panorering, zoom) släpper sin front.
            const giltiga = new Set(ids);
            let fr = s.fronter;
            if ([...fr.keys()].some(k => !giltiga.has(k))) {
                fr = new Map([...fr].filter(([k]) => giltiga.has(k)));
                s.fronter = fr;
                setFronter(fr);
            }
            const hId = nästaIRunda(ids, senastHög.current);
            if (!hId) return;
            senastHög.current = hId;
            const hög = s.högar.find(h => h.id === hId) as ÖverlappsHög;
            const förra = fr.get(hId) ?? null;
            const nästa = nästaFront(hög, förra);
            const brickaFör = (key: string) => s.brickor.features.find(x => x.properties.id === key);
            if (nästa === hög.topKey) {
                // Varvet runt: lyftet släpps och kopian av förra tonas bort,
                // så den naturliga toppen tar över mjukt.
                const utan = new Map(fr);
                utan.delete(hId);
                s.fronter = utan;
                setFronter(utan);
                const f = förra ? brickaFör(förra) : undefined;
                if (f) {
                    ton.current?.lägg({
                        nyckel: `z:${hId}`,
                        koord: f.geometry.coordinates as [number, number],
                        ikon: visadBild(f.properties, s.ramIndex, s.klara),
                        från: 1,
                        till: 0,
                        ms: Z_TON_MS,
                    });
                }
                return;
            }
            const f = brickaFör(nästa);
            if (!f) return;
            // Ny front: kopian tonas IN ovanpå högen, och när den står helt
            // synlig lyfts brickan själv - bytet under kopian syns inte.
            ton.current?.lägg({
                nyckel: `z:${hId}`,
                koord: f.geometry.coordinates as [number, number],
                ikon: visadBild(f.properties, s.ramIndex, s.klara),
                från: 0,
                till: 1,
                ms: Z_TON_MS,
                klar: () => {
                    const m = new Map(läge.current.fronter).set(hId, nästa);
                    läge.current.fronter = m;
                    setFronter(m);
                },
            });
        }, Z_STEG_MS);
        return () => clearInterval(iv);
    }, [rör, synlig, framme]);

    const lyfta = useMemo(() => {
        const ut = new Set<string>();
        for (const h of högar) {
            const front = fronter.get(h.id);
            if (front && front !== h.topKey && h.members.includes(front)) ut.add(front);
        }
        return ut;
    }, [högar, fronter]);
    const data = useMemo(() => medCykel(brickor, ramIndex, lyfta, klara), [brickor, ramIndex, lyfta, klara]);

    return (
        <>
        <GeoJSONSource id="events" data={data}>
            {/* Etiketterna (webbens LABEL_LAYER_IDS): TITEL FÖRE
                KATEGORI NÄR DEN FÅR PLATS, annars kategorin, annars
                inget. Båda ligger UNDER brickorna (en etikett får
                aldrig skymma en bricka). MapLibre placerar
                uppifrån och ner - titellagret tar plats först, och
                kategorin för SAMMA bricka krockar med sin egen
                titel och syns bara när titeln inte fick plats.
                Inom lagret går de populäraste först (etikettPrio).
                INGEN zoomgräns, till skillnad från webbens
                LABEL_CAT_MIN_ZOOM 9 (Josef 9/10: "så man alltid
                ser något på avstånd iallafall") - kollisionen
                gallrar, och bara urvalet kring mitten är brickor
                (resten är prickar utan etikett). En växlande
                multibricka byter text i samma takt som bilden. */}
            <Layer
                type="symbol"
                id="etikett-kategori"
                filter={ETIKETT_FILTER}
                style={{ ...ETIKETT_STIL, textField: ['get', 'label'] as unknown as Expression }}
            />
            <Layer
                type="symbol"
                id="etikett-titel"
                filter={ETIKETT_FILTER}
                style={{ ...ETIKETT_STIL, textField: ['get', 'titel'] as unknown as Expression }}
            />
            <Layer
                type="symbol"
                id="event-brickor"
                style={{
                    iconImage: ['get', 'ikon'] as unknown as Expression,
                    iconSize: BRICKA_ICON_SIZE,
                    iconAnchor: 'bottom',
                    iconAllowOverlap: true,
                    iconIgnorePlacement: true,
                    iconOpacity: ['case', ['get', 'past'], 0.45, 1] as unknown as Expression,
                    symbolSortKey: ['get', 'sort'] as unknown as Expression,
                }}
            />
            {/* "+N" på grupper: vit pill + siffra som EN bakad bild
                (antal-N), så en grannbadges siffra aldrig ritas
                ovanpå en annan badges cirkel. Det gamla cirkel- +
                textlagret ritade alla siffror sist, i hög. */}
            <Layer
                type="symbol"
                id="event-antal"
                filter={GRUPP_FILTER}
                style={{
                    iconImage: ['get', 'antalIkon'] as unknown as Expression,
                    iconSize: BRICKA_ICON_SIZE,
                    iconTranslate: [BADGE_X, -BADGE_Y],
                    iconAllowOverlap: true,
                    iconIgnorePlacement: true,
                    iconOpacity: ['case', ['get', 'past'], 0.6, 1] as unknown as Expression,
                    symbolSortKey: ['get', 'sort'] as unknown as Expression,
                }}
            />
            {/* Den valda brickans titel - överst och alltid synlig. */}
            <Layer
                type="symbol"
                id="etikett-vald"
                filter={VALD_FILTER}
                style={{
                    ...ETIKETT_STIL,
                    textField: ['get', 'titel'] as unknown as Expression,
                    textAllowOverlap: true,
                }}
            />
        </GeoJSONSource>
        {/* Tonerna: ovanpå brickorna, under "+N"-badgarna. */}
        <BrickTon ref={ton} />
        </>
    );
}

// ── Tonlagret ────────────────────────────────────────────────────────────────
// En kopia av en bricka vars opacitet går från → till (webbens cross-fade
// och spegellagrets 'zop'-ramp). Varje ruta skrivs om med requestAnimationFrame;
// källan har bara de några få brickor som tonas just nu, så det är billigt.

export interface BrickTonPost {
    /** Samma nyckel ersätter en pågående ton (den gamla avslutas direkt). */
    nyckel: string;
    koord: [number, number];
    ikon: string;
    från: number;
    till: number;
    ms: number;
    /** När tonen är klar (eller ersatt). */
    klar?: () => void;
}
interface Aktiv extends BrickTonPost {
    start: number;
}
export interface BrickTonRef {
    lägg: (t: BrickTonPost) => void;
}

const TOM: GeoJSON.FeatureCollection<GeoJSON.Point, { ikon: string; op: number }> = { type: 'FeatureCollection', features: [] };

function tonData(aktiva: readonly Aktiv[], nu: number): GeoJSON.FeatureCollection<GeoJSON.Point, { ikon: string; op: number }> {
    if (aktiva.length === 0) return TOM;
    return {
        type: 'FeatureCollection',
        features: aktiva.map(t => {
            const p = Math.max(0, Math.min(1, (nu - t.start) / t.ms));
            return {
                type: 'Feature',
                geometry: { type: 'Point', coordinates: t.koord },
                properties: { ikon: t.ikon, op: t.från + (t.till - t.från) * p },
            };
        }),
    };
}

const BrickTon = forwardRef<BrickTonRef>(function BrickTon(_props, ref) {
    const aktiva = useRef<Aktiv[]>([]);
    const raf = useRef<number | null>(null);
    const rutaRef = useRef<() => void>(() => {});
    const [data, setData] = useState(TOM);

    useEffect(() => {
        rutaRef.current = () => {
            const nu = Date.now();
            const klara: (() => void)[] = [];
            aktiva.current = aktiva.current.filter(t => {
                if (nu - t.start < t.ms) return true;
                if (t.klar) klara.push(t.klar);
                return false;
            });
            setData(tonData(aktiva.current, nu));
            // Samma ögonblick: kopian försvinner och brickan själv tar över.
            klara.forEach(k => k());
            raf.current = aktiva.current.length > 0 ? requestAnimationFrame(() => rutaRef.current()) : null;
        };
        return () => {
            if (raf.current != null) cancelAnimationFrame(raf.current);
            raf.current = null;
        };
    }, []);

    useImperativeHandle(ref, () => ({
        lägg: t => {
            const nu = Date.now();
            aktiva.current = aktiva.current.filter(x => {
                if (x.nyckel !== t.nyckel) return true;
                x.klar?.();
                return false;
            });
            aktiva.current.push({ ...t, start: nu });
            // Första rutan DIREKT, i samma uppdatering som brickans byte -
            // annars hinner den nya bilden synas en ruta innan kopian är på plats.
            setData(tonData(aktiva.current, nu));
            if (raf.current == null) raf.current = requestAnimationFrame(() => rutaRef.current());
        },
    }), []);

    return (
        <GeoJSONSource id="events-ton" data={data}>
            <Layer
                type="symbol"
                id="event-ton"
                beforeId="event-antal"
                style={{
                    iconImage: ['get', 'ikon'] as unknown as Expression,
                    iconSize: BRICKA_ICON_SIZE,
                    iconAnchor: 'bottom',
                    iconAllowOverlap: true,
                    iconIgnorePlacement: true,
                    iconOpacity: ['get', 'op'] as unknown as Expression,
                }}
            />
        </GeoJSONSource>
    );
});
