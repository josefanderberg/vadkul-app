import { describe, expect, it } from 'vitest';
import type { AppEvent } from './appEvent';
import { minaEventRader } from './minaEvent';

/** Fast "nu" så testerna aldrig blir tidsbomber (webbens myEventRows.test). */
const NU = Date.parse('2026-09-14T12:00:00.000Z');

const evt = (id: string, tidIso: string, över: Partial<AppEvent> = {}): AppEvent => ({
    id,
    docId: id.split('__')[0],
    title: id,
    time: tidIso,
    hasSpecificTime: true,
    lat: 59,
    lng: 17,
    locationName: 'Testorten',
    category: 'social',
    userCreated: true,
    hostName: 'Test',
    ...över,
} as AppEvent);

/** Ett utvecklat serietillfälle som vecklaUtSerie bygger dem (docId = basen). */
const tillf = (basId: string, tidIso: string, över: Partial<AppEvent> = {}) =>
    evt(`${basId}__${tidIso.slice(0, 10)}`, tidIso, { repeatWeekly: true, ...över });

describe('minaEventRader - serier', () => {
    it('en serie blir EN rad - nästa kommande tillfälle representerar', () => {
        const ut = minaEventRader([
            tillf('fre', '2026-09-18T15:00:00.000Z'),
            tillf('fre', '2026-09-25T15:00:00.000Z'),
            tillf('fre', '2026-10-02T15:00:00.000Z'),
        ], NU);
        expect(ut).toHaveLength(1);
        expect(ut[0].evt.id).toBe('fre__2026-09-18');
        expect(ut[0].docIds).toEqual(['fre']);
        expect(ut[0].tag).toBe('Varje vecka');
        expect(ut[0].count).toBe(3);
    });

    it('redan passerade tillfällen väljs inte som representant', () => {
        const ut = minaEventRader([
            tillf('fre', '2026-09-11T15:00:00.000Z'),
            tillf('fre', '2026-09-18T15:00:00.000Z'),
        ], NU);
        expect(ut[0].evt.id).toBe('fre__2026-09-18');
    });

    it('en helt passerad serie representeras av sitt SENASTE tillfälle', () => {
        const ut = minaEventRader([
            tillf('gammal', '2026-08-07T15:00:00.000Z'),
            tillf('gammal', '2026-08-14T15:00:00.000Z'),
        ], NU);
        expect(ut[0].evt.id).toBe('gammal__2026-08-14');
    });

    it('varannan vecka och dagsserie syns på chippet', () => {
        const varannan = minaEventRader([
            tillf('lor', '2026-09-19T15:00:00.000Z', { repeatIntervalWeeks: 2 }),
        ], NU);
        expect(varannan[0].tag).toBe('Varannan vecka');
        const dagar = minaEventRader([
            evt('mark__2026-09-19', '2026-09-19T10:00:00.000Z', { repeatDays: 2 }),
        ], NU);
        expect(dagar[0].tag).toBe('2 dagar');
    });
});

describe('minaEventRader - samma event inlagt flera gånger (Stobirk)', () => {
    const stobirk = (id: string, tidIso: string) =>
        evt(id, tidIso, {
            title: 'Destilleribesök på Stobirk',
            locationName: 'Stobirk Spirits, Åkers Krutbruk',
            url: 'https://stobirk.se',
            isTip: true,
        });

    it('slås ihop till EN rad med antal tillfällen och alla dokument-id', () => {
        const ut = minaEventRader([
            stobirk('a', '2026-09-19T15:00:00.000Z'),
            stobirk('c', '2026-10-17T11:00:00.000Z'),
            stobirk('b', '2026-10-03T11:00:00.000Z'),
            stobirk('d', '2026-11-14T12:00:00.000Z'),
        ], NU);
        expect(ut).toHaveLength(1);
        expect(ut[0].evt.id).toBe('a'); // nästa kommande
        expect(ut[0].count).toBe(4);
        expect(ut[0].tag).toBe('4 tillfällen');
        expect(ut[0].docIds).toEqual(['a', 'b', 'c', 'd']); // i tidsordning
    });

    it('samma titel på OLIKA platser är olika event', () => {
        const ut = minaEventRader([
            evt('x', '2026-09-19T15:00:00.000Z', { title: 'Loppis', locationName: 'Åkers Krutbruk' }),
            evt('y', '2026-09-20T15:00:00.000Z', { title: 'Loppis', locationName: 'Strängnäs' }),
        ], NU);
        expect(ut).toHaveLength(2);
    });

    it('titel-/platsmatchningen struntar i skiftläge och extra blanksteg', () => {
        const ut = minaEventRader([
            evt('x', '2026-09-19T15:00:00.000Z', { title: 'Höstloppis  i  Arboga', locationName: 'Torget' }),
            evt('y', '2026-09-26T15:00:00.000Z', { title: 'höstloppis i arboga', locationName: ' Torget ' }),
        ], NU);
        expect(ut).toHaveLength(1);
        expect(ut[0].count).toBe(2);
    });

    it('utan platsnamn faller nyckeln tillbaka på koordinaten', () => {
        const ut = minaEventRader([
            evt('x', '2026-09-19T15:00:00.000Z', { title: 'Grillkväll', locationName: undefined }),
            evt('y', '2026-09-26T15:00:00.000Z', { title: 'Grillkväll', locationName: undefined, lat: 60, lng: 17 }),
        ], NU);
        expect(ut).toHaveLength(2);
    });
});

describe('minaEventRader - vanliga event', () => {
    it('engångsevent passerar orörda, utan chip, i tidsordning', () => {
        const ut = minaEventRader([
            tillf('lor', '2026-09-19T16:00:00.000Z'),
            evt('engangs', '2026-09-17T18:00:00.000Z'),
            tillf('lor', '2026-09-26T16:00:00.000Z'),
            tillf('fre', '2026-09-18T15:00:00.000Z'),
        ], NU);
        expect(ut.map(r => r.evt.id)).toEqual(['engangs', 'fre__2026-09-18', 'lor__2026-09-19']);
        expect(ut[0].tag).toBeUndefined();
        expect(ut[0].count).toBe(1);
        expect(ut[0].docIds).toEqual(['engangs']);
    });

    it('tom lista ger tom lista', () => {
        expect(minaEventRader([], NU)).toEqual([]);
    });
});
