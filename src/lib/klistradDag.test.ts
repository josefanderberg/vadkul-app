import { describe, expect, it } from 'vitest';
import { klistradDag, type DagPlats } from './klistradDag';

// Bild + chatt överst (0-800), sedan tre dagar i listan.
const DAGAR: DagPlats[] = [
    { y: 800, höjd: 400, offset: 0 },
    { y: 1200, höjd: 300, offset: 1 },
    { y: 1500, höjd: 600, offset: 2 },
];

describe('klistradDag', () => {
    it('ingen rubrik innan listan nått överkanten', () => {
        expect(klistradDag(DAGAR, 0, 40)).toBeNull();
        expect(klistradDag(DAGAR, 800, 40)).toBeNull();
    });

    it('dagen man scrollar i står kvar överst', () => {
        expect(klistradDag(DAGAR, 900, 40)).toEqual({ offset: 0, skjut: 0 });
        expect(klistradDag(DAGAR, 1300, 40)).toEqual({ offset: 1, skjut: 0 });
        expect(klistradDag(DAGAR, 1700, 40)).toEqual({ offset: 2, skjut: 0 });
    });

    it('nästa dag trycker upp rubriken i stället för att lägga sig över', () => {
        // Sektionen slutar på 1200: 1200 - 40 - 1170 = -10.
        expect(klistradDag(DAGAR, 1170, 40)).toEqual({ offset: 0, skjut: -10 });
        expect(klistradDag(DAGAR, 1150, 40)).toEqual({ offset: 0, skjut: 0 });
    });

    it('efter sista dagen (arrangörsrad, Visa fler) släpper rubriken', () => {
        expect(klistradDag(DAGAR, 2150, 40)).toBeNull();
    });

    it('platserna behöver inte vara sorterade', () => {
        expect(klistradDag([...DAGAR].reverse(), 1300, 40)).toEqual({ offset: 1, skjut: 0 });
    });
});
