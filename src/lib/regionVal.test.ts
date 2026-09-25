import { describe, it, expect } from 'vitest';
import { nearestCity, regionFor, DEFAULT_CITY } from './regionVal';

describe('regionVal', () => {
    it('positioner i städerna ger stadens region', () => {
        expect(regionFor(59.3293, 18.0686)).toBe('stockholm');
        expect(regionFor(55.6049, 13.0038)).toBe('skane');
        expect(regionFor(63.8258, 20.263)).toBe('vasterbotten');
    });

    it('landsbygd hör till närmaste stadens region — utan radietak (Kiruna → norrbotten)', () => {
        expect(regionFor(67.8558, 20.2253)).toBe('norrbotten');
    });

    it('nearestCity ger en riktig stad ur kontraktslistan', () => {
        expect(nearestCity(57.7, 11.97).slug).toBe('goteborg');
    });

    it('startstaden är Stockholm', () => {
        expect(DEFAULT_CITY.slug).toBe('stockholm');
    });
});
