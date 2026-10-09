import { describe, expect, it } from 'vitest';
import {
    MAX_REPEAT_DAYS,
    dagSpann,
    dagsseriensStart,
    harKlockslag,
    normaliseraDagar,
    normaliseraRytm,
    serieEtikett,
    seriensRytm,
    seriensSistaDatum,
    seriensSlut,
    tillfällenFörVeckor,
    tolkaAnvändarEvent,
    tolkaTid,
    vecklaUtSerie,
    ärSerie,
    type SerieRegel,
} from './anvandarEvent';
import { ärEgetVadkulEvent, type AppEvent } from './appEvent';

// ── Webbens utils/weeklySeries.test.ts (de delar appen läser med) ────────────

const serie = (over: Partial<SerieRegel> = {}) =>
    ({ id: 'doc1', time: new Date(2026, 8, 19, 17, 0), repeatWeekly: true, ...over });

describe('normaliseraRytm', () => {
    it('2 är varannan vecka, allt annat är varje vecka', () => {
        expect(normaliseraRytm(2)).toBe(2);
        expect(normaliseraRytm(1)).toBe(1);
        expect(normaliseraRytm(undefined)).toBe(1);
        expect(normaliseraRytm(0)).toBe(1);
        expect(normaliseraRytm(-3)).toBe(1);
        expect(normaliseraRytm(2.5)).toBe(1);
        expect(normaliseraRytm('2')).toBe(1);
    });
});

describe('tillfällenFörVeckor', () => {
    it('varje vecka: veckor och gånger är samma tal', () => {
        expect(tillfällenFörVeckor(4, 1)).toBe(4);
    });

    it('varannan vecka: 8 veckor = 4 gånger', () => {
        expect(tillfällenFörVeckor(8, 2)).toBe(4);
    });

    it('jämna veckotal med varannan-rytm avrundas NED - sista veckan är tom', () => {
        expect(tillfällenFörVeckor(4, 2)).toBe(2);
        expect(tillfällenFörVeckor(7, 2)).toBe(4);
    });

    it('utan veckor är serien obegränsad', () => {
        expect(tillfällenFörVeckor(undefined, 2)).toBeNull();
        expect(tillfällenFörVeckor(0, 1)).toBeNull();
    });
});

describe('seriensSistaDatum', () => {
    it('varje vecka: fjärde gången är tre veckor efter starten', () => {
        expect(seriensSistaDatum(new Date(2026, 8, 19, 17, 0), 4, 1)).toEqual(new Date(2026, 9, 10, 17, 0));
    });

    it('varannan vecka: fjärde gången är sex veckor efter starten', () => {
        expect(seriensSistaDatum(new Date(2026, 8, 19, 17, 0), 4, 2)).toEqual(new Date(2026, 9, 31, 17, 0));
    });

    it('klockslaget överlever sommartidsbytet (25/10 2026)', () => {
        const sista = seriensSistaDatum(new Date(2026, 9, 17, 17, 0), 3, 2);
        expect(sista.getHours()).toBe(17);
        expect(sista).toEqual(new Date(2026, 10, 14, 17, 0));
    });
});

describe('seriensSlut', () => {
    it('basdokumentet: slutet räknas ur repeatWeeks', () => {
        expect(seriensSlut(serie({ repeatWeeks: 7, repeatIntervalWeeks: 2 }))).toEqual(new Date(2026, 9, 31, 17, 0));
    });

    it('ett utvecklat tillfälle litar på seriesEndsAt, inte sin egen tid', () => {
        const slut = seriensSlut(serie({
            time: new Date(2026, 9, 31, 17, 0),
            repeatWeeks: 7,
            repeatIntervalWeeks: 2,
            seriesEndsAt: new Date(2026, 9, 31, 17, 0),
        }));
        expect(slut).toEqual(new Date(2026, 9, 31, 17, 0));
    });

    it('obegränsad serie har inget slut', () => {
        expect(seriensSlut(serie())).toBeNull();
    });

    it('vanligt event är ingen serie', () => {
        expect(seriensSlut(serie({ repeatWeekly: false, repeatWeeks: 4 }))).toBeNull();
    });
});

describe('serieEtikett', () => {
    const nu = new Date(2026, 8, 16);

    it('begränsad varannan-serie: rytm, veckodag och slutdatum', () => {
        expect(serieEtikett(serie({ repeatWeeks: 7, repeatIntervalWeeks: 2 }), nu))
            .toBe('Varannan lördag · t.o.m. 31 okt.');
    });

    it('obegränsad veckoserie säger tills vidare', () => {
        expect(serieEtikett(serie(), nu)).toBe('Varje lördag · tills vidare');
    });

    it('slut nästa år får årtal med sig', () => {
        expect(serieEtikett(serie({ repeatWeeks: 26 }), nu)).toBe('Varje lördag · t.o.m. 13 mars 2027');
    });

    it('vanligt event har ingen rad', () => {
        expect(serieEtikett(serie({ repeatWeekly: false }), nu)).toBeNull();
    });
});

