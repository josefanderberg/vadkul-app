import { describe, expect, it } from 'vitest';
import { CITIES } from '@vadkul/kontrakt';
import { snabbvalsStäder, tolkaStartval, utgångsStad, type StadsUnderlag } from './startval';

const stad = (slug: string) => {
    const c = CITIES.find(x => x.slug === slug);
    if (!c) throw new Error(`okänd testslug: ${slug}`);
    return c;
};

describe('tolkaStartval', () => {
    it('ger staden för en giltig slug', () => {
        expect(tolkaStartval('goteborg')?.name).toBe('Göteborg');
    });
    it('null, okänd slug eller skräp → inget val', () => {
        expect(tolkaStartval(null)).toBeNull();
        expect(tolkaStartval('atlantis')).toBeNull();
        expect(tolkaStartval(42)).toBeNull();
        expect(tolkaStartval({ slug: 'umea' })).toBeNull();
        expect(tolkaStartval(undefined)).toBeNull();
    });
});

describe('snabbvalsStäder', () => {
    it('största städerna först', () => {
        expect(snabbvalsStäder(3).map(c => c.slug)).toEqual(['stockholm', 'goteborg', 'malmo']);
    });
    it('respekterar antalet och har inga dubbletter', () => {
        const åtta = snabbvalsStäder(8);
        expect(åtta).toHaveLength(8);
        expect(new Set(åtta.map(c => c.slug)).size).toBe(8);
    });
});

describe('utgångsStad', () => {
    const sthlm = stad('stockholm');
    const gbg = stad('goteborg');
    const umea = stad('umea');
    const lund = stad('lund');
    const bas: StadsUnderlag = { manuell: null, gpsStad: null, gpsVald: false, startval: null, sparad: null, standard: sthlm };

    it('startvalet vinner över GPS:en och fallbacken', () => {
        expect(utgångsStad({ ...bas, startval: gbg, gpsStad: umea })).toEqual({ city: gbg, fromGps: false });
        expect(utgångsStad({ ...bas, startval: gbg })).toEqual({ city: gbg, fromGps: false });
    });
    it('manuellt besöksval vinner över allt', () => {
        expect(utgångsStad({ ...bas, manuell: lund, startval: gbg, gpsStad: umea, gpsVald: true }))
            .toEqual({ city: lund, fromGps: false });
    });
    it('"återgå till min plats" går före startvalet när fixen finns', () => {
        expect(utgångsStad({ ...bas, startval: gbg, gpsStad: umea, gpsVald: true }))
            .toEqual({ city: umea, fromGps: true });
    });
    it('"återgå till min plats" utan fix lämnar startvalet kvar', () => {
        expect(utgångsStad({ ...bas, startval: gbg, gpsVald: true })).toEqual({ city: gbg, fromGps: false });
    });
    it('utan val: GPS > sparad landning > standard', () => {
        expect(utgångsStad({ ...bas, gpsStad: umea, sparad: lund })).toEqual({ city: umea, fromGps: true });
        expect(utgångsStad({ ...bas, sparad: lund })).toEqual({ city: lund, fromGps: false });
        expect(utgångsStad(bas)).toEqual({ city: sthlm, fromGps: false });
    });
});
