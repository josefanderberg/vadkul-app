import { describe, expect, it } from 'vitest';
import type { AppFeedEvent } from '@vadkul/kontrakt';
import { rensaSparade, slåIhopSparade, SPARAD_KVAR_EFTER_MS, växlaSparad } from './sparade';

const ev = (id: string, time: string): AppFeedEvent => ({
    id, title: id, time, hasSpecificTime: true, lat: 0, lng: 0, category: 'music',
});

describe('växlaSparad', () => {
    it('lägger till i tidsordning och tar bort vid andra trycket', () => {
        const sen = ev('sen', '2026-10-05T18:00:00.000Z');
        const tidig = ev('tidig', '2026-10-01T18:00:00.000Z');
        const lista = växlaSparad(växlaSparad([], sen), tidig);
        expect(lista.map(e => e.id)).toEqual(['tidig', 'sen']);
        expect(växlaSparad(lista, sen).map(e => e.id)).toEqual(['tidig']);
    });
});

describe('rensaSparade', () => {
    it('slänger event som varit i mer än en vecka', () => {
        const t = new Date('2026-10-01T18:00:00.000Z').getTime();
        const lista = [ev('gammal', '2026-10-01T18:00:00.000Z'), ev('ny', '2026-10-20T18:00:00.000Z')];
        const slut = t + 60 * 60 * 1000;
        expect(rensaSparade(lista, slut + SPARAD_KVAR_EFTER_MS - 1).map(e => e.id)).toEqual(['gammal', 'ny']);
        expect(rensaSparade(lista, slut + SPARAD_KVAR_EFTER_MS).map(e => e.id)).toEqual(['ny']);
    });
});

describe('slåIhopSparade', () => {
    const e = (id: string, time: string, title = id): AppFeedEvent => ({
        id, title, time, hasSpecificTime: true, lat: 0, lng: 0, category: 'music',
    });
    it('lägger till nya i tidsordning', () => {
        const ut = slåIhopSparade([e('a', '2026-10-10T18:00:00Z')], [e('b', '2026-10-09T18:00:00Z')]);
        expect(ut.map(x => x.id)).toEqual(['b', 'a']);
    });
    it('befintliga behåller sin ögonblicksbild', () => {
        const ut = slåIhopSparade([e('a', '2026-10-10T18:00:00Z', 'lokal')], [e('a', '2026-10-10T18:00:00Z', 'server')]);
        expect(ut).toHaveLength(1);
        expect(ut[0].title).toBe('lokal');
    });
});
