import { describe, expect, it } from 'vitest';
import { kartBanner, POPULÄR_VECKA_MIN, zoomInMitt } from './kartBanner';

const bas = {
    populäraKommande: 8,
    populäraIVeckan: 9,
    populärtPå: false,
    annatFilter: false,
    zoom: 11,
    stängd: false,
};

describe('kartBanner (webbens popularWeekPrompt + zoom-bannern)', () => {
    it('populära-bannern vid fler än 5 kommande populära i veckan, med veckoradens tal', () => {
        expect(POPULÄR_VECKA_MIN).toBe(6);
        expect(kartBanner({ ...bas, populäraKommande: 6 })).toEqual({ typ: 'populärVecka', antal: 9 });
        expect(kartBanner({ ...bas, populäraKommande: 5 })).toBeNull();
    });
    it('inte när veckan är låst av zoomen', () => {
        expect(kartBanner({ ...bas, zoom: 8 })).toBeNull();
    });
    it('inte med opt-in-källa, aldrig efter stängning, inte innan zoomen är känd', () => {
        expect(kartBanner({ ...bas, annatFilter: true })).toBeNull();
        expect(kartBanner({ ...bas, stängd: true })).toBeNull();
        expect(kartBanner({ ...bas, zoom: null })).toBeNull();
    });
    it('🔥 på → zoom-bannern under titelgränsen, inget över den', () => {
        expect(kartBanner({ ...bas, populärtPå: true, zoom: 11 })).toEqual({ typ: 'zoomaIn' });
        expect(kartBanner({ ...bas, populärtPå: true, zoom: 13 })).toBeNull();
        expect(kartBanner({ ...bas, populärtPå: true, zoom: 11, stängd: true })).toBeNull();
    });
});

// Växjö-ish. 0,01° lat ≈ 1,1 km, 0,01° lng ≈ 0,6 km på den breddgraden.
const STAD = { lat: 56.879, lng: 14.806 };

describe('zoomInMitt (zoom-bannerns målpunkt, webbens zoomInCenter)', () => {
    it('inga markörer i orten → ortens mittpunkt', () => {
        expect(zoomInMitt([], STAD)).toEqual(STAD);
        expect(zoomInMitt([{ lat: 57.15, lng: 14.806 }], STAD)).toEqual(STAD);
    });
    it('en klunga vid sidan av mitten → klungans genomsnitt', () => {
        const c = zoomInMitt([
            { lat: 56.885, lng: 14.816 },
            { lat: 56.887, lng: 14.818 },
            { lat: 56.886, lng: 14.814 },
        ], STAD);
        expect(c.lat).toBeCloseTo(56.886, 5);
        expect(c.lng).toBeCloseTo(14.816, 5);
    });
    it('en ensam markör i utkanten drar inte iväg mitten', () => {
        const c = zoomInMitt([
            { lat: 56.880, lng: 14.806 },
            { lat: 56.881, lng: 14.807 },
            { lat: 56.879, lng: 14.808 },
            { lat: 56.930, lng: 14.806 },
        ], STAD);
        expect(c.lat).toBeCloseTo(56.880, 5);
        expect(c.lng).toBeCloseTo(14.807, 5);
    });
    it('den större klungan vinner, lika stora → närmast ortens mitt', () => {
        expect(zoomInMitt([
            { lat: 56.900, lng: 14.806 }, { lat: 56.901, lng: 14.806 },
            { lat: 56.860, lng: 14.806 }, { lat: 56.861, lng: 14.806 }, { lat: 56.862, lng: 14.806 },
        ], STAD).lat).toBeCloseTo(56.861, 5);
        expect(zoomInMitt([
            { lat: 56.920, lng: 14.806 }, { lat: 56.921, lng: 14.806 },
            { lat: 56.870, lng: 14.806 }, { lat: 56.871, lng: 14.806 },
        ], STAD).lat).toBeCloseTo(56.8705, 5);
    });
    it('ogiltiga koordinater hoppas över', () => {
        expect(zoomInMitt([{ lat: NaN, lng: 14.8 }], STAD)).toEqual(STAD);
    });
});
