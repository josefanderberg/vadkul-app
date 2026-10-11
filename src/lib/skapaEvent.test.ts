import { describe, expect, it } from 'vitest';
import {
    normaliseraPris,
    normaliseraTipsLänk,
    nyttEventDok,
    nästaHelaTimmen,
    redigeringsStart,
    serieFält,
    serieRadEtikett,
    sistaGångenEtikett,
    sistaTillfället,
    skapaFelKod,
    skapaFelText,
    tillfällenKvarFrån,
    veckorFörTillfällen,
    ändratEventDok,
} from './skapaEvent';

// ── Pris (webbens priceLabel.test) ──────────────────────────────────────────

describe('normaliseraPris', () => {
    it('tomt/saknat pris → null (chip döljs)', () => {
        expect(normaliseraPris(undefined)).toBeNull();
        expect(normaliseraPris(null)).toBeNull();
        expect(normaliseraPris('')).toBeNull();
        expect(normaliseraPris('   ')).toBeNull();
    });

    it('gratis-varianter → "Gratis" (inkl. källornas typo)', () => {
        expect(normaliseraPris('Gratis')).toBe('Gratis');
        expect(normaliseraPris('fri entré')).toBe('Gratis');
        expect(normaliseraPris('Avgiftsfritt')).toBe('Gratis');
        expect(normaliseraPris('konstnadsfritt')).toBe('Gratis');
        expect(normaliseraPris(0)).toBe('Gratis');
        expect(normaliseraPris('0')).toBe('Gratis');
    });

    it('svensk valutanotation normaliseras till "N kr"', () => {
        expect(normaliseraPris('160:-')).toBe('160 kr');
        expect(normaliseraPris('30kr')).toBe('30 kr');
        expect(normaliseraPris('40 SEK')).toBe('40 kr');
        expect(normaliseraPris('695 kr')).toBe('695 kr');
        expect(normaliseraPris(120)).toBe('120 kr');
    });

    it('intervall och decimaler behålls, fritext lämnas orörd', () => {
        expect(normaliseraPris('20-50')).toBe('20-50 kr');
        expect(normaliseraPris('12,50')).toBe('12,50 kr');
        expect(normaliseraPris('Medlemmar halva priset')).toBe('Medlemmar halva priset');
    });
});

// ── Tips-länken (webbens tipUrl.test) ───────────────────────────────────────

describe('normaliseraTipsLänk', () => {
    it('vanlig länk går igenom oförändrad', () => {
        expect(normaliseraTipsLänk('https://vaxjocity.com/halloween/')).toBe('https://vaxjocity.com/halloween/');
        expect(normaliseraTipsLänk('https://x.se/a?b=1#c')).toBe('https://x.se/a?b=1#c');
    });

    it('protokoll saknas → https:// läggs på', () => {
        expect(normaliseraTipsLänk('vaxjocity.com/halloween/')).toBe('https://vaxjocity.com/halloween/');
        expect(normaliseraTipsLänk('  www.x.se  ')).toBe('https://www.x.se/');
    });

    it('ogiltigt → null', () => {
        expect(normaliseraTipsLänk('')).toBeNull();
        expect(normaliseraTipsLänk('aftonbladet')).toBeNull();
        expect(normaliseraTipsLänk('javascript:alert(1)')).toBeNull();
        expect(normaliseraTipsLänk('ftp://x.se/a')).toBeNull();
    });

    it('mellanslag + LRM efter länken (FB/dela-menyn) skalas bort', () => {
        expect(normaliseraTipsLänk('https://vaxjocity.com/halloween/ ‎')).toBe('https://vaxjocity.com/halloween/');
        expect(normaliseraTipsLänk('﻿x.se/a⁦⁩')).toBe('https://x.se/a');
    });

    it('redan kodat skräp sist lagas, kodade tecken mitt i rörs inte', () => {
        expect(normaliseraTipsLänk('https://vaxjocity.com/halloween/%20%E2%80%8E')).toBe('https://vaxjocity.com/halloween/');
        expect(normaliseraTipsLänk('https://x.se/a%20b/c')).toBe('https://x.se/a%20b/c');
    });
});

