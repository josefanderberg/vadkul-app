import { describe, expect, it } from 'vitest';
import { ärDubbeltapp, ärTapp, DUBBEL_MAX_MS, TAPP_MAX_FLYTT, TAPP_MAX_MS } from './dubbeltapp';

const p = (t: number, x = 100, y = 400) => ({ t, x, y });

describe('ärTapp', () => {
    it('kort och stillastående = tapp', () => {
        expect(ärTapp(p(0), p(120, 104, 396))).toBe(true);
    });
    it('långtryck är inget tapp', () => {
        expect(ärTapp(p(0), p(TAPP_MAX_MS + 1))).toBe(false);
    });
    it('svep är inget tapp (scrollen äger rörelsen)', () => {
        expect(ärTapp(p(0), p(100, 100, 400 + TAPP_MAX_FLYTT + 1))).toBe(false);
    });
});

describe('ärDubbeltapp', () => {
    it('två snabba tapp nära varandra = dubbel', () => {
        expect(ärDubbeltapp(p(0), p(250, 110, 410))).toBe(true);
    });
    it('utan föregående tapp = inte dubbel', () => {
        expect(ärDubbeltapp(null, p(100))).toBe(false);
    });
    it('för långt efteråt = två enkla tapp', () => {
        expect(ärDubbeltapp(p(0), p(DUBBEL_MAX_MS + 1))).toBe(false);
    });
    it('för långt ifrån = två enkla tapp (t.ex. två olika rader)', () => {
        expect(ärDubbeltapp(p(0, 100, 400), p(200, 100, 460))).toBe(false);
    });
});
