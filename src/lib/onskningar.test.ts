import { describe, expect, it } from 'vitest';
import { aktivaÖnskningar, utgångsTid, ÖNSKE_LIVSLÄNGD_DAGAR, type Önskan } from './onskningar';

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
