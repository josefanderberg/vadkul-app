import { describe, expect, it } from 'vitest';
import type { AppFeedEvent } from '@vadkul/kontrakt';
import { byggBrickor } from './kartlager';

const ev = (id: string, h: number, extra: Partial<AppFeedEvent> = {}): AppFeedEvent => ({
    id,
    title: id,
    time: new Date(2026, 8, 29, h).toISOString(),
    hasSpecificTime: true,
    lat: 59.33,
    lng: 18.06,
    category: 'music',
    ...extra,
});

const NU = new Date(2026, 8, 29, 15).getTime();

describe('byggBrickor', () => {
    it('en bricka per plats med antal, representanten är första levande', () => {
        const fc = byggBrickor([ev('sen', 19), ev('förbi', 10), ev('tidig', 17), ev('annan', 18, { lat: 59.4 })], { nowMs: NU });
        expect(fc.features).toHaveLength(2);
        const grupp = fc.features.find(f => f.properties.antal === 3)!;
        expect(grupp.properties.id).toBe('tidig');
        expect(grupp.properties.past).toBe(false);
    });
    it('alla passerade → dimmad och lägst ritordning', () => {
        const fc = byggBrickor([ev('a', 9), ev('b', 10)], { nowMs: NU });
        expect(fc.features[0].properties).toMatchObject({ past: true, sort: 0, antal: 2 });
    });
    it('valt event blir representant med vald-variant överst', () => {
        const fc = byggBrickor([ev('a', 17), ev('b', 18, { category: 'art' })], { nowMs: NU, valtId: 'b' });
        expect(fc.features[0].properties).toMatchObject({ id: 'b', ikon: 'bricka-art-vald', sort: 4, label: 'Konst' });
    });
    it('Ticketmaster → guld, pop → tjock kant, sparad → vit kropp', () => {
        const tm = byggBrickor([ev('https://www.ticketmaster.se/event/1', 17, { category: 'stage' })], { nowMs: NU });
        expect(tm.features[0].properties.ikon).toBe('bricka-stage-guld');
        const pop = byggBrickor([ev('p', 17, { pop: true })], { nowMs: NU });
        expect(pop.features[0].properties.ikon).toBe('bricka-music-pop');
        const sparad = byggBrickor([ev('s', 17)], { nowMs: NU, ärSparad: id => id === 's' });
        expect(sparad.features[0].properties.ikon).toBe('bricka-music-sparad');
    });
});
