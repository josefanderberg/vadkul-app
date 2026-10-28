import { describe, expect, it } from 'vitest';
import { dagSektioner, eventIPeriod, horisontOffset, offsetFörDatum, periodLabel } from './dagar';

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

describe('offsetFörDatum (kalendern i dagväljaren)', () => {
    it('datumet blir dagens offset, oavsett klockslag', () => {
        expect(offsetFörDatum(new Date(2026, 8, 27, 0, 0), 13, NU)).toBe(0);
        expect(offsetFörDatum(new Date(2026, 8, 29, 23, 59), 13, NU)).toBe(2);
        expect(offsetFörDatum(new Date(2026, 9, 10, 12, 0), 13, NU)).toBe(13);
    });
    it('passerade dygn och dagar bortom horisonten ger null', () => {
        expect(offsetFörDatum(new Date(2026, 8, 26, 12, 0), 13, NU)).toBeNull();
        expect(offsetFörDatum(new Date(2026, 9, 11, 12, 0), 13, NU)).toBeNull();
    });
    it('tål sommartidsbytet (25 okt 2026)', () => {
        const fre = new Date(2026, 9, 23, 14, 0);
        expect(offsetFörDatum(new Date(2026, 9, 26, 9, 0), 13, fre)).toBe(3);
    });
    it('trasigt datum ger null', () => {
        expect(offsetFörDatum(new Date('x'), 13, NU)).toBeNull();
    });
});

describe('dagSektioner (söklistans sticky dagrubriker)', () => {
    const ev = (d: Date, id: string) => ({ id, time: iso(d) });
    it('grupperar i tidsordning med Idag/Imorgon/veckodag', () => {
        const sekt = dagSektioner([
            ev(new Date(2026, 8, 29, 19, 0), 'c'),
            ev(new Date(2026, 8, 27, 20, 0), 'b'),
            ev(new Date(2026, 8, 27, 15, 0), 'a'),
            ev(new Date(2026, 8, 28, 11, 0), 'x'),
        ], NU);
        expect(sekt.map(s => s.titel)).toEqual(['Idag', 'Imorgon', 'tis 29 sep']);
        expect(sekt[0].data.map(e => e.id)).toEqual(['a', 'b']);
        expect(sekt[1].data.map(e => e.id)).toEqual(['x']);
    });
    it('pågående event som startade igår klumpas under Idag', () => {
        const sekt = dagSektioner([ev(new Date(2026, 8, 26, 22, 0), 'sen')], NU);
        expect(sekt.map(s => s.titel)).toEqual(['Idag']);
    });
    it('otolkbar tid filtreras bort; tom lista ger inga sektioner', () => {
        expect(dagSektioner([{ id: 'a', time: 'x' }], NU)).toEqual([]);
        expect(dagSektioner([], NU)).toEqual([]);
    });
});

describe('horisontOffset', () => {
    it('sista dagen = flödets days minus ett (idag är dag 0)', () => {
        expect(horisontOffset(14)).toBe(13);
        expect(horisontOffset(60)).toBe(59);
        expect(horisontOffset(1)).toBe(0);
    });

    it('saknat eller trasigt värde ger den gamla 14-dagarshorisonten', () => {
        expect(horisontOffset(undefined)).toBe(13);
        expect(horisontOffset(null)).toBe(13);
        expect(horisontOffset(0)).toBe(13);
        expect(horisontOffset(-5)).toBe(13);
        expect(horisontOffset(Number.NaN)).toBe(13);
    });

    it('brutna dagar avrundas nedåt', () => {
        expect(horisontOffset(30.7)).toBe(29);
    });

    it('kalendern når horisontens sista dag men inte dagen efter', () => {
        const max = horisontOffset(60);
        expect(offsetFörDatum(new Date(2026, 10, 25), max, NU)).toBe(59);
        expect(offsetFörDatum(new Date(2026, 10, 26), max, NU)).toBeNull();
    });
});
