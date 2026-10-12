import { describe, expect, it } from 'vitest';
import {
    aktivaÖnskningar,
    önskansÅlder,
    önskningarNära,
    STADS_ÖNSKNINGAR_MAX,
    utgångsTid,
    ÖNSKE_LIVSLÄNGD_DAGAR,
    type Önskan,
} from './onskningar';

const DAG = 86_400_000;
const NU = Date.parse('2026-10-11T12:00:00Z');

const önskan = (over: Partial<Önskan>): Önskan => ({
    id: 'w1',
    title: 'Loppis i parken',
    category: 'market',
    description: '',
    lat: 59.33,
    lng: 18.06,
    uid: 'u1',
    hostName: 'Josef',
    createdAt: NU - DAG,
    expiresAt: NU + 6 * DAG,
    fulfilled: false,
    ...over,
});

describe('utgångsTid', () => {
    it('lever livslängden från skapandet', () => {
        expect(utgångsTid(NU)).toBe(NU + ÖNSKE_LIVSLÄNGD_DAGAR * DAG);
    });
});

describe('aktivaÖnskningar', () => {
    it('släpper igenom en färsk, ouppfylld önskan', () => {
        expect(aktivaÖnskningar([önskan({})], NU)).toHaveLength(1);
    });
    it('filtrerar uppfyllda, utgångna och titellösa', () => {
        expect(aktivaÖnskningar([önskan({ fulfilled: true })], NU)).toHaveLength(0);
        expect(aktivaÖnskningar([önskan({ expiresAt: NU - 1 })], NU)).toHaveLength(0);
        expect(aktivaÖnskningar([önskan({ title: '' })], NU)).toHaveLength(0);
    });
    it('createdAt-gränsen fäller gamla 14-dagars-önskningar trots sent expiresAt', () => {
        const gammal = önskan({ createdAt: NU - 10 * DAG, expiresAt: NU + 4 * DAG });
        expect(aktivaÖnskningar([gammal], NU)).toHaveLength(0);
    });
});

describe('önskningarNära (stadssidans "Önskas i X")', () => {
    const STHLM = { lat: 59.33, lng: 18.06 };
    it('inom radien, nyaste först, (0,0) räknas aldrig', () => {
        const gammal = önskan({ id: 'gammal', createdAt: NU - 3 * DAG });
        const ny = önskan({ id: 'ny', createdAt: NU - DAG / 2 });
        const uppsala = önskan({ id: 'uppsala', lat: 59.86, lng: 17.64 }); // ~65 km bort
        const utanPlats = önskan({ id: 'noll', lat: 0, lng: 0 });
        expect(önskningarNära([gammal, uppsala, ny, utanPlats], STHLM, 35).map(w => w.id)).toEqual(['ny', 'gammal']);
    });
    it('max sex', () => {
        const många = Array.from({ length: 9 }, (_, i) => önskan({ id: `w${i}`, createdAt: NU - i * 1000 }));
        expect(önskningarNära(många, STHLM, 35)).toHaveLength(STADS_ÖNSKNINGAR_MAX);
    });
});

describe('önskansÅlder', () => {
    it('idag / igår / för N dagar sedan', () => {
        expect(önskansÅlder(NU - 3_600_000, NU)).toBe('idag');
        expect(önskansÅlder(NU - DAG - 1, NU)).toBe('igår');
        expect(önskansÅlder(NU - 4 * DAG, NU)).toBe('för 4 dagar sedan');
    });
});
