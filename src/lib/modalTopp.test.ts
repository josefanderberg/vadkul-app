import { describe, expect, it } from 'vitest';
import { MODAL_TOPP_IOS, modalTopp } from './modalTopp';

describe('modalTopp', () => {
    it('iOS: kortarket börjar under statusraden - 24 pt som förut', () => {
        expect(modalTopp('ios', 59)).toBe(MODAL_TOPP_IOS);
        expect(modalTopp('ios', 0)).toBe(24);
    });
    it('Android: under den genomskinliga statusraden', () => {
        expect(modalTopp('android', 24)).toBe(40);
        expect(modalTopp('android', 48)).toBe(64);
    });
    it('Android utan inset (inget mätt än): bara luften', () => {
        expect(modalTopp('android', 0)).toBe(16);
        expect(modalTopp('android', -3)).toBe(16);
    });
});
