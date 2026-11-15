import { describe, expect, it } from 'vitest';
import { CITIES, smhiPointUrl, WEATHER_PENDING, type CityWeather } from '@vadkul/kontrakt';
import { kartansOrt } from './kartOrt';
import { nearestCityPoint } from './orter';
import { plattansLästext, plattansVäderOrt, väderOpacitet } from './stadsVader';

const stad = (slug: string) => CITIES.find(c => c.slug === slug)!;
const VÄXJÖ = stad('vaxjo');
const GÖTEBORG = stad('goteborg');

describe('plattansVäderOrt', () => {
    it('innan kartan rapporterat sin vy gäller startstadens ort', () => {
        const ort = plattansVäderOrt({ hopp: null, kartKlar: false, kartOrt: null, start: VÄXJÖ });
        const växjö = nearestCityPoint(VÄXJÖ.lat, VÄXJÖ.lng);
        expect(ort).toEqual({ lat: växjö.lat, lng: växjö.lng });
    });

    it('när kartan är klar följer vädret kartans ort', () => {
        const kartOrt = kartansOrt({ lat: 57.70, lng: 11.97 }, 11);
        expect(kartOrt?.name).toBe('Göteborg');
        expect(plattansVäderOrt({ hopp: null, kartKlar: true, kartOrt, start: VÄXJÖ })).toBe(kartOrt);
    });

    it('"Sverige" (ingen ort) har inget väder - startstadens väder vore en lögn', () => {
        expect(plattansVäderOrt({ hopp: null, kartKlar: true, kartOrt: null, start: VÄXJÖ })).toBeNull();
    });

    it('mitt i ett stadshopp gäller målets ort, inte den kartan ännu står över', () => {
        const kvar = kartansOrt({ lat: VÄXJÖ.lat, lng: VÄXJÖ.lng }, 11);
        const ort = plattansVäderOrt({ hopp: GÖTEBORG, kartKlar: true, kartOrt: kvar, start: VÄXJÖ });
        const göteborg = nearestCityPoint(GÖTEBORG.lat, GÖTEBORG.lng);
        expect(ort).toEqual({ lat: göteborg.lat, lng: göteborg.lng });
    });

    // Annars hämtas samma stad två gånger och vädret tonas ner i onödan när
    // kartan landar.
    it('samma adress till SMHI före, under och efter hoppet - för alla städer', () => {
        for (const c of CITIES) {
            const start = plattansVäderOrt({ hopp: null, kartKlar: false, kartOrt: null, start: c })!;
            const under = plattansVäderOrt({ hopp: c, kartKlar: true, kartOrt: null, start: VÄXJÖ })!;
            // Kameran landar i stadens mitt på zoom 11.
            const landad = plattansVäderOrt({ hopp: null, kartKlar: true, kartOrt: kartansOrt(c, 11), start: VÄXJÖ })!;
            const url = smhiPointUrl(landad.lat, landad.lng);
            expect(smhiPointUrl(start.lat, start.lng), c.name).toBe(url);
            expect(smhiPointUrl(under.lat, under.lng), c.name).toBe(url);
        }
    });

    it('orten vädret gäller heter som plattan - för alla städer', () => {
        for (const c of CITIES) expect(nearestCityPoint(c.lat, c.lng).name, c.slug).toBe(c.name);
    });
});

describe('väderOpacitet', () => {
    it('eget väder fullt, förra ortens nedtonat, utfyllnaden osynlig (#221)', () => {
        expect(väderOpacitet('fresh')).toBe(1);
        expect(väderOpacitet('stale')).toBe(0.5);
        expect(väderOpacitet('pending')).toBe(0);
    });
});

describe('plattansLästext', () => {
    const mulet: CityWeather = { emoji: '☁️', temp: '2°', text: 'Mulet', state: 'fresh' };

    it('läser ort, dag och ortens eget väder', () => {
        expect(plattansLästext('Växjö', 'Idag', mulet)).toBe('Växjö, Idag. Väder: Mulet, 2° (SMHI)');
    });

    it('förra ortens väder och utfyllnaden läses aldrig som fakta', () => {
        expect(plattansLästext('Kalmar', 'Idag', { ...mulet, state: 'stale' })).toBe('Kalmar, Idag');
        expect(plattansLästext('Kalmar', 'Idag', WEATHER_PENDING)).toBe('Kalmar, Idag');
    });

    it('utan väder: bara ort och dag', () => {
        expect(plattansLästext('Sverige', 'Hela veckan', null)).toBe('Sverige, Hela veckan');
    });
});
