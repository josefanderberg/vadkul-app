import { describe, it, expect } from 'vitest';
import {
    transformThemeParkStyle,
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
