import { describe, expect, it } from 'vitest';
import { läsListLäge, läsPeriod, löpnummer, raderAttRendera, returParametrar } from './listRetur';

const sek = [
    { data: [{ id: 'a' }, { id: 'b' }] },
    { data: [{ id: 'c' }] },
    { data: [{ id: 'd' }, { id: 'e' }, { id: 'f' }] },
];

describe('listRetur', () => {
    it('parametrarna går fram och tillbaka', () => {
        const p = returParametrar({ y: 1234.6, id: 'ev1' });
        expect(p).toEqual({ y: '1235', id: 'ev1' });
        expect(läsListLäge(p)).toEqual({ y: 1235, id: 'ev1' });
        expect(returParametrar({ y: -5, id: null })).toEqual({ y: '0' });
    });

    it('utan y är skärmen ingen retur', () => {
        expect(läsListLäge({})).toBeNull();
        expect(läsListLäge({ y: '' })).toBeNull();
        expect(läsListLäge({ y: 'abc' })).toBeNull();
        expect(läsListLäge({ y: ['40'], id: ['x'] })).toEqual({ y: 40, id: 'x' });
    });

    it('perioden: kända värden, annars alla', () => {
        expect(läsPeriod('helgen')).toBe('helgen');
        expect(läsPeriod('igår')).toBe('alla');
        expect(läsPeriod(undefined)).toBe('alla');
    });

    it('löpnumret räknas över sektionerna', () => {
        expect(löpnummer(sek, 'a')).toBe(0);
        expect(löpnummer(sek, 'c')).toBe(2);
        expect(löpnummer(sek, 'f')).toBe(5);
        expect(löpnummer(sek, 'saknas')).toBe(-1);
    });

    it('listan renderar förbi eventet, och minst sitt vanliga antal', () => {
        expect(raderAttRendera(sek, null)).toBe(10);
        expect(raderAttRendera(sek, { y: 0, id: 'f' })).toBe(20);
        const många = [{ data: Array.from({ length: 100 }, (_, i) => ({ id: `e${i}` })) }];
        expect(raderAttRendera(många, { y: 5000, id: 'e60' })).toBe(75);
        // Okänt event: grovt på y.
        expect(raderAttRendera(många, { y: 8000, id: 'borta' })).toBe(115);
    });
});
