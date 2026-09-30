import { describe, expect, it } from 'vitest';
import type { AppFeedEvent } from '@vadkul/kontrakt';
import { findCity, highlightSegments, searchCities, sokEvent, splitCityFromQuery } from './sok';

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