// ── Serieräknandet (webbens weeklySeries.test, formdelen) ───────────────────

describe('veckorFörTillfällen', () => {
    it('varje vecka: gånger = veckor', () => {
        expect(veckorFörTillfällen(4, 1)).toBe(4);
        expect(veckorFörTillfällen(1, undefined)).toBe(1);
    });

    it('varannan vecka: sista veckan ÄR ett tillfälle, aldrig en tom mellanvecka', () => {
        expect(veckorFörTillfällen(2, 2)).toBe(3);
        expect(veckorFörTillfällen(4, 2)).toBe(7);
        expect(veckorFörTillfällen(26, 2)).toBe(51);
    });
});

describe('sistaTillfället', () => {
    const start = new Date('2026-10-15T19:00:00');

    it('veckovis stegar hela veckor', () => {
        expect(sistaTillfället(start, 3, 1).toISOString()).toBe(new Date('2026-10-29T19:00:00').toISOString());
        expect(sistaTillfället(start, 3, 2).toISOString()).toBe(new Date('2026-11-12T19:00:00').toISOString());
    });

    it('daglig stegar dagar', () => {
        expect(sistaTillfället(start, 3, 'daglig').toISOString()).toBe(new Date('2026-10-17T19:00:00').toISOString());
    });
});

describe('tillfällenKvarFrån', () => {
    it('från första tillfället = hela serien', () => {
        const start = new Date('2026-10-15T19:00:00');
        const slut = sistaTillfället(start, 4, 1);
        expect(tillfällenKvarFrån(start, slut, 1)).toBe(4);
    });

    it('mitt i serien räknas bara resten (inkl. tillfället självt)', () => {
        const start = new Date('2026-10-15T19:00:00');
        const slut = sistaTillfället(start, 4, 2);
        const tredje = sistaTillfället(start, 3, 2);
        expect(tillfällenKvarFrån(tredje, slut, 2)).toBe(2);
    });
});

describe('serieFält', () => {
    it('av = repeatWeekly false (städningen vid redigering)', () => {
        expect(serieFält(false, 1, 4)).toEqual({ repeatWeekly: false });
    });

    it('varje vecka tills vidare = bara repeatWeekly', () => {
        expect(serieFält(true, 1, null)).toEqual({
            repeatWeekly: true,
            repeatIntervalWeeks: undefined,
            repeatWeeks: undefined,
        });
    });

    it('varannan vecka 4 gånger = 7 veckor + rytm 2', () => {
        expect(serieFält(true, 2, 4)).toEqual({
            repeatWeekly: true,
            repeatIntervalWeeks: 2,
            repeatWeeks: 7,
        });
    });

    it('daglig kräver antal: null blir 2, taket är 14', () => {
        expect(serieFält(true, 'daglig', 3)).toEqual({ repeatWeekly: false, repeatDays: 3 });
        expect(serieFält(true, 'daglig', null)).toEqual({ repeatWeekly: false, repeatDays: 2 });
        expect(serieFält(true, 'daglig', 99)).toEqual({ repeatWeekly: false, repeatDays: 14 });
    });
});

// ── Etiketterna ─────────────────────────────────────────────────────────────

describe('etiketter', () => {
    const tors = new Date('2026-10-15T19:00:00'); // torsdag

    it('serieRadEtikett: veckodag + klockslag ur valet', () => {
        expect(serieRadEtikett(tors, 1)).toBe('Varje torsdag kl 19:00');
        expect(serieRadEtikett(tors, 2)).toBe('Varannan torsdag kl 19:00');
        expect(serieRadEtikett(tors, 'daglig')).toBe('Varje dag kl 19:00');
    });

    it('sistaGångenEtikett: "tors 15 okt."', () => {
        expect(sistaGångenEtikett(tors)).toBe('tors 15 okt.');
    });

    it('nästaHelaTimmen rundar upp till nästa hela timme', () => {
        expect(nästaHelaTimmen(new Date('2026-10-15T18:12:45')).toISOString())
            .toBe(new Date('2026-10-15T19:00:00').toISOString());
        expect(nästaHelaTimmen(new Date('2026-10-15T19:00:00')).toISOString())
            .toBe(new Date('2026-10-15T20:00:00').toISOString());
    });
});

