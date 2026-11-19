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
    väljHål,
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
            id, ikon: 'x', emojiBild: '', valdEmojiBild: '', label: 'Musik', titel: id, antal: 1, antalIkon: '',
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

describe('väljTända utzoomat med känd vy (webbens #200, VADKUL#261)', () => {
    const VY = { width: 390, height: 844 };
    const ZOOM = 9;
    /** En punkt dx/dy pt från mitten vid ZOOM (öster/söder positivt). */
    function vid(id: string, dx: number, dy: number, pop = false): UrvalsPunkt {
        const world = 512 * 2 ** ZOOM;
        const s = Math.sin((MITT.lat * Math.PI) / 180);
        const y = 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI) + dy / world;
        const lat = ((2 * Math.atan(Math.exp((0.5 - y) * 2 * Math.PI)) - Math.PI / 2) * 180) / Math.PI;
        return { id, lat, lng: MITT.lng + (dx / world) * 360, pop };
    }

    it('samma urval som webben: kontraktets pickSpreadRevealKeys', () => {
        const punkter = [
            ...Array.from({ length: 40 }, (_, i) => vid(`klunga${i}`, 10 + (i % 6) * 4, 10 + Math.floor(i / 6) * 4, i < 4)),
            vid('norr-pop', 0, -350, true),
            vid('söder-pop', 20, 360, true),
            vid('väster', -170, 40),
            vid('öster', 170, -40),
        ];
        const t = väljTända(punkter, MITT, ZOOM, VY);
        expect(t.size).toBe(URVAL_MIN);
        // Inte bara klungan mitt i bild: de populära i bildens kanter och de
        // ensamma vid sidorna kommer med.
        for (const id of ['norr-pop', 'söder-pop', 'väster', 'öster']) expect(t.has(id), id).toBe(true);
        const ur = [...t].filter(id => id.startsWith('klunga')).length;
        expect(ur).toBeLessThan(URVAL_MIN);
    });

    it('event utanför vyn tänds aldrig', () => {
        const t = väljTända([vid('inne', 0, 0), vid('ute', 0, 900)], MITT, ZOOM, VY);
        expect([...t]).toEqual(['inne']);
    });

    it('från zoom 12 gäller urvalet kring mitten igen, även med vy', () => {
        const t = väljTända(rad(80), MITT, 14, VY);
        expect(t.size).toBe(50);
        expect(t.has('p0')).toBe(true);
    });

    it('utan vy (kartan har inte mätts än): urvalet kring mitten', () => {
        expect(väljTända(rad(80, i => i % 10 === 9), MITT, 10)).toEqual(väljTända(rad(80, i => i % 10 === 9), MITT, 10, null));
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

describe('molnhålet', () => {
    // Zoom 8: världen är 512·256 pt bred, så 0,01° österut är ~3,6 pt.
    const ZOOM = 8;
    const TRYCK = { lat: MITT.lat, lng: MITT.lng };

    it('utan tryck tänds ingenting', () => {
        expect(väljHål(samling([plats('a', MITT.lng)]), null, ZOOM).features).toHaveLength(0);
    });

    it('tänder de fem närmaste trycket, närmast oavsett popularitet (#261)', () => {
        const fc = samling([
            plats('sjätte', MITT.lng + 0.06, { pop: true }),
            plats('andra', MITT.lng + 0.02),
            plats('första', MITT.lng + 0.01),
            plats('femte', MITT.lng + 0.05),
            plats('tredje', MITT.lng + 0.03),
            plats('fjärde', MITT.lng + 0.04),
        ]);
        expect(väljHål(fc, TRYCK, ZOOM).features.map(f => f.properties.id).sort())
            .toEqual(['andra', 'femte', 'fjärde', 'första', 'tredje']);
    });

    it('ett tryck i havet tänder aldrig de närmaste långt bort', () => {
        // 1° österut är ~364 pt vid zoom 8 - långt utanför hålets 110 pt.
        expect(väljHål(samling([plats('långt', MITT.lng + 1)]), TRYCK, ZOOM).features).toHaveLength(0);
    });

    it('passerade platser tänds inte', () => {
        const fc = samling([plats('varit', MITT.lng + 0.01, { past: true }), plats('kommer', MITT.lng + 0.02)]);
        expect(väljHål(fc, TRYCK, ZOOM).features.map(f => f.properties.id)).toEqual(['kommer']);
    });

    it('det som redan är bricka tar sin plats bland de fem men ritas inte igen', () => {
        const fc = samling([
            plats('a', MITT.lng + 0.01),
            plats('b', MITT.lng + 0.02),
            plats('c', MITT.lng + 0.03),
            plats('d', MITT.lng + 0.04),
            plats('e', MITT.lng + 0.05),
            plats('f', MITT.lng + 0.06),
        ]);
        expect(väljHål(fc, TRYCK, ZOOM, new Set(['a'])).features.map(f => f.properties.id).sort()).toEqual(['b', 'c', 'd', 'e']);
    });

    it('hålet är samma mått i pt på alla zoomar: inzoomat ryms färre grader', () => {
        const fc = samling([plats('nära', MITT.lng + 0.01), plats('bit', MITT.lng + 0.2)]);
        expect(väljHål(fc, TRYCK, 8).features).toHaveLength(2);
        expect(väljHål(fc, TRYCK, 12).features.map(f => f.properties.id)).toEqual(['nära']);
    });
});
