import { describe, expect, it } from 'vitest';
import { formatKm } from './flerEvent';

describe('formatKm', () => {
    it('en decimal med kommatecken under 10 km, heltal över', () => {
        expect(formatKm(1.23)).toBe('1,2 km');
        expect(formatKm(13.4)).toBe('13 km');
    });
});
