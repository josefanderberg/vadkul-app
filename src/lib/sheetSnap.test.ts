import { describe, expect, it } from 'vitest';
import { höjdEfterHuvudbyte, landning, sheetStops, snapDown, snapUp } from './sheetSnap';

const STOPP = [335, 450, 720];

describe('sheetStops', () => {
    it('sorterar och slår ihop stopp som ligger för nära', () => {
        expect(sheetStops([720, 335, 340, 450])).toEqual([335, 450, 720]);
    });
});

describe('snapUp/snapDown - minst ett stopp per gest', () => {
    it('ett kort ryck uppåt tar ett steg', () => {
        expect(snapUp(STOPP, 335, 350)).toBe(450);
    });
    it('ett långt drag hoppar två steg', () => {
        expect(snapUp(STOPP, 335, 700)).toBe(720);
    });
    it('hoppar vidare redan en fjärdedel förbi mellanstoppet (Josef 11/10)', () => {
        // 450 + 0,25 * (720 - 450) = 517,5 - långt före mittpunkten 585.
        expect(snapUp(STOPP, 335, 518)).toBe(720);
        expect(snapUp(STOPP, 335, 517)).toBe(450);
    });
    it('nedåt från default stänger', () => {
        expect(snapDown(STOPP, 335, 300)).toBeNull();
    });
    it('nedåt från taket tar ett steg', () => {
        expect(snapDown(STOPP, 720, 700)).toBe(450);
    });
    it('ett långt neddrag från taket stänger hela vägen', () => {
        // Förbi default med en fjärdedel av dess höjd: 335 - 83,75 = 251,25.
        expect(snapDown(STOPP, 720, 250)).toBeNull();
        expect(snapDown(STOPP, 720, 260)).toBe(335);
        // 450 - 0,25 * (450 - 335) = 421,25 → förbi mellanstoppet.
        expect(snapDown(STOPP, 720, 421)).toBe(335);
        expect(snapDown(STOPP, 720, 422)).toBe(450);
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
    it('ett kort snabbt ryck uppåt tar ett steg', () => {
        // Släppt på 375, projicerat 475 → mellanstoppet.
        expect(landning(STOPP, 335, -40, -1)).toBe(450);
    });
    it('ett längre drag i fart hoppar upp två steg (Josef 11/10)', () => {
        // Släppt på 485, projicerat 585 → taket.
        expect(landning(STOPP, 335, -150, -1)).toBe(720);
        // Samma drag långsamt: 485 + 20 = 505 → mellanstoppet.
        expect(landning(STOPP, 335, -150, -0.2)).toBe(450);
    });
    it('ett långt neddrag från taket stänger kortet', () => {
        // Släppt på 320, projicerat 220 → förbi default → stängt.
        expect(landning(STOPP, 720, 400, 1)).toBeNull();
        // Kortare: släppt på 570, projicerat 470 → mellanstoppet.
        expect(landning(STOPP, 720, 150, 1)).toBe(450);
    });
    it('projektionen har tak - ett vilt ryck tar inte hela arket', () => {
        // 690 - 140 = 550 → bara ett steg ner.
        expect(landning(STOPP, 720, 30, 6)).toBe(450);
    });
});

describe('höjdEfterHuvudbyte - arket när huvudet byter höjd', () => {
    const bas = { höjd: 340, nyttDefault: 226, mellan: 481, sökläge: false };

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
});
