import { describe, it, expect } from 'vitest';
import { BAD_SIGN_LAYER_ID, POI_SIGN_CLOSE_LAYER_ID, POI_SIGN_LAYER_ID, POI_SIGN_NEAR_LAYER_ID } from '@vadkul/kontrakt';
import { COARSE_LAYER_ID, DETAIL_LAYER_ID, FOREST_LAYER_ID } from './kartMarktacke';
import {
    transformThemeParkStyle,
    ärVägLager,
    THEMEPARK_LAND_COLOR,
    THEMEPARK_LAND_COLOR_NEAR,
    BOOTSTRAP_STYLE,
    type StyleJson,
} from './themeParkStyle';

// Syntetisk mini-Voyager med ett lager av varje sort transformen rör.
const voyagerLik = (): StyleJson => ({
    version: 8,
    name: 'Voyager',
    layers: [
        { id: 'background', paint: { 'background-color': '#fbf6ef' } },
        { id: 'water', paint: { 'fill-color': '#c5dff2' } },
        { id: 'water_shadow', paint: { 'fill-color': '#aacbe0' } },
        { id: 'waterway', paint: { 'line-color': '#c5dff2' } },
        { id: 'landcover', paint: { 'fill-color': '#e8f0d9' } },
        { id: 'park', paint: { 'fill-color': '#dff0d0' } },
        { id: 'landuse_residential', paint: { 'fill-color': '#f2efe9' } },
        { id: 'building', paint: { 'fill-color': '#ece7dd' } },
        { id: 'road_major', 'source-layer': 'transportation', paint: { 'line-color': '#fdfdfd' } },
        { id: 'road_major_casing', 'source-layer': 'transportation', paint: { 'line-color': '#e8dccd' } },
        { id: 'watername_ocean', layout: { 'text-field': '{name}' }, paint: { 'text-color': '#7a99b5' } },
        { id: 'watername_lake', layout: { 'text-field': '{name}' }, paint: { 'text-color': '#7a99b5' } },
        { id: 'place_city', paint: { 'text-color': '#333' } },
    ],
});

describe('transformThemeParkStyle (porten av webbens nöjesfält)', () => {
    const ut = transformThemeParkStyle(voyagerLik());
    const lager = (id: string) => ut.layers!.find(l => l.id === id)!;

    it('landet zoom-tonar mörk→ljus grön (samma färger som webben)', () => {
        const bg = lager('background').paint!['background-color'] as unknown[];
        expect(bg[0]).toBe('interpolate');
        expect(bg).toContain(THEMEPARK_LAND_COLOR);
        expect(bg).toContain(THEMEPARK_LAND_COLOR_NEAR);
    });

    it('vatten blir havsblått, skuggan mörkare', () => {
        expect(lager('water').paint!['fill-color']).toBe('#4e8ab7');
        expect(lager('water_shadow').paint!['fill-color']).toBe('#4278a4');
        expect(lager('waterway').paint!['line-color']).toBe('#4e8ab7');
    });

    it('grönskan zoom-tonar, bostäder och byggnader får sina fasta toner', () => {
        expect((lager('landcover').paint!['fill-color'] as unknown[])[0]).toBe('interpolate');
        expect((lager('park').paint!['fill-color'] as unknown[])[0]).toBe('interpolate');
        expect(lager('landuse_residential').paint!['fill-color']).toBe('#abcf84');
        expect(lager('building').paint!['fill-color']).toBe('#d6d2c0');
    });

    it('vägar vita, casing sand', () => {
        expect(lager('road_major').paint!['line-color']).toBe('#ffffff');
        expect(lager('road_major_casing').paint!['line-color']).toBe('#c9c3b2');
    });

    // VADKUL#208: Voyager flyttade vägarna från `transportation` till `roads`
    // i oktober 2026 - matchas bara det gamla namnet blir de aldrig vita.
    it('vägarna är vita även i Voyagers nya schema, men inte flygfältens banor', () => {
        const ny = transformThemeParkStyle({
            version: 8,
            layers: [
                { id: 'road_primary', 'source-layer': 'roads', paint: { 'line-color': '#fdfdfd' } },
                { id: 'bridge_major', 'source-layer': 'roads', paint: { 'line-color': '#fdfdfd' } },
                { id: 'aeroway-runway', 'source-layer': 'roads', paint: { 'line-color': '#e8e8e8' } },
            ],
        });
        const färg = (id: string) => ny.layers!.find(l => l.id === id)!.paint!['line-color'];
        expect(färg('road_primary')).toBe('#ffffff');
        expect(färg('bridge_major')).toBe('#ffffff');
        expect(färg('aeroway-runway')).toBe('#e8e8e8');
        expect(ärVägLager('road_minor', 'roads')).toBe(true);
        expect(ärVägLager('road_minor', 'transportation')).toBe(true);
        expect(ärVägLager('aeroway-taxiway', 'roads')).toBe(false);
        expect(ärVägLager('water', 'water')).toBe(false);
    });

    it('havsnamn göms men insjönamn lämnas', () => {
        expect(lager('watername_ocean').layout!.visibility).toBe('none');
        expect(lager('watername_lake').layout?.visibility).toBeUndefined();
    });

    it('orörda lager passerar oförändrade och inputen muteras inte', () => {
        expect(lager('place_city').paint!['text-color']).toBe('#333');
        const inp = voyagerLik();
        transformThemeParkStyle(inp);
        expect(inp.layers![0].paint!['background-color']).toBe('#fbf6ef');
    });

    it('bootstrap-plattan matchar det utzoomade landet (sömlöst byte)', () => {
        expect(BOOTSTRAP_STYLE.layers![0].paint!['background-color']).toBe(THEMEPARK_LAND_COLOR);
    });
});

