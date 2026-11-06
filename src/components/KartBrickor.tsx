/**
 * Kartans event-brickor: källan "events" med etiketterna, brickorna och
 * "+N"-badgarna, plus TONLAGRET där multibrickorna bläddrar (lib/brickCykel).
 *
 * BRICKKÄLLAN RÖRS INTE AV BLÄDDRINGEN (Josef 6/11: "vid varje byte blinkar
 * ALLA eventbrickor till"): ny data i en GeoJSON-källa får MapLibre att lägga
 * ut och tona in alla dess symboler. Därför:
 *  - huvudkällan får sin data som en sträng som bara ändras när innehållet
 *    gör det (en minuttick med samma brickor skickar ingenting),
 *  - alla lagerstilar är fasta konstanter (en ny stil-objekt-identitet per
 *    rendering ska aldrig nå kartan),
 *  - bläddringen bor i <Bläddring>, som bara ändrar LAGERNIVÅNS opacitet i
 *    tonlagret - MapLibre tonar själv (iconOpacityTransition), ingen omritning.
 *
 * Takten är webbens: en multibricka i taget byter ram var 0,5 s (tona 0,2 s),
 * men varje ram står minst 4 s (webbens 3-8 s per bricka), och en hög av
 * överlappande brickor får en ny överst var 1,6 s (tona 0,22 s).
 * Tickar bara när något kan röra sig, kartan syns (ingen modal över) och
 * appen är framme.
 */
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useIsFocused } from 'expo-router';
import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import type { Expression, FilterSpecification, SymbolLayerStyle } from '@maplibre/maplibre-react-native';
import {
    basBrickor,
    brickHögar,
    byggTonlager,
    CYKEL_STEG_MS,
    CYKEL_TON_MS,
    nästaFront,
    nästaIRunda,
    RAM_MINST_MS,
    tonOpacitet,
    TOMT_LÄGE,
    växlande,
    Z_STEG_MS,
    Z_TON_MS,
    type BläddrLäge,
    type ÖverlappsHög,
    type TonPost,
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

// Fasta stilar - samma objekt vid varje rendering.
const KATEGORI_STIL = { ...ETIKETT_STIL, textField: ['get', 'label'] as unknown as Expression };
const TITEL_STIL = { ...ETIKETT_STIL, textField: ['get', 'titel'] as unknown as Expression };
const BRICK_STIL: SymbolLayerStyle = {
    iconImage: ['get', 'ikon'] as unknown as Expression,
    iconSize: BRICKA_ICON_SIZE,
    iconAnchor: 'bottom',
    iconAllowOverlap: true,
    iconIgnorePlacement: true,
    iconOpacity: ['case', ['get', 'past'], 0.45, 1] as unknown as Expression,
    symbolSortKey: ['get', 'sort'] as unknown as Expression,
};
const ANTAL_STIL: SymbolLayerStyle = {
    iconImage: ['get', 'antalIkon'] as unknown as Expression,
    iconSize: BRICKA_ICON_SIZE,
    iconTranslate: [BADGE_X, -BADGE_Y],
    iconAllowOverlap: true,
    iconIgnorePlacement: true,
    iconOpacity: ['case', ['get', 'past'], 0.6, 1] as unknown as Expression,
    symbolSortKey: ['get', 'sort'] as unknown as Expression,
};
const VALD_TITEL_STIL = { ...ETIKETT_STIL, textField: ['get', 'titel'] as unknown as Expression, textAllowOverlap: true };

function useAppFramme(): boolean {
    const [framme, setFramme] = useState(AppState.currentState === 'active');
    useEffect(() => {
        const sub = AppState.addEventListener('change', s => setFramme(s === 'active'));
        return () => sub.remove();
    }, []);
    return framme;
}

/** Kort, stabil hash (djb2, base36) - unika käll- och lager-id:n per uppsättning. */
function hash(text: string): string {
    let h = 5381;
    for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
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
    // Som STRÄNG: kartan får bara ny data när innehållet faktiskt ändrats
    // (React jämför strängar på värde - en minuttick med samma brickor når
    // aldrig MapLibre).
    const data = useMemo(() => JSON.stringify(basBrickor(brickor, klara)), [brickor, klara]);
    const högar = useMemo(() => brickHögar(brickor, zoom), [brickor, zoom]);

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
                    (resten är prickar utan etikett). */}
                <Layer type="symbol" id="etikett-kategori" filter={ETIKETT_FILTER} style={KATEGORI_STIL} />
                <Layer type="symbol" id="etikett-titel" filter={ETIKETT_FILTER} style={TITEL_STIL} />
                <Layer type="symbol" id="event-brickor" style={BRICK_STIL} />
                {/* "+N" på grupper: vit pill + siffra som EN bakad bild
                    (antal-N), så en grannbadges siffra aldrig ritas
                    ovanpå en annan badges cirkel. */}
                <Layer type="symbol" id="event-antal" filter={GRUPP_FILTER} style={ANTAL_STIL} />
                {/* Den valda brickans titel - överst och alltid synlig. */}
                <Layer type="symbol" id="etikett-vald" filter={VALD_FILTER} style={VALD_TITEL_STIL} />
            </GeoJSONSource>
            <Bläddring brickor={brickor} högar={högar} klara={klara} />
        </>
    );
}

