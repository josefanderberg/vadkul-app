import { describe, expect, it } from 'vitest';
import { PERIODER, iPeriod, periodFras, periodOffsets, räknaIPeriod } from './stadsPeriod';

// Tisdag 13 oktober 2026, eftermiddag.
const TISDAG = new Date(2026, 9, 13, 14, 0);
const LÖRDAG = new Date(2026, 9, 17, 10, 0);
const SÖNDAG = new Date(2026, 9, 18, 10, 0);
const iso = (d: Date) => d.toISOString();

describe('PERIODER', () => {
    it('webbens fem chips i webbens ordning', () => {
        expect(PERIODER.map(p => p.label)).toEqual(['Alla', 'Idag', 'Imorgon', 'I helgen', 'I veckan']);
    });
});

describe('periodOffsets', () => {
    it('Alla = ingen dagbegränsning', () => {
        expect(periodOffsets('alla', TISDAG)).toBeNull();
    });
    it('Idag/Imorgon/I veckan', () => {
        expect(periodOffsets('idag', TISDAG)).toEqual([0]);
        expect(periodOffsets('imorgon', TISDAG)).toEqual([1]);
        expect(periodOffsets('veckan', TISDAG)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    });
    it('I helgen = nästa lör + sön; på lördag idag + imorgon, på söndag bara idag', () => {
        expect(periodOffsets('helgen', TISDAG)).toEqual([4, 5]);
        expect(periodOffsets('helgen', LÖRDAG)).toEqual([0, 1]);
        expect(periodOffsets('helgen', SÖNDAG)).toEqual([0]);
    });
});

describe('iPeriod', () => {
    it('går på startdagen, inte klockslaget', () => {
        const ikväll = iso(new Date(2026, 9, 13, 23, 30));
        const imorgonBitti = iso(new Date(2026, 9, 14, 0, 30));
        expect(iPeriod(ikväll, 'idag', TISDAG)).toBe(true);
        expect(iPeriod(imorgonBitti, 'idag', TISDAG)).toBe(false);
        expect(iPeriod(imorgonBitti, 'imorgon', TISDAG)).toBe(true);
    });
    it('helgen träffar lördag och söndag, inte fredag', () => {
        expect(iPeriod(iso(new Date(2026, 9, 16, 20, 0)), 'helgen', TISDAG)).toBe(false);
        expect(iPeriod(iso(new Date(2026, 9, 17, 12, 0)), 'helgen', TISDAG)).toBe(true);
        expect(iPeriod(iso(new Date(2026, 9, 18, 12, 0)), 'helgen', TISDAG)).toBe(true);
    });
    it('veckan slutar efter sex dagar framåt', () => {
        expect(iPeriod(iso(new Date(2026, 9, 19, 12, 0)), 'veckan', TISDAG)).toBe(true);
        expect(iPeriod(iso(new Date(2026, 9, 20, 12, 0)), 'veckan', TISDAG)).toBe(false);
    });
    it('Alla släpper igenom allt, ogiltig tid faller bara i Alla', () => {
        expect(iPeriod(iso(new Date(2026, 10, 30)), 'alla', TISDAG)).toBe(true);
        expect(iPeriod('trasig', 'idag', TISDAG)).toBe(false);
    });
});

describe('räknaIPeriod + periodFras', () => {
    it('räknar startdagar i perioden', () => {
        const ev = [new Date(2026, 9, 13, 18), new Date(2026, 9, 14, 18), new Date(2026, 9, 17, 18)].map(d => ({ time: iso(d) }));
        expect(räknaIPeriod(ev, 'idag', TISDAG)).toBe(1);
        expect(räknaIPeriod(ev, 'veckan', TISDAG)).toBe(3);
        expect(räknaIPeriod(ev, 'helgen', TISDAG)).toBe(1);
    });
    it('tomlägets fras (webbens unit, "just nu" för Alla)', () => {
        expect(periodFras('alla')).toBe('just nu');
        expect(periodFras('helgen')).toBe('i helgen');
    });
});
