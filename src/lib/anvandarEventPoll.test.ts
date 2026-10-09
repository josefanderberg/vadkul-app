import { describe, expect, it } from 'vitest';
import { SÄKERHETSNÄT_MS, avgörAnvändarEventPoll, type PollLäge } from './anvandarEventPoll';

/** Stabilt utgångsläge: hämtat nyss, 53 event, proben håller med. */
const bas: PollLäge = {
    nuMs: 1_000_000,
    senasteHämtningMs: 1_000_000 - 30_000,
    senasteAntal: 53,
    probatAntal: 53,
};

describe('avgörAnvändarEventPoll', () => {
    it('hämtar allt första gången (inget hämtat än)', () => {
        expect(avgörAnvändarEventPoll({ ...bas, senasteHämtningMs: null, senasteAntal: null })).toBe('hämta');
    });

    it('hämtar allt även om bara antalet saknas', () => {
        expect(avgörAnvändarEventPoll({ ...bas, senasteAntal: null })).toBe('hämta');
    });

    it('hoppar över varvet när antalet står stilla', () => {
        expect(avgörAnvändarEventPoll(bas)).toBe('hoppa');
    });

    it('hämtar när ett event tillkommit eller tagits bort', () => {
        expect(avgörAnvändarEventPoll({ ...bas, probatAntal: 54 })).toBe('hämta');
        expect(avgörAnvändarEventPoll({ ...bas, probatAntal: 52 })).toBe('hämta');
    });

    it('hämtar när proben misslyckades - null är "vet inte", inte "noll"', () => {
        expect(avgörAnvändarEventPoll({ ...bas, probatAntal: null })).toBe('hämta');
    });

    it('skiljer misslyckad prob från en databas som faktiskt är tom', () => {
        expect(avgörAnvändarEventPoll({ ...bas, senasteAntal: 1, probatAntal: 0 })).toBe('hämta');
        expect(avgörAnvändarEventPoll({ ...bas, senasteAntal: 0, probatAntal: 0 })).toBe('hoppa');
    });

    it('säkerhetsnätet hämtar när tiden löpt ut trots oförändrat antal', () => {
        expect(avgörAnvändarEventPoll({ ...bas, senasteHämtningMs: bas.nuMs - SÄKERHETSNÄT_MS })).toBe('hämta');
    });

    it('säkerhetsnätet slår INTE till en tick för tidigt', () => {
        expect(avgörAnvändarEventPoll({ ...bas, senasteHämtningMs: bas.nuMs - SÄKERHETSNÄT_MS + 1 })).toBe('hoppa');
    });

    it('respekterar överstyrt nätintervall', () => {
        expect(avgörAnvändarEventPoll({ ...bas, senasteHämtningMs: bas.nuMs - 60_000, nätMs: 30_000 })).toBe('hämta');
        expect(avgörAnvändarEventPoll({ ...bas, senasteHämtningMs: bas.nuMs - 10_000, nätMs: 30_000 })).toBe('hoppa');
    });

    it('KOSTNADSKONTRAKTET: ett dygns stillastående pollar ger max nätets hämtningar', () => {
        // Ett dygn med 30 s-poll och oförändrat antal: alla varv utom
        // säkerhetsnätets ska bli 'hoppa'. Rött här = pollen är dyr igen.
        const POLL_MS = 30_000;
        const DYGN_MS = 24 * 60 * 60 * 1000;
        let senasteHämtningMs = 0;
        let hämtningar = 0;
        for (let t = POLL_MS; t <= DYGN_MS; t += POLL_MS) {
            const b = avgörAnvändarEventPoll({ nuMs: t, senasteHämtningMs, senasteAntal: 53, probatAntal: 53 });
            if (b === 'hämta') { hämtningar++; senasteHämtningMs = t; }
        }
        // 24 h / 15 min = 96 fulla hämtningar i stället för 2 880 pollar.
        expect(hämtningar).toBe(96);
    });
});
