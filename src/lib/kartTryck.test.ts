import { describe, expect, it } from 'vitest';
import { avståndPt, PRICK_RADIE, träffadBricka, träffadPrick, type Kandidat } from './kartTryck';
import { BADGE_X, BADGE_Y } from './brickor';

const bricka = (id: string, x: number, y: number, sort = 1, grupp = false): Kandidat => ({ id, sort, grupp, x, y });

describe('träffadBricka', () => {
    it('tryck mitt på brickans kropp träffar (Josef 13/10)', () => {
        // Spetsen på (200, 400) - kroppen ritas ovanför den.
        expect(träffadBricka([bricka('a', 200, 400)], 200, 365)).toBe('a');
        expect(träffadBricka([bricka('a', 200, 400)], 215, 350)).toBe('a');
    });

    it('nedanför och snett vänster om spetsen är tom karta', () => {
        // Där MapLibres träff låg - där ska inget öppnas.
        expect(träffadBricka([bricka('a', 200, 400)], 175, 420)).toBeNull();
    });

    it('över kroppens topp är tom karta', () => {
        expect(träffadBricka([bricka('a', 200, 400)], 200, 335)).toBeNull();
    });

    it('överlappande brickor: den som ritas överst vinner', () => {
        const k = [bricka('under', 200, 400, 1), bricka('över', 210, 395, 2)];
        expect(träffadBricka(k, 205, 370)).toBe('över');
    });

    it('lika ritordning: den vars kropp ligger närmast trycket', () => {
        const k = [bricka('vänster', 190, 400), bricka('höger', 215, 400)];
        expect(träffadBricka(k, 212, 365)).toBe('höger');
        expect(träffadBricka(k, 192, 365)).toBe('vänster');
    });

    it('"+N"-badgen träffar sin grupp', () => {
        const k = [bricka('grupp', 200, 400, 1, true)];
        expect(träffadBricka(k, 200 + BADGE_X, 400 - BADGE_Y)).toBe('grupp');
        // Samma punkt utan badge (ensamt event) ligger utanför kroppen.
        expect(träffadBricka([bricka('ensam', 200, 400)], 200 + BADGE_X + 6, 400 - BADGE_Y)).toBeNull();
    });
});

describe('avståndPt', () => {
    it('en längdgrad vid zoom 0 är 512/360 pt', () => {
        expect(avståndPt({ lng: 1, lat: 0 }, { lng: 0, lat: 0 }, 0)).toBeCloseTo(512 / 360, 3);
    });

    it('dubblas per zoomsteg', () => {
        const a = { lng: 15.01, lat: 57.0 };
        const b = { lng: 15.0, lat: 57.0 };
        expect(avståndPt(a, b, 13) / avståndPt(a, b, 12)).toBeCloseTo(2, 6);
    });
});

describe('träffadPrick', () => {
    const prick = (id: string, x: number, y: number) => ({ id, x, y });

    it('tryck på pricken träffar', () => {
        expect(träffadPrick([prick('a', 100, 100)], 104, 97)).toBe('a');
    });

    it('utanför fingermånen är tom karta', () => {
        expect(träffadPrick([prick('a', 100, 100)], 100 + PRICK_RADIE + 1, 100)).toBeNull();
    });

    it('flera inom räckhåll: den närmaste', () => {
        expect(träffadPrick([prick('långt', 110, 100), prick('nära', 102, 100)], 100, 100)).toBe('nära');
    });
});
