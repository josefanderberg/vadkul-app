import { describe, expect, it } from 'vitest';
import type { AppFeedEvent } from '@vadkul/kontrakt';
import {
    INZOOM_KÄLLOR,
    kartansUrval,
    klassaKälla,
    KÄLLOR,
    matcharFilter,
    medInzoomKällor,
    OPT_IN_KARTA_MIN_ZOOM,
    optInPåKartan,
    planeraKategoriChips,
    räknaKategorier,
    räknaKällor,
    räknaPopulära,
    synligaKällor,
    TOMT_FILTER,
    type KartFilter,
} from './kartFilter';

const ev = (id: string, category = 'music', extra: Partial<AppFeedEvent> = {}): AppFeedEvent => ({
    id,
    title: id,
    time: '2026-09-29T17:00:00.000Z',
    hasSpecificTime: true,
    lat: 59.33,
    lng: 18.06,
    category,
    ...extra,
});

const KYRKAN = ev('https://www.svenskakyrkan.se/stockholm/kalender?event=ab98', 'music');
const PRO = ev('https://pro.se/distrikt/stockholm/aktivitet/1', 'social');
const KORPEN = ev('https://korpenstockholm.zoezi.se/schema#pass-1', 'sport');
const JAZZ = ev('https://www.tickster.com/jazz', 'music', { pop: true });
const FOTBOLL = ev('https://www.tickster.com/fotboll', 'sport');
const TM = ev('https://www.ticketmaster.se/event/x', 'stage', { url: 'https://ticketmaster.evyy.net/c/1?u=x', pop: true });

const f = (over: Partial<KartFilter>): KartFilter => ({ ...TOMT_FILTER, ...over });

describe('klassaKälla', () => {
    it('känner igen de tre stora källorna på värdnamnet', () => {
        expect(klassaKälla(KYRKAN)).toBe('svenskakyrkan');
        expect(klassaKälla(PRO)).toBe('pro');
        expect(klassaKälla(KORPEN)).toBe('korpen');
    });
    it('klassar inte vanliga källor, och pro.se måste vara exakt värd', () => {
        expect(klassaKälla(JAZZ)).toBeNull();
        expect(klassaKälla(ev('https://www.improvisation.pro/x'))).toBeNull();
        expect(klassaKälla(ev('https://stockholm.pro.se/x'))).toBe('pro');
    });
    it('läser url före id (omskrivna länkar)', () => {
        expect(klassaKälla(TM)).toBeNull();
        expect(klassaKälla(ev('inte-en-url', 'music', { url: 'https://www.svenskakyrkan.se/x' }))).toBe('svenskakyrkan');
    });
});

describe('matcharFilter', () => {
    it('användarskapade kringgår hela filtret (webbens första rad)', () => {
        const eget = { ...ev('abc123', 'social'), userCreated: true as const };
        expect(matcharFilter(eget, f({ kategorier: new Set(['music']), populärt: true }))).toBe(true);
        expect(matcharFilter(eget, f({ källa: 'korpen' }))).toBe(true);
    });
    it('standard: stora källor göms, resten syns', () => {
        expect(matcharFilter(KYRKAN, TOMT_FILTER)).toBe(false);
        expect(matcharFilter(PRO, TOMT_FILTER)).toBe(false);
        expect(matcharFilter(KORPEN, TOMT_FILTER)).toBe(false);
        expect(matcharFilter(JAZZ, TOMT_FILTER)).toBe(true);
    });
    it('ikryssad opt-in-källa syns', () => {
        expect(matcharFilter(KYRKAN, f({ optIn: new Set(['svenskakyrkan']) }))).toBe(true);
        expect(matcharFilter(PRO, f({ optIn: new Set(['svenskakyrkan']) }))).toBe(false);
    });
    it('kategori smalnar även ikryssade källor', () => {
        const filter = f({ kategorier: new Set(['sport']), optIn: new Set(['svenskakyrkan']) });
        expect(matcharFilter(KYRKAN, filter)).toBe(false);
        expect(matcharFilter(FOTBOLL, filter)).toBe(true);
        expect(matcharFilter(JAZZ, filter)).toBe(false);
    });
    it('FLER-källan visar bara källan, även utan kryss', () => {
        const filter = f({ källa: 'korpen' });
        expect(matcharFilter(KORPEN, filter)).toBe(true);
        expect(matcharFilter(FOTBOLL, filter)).toBe(false);
    });
    it('🔥 ensamt smalnar allt till pop-flaggade', () => {
        const filter = f({ populärt: true, optIn: new Set(['svenskakyrkan']) });
        expect(matcharFilter(JAZZ, filter)).toBe(true);
        expect(matcharFilter(TM, filter)).toBe(true);
        expect(matcharFilter(FOTBOLL, filter)).toBe(false);
        expect(matcharFilter(KYRKAN, filter)).toBe(false);
    });
    it('🔥 + kategori är en UNION (ägarbeslut 11/10): kategorin OCH populära', () => {
        const filter = f({ populärt: true, kategorier: new Set(['sport']) });
        expect(matcharFilter(FOTBOLL, filter)).toBe(true); // kategorin, inte pop
        expect(matcharFilter(JAZZ, filter)).toBe(true); // pop utanför kategorin
        expect(matcharFilter(TM, filter)).toBe(true); // pop utanför kategorin
        expect(matcharFilter(ev('https://x.se/teater', 'stage'), filter)).toBe(false); // varken eller
        expect(matcharFilter(KORPEN, filter)).toBe(false); // källgrinden står kvar
    });
});

