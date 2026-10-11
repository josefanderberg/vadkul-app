/**
 * Skapa/redigera event-formulärets rena logik - port av webbens
 * utils/weeklySeries.ts (formdelen: seriesFieldsFor, weeksForOccurrences,
 * lastOccurrenceFor, occurrencesLeftFrom), utils/priceLabel.ts
 * (normalizePriceLabel), utils/tipUrl.ts (normalizeTipUrl),
 * services/linkEventService.ts (createUserEvent/updateUserEvent:s
 * payload-beslut) och app/(v2)/page.tsx (felkoderna, val-listorna,
 * serieetiketterna, handleEditOwnEvent:s förifyllnad). Ändras webben ska
 * kopian följa.
 *
 * Ingen Firebase-import här: dokumentbyggarna lämnar `time` som Date och
 * raderingslistan som strängar - data/egnaEvent sätter Timestamp,
 * serverTimestamp och deleteField. Så går allt att testa utan nät.
 *
 * APP-ANPASSNING: datumetiketterna byggs ur anvandarEvents tabeller i stället
 * för toLocaleDateString (Hermes Intl skiljer mellan plattformarna).
 */
import {
    dagsseriensStart,
    läggTillDagar,
    MAX_REPEAT_DAYS,
    MÅNAD_KORT,
    normaliseraDagar,
    normaliseraRytm,
    seriensSistaDatum,
    seriensSlut,
    VECKODAG_LÅNG,
    type SerieRegel,
} from './anvandarEvent';
import { VECKODAGAR } from './eventTid';

// ── Serier: formulärets val → dokumentets fält ──────────────────────────────

/** Formulärets rytmval (webbens RepeatRhythm): 1 = varje vecka, 2 = varannan, 'daglig' = dagar i rad. */
export type Rytm = 1 | 2 | 'daglig';

/**
 * Hur många GÅNGER en serie kan pågå (webbens REPEAT_TIMES_CHOICES). 2-12 en
 * och en, sedan glesare terminslängder. Med varannan vecka filtreras de
 * högsta bort i formuläret: reglernas tak är 52 VECKOR, alltså 26 gånger.
 */
export const GÅNGER_VAL = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 16, 20, 26, 52];

/** Dagsseriens val (webbens REPEAT_DAYS_CHOICES): 2 till MAX_REPEAT_DAYS dagar. */
export const DAGAR_VAL = Array.from({ length: MAX_REPEAT_DAYS - 1 }, (_, i) => i + 2);

/**
 * Så många VECKOR måste repeatWeeks vara för att rymma `gånger` tillfällen
 * (weeksForOccurrences). Med varannan vecka alltid ojämnt antal - sista
 * veckan ÄR ett tillfälle, aldrig en tom mellanvecka.
 */
export function veckorFörTillfällen(gånger: number, rytm: number | null | undefined): number {
    const n = Math.max(1, Math.floor(gånger));
    return (n - 1) * normaliseraRytm(rytm) + 1;
}

/** Sista tillfällets datum för formulärets val (lastOccurrenceFor) - förhandsraden "sista gången". */
export function sistaTillfället(start: Date, gånger: number, rytm: Rytm): Date {
    return rytm === 'daglig'
        ? läggTillDagar(start, Math.max(1, Math.floor(gånger)) - 1)
        : seriensSistaDatum(start, gånger, rytm);
}

/**
 * Hur många tillfällen återstår FRÅN ett tillfälle till seriens slut,
 * tillfället självt inräknat (occurrencesLeftFrom). Används vid redigering
 * mitt i en serie: formulärets tid blir seriens nya start, så antalet måste
 * räknas om därifrån - annars förlängs serien för varje redigering.
 */
export function tillfällenKvarFrån(tillfälle: Date, slut: Date, rytm: number | null | undefined): number {
    const steg = normaliseraRytm(rytm);
    const markör = new Date(tillfälle);
    let n = 1;
    // Begränsad: reglerna tillåter max 52 veckor, alltså max 52 tillfällen.
    while (n < 52) {
        markör.setDate(markör.getDate() + steg * 7);
        if (markör.getTime() > slut.getTime()) break;
        n++;
    }
    return n;
}

/** Seriefälten ett dokument kan bära (delmängd av EventInmatning nedan). */
export interface SerieFält {
    repeatWeekly?: boolean;
    repeatIntervalWeeks?: number;
    repeatWeeks?: number;
    repeatDays?: number;
}

