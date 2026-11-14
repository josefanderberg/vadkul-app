/**
 * Marktäcket i nöjesfältsstilen när kartan är utzoomad - PORT av webbens
 * apps/web/src/utils/mapLandcover.ts (VADKUL#203, #211; hit i #234, Josef
 * 14/11: apparna ska bli som webben). Skog, öppen mark och fält skiljs åt
 * redan i Sverige-vyn. Samma lager-id:n, zoomsteg, kind-tabeller och färger
 * som webben - ändras de där ska kopian följa. Hela bakgrunden (ägarbesluten
 * om färgerna: nöjesfältets gamla palett, aldrig mörkare än landet, Skåne
 * grönare utzoomat) står i webbfilen och i huvudrepots kart-ui-skill.
 *
 * EN SKILLNAD MOT WEBBEN, påtvingad: webben ritar Sverige-vyn ur kakel ett
 * zoomsteg djupare (utils/deepTiles: fyra barnkakel hopslagna bakom ett eget
 * kakelprotokoll). MapLibre i appen har inget sådant protokoll att kroka i,
 * så här ritas allt ur baskartans egna kakel - webbens gren utan djup källa.
 * Färre småsjöar och lite grövre skogskanter längst ut, i övrigt samma bild.
 *
 * Två marktäckeslager ur samma källa som resten av kartan:
 *   - GROVT (source-layer 'landcover', finns bara t.o.m. kakelzoom 7):
 *     sammanslaget marktäcke för hela landet.
 *   - DETALJ (source-layer 'landuse', OSM-ytor): fullt från zoom 7.
 * Grovt till zoom 7, korstoning till detalj 7-7,75, sedan uttonat till
 * LANDCOVER_MAX_ZOOM. Stadslandningen (zoom 11) ser därför ut precis som förut.
 * Skogens konturer (Voyagers grönska, som stilen tänder först vid zoom 7)
 * förlängs utåt i lagrets egen färg.
 *
 * Ren, React-fri modul (testas i vitest utan nät).
 */
import type { StyleJson, StyleLayerJson } from './themeParkStyle';

export const LANDCOVER_MAX_ZOOM = 10;
// z8-kaklen saknar 'landcover'-lagret - lagret slutar där kaklen slutar.
export const LANDCOVER_COARSE_MAX_ZOOM = 8;
const CROSSFADE_FROM = 7;
const CROSSFADE_TO = 7.75;
const FADE_OUT_FROM = 8.5;

export const FOREST_LAYER_ID = 'forest-far';
/** Längst ut är skogen lite genomskinlig, så Sverige-vyn inte blir en mörk matta. */
export const FOREST_FAR_OPACITY = 0.65;
const FOREST_FAR_OPACITY_ZOOM = 5;
// Voyagers eget grönskelager - färgen och startzoomen läses därifrån.
const VOYAGER_GREENERY_LAYER_ID = 'landcover';

export const COARSE_LAYER_ID = 'landcover-far-coarse';
export const DETAIL_LAYER_ID = 'landcover-far-detail';

// Bara toner som nöjesfältet redan har, och inget mörkare än landet.
export const LANDCOVER_COLORS = {
    oppenMark: '#7eb152', // = THEMEPARK_GREENERY_NEAR
    falt: '#93c46c', //      = THEMEPARK_LAND_COLOR_NEAR
    ljus: '#abcf84', //      = landuse_residential
} as const;
type Ton = keyof typeof LANDCOVER_COLORS;

/** Åkrarna i Sverige-vyn: grönare än den ljusa tonen (Josef 13/11: "gör inte skåne så ljust"). */
export const LANDCOVER_FALT_FJARRAN = '#70ac48';

// Ritordning: fälten ovanpå den öppna marken.
const ORDNING: Ton[] = ['oppenMark', 'falt', 'ljus'];

// Skog i kakeldatan. Marktäckeslagren ritar den INTE (landets gröna under är
// skogens färg där) - skogens konturer har ett eget lager, FOREST_LAYER_ID.
export const FOREST_KINDS = ['forest', 'wood'] as const;

// kind -> ton per source-layer. Okända kinds och skog ritas inte.
export const COARSE_KINDS: Record<string, Ton> = {
    scrub: 'oppenMark',
    grassland: 'oppenMark',
    barren: 'ljus',
    farmland: 'falt',
    urban_area: 'ljus',
    glacier: 'ljus',
};
export const DETAIL_KINDS: Record<string, Ton> = {
    scrub: 'oppenMark',
    grassland: 'oppenMark',
    heath: 'oppenMark',
    bare_rock: 'ljus',
    farmland: 'falt',
    meadow: 'falt',
    glacier: 'ljus',
};

