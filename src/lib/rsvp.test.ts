import { describe, expect, it } from 'vitest';
import { minRsvp, nextRsvp, RSVP_MAX, TOM_RSVP, växlaRsvp } from './rsvp';

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
