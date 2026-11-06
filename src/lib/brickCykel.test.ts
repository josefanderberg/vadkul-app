import { describe, expect, it } from 'vitest';
import type { AppFeedEvent } from '@vadkul/kontrakt';
import {
    brickHögar,
    FRAM_SORT,
    harRörelse,
    medCykel,
    mercatorPt,
    nästaFront,
    nästaIRunda,
    visadBild,
    växlande,
    överlappsHögar,
    överstIHögarna,
} from './brickCykel';
import { byggBrickor } from './kartlager';

const ev = (id: string, h: number, extra: Partial<AppFeedEvent> = {}): AppFeedEvent => ({
    id,
    title: id,
    time: new Date(2026, 8, 29, h).toISOString(),
    hasSpecificTime: true,
    lat: 59.33,
    lng: 18.06,
    category: 'music',
    ...extra,
});
const NU = new Date(2026, 8, 29, 15).getTime();
const INGA = new Set<string>();
const NOLL = new Map<string, number>();

describe('ramarna i byggBrickor', () => {
    it('en multibricka får en ram per synlig bild - dubbletterna hoppas över', () => {
        const fc = byggBrickor(
            [ev('m1', 17), ev('m2', 18), ev('k1', 19, { category: 'art' }), ev('m3', 20)],
            { nowMs: NU },
        );
        const ramar = fc.features[0].properties.ramar!;
        expect(ramar.map(r => r.ikon)).toEqual(['bricka-music', 'bricka-art']);
        expect(ramar.map(r => r.titel)).toEqual(['m1', 'k1']);
        expect(ramar[1].label).toBe('Konst');
    });

    it('passerade event är inte med, och en enda synlig bild ger ingen växling', () => {
        const fc = byggBrickor([ev('förbi', 10, { category: 'art' }), ev('a', 17), ev('b', 18)], { nowMs: NU });
        expect(fc.features[0].properties.ramar).toBeUndefined();
    });

    it('vald, stjärnmärkt och ensam bricka står still', () => {
        const grupp = [ev('a', 17), ev('b', 18, { category: 'art' })];
        expect(byggBrickor(grupp, { nowMs: NU, valtId: 'a' }).features[0].properties.ramar).toBeUndefined();
        expect(byggBrickor(grupp, { nowMs: NU, stjärnor: new Set(['b']) }).features[0].properties.ramar).toBeUndefined();
        expect(byggBrickor([ev('a', 17)], { nowMs: NU }).features[0].properties.ramar).toBeUndefined();
    });

    it('gruppens kropp (sparad) följer med varje ram', () => {
        const fc = byggBrickor([ev('a', 17), ev('b', 18, { category: 'art' })], { nowMs: NU, ärSparad: id => id === 'b' });
        expect(fc.features[0].properties.ramar!.map(r => r.ikon)).toEqual(['bricka-music-sparad', 'bricka-art-sparad']);
    });
});

describe('turordningen (webbens round-robin)', () => {
    it('nästaIRunda går listan runt och börjar om när den förra försvunnit', () => {
        expect(nästaIRunda(['a', 'b', 'c'], null)).toBe('a');
        expect(nästaIRunda(['a', 'b', 'c'], 'a')).toBe('b');
        expect(nästaIRunda(['a', 'b', 'c'], 'c')).toBe('a');
        expect(nästaIRunda(['a', 'b'], 'borta')).toBe('a');
        expect(nästaIRunda([], 'a')).toBeNull();
    });

    it('nästaFront varvar i stapelordning, även genom den naturliga toppen', () => {
        const hög = { id: 'a|b|c', members: ['b', 'a', 'c'], topKey: 'b' };
        expect(nästaFront(hög, null)).toBe('a');
        expect(nästaFront(hög, 'a')).toBe('c');
        expect(nästaFront(hög, 'c')).toBe('b');
        expect(nästaFront(hög, 'okänd')).toBe('a');
    });

    it('växlande = brickorna med minst två ramar, i källans ordning', () => {
        const fc = byggBrickor(
            [ev('m1', 17), ev('k1', 18, { category: 'art' }), ev('ensam', 18, { lat: 59.4 })],
            { nowMs: NU },
        );
        expect(växlande(fc)).toEqual(['m1']);
    });
});