// ── Felkoderna ──────────────────────────────────────────────────────────────

describe('skapaFelKod/skapaFelText', () => {
    it('plockar koden ur ett Firebase-fel och tvättar den', () => {
        expect(skapaFelKod({ code: 'firestore/permission-denied' })).toBe('firestore/permission-denied');
        expect(skapaFelKod({ code: 'hej <script>' })).toBe('okänt');
        expect(skapaFelKod(new Error('boom'))).toBe('okänt');
    });

    it('fasta texter per felklass, aldrig serverns egna', () => {
        expect(skapaFelText('firestore/permission-denied')).toContain('Eventet nekades');
        expect(skapaFelText('auth/admin-restricted-operation')).toContain('tipsa utan konto');
        expect(skapaFelText('auth/network-request-failed')).toContain('Ingen kontakt');
        expect(skapaFelText('okänt')).toBe('Kunde inte skapa eventet. Försök igen.');
    });
});

// ── Dokumentbyggarna ────────────────────────────────────────────────────────

const BAS = {
    title: '  Pubquiz  ',
    time: new Date('2026-10-15T19:00:00'),
    lat: 59.3,
    lng: 18.1,
    hostName: 'Test',
};

describe('nyttEventDok', () => {
    it('grunddokumentet: trimmat, status published, hidden 0, inga valfria fält', () => {
        const dok = nyttEventDok({ ...BAS, hostUid: 'u1' });
        expect(dok).toEqual({
            title: 'Pubquiz',
            time: BAS.time,
            lat: 59.3,
            lng: 18.1,
            locationName: '',
            category: 'other',
            description: '',
            hostName: 'Test',
            hostUid: 'u1',
            userCreated: true,
            status: 'published',
            hidden: 0,
            url: '',
            isLocationVerified: true,
        });
    });

    it('valfria fält skrivs bara med värde: tomt pris/bild/isTip utelämnas', () => {
        const dok = nyttEventDok({ ...BAS, hostUid: 'u1', price: '', coverImage: '', isTip: false });
        expect('price' in dok).toBe(false);
        expect('coverImage' in dok).toBe(false);
        expect('isTip' in dok).toBe(false);
        expect('anonTip' in dok).toBe(false);
    });

    it('tips med länk och anonym session märks', () => {
        const dok = nyttEventDok({ ...BAS, hostUid: 'u1', isTip: true, anonTip: true, url: 'https://x.se/' });
        expect(dok.isTip).toBe(true);
        expect(dok.anonTip).toBe(true);
        expect(dok.url).toBe('https://x.se/');
    });

    it('priset klipps vid 40 tecken (reglernas tak)', () => {
        const dok = nyttEventDok({ ...BAS, hostUid: 'u1', price: 'x'.repeat(50) });
        expect((dok.price as string).length).toBe(40);
    });

    it('dagsserie utesluter veckoserien - ett dokument bär aldrig båda', () => {
        const dok = nyttEventDok({ ...BAS, hostUid: 'u1', repeatWeekly: true, repeatWeeks: 4, repeatDays: 3 });
        expect(dok.repeatDays).toBe(3);
        expect('repeatWeekly' in dok).toBe(false);
        expect('repeatWeeks' in dok).toBe(false);
    });

    it('veckoserie: rytm 2 skrivs, rytm 1 utelämnas (default)', () => {
        const varannan = nyttEventDok({ ...BAS, hostUid: 'u1', repeatWeekly: true, repeatWeeks: 7, repeatIntervalWeeks: 2 });
        expect(varannan).toMatchObject({ repeatWeekly: true, repeatWeeks: 7, repeatIntervalWeeks: 2 });
        const varje = nyttEventDok({ ...BAS, hostUid: 'u1', repeatWeekly: true, repeatIntervalWeeks: 1 });
        expect(varje.repeatWeekly).toBe(true);
        expect('repeatIntervalWeeks' in varje).toBe(false);
        expect('repeatWeeks' in varje).toBe(false);
    });
});

