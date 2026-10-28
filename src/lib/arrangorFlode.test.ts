import { describe, expect, it } from 'vitest';
import type { AppFeedEvent } from '@vadkul/kontrakt';
import { ARRANGÖR_STÄDER_MAX, arrangörUrFlöde } from './arrangorFlode';

// Stockholm och Göteborg - närmaste stad avgör hemorten.
const STHLM = { lat: 59.33, lng: 18.07 };
const GBG = { lat: 57.71, lng: 11.97 };

const ev = (id: string, over: Partial<AppFeedEvent> = {}): AppFeedEvent => ({
    id,
    title: id,
    time: '2026-11-10T18:00:00+01:00',
    hasSpecificTime: true,
    ...STHLM,
    category: 'music',
    ...over,
});

describe('arrangörUrFlöde', () => {
    const flöde = [
        ev('https://www.abf.se/kalender/2', { hostName: 'ABF Stockholm', time: '2026-11-12T18:00:00+01:00' }),
        ev('https://www.abf.se/kalender/1', { hostName: 'ABF Stockholm' }),
        ev('https://www.abf.se/kalender/3', { hostName: 'ABF Stockholm', ...GBG }),
        ev('https://annan.se/x', { hostName: 'Annan arrangör' }),
        ev('https://www.abf.se/kalender/utan-vard'),
    ];

    it('matchar flödets hostName med webbens slug-regel, i tidsordning', () => {
        const a = arrangörUrFlöde('abf-stockholm', flöde)!;
        expect(a.name).toBe('ABF Stockholm');
        expect(a.events.map(e => e.id)).toEqual([
            'https://www.abf.se/kalender/1',
            'https://www.abf.se/kalender/3',
            'https://www.abf.se/kalender/2',
        ]);
        expect(a.domains).toEqual(['abf.se']);
    });

    it('hemorterna är närmaste stad, vanligaste först', () => {
        const a = arrangörUrFlöde('abf-stockholm', flöde)!;
        expect(a.cities.map(c => c.slug)).toEqual(['stockholm', 'goteborg']);
    });

    it('domänen från kortets rad tar med event utan värdnamn', () => {
        const a = arrangörUrFlöde('abf-stockholm', flöde, { domän: 'abf.se' })!;
        expect(a.events).toHaveLength(4);
        expect(a.events.some(e => e.id.endsWith('utan-vard'))).toBe(true);
    });

    it('namnet från länken går före flödets', () => {
        expect(arrangörUrFlöde('abf-stockholm', flöde, { namn: '  ABF   Sthlm ' })!.name).toBe('ABF Sthlm');
    });

    it('inga event men ett namn = sidan med namnet och tom lista', () => {
        const a = arrangörUrFlöde('finns-inte', flöde, { namn: 'Någon' })!;
        expect(a.name).toBe('Någon');
        expect(a.events).toEqual([]);
        expect(a.cities).toEqual([]);
    });

    it('inga event och inget namn = null (okänd arrangör)', () => {
        expect(arrangörUrFlöde('finns-inte', flöde)).toBeNull();
    });

    it('opt-in-källor och plattformar får ingen sida även med värdnamn', () => {
        const kyrkan = [ev('https://www.svenskakyrkan.se/kalender?event=1', { hostName: 'Domkyrkoförsamlingen' })];
        expect(arrangörUrFlöde('domkyrkoforsamlingen', kyrkan)).toBeNull();
    });

    it(`högst ${ARRANGÖR_STÄDER_MAX} hemorter`, () => {
        const orter = [STHLM, GBG, { lat: 55.6, lng: 13.0 }, { lat: 58.41, lng: 15.62 }, { lat: 63.83, lng: 20.26 }];
        const många = orter.map((p, i) => ev(`https://abf.se/${i}`, { hostName: 'ABF', ...p }));
        expect(arrangörUrFlöde('abf', många)!.cities).toHaveLength(ARRANGÖR_STÄDER_MAX);
    });
});
