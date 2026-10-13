import { describe, expect, it } from 'vitest';
import { kartansOrt, rutansMitt } from './kartOrt';

describe('kartansOrt', () => {
    it('följer kartan - över Göteborg står det Göteborg, inte startstaden (Josef 13/10)', () => {
        expect(kartansOrt({ lat: 57.70, lng: 11.97 }, 11)?.name).toBe('Göteborg');
        expect(kartansOrt({ lat: 56.88, lng: 14.81 }, 11)?.name).toBe('Växjö');
    });

    it('småorten vinner över närmaste storstad', () => {
        expect(kartansOrt({ lat: 61.73, lng: 17.10 }, 11)?.name).toBe('Hudiksvall');
    });

    it('utzoomat förbi stadsnivå är det Sverige', () => {
        expect(kartansOrt({ lat: 57.70, lng: 11.97 }, 7.9)).toBeNull();
    });

    it('långt ute i havet finns ingen ärlig stad', () => {
        // Mitt i Östersjön mellan Gotland och Lettland.
        expect(kartansOrt({ lat: 57.3, lng: 20.4 }, 10)).toBeNull();
    });
});

describe('rutansMitt', () => {
    it('mitten av [väst, syd, öst, nord]', () => {
        expect(rutansMitt([11, 57, 13, 58])).toEqual({ lat: 57.5, lng: 12 });
    });
});
