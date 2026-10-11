import { describe, expect, it } from 'vitest';
import type { AppFeedEvent } from '@vadkul/kontrakt';
import { bildflöde, delaVäljarlista, eventStatus, harBild, markeraTrasigBild, tidsHint, väljarRäknare } from './listRad';

const NU = new Date(2026, 9, 11, 14, 0); // sön 11 okt 2026 14:00, lokal tid
const nuMs = NU.getTime();
const kl = (dag: number, h: number, m = 0) => new Date(2026, 9, dag, h, m).toISOString();
const ev = (id: string, time: string, over: Partial<AppFeedEvent> = {}): AppFeedEvent => ({
    id, title: id, time, hasSpecificTime: true, lat: 56.88, lng: 14.81, category: 'music', ...over,
});

describe('eventStatus (webbens getEventStatus)', () => {
    it('en timmes standardlängd: pågår, sedan har varit', () => {
        expect(eventStatus(ev('a', kl(11, 13, 30)), nuMs)).toBe('ongoing');
        expect(eventStatus(ev('a', kl(11, 13, 0)), nuMs)).toBe('past');
    });
    it('snart / inom 3h / inom 5h / senare', () => {
        expect(eventStatus(ev('a', kl(11, 14, 45)), nuMs)).toBe('soon');
        expect(eventStatus(ev('a', kl(11, 16, 0)), nuMs)).toBe('within3');
        expect(eventStatus(ev('a', kl(11, 18, 30)), nuMs)).toBe('within5');
        expect(eventStatus(ev('a', kl(11, 20, 0)), nuMs)).toBe('later');
    });
    it('utan klockslag: Idag samma dag, har varit från kl 20', () => {
        const heldag = ev('a', kl(11, 0), { hasSpecificTime: false });
        expect(eventStatus(heldag, nuMs)).toBe('today');
        expect(eventStatus(heldag, new Date(2026, 9, 11, 20, 0).getTime())).toBe('past');
        expect(eventStatus(ev('b', kl(13, 0), { hasSpecificTime: false }), nuMs)).toBe('later');
    });
});

describe('tidsHint (webbens formatTimeHint)', () => {
    it('klockslaget idag, veckodag + klocka andra dagar', () => {
        expect(tidsHint(ev('a', kl(11, 19, 5)), nuMs)).toBe('kl 19:05');
        expect(tidsHint(ev('a', kl(15, 19, 0)), nuMs)).toBe('tors 19:00');
    });
    it('utan klockslag: tomt idag före kl 20, "Idag" efter, datum andra dagar', () => {
        const heldag = ev('a', kl(11, 0), { hasSpecificTime: false });
        expect(tidsHint(heldag, nuMs)).toBe('');
        expect(tidsHint(heldag, new Date(2026, 9, 11, 21, 0).getTime())).toBe('Idag');
        expect(tidsHint(ev('b', kl(17, 0), { hasSpecificTime: false }), nuMs)).toBe('lör 17 okt');
    });
    it('trasig tid ger ingen hint', () => {
        expect(tidsHint(ev('a', 'x'), nuMs)).toBe('');
    });
});

describe('bilderna', () => {
    it('bildflödet tar bara event med bild', () => {
        const lista = [ev('a', kl(12, 19), { img: 'https://x/a.jpg' }), ev('b', kl(12, 20))];
        expect(bildflöde(lista).map(e => e.id)).toEqual(['a']);
    });
    it('en trasig länk räknas inte som bild nästa gång', () => {
        const e = ev('a', kl(12, 19), { img: 'https://x/trasig.jpg' });
        expect(harBild(e)).toBe(true);
        markeraTrasigBild('https://x/trasig.jpg');
        expect(harBild(e)).toBe(false);
        expect(harBild(ev('b', kl(12, 19)))).toBe(false);
    });
});

describe('delaVäljarlista (webbens EventCardGroupList)', () => {
    const grupp = [
        ev('kväll', kl(11, 19)),
        ev('lunch', kl(11, 12)),
        ev('fredag', kl(16, 18)),
        ev('morgon', kl(11, 9)),
        ev('heldag', kl(11, 0), { hasSpecificTime: false }),
    ];
    it('kommande dag för dag i tidsordning, passerade för sig', () => {
        const { dagar, passerade } = delaVäljarlista(grupp, NU);
        expect(dagar.map(d => [d.offset, d.events.map(e => e.id)])).toEqual([
            [0, ['heldag', 'kväll']],
            [5, ['fredag']],
        ]);
        expect(passerade.map(e => e.id)).toEqual(['morgon', 'lunch']);
    });
    it('räknarraden: dagar bara när högen spänner flera, har varit bara när några är kvar', () => {
        expect(väljarRäknare(5, 2, 2)).toBe('5 event på samma plats · 2 dagar · 2 har varit');
        expect(väljarRäknare(3, 1, 0)).toBe('3 event på samma plats');
        expect(väljarRäknare(3, 0, 3)).toBe('3 event på samma plats');
    });
});