/**
 * Tonlagret + taktslaget. Kopiorna (byggTonlager) ligger stilla; det enda som
 * ändras vid ett byte är opaciteten på ett par lager. Ett byte i två steg:
 * det nya visas medan det gamla HÅLLS kvar, och tonens längd senare släpps
 * det gamla - så grundbilden aldrig skymtar mitt i bytet.
 */
function Bläddring({
    brickor,
    högar,
    klara,
}: {
    brickor: Brickor;
    högar: readonly ÖverlappsHög[];
    klara: ReadonlySet<string>;
}) {
    const ton = useMemo(() => byggTonlager(brickor, högar, klara), [brickor, högar, klara]);
    const tonData = useMemo(() => JSON.stringify(ton.data), [ton.data]);
    // Lagerordningen (ram under fram) gäller bara när alla läggs till i en
    // följd - byts uppsättningen monteras hela tonlagret om, med egna id:n
    // (hashen) så den gamla och den nya aldrig krockar i kartan.
    const uppsättning = useMemo(() => hash(ton.poster.map(p => p.k).join(',')), [ton.poster]);
    const antalRamar = useMemo(() => {
        const m = new Map<string, number>();
        for (const f of brickor.features) m.set(f.properties.id, Math.max(1, f.properties.ramar?.length ?? 1));
        return m;
    }, [brickor]);
    const cyklande = useMemo(() => växlande(brickor), [brickor]);
    const rör = cyklande.length > 0 || högar.length > 0;
    const synlig = useIsFocused();
    const framme = useAppFramme();

    const [läge, setLäge] = useState<BläddrLäge>(TOMT_LÄGE);
    const senast = useRef({ cyklande, högar, antalRamar, läge });
    useEffect(() => {
        senast.current = { cyklande, högar, antalRamar, läge };
    });
    const senastBricka = useRef<string | null>(null);
    /** När varje bricka senast bytte ram (RAM_MINST_MS). */
    const bytt = useRef(new Map<string, number>());
    const senastHög = useRef<string | null>(null);
    const timrar = useRef(new Set<ReturnType<typeof setTimeout>>());
    useEffect(() => {
        const t = timrar.current;
        return () => { t.forEach(clearTimeout); t.clear(); };
    }, []);
    const senare = (ms: number, fn: () => void) => {
        const t = setTimeout(() => { timrar.current.delete(t); fn(); }, ms);
        timrar.current.add(t);
    };

    // EMOJIVÄXLINGEN: en bricka per slag, i tur och ordning.
    useEffect(() => {
        if (!rör || !synlig || !framme) return;
        const iv = setInterval(() => {
            const s = senast.current;
            const id = nästaIRunda(s.cyklande, senastBricka.current);
            if (!id) return;
            senastBricka.current = id;
            const n = s.antalRamar.get(id) ?? 1;
            if (n < 2) return;
            const nu = Date.now();
            if (nu - (bytt.current.get(id) ?? 0) < RAM_MINST_MS) return;
            bytt.current.set(id, nu);
            const förra = (s.läge.ramIndex.get(id) ?? 0) % n;
            const nästa = (förra + 1) % n;
            setLäge(l => ({
                ...l,
                ramIndex: new Map(l.ramIndex).set(id, nästa),
                ramHåll: new Map(l.ramHåll).set(id, förra),
            }));
            senare(CYKEL_TON_MS + 40, () => setLäge(l => {
                if (l.ramHåll.get(id) !== förra) return l;
                const håll = new Map(l.ramHåll);
                håll.delete(id);
                return { ...l, ramHåll: håll };
            }));
        }, CYKEL_STEG_MS);
        return () => clearInterval(iv);
    }, [rör, synlig, framme]);

    // Z-VÄXLINGEN: en hög per slag, i tur och ordning.
    useEffect(() => {
        if (!rör || !synlig || !framme) return;
        const iv = setInterval(() => {
            const s = senast.current;
            const ids = s.högar.map(h => h.id);
            const hId = nästaIRunda(ids, senastHög.current);
            const giltiga = new Set(ids);
            if (!hId) {
                if (s.läge.fronter.size > 0) setLäge(l => ({ ...l, fronter: new Map() }));
                return;
            }
            senastHög.current = hId;
            const hög = s.högar.find(h => h.id === hId) as ÖverlappsHög;
            const förra = s.läge.fronter.get(hId) ?? null;
            const nästa = nästaFront(hög, förra);
            setLäge(l => {
                // Högar som försvunnit (panorering, zoom) släpper sin front.
                const fronter = new Map([...l.fronter].filter(([k]) => giltiga.has(k)));
                if (nästa === hög.topKey) fronter.delete(hId);
                else fronter.set(hId, nästa);
                const frontHåll = new Set(l.frontHåll);
                if (förra) frontHåll.add(förra);
                return { ...l, fronter, frontHåll };
            });
            if (förra) {
                senare(Z_TON_MS + 40, () => setLäge(l => {
                    if (!l.frontHåll.has(förra)) return l;
                    const frontHåll = new Set(l.frontHåll);
                    frontHåll.delete(förra);
                    return { ...l, frontHåll };
                }));
            }
        }, Z_STEG_MS);
        return () => clearInterval(iv);
    }, [rör, synlig, framme]);

    if (ton.poster.length === 0) return null;
    return (
        <GeoJSONSource key={uppsättning} id={`events-ton-${uppsättning}`} data={tonData}>
            {ton.poster.map(p => (
                <TonLager key={p.k} gen={uppsättning} post={p} op={tonOpacitet(p, läge, antalRamar.get(p.id) ?? 1)} />
            ))}
        </GeoJSONSource>
    );
}

/**
 * Ett lager i tonlagret: EN kopia (filter på nyckeln) med opaciteten på
 * lagernivå, så ett byte bara är en målad egenskap som MapLibre tonar själv.
 * Ovanpå brickorna, under "+N"-badgarna. memo: bara lagren vars opacitet
 * ändras renderas om. `source` kommer från GeoJSONSource (cloneElement).
 */
const TonLager = memo(function TonLager({ gen, post, op, ...rest }: { gen: string; post: TonPost; op: 0 | 1 }) {
    const filter = useMemo<FilterSpecification>(() => ['==', ['get', 'k'], post.k], [post.k]);
    const style = useMemo(() => ({
        iconImage: ['get', 'ikon'] as unknown as Expression,
        iconSize: BRICKA_ICON_SIZE,
        iconAnchor: 'bottom' as const,
        iconAllowOverlap: true,
        iconIgnorePlacement: true,
        iconOpacity: op,
        iconOpacityTransition: { duration: post.grupp === 'fram' ? Z_TON_MS : CYKEL_TON_MS, delay: 0 },
    }), [op, post.grupp]);
    return <Layer {...rest} type="symbol" id={`ton-${gen}:${post.k}`} beforeId="event-antal" filter={filter} style={style} />;
});