/**
 * Formulärets upprepningsval → dokumentets fält (seriesFieldsFor). Dagsserier
 * kräver ett antal: "tills vidare" finns inte för dem, så null/skräp blir 2.
 */
export function serieFält(på: boolean, rytm: Rytm, gånger: number | null): SerieFält {
    if (!på) return { repeatWeekly: false };
    if (rytm === 'daglig') {
        const n = typeof gånger === 'number' && Number.isFinite(gånger) ? Math.floor(gånger) : 2;
        return { repeatWeekly: false, repeatDays: Math.min(MAX_REPEAT_DAYS, Math.max(2, n)) };
    }
    return {
        repeatWeekly: true,
        repeatIntervalWeeks: rytm === 2 ? 2 : undefined,
        repeatWeeks: gånger ? veckorFörTillfällen(gånger, rytm) : undefined,
    };
}

// ── Formulärets etiketter ───────────────────────────────────────────────────

/**
 * "Varje torsdag kl 19:00" (webbens weeklyLabelFor) - veckodagen och tiden en
 * serie ärver från det valda datumet.
 */
export function serieRadEtikett(d: Date, rytm: Rytm): string {
    const tid = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    if (rytm === 'daglig') return `Varje dag kl ${tid}`;
    return `${rytm === 2 ? 'Varannan' : 'Varje'} ${VECKODAG_LÅNG[d.getDay()]} kl ${tid}`;
}

/** "tors 8 okt." - förhandsraden "sista gången" (webbens seriesEndPreview-format). */
export function sistaGångenEtikett(d: Date): string {
    return `${VECKODAGAR[d.getDay()]} ${d.getDate()} ${MÅNAD_KORT[d.getMonth()]}`;
}

/** Förifylld tid: nästa hela timme (webbens openCreateFormHere). */
export function nästaHelaTimmen(nu: Date = new Date()): Date {
    const t = new Date(nu);
    t.setMinutes(0, 0, 0);
    t.setHours(t.getHours() + 1);
    return t;
}

// ── Pris (utils/priceLabel.ts) ──────────────────────────────────────────────

const GRATIS_MÖNSTER = /^(gratis|fri(\s+entr[eé])?|avgiftsfritt|kostnadsfritt|konstnadsfritt|free)$/i;

/**
 * Normalisera pris-strängen till samma etikett som de skrapade eventen bär:
 * "120" → "120 kr", "fri entré" → "Gratis". null = inget pris att visa.
 */
export function normaliseraPris(pris: number | string | undefined | null): string | null {
    if (pris === undefined || pris === null || pris === '') return null;
    const s = String(pris).trim();
    if (!s) return null;

    if (s === '0' || GRATIS_MÖNSTER.test(s)) return 'Gratis';

    // "160:-" → "160 kr" (svensk valutanotation utan decimaler).
    const baraStreck = s.match(/^(\d+(?:[.,]\d+)?)\s*:?-$/);
    if (baraStreck) return `${baraStreck[1]} kr`;

    // Rena tal / intervall: "40", "20-50", "12,50".
    if (/^\d+(?:[.,]\d+)?(?:\s*[–-]\s*\d+(?:[.,]\d+)?)?$/.test(s)) return `${s} kr`;

    // "30kr" (saknar mellanslag) eller "40 SEK" → "30 kr" / "40 kr".
    const medValuta = s.match(/^(\d+(?:[.,]\d+)?(?:\s*[–-]\s*\d+(?:[.,]\d+)?)?)\s*(kr|sek|:-|:−)$/i);
    if (medValuta) return `${medValuta[1]} kr`;

    return s;
}

// ── Tips-länken (utils/tipUrl.ts) ───────────────────────────────────────────

/**
 * Osynliga tecken som följer med när man kopierar en länk (LRM/RLM, bidi,
 * nollbredd, BOM, mjukt bindestreck). FB och mobilernas dela-menyer lägger
 * gärna på " ‎" efter länken; trim() rör dem inte och new URL() kodar
 * dem snällt till %20%E2%80%8E i sökvägen. \u-koder med flit - bokstavliga
 * osynliga tecken i källkod kan tyst försvinna i en editor.
 */
const OSYNLIGA_TECKEN = /[­​-‏‪-‮⁠-⁤⁦-⁩﻿]/g;

