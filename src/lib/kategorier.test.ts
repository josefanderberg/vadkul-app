import { describe, expect, it } from 'vitest';
import { EVENT_CATEGORY_KEYS } from '@vadkul/kontrakt';
import { KATEGORIER, kategoriFor } from './kategorier';

describe('kategoriFor', () => {
    it('har en presentation för varje kontraktsnyckel', () => {
        for (const key of EVENT_CATEGORY_KEYS) {
            const k = kategoriFor(key);
            expect(k.label.length).toBeGreaterThan(0);
            expect(k.kort.length).toBeGreaterThan(0);
            expect(k.emoji.length).toBeGreaterThan(0);
            expect(k.hex).toMatch(/^#[0-9a-f]{6}$/i);
        }
    });
    it('känner opt-in-källorna', () => {
        expect(kategoriFor('svenskakyrkan').label).toBe('Svenska kyrkan');
        expect(kategoriFor('pro').label).toBe('PRO');
    });
    it('faller på Övrigt för okända nycklar', () => {
        expect(kategoriFor('påhittat')).toBe(KATEGORIER.other);
    });
});
