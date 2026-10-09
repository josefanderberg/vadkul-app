/**
 * Användarskapade event (egna VADKUL-event och tips) - port av webbens
 * services/linkEventService.ts (fetchUserCreatedEvents: mappningen och
 * filtret) och utils/weeklySeries.ts (serieräknandet + seriesLabel). Ändras
 * webben ska kopian följa.
 *
 * Dokumenten hämtas av data/anvandarEvent; här bor bara tolkningen, så den
 * går att testa utan Firebase. `time` kan därför vara en Firestore Timestamp
 * (har toDate()), en Date eller en sträng - ingen Firebase-import här.
 *
 * Serier lagras som EN regel på dokumentet och vecklas ut till konkreta
 * tillfällen från dagens midnatt, precis som på webben: id "<docId>__<datum>",
 * docId pekar tillbaka på dokumentet.
 *
 * APP-ANPASSNING: datumetiketterna byggs ur egna tabeller i stället för
 * toLocaleDateString('sv-SE') (Hermes Intl skiljer mellan plattformarna, jfr
 * eventTid) - tabellerna ger exakt webbens text, testerna låser det.
 */
import type { AppEvent } from './appEvent';
import { VECKODAGAR } from './eventTid';

/** Taket för dagsserier (webbens MAX_REPEAT_DAYS, speglas i reglerna). */
export const MAX_REPEAT_DAYS = 14;

/**
 * Hur långt fram en veckoserie vecklas ut (webbens WEEKLY_HORIZON_WEEKS).
 * Ett kvartals pubquiz räcker och håller nere antalet brickor.
 */
const HORISONT_VECKOR = 12;

