import { describe, expect, it } from 'vitest';
import { höjdEfterHuvudbyte, landning, sheetStops, snapDown, snapUp } from './sheetSnap';

const STOPP = [335, 450, 720];

describe('sheetStops', () => {
    it('sorterar och slår ihop stopp som ligger för nära', () => {
        expect(sheetStops([720, 335, 340, 450])).toEqual([335, 450, 720]);
    });
});

describe('snapUp/snapDown - ett stopp per gest', () => {
    it('ett kort ryck uppåt tar ett steg', () => {
        expect(snapUp(STOPP, 335, 350)).toBe(450);
    });
    it('långt drag landar närmast där fingret släppte', () => {
        expect(snapUp(STOPP, 335, 700)).toBe(720);
    });
    it('nedåt från default stänger', () => {
        expect(snapDown(STOPP, 335, 300)).toBeNull();
    });
    it('nedåt från taket tar ett steg', () => {
        expect(snapDown(STOPP, 720, 700)).toBe(450);
    });
});

describe('landning', () => {
    it('snabbt svep avgör riktningen', () => {
        expect(landning(STOPP, 335, -4, -0.9)).toBe(450);
        expect(landning(STOPP, 450, 4, 0.9)).toBe(335);
        expect(landning(STOPP, 335, 4, 0.9)).toBeNull();
    });
    it('ett tryck utan rörelse stannar', () => {
        expect(landning(STOPP, 450, 3, 0.1)).toBe(450);
    });
});

describe('höjdEfterHuvudbyte - arket när huvudet byter höjd', () => {
    const bas = { höjd: 340, nyttDefault: 226, mellan: 481, minimerad: false, sökläge: false };

    it('under mellanhöjden följer arket default-stoppet', () => {
        expect(höjdEfterHuvudbyte(bas)).toBe(226);
    });
    it('sökläget lyfter till mellanhöjden i stället för att sjunka under tangentbordet', () => {
        expect(höjdEfterHuvudbyte({ ...bas, sökläge: true })).toBe(481);
    });
    it('från mellanhöjden och uppåt står arket still, även i sökläget', () => {
        expect(höjdEfterHuvudbyte({ ...bas, höjd: 481, sökläge: true })).toBeNull();
        expect(höjdEfterHuvudbyte({ ...bas, höjd: 769, sökläge: true })).toBeNull();
        expect(höjdEfterHuvudbyte({ ...bas, höjd: 769 })).toBeNull();
    });
    it('mini-läget står still', () => {
        expect(höjdEfterHuvudbyte({ ...bas, höjd: 112, minimerad: true, sökläge: true })).toBeNull();
    });
});
