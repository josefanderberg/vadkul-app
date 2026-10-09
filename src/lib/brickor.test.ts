import { describe, expect, it } from 'vitest';
import { EVENT_CATEGORY_KEYS } from '@vadkul/kontrakt';
import { brickaIkon } from './brickor';
import { BRICKA_NYCKLAR } from './brickNycklar.generated';
import { isAffiliateUrl, isTicketmasterEvent } from './ticketmaster';

describe('brickaIkon', () => {
    it('vanlig bricka per kategori, okänd faller på other', () => {
        expect(brickaIkon({ category: 'music' })).toBe('bricka-music');
        expect(brickaIkon({ category: 'svenskakyrkan' })).toBe('bricka-other');
    });
    it('kant: vald > pop', () => {
        expect(brickaIkon({ category: 'art', pop: true })).toBe('bricka-art-pop');
        expect(brickaIkon({ category: 'art', pop: true, vald: true })).toBe('bricka-art-vald');
    });
    it('kropp: guld > sparad, och vald behåller kroppen', () => {
        expect(brickaIkon({ category: 'stage', guld: true, sparad: true, pop: true })).toBe('bricka-stage-guld');
        expect(brickaIkon({ category: 'stage', guld: true, vald: true })).toBe('bricka-stage-guld-vald');
        expect(brickaIkon({ category: 'food', sparad: true, vald: true })).toBe('bricka-food-sparad-vald');
    });
    it('eget VADKUL-event är grönt, sparad och guld går före', () => {
        expect(brickaIkon({ category: 'social', grön: true })).toBe('bricka-social-gron');
        expect(brickaIkon({ category: 'social', grön: true, vald: true, pop: true })).toBe('bricka-social-gron-vald');
        expect(brickaIkon({ category: 'social', grön: true, sparad: true })).toBe('bricka-social-sparad');
    });
    it('varje nyckel finns som bakad PNG', () => {
        const bakade = new Set(BRICKA_NYCKLAR);
        for (const category of EVENT_CATEGORY_KEYS) {
            for (const t of [{}, { pop: true }, { vald: true }, { sparad: true }, { sparad: true, vald: true }, { guld: true }, { guld: true, vald: true }, { grön: true }, { grön: true, vald: true }]) {
                expect(bakade.has(brickaIkon({ category, ...t }))).toBe(true);
            }
        }
    });
});

describe('ticketmaster', () => {
    it('känner igen TM på url eller id', () => {
        expect(isTicketmasterEvent({ id: 'https://www.ticketmaster.se/event/x' })).toBe(true);
        expect(isTicketmasterEvent({ id: 'https://x.se/a', url: 'https://ticketmaster.evyy.net/c/1' })).toBe(true);
        expect(isTicketmasterEvent({ id: 'https://www.tickster.com/x' })).toBe(false);
        expect(isTicketmasterEvent({ id: 'userdoc123' })).toBe(false);
    });
    it('bara redirecten är en affiliatelänk', () => {
        expect(isAffiliateUrl('https://ticketmaster.evyy.net/c/1')).toBe(true);
        expect(isAffiliateUrl('https://www.ticketmaster.se/event/x')).toBe(false);
    });
});