// `fjarran`: fälten i Sverige-vyns grönare ton.
function farg(kinds: Record<string, Ton>, fjarran: boolean): unknown[] {
    const grenar = Object.entries(kinds).flatMap(([kind, ton]) =>
        [kind, fjarran && ton === 'falt' ? LANDCOVER_FALT_FJARRAN : LANDCOVER_COLORS[ton]]);
    return ['match', ['get', 'kind'], ...grenar, 'rgba(0,0,0,0)'];
}
function sortering(kinds: Record<string, Ton>): unknown[] {
    const grenar = Object.entries(kinds).flatMap(([kind, ton]) => [kind, ORDNING.indexOf(ton)]);
    return ['match', ['get', 'kind'], ...grenar, 0];
}
// match, inte webbens in-uttryck: MapLibre Native avgör på operatorn om ett
// filter är ett uttryck, och en lista som börjar med "in" kan där läsas som
// ett filter i det äldre formatet. match är alltid ett uttryck, samma urval.
function ärNågonAv(kinds: readonly string[]): unknown[] {
    return ['match', ['get', 'kind'], [...kinds], true, false];
}
function filter(kinds: Record<string, Ton>): unknown[] {
    return ärNågonAv(Object.keys(kinds));
}

// Baskartans vektorkälla: den som vattnet eller landuse ritas ur. Voyager har
// bytt namn på den förut ("carto" -> "protomaps"), så namnet hårdkodas inte.
function baskälla(style: StyleJson): string | undefined {
    const lager = style.layers?.find(l => l['source-layer'] === 'landuse' || l['source-layer'] === 'water');
    if (!lager || typeof lager.source !== 'string') return undefined;
    const källor = style.sources as Record<string, { type?: string } | undefined> | undefined;
    return källor?.[lager.source]?.type === 'vector' ? lager.source : undefined;
}

// Skogens konturer under den zoom där Voyagers eget grönskelager tänds.
// Hoppas över om stilen saknar lagret, dess färg eller dess startzoom.
function skogslager(style: StyleJson, source: string): StyleLayerJson[] {
    const voyager = style.layers?.find(l => l.id === VOYAGER_GREENERY_LAYER_ID);
    if (!voyager || voyager.type !== 'fill' || typeof voyager.minzoom !== 'number') return [];
    const color = voyager.paint?.['fill-color'];
    if (color === undefined) return [];
    const until = voyager.minzoom;
    return [{
        id: FOREST_LAYER_ID,
        type: 'fill',
        source,
        'source-layer': 'landuse',
        maxzoom: until,
        filter: ärNågonAv(FOREST_KINDS),
        paint: {
            'fill-color': color,
            'fill-opacity': [
                'interpolate', ['linear'], ['zoom'],
                FOREST_FAR_OPACITY_ZOOM, FOREST_FAR_OPACITY,
                until, 1,
            ],
        },
    }];
}

/**
 * Lägg marktäcket i stilen (muterar den - anropas på transformens egen kopia).
 * Direkt under vattnet: över Voyagers grönska och bostadsytor, under vatten,
 * vägar och etiketter. Hoppas över om stilen saknar baskartans vektorkälla.
 */
export function läggTillMarktäcke(style: StyleJson): boolean {
    if (!style.layers || !style.sources) return false;
    if (style.layers.some(l => l.id === COARSE_LAYER_ID || l.id === DETAIL_LAYER_ID)) return false;
    const source = baskälla(style);
    if (!source) return false;

    const coarse: StyleLayerJson = {
        id: COARSE_LAYER_ID,
        type: 'fill',
        source,
        'source-layer': 'landcover',
        maxzoom: LANDCOVER_COARSE_MAX_ZOOM,
        filter: filter(COARSE_KINDS),
        layout: { 'fill-sort-key': sortering(COARSE_KINDS) },
        paint: {
            'fill-color': farg(COARSE_KINDS, true),
            'fill-opacity': [
                'interpolate', ['linear'], ['zoom'],
                CROSSFADE_FROM, 1,
                CROSSFADE_TO, 0,
            ],
        },
    };
    const detail: StyleLayerJson = {
        id: DETAIL_LAYER_ID,
        type: 'fill',
        source,
        'source-layer': 'landuse',
        minzoom: CROSSFADE_FROM,
        maxzoom: LANDCOVER_MAX_ZOOM,
        filter: filter(DETAIL_KINDS),
        layout: { 'fill-sort-key': sortering(DETAIL_KINDS) },
        paint: {
            // Fälten börjar i Sverige-vyns grönare ton och ljusnar med landet.
            'fill-color': [
                'interpolate', ['linear'], ['zoom'],
                CROSSFADE_TO, farg(DETAIL_KINDS, true),
                LANDCOVER_MAX_ZOOM, farg(DETAIL_KINDS, false),
            ],
            'fill-opacity': [
                'interpolate', ['linear'], ['zoom'],
                CROSSFADE_FROM, 0,
                CROSSFADE_TO, 1,
                FADE_OUT_FROM, 1,
                LANDCOVER_MAX_ZOOM, 0,
            ],
        },
    };
    const firstWater = style.layers.findIndex(l =>
        l.id === 'water' || l.id === 'waterway' || l.id === 'water_shadow'
        || l['source-layer'] === 'water' || l['source-layer'] === 'waterway');
    const at = firstWater >= 0 ? firstWater : Math.min(1, style.layers.length);
    // Skogen underst: fält och öppen mark ritas ovanpå.
    style.layers.splice(at, 0, ...skogslager(style, source), coarse, detail);
    return true;
}
