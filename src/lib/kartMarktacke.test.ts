import { describe, expect, it } from 'vitest';
import {
    COARSE_KINDS, COARSE_LAYER_ID, DETAIL_KINDS, DETAIL_LAYER_ID, FOREST_FAR_OPACITY, FOREST_KINDS, FOREST_LAYER_ID,
    LANDCOVER_COARSE_MAX_ZOOM, LANDCOVER_COLORS, LANDCOVER_FALT_FJARRAN, LANDCOVER_MAX_ZOOM, läggTillMarktäcke,
} from './kartMarktacke';
import { THEMEPARK_LAND_COLOR, THEMEPARK_LAND_COLOR_NEAR, type StyleJson, type StyleLayerJson } from './themeParkStyle';

// Porten av webbens marktäcke (apps/web/src/utils/mapLandcover.test.ts), utan
// de djupare kaklen som appen saknar.

// Grönskans färg så som nöjesfältsstilen sätter den på Voyagers lager.
const GRONSKA = ['interpolate', ['linear'], ['zoom'], 6, '#47822c', 10, '#7eb152'];

// Voyager i miniatyr, med lagren i samma ordning som den riktiga stilen.
function voyagerLik(källa = 'protomaps'): StyleJson {
    return {
        version: 8,
        sources: { [källa]: { type: 'vector', tiles: ['https://example.invalid/{z}/{x}/{y}.mvt'] } },
        layers: [
            { id: 'background', type: 'background' },
            { id: 'landcover', type: 'fill', source: källa, 'source-layer': 'landuse', minzoom: 7, paint: { 'fill-color': GRONSKA } },
            { id: 'park_nature_reserve', type: 'fill', source: källa, 'source-layer': 'landuse' },
            { id: 'landuse_residential', type: 'fill', source: källa, 'source-layer': 'landuse', minzoom: 6 },
            { id: 'waterway', type: 'line', source: källa, 'source-layer': 'water' },
            { id: 'water', type: 'fill', source: källa, 'source-layer': 'water' },
            { id: 'road_primary', type: 'line', source: källa, 'source-layer': 'roads' },
            { id: 'place_city', type: 'symbol', source: källa, 'source-layer': 'places' },
        ],
    };
}
const färdig = (källa?: string) => { const s = voyagerLik(källa); läggTillMarktäcke(s); return s; };
function lager(style: StyleJson, id: string): StyleLayerJson {
    const l = style.layers!.find(x => x.id === id);
    if (!l) throw new Error(`saknar ${id}`);
    return l;
}
// Opaciteten ur ett ['interpolate', ['linear'], ['zoom'], z0, v0, z1, v1, ...]-uttryck.
function opacitetVid(l: StyleLayerJson, zoom: number): number {
    const uttryck = l.paint!['fill-opacity'] as unknown[];
    const stopp: [number, number][] = [];
    for (let i = 3; i < uttryck.length; i += 2) stopp.push([uttryck[i] as number, uttryck[i + 1] as number]);
    if (zoom <= stopp[0][0]) return stopp[0][1];
    for (let i = 1; i < stopp.length; i++) {
        const [z0, v0] = stopp[i - 1], [z1, v1] = stopp[i];
        if (zoom <= z1) return v0 + (v1 - v0) * (zoom - z0) / (z1 - z0);
    }
    return stopp[stopp.length - 1][1];
}
// Synligt vid zoom = inom min/maxzoom och opacitet över noll.
function synligVid(l: StyleLayerJson, zoom: number) {
    if (typeof l.minzoom === 'number' && zoom < l.minzoom) return false;
    if (typeof l.maxzoom === 'number' && zoom >= l.maxzoom) return false;
    return opacitetVid(l, zoom) > 0;
}
// Färgen ett match-uttryck ger en viss kind.
function färgFör(uttryck: unknown, kind: string): unknown {
    const m = uttryck as unknown[];
    for (let i = 2; i < m.length - 1; i += 2) if (m[i] === kind) return m[i + 1];
    return m[m.length - 1];
}
const ljushet = (hex: string) => [1, 3, 5].reduce((s, i) => s + parseInt(hex.slice(i, i + 2), 16), 0);