describe('flervalet (6/10-beslutet, portat 11/10)', () => {
    it('flera kategorier är en union sinsemellan, tom mängd = alla', () => {
        const filter = f({ kategorier: new Set(['sport', 'music']) });
        expect(matcharFilter(FOTBOLL, filter)).toBe(true);
        expect(matcharFilter(JAZZ, filter)).toBe(true);
        expect(matcharFilter(TM, filter)).toBe(false); // stage
        expect(matcharFilter(TM, f({}))).toBe(true);
    });
    it('🔥 + flera kategorier = kategorierna OCH alla populära', () => {
        const filter = f({ populärt: true, kategorier: new Set(['sport']) });
        expect(matcharFilter(FOTBOLL, filter)).toBe(true);
        expect(matcharFilter(TM, filter)).toBe(true); // pop utanför valet
    });
    it('valda chips står först i raden', () => {
        const counts = new Map([['music', 3], ['sport', 5]]);
        expect(planeraKategoriChips(['music', 'sport'], counts, new Set(['music'])).map(c => c.key))
            .toEqual(['music', 'sport']);
    });
});

describe('räknare', () => {
    const alla = [KYRKAN, PRO, KORPEN, JAZZ, FOTBOLL, TM];
    it('kategorisiffrorna räknas utan kategorival men med opt-in', () => {
        const c = räknaKategorier(alla, f({ kategorier: new Set(['sport']) }));
        expect(c.get('music')).toBe(1);
        expect(c.get('sport')).toBe(1);
        expect(c.get('stage')).toBe(1);
        expect(räknaKategorier(alla, f({ optIn: new Set(['svenskakyrkan']) })).get('music')).toBe(2);
    });
    it('populärsiffran ignorerar kategorierna sedan unionsbeslutet 11/10', () => {
        expect(räknaPopulära(alla, TOMT_FILTER)).toBe(2);
        expect(räknaPopulära(alla, f({ kategorier: new Set(['stage']) }))).toBe(2);
    });
    it('kategorisiffran med 🔥 på räknar unionen ("vad visas om jag trycker här")', () => {
        expect(räknaKategorier(alla, f({ populärt: true })).get('sport')).toBe(3); // FOTBOLL + JAZZ + TM
    });
    it('källsiffrorna räknar alla tre', () => {
        const c = räknaKällor(alla);
        expect([c.get('svenskakyrkan'), c.get('pro'), c.get('korpen')]).toEqual([1, 1, 1]);
    });
});

describe('planeraKategoriChips', () => {
    it('flest först, Övrigt sist, nollor bort utom den valda', () => {
        const counts = new Map([['music', 3], ['sport', 5], ['other', 9], ['art', 0]]);
        expect(planeraKategoriChips(['music', 'sport', 'art', 'other'], counts, new Set()).map(c => c.key))
            .toEqual(['sport', 'music', 'other']);
        expect(planeraKategoriChips(['music', 'sport', 'art', 'other'], counts, new Set(['art'])).map(c => c.key))
            .toEqual(['art', 'sport', 'music', 'other']);
    });
});

describe('synligaKällor', () => {
    it('bara källor med event, plus den valda', () => {
        expect(synligaKällor(new Map([['pro', 2]]), null).map(k => k.key)).toEqual(['pro']);
        expect(synligaKällor(new Map(), 'korpen').map(k => k.key)).toEqual(['korpen']);
        expect(synligaKällor(new Map(), null)).toEqual([]);
    });
});

