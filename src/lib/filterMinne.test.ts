import { describe, expect, it } from 'vitest';
import { FILTER_TTL_DAGAR, läsKontoFilter, läsSparat, tillSparat } from './filterMinne';

const NU = Date.parse('2026-10-11T12:00:00Z');
const DAG = 86_400_000;

describe('tillSparat', () => {
    it('tom mängd rensar posten', () => {
        expect(tillSparat(new Set(), NU)).toBeNull();
    });
    it('bär nycklarna och stämpeln', () => {
        expect(tillSparat(new Set(['music', 'sport']), NU)).toEqual({ kategorier: ['music', 'sport'], sparadVid: NU });
    });
});

describe('läsSparat', () => {
    it('läser giltiga nycklar inom TTL', () => {
        expect(läsSparat({ kategorier: ['music', 'skräp', 'sport'], sparadVid: NU - DAG }, NU)).toEqual(['music', 'sport']);
    });
    it('utgången TTL ger tomt', () => {
        expect(läsSparat({ kategorier: ['music'], sparadVid: NU - (FILTER_TTL_DAGAR + 1) * DAG }, NU)).toEqual([]);
    });
    it('skräpformer ger tomt', () => {
        expect(läsSparat(null, NU)).toEqual([]);
        expect(läsSparat('music', NU)).toEqual([]);
        expect(läsSparat({ kategorier: 'music', sparadVid: NU }, NU)).toEqual([]);
        expect(läsSparat({ kategorier: ['music'] }, NU)).toEqual([]);
    });
});

describe('läsKontoFilter', () => {
    it('validerar nyckellistan', () => {
        expect(läsKontoFilter(['sport', 'nonsens', 42])).toEqual(['sport']);
        expect(läsKontoFilter(undefined)).toEqual([]);
    });
});
