import { describe, expect, it } from 'vitest';
import type { AppFeedEvent } from '@vadkul/kontrakt';
import { flerEventKandidater, flerEventLista, formatKm } from './flerEvent';

const ev = (id: string, lat: number, lng: number, pop?: true, time = '2026-09-28T19:00:00.000Z'): AppFeedEvent => ({
    id,
    title: id,
    time,
    hasSpecificTime: true,
    lat,
    lng,
    category: 'music',
    ...(pop ? { pop } : {}),
});

const VALT = ev('valt', 65.5848, 22.1547);
const NÄRA = ev('nära', 65.59, 22.16);
const NÄRA_POP = ev('nära-pop', 65.60, 22.17, true);
const LÅNGT = ev('långt', 66.5, 23.5, true);

describe('flerEventKandidater', () => {
    it('utesluter det öppna eventet', () => {
        expect(flerEventKandidater([VALT, NÄRA], 'valt', 'månaden').map(e => e.id)).toEqual(['nära']);
    });
    it('populärt-läget släpper bara igenom pop-flaggade', () => {
        expect(flerEventKandidater([VALT, NÄRA, NÄRA_POP, LÅNGT], 'valt', 'populärt').map(e => e.id))
            .toEqual(['nära-pop', 'långt']);
    });
});

describe('flerEventLista', () => {
    it('sorterar närmast först med avstånd i km', () => {
        const lista = flerEventLista([VALT, LÅNGT, NÄRA_POP, NÄRA], VALT, 'månaden');
        expect(lista.map(r => r.event.id)).toEqual(['nära', 'nära-pop', 'långt']);
        expect(lista[0].km).toBeGreaterThan(0);
        expect(lista[0].km).toBeLessThan(lista[2].km);
    });
    it('lika nära avgörs på tid', () => {
        const tidig = ev('tidig', 65.59, 22.16, undefined, '2026-09-27T10:00:00.000Z');
        const lista = flerEventLista([VALT, NÄRA, tidig], VALT, 'månaden');
        expect(lista.map(r => r.event.id)).toEqual(['tidig', 'nära']);
    });
    it('respekterar maxantalet', () => {
        expect(flerEventLista([VALT, NÄRA, NÄRA_POP, LÅNGT], VALT, 'månaden', 2)).toHaveLength(2);
    });
});

describe('formatKm', () => {
    it('en decimal med kommatecken under 10 km, heltal över', () => {
        expect(formatKm(1.23)).toBe('1,2 km');
        expect(formatKm(13.4)).toBe('13 km');
    });
});