// VADKUL#234: transformen lägger till det webben lägger till.
describe('transformThemeParkStyle: marktäcket och platsskyltarna', () => {
    const FONT = ['Montserrat SemiBold', 'Open Sans Bold'];
    const medKälla = (): StyleJson => ({
        version: 8,
        sources: { protomaps: { type: 'vector', tiles: ['https://example.invalid/{z}/{x}/{y}.mvt'] } },
        layers: [
            { id: 'background', type: 'background', paint: { 'background-color': '#fbf6ef' } },
            { id: 'landcover', type: 'fill', source: 'protomaps', 'source-layer': 'landuse', minzoom: 7, paint: { 'fill-color': '#e8f0d9' } },
            { id: 'water', type: 'fill', source: 'protomaps', 'source-layer': 'water', paint: { 'fill-color': '#c5dff2' } },
            { id: 'place_town', type: 'symbol', source: 'protomaps', 'source-layer': 'places', layout: { 'text-font': FONT } },
            { id: 'poi_park', type: 'symbol', source: 'protomaps', 'source-layer': 'pois', layout: { 'text-font': FONT } },
        ],
    });

    it('marktäcket läggs alltid till, skogen i den OMMÅLADE grönskans färg', () => {
        const ut = transformThemeParkStyle(medKälla());
        expect(ut.layers!.map(l => l.id)).toEqual([
            'background', 'landcover', FOREST_LAYER_ID, COARSE_LAYER_ID, DETAIL_LAYER_ID, 'water', 'place_town', 'poi_park',
        ]);
        const grönska = ut.layers!.find(l => l.id === 'landcover')!.paint!['fill-color'];
        expect((grönska as unknown[])[0]).toBe('interpolate');
        expect(ut.layers!.find(l => l.id === FOREST_LAYER_ID)!.paint!['fill-color']).toEqual(grönska);
    });

    it('skyltarna läggs bara till när kartan ber om dem (den laddar bilderna)', () => {
        expect(transformThemeParkStyle(medKälla()).layers!.some(l => l.id === POI_SIGN_LAYER_ID)).toBe(false);
        const ut = transformThemeParkStyle(medKälla(), { skyltar: true });
        expect(ut.layers!.map(l => l.id)).toEqual([
            'background', 'landcover', FOREST_LAYER_ID, COARSE_LAYER_ID, DETAIL_LAYER_ID, 'water',
            POI_SIGN_CLOSE_LAYER_ID, POI_SIGN_NEAR_LAYER_ID, POI_SIGN_LAYER_ID, BAD_SIGN_LAYER_ID, 'place_town', 'poi_park',
        ]);
        expect(ut.layers!.find(l => l.id === 'poi_park')!.layout!.visibility).toBe('none');
    });

    it('inputen muteras inte av tilläggen', () => {
        const inp = medKälla();
        const före = JSON.stringify(inp);
        transformThemeParkStyle(inp, { skyltar: true });
        expect(JSON.stringify(inp)).toBe(före);
    });
});
