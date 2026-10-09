import { describe, expect, it } from 'vitest';
import type { AppFeedEvent } from '@vadkul/kontrakt';
import { antalIkon, byggBrickor, kapaEtikett } from './kartlager';

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
    it('badgen är en bakad bild per antal, ingen för ensamma event', () => {
        expect(antalIkon(1)).toBe('');
        expect(antalIkon(2)).toBe('antal-2');
        expect(antalIkon(99)).toBe('antal-99');
        expect(antalIkon(140)).toBe('antal-99plus');
        const fc = byggBrickor([ev('a', 17), ev('b', 18), ev('c', 19)], { nowMs: NU });
        expect(fc.features[0].properties.antalIkon).toBe('antal-3');
    });
    it('etiketten bär representantens kapade titel', () => {
        const fc = byggBrickor([ev('x', 17, { title: 'Luleå Hockey/MSSK – Färjestad BK' })], { nowMs: NU });
        expect(fc.features[0].properties.titel).toBe('Luleå Hockey/MSSK…');
        expect(fc.features[0].properties.label).toBe('Musik');
    });
    it('populära får etikettplatsen före stora grupper, stora före små', () => {
        const fc = byggBrickor([
            ev('ensam', 17, { lat: 59.1 }),
            ev('g1', 17, { lat: 59.2 }), ev('g2', 18, { lat: 59.2 }), ev('g3', 19, { lat: 59.2 }),
            ev('pop', 17, { lat: 59.3, pop: true }),
        ], { nowMs: NU });
        const prio = (id: string) => fc.features.find(f => f.properties.id === id)!.properties.etikettPrio;
        expect(prio('pop')).toBeLessThan(prio('g1'));
        expect(prio('g1')).toBeLessThan(prio('ensam'));
    });
});

describe('kapaEtikett', () => {
    it('kapar efter 18 tecken utan att klyva emoji eller lämna blanksteg före …', () => {
        expect(kapaEtikett('Kort titel')).toBe('Kort titel');
        expect(kapaEtikett('Ölprovning på puben 🍺🍺')).toBe('Ölprovning på pube…');
        expect(kapaEtikett('Fest med 🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉 hela')).toBe('Fest med 🎉🎉🎉🎉🎉🎉🎉🎉🎉…');
        expect(kapaEtikett('Sjutton tecken ab  mer')).toBe('Sjutton tecken ab…');
    });
});