// Dagsserier (22/9): Växjö Konstrunda lör 10 + sön 11 okt kl 11.
const konstrunda = (over: Partial<SerieRegel> = {}) =>
    ({ id: 'kr1', time: new Date(2026, 9, 10, 11, 0), repeatDays: 2, ...over });

describe('normaliseraDagar / ärSerie', () => {
    it('2-14 dagar är en dagsserie, allt annat är det inte', () => {
        expect(normaliseraDagar(2)).toBe(2);
        expect(normaliseraDagar(MAX_REPEAT_DAYS)).toBe(14);
        expect(normaliseraDagar(1)).toBeNull();
        expect(normaliseraDagar(15)).toBeNull();
        expect(normaliseraDagar(2.5)).toBeNull();
        expect(normaliseraDagar(undefined)).toBeNull();
    });

    it('både dagsserier och veckoserier räknas som serier', () => {
        expect(ärSerie({ repeatDays: 3 })).toBe(true);
        expect(ärSerie({ repeatWeekly: true })).toBe(true);
        expect(ärSerie({ repeatDays: 1 })).toBe(false);
        expect(ärSerie({})).toBe(false);
    });
});

describe('vecklaUtSerie: dagsserier', () => {
    it('två dagar i rad blir två tillfällen med egna id', () => {
        const ut = vecklaUtSerie(konstrunda(), new Date(2026, 9, 1));
        expect(ut.map(e => e.id)).toEqual(['kr1__2026-10-10', 'kr1__2026-10-11']);
        expect(ut[1].time).toEqual(new Date(2026, 9, 11, 11, 0));
        expect(ut[0].seriesEndsAt).toEqual(new Date(2026, 9, 11, 11, 0));
    });

    it('första dagen passerad: resten av dagarna finns kvar', () => {
        const ut = vecklaUtSerie(konstrunda({ repeatDays: 3 }), new Date(2026, 9, 11));
        expect(ut.map(e => e.id)).toEqual(['kr1__2026-10-11', 'kr1__2026-10-12']);
    });

    it('färdigspelad dagsserie ger tomt', () => {
        expect(vecklaUtSerie(konstrunda(), new Date(2026, 9, 12))).toEqual([]);
    });

    it('dagsserien vinner om ett dokument ändå bär båda', () => {
        expect(vecklaUtSerie(konstrunda({ repeatWeekly: true }), new Date(2026, 9, 1))).toHaveLength(2);
    });
});

describe('dagsseriens etiketter', () => {
    const nu = new Date(2026, 8, 22);

    it('raden på kortet: antal dagar och datumspannet', () => {
        expect(serieEtikett(konstrunda(), nu)).toBe('2 dagar · lör 10-sön 11 okt.');
    });

    it('etiketten är densamma från dag 2 (räknas bakåt från seriens slut)', () => {
        const [, dag2] = vecklaUtSerie(konstrunda(), new Date(2026, 9, 1));
        expect(serieEtikett(dag2, nu)).toBe('2 dagar · lör 10-sön 11 okt.');
        expect(dagsseriensStart(dag2)).toEqual(new Date(2026, 9, 10, 11, 0));
    });

    it('slutdatumet för en dagsserie', () => {
        expect(seriensSlut(konstrunda({ repeatDays: 4 }))).toEqual(new Date(2026, 9, 13, 11, 0));
    });

    it('spann över månadsskifte och årsskifte', () => {
        expect(dagSpann(new Date(2026, 9, 30), new Date(2026, 10, 1), nu)).toBe('fre 30 okt.-sön 1 nov.');
        expect(dagSpann(new Date(2026, 11, 30), new Date(2027, 0, 2), nu)).toBe('ons 30 dec.-lör 2 jan. 2027');
    });

    it('engångsevent har ingen serieetikett', () => {
        expect(serieEtikett(konstrunda({ repeatDays: undefined }), nu)).toBeNull();
    });
});

describe('månadstabellen = webbens toLocaleDateString(sv-SE)', () => {
    it('alla tolv månader och sju veckodagar', () => {
        const nu = new Date(2026, 0, 1);
        for (let m = 0; m < 12; m++) {
            const d = new Date(2026, m, 10);
            const webb = d.toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' });
            expect(dagSpann(new Date(2026, m, 9), d, nu).split('-')[1]).toBe(webb);
        }
        for (let i = 0; i < 7; i++) {
            const d = new Date(2026, 9, 4 + i, 18, 0);
            const webb = d.toLocaleDateString('sv-SE', { weekday: 'long' });
            expect(serieEtikett({ time: d, repeatWeekly: true }, nu)).toBe(`Varje ${webb} · tills vidare`);
        }
    });
});