/** Samma skräp i redan kodad form sist i en URL - lagar gamla sparade tips vid redigering. */
const KODAT_SKRÄP_SIST = /(?:%20|%C2%A0|%C2%AD|%E2%80%8[B-F]|%E2%80%A[A-E]|%E2%81%A[0-46-9]|%EF%BB%BF)+$/i;

/**
 * Normalisera tips-länken: osynliga tecken bort, protokoll saknas → https://,
 * sedan måste det bli en riktig http(s)-URL med punkt i domänen
 * ("aftonbladet" räcker inte, "javascript:…" stoppas). null = ogiltig →
 * Tipsa-knappen hålls inaktiv.
 */
export function normaliseraTipsLänk(rå: string): string | null {
    const trimmad = rå.replace(OSYNLIGA_TECKEN, '').trim();
    if (!trimmad) return null;
    const medProto = /^https?:\/\//i.test(trimmad) ? trimmad : `https://${trimmad}`;
    try {
        const u = new URL(medProto);
        if ((u.protocol !== 'http:' && u.protocol !== 'https:') || !u.hostname.includes('.')) return null;
        return u.toString().replace(KODAT_SKRÄP_SIST, '');
    } catch { return null; }
}

// ── Feltexterna (page.tsx createEventErrorCode/Text) ────────────────────────

/**
 * Plocka ut felkoden - och BARA koden. Ett Firebase-fel bär serverns
 * meddelande och ibland hela payloaden; koden tvättas mot en teckenmask så
 * ett oväntat fel aldrig skriver fritext till loggen.
 */
export function skapaFelKod(fel: unknown): string {
    const rå = typeof fel === 'object' && fel !== null && 'code' in fel
        ? String((fel as { code: unknown }).code)
        : '';
    return /^[a-z][a-z0-9/_-]{2,48}$/i.test(rå) ? rå : 'okänt';
}

/** Begriplig svenska per felklass - fasta texter, aldrig serverns egna meddelanden. */
export function skapaFelText(kod: string): string {
    if (kod.includes('admin-restricted-operation') || kod.includes('operation-not-allowed'))
        return 'Just nu går det inte att tipsa utan konto. Logga in - eller mejla tipset till hej@vadkul.se så lägger vi in det åt dig.';
    if (kod.includes('network-request-failed') || kod.includes('unavailable') || kod.includes('deadline-exceeded'))
        return 'Ingen kontakt med servern - kolla uppkopplingen och försök igen.';
    if (kod.includes('permission-denied') || kod.includes('unauthenticated'))
        return 'Eventet nekades. Kolla att titel, tid och plats är ifyllda - hjälper det inte, mejla hej@vadkul.se.';
    if (kod.includes('resource-exhausted') || kod.includes('too-many-requests'))
        return 'För många försök just nu - vänta en minut och försök igen.';
    return 'Kunde inte skapa eventet. Försök igen.';
}

// ── Dokumentbyggarna (linkEventService createUserEvent/updateUserEvent) ─────

/** Formulärets färdiga värden - samma form som webbens service-input. */
export interface EventInmatning extends SerieFält {
    title: string;
    time: Date;
    lat: number;
    lng: number;
    locationName?: string;
    category?: string;
    description?: string;
    /** Färdig etikett ("120 kr", "Gratis") - normaliseras i formuläret. */
    price?: string;
    hostName: string;
    coverImage?: string;
    url?: string;
    isTip?: boolean;
}

/**
 * createUserEvent:s payload - utan Firebase-typerna: `time` förblir Date och
 * createdAt stämplas i data/egnaEvent. Reglernas hasOnly-lista avgör formen:
 * valfria fält skrivs BARA när de har värde (tomt pris är inte gratis, och
 * isTip: false hade tvingat in fältet i reglernas lista i onödan).
 */