describe('medCykel', () => {
    const multi = () => byggBrickor([ev('a', 17), ev('b', 18, { category: 'art' })], { nowMs: NU });

    it('växlande bricka visar ramens bild, titel och kategori - och ramarna skickas inte till kartan', () => {
        const fc = multi();
        const p0 = medCykel(fc, NOLL, INGA, INGA).features[0].properties as Record<string, unknown>;
        expect(p0.ramar).toBeUndefined();
        expect([p0.ikon, p0.titel, p0.label]).toEqual(['bricka-music', 'a', 'Musik']);
        const p1 = medCykel(fc, new Map([['a', 1]]), INGA, INGA).features[0].properties;
        expect([p1.ikon, p1.titel, p1.label]).toEqual(['bricka-art', 'b', 'Konst']);
        // Indexet varvar runt.
        expect(medCykel(fc, new Map([['a', 2]]), INGA, INGA).features[0].properties.ikon).toBe('bricka-music');
    });

    it('ramens emojibild används först när den är inläst', () => {
        const fc = multi();
        fc.features[0].properties.ramar![1] = { ikon: 'bricka-art', emojiBild: 'bricka-art~1f3a8', titel: 'b', label: 'Konst' };
        const ett = new Map([['a', 1]]);
        expect(visadBild(fc.features[0].properties, ett, INGA)).toBe('bricka-art');
        expect(visadBild(fc.features[0].properties, ett, new Set(['bricka-art~1f3a8']))).toBe('bricka-art~1f3a8');
    });

    it('ensam bricka får sin emojibild när den är klar, annars kategorins', () => {
        const fc = byggBrickor([ev('a', 17)], { nowMs: NU });
        fc.features[0].properties.emojiBild = 'bricka-music~1f3b8';
        expect(medCykel(fc, NOLL, INGA, INGA).features[0].properties.ikon).toBe('bricka-music');
        expect(medCykel(fc, NOLL, INGA, new Set(['bricka-music~1f3b8'])).features[0].properties.ikon).toBe('bricka-music~1f3b8');
    });

    it('lyfta brickor får frontens sort, övriga behåller sin', () => {
        const fc = byggBrickor([ev('a', 17), ev('b', 18, { lng: 18.0603 })], { nowMs: NU });
        const ut = medCykel(fc, NOLL, new Set(['b']), INGA).features;
        expect(ut.find(f => f.properties.id === 'b')!.properties.sort).toBe(FRAM_SORT);
        expect(ut.find(f => f.properties.id === 'a')!.properties.sort).toBe(1);
    });
});

describe('z-växlingen', () => {
    it('överlappsHögar: kedjor räknas ihop, ensamma är inga högar, stapelordning först', () => {
        const högar = överlappsHögar(
            [
                { key: 'a', x: 0, y: 0, sortKey: 1 },
                { key: 'b', x: 20, y: 0, sortKey: 2 },
                { key: 'c', x: 40, y: 0, sortKey: 1 },
                { key: 'ensam', x: 500, y: 500, sortKey: 1 },
            ],
            30,
        );
        expect(högar).toEqual([{ id: 'a|b|c', members: ['b', 'a', 'c'], topKey: 'b' }]);
    });

    it('mercatorPt: en zoomnivå till dubblar avståndet', () => {
        const a = mercatorPt(18.06, 59.33, 12);
        const b = mercatorPt(18.07, 59.33, 12);
        const a2 = mercatorPt(18.06, 59.33, 13);
        const b2 = mercatorPt(18.07, 59.33, 13);
        expect(b2.x - a2.x).toBeCloseTo(2 * (b.x - a.x), 6);
    });

    // Två grannar ~15 m isär (olika platser, överlappar på skärmen vid zoom 13).
    const grannar = () => byggBrickor(
        [ev('a', 17), ev('b', 18, { lng: 18.0603, category: 'art' }), ev('långt', 18, { lng: 18.2 })],
        { nowMs: NU },
    );

    it('närliggande brickor bildar en hög, avlägsna inte', () => {
        const högar = brickHögar(grannar(), 13);
        expect(högar).toHaveLength(1);
        expect(högar[0].members.sort()).toEqual(['a', 'b']);
        // Utzoomat till gatunivå 19 ligger de isär.
        expect(brickHögar(grannar(), 19)).toHaveLength(0);
    });

    it('nästaFront genom hela högen ger alla en tur överst', () => {
        const fc = grannar();
        const [hög] = brickHögar(fc, 13);
        const överst = new Set<string>();
        let front: string | null = null;
        for (let i = 0; i < hög.members.length + 1; i++) {
            front = nästaFront(hög, front);
            överst.add([...överstIHögarna([hög], new Map([[hög.id, front]]))][0]);
        }
        expect(överst).toEqual(new Set(['a', 'b']));
    });

    it('vald och boostad är aldrig med - de ligger alltid överst', () => {
        const slut = new Date(2026, 8, 30).getTime();
        const fc = byggBrickor(
            [ev('a', 17), ev('b', 18, { lng: 18.0603 })],
            { nowMs: NU, boostar: new Map([['b', slut]]) },
        );
        expect(brickHögar(fc, 13)).toHaveLength(0);
        const vald = byggBrickor([ev('a', 17), ev('b', 18, { lng: 18.0603 })], { nowMs: NU, valtId: 'a' });
        expect(brickHögar(vald, 13)).toHaveLength(0);
    });

    it('harRörelse: bara när något kan bläddra', () => {
        const ensam = byggBrickor([ev('a', 17)], { nowMs: NU });
        expect(harRörelse(ensam, [])).toBe(false);
        expect(harRörelse(multi2(), [])).toBe(true);
        const fc = grannar();
        expect(harRörelse(fc, brickHögar(fc, 13))).toBe(true);
    });
});

function multi2() {
    return byggBrickor([ev('a', 17), ev('b', 18, { category: 'art' })], { nowMs: NU });
}
