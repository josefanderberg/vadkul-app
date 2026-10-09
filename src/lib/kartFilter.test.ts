import { describe, expect, it } from 'vitest';
import type { AppFeedEvent } from '@vadkul/kontrakt';
import {
    klassaKälla,
    matcharFilter,
    planeraKategoriChips,
    räknaKategorier,
    räknaKällor,
    räknaPopulära,
    synligaKällor,
    TOMT_FILTER,
    type KartFilter,
} from './kartFilter';

const ev = (id: string, category = 'music', extra: Partial<AppFeedEvent> = {}): AppFeedEvent => ({
    id,
    title: id,
    time: '2026-09-29T17:00:00.000Z',
    hasSpecificTime: true,
    lat: 59.33,
    lng: 18.06,
    category,
    ...extra,
});

const KYRKAN = ev('https://www.svenskakyrkan.se/stockholm/kalender?event=ab98', 'music');
const PRO = ev('https://pro.se/distrikt/stockholm/aktivitet/1', 'social');
const KORPEN = ev('https://korpenstockholm.zoezi.se/schema#pass-1', 'sport');
const JAZZ = ev('https://www.tickster.com/jazz', 'music', { pop: true });
const FOTBOLL = ev('https://www.tickster.com/fotboll', 'sport');
const TM = ev('https://www.ticketmaster.se/event/x', 'stage', { url: 'https://ticketmaster.evyy.net/c/1?u=x', pop: true });

const f = (over: Partial<KartFilter>): KartFilter => ({ ...TOMT_FILTER, ...over });

describe('klassaKälla', () => {
    it('känner igen de tre stora källorna på värdnamnet', () => {
        expect(klassaKälla(KYRKAN)).toBe('svenskakyrkan');
        expect(klassaKälla(PRO)).toBe('pro');
        expect(klassaKälla(KORPEN)).toBe('korpen');
    });
    it('klassar inte vanliga källor, och pro.se måste vara exakt värd', () => {
        expect(klassaKälla(JAZZ)).toBeNull();
        expect(klassaKälla(ev('https://www.improvisation.pro/x'))).toBeNull();
        expect(klassaKälla(ev('https://stockholm.pro.se/x'))).toBe('pro');
    });
    it('läser url före id (omskrivna länkar)', () => {
        expect(klassaKälla(TM)).toBeNull();
        expect(klassaKälla(ev('inte-en-url', 'music', { url: 'https://www.svenskakyrkan.se/x' }))).toBe('svenskakyrkan');
    });
});

describe('matcharFilter', () => {
    it('användarskapade kringgår hela filtret (webbens första rad)', () => {
        const eget = { ...ev('abc123', 'social'), userCreated: true as const };
        expect(matcharFilter(eget, f({ kategori: 'music', populärt: true }))).toBe(true);
        expect(matcharFilter(eget, f({ källa: 'korpen' }))).toBe(true);
    });
    it('standard: stora källor göms, resten syns', () => {
        expect(matcharFilter(KYRKAN, TOMT_FILTER)).toBe(false);
        expect(matcharFilter(PRO, TOMT_FILTER)).toBe(false);
        expect(matcharFilter(KORPEN, TOMT_FILTER)).toBe(false);
        expect(matcharFilter(JAZZ, TOMT_FILTER)).toBe(true);
    });
    it('ikryssad opt-in-källa syns', () => {
        expect(matcharFilter(KYRKAN, f({ optIn: new Set(['svenskakyrkan']) }))).toBe(true);
        expect(matcharFilter(PRO, f({ optIn: new Set(['svenskakyrkan']) }))).toBe(false);
    });
    it('kategori smalnar även ikryssade källor', () => {
        const filter = f({ kategori: 'sport', optIn: new Set(['svenskakyrkan']) });
        expect(matcharFilter(KYRKAN, filter)).toBe(false);
        expect(matcharFilter(FOTBOLL, filter)).toBe(true);
        expect(matcharFilter(JAZZ, filter)).toBe(false);
    });
    it('FLER-källan visar bara källan, även utan kryss', () => {
        const filter = f({ källa: 'korpen' });
        expect(matcharFilter(KORPEN, filter)).toBe(true);
        expect(matcharFilter(FOTBOLL, filter)).toBe(false);
    });
    it('🔥 smalnar allt till pop-flaggade', () => {
        const filter = f({ populärt: true, optIn: new Set(['svenskakyrkan']) });
        expect(matcharFilter(JAZZ, filter)).toBe(true);
        expect(matcharFilter(TM, filter)).toBe(true);
        expect(matcharFilter(FOTBOLL, filter)).toBe(false);
        expect(matcharFilter(KYRKAN, filter)).toBe(false);
    });
});

describe('räknare', () => {
    const alla = [KYRKAN, PRO, KORPEN, JAZZ, FOTBOLL, TM];
    it('kategorisiffrorna räknas utan kategorival men med opt-in', () => {
        const c = räknaKategorier(alla, f({ kategori: 'sport' }));
        expect(c.get('music')).toBe(1);
        expect(c.get('sport')).toBe(1);
        expect(c.get('stage')).toBe(1);
        expect(räknaKategorier(alla, f({ optIn: new Set(['svenskakyrkan']) })).get('music')).toBe(2);
    });
    it('populärsiffran följer kategorin', () => {
        expect(räknaPopulära(alla, TOMT_FILTER)).toBe(2);
        expect(räknaPopulära(alla, f({ kategori: 'stage' }))).toBe(1);
    });
    it('källsiffrorna räknar alla tre', () => {
        const c = räknaKällor(alla);
        expect([c.get('svenskakyrkan'), c.get('pro'), c.get('korpen')]).toEqual([1, 1, 1]);
    });
});

describe('planeraKategoriChips', () => {
    it('flest först, Övrigt sist, nollor bort utom den valda', () => {
        const counts = new Map([['music', 3], ['sport', 5], ['other', 9], ['art', 0]]);
        expect(planeraKategoriChips(['music', 'sport', 'art', 'other'], counts, null).map(c => c.key))
            .toEqual(['sport', 'music', 'other']);
        expect(planeraKategoriChips(['music', 'sport', 'art', 'other'], counts, 'art').map(c => c.key))
            .toEqual(['sport', 'music', 'art', 'other']);
    });
});

describe('synligaKällor', () => {
    it('bara källor med event, plus den valda', () => {
        expect(synligaKällor(new Map([['pro', 2]]), null).map(k => k.key)).toEqual(['pro']);
        expect(synligaKällor(new Map(), 'korpen').map(k => k.key)).toEqual(['korpen']);
        expect(synligaKällor(new Map(), null)).toEqual([]);
    });
});
