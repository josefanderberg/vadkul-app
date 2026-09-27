import { describe, expect, it } from 'vitest';
import { eventIPeriod, periodLabel } from './dagar';

const NU = new Date(2026, 8, 27, 14, 0); // sön 27 sep 2026, lokal tid
const iso = (d: Date) => d.toISOString();

describe('periodLabel - dag', () => {
    it('Idag, Imorgon, sen veckodag med datum', () => {
        expect(periodLabel(0, 1, NU)).toBe('Idag');
        expect(periodLabel(1, 1, NU)).toBe('Imorgon');
        expect(periodLabel(2, 1, NU)).toBe('tis 29 sep');
    });
    it('kliver över månadsskiften', () => {
        expect(periodLabel(4, 1, NU)).toBe('tors 1 okt');
    });
});

describe('periodLabel - vecka', () => {
    it('Hela veckan bara på offset 0', () => {
        expect(periodLabel(0, 7, NU)).toBe('Hela veckan');
    });
    it('annars datumspannet, sju dagar inklusive start', () => {
        expect(periodLabel(1, 7, NU)).toBe('28 sep-4 okt');
    });
});

describe('eventIPeriod', () => {
    it('startdagen räknas från lokal midnatt, slutet är exklusivt', () => {
        const idagKväll = iso(new Date(2026, 8, 27, 23, 30));
        const imorgonBitti = iso(new Date(2026, 8, 28, 0, 30));
        expect(eventIPeriod(idagKväll, 0, 1, NU)).toBe(true);
        expect(eventIPeriod(imorgonBitti, 0, 1, NU)).toBe(false);
        expect(eventIPeriod(imorgonBitti, 1, 1, NU)).toBe(true);
    });
    it('veckofönstret täcker sju dagar', () => {
        const omSexDagar = iso(new Date(2026, 9, 3, 12, 0));
        const omSjuDagar = iso(new Date(2026, 9, 4, 12, 0));
        expect(eventIPeriod(omSexDagar, 0, 7, NU)).toBe(true);
        expect(eventIPeriod(omSjuDagar, 0, 7, NU)).toBe(false);
    });
    it('tål trasiga tider', () => {
        expect(eventIPeriod('inte-en-tid', 0, 1, NU)).toBe(false);
    });
});
