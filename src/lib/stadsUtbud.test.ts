import { describe, expect, it } from 'vitest';
import type { AppFeedEvent, City } from '@vadkul/kontrakt';
import { grupperaPerDag, stadensEvent } from './stadsUtbud';

const STAD: City = { slug: 'lulea', name: 'Luleå', lat: 65.5848, lng: 22.1547, region: 'norrbotten' };
const NU = new Date(2026, 8, 27, 14, 0);

const ev = (id: string, lat: number, lng: number, time: Date): AppFeedEvent => ({
    id,
    title: id,
    time: time.toISOString(),
    hasSpecificTime: true,
    lat,
    lng,
    category: 'music',
});

describe('stadensEvent', () => {
    it('behåller event i orten och släpper länets ytterkanter', () => {
        const nära = ev('nära', 65.59, 22.16, NU);
        const kiruna = ev('kiruna', 67.8558, 20.2253, NU); // ~29 mil bort, samma län
        expect(stadensEvent([nära, kiruna], STAD).map(e => e.id)).toEqual(['nära']);
    });
});

describe('grupperaPerDag', () => {
    it('grupperar per dag med väljarens etiketter, tomma dagar hoppas', () => {
        const idag = ev('a', 65.59, 22.16, new Date(2026, 8, 27, 19, 0));
        const påMåndag = ev('b', 65.59, 22.16, new Date(2026, 8, 29, 18, 0));
        const sektioner = grupperaPerDag([påMåndag, idag], NU);
        expect(sektioner.map(s => s.label)).toEqual(['Idag', 'tis 29 sep']);
        expect(sektioner[0].data.map(e => e.id)).toEqual(['a']);
    });
    it('sorterar dagens event i tidsordning', () => {
        const sen = ev('sen', 65.59, 22.16, new Date(2026, 8, 27, 21, 0));
        const tidig = ev('tidig', 65.59, 22.16, new Date(2026, 8, 27, 15, 0));
        const [sektion] = grupperaPerDag([sen, tidig], NU);
        expect(sektion.data.map(e => e.id)).toEqual(['tidig', 'sen']);
    });
});