const VECKODAG_LÅNG = ['söndag', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag'];
const MÅNAD_KORT = ['jan.', 'feb.', 'mars', 'apr.', 'maj', 'juni', 'juli', 'aug.', 'sep.', 'okt.', 'nov.', 'dec.'];

/** Seriefälten med riktiga Date - räknandet jobbar på dem, AppEvent bär ISO-strängar. */
export interface SerieRegel {
    time: Date;
    repeatWeekly?: boolean;
    repeatWeeks?: number;
    repeatIntervalWeeks?: number;
    repeatDays?: number;
    seriesEndsAt?: Date;
}

// ── Tid ─────────────────────────────────────────────────────────────────────

/** Firestore Timestamp (toDate()), Date eller sträng/tal → Date. null = ogiltig. */
export function tolkaTid(v: unknown): Date | null {
    let d: Date | null = null;
    if (v instanceof Date) d = v;
    else if (v && typeof v === 'object' && typeof (v as { toDate?: unknown }).toDate === 'function') {
        d = (v as { toDate: () => Date }).toDate();
    } else if (typeof v === 'string' || typeof v === 'number') d = new Date(v);
    return d && !Number.isNaN(d.getTime()) ? d : null;
}

/**
 * Midnatt lokal tid = bara ett datum, inget klockslag (webbens
 * deriveHasSpecificTime). Användarskapade event lagrar ingen egen flagga.
 */
export function harKlockslag(t: Date): boolean {
    return !(t.getHours() === 0 && t.getMinutes() === 0);
}

/** `d` plus `dagar` dagar, samma klockslag. setDate så sommartidsbytet inte knuffar klockslaget. */
export function läggTillDagar(d: Date, dagar: number): Date {
    const out = new Date(d);
    out.setDate(out.getDate() + dagar);
    return out;
}

// ── Serieräknandet (webbens utils/weeklySeries) ─────────────────────────────

/** Rytmen som heltal: 2 = varannan vecka. Allt annat = varje vecka (normalizeIntervalWeeks). */
export function normaliseraRytm(v: unknown): number {
    return typeof v === 'number' && Number.isInteger(v) && v >= 2 ? v : 1;
}

/** Antal dagar i en dagsserie (2-MAX_REPEAT_DAYS), annars null (normalizeRepeatDays). */
export function normaliseraDagar(v: unknown): number | null {
    return typeof v === 'number' && Number.isInteger(v) && v >= 2 && v <= MAX_REPEAT_DAYS ? v : null;
}

/** Är eventet en serie av något slag, dagar i rad eller veckovis (isSeriesEvent)? */
export function ärSerie(e: Pick<AppEvent, 'repeatWeekly' | 'repeatDays'>): boolean {
    return normaliseraDagar(e.repeatDays) !== null || !!e.repeatWeekly;
}

/**
 * Hur många TILLFÄLLEN ryms i en serie på `veckor` veckor med given rytm
 * (occurrencesForWeeks). null = tills vidare.
 */
export function tillfällenFörVeckor(veckor: unknown, rytm: unknown): number | null {
    if (typeof veckor !== 'number' || !Number.isFinite(veckor) || veckor < 1) return null;
    return Math.floor((Math.floor(veckor) - 1) / normaliseraRytm(rytm)) + 1;
}

/** Sista tillfällets datum för en serie som startar `start` och pågår `gånger` gånger (seriesLastDate). */
export function seriensSistaDatum(start: Date, gånger: number, rytm: unknown): Date {
    const out = new Date(start);
    out.setDate(out.getDate() + (Math.max(1, Math.floor(gånger)) - 1) * normaliseraRytm(rytm) * 7);
    return out;
}

/**
 * Seriens slutdatum (seriesEndDate). Utvecklade tillfällen bär seriesEndsAt -
 * deras egen tid är tillfällets, inte seriens start. null = tills vidare
 * eller ingen serie.
 */
export function seriensSlut(e: SerieRegel): Date | null {
    const dagar = normaliseraDagar(e.repeatDays);
    if (dagar !== null) return e.seriesEndsAt ?? läggTillDagar(e.time, dagar - 1);
    if (!e.repeatWeekly) return null;
    if (e.seriesEndsAt) return e.seriesEndsAt;
    const gånger = tillfällenFörVeckor(e.repeatWeeks, e.repeatIntervalWeeks);
    return gånger === null ? null : seriensSistaDatum(e.time, gånger, e.repeatIntervalWeeks);
}

/**
 * Dagsseriens FÖRSTA dag, även från ett utvecklat tillfälle: räknas bakåt
 * från seriesEndsAt (dailySeriesStart). null för allt som inte är en dagsserie.
 */
export function dagsseriensStart(e: Pick<SerieRegel, 'time' | 'repeatDays' | 'seriesEndsAt'>): Date | null {
    const dagar = normaliseraDagar(e.repeatDays);
    if (dagar === null) return null;
    return e.seriesEndsAt ? läggTillDagar(e.seriesEndsAt, -(dagar - 1)) : e.time;
}

/** "31 okt." - årtal bara när datumet ligger i ett annat år än nu (seriesDateLabel). */
export function slutEtikett(d: Date, nu: Date = new Date()): string {
    const år = d.getFullYear() === nu.getFullYear() ? '' : ` ${d.getFullYear()}`;
    return `${d.getDate()} ${MÅNAD_KORT[d.getMonth()]}${år}`;
}

/** "lör 10-sön 11 okt." eller "fre 30 okt.-sön 1 nov." (dayRangeLabel). */
export function dagSpann(start: Date, slut: Date, nu: Date = new Date()): string {
    const sammaMånad = start.getMonth() === slut.getMonth() && start.getFullYear() === slut.getFullYear();
    const från = `${VECKODAGAR[start.getDay()]} ${start.getDate()}${sammaMånad ? '' : ` ${MÅNAD_KORT[start.getMonth()]}`}`;
    return `${från}-${VECKODAGAR[slut.getDay()]} ${slutEtikett(slut, nu)}`;
}

/**
 * Raden på eventet (seriesLabel): "Varannan lördag · t.o.m. 31 okt.",
 * "Varje lördag · tills vidare" eller "2 dagar · lör 10-sön 11 okt.".
 * null för allt som inte är en serie.
 */
export function serieEtikett(e: SerieRegel, nu: Date = new Date()): string | null {
    const dagar = normaliseraDagar(e.repeatDays);
    if (dagar !== null) {
        const start = dagsseriensStart(e)!;
        return `${dagar} dagar · ${dagSpann(start, läggTillDagar(start, dagar - 1), nu)}`;
    }
    if (!e.repeatWeekly) return null;
    const rytm = `${normaliseraRytm(e.repeatIntervalWeeks) === 2 ? 'Varannan' : 'Varje'} ${VECKODAG_LÅNG[e.time.getDay()]}`;
    const slut = seriensSlut(e);
    return `${rytm} · ${slut ? `t.o.m. ${slutEtikett(slut, nu)}` : 'tills vidare'}`;
}

/** Seriens rytmetikett för ett AppEvent (null för skrapade event och engångsevent). */
export function seriensRytm(e: AppEvent, nu: Date = new Date()): string | null {
    const time = tolkaTid(e.time);
    if (!time) return null;
    return serieEtikett({
        time,
        repeatWeekly: e.repeatWeekly,
        repeatWeeks: e.repeatWeeks,
        repeatIntervalWeeks: e.repeatIntervalWeeks,
        repeatDays: e.repeatDays,
        seriesEndsAt: tolkaTid(e.seriesEndsAt) ?? undefined,
    }, nu);
}

/**
 * Veckla ut en serie till konkreta tillfällen från och med `från` och
 * HORISONT_VECKOR framåt (expandSeries). Varje tillfälle får ett eget id
 * "<id>__ÅÅÅÅ-MM-DD" - kartan och React-nycklarna kräver unika id. En
 * färdigspelad serie ger [].
 */
export function vecklaUtSerie<T extends SerieRegel & { id: string }>(
    bas: T,
    från: Date,
): (T & { id: string; time: Date; seriesEndsAt?: Date })[] {
    const out: (T & { id: string; time: Date; seriesEndsAt?: Date })[] = [];
    const horisont = läggTillDagar(från, HORISONT_VECKOR * 7);

    // Dagsserien tar slut efter repeatDays dagar, en begränsad veckoserie
    // vid sista TILLFÄLLET (8 veckor varannan vecka = fjärde gången i vecka
    // 7). Utan repeatWeeks rullar veckoserien tills vidare.
    const dagar = normaliseraDagar(bas.repeatDays);
    let slut: Date | null;
    let steg: number;
    if (dagar !== null) {
        slut = läggTillDagar(bas.time, dagar - 1);
        steg = 1;
    } else {
        const gånger = tillfällenFörVeckor(bas.repeatWeeks, bas.repeatIntervalWeeks);
        slut = gånger === null ? null : seriensSistaDatum(bas.time, gånger, bas.repeatIntervalWeeks);
        steg = 7 * normaliseraRytm(bas.repeatIntervalWeeks);
    }
    if (slut && slut < horisont) horisont.setTime(slut.getTime());

    // Stega från BASEN fram till `från`: en serie som startade i våras börjar
    // vid nästa kommande tillfälle, och pariteten bevaras (varannan vecka
    // hamnar aldrig på fel vecka).
    const markör = new Date(bas.time);
    while (markör < från) markör.setDate(markör.getDate() + steg);

    while (markör <= horisont) {
        const y = markör.getFullYear();
        const m = String(markör.getMonth() + 1).padStart(2, '0');
        const d = String(markör.getDate()).padStart(2, '0');
        out.push({
            ...bas,
            id: `${bas.id}__${y}-${m}-${d}`,
            seriesEndsAt: slut ?? undefined,
            time: new Date(markör),
        });
        markör.setDate(markör.getDate() + steg);
    }
    return out;
}

// ── Dokument → AppEvent ─────────────────────────────────────────────────────

/** Ett tolkat dokument innan tiderna blir ISO-strängar. */
type Tolkat = Omit<AppEvent, 'time' | 'seriesEndsAt'> & { time: Date; seriesEndsAt?: Date };

const text = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);

