import { describe, expect, it } from 'vitest';
import { STARTSTAD_MAX_ÅLDER_MS, stadsbyteFlyger, tolkaStartstad, type KartStadsläge } from './startstad';

const NU = 1_800_000_000_000;

describe('tolkaStartstad', () => {
    it('ger staden för en färsk giltig post', () => {
        expect(tolkaStartstad({ slug: 'umea', savedAt: NU - 1000 }, NU)?.name).toBe('Umeå');
    });
    it('för gammal, okänd slug eller skräp → null', () => {
        expect(tolkaStartstad({ slug: 'umea', savedAt: NU - STARTSTAD_MAX_ÅLDER_MS - 1 }, NU)).toBeNull();
        expect(tolkaStartstad({ slug: 'atlantis', savedAt: NU }, NU)).toBeNull();
        expect(tolkaStartstad('umea', NU)).toBeNull();
        expect(tolkaStartstad(null, NU)).toBeNull();
        expect(tolkaStartstad({ slug: 'umea' }, NU)).toBeNull();
    });
});

describe('stadsbyteFlyger (kameran när kartans stad ändras)', () => {
    const läge = (slug: string, fromGps: boolean, manuell: boolean): KartStadsläge => ({ slug, fromGps, manuell });

    it('GPS-svaret i startstaden: inget hopp', () => {
        expect(stadsbyteFlyger(läge('vaxjo', false, false), läge('vaxjo', true, false))).toBe(false);
    });
    it('GPS-svaret i en annan stad (man har flyttat sig): ETT hopp', () => {
        expect(stadsbyteFlyger(läge('vaxjo', false, false), läge('umea', true, false))).toBe(true);
    });
    it('eget val flyger alltid, även till staden man står i', () => {
        expect(stadsbyteFlyger(läge('vaxjo', false, false), läge('umea', false, true))).toBe(true);
        expect(stadsbyteFlyger(läge('vaxjo', true, false), läge('vaxjo', false, true))).toBe(true);
    });
    it('"Återgå till min plats" från startstaden flyger även när GPS:en landar i samma stad', () => {
        // Startvalet Växjö visas, man trycker på knappen (gpsValt -> manuell) och GPS:en säger Växjö.
        expect(stadsbyteFlyger(läge('vaxjo', false, false), läge('vaxjo', true, true))).toBe(true);
    });
    it('tillbaka från ett eget val till GPS-staden flyger, även om sluggen är densamma', () => {
        expect(stadsbyteFlyger(läge('vaxjo', false, true), läge('vaxjo', true, false))).toBe(true);
        expect(stadsbyteFlyger(läge('umea', false, true), läge('vaxjo', true, false))).toBe(true);
    });
});
