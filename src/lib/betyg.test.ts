import { describe, expect, it } from 'vitest';
import {
    DAGAR_TRÖSKEL,
    KOMMER_TRÖSKEL,
    TOMT_BETYGSLÄGE,
    dagNyckel,
    läsBetygsLäge,
    markeraFrågad,
    noteraDag,
    noteraKommer,
    skaFrågaOmBetyg,
    type BetygsLäge,
} from './betyg';

const V = '1.2.0';
const läge = (delar: Partial<BetygsLäge>): BetygsLäge => ({ ...TOMT_BETYGSLÄGE, ...delar });
const kommerGånger = (n: number, start = TOMT_BETYGSLÄGE) =>
    Array.from({ length: n }).reduce<BetygsLäge>(l => noteraKommer(l), start);

describe('dagNyckel', () => {
    it('ger lokal dag med nollor', () => {
        expect(dagNyckel(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
        expect(dagNyckel(new Date(2026, 10, 20, 0, 1))).toBe('2026-11-20');
    });
});

describe('noteraDag', () => {
    it('räknar varje ny dag en gång', () => {
        let l = noteraDag(TOMT_BETYGSLÄGE, '2026-11-20');
        l = noteraDag(l, '2026-11-20');
        expect(l.dagar).toBe(1);
        l = noteraDag(l, '2026-11-21');
        expect(l.dagar).toBe(2);
        expect(l.senasteDag).toBe('2026-11-21');
    });
    it('samma dag igen ger samma objekt (ingen onödig skrivning)', () => {
        const l = noteraDag(TOMT_BETYGSLÄGE, '2026-11-20');
        expect(noteraDag(l, '2026-11-20')).toBe(l);
    });
});

describe('skaFrågaOmBetyg', () => {
    it('frågar aldrig utan ett Kommer-svar, hur många dagar det än gått', () => {
        expect(skaFrågaOmBetyg(läge({ dagar: 30 }), V)).toBe(false);
    });
    it('frågar inte på första eller andra Kommer under de första dagarna', () => {
        expect(skaFrågaOmBetyg(kommerGånger(1, läge({ dagar: 1 })), V)).toBe(false);
        expect(skaFrågaOmBetyg(kommerGånger(KOMMER_TRÖSKEL - 1, läge({ dagar: 2 })), V)).toBe(false);
    });
    it('frågar vid tredje Kommer', () => {
        expect(skaFrågaOmBetyg(kommerGånger(KOMMER_TRÖSKEL, läge({ dagar: 1 })), V)).toBe(true);
    });
    it('frågar vid första Kommer från och med tredje dagen', () => {
        expect(skaFrågaOmBetyg(kommerGånger(1, läge({ dagar: DAGAR_TRÖSKEL })), V)).toBe(true);
    });
    it('högst en gång per version', () => {
        const frågad = markeraFrågad(kommerGånger(5), V);
        expect(skaFrågaOmBetyg(frågad, V)).toBe(false);
        expect(skaFrågaOmBetyg(noteraKommer(frågad), V)).toBe(false);
    });
    it('frågar igen i nästa version', () => {
        const frågad = markeraFrågad(kommerGånger(5), V);
        expect(skaFrågaOmBetyg(noteraKommer(frågad), '1.3.0')).toBe(true);
    });
});

describe('läsBetygsLäge', () => {
    it('trasig lagring ger tomt läge', () => {
        expect(läsBetygsLäge(null)).toEqual(TOMT_BETYGSLÄGE);
        expect(läsBetygsLäge('hej')).toEqual(TOMT_BETYGSLÄGE);
        expect(läsBetygsLäge({ kommer: 'tre', dagar: -2, senasteDag: 5, frågadVersion: '' })).toEqual(TOMT_BETYGSLÄGE);
    });
    it('behåller ett helt läge', () => {
        const l = { kommer: 4, dagar: 2, senasteDag: '2026-11-20', frågadVersion: '1.1.1' };
        expect(läsBetygsLäge(l)).toEqual(l);
    });
});
