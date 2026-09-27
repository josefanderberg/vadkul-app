import { describe, expect, it } from 'vitest';
import { nästaLäge } from './sheetSnap';

const PEEK = 400;

describe('nästaLäge - ett stopp per gest', () => {
    it('snabbt svep uppåt fäller ut, varifrån det än kommer', () => {
        expect(nästaLäge('peek', PEEK, -1.2, PEEK)).toBe('utfällt');
        expect(nästaLäge('utfällt', 100, -0.8, PEEK)).toBe('utfällt');
    });
    it('snabbt svep nedåt från utfällt stannar på peek - inte stängt', () => {
        expect(nästaLäge('utfällt', 150, 1.1, PEEK)).toBe('peek');
    });
    it('snabbt svep nedåt från peek stänger', () => {
        expect(nästaLäge('peek', PEEK + 40, 1.1, PEEK)).toBe('stängt');
    });
    it('långsamt släpp nära toppen fäller ut', () => {
        expect(nästaLäge('peek', PEEK / 2 - 1, 0, PEEK)).toBe('utfällt');
    });
    it('långsamt släpp kring peek-läget stannar på peek', () => {
        expect(nästaLäge('utfällt', PEEK / 2 + 1, 0, PEEK)).toBe('peek');
        expect(nästaLäge('peek', PEEK + 79, 0.2, PEEK)).toBe('peek');
    });
    it('långsamt släpp förbi stängtröskeln stänger', () => {
        expect(nästaLäge('peek', PEEK + 81, 0, PEEK)).toBe('stängt');
    });
});
