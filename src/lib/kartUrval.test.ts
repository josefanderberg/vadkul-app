import { describe, expect, it } from 'vitest';
import {
    byggPrickar,
    INGEN_BRICKA,
    prickFilter,
    prickNyckel,
    URVAL_KANDIDATER,
    URVAL_MIN,
    urvalsTak,
    väljBrickor,
    väljTända,
    type UrvalsPunkt,
} from './kartUrval';
import type { BrickProps } from './kartlager';

const MITT = { lat: 59.33, lng: 18.07 };

/** n punkter på en rad österut från mitten, 0,01° isär (närmast först). */
function rad(n: number, pop: (i: number) => boolean = () => false): UrvalsPunkt[] {
    return Array.from({ length: n }, (_, i) => ({
        id: `p${i}`,
        lat: MITT.lat,
        lng: MITT.lng + (i + 1) * 0.01,
        pop: pop(i),
    }));
}

function plats(id: string, lng: number, extra: Partial<BrickProps> = {}): GeoJSON.Feature<GeoJSON.Point, BrickProps> {
    return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lng, MITT.lat] },
        properties: {
            id, ikon: 'x', label: 'Musik', titel: id, antal: 1, antalIkon: '',
            past: false, vald: false, sort: 1, etikettPrio: 0,
            fast: false, pop: false, färg: '#ec4899',
            ...extra,
        },
    };
}
const samling = (fs: GeoJSON.Feature<GeoJSON.Point, BrickProps>[]) => ({ type: 'FeatureCollection' as const, features: fs });

describe('urvalsTak (webbens revealAllowance)', () => {
    it('stadszoom och utzoomat: bara minimum', () => {
        expect(urvalsTak(10.5)).toBe(URVAL_MIN);
        expect(urvalsTak(5)).toBe(URVAL_MIN);
    });
    it('från titelzoomen: alla kandidater', () => {
        expect(urvalsTak(13)).toBe(URVAL_KANDIDATER);
        expect(urvalsTak(16)).toBe(URVAL_KANDIDATER);
    });
    it('linjärt däremellan', () => {
        expect(urvalsTak(11.75)).toBe(31);
    });
});

describe('väljTända', () => {
    it('inzoomat: de 50 närmast mitten, aldrig de längre bort', () => {
        const t = väljTända(rad(80), MITT, 14);
        expect(t.size).toBe(50);
        expect(t.has('p0')).toBe(true);
        expect(t.has('p49')).toBe(true);
        expect(t.has('p50')).toBe(false);
    });

    it('urvalet följer mitten (Josef 19/10: "flytta sig på kartan så blir det andra 50")', () => {
        const ny = { lat: MITT.lat, lng: MITT.lng + 0.8 };
        const t = väljTända(rad(80), ny, 14);
        expect(t.has('p0')).toBe(false);
        expect(t.has('p79')).toBe(true);
    });

    it('utzoomat tänds färre, populära först bland de 50 närmaste', () => {
        // Var tionde är populär - p9, p19, … p79. Bara de inom 50 räknas.
        const t = väljTända(rad(80, i => i % 10 === 9), MITT, 10);
        expect(t.size).toBe(URVAL_MIN);
        for (const id of ['p9', 'p19', 'p29', 'p39', 'p49']) expect(t.has(id)).toBe(true);
        expect(t.has('p59')).toBe(false);
        // Resten av platserna fylls närmast först.
        expect(t.has('p0')).toBe(true);
    });

    it('färre punkter än taket: alla tänds', () => {
        expect(väljTända(rad(3), MITT, 14).size).toBe(3);
    });
});

const ids = (fc: { features: { properties: { id: string } }[] }) => fc.features.map(f => f.properties.id);

describe('väljBrickor', () => {
    it('bara urvalet kring mitten blir brickor', () => {
        const fs = Array.from({ length: 60 }, (_, i) => plats(`e${i}`, MITT.lng + (i + 1) * 0.01));
        const b = väljBrickor(samling(fs), MITT, 14);
        expect(b.features).toHaveLength(50);
        expect(ids(b)).not.toContain('e50');
    });

    it('fasta platser är brickor även långt bort, utan att ta plats från urvalet', () => {
        const fs = [
            ...Array.from({ length: 60 }, (_, i) => plats(`e${i}`, MITT.lng + (i + 1) * 0.01)),
            plats('guld', MITT.lng + 5, { fast: true }),
        ];
        const b = väljBrickor(samling(fs), MITT, 14);
        expect(ids(b)).toContain('guld');
        expect(b.features).toHaveLength(51);
    });

    it('passerade är aldrig brickor, utom den valda', () => {
        const fs = [
            plats('förbi', MITT.lng + 0.01, { past: true }),
            plats('fastMenFörbi', MITT.lng + 0.02, { past: true, fast: true }),
            plats('valdFörbi', MITT.lng + 0.03, { past: true, vald: true }),
        ];
        expect(ids(väljBrickor(samling(fs), MITT, 14))).toEqual(['valdFörbi']);
    });

    it('innan kartan rapporterat sin vy: bara de fasta', () => {
        const fs = [plats('a', MITT.lng + 0.01), plats('fast', MITT.lng + 0.02, { fast: true })];
        expect(ids(väljBrickor(samling(fs), null, 14))).toEqual(['fast']);
    });
});

describe('byggPrickar + prickFilter', () => {
    it('en prick per plats, med kategorins färg och platsens id', () => {
        const p = byggPrickar(samling([plats('a', MITT.lng), plats('b', MITT.lng + 1, { past: true, antal: 3 })]));
        expect(p.features.map(f => f.properties)).toEqual([
            { id: 'a', farg: '#ec4899', past: false, antal: 1 },
            { id: 'b', farg: '#ec4899', past: true, antal: 3 },
        ]);
    });

    it('filtret gömmer prickarna under brickorna (match, unika etiketter)', () => {
        expect(prickFilter(['a', 'b', 'a'])).toEqual(['match', ['get', 'id'], ['a', 'b'], false, true]);
    });

    it('inga brickor: fortfarande ett giltigt filter som visar allt', () => {
        expect(prickFilter([])).toEqual(['match', ['get', 'id'], [INGEN_BRICKA], false, true]);
    });
});

describe('prickNyckel', () => {
    it('samma synliga innehåll = samma nyckel, även om objekten byggts om', () => {
        const a = samling([plats('a', MITT.lng, { sort: 1 })]);
        const b = samling([plats('a', MITT.lng, { sort: 2, vald: true })]);
        expect(prickNyckel(a)).toBe(prickNyckel(b));
    });

    it('"har varit" och antal ändrar nyckeln', () => {
        const bas = prickNyckel(samling([plats('a', MITT.lng)]));
        expect(prickNyckel(samling([plats('a', MITT.lng, { past: true })]))).not.toBe(bas);
        expect(prickNyckel(samling([plats('a', MITT.lng, { antal: 2 })]))).not.toBe(bas);
    });
});
