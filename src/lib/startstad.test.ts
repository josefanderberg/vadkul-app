import { describe, expect, it } from 'vitest';
import { STARTSTAD_MAX_ÅLDER_MS, tolkaStartstad } from './startstad';

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
