/**
 * "Nöjesfälts"-kartstilen — PORT av webbens fetchAndTransformThemeParkStyle
 * (apps/web/src/components/v2/v2MapBaseStyles.ts): hämta Voyager-stilen och
 * måla om den i den milda naturpaletten (grönt land, blått vatten, vita vägar,
 * dämpade byggnader). Samma färgvärden och samma zoom-toning som webben —
 * glider paletterna isär ser appen och sajten olika ut på samma plats.
 *
 * Ren, React-fri modul (testas i vitest utan nät): transformThemeParkStyle tar
 * en redan hämtad style-JSON. Typerna är strukturella minimum av stil-spec:en
 * — paketet ska inte dra in maplibre-gl här.
 *
 * VOYAGER-LICENSEN (samma block som webben): koden (style.json) är BSD 3-Clause,
 * Copyright (c) 2018, CartoDB Inc. All rights reserved — notisen ska följa med
 * i källkod. Designen är CC-BY 4.0 och kräver synlig kredit till "CARTO" och
 * "OpenMapTiles.org" i kartvyn (bors i Om-vyn när den byggs).
 */

export const STREETS_STYLE_URL = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';

// Nöjesfältets land-färger — identiska med webbens konstanter.
export const THEMEPARK_LAND_COLOR = '#5b9b3b';
export const THEMEPARK_LAND_COLOR_NEAR = '#93c46c';
const THEMEPARK_GREENERY_FAR = '#47822c';
const THEMEPARK_GREENERY_NEAR = '#7eb152';
const LAND_ZOOM_FAR = 6;
const LAND_ZOOM_NEAR = 10;

/** Strukturellt minimum av MapLibres stil-spec — bara det transformen rör. */
export interface StyleLayerJson {
    id: string;
    'source-layer'?: string;
    layout?: Record<string, unknown>;
    paint?: Record<string, unknown>;
    [key: string]: unknown;
}
export interface StyleJson {
    version: number;
    layers?: StyleLayerJson[];
    [key: string]: unknown;
}

/**
 * Bootstrap-stil vid mount (webbens BOOTSTRAP_STYLE): enfärgad platta i
 * nöjesfältets utzoomade land-färg så kartan renderar direkt medan den
 * riktiga stilen hämtas — bytet blir en intoning, inte en blixt.
 */
export const BOOTSTRAP_STYLE: StyleJson = {
    version: 8,
    sources: {},
    layers: [
        { id: 'background', type: 'background', paint: { 'background-color': THEMEPARK_LAND_COLOR } },
    ],
};

/** Måla om Voyager-stilen i nöjesfältspaletten. Muterar inte input. */
export function transformThemeParkStyle(style: StyleJson): StyleJson {
    if (!style.layers) return style;
    return {
        ...style,
        layers: style.layers.map(layer => {
            // Hav-/ocean-namnen etiketteras på ~10 språk i källdatan — göms,
            // precis som på webben. Insjönamnen (watername_lake) berörs inte.
            if (layer.id === 'watername_ocean' || layer.id === 'watername_sea') {
                return { ...layer, layout: { ...(layer.layout ?? {}), visibility: 'none' } };
            }
            if (!layer.paint) return layer;
            const paint: Record<string, unknown> = { ...layer.paint };
            const sourceLayer = layer['source-layer'];

            // Land: mörk enhetsgrön utzoomat → original-ljus vid stadsnivå.
            if (layer.id === 'background') {
                paint['background-color'] = [
                    'interpolate', ['linear'], ['zoom'],
                    LAND_ZOOM_FAR, THEMEPARK_LAND_COLOR,
                    LAND_ZOOM_NEAR, THEMEPARK_LAND_COLOR_NEAR,
                ];
            }
            // Vatten
            else if (layer.id === 'water' || layer.id === 'water_shadow') {
                paint['fill-color'] = layer.id === 'water_shadow' ? '#4278a4' : '#4e8ab7';
            }
            else if (layer.id === 'waterway') {
                paint['line-color'] = '#4e8ab7';
            }
            // Grönska — ett snäpp djupare än landet, samma zoom-toning.
            else if (
                layer.id === 'landcover' ||
                layer.id.includes('park') ||
                layer.id.includes('forest') ||
                layer.id === 'landuse'
            ) {
                if (paint['fill-color']) {
                    paint['fill-color'] = [
                        'interpolate', ['linear'], ['zoom'],
                        LAND_ZOOM_FAR, THEMEPARK_GREENERY_FAR,
                        LAND_ZOOM_NEAR, THEMEPARK_GREENERY_NEAR,
                    ];
                }
            }
            // Bostadsområden
            else if (layer.id === 'landuse_residential') {
                paint['fill-color'] = '#abcf84';
            }
            // Byggnader
            else if (layer.id.includes('building')) {
                if (paint['fill-color']) paint['fill-color'] = '#d6d2c0';
            }
            // Vägar: vita banor, sandfärgad casing-kant.
            else if (sourceLayer === 'transportation') {
                if (paint['line-color']) {
                    paint['line-color'] = layer.id.includes('casing') ? '#c9c3b2' : '#ffffff';
                }
            }

            return { ...layer, paint };
        }),
    };
}

/** Hämta Voyager + transformera. Kastar vid nätfel — anroparen faller tillbaka på STREETS_STYLE_URL. */
export async function fetchThemeParkStyle(): Promise<StyleJson> {
    const res = await fetch(STREETS_STYLE_URL);
    if (!res.ok) throw new Error(`Voyager-stilen: HTTP ${res.status}`);
    return transformThemeParkStyle((await res.json()) as StyleJson);
}