// ── Tid ──────────────────────────────────────────────────────────────────────

describe('tolkaTid', () => {
    const d = new Date(2026, 9, 10, 19, 0);

    it('Timestamp-liknande objekt, Date och sträng', () => {
        expect(tolkaTid({ seconds: 0, nanoseconds: 0, toDate: () => d })).toEqual(d);
        expect(tolkaTid(d)).toEqual(d);
        expect(tolkaTid(d.toISOString())).toEqual(d);
    });

    it('skräp blir null', () => {
        expect(tolkaTid('nej')).toBeNull();
        expect(tolkaTid(undefined)).toBeNull();
        expect(tolkaTid({})).toBeNull();
        expect(tolkaTid(new Date('nej'))).toBeNull();
    });
});

describe('harKlockslag', () => {
    it('lokal midnatt = bara datum', () => {
        expect(harKlockslag(new Date(2026, 9, 10, 0, 0))).toBe(false);
        expect(harKlockslag(new Date(2026, 9, 10, 0, 30))).toBe(true);
        expect(harKlockslag(new Date(2026, 9, 10, 19, 0))).toBe(true);
    });
});

// ── Dokument → AppEvent (webbens fetchUserCreatedEvents) ─────────────────────

const NU = new Date(2026, 9, 8, 12, 0); // tors 8 okt 2026, mitt på dagen
const ts = (d: Date) => ({ seconds: Math.floor(d.getTime() / 1000), nanoseconds: 0, toDate: () => d });
const dok = (id: string, data: Record<string, unknown>) => ({ id, data });
const tolka = (...docs: { id: string; data: Record<string, unknown> }[]) => tolkaAnvändarEvent(docs, NU);
const tid = (e: AppEvent) => new Date(e.time);

describe('tolkaAnvändarEvent: mappningen', () => {
    it('eget event: dokument-id som id, inget url-fält, fälten kortet behöver', () => {
        const [e] = tolka(dok('abc', {
            title: 'Pubquiz', time: ts(new Date(2026, 9, 9, 19, 0)), lat: 59.3, lng: 18.1,
            locationName: 'Kvarnen', category: 'music', emoji: '🎤', coverImage: 'https://x/y.jpg',
            hostName: 'Anna', hostUid: 'u1', description: 'Välkomna!', price: 50, userCreated: true,
        }));
        expect(e).toMatchObject({
            id: 'abc', docId: 'abc', title: 'Pubquiz', hasSpecificTime: true, lat: 59.3, lng: 18.1,
            locationName: 'Kvarnen', category: 'music', emoji: '🎤', img: 'https://x/y.jpg',
            userCreated: true, isTip: false, anonTip: false, hostName: 'Anna', hostUid: 'u1',
            description: 'Välkomna!', price: 50, repeatWeekly: false,
        });
        expect(tid(e)).toEqual(new Date(2026, 9, 9, 19, 0));
        expect(typeof e.time).toBe('string');
        expect('url' in e).toBe(false);
        expect(ärEgetVadkulEvent(e)).toBe(true);
    });

    it('tips med länk får url och är inget eget event', () => {
        const [tips] = tolka(dok('t1', { title: 'Loppis', time: new Date(2026, 9, 11, 10, 0), url: 'https://loppis.se', isTip: true, anonTip: true }));
        expect(tips).toMatchObject({ url: 'https://loppis.se', isTip: true, anonTip: true });
        expect(ärEgetVadkulEvent(tips)).toBe(false);
        // Äldre tips saknar isTip men har url - fortfarande inget eget event.
        const [gammalt] = tolka(dok('t2', { title: 'Loppis', time: new Date(2026, 9, 11, 10, 0), url: 'https://loppis.se' }));
        expect(ärEgetVadkulEvent(gammalt)).toBe(false);
    });

    it('standardvärden: kategori other, värd VADKUL-användare, tid som sträng', () => {
        const [e] = tolka(dok('d', { title: 'Grillkväll', time: new Date(2026, 9, 10, 0, 0).toISOString() }));
        expect(e).toMatchObject({ category: 'other', hostName: 'VADKUL-användare', lat: 0, lng: 0, hasSpecificTime: false });
        expect(e.img).toBeUndefined();
        expect(e.description).toBeUndefined();
    });

    it('ett vanligt AppFeedEvent är ett AppEvent och har ingen serierad', () => {
        const skrapat: AppEvent = { id: 'https://x.se/e', title: 'X', time: NU.toISOString(), hasSpecificTime: true, lat: 0, lng: 0, category: 'music' };
        expect(seriensRytm(skrapat, NU)).toBeNull();
        expect(ärEgetVadkulEvent(skrapat)).toBe(false);
    });
});