// Samma fall som webbens utils/optInZoom.test.ts (#240), plus hur inzoom-
// filtret beter sig genom matcharFilter (VADKUL#253).
describe('optInPåKartan', () => {
    it('tänds från kvartersnivån och uppåt', () => {
        expect(optInPåKartan(OPT_IN_KARTA_MIN_ZOOM)).toBe(true);
        expect(optInPåKartan(OPT_IN_KARTA_MIN_ZOOM + 2.3)).toBe(true);
    });
    it('är släckt utzoomat och innan kartan rapporterat sin zoom', () => {
        expect(optInPåKartan(OPT_IN_KARTA_MIN_ZOOM - 0.01)).toBe(false);
        expect(optInPåKartan(11)).toBe(false);
        expect(optInPåKartan(null)).toBe(false);
    });
    it('gränsen är webbens, 15 eller 16 som ticketen sa', () => {
        expect([15, 16]).toContain(OPT_IN_KARTA_MIN_ZOOM);
    });
});

describe('INZOOM_KÄLLOR', () => {
    it('är kyrkan, PRO och Korpen, och alla finns i KÄLLOR', () => {
        expect([...INZOOM_KÄLLOR].sort()).toEqual(['korpen', 'pro', 'svenskakyrkan']);
        const kända = new Set(KÄLLOR.map(k => k.key));
        for (const k of INZOOM_KÄLLOR) expect(kända.has(k)).toBe(true);
    });
    it('täcker varje källa som klassas, så ingen källa blir kvar dold inzoomat', () => {
        for (const e of [KYRKAN, PRO, KORPEN]) expect(INZOOM_KÄLLOR).toContain(klassaKälla(e));
    });
});

describe('medInzoomKällor', () => {
    it('lägger till källorna utan att röra filtrets övriga val', () => {
        const kategorier = new Set(['music' as const]);
        const filtret = f({ kategorier, populärt: true, optIn: new Set(['pro'] as const) });
        const ut = medInzoomKällor(filtret);
        expect([...ut.optIn].sort()).toEqual(['korpen', 'pro', 'svenskakyrkan']);
        expect(ut.kategorier).toBe(kategorier);
        expect(ut.populärt).toBe(true);
        expect(ut.källa).toBeNull();
        expect([...filtret.optIn]).toEqual(['pro']);
    });
    it('släpper igenom källorna utan kryss, men listans filter gör det inte', () => {
        for (const e of [KYRKAN, PRO, KORPEN]) {
            expect(matcharFilter(e, TOMT_FILTER)).toBe(false);
            expect(matcharFilter(e, medInzoomKällor(TOMT_FILTER))).toBe(true);
        }
    });
    it('kategorin och 🔥 gäller källorna som när de är ikryssade', () => {
        const sport = medInzoomKällor(f({ kategorier: new Set(['sport']) }));
        expect(matcharFilter(KORPEN, sport)).toBe(true);
        expect(matcharFilter(KYRKAN, sport)).toBe(false);
        // Källornas event är aldrig pop: 🔥 ensamt håller dem borta.
        expect(matcharFilter(KYRKAN, medInzoomKällor(f({ populärt: true })))).toBe(false);
    });
    it('FLER-källan visar fortfarande bara sin källa', () => {
        const bara = medInzoomKällor(f({ källa: 'pro' }));
        expect(matcharFilter(PRO, bara)).toBe(true);
        expect(matcharFilter(KYRKAN, bara)).toBe(false);
        expect(matcharFilter(JAZZ, bara)).toBe(false);
    });
});

describe('kartansUrval', () => {
    const lista = [{ id: 'a' }, { id: 'c' }];
    const underlag = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
    const passerar = (e: { id: string }) => e.id !== 'd';

    it('utzoomat är kartans underlag samma referens som listans', () => {
        expect(kartansUrval(optInPåKartan(12), lista, underlag, passerar)).toBe(lista);
        expect(kartansUrval(optInPåKartan(null), lista, underlag, passerar)).toBe(lista);
    });
    it('inzoomat filtreras underlaget med inzoom-regeln, i underlagets ordning', () => {
        const inzoom = optInPåKartan(OPT_IN_KARTA_MIN_ZOOM);
        expect(kartansUrval(inzoom, lista, underlag, passerar).map(e => e.id)).toEqual(['a', 'b', 'c']);
    });
});