/** Webbens map-steg för ett dokument. null = ogiltig tid (webben tappar dem i filtret). */
function tolkaDokument(id: string, v: Record<string, unknown>): Tolkat | null {
    const time = tolkaTid(v.time);
    if (!time) return null;
    const url = text(v.url);
    return {
        id,
        docId: id,
        title: text(v.title) ?? '',
        time,
        hasSpecificTime: harKlockslag(time),
        lat: Number(v.lat) || 0,
        lng: Number(v.lng) || 0,
        locationName: text(v.locationName),
        category: text(v.category) ?? 'other',
        emoji: text(v.emoji),
        img: text(v.coverImage),
        // Tips med länk har url; eget event har ingen (inget tomt fält).
        ...(url ? { url } : {}),
        userCreated: true,
        isTip: !!v.isTip,
        anonTip: !!v.anonTip,
        hostName: text(v.hostName) ?? 'VADKUL-användare',
        hostUid: text(v.hostUid),
        description: text(v.description),
        price: typeof v.price === 'number' || typeof v.price === 'string' ? v.price : undefined,
        repeatWeekly: !!v.repeatWeekly,
        repeatWeeks: typeof v.repeatWeeks === 'number' && v.repeatWeeks >= 1 ? Math.floor(v.repeatWeeks) : undefined,
        // Utan rytmen vecklades en varannan vecka-serie ut VARJE vecka (webben 15/9).
        repeatIntervalWeeks: typeof v.repeatIntervalWeeks === 'number' && v.repeatIntervalWeeks >= 2
            ? Math.floor(v.repeatIntervalWeeks) : undefined,
        repeatDays: normaliseraDagar(v.repeatDays) ?? undefined,
    };
}

function tillAppEvent({ time, seriesEndsAt, ...rest }: Tolkat): AppEvent {
    return {
        ...rest,
        time: time.toISOString(),
        ...(seriesEndsAt ? { seriesEndsAt: seriesEndsAt.toISOString() } : {}),
    };
}

/**
 * linkEvents-dokumenten (userCreated == true) → appens event. Titel krävs,
 * gömda (hidden) faller bort. Engångsevent före dagens midnatt faller bort;
 * serier filtreras INTE på datum - en veckoserie som startade för ett halvår
 * sedan är fortfarande aktuell, den vecklas ut från dagens midnatt.
 */
export function tolkaAnvändarEvent(docs: { id: string; data: Record<string, unknown> }[], nu: Date): AppEvent[] {
    const midnatt = new Date(nu);
    midnatt.setHours(0, 0, 0, 0);
    return docs.flatMap(({ id, data }) => {
        if (data.hidden) return [];
        const e = tolkaDokument(id, data);
        if (!e || !e.title) return [];
        if (!ärSerie(e)) return e.time >= midnatt ? [tillAppEvent(e)] : [];
        return vecklaUtSerie(e, midnatt).map(tillAppEvent);
    });
}
