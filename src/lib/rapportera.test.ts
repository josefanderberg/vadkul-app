import { describe, expect, it } from 'vitest';
import type { AppFeedEvent } from '@vadkul/kontrakt';
import { RAPPORT_MOTTAGARE, rapportBrödtext, rapportLänk, rapportMailto, rapportÄmne } from './rapportera';

const ev = (extra: Partial<AppFeedEvent> = {}): AppFeedEvent => ({
    id: 'https://exempel.se/event/123',
    title: 'Loppis i Hudiksvall',
    time: '2026-10-09T10:00:00.000Z',
    hasSpecificTime: true,
    lat: 61.7,
    lng: 17.1,
    locationName: 'Möljen',
    category: 'market',
    ...extra,
});

describe('rapportLänk', () => {
    it('använder id - käll-URL:en är primärnyckel', () => {
        expect(rapportLänk(ev())).toBe('https://exempel.se/event/123');
    });

    it('föredrar url när länken skrivits om', () => {
        expect(rapportLänk(ev({ url: 'https://affiliate.se/x' }))).toBe('https://affiliate.se/x');
    });
});

describe('rapportBrödtext', () => {
    it('tar med skäl, titel, tid, plats och länk', () => {
        const text = rapportBrödtext(ev(), 'Spam eller bedrägeri');
        expect(text).toContain('Skäl: Spam eller bedrägeri');
        expect(text).toContain('Loppis i Hudiksvall');
        expect(text).toContain('2026-10-09T10:00:00.000Z');
        expect(text).toContain('Möljen');
        expect(text).toContain('https://exempel.se/event/123');
    });

    it('hoppar över platsraden när platsen saknas', () => {
        expect(rapportBrödtext(ev({ locationName: undefined }), 'Något annat')).not.toContain('Plats:');
    });
});

describe('rapportMailto', () => {
    it('adresserar supportbrevlådan', () => {
        expect(rapportMailto(ev(), 'Något annat').startsWith(`mailto:${RAPPORT_MOTTAGARE}?`)).toBe(true);
    });

    it('url-kodar ämne och brödtext så mellanslag och å ä ö överlever', () => {
        const url = rapportMailto(ev(), 'Olämpligt eller stötande innehåll');
        expect(url).not.toMatch(/subject=[^&]* /);
        expect(url).toContain(encodeURIComponent(rapportÄmne(ev())));
        expect(url).toContain(encodeURIComponent('Olämpligt'));
    });
});
