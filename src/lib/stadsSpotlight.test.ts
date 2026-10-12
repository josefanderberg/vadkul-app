import { describe, expect, it } from 'vitest';
import type { AppEvent } from './appEvent';
import { grupperaSpotEvent, spotlightDokument, spotlightRader, spotSpann, spotTid, SPOTLIGHT_MAX } from './stadsSpotlight';

const VÄXJÖ = { lat: 56.88, lng: 14.81 };
// Tisdag 13 oktober 2026 kl 12.
const NU = new Date(2026, 9, 13, 12, 0);

const ev = (id: string, dag: number, extra: Partial<AppEvent> = {}): AppEvent => ({
    id,
    title: id,
    time: new Date(2026, 9, dag, 18, 0).toISOString(),
    hasSpecificTime: true,
    lat: VÄXJÖ.lat,
    lng: VÄXJÖ.lng,
    category: 'social',
    userCreated: true,
    ...extra,
});

describe('spotlightRader', () => {
    it('bara användarskapade inom radien som inte varit', () => {
        const rader = spotlightRader([
            ev('nära', 14),
            ev('skrapat', 14, { userCreated: undefined }),
            ev('kalmar', 14, { lat: 56.66, lng: 16.36 }), // ~95 km bort
            ev('igår', 12),
        ], VÄXJÖ, 35, NU);
        expect(rader.map(r => r.e.id)).toEqual(['nära']);
    });

    it('bild först, sedan tid, max fyra', () => {
        const rader = spotlightRader([
            ev('a', 14), ev('b', 15), ev('c', 16, { img: 'https://x/c.jpg' }), ev('d', 17), ev('e', 18),
        ], VÄXJÖ, 35, NU);
        expect(rader).toHaveLength(SPOTLIGHT_MAX);
        expect(rader.map(r => r.e.id)).toEqual(['c', 'a', 'b', 'd']);
    });
});

describe('grupperaSpotEvent', () => {
    it('samma titel på samma plats dagar i rad blir EN rad (konstrundan)', () => {
        const lör = ev('Konstrunda', 17, { id: 'k1' });
        const sön = ev('Konstrunda', 18, { id: 'k2' });
        const rader = grupperaSpotEvent([lör, sön], NU);
        expect(rader).toHaveLength(1);
        expect(rader[0]).toMatchObject({ dagar: 2, docIds: ['k1', 'k2'] });
        expect(rader[0].e.id).toBe('k1');
        expect(rader[0].sista?.id).toBe('k2');
        expect(spotSpann(rader[0])).toBe('2 dagar');
    });

    it('en lucka mellan dagarna bryter kedjan; samma dag två gånger är två rader', () => {
        const rader = grupperaSpotEvent([
            ev('Quiz', 14, { id: 'q1' }),
            ev('Quiz', 16, { id: 'q2' }),
            ev('Sagostund', 15, { id: 's1', time: new Date(2026, 9, 15, 10).toISOString() }),
            ev('Sagostund', 15, { id: 's2', time: new Date(2026, 9, 15, 15).toISOString() }),
        ], NU);
        expect(rader.map(r => r.e.id).sort()).toEqual(['q1', 'q2', 's1', 's2']);
    });

    it('en veckoserie är EN rad med nästa tillfälle och rytmen som chip', () => {
        const bas = { docId: 'pub', title: 'Pubquiz', repeatWeekly: true as const };
        const rader = grupperaSpotEvent([
            ev('pub__2026-10-14', 14, bas),
            ev('pub__2026-10-21', 21, bas),
        ], NU);
        expect(rader).toHaveLength(1);
        expect(rader[0]).toMatchObject({ rytm: 'Varje vecka', docIds: ['pub'] });
        expect(rader[0].e.id).toBe('pub__2026-10-14');
        expect(spotSpann(rader[0])).toBe('Varje vecka');
    });

    it('dagsserien (ett dokument, utvecklat) grupperas som dagar i rad', () => {
        const bas = { docId: 'mkt', title: 'Marknad', repeatDays: 3 };
        const rader = grupperaSpotEvent([
            ev('mkt__2026-10-16', 16, bas), ev('mkt__2026-10-17', 17, bas), ev('mkt__2026-10-18', 18, bas),
        ], NU);
        expect(rader).toHaveLength(1);
        expect(rader[0]).toMatchObject({ dagar: 3, docIds: ['mkt'] });
    });
});

describe('spotlightDokument', () => {
    it('alla dokument raderna står för - daglistan hoppar över dem', () => {
        const rader = grupperaSpotEvent([ev('K', 17, { id: 'k1' }), ev('K', 18, { id: 'k2' })], NU);
        expect([...spotlightDokument(rader)]).toEqual(['k1', 'k2']);
    });
});

describe('spotTid', () => {
    it('en rad = appens tidsrad', () => {
        expect(spotTid({ e: ev('a', 13) }, NU)).toBe('Idag · 18:00');
    });
    it('flera dagar: samma månad utan månad på första dagen', () => {
        expect(spotTid({ e: ev('a', 17), dagar: 2, sista: ev('b', 18) }, NU)).toBe('lör 17-sön 18 okt · 18:00');
    });
    it('idag-imorgon och över ett månadsskifte', () => {
        expect(spotTid({ e: ev('a', 13), dagar: 2, sista: ev('b', 14) }, NU)).toBe('Idag-imorgon · 18:00');
        const fre = ev('a', 30);
        const sön = { ...ev('b', 1), time: new Date(2026, 10, 1, 18).toISOString() };
        expect(spotTid({ e: { ...fre, hasSpecificTime: false }, dagar: 3, sista: sön }, NU)).toBe('fre 30 okt-sön 1 nov');
    });
});
