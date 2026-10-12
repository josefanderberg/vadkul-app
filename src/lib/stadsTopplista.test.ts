import { describe, expect, it } from 'vitest';
import type { AppFeedEvent, City } from '@vadkul/kontrakt';
import { bokstavsAvdelare, räknaStäderPerDag, topplistRader, TOPPLIST_SORTERINGAR } from './stadsTopplista';

// Tisdag 13 oktober 2026 kl 12.
const NU = new Date(2026, 9, 13, 12, 0);
const stad = (slug: string, name: string, lat: number, lng: number): City => ({ slug, name, lat, lng, region: 'test' });
const VÄXJÖ = stad('vaxjo', 'Växjö', 56.8777, 14.8091);
const ÄLMHULT = stad('almhult', 'Älmhult', 56.5516, 14.1379);
const ALVESTA = stad('alvesta', 'Alvesta', 56.8994, 14.5560);

const ev = (id: string, c: City, dag: number): AppFeedEvent => ({
    id,
    title: id,
    time: new Date(2026, 9, dag, 19, 0).toISOString(),
    hasSpecificTime: true,
    lat: c.lat + 0.01,
    lng: c.lng,
    category: 'music',
});

describe('räknaStäderPerDag', () => {
    it('per stad och dagoffset, i orten, utan opt-in-källor och passerade dagar', () => {
        const antal = räknaStäderPerDag([
            ev('https://a.se/1', VÄXJÖ, 13),
            ev('https://a.se/2', VÄXJÖ, 13),
            ev('https://a.se/3', VÄXJÖ, 17),
            ev('https://a.se/igår', VÄXJÖ, 12),
            ev('https://www.svenskakyrkan.se/vaxjo/1', VÄXJÖ, 13),
            ev('https://a.se/4', ÄLMHULT, 14),
        ], [VÄXJÖ, ÄLMHULT], NU);
        expect(antal).toEqual({ vaxjo: { 0: 2, 4: 1 }, almhult: { 1: 1 } });
    });
});

describe('topplistRader', () => {
    const antal = {
        vaxjo: { 0: 2, 4: 1, 10: 5 },   // idag 2, helgen 1, veckan 3, totalt 8
        almhult: { 0: 3, 1: 1 },          // idag 3, helgen 0, veckan 4, totalt 4
    };
    const städer = [ÄLMHULT, ALVESTA, VÄXJÖ];

    it('webbens fem sorteringar, A-Ö med vanligt bindestreck', () => {
        expect(TOPPLIST_SORTERINGAR.map(s => s.label)).toEqual(['Flest totalt', 'Mest i veckan', 'Mest i helgen', 'Mest idag', 'A-Ö']);
    });

    it('siffrorna: idag, helgen, veckan, totalt', () => {
        const [växjö] = topplistRader(städer, antal, 'totalt', NU);
        expect(växjö).toMatchObject({ idag: 2, helgen: 1, veckan: 3, totalt: 8 });
        expect(växjö.stad.slug).toBe('vaxjo');
    });

    it('sorterar på vald kolumn; ohämtade städer sist med null', () => {
        expect(topplistRader(städer, antal, 'totalt', NU).map(r => r.stad.slug)).toEqual(['vaxjo', 'almhult', 'alvesta']);
        expect(topplistRader(städer, antal, 'idag', NU).map(r => r.stad.slug)).toEqual(['almhult', 'vaxjo', 'alvesta']);
        expect(topplistRader(städer, antal, 'veckan', NU).map(r => r.stad.slug)).toEqual(['almhult', 'vaxjo', 'alvesta']);
        expect(topplistRader(städer, antal, 'helgen', NU).map(r => r.stad.slug)).toEqual(['vaxjo', 'almhult', 'alvesta']);
        expect(topplistRader(städer, antal, 'totalt', NU)[2]).toMatchObject({ idag: null, totalt: null });
    });

    it('A-Ö i svensk ordning med bokstavsavdelare', () => {
        const rader = topplistRader(städer, antal, 'namn', NU);
        expect(rader.map(r => r.stad.name)).toEqual(['Alvesta', 'Växjö', 'Älmhult']);
        expect(rader.map((_, i) => bokstavsAvdelare(rader, i))).toEqual(['A', 'V', 'Ä']);
    });
});