export function nyttEventDok(
    input: EventInmatning & { hostUid: string; anonTip?: boolean },
): Record<string, unknown> {
    const dok: Record<string, unknown> = {
        title: input.title.trim(),
        time: input.time,
        lat: input.lat,
        lng: input.lng,
        locationName: input.locationName?.trim() || '',
        category: input.category || 'other',
        description: input.description?.trim() || '',
        hostName: input.hostName,
        hostUid: input.hostUid,
        userCreated: true,
        status: 'published',
        hidden: 0,
        url: input.url || '',
        isLocationVerified: true,
    };
    if (input.coverImage) dok.coverImage = input.coverImage;
    if (input.price) dok.price = input.price.slice(0, 40);
    if (input.isTip) dok.isTip = true;
    // Måste sättas exakt när sessionen är anonym - reglerna jämför fältet mot
    // sign_in_provider. Det är märkningen som gör tipset raderbart för alla.
    if (input.anonTip) dok.anonTip = true;
    // Dagsserie: bara antalet dagar skrivs. Den utesluter veckoserien, så ett
    // dokument bär aldrig båda.
    const dagar = normaliseraDagar(input.repeatDays);
    if (dagar !== null) {
        dok.repeatDays = dagar;
    } else if (input.repeatWeekly) {
        dok.repeatWeekly = true;
        // Bara med när ägaren valt en begränsning - utelämnat = tills vidare.
        if (input.repeatWeeks && input.repeatWeeks >= 1) dok.repeatWeeks = Math.floor(input.repeatWeeks);
        // Rytm: bara varannan vecka (2) skrivs - varje vecka är default.
        if (input.repeatIntervalWeeks === 2) dok.repeatIntervalWeeks = 2;
    }
    return dok;
}

/**
 * updateUserEvent:s beslut: fält att sätta + fält att RADERA ur dokumentet
 * (deleteField sätts i data/egnaEvent, liksom updatedAt-stämpeln). Tomma
 * valfria fält raderas - "inget pris" ska betyda inget pris-chip, inte en
 * kvarglömd etikett. En dagsserie städar bort veckoseriens fält (och tvärtom).
 */
export function ändratEventDok(input: EventInmatning): { sätt: Record<string, unknown>; radera: string[] } {
    const dagar = normaliseraDagar(input.repeatDays);
    const veckovis = dagar === null && !!input.repeatWeekly;
    const sätt: Record<string, unknown> = {
        title: input.title.trim(),
        time: input.time,
        lat: input.lat,
        lng: input.lng,
        locationName: input.locationName?.trim() || '',
        category: input.category || 'other',
        description: input.description?.trim() || '',
        hostName: input.hostName,
        url: input.url || '',
    };
    const radera: string[] = [];
    const sättEllerRadera = (nyckel: string, värde: unknown) => {
        if (värde === undefined) radera.push(nyckel);
        else sätt[nyckel] = värde;
    };
    sättEllerRadera('price', input.price ? input.price.slice(0, 40) : undefined);
    sättEllerRadera('coverImage', input.coverImage || undefined);
    sättEllerRadera('isTip', input.isTip ? true : undefined);
    sättEllerRadera('repeatWeekly', veckovis ? true : undefined);
    sättEllerRadera('repeatWeeks', veckovis && input.repeatWeeks && input.repeatWeeks >= 1
        ? Math.floor(input.repeatWeeks)
        : undefined);
    sättEllerRadera('repeatIntervalWeeks', veckovis && input.repeatIntervalWeeks === 2 ? 2 : undefined);
    sättEllerRadera('repeatDays', dagar ?? undefined);
    return { sätt, radera };
}

// ── Redigeringens förifyllnad (page.tsx handleEditOwnEvent) ─────────────────

export interface RedigeringsStart {
    roll: 'host' | 'tip';
    /** Formulärets tid: dagsserier visar HELA serien från första dagen. */
    tid: Date;
    serie: boolean;
    rytm: Rytm;
    /** Antal gånger/dagar; null = tills vidare. */
    gånger: number | null;
}

/**
 * Formulärets startvärden ur eventet som redigeras. Dagsserien visas från
 * första dagen (annars krympte "3 dagar" vid redigering från dag 2);
 * veckoseriens antal räknas från DET TILLFÄLLE man redigerar fram till
 * seriens slut - dess tid blir seriens nya start.
 */
export function redigeringsStart(e: SerieRegel & { isTip?: boolean; url?: string }): RedigeringsStart {
    const dagar = normaliseraDagar(e.repeatDays);
    const serieSlut = seriensSlut(e);
    return {
        roll: e.isTip || e.url ? 'tip' : 'host',
        tid: (dagar !== null ? dagsseriensStart(e) : null) ?? e.time,
        serie: dagar !== null || !!e.repeatWeekly,
        rytm: dagar !== null ? 'daglig' : e.repeatIntervalWeeks === 2 ? 2 : 1,
        gånger: dagar !== null
            ? dagar
            : serieSlut
            ? tillfällenKvarFrån(e.time, serieSlut, e.repeatIntervalWeeks)
            : null,
    };
}
