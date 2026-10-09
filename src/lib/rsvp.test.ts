import { describe, expect, it } from 'vitest';
import { eventShareSlug } from '@vadkul/kontrakt';
import { inbjudningsUrl, minRsvp, nextRsvp, RSVP_MAX, rsvpDeltan, rsvpShareId, TOM_RSVP, växlaRsvp } from './rsvp';

describe('nextRsvp (webbens övergångar)', () => {
    it('samma knapp togglar av', () => {
        expect(nextRsvp('going', 'going')).toBeNull();
        expect(nextRsvp('interested', 'interested')).toBeNull();
    });
    it('andra knappen byter', () => {
        expect(nextRsvp('going', 'interested')).toBe('interested');
        expect(nextRsvp('interested', 'going')).toBe('going');
    });
    it('inget svar → knappens svar', () => {
        expect(nextRsvp(null, 'going')).toBe('going');
    });
});

describe('växlaRsvp', () => {
    it('lägger till i rätt lista', () => {
        const l = växlaRsvp(TOM_RSVP, 'a', 'going');
        expect(l).toEqual({ going: ['a'], interested: [] });
        expect(minRsvp(l, 'a')).toBe('going');
    });
    it('samma knapp igen tar bort svaret', () => {
        const l = växlaRsvp(växlaRsvp(TOM_RSVP, 'a', 'going'), 'a', 'going');
        expect(minRsvp(l, 'a')).toBeNull();
        expect(l.going).toEqual([]);
    });
    it('byte flyttar eventet mellan listorna', () => {
        const l = växlaRsvp(växlaRsvp(TOM_RSVP, 'a', 'going'), 'a', 'interested');
        expect(l.going).toEqual([]);
        expect(l.interested).toEqual(['a']);
    });
    it('rör inte andra event', () => {
        const l = växlaRsvp(växlaRsvp(TOM_RSVP, 'a', 'going'), 'b', 'interested');
        expect(minRsvp(l, 'a')).toBe('going');
        expect(minRsvp(l, 'b')).toBe('interested');
    });
    it('muterar inte föregående tillstånd', () => {
        const först = växlaRsvp(TOM_RSVP, 'a', 'going');
        växlaRsvp(först, 'b', 'going');
        expect(först.going).toEqual(['a']);
        expect(TOM_RSVP).toEqual({ going: [], interested: [] });
    });
    it('äldsta svaret åker ut vid taket', () => {
        let l = TOM_RSVP;
        for (let i = 0; i <= RSVP_MAX; i++) l = växlaRsvp(l, `e${i}`, 'going');
        expect(l.going).toHaveLength(RSVP_MAX);
        expect(l.going[0]).toBe('e1');
        expect(l.going[RSVP_MAX - 1]).toBe(`e${RSVP_MAX}`);
    });
});

describe('rsvpDeltan (webbens rsvpCountDeltas)', () => {
    it('nytt svar ger +1 på svaret', () => {
        expect(rsvpDeltan(null, 'going')).toEqual({ going: 1, interested: 0 });
    });
    it('av-toggling ger -1', () => {
        expect(rsvpDeltan('interested', null)).toEqual({ going: 0, interested: -1 });
    });
    it('byte ger exakt -1/+1', () => {
        expect(rsvpDeltan('going', 'interested')).toEqual({ going: -1, interested: 1 });
    });
    it('oförändrat ger noll', () => {
        expect(rsvpDeltan('going', 'going')).toEqual({ going: 0, interested: 0 });
    });
});

describe('rsvpShareId', () => {
    it('serietillfälle svarar på seriens dokument', () => {
        expect(rsvpShareId('abc123__2026-10-09', true)).toBe('abc123');
    });
    it('skrapade event (URL med __) rörs inte', () => {
        expect(rsvpShareId('https://x.se/a__b', false)).toBe('https://x.se/a__b');
    });
});

describe('inbjudningsUrl', () => {
    it('bär avsändaren när den finns', () => {
        const slug = eventShareSlug('abc123');
        expect(inbjudningsUrl('abc123__2026-10-09', true, 'uid 1')).toBe(`https://vadkul.se/e/${slug}?inb=1&fran=uid%201`);
    });
    it('utan avsändare blir det bara ?inb=1', () => {
        const slug = eventShareSlug('https://x.se/e');
        expect(inbjudningsUrl('https://x.se/e', undefined, null)).toBe(`https://vadkul.se/e/${slug}?inb=1`);
    });
});
