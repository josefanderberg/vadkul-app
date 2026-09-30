import { describe, expect, it } from 'vitest';
import type { AppFeedEvent } from '@vadkul/kontrakt';
import { dagOffset, eventDagar, iBild, nästaIBild, nästaPeriodMedEvent, sammaPlats, type Ruta } from './vy';

const ev = (id: string, lat: number, lng: number, time = '2026-09-29T17:00:00.000Z'): AppFeedEvent => ({
    id, title: id, time, hasSpecificTime: true, lat, lng, category: 'music',
});

const RUTA: Ruta = [18.0, 59.3, 18.1, 59.4];

describe('iBild', () => {
    it('inom rutan syns, utanför inte, och utan ruta syns inget', () => {
        expect(iBild(59.35, 18.05, RUTA)).toBe(true);
        expect(iBild(59.45, 18.05, RUTA)).toBe(false);
        expect(iBild(59.35, 18.05, null)).toBe(false);
    });
    it('det kortet täcker räknas inte som i bild', () => {
        expect(iBild(59.301, 18.05, RUTA, 0.22)).toBe(false);
        expect(iBild(59.39, 18.05, RUTA, 0.22)).toBe(true);
    });
});

describe('sammaPlats', () => {
    it('grupperar på fyra decimaler och sorterar på tid', () => {
        const a = ev('a', 59.33001, 18.06001, '2026-09-29T19:00:00.000Z');
        const b = ev('b', 59.33002, 18.06002, '2026-09-29T17:00:00.000Z');
        const c = ev('c', 59.34, 18.06);
        expect(sammaPlats([a, b, c], a).map(e => e.id)).toEqual(['b', 'a']);
    });
});

describe('nästaIBild', () => {
    const ankare = ev('ankare', 59.33, 18.06);
    const nära = ev('nära', 59.331, 18.06);
    const längre = ev('längre', 59.34, 18.06);
    const sammaSomAnkare = ev('granne', 59.33, 18.06);
    it('går till närmaste obesökta och hoppar över hela platsen', () => {
        const pool = [ankare, sammaSomAnkare, längre, nära];
        const steg1 = nästaIBild(ankare, ankare, pool, new Set());
        expect(steg1.nästa?.id).toBe('nära');
        expect(steg1.besökta.has('granne')).toBe(true);
        const steg2 = nästaIBild(ankare, nära, pool, steg1.besökta);
        expect(steg2.nästa?.id).toBe('längre');
        const steg3 = nästaIBild(ankare, längre, pool, steg2.besökta);
        expect(steg3.nästa).toBeNull();
    });
});

describe('dagar', () => {
    const nu = new Date(2026, 8, 29, 12, 0);
    it('dagOffset räknar kalenderdagar', () => {
        expect(dagOffset(new Date(2026, 8, 29, 23, 0), nu)).toBe(0);
        expect(dagOffset(new Date(2026, 8, 30, 0, 30), nu)).toBe(1);
    });
    it('nästaPeriodMedEvent hoppar över tomma dagar och stegar hela veckor', () => {
        expect(nästaPeriodMedEvent([0, 3, 5], 0, 1)).toBe(3);
        expect(nästaPeriodMedEvent([0, 3], 3, 1)).toBeNull();
        expect(nästaPeriodMedEvent([2, 9], 0, 7)).toBe(7);
    });
    it('eventDagar: från visad dag, passerade bort, id skiljer lika tider', () => {
        const t = (d: number, h: number) => new Date(2026, 8, 29 + d, h).toISOString();
        const lista = [
            ev('z', 0, 0, t(1, 18)), ev('a', 0, 0, t(1, 18)), ev('igår', 0, 0, t(-1, 18)),
            ev('förbi', 0, 0, t(0, 9)), ev('ikväll', 0, 0, t(0, 19)),
        ];
        const dagar = eventDagar(lista, 0, nu, e => e.id === 'förbi');
        expect(dagar.map(d => [d.offset, d.events.map(e => e.id)])).toEqual([
            [0, ['ikväll']],
            [1, ['a', 'z']],
        ]);
        expect(eventDagar(lista, 1, nu, () => false).map(d => d.offset)).toEqual([1]);
    });
});