describe('läggTillMarktäcke (porten av webbens marktäcke utzoomat)', () => {
    it('lägger skogen och marktäcket över Voyagers grönska men under vattnet', () => {
        expect(färdig().layers!.map(l => l.id)).toEqual([
            'background', 'landcover', 'park_nature_reserve', 'landuse_residential',
            FOREST_LAYER_ID, COARSE_LAYER_ID, DETAIL_LAYER_ID,
            'waterway', 'water', 'road_primary', 'place_city',
        ]);
    });

    it('ritar ur baskartans egna kakel, vad källan än heter, och lägger inte till någon källa', () => {
        for (const namn of ['protomaps', 'carto']) {
            const s = färdig(namn);
            expect(lager(s, COARSE_LAYER_ID)).toMatchObject({ source: namn, 'source-layer': 'landcover' });
            expect(lager(s, DETAIL_LAYER_ID)).toMatchObject({ source: namn, 'source-layer': 'landuse' });
            expect(lager(s, FOREST_LAYER_ID)).toMatchObject({ source: namn, 'source-layer': 'landuse' });
            expect(Object.keys(s.sources as object)).toEqual([namn]);
        }
    });

    it('Sverige-vyn visar det grova marktäcket, detaljen tar över från zoom 7', () => {
        const s = färdig();
        const grovt = lager(s, COARSE_LAYER_ID);
        const detalj = lager(s, DETAIL_LAYER_ID);
        expect(opacitetVid(grovt, 5)).toBe(1);
        expect(synligVid(detalj, 6.9)).toBe(false);
        // Korstoningen: båda finns i z7-kaklen.
        expect(synligVid(grovt, 7.3)).toBe(true);
        expect(synligVid(detalj, 7.3)).toBe(true);
        expect(opacitetVid(detalj, 8)).toBe(1);
        // z8-kaklen har inget 'landcover'-lager.
        expect(grovt.maxzoom).toBe(LANDCOVER_COARSE_MAX_ZOOM);
        expect(synligVid(grovt, 8)).toBe(false);
    });

    it('är borta före stadsvyn, så stadslandningen (zoom 11) ser ut som förut', () => {
        const s = färdig();
        expect(LANDCOVER_MAX_ZOOM).toBeLessThan(10.5);
        for (const id of [COARSE_LAYER_ID, DETAIL_LAYER_ID, FOREST_LAYER_ID]) {
            expect(lager(s, id).maxzoom).toBeLessThanOrEqual(LANDCOVER_MAX_ZOOM);
            expect(synligVid(lager(s, id), 11)).toBe(false);
        }
    });

    it('skog ritas inte av marktäcket: bara öppen mark, fält och ljusa ytor', () => {
        for (const kinds of [COARSE_KINDS, DETAIL_KINDS]) {
            for (const skog of FOREST_KINDS) expect(kinds[skog]).toBeUndefined();
        }
        const s = färdig();
        expect(färgFör(lager(s, COARSE_LAYER_ID).paint!['fill-color'], 'forest')).toBe('rgba(0,0,0,0)');
        expect(färgFör(lager(s, COARSE_LAYER_ID).paint!['fill-color'], 'grassland')).toBe(LANDCOVER_COLORS.oppenMark);
    });

    // Josef 13/11: "det ska inte vara mörkare karta än innan" och, om
    // Sverige-vyn, "gör inte skåne så ljust. ha en grönare nyans".
    it('varje ton är ljusare än landet utzoomat, och åkrarna är grönare i Sverige-vyn', () => {
        for (const ton of [...Object.values(LANDCOVER_COLORS), LANDCOVER_FALT_FJARRAN]) {
            expect(ljushet(ton)).toBeGreaterThan(ljushet(THEMEPARK_LAND_COLOR));
        }
        expect(LANDCOVER_COLORS.falt).toBe(THEMEPARK_LAND_COLOR_NEAR);
        expect(ljushet(LANDCOVER_FALT_FJARRAN)).toBeLessThan(ljushet(LANDCOVER_COLORS.falt));
        const s = färdig();
        expect(färgFör(lager(s, COARSE_LAYER_ID).paint!['fill-color'], 'farmland')).toBe(LANDCOVER_FALT_FJARRAN);
        // Detaljlagret tonar från den grönare tonen till den ljusa.
        const detalj = lager(s, DETAIL_LAYER_ID).paint!['fill-color'] as unknown[];
        expect(färgFör(detalj[4], 'farmland')).toBe(LANDCOVER_FALT_FJARRAN);
        expect(detalj[5]).toBe(LANDCOVER_MAX_ZOOM);
        expect(färgFör(detalj[6], 'farmland')).toBe(LANDCOVER_COLORS.falt);
    });

    it('skogens konturer förlängs utåt i grönskans egen färg, lite genomskinliga längst ut', () => {
        const skog = lager(färdig(), FOREST_LAYER_ID);
        expect(skog.paint!['fill-color']).toEqual(GRONSKA);
        // Slutar där Voyagers eget grönskelager tänds.
        expect(skog.maxzoom).toBe(7);
        expect(opacitetVid(skog, 5)).toBe(FOREST_FAR_OPACITY);
        expect(opacitetVid(skog, 7)).toBe(1);
        expect(skog.filter).toEqual(['match', ['get', 'kind'], [...FOREST_KINDS], true, false]);
    });

    it('utan Voyagers grönskelager hoppas skogen över, resten läggs till', () => {
        const s = voyagerLik();
        s.layers = s.layers!.filter(l => l.id !== 'landcover');
        expect(läggTillMarktäcke(s)).toBe(true);
        expect(s.layers.some(l => l.id === FOREST_LAYER_ID)).toBe(false);
        expect(s.layers.some(l => l.id === COARSE_LAYER_ID)).toBe(true);
    });

    it('filtren är match-uttryck med lagrets kinds (alltid uttryck, även i MapLibre Native)', () => {
        const s = färdig();
        expect(lager(s, COARSE_LAYER_ID).filter).toEqual(['match', ['get', 'kind'], Object.keys(COARSE_KINDS), true, false]);
        expect(lager(s, DETAIL_LAYER_ID).filter).toEqual(['match', ['get', 'kind'], Object.keys(DETAIL_KINDS), true, false]);
    });

    it('läggs inte till två gånger och rör inget utan vektorkälla', () => {
        const s = färdig();
        expect(läggTillMarktäcke(s)).toBe(false);
        expect(s.layers!.filter(l => l.id === COARSE_LAYER_ID)).toHaveLength(1);
        const tom: StyleJson = { version: 8, sources: {}, layers: [{ id: 'background', type: 'background' }] };
        expect(läggTillMarktäcke(tom)).toBe(false);
        expect(tom.layers).toHaveLength(1);
    });
});
