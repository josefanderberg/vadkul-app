import { describe, expect, it } from 'vitest';
import type { AppFeedEvent } from '@vadkul/kontrakt';
import {
    findCity,
    highlightSegments,
    kategoriFörOrd,
    närmastPerDag,
    searchCities,
    sokEvent,
    splitCityFromQuery,
    tolkaKategorier,
} from './sok';

const ev = (id: string, title: string, locationName?: string, time = '2026-09-28T19:00:00.000Z'): AppFeedEvent => ({
    id,
    title,
    time,
    hasSpecificTime: true,
    lat: 0,
    lng: 0,
    locationName,
    category: 'music',
});

const EVENTS = [
    ev('a', 'Jazzkväll på slottet', 'Kulturhuset'),
    ev('b', 'Kväll med jazz', 'Slottsparken'),
    ev('c', 'Loppis', 'Jazzklubben'),
    ev('d', 'Konsert', 'Stora scenen'),
];

describe('sokEvent', () => {
    it('rankar titelprefix före titelträff före platsträff', () => {
        expect(sokEvent(EVENTS, 'jazz').map(e => e.id)).toEqual(['a', 'b', 'c']);
    });
    it('bryr sig inte om skiftläge och yttre blanksteg', () => {
        expect(sokEvent(EVENTS, '  JAZZ ').map(e => e.id)).toEqual(['a', 'b', 'c']);
    });
    it('tom fråga ger tom lista', () => {
        expect(sokEvent(EVENTS, '')).toEqual([]);
        expect(sokEvent(EVENTS, '   ')).toEqual([]);
    });
    it('sorterar lika viktiga träffar på tid', () => {
        const tidig = ev('e', 'Jazzfrukost', undefined, '2026-09-27T08:00:00.000Z');
        expect(sokEvent([...EVENTS, tidig], 'jazz').map(e => e.id)).toEqual(['e', 'a', 'b', 'c']);
    });
    it('respekterar maxantalet', () => {
        expect(sokEvent(EVENTS, 'jazz', 2)).toHaveLength(2);
    });
});

describe('webbens nivåer', () => {
    const e = (id: string, title: string, extra: Partial<AppFeedEvent> = {}): AppFeedEvent => ({
        ...ev(id, title), ...extra,
    });
    it('ord i titeln före mitt i ett ord', () => {
        const lista = [e('mitt', 'Afrojazz'), e('ord', 'Kväll med jazz')];
        expect(sokEvent(lista, 'jazz').map(x => x.id)).toEqual(['ord', 'mitt']);
    });
    it('flera ord måste alla träffa något fält', () => {
        const lista = [e('a', 'Quiz', { locationName: 'Puben' }), e('b', 'Quiz', { locationName: 'Biblioteket' })];
        expect(sokEvent(lista, 'quiz pub').map(x => x.id)).toEqual(['a']);
    });
    it('kategoriord träffar kategorin, men festival drar inte in Fest', () => {
        const lista = [e('s', 'Match', { category: 'sport' }), e('f', 'Klubbkväll', { category: 'party' })];
        expect(sokEvent(lista, 'sport').map(x => x.id)).toEqual(['s']);
        expect(sokEvent(lista, 'festival')).toEqual([]);
    });
    it('länken är sista nivån', () => {
        const lista = [e('https://www.tickster.com/x', 'Konsert')];
        expect(sokEvent(lista, 'tickster').map(x => x.id)).toEqual(['https://www.tickster.com/x']);
    });
});

describe('ort i söktexten', () => {
    const gbg = { ...ev('gbg', 'Jazz på Nefertiti'), lat: 57.70, lng: 11.97 };
    const sthlm = { ...ev('sthlm', 'Jazz på Fasching'), lat: 59.33, lng: 18.06 };
    it('"jazz i göteborg" begränsar till orten', () => {
        expect(splitCityFromQuery('jazz i göteborg')).toMatchObject({ city: { slug: 'goteborg' }, text: 'jazz' });
        expect(sokEvent([gbg, sthlm], 'jazz i göteborg').map(x => x.id)).toEqual(['gbg']);
    });
    it('ortnamn utan prickar hittas, men aldrig på gissning', () => {
        expect(findCity('malmo')?.slug).toBe('malmo');
        expect(findCity('kar')).toBeNull();
    });
    it('ren ortsökning tolkas inte', () => {
        expect(splitCityFromQuery('göteborg').city).toBeNull();
    });
    it('stadsraden rankar exakt före prefix', () => {
        expect(searchCities('lund').map(c => c.slug)[0]).toBe('lund');
        expect(searchCities('k')).toEqual([]);
    });
});

describe('highlightSegments', () => {
    it('markerar alla förekomster i originalets skiftläge', () => {
        expect(highlightSegments('Jazz och jazz', 'jazz')).toEqual([
            { text: 'Jazz', hit: true },
            { text: ' och ', hit: false },
            { text: 'jazz', hit: true },
        ]);
    });
});