describe('ändratEventDok', () => {
    it('tomma valfria fält RADERAS - inget pris ska betyda inget pris-chip', () => {
        const { sätt, radera } = ändratEventDok(BAS);
        expect(sätt.title).toBe('Pubquiz');
        expect(radera).toEqual(
            expect.arrayContaining(['price', 'coverImage', 'isTip', 'repeatWeekly', 'repeatWeeks', 'repeatIntervalWeeks', 'repeatDays']),
        );
        expect('price' in sätt).toBe(false);
    });

    it('dagsserie städar bort veckoseriens fält (och tvärtom)', () => {
        const dag = ändratEventDok({ ...BAS, repeatWeekly: true, repeatWeeks: 4, repeatDays: 3 });
        expect(dag.sätt.repeatDays).toBe(3);
        expect(dag.radera).toEqual(expect.arrayContaining(['repeatWeekly', 'repeatWeeks', 'repeatIntervalWeeks']));

        const vecka = ändratEventDok({ ...BAS, repeatWeekly: true, repeatWeeks: 7, repeatIntervalWeeks: 2 });
        expect(vecka.sätt).toMatchObject({ repeatWeekly: true, repeatWeeks: 7, repeatIntervalWeeks: 2 });
        expect(vecka.radera).toContain('repeatDays');
    });

    it('ifyllda fält sätts: pris klipps, bild och isTip behålls', () => {
        const { sätt, radera } = ändratEventDok({
            ...BAS,
            price: '120 kr',
            coverImage: 'https://bild.se/x.jpg',
            isTip: true,
            url: 'https://x.se/',
        });
        expect(sätt.price).toBe('120 kr');
        expect(sätt.coverImage).toBe('https://bild.se/x.jpg');
        expect(sätt.isTip).toBe(true);
        expect(sätt.url).toBe('https://x.se/');
        expect(radera).not.toContain('price');
    });
});

// ── Redigeringens förifyllnad ───────────────────────────────────────────────

describe('redigeringsStart', () => {
    it('eget event utan serie: host, tiden rakt av, ingen serie', () => {
        const s = redigeringsStart({ time: new Date('2026-10-15T19:00:00') });
        expect(s).toEqual({ roll: 'host', tid: new Date('2026-10-15T19:00:00'), serie: false, rytm: 1, gånger: null });
    });

    it('tips (isTip eller url) landar på tips-fliken', () => {
        expect(redigeringsStart({ time: new Date(), isTip: true }).roll).toBe('tip');
        expect(redigeringsStart({ time: new Date(), url: 'https://x.se/' }).roll).toBe('tip');
    });

    it('dagsserie redigerad från dag 2 visar HELA serien från första dagen', () => {
        const s = redigeringsStart({
            time: new Date('2026-10-16T11:00:00'),
            repeatDays: 3,
            seriesEndsAt: new Date('2026-10-17T11:00:00'),
        });
        expect(s.tid.toISOString()).toBe(new Date('2026-10-15T11:00:00').toISOString());
        expect(s.rytm).toBe('daglig');
        expect(s.gånger).toBe(3);
    });

    it('begränsad veckoserie: antalet räknas från tillfället man redigerar', () => {
        // Serie på 4 gånger varje vecka; redigeras från tredje tillfället → 2 kvar.
        const start = new Date('2026-10-15T19:00:00');
        const tredje = new Date('2026-10-29T19:00:00');
        const s = redigeringsStart({
            time: tredje,
            repeatWeekly: true,
            seriesEndsAt: sistaTillfället(start, 4, 1),
        });
        expect(s.rytm).toBe(1);
        expect(s.gånger).toBe(2);
        expect(s.serie).toBe(true);
    });

    it('tills vidare-serie: gånger null', () => {
        const s = redigeringsStart({ time: new Date(), repeatWeekly: true });
        expect(s.gånger).toBeNull();
        expect(s.serie).toBe(true);
    });
});
