import { describe, expect, it } from 'vitest';
import type { AppFeedEvent } from '@vadkul/kontrakt';
import { sokEvent } from './sok';

const ev = (id: string, title: string, locationName?: string, time = '2026-09-28T19:00:00.000Z'): AppFeedEvent => ({
    id,
    title,
    time,
    hasSpecificTime: true,
    lat: 0,
    lng: 0,
    locationName,
    category: 'music',
});

const EVENTS = [
    ev('a', 'Jazzkväll på slottet', 'Kulturhuset'),
    ev('b', 'Kväll med jazz', 'Slottsparken'),
    ev('c', 'Loppis', 'Jazzklubben'),
    ev('d', 'Konsert', 'Stora scenen'),
];

describe('sokEvent', () => {
    it('rankar titelprefix före titelträff före platsträff', () => {
        expect(sokEvent(EVENTS, 'jazz').map(e => e.id)).toEqual(['a', 'b', 'c']);
    });
    it('bryr sig inte om skiftläge och yttre blanksteg', () => {
        expect(sokEvent(EVENTS, '  JAZZ ').map(e => e.id)).toEqual(['a', 'b', 'c']);
    });
    it('tom fråga ger tom lista', () => {
        expect(sokEvent(EVENTS, '')).toEqual([]);
        expect(sokEvent(EVENTS, '   ')).toEqual([]);
    });
    it('sorterar lika viktiga träffar på tid', () => {
        const tidig = ev('e', 'Jazzfrukost', undefined, '2026-09-27T08:00:00.000Z');
        expect(sokEvent([...EVENTS, tidig], 'jazz').map(e => e.id)).toEqual(['e', 'a', 'b', 'c']);
    });
    it('respekterar maxantalet', () => {
        expect(sokEvent(EVENTS, 'jazz', 2)).toHaveLength(2);
    });
});
