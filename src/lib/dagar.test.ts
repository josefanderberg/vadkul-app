import { describe, expect, it } from 'vitest';
import { dagKey, eventPåDag, kommandeDagar } from './dagar';

const NU = new Date(2026, 8, 27, 14, 0); // lör 27 sep 2026, lokal tid

describe('dagKey', () => {
    it('ger lokal YYYY-MM-DD, inte UTC', () => {
        expect(dagKey(new Date(2026, 8, 27, 0, 30))).toBe('2026-09-27');
        expect(dagKey(new Date(2026, 8, 27, 23, 30))).toBe('2026-09-27');
    });
});

describe('kommandeDagar', () => {
    it('börjar med Idag och Imorgon, sen veckodag', () => {
        const dagar = kommandeDagar(4, NU);
        expect(dagar[0]).toEqual({ key: '2026-09-27', label: 'Idag' });
        expect(dagar[1]).toEqual({ key: '2026-09-28', label: 'Imorgon' });
        expect(dagar[2]).toEqual({ key: '2026-09-29', label: 'tis 29 sep' });
        expect(dagar).toHaveLength(4);
    });
    it('kliver över månadsskiften', () => {
        const dagar = kommandeDagar(5, NU);
        expect(dagar[4].key).toBe('2026-10-01');
        expect(dagar[4].label).toBe('tors 1 okt');
    });
});

describe('eventPåDag', () => {
    it('matchar på lokal startdag', () => {
        const iso = new Date(2026, 8, 28, 19, 0).toISOString();
        expect(eventPåDag(iso, '2026-09-28')).toBe(true);
        expect(eventPåDag(iso, '2026-09-27')).toBe(false);
    });
    it('tål trasiga tider', () => {
        expect(eventPåDag('inte-en-tid', '2026-09-27')).toBe(false);
    });
});
