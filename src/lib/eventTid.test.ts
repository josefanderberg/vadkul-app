import { describe, it, expect } from 'vitest';
import { formatEventTid } from './eventTid';

// Lokala ISO-strängar utan zon — tolkas i testmiljöns lokala tid, samma som
// new Date(...) i appen gör.
const NU = new Date(2026, 8, 25, 12, 0); // fre 25 sep 2026

describe('formatEventTid', () => {
    it('idag med klockslag', () => {
        expect(formatEventTid('2026-09-25T19:00:00', true, NU)).toBe('Idag · 19:00');
    });
    it('imorgon utan klockslag', () => {
        expect(formatEventTid('2026-09-26T00:00:00', false, NU)).toBe('Imorgon');
    });
    it('annan dag: veckodag + datum', () => {
        expect(formatEventTid('2026-09-27T14:30:00', true, NU)).toBe('sön 27 sep · 14:30');
    });
    it('nollutfyllda minuter och timmar', () => {
        expect(formatEventTid('2026-10-03T09:05:00', true, NU)).toBe('lör 3 okt · 09:05');
    });
    it('trasig tid ger tom sträng', () => {
        expect(formatEventTid('inte-en-tid', true, NU)).toBe('');
    });
});
