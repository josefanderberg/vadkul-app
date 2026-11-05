/**
 * Kartans event-brickor: källan "events" med etiketterna, brickorna och
 * "+N"-badgarna. Egen komponent för att den TICKAR (lib/brickCykel): multi-
 * brickorna växlar bild och överlappande brickor turas om att ligga överst,
 * en gång i sekunden. Taktslaget bor här så bara den här lilla komponenten
 * ritas om varje halvsekund - inte hela kartskärmen med kortet.
 *
 * Tickar bara när något kan röra sig, när kartan är skärmen man ser (inte
 * under en modal) och när appen är framme.
 */
import { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { useIsFocused } from 'expo-router';
import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import type { Expression, FilterSpecification } from '@maplibre/maplibre-react-native';
import { brickHögar, CYKEL_TICK_MS, harRörelse, medCykel } from '@/lib/brickCykel';
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

export function KartBrickor({
    brickor,
    zoom,
    klara,
}: {
    brickor: GeoJSON.FeatureCollection<GeoJSON.Point, BrickProps>;
    zoom: number;
    /** Sammansatta emojibilder som MapLibre har läst in (lib/useEmojiBrickor). */
    klara: ReadonlySet<string>;
}) {
    const högar = useMemo(() => brickHögar(brickor, zoom), [brickor, zoom]);
    const rör = useMemo(() => harRörelse(brickor, högar), [brickor, högar]);
    const synlig = useIsFocused();
    const framme = useAppFramme();
    const [takt, setTakt] = useState(0);
    useEffect(() => {
        if (!rör || !synlig || !framme) return;
        const iv = setInterval(() => setTakt(t => t + 1), CYKEL_TICK_MS);
        return () => clearInterval(iv);
    }, [rör, synlig, framme]);
    const data = useMemo(() => medCykel(brickor, högar, takt, klara), [brickor, högar, takt, klara]);

    return (
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
    );
}
