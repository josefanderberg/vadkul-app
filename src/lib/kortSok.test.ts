import { describe, expect, it } from 'vitest';
import type { AppFeedEvent } from '@vadkul/kontrakt';
import { matcharKortSök } from './kortSok';

const ev = (title: string, locationName?: string): AppFeedEvent => ({
    id: 'https://example.se/x',
    title,
    time: '2026-10-10T18:00:00+02:00',
    hasSpecificTime: true,
    lat: 59,
    lng: 18,
    locationName,
    category: 'music',
});

describe('matcharKortSök', () => {
    it('tom term matchar allt', () => {
        expect(matcharKortSök(ev('Jazzkväll'), '')).toBe(true);
        expect(matcharKortSök(ev('Jazzkväll'), '   ')).toBe(true);
    });
    it('träffar i titeln, oavsett skiftläge', () => {
        expect(matcharKortSök(ev('Jazzkväll på Fasching'), 'jazz')).toBe(true);
        expect(matcharKortSök(ev('Jazzkväll'), 'FASCHING')).toBe(false);
    });
    it('träffar i platsen', () => {
        expect(matcharKortSök(ev('Konsert', 'Fasching'), 'fasching')).toBe(true);
        expect(matcharKortSök(ev('Konsert'), 'fasching')).toBe(false);
    });
    it('delsträng mitt i ordet räknas (webbens includes)', () => {
        expect(matcharKortSök(ev('Höstloppis'), 'loppis')).toBe(true);
    });
});
