import { describe, expect, it } from 'vitest';
import type { AppFeedEvent } from '@vadkul/kontrakt';
import {
    basBrickor,
    brickHögar,
    byggTonlager,
    harRörelse,
    mercatorPt,
    nästaFront,
    nästaIRunda,
    tonOpacitet,
    TOMT_LÄGE,
    visadBild,
    växlande,
    överlappsHögar,
    type BläddrLäge,
    type TonPost,
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

describe('huvudlagret (basBrickor) - rörs aldrig av bläddringen', () => {
    const multi = () => byggBrickor([ev('a', 17), ev('b', 18, { category: 'art' })], { nowMs: NU });

    it('visar ram 0 med representantens titel, och ramarna skickas inte till kartan', () => {
        const p = basBrickor(multi(), INGA).features[0].properties as Record<string, unknown>;
        expect(p.ramar).toBeUndefined();
        expect([p.ikon, p.titel, p.label]).toEqual(['bricka-music', 'a', 'Musik']);
    });

    it('emojibilden används först när den är inläst', () => {
        const fc = byggBrickor([ev('a', 17)], { nowMs: NU });
        fc.features[0].properties.emojiBild = 'bricka-music~1f3b8';
        expect(basBrickor(fc, INGA).features[0].properties.ikon).toBe('bricka-music');
        expect(basBrickor(fc, new Set(['bricka-music~1f3b8'])).features[0].properties.ikon).toBe('bricka-music~1f3b8');
        const ram = byggBrickor([ev('a', 17), ev('b', 18, { category: 'art' })], { nowMs: NU });
        ram.features[0].properties.ramar![1] = { ikon: 'bricka-art', emojiBild: 'bricka-art~1f3a8', titel: 'b', label: 'Konst' };
        expect(visadBild(ram.features[0].properties, new Map([['a', 1]]), new Set(['bricka-art~1f3a8']))).toBe('bricka-art~1f3a8');
    });

    it('samma brickor ger exakt samma data - en minuttick skickar inget nytt till kartan', () => {
        expect(JSON.stringify(basBrickor(multi(), INGA))).toBe(JSON.stringify(basBrickor(multi(), INGA)));
    });
});

describe('tonlagret', () => {
    // a+b på samma plats (växlar), c ~17 m bort (överlappar a vid zoom 13).
    const fc = () => byggBrickor(
        [ev('a', 17), ev('b', 18, { category: 'art' }), ev('c', 18, { lng: 18.0603, category: 'sport' })],
        { nowMs: NU },
    );

    it('ram-kopior för ram 1.. och fram-kopior av alla ramar för brickorna i högar, ram-gruppen underst', () => {
        const brickor = fc();
        const { data, poster } = byggTonlager(brickor, brickHögar(brickor, 13), INGA);
        expect(poster.map(p => p.k)).toEqual(['ram|a|1', 'fram|a|0', 'fram|a|1', 'fram|c|0']);
        expect(data.features.map(f => f.properties.ikon)).toEqual(['bricka-art', 'bricka-music', 'bricka-art', 'bricka-sport']);
        // Utan högar: bara ram-kopian.
        expect(byggTonlager(brickor, [], INGA).poster.map(p => p.k)).toEqual(['ram|a|1']);
    });

    const post = (k: string): TonPost => {
        const [grupp, id, j] = k.split('|');
        return { k, grupp: grupp as TonPost['grupp'], id, j: Number(j) };
    };
    const läge = (l: Partial<BläddrLäge>): BläddrLäge => ({ ...TOMT_LÄGE, ...l });

    it('ram 0 = huvudlagret: inga kopior syns i vila', () => {
        expect(tonOpacitet(post('ram|a|1'), TOMT_LÄGE, 2)).toBe(0);
        expect(tonOpacitet(post('fram|a|0'), TOMT_LÄGE, 2)).toBe(0);
    });

    it('bytet i två steg: nya ramen syns medan den gamla hålls, sedan bara den nya', () => {
        const steg1 = läge({ ramIndex: new Map([['a', 0]]), ramHåll: new Map([['a', 1]]) });
        // Varvet runt 1 → 0: kopian för ram 1 hålls kvar och tonas sedan bort.
        expect(tonOpacitet(post('ram|a|1'), steg1, 2)).toBe(1);
        const steg2 = läge({ ramIndex: new Map([['a', 0]]) });
        expect(tonOpacitet(post('ram|a|1'), steg2, 2)).toBe(0);
        // 0 → 1: kopian tonas in.
        expect(tonOpacitet(post('ram|a|1'), läge({ ramIndex: new Map([['a', 1]]), ramHåll: new Map([['a', 0]]) }), 2)).toBe(1);
    });

    it('fram-kopian syns bara för den som har turen (eller hålls under sin uttoning), i dess aktuella ram', () => {
        const front = läge({ fronter: new Map([['a|c', 'c']]) });
        expect(tonOpacitet(post('fram|c|0'), front, 1)).toBe(1);
        expect(tonOpacitet(post('fram|a|0'), front, 2)).toBe(0);
        const aFram = läge({ fronter: new Map([['a|c', 'a']]), ramIndex: new Map([['a', 1]]) });
        expect(tonOpacitet(post('fram|a|1'), aFram, 2)).toBe(1);
        expect(tonOpacitet(post('fram|a|0'), aFram, 2)).toBe(0);
        const håll = läge({ frontHåll: new Set(['c']) });
        expect(tonOpacitet(post('fram|c|0'), håll, 1)).toBe(1);
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
            överst.add(front);
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
