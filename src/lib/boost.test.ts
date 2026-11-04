import { describe, expect, it } from 'vitest';
import { boostadeFörst, boostadeRader, boostSlut, INGA_BOOSTAR, ärBoostad } from './boost';

const NU = Date.parse('2026-11-04T12:00:00Z');
const SEN = '2026-11-10T00:00:00Z';
const FÖRBI = '2026-11-01T00:00:00Z';

const ev = (id: string, time: string, featuredUntil?: string) => ({ id, time, featuredUntil });

describe('boostSlut / ärBoostad', () => {
    it('eget event: featuredUntil på dokumentet', () => {
        expect(ärBoostad(ev('a', SEN, SEN), INGA_BOOSTAR, NU)).toBe(true);
        expect(ärBoostad(ev('a', SEN, FÖRBI), INGA_BOOSTAR, NU)).toBe(false);
        expect(boostSlut(ev('a', SEN, SEN), INGA_BOOSTAR)).toBe(Date.parse(SEN));
    });
    it('skrapat event: overlayn eventBoosts (eventId = appens id)', () => {
        const boostar = new Map([['https://x.se/e/1', Date.parse(SEN)], ['https://x.se/e/2', Date.parse(FÖRBI)]]);
        expect(ärBoostad(ev('https://x.se/e/1', SEN), boostar, NU)).toBe(true);
        expect(ärBoostad(ev('https://x.se/e/2', SEN), boostar, NU)).toBe(false);
        expect(ärBoostad(ev('https://x.se/e/3', SEN), boostar, NU)).toBe(false);
        expect(boostSlut(ev('https://x.se/e/3', SEN), boostar)).toBeNull();
    });
    it('eventets eget fält vinner över overlayn', () => {
        const boostar = new Map([['a', Date.parse(FÖRBI)]]);
        expect(ärBoostad(ev('a', SEN, SEN), boostar, NU)).toBe(true);
    });
});

describe('boostadeFörst', () => {
    it('lyfter de boostade först och behåller ordningen i övrigt', () => {
        const rader = [ev('a', SEN), ev('b', SEN, SEN), ev('c', SEN), ev('d', SEN, SEN)];
        expect(boostadeFörst(rader, INGA_BOOSTAR, NU).map(e => e.id)).toEqual(['b', 'd', 'a', 'c']);
    });
});

describe('boostadeRader', () => {
    it('de aktivt boostade som inte varit, i tidsordning, oavsett dag', () => {
        const boostar = new Map([['s', Date.parse(SEN)]]);
        const rader = [
            ev('senare', '2026-11-12T18:00:00Z', SEN),
            ev('vanlig', '2026-11-05T18:00:00Z'),
            ev('s', '2026-11-05T19:00:00Z'),
            ev('gammal', '2026-11-03T18:00:00Z', SEN),
            ev('valt', '2026-11-06T18:00:00Z', SEN),
        ];
        const harVarit = (e: { id: string; time: string }) => Date.parse(e.time) < NU || e.id === 'valt';
        expect(boostadeRader(rader, boostar, NU, harVarit).map(e => e.id)).toEqual(['s', 'senare']);
    });
});
