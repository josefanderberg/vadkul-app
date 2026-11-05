import { describe, expect, it } from 'vitest';
import type { AppFeedEvent } from '@vadkul/kontrakt';
import { brickHögar, FRAM_SORT, harRörelse, medCykel, mercatorPt, steg, överlappsHögar } from './brickCykel';
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

describe('takten', () => {
    it('varje nyckel byter en gång per två tick', () => {
        const s = [0, 1, 2, 3, 4, 5].map(t => steg(t, 'x'));
        for (let t = 2; t < s.length; t++) expect(s[t] - s[t - 2]).toBe(1);
    });
});

describe('medCykel', () => {
    const multi = () => byggBrickor([ev('a', 17), ev('b', 18, { category: 'art' })], { nowMs: NU });

    it('växlande bricka visar ramens bild, titel och kategori - och ramarna skickas inte till kartan', () => {
        const fc = multi();
        const bilder = new Set<string>();
        for (let t = 0; t < 6; t++) {
            const p = medCykel(fc, [], t, INGA).features[0].properties as Record<string, unknown>;
            expect(p.ramar).toBeUndefined();
            bilder.add(`${p.ikon}|${p.titel}|${p.label}`);
        }
        expect(bilder).toEqual(new Set(['bricka-music|a|Musik', 'bricka-art|b|Konst']));
    });

    it('ramens emojibild används först när den är inläst', () => {
        const fc = multi();
        const ram = { ikon: 'bricka-art', emojiBild: 'bricka-art~1f3a8', titel: 'b', label: 'Konst' };
        fc.features[0].properties.ramar = [{ ...fc.features[0].properties.ramar![0] }, ram];
        const t = [0, 1, 2, 3].find(x => steg(x, fc.features[0].properties.id) % 2 === 1)!;
        expect(medCykel(fc, [], t, INGA).features[0].properties.ikon).toBe('bricka-art');
        expect(medCykel(fc, [], t, new Set(['bricka-art~1f3a8'])).features[0].properties.ikon).toBe('bricka-art~1f3a8');
    });

    it('ensam bricka får sin emojibild när den är klar, annars kategorins', () => {
        const fc = byggBrickor([ev('a', 17)], { nowMs: NU });
        fc.features[0].properties.emojiBild = 'bricka-music~1f3b8';
        expect(medCykel(fc, [], 0, INGA).features[0].properties.ikon).toBe('bricka-music');
        expect(medCykel(fc, [], 0, new Set(['bricka-music~1f3b8'])).features[0].properties.ikon).toBe('bricka-music~1f3b8');
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

    it('alla i högen hamnar överst någon gång, ett lyft i taget', () => {
        const fc = grannar();
        const högar = brickHögar(fc, 13);
        const överst = new Set<string>();
        for (let t = 0; t < 8; t++) {
            const ut = medCykel(fc, högar, t, INGA).features;
            const lyfta = ut.filter(f => f.properties.sort === FRAM_SORT).map(f => f.properties.id);
            expect(lyfta.length).toBeLessThanOrEqual(1);
            överst.add(lyfta[0] ?? högar[0].topKey);
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
