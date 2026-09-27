import { describe, expect, it } from 'vitest';
import { descriptionText, eventOutlink, hostLabelFor, withRecoveredLineBreaks } from './eventDetalj';

describe('eventOutlink', () => {
    it('föredrar detaljsvarets url (affiliate-redirecten)', () => {
        expect(eventOutlink('https://kalla.se/x', 'https://redirect.se/y')).toBe('https://redirect.se/y');
    });
    it('faller tillbaka på id:t när det är en url', () => {
        expect(eventOutlink('https://kalla.se/x', undefined)).toBe('https://kalla.se/x');
        expect(eventOutlink('http://kalla.se/x', null)).toBe('http://kalla.se/x');
    });
    it('ger null när varken url eller id är http(s)', () => {
        expect(eventOutlink('user-doc-id', undefined)).toBeNull();
        expect(eventOutlink('user-doc-id', 'ftp://x')).toBeNull();
    });
});

describe('hostLabelFor', () => {
    it('föredrar hostName när det finns', () => {
        expect(hostLabelFor('Kulturhuset', 'https://example.se/x')).toBe('Kulturhuset');
    });
    it('faller tillbaka på domänen utan www-prefix', () => {
        expect(hostLabelFor('', 'https://www.svenskakyrkan.se/vaxjo/event')).toBe('svenskakyrkan.se');
        expect(hostLabelFor(undefined, 'http://m.example.com/a?b=c')).toBe('example.com');
    });
    it('namnger Facebook och Instagram', () => {
        expect(hostLabelFor(null, 'https://www.facebook.com/events/123')).toBe('Facebook');
        expect(hostLabelFor(null, 'https://instagram.com/p/abc')).toBe('Instagram');
    });
    it('ger Okänd utan användbar länk', () => {
        expect(hostLabelFor('', '')).toBe('Okänd');
        expect(hostLabelFor(null, 'inte-en-url')).toBe('Okänd');
        expect(hostLabelFor(null, undefined)).toBe('Okänd');
    });
});

describe('withRecoveredLineBreaks', () => {
    it('lämnar text med riktiga radbrytningar orörd', () => {
        const t = 'Rad ett.\nRad två.';
        expect(withRecoveredLineBreaks(t)).toBe(t);
    });
    it('bryter vid skiljetecken direkt följt av versal', () => {
        expect(withRecoveredLineBreaks('…intresseklubb.Tävlingsområde vid ån.')).toBe(
            '…intresseklubb.\nTävlingsområde vid ån.',
        );
    });
    it('bryter vid siffra direkt följd av versal', () => {
        expect(withRecoveredLineBreaks('Start 11:30Klasserna samlas')).toBe('Start 11:30\nKlasserna samlas');
    });
});

describe('descriptionText', () => {
    it('visar texten med återställda radbrytningar', () => {
        expect(descriptionText('Hej.Där', false)).toBe('Hej.\nDär');
    });
    it('visar hämtar-texten medan svaret väntas', () => {
        expect(descriptionText(undefined, true)).toBe('Hämtar beskrivning…');
        expect(descriptionText('   ', true)).toBe('Hämtar beskrivning…');
    });
    it('visar ingen beskrivning när inget finns', () => {
        expect(descriptionText(null, false)).toBe('Ingen beskrivning tillgänglig.');
    });
});