describe('kategoriord i söket', () => {
    it('hela ord och svenska böjningar räknas', () => {
        expect(kategoriFörOrd('konst')).toBe('art');
        expect(kategoriFörOrd('konsten')).toBe('art');
        expect(kategoriFörOrd('musik')).toBe('music');
        expect(kategoriFörOrd('barnen')).toBe('family');
        expect(kategoriFörOrd('marknader')).toBe('market');
    });
    it('synonymerna räknas', () => {
        expect(kategoriFörOrd('teater')).toBe('stage');
        expect(kategoriFörOrd('konserter')).toBe('music');
        expect(kategoriFörOrd('loppis')).toBe('market');
        expect(kategoriFörOrd('utställningar')).toBe('art');
    });
    it('halvskrivna ord och ord som bara börjar likadant räknas inte', () => {
        expect(kategoriFörOrd('kon')).toBeNull();
        expect(kategoriFörOrd('match')).toBeNull();
        expect(kategoriFörOrd('mats')).toBeNull();
        expect(kategoriFörOrd('festival')).toBeNull();
        expect(kategoriFörOrd('konstnär')).toBeNull();
    });
    it('källorna kyrkan/PRO och Övrigt är inga kategoriord', () => {
        expect(kategoriFörOrd('kyrkan')).toBeNull();
        expect(kategoriFörOrd('pro')).toBeNull();
        expect(kategoriFörOrd('övrigt')).toBeNull();
    });
    it('bara kategoriord och bindeord ger en kategorisökning', () => {
        expect([...tolkaKategorier('konst')]).toEqual(['art']);
        expect([...tolkaKategorier('musik och teater')].sort()).toEqual(['music', 'stage']);
        expect(tolkaKategorier('konst jazz').size).toBe(0);
        expect(tolkaKategorier('jazz').size).toBe(0);
        expect(tolkaKategorier('').size).toBe(0);
    });
    it('"konst växjö": orten lossnar först, sedan blir resten kategorin', () => {
        const { city, text } = splitCityFromQuery('konst växjö');
        expect(city?.slug).toBe('vaxjo');
        expect([...tolkaKategorier(text)]).toEqual(['art']);
    });
});

describe('närmastPerDag', () => {
    // Lokal tid som dagar.test: idag = 20 okt, kl 12.
    const nu = new Date(2026, 9, 20, 12, 0);
    const kl = (dag: number, h: number) => new Date(2026, 9, dag, h, 0).toISOString();
    const växjö = { lat: 56.8777, lng: 14.8094 };
    const nära = { ...ev('nara', 'Nära', undefined, kl(20, 21)), lat: 56.88, lng: 14.81 };
    const långt = { ...ev('langt', 'Långt bort', undefined, kl(20, 13)), lat: 59.33, lng: 18.06 };
    const mitt = { ...ev('mitt', 'Lagom', undefined, kl(20, 18)), lat: 57.78, lng: 14.16 };
    const imorgon = { ...ev('imorgon', 'Imorgon', undefined, kl(21, 10)), lat: 56.88, lng: 14.81 };

    it('närmast först inom dagen, dagarna i ordning', () => {
        const s = närmastPerDag([långt, imorgon, mitt, nära], växjö, 0, nu);
        expect(s.map(x => x.titel)).toEqual(['Idag', 'Imorgon']);
        expect(s[0].data.map(e => e.id)).toEqual(['nara', 'mitt', 'langt']);
    });
    it('börjar på kartans dag', () => {
        const s = närmastPerDag([långt, imorgon, nära], växjö, 1, nu);
        expect(s.map(x => x.titel)).toEqual(['Imorgon']);
    });
    it('pågående event från igår hör till Idag', () => {
        const pågår = { ...ev('pagar', 'Utställning', undefined, kl(18, 10)), lat: 56.88, lng: 14.81 };
        const s = närmastPerDag([långt, pågår], växjö, 0, nu);
        expect(s[0].data.map(e => e.id)).toEqual(['pagar', 'langt']);
    });
    it('lika långt bort = tidsordning', () => {
        const tidig = { ...nära, id: 'tidig', time: kl(20, 14) };
        expect(närmastPerDag([nära, tidig], växjö, 0, nu)[0].data.map(e => e.id)).toEqual(['tidig', 'nara']);
    });
    it('inne i staden (inom ett par km) gäller klockslaget, inte metrarna', () => {
        // ~0,1 km kl 21 och ~1 km kl 14 - samma band, tidigast först.
        const enKm = { ...ev('enkm', 'En km bort', undefined, kl(20, 14)), lat: 56.886, lng: 14.81 };
        expect(närmastPerDag([nära, enKm], växjö, 0, nu)[0].data.map(e => e.id)).toEqual(['enkm', 'nara']);
    });
});
