import { describe, expect, it } from 'vitest';
import type { AppFeedEvent } from '@vadkul/kontrakt';
import { ARRANGÖRSRAD_MAX, arrangörsRad, källDomän } from './arrangorsRad';

const NU = new Date('2026-10-07T12:00:00+02:00').getTime();

const ev = (id: string, time = '2026-10-10T18:00:00+02:00'): AppFeedEvent => ({
    id,
    title: id,
    time,
    hasSpecificTime: true,
    lat: 59,
    lng: 18,
    category: 'music',
});

describe('källDomän', () => {
    it('plockar domänen utan www/m/mobile', () => {
        expect(källDomän('https://www.abf.se/kalender/x')).toBe('abf.se');
        expect(källDomän('http://m.facebook.com/events/1')).toBe('facebook.com');
    });
    it('null för icke-URL:er', () => {
        expect(källDomän('anvandarskapat-doc-id')).toBeNull();
        expect(källDomän(null)).toBeNull();
    });
});

describe('arrangörsRad', () => {
    const valt = ev('https://visitlinkoping.se/ev/1');
    const flöde = [
        valt,
        ev('https://visitlinkoping.se/ev/2', '2026-10-12T18:00:00+02:00'),
        ev('https://visitlinkoping.se/ev/3', '2026-10-08T18:00:00+02:00'),
        ev('https://annan.se/ev/1'),
    ];

    it('samma källdomän, tidsordning, utan det valda', () => {
        const rad = arrangörsRad(valt, 'Visit Linköping', flöde, NU);
        expect(rad?.rader.map(e => e.id)).toEqual([
            'https://visitlinkoping.se/ev/3',
            'https://visitlinkoping.se/ev/2',
        ]);
        expect(rad?.namn).toBe('Visit Linköping');
        expect(rad?.slug).toBe('visit-linkoping');
    });
    it('utan värdnamn: domänen som namn, ingen slug', () => {
        const rad = arrangörsRad(valt, null, flöde, NU);
        expect(rad?.namn).toBe('visitlinkoping.se');
        expect(rad?.slug).toBeNull();
    });
    it('passerade event räknas bort', () => {
        const rad = arrangörsRad(valt, null, [valt, ev('https://visitlinkoping.se/ev/g', '2026-10-06T18:00:00+02:00')], NU);
        expect(rad).toBeNull();
    });
    it('null för biljettplattformar och FB/IG - domänen är inte arrangören', () => {
        const tm = ev('https://www.ticketmaster.se/event/1');
        expect(arrangörsRad(tm, 'Scen AB', [tm, ev('https://www.ticketmaster.se/event/2')], NU)).toBeNull();
        const fb = ev('https://www.facebook.com/events/1');
        expect(arrangörsRad(fb, null, [fb, ev('https://www.facebook.com/events/2')], NU)).toBeNull();
    });
    it('null för opt-in-källorna (kyrkan/PRO/Korpen)', () => {
        const kyrkan = ev('https://www.svenskakyrkan.se/x/1');
        expect(arrangörsRad(kyrkan, null, [kyrkan, ev('https://www.svenskakyrkan.se/x/2')], NU)).toBeNull();
    });
    it('max 12 rader', () => {
        const många = [valt, ...Array.from({ length: 20 }, (_, i) => ev(`https://visitlinkoping.se/ev/n${i}`))];
        const rad = arrangörsRad(valt, null, många, NU);
        expect(rad?.rader).toHaveLength(ARRANGÖRSRAD_MAX);
    });
    it('null när flödet inte har fler från arrangören', () => {
        expect(arrangörsRad(valt, 'Visit Linköping', [valt, ev('https://annan.se/ev/2')], NU)).toBeNull();
    });
});
