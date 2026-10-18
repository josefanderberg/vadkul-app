import { describe, expect, it } from 'vitest';
import { delaIRingar, närmastUtanför, utzoomning, ZOOM_UT_GOLV } from './listZoom';
import type { Ruta } from './vy';

const dag = (offset: number, ...ids: string[]) => ({ offset, events: ids.map(id => ({ id })) });
const ids = (d: { events: { id: string }[] }) => d.events.map(e => e.id);

describe('delaIRingar', () => {
    it('utan ringar är allt ring 0 i dagordning', () => {
        const ut = delaIRingar([dag(2, 'a'), dag(3, 'b')], []);
        expect(ut.map(d => ({ offset: d.offset, ring: d.ring }))).toEqual([
            { offset: 2, ring: 0 },
            { offset: 3, ring: 0 },
        ]);
    });

    it('okända id:n hamnar i den yttersta ringen, från första dagen igen', () => {
        const ringar = [new Set(['a', 'b'])];
        const ut = delaIRingar([dag(2, 'a', 'ny1'), dag(3, 'b'), dag(4, 'ny2')], ringar);
        expect(ut.map(d => ({ offset: d.offset, ring: d.ring, ids: ids(d) }))).toEqual([
            { offset: 2, ring: 0, ids: ['a'] },
            { offset: 3, ring: 0, ids: ['b'] },
            { offset: 2, ring: 1, ids: ['ny1'] },
            { offset: 4, ring: 1, ids: ['ny2'] },
        ]);
    });

    it('ett event hör till den FÖRSTA ringen som kände det', () => {
        const ringar = [new Set(['a']), new Set(['a', 'b'])];
        const ut = delaIRingar([dag(1, 'a', 'b', 'c')], ringar);
        expect(ut.map(d => ({ ring: d.ring, ids: ids(d) }))).toEqual([
            { ring: 0, ids: ['a'] },
            { ring: 1, ids: ['b'] },
            { ring: 2, ids: ['c'] },
        ]);
    });

    it('en utzoomning som inte gav något nytt lämnar ingen tom ring', () => {
        const ringar = [new Set(['a'])];
        const ut = delaIRingar([dag(1, 'a')], ringar);
        expect(ut).toHaveLength(1);
        expect(ut[0].ring).toBe(0);
    });
});

describe('närmastUtanför', () => {
    const ruta: Ruta = [14, 56, 16, 58];
    const mitt = { lat: 57, lng: 15 };

    it('hoppar över event inne i rutan och tar närmaste utanför', () => {
        const inne = { id: 'inne', lat: 57, lng: 15.5 };
        const nära = { id: 'nära', lat: 58.2, lng: 15 };
        const långt = { id: 'långt', lat: 60, lng: 15 };
        expect(närmastUtanför([inne, långt, nära], ruta, mitt)?.lat).toBe(58.2);
    });

    it('respekterar filtret och nollade koordinater', () => {
        const a = { id: 'a', lat: 58.2, lng: 15, pop: false };
        const noll = { id: 'noll', lat: 0, lng: 0, pop: true };
        expect(närmastUtanför([a, noll], ruta, mitt, e => e.pop)).toBeNull();
    });
});

describe('utzoomning', () => {
    const ruta: Ruta = [14, 56, 16, 58];

    it('tar minst ett steg ut även utan mål', () => {
        expect(utzoomning(ruta, 11, null)).toBe(10);
    });

    it('zoomar längre när målet ligger långt utanför', () => {
        // Målet ~3 rutbredder åt öster kräver mer än ett steg.
        const ny = utzoomning(ruta, 11, { lat: 57, lng: 21 });
        expect(ny).not.toBeNull();
        expect(ny!).toBeLessThan(9);
    });

    it('söderut krävs mer än norrut - kortet täcker nedtill', () => {
        const norr = utzoomning(ruta, 11, { lat: 59, lng: 15 })!;
        const söder = utzoomning(ruta, 11, { lat: 55, lng: 15 })!;
        expect(söder).toBeLessThan(norr);
    });

    it('stannar på golvet och vägrar under det', () => {
        expect(utzoomning(ruta, ZOOM_UT_GOLV + 0.5, { lat: 50, lng: 30 })).toBe(ZOOM_UT_GOLV);
        expect(utzoomning(ruta, ZOOM_UT_GOLV, null)).toBeNull();
    });
});
