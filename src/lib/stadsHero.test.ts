import { describe, expect, it } from 'vitest';
import { CITIES } from '@vadkul/kontrakt';
import type { AppEvent } from './appEvent';
import {
    HERO_BILD_B,
    HERO_BILD_H,
    HERO_STÄDER,
    heroBildUrl,
    heroSkala,
    stadsRadieKm,
    väljHeroMarkörer,
    världsPx,
} from './stadsHero';

const VÄXJÖ = HERO_STÄDER.vaxjo;
const NU = new Date(2026, 9, 13, 12, 0);

const ev = (id: string, lat: number, lng: number, timmar = 1): AppEvent => ({
    id,
    title: id,
    time: new Date(NU.getTime() + timmar * 3_600_000).toISOString(),
    hasSpecificTime: true,
    lat,
    lng,
    category: 'music',
});

describe('HERO_STÄDER (kopian av webbens cityPages)', () => {
    it('har webbens 71 stadssidor, alla finns i kontraktets stadslista', () => {
        const slugs = Object.keys(HERO_STÄDER);
        expect(slugs).toHaveLength(71);
        const kontrakt = new Set(CITIES.map(c => c.slug));
        expect(slugs.filter(s => !kontrakt.has(s))).toEqual([]);
    });
    it('koordinaterna ligger nära kontraktets (bildens mitt, inte en annan ort)', () => {
        for (const [slug, h] of Object.entries(HERO_STÄDER)) {
            const c = CITIES.find(x => x.slug === slug)!;
            expect(Math.abs(c.lat - h.lat) + Math.abs(c.lng - h.lng), slug).toBeLessThan(0.1);
        }
    });
});

describe('heroBildUrl + stadsRadieKm', () => {
    it('webbens förrenderade bild för stadssidorna, null för orter utan sida', () => {
        expect(heroBildUrl('vaxjo')).toBe('https://vadkul.se/kartbilder/vaxjo.webp');
        expect(heroBildUrl('molndal')).toBeNull();
    });
    it('35 km för städer, 20 för småorter och orter utan webbsida', () => {
        expect(stadsRadieKm('vaxjo')).toBe(35);
        expect(stadsRadieKm('varberg')).toBe(20);
        expect(stadsRadieKm('molndal')).toBe(20);
    });
});

describe('världsPx + heroSkala', () => {
    it('webbmercatorn: nollmeridianen/ekvatorn mitt i världen', () => {
        const p = världsPx(0, 0);
        expect(p.x).toBeCloseTo(256 * 2 ** 12 / 2);
        expect(p.y).toBeCloseTo(256 * 2 ** 12 / 2);
    });
    it('object-cover: den större kvoten', () => {
        expect(heroSkala(HERO_BILD_B, HERO_BILD_H)).toBe(1);
        expect(heroSkala(358, 250)).toBeCloseTo(250 / 318);
        expect(heroSkala(700, 200)).toBeCloseTo(700 / 630);
    });
});

describe('väljHeroMarkörer', () => {
    const ruta = { bredd: 358, höjd: 250, kant: 0 };

    it('stadens mitt hamnar mitt i heron', () => {
        const [m] = väljHeroMarkörer([ev('mitt', VÄXJÖ.lat, VÄXJÖ.lng)], VÄXJÖ, ruta);
        expect(m.x).toBeCloseTo(179);
        expect(m.y).toBeCloseTo(125);
    });

    it('en bricka per plats med antal, tidigaste eventet är ansiktet', () => {
        const sen = ev('sen', VÄXJÖ.lat, VÄXJÖ.lng, 5);
        const tidig = ev('tidig', VÄXJÖ.lat, VÄXJÖ.lng, 2);
        const m = väljHeroMarkörer([sen, tidig], VÄXJÖ, ruta);
        expect(m).toHaveLength(1);
        expect(m[0]).toMatchObject({ antal: 2 });
        expect(m[0].e.id).toBe('tidig');
    });

    it('gallrar brickor närmare än 40 bild-px - tidigast vinner', () => {
        // 1° lng ≈ 2913 bild-px vid zoom 12: 0,005° ≈ 15 px är för nära,
        // 0,03° ≈ 87 px får plats.
        const a = ev('a', VÄXJÖ.lat, VÄXJÖ.lng, 1);
        const b = ev('b', VÄXJÖ.lat, VÄXJÖ.lng + 0.005, 2);
        const c = ev('c', VÄXJÖ.lat, VÄXJÖ.lng + 0.03, 3);
        expect(väljHeroMarkörer([c, b, a], VÄXJÖ, ruta).map(m => m.e.id)).toEqual(['a', 'c']);
    });

    it('brickor utanför den beskurna bilden ritas inte', () => {
        const långtBort = ev('bort', VÄXJÖ.lat, VÄXJÖ.lng + 0.1, 1); // ~291 bild-px = 229 pt österut, heron är 179 pt bred åt varje håll
        expect(väljHeroMarkörer([långtBort], VÄXJÖ, ruta)).toEqual([]);
    });

    it('event utan plats hoppas över, tom ruta ger inga brickor', () => {
        expect(väljHeroMarkörer([ev('noll', 0, 0)], VÄXJÖ, ruta)).toEqual([]);
        expect(väljHeroMarkörer([ev('a', VÄXJÖ.lat, VÄXJÖ.lng)], VÄXJÖ, { bredd: 0, höjd: 0 })).toEqual([]);
    });

    it('taket', () => {
        const många = Array.from({ length: 10 }, (_, i) => ev(`e${i}`, VÄXJÖ.lat, VÄXJÖ.lng + (i - 5) * 0.02, i));
        expect(väljHeroMarkörer(många, VÄXJÖ, ruta, 3)).toHaveLength(3);
    });
});