describe('tolkaAnvändarEvent: filtret', () => {
    it('gömda, titellösa och ogiltiga tider faller bort', () => {
        const ok = { title: 'Ok', time: new Date(2026, 9, 9, 19, 0) };
        expect(tolka(
            dok('gömd', { ...ok, hidden: true }),
            dok('ingen-titel', { ...ok, title: '' }),
            dok('trasig-tid', { ...ok, time: 'nej' }),
            dok('ok', ok),
        ).map(e => e.id)).toEqual(['ok']);
    });

    it('engångsevent före dagens midnatt faller bort, tidigare idag ligger kvar', () => {
        expect(tolka(
            dok('igår', { title: 'Igår', time: new Date(2026, 9, 7, 19, 0) }),
            dok('imorse', { title: 'Imorse', time: new Date(2026, 9, 8, 8, 0) }),
        ).map(e => e.id)).toEqual(['imorse']);
    });

    it('dagsserie med repeatDays 1 eller skräprytm är ett engångsevent', () => {
        const [e] = tolka(dok('en', { title: 'En dag', time: new Date(2026, 9, 9, 19, 0), repeatDays: 1, repeatIntervalWeeks: 1 }));
        expect(e.id).toBe('en');
        expect(e.repeatDays).toBeUndefined();
        expect(e.repeatIntervalWeeks).toBeUndefined();
    });
});

describe('tolkaAnvändarEvent: serier', () => {
    it('veckoserie som startade i våras börjar vid nästa tillfälle, tolv veckor fram', () => {
        const ut = tolka(dok('quiz', { title: 'Pubquiz', time: ts(new Date(2026, 2, 7, 19, 0)), repeatWeekly: true }));
        expect(ut).toHaveLength(12);
        expect(ut[0].id).toBe('quiz__2026-10-10');
        expect(ut[11].id).toBe('quiz__2026-12-26');
        expect(ut.every(e => e.docId === 'quiz')).toBe(true);
        // Sommartidsbytet 25/10 knuffar inte klockslaget.
        expect(ut.every(e => tid(e).getHours() === 19 && tid(e).getDay() === 6)).toBe(true);
        expect(ut[0].seriesEndsAt).toBeUndefined();
        expect(seriensRytm(ut[3], NU)).toBe('Varje lördag · tills vidare');
    });

    it('varannan vecka behåller pariteten och t.o.m.-raden står still', () => {
        const ut = tolka(dok('dest', {
            title: 'Destilleribesök', time: new Date(2026, 8, 19, 17, 0),
            repeatWeekly: true, repeatWeeks: 7, repeatIntervalWeeks: 2,
        }));
        expect(ut.map(e => e.id)).toEqual(['dest__2026-10-17', 'dest__2026-10-31']);
        expect(new Date(ut[0].seriesEndsAt!)).toEqual(new Date(2026, 9, 31, 17, 0));
        expect(ut.map(e => seriensRytm(e, NU))).toEqual([
            'Varannan lördag · t.o.m. 31 okt.',
            'Varannan lördag · t.o.m. 31 okt.',
        ]);
    });

    it('färdigspelad serie försvinner', () => {
        expect(tolka(dok('slut', {
            title: 'Över', time: new Date(2026, 7, 1, 18, 0), repeatWeekly: true, repeatWeeks: 4,
        }))).toEqual([]);
    });

    it('dagsserie vars första dag var igår har kvar resten', () => {
        const ut = tolka(dok('kr', { title: 'Konstrunda', time: new Date(2026, 9, 7, 11, 0), repeatDays: 3 }));
        expect(ut.map(e => e.id)).toEqual(['kr__2026-10-08', 'kr__2026-10-09']);
        expect(seriensRytm(ut[1], NU)).toBe('3 dagar · ons 7-fre 9 okt.');
    });

    it('dagsserie framåt: en rad per dag med samma etikett', () => {
        const ut = tolka(dok('kr1', { title: 'Växjö Konstrunda', time: new Date(2026, 9, 10, 11, 0), repeatDays: 2 }));
        expect(ut.map(e => e.id)).toEqual(['kr1__2026-10-10', 'kr1__2026-10-11']);
        expect(ut.map(e => seriensRytm(e, NU))).toEqual(['2 dagar · lör 10-sön 11 okt.', '2 dagar · lör 10-sön 11 okt.']);
    });
});
