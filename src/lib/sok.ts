/**
 * Eventsökets rena logik - port av webbens utils/eventSearch (FB-klagomålet
 * 11/9 + sök-feedbacken 16/9), så appen rankar exakt som webben:
 *
 *  - Nivåer: titeln BÖRJAR på texten → ett ORD i titeln börjar på den → mitt i
 *    titeln → platsen → kategorins namn ("sport") → länken (id:t ÄR käll-URL:en).
 *    Inom en nivå gäller tidsordning.
 *  - Flera ord: varje ord måste träffa något fält, raden får sämsta ordets nivå.
 *  - Ort + event: "jazz i göteborg" - ett ortnamn först/sist (exakt uppslag,
 *    aldrig gissning) begränsar träffarna till 25 km runt orten.
 *  - Ingen fuzzy/autocorrect (avstängd på webben av samma skäl).
 *
 * Orterna är kontraktets CITIES (43 st). Webbens sökorter (utils/cityPoints,
 * 291 st) finns inte i kontraktet än - flyttas de dit får appen dem gratis.
 *
 * APPENS EGNA TILLÄGG (Josef 20/10, före webben: "om jag bara klickar i
 * populära ... då ska det vara de som är närmst en den dagen som ska visas" +
 * "söker jag konst växjö ... då ska jag ju få upp allt med konst i växjö"):
 *  - `tolkaKategorier`: ett HELT kategoriord ("konst", "konserter", "barnen")
 *    i söktexten är kategorin - sökpanelen låter det ersätta chipsen.
 *  - `närmastPerDag`: filterlistan börjar på kartans dag och har det
 *    närmaste först inom varje dag (förr tidsordning över hela Sverige).
 */
import {
    CITIES,
    EVENT_CATEGORY_KEYS,
    type AppFeedEvent,
    type City,
    type EventCategoryType,
} from '@vadkul/kontrakt';
import { dagSektioner, type DagSektion } from './dagar';
import { KATEGORIER } from './kategorier';
import { distanceKm } from './regionVal';
import { dagOffset } from './vy';

export const SEARCH_TIER = {
    TITLE_START: 0,
    TITLE_WORD: 1,
    TITLE_ANY: 2,
    LOCATION: 3,
    CATEGORY: 5,
    URL: 6,
} as const;

/** Radien runt en ort i söktexten (webbens CITY_SEARCH_RADIUS_KM). */
export const CITY_SEARCH_RADIUS_KM = 25;

/** Gemener, trimmad, inre mellanrum ihopslagna (mobilens ordförslag lägger
 *  ett mellanslag efter ordet). */
export function normalizeSearchQuery(raw: string): string {
    return raw.trim().replace(/\s+/g, ' ').toLowerCase();
}

const isWordChar = (ch: string): boolean =>
    ch.toLowerCase() !== ch.toUpperCase() || (ch >= '0' && ch <= '9');

function titleTier(lowerTitle: string, q: string): number {
    let idx = lowerTitle.indexOf(q);
    if (idx < 0) return -1;
    let best: number = SEARCH_TIER.TITLE_ANY;
    while (idx >= 0) {
        const atWordStart = idx === 0 || !isWordChar(lowerTitle[idx - 1]);
        if (atWordStart) {
            const onlyPunctBefore = ![...lowerTitle.slice(0, idx)].some(isWordChar);
            if (onlyPunctBefore) return SEARCH_TIER.TITLE_START;
            best = SEARCH_TIER.TITLE_WORD;
        }
        idx = lowerTitle.indexOf(q, idx + 1);
    }
    return best;
}

/** Orden i kategoriernas svenska namn ("Sport & träning" → sport, träning). */
const CATEGORY_WORDS: { key: string; words: string[] }[] = Object.entries(KATEGORIER)
    .filter(([key]) => key !== 'other')
    .map(([key, k]) => ({
        key,
        words: k.label.toLowerCase().split(/[^a-zåäöéü]+/).filter(w => w.length >= 3),
    }));

/** Prefix åt båda håll men snålt: böjningar får högst tre tecken extra. */
function categoryMatches(category: string, q: string): boolean {
    if (q.length < 3) return false;
    const entry = CATEGORY_WORDS.find(c => c.key === category);
    if (!entry) return false;
    return entry.words.some(w => w.startsWith(q) || (q.startsWith(w) && q.length - w.length <= 3));
}

function fieldTier(e: AppFeedEvent, q: string): number {
    const t = titleTier(e.title.toLowerCase(), q);
    if (t >= 0) return t;
    if (e.locationName?.toLowerCase().includes(q)) return SEARCH_TIER.LOCATION;
    if (categoryMatches(String(e.category), q)) return SEARCH_TIER.CATEGORY;
    if ((e.url ?? e.id).toLowerCase().includes(q)) return SEARCH_TIER.URL;
    return -1;
}

/** Eventets nivå för normaliserad, icke-tom söktext; -1 = ingen träff. */
export function eventSearchTier(e: AppFeedEvent, q: string): number {
    const whole = fieldTier(e, q);
    if (whole >= 0) return whole;
    const words = q.split(' ');
    if (words.length < 2) return -1;
    let worst = 0;
    for (const w of words) {
        const t = fieldTier(e, w);
        if (t < 0) return -1;
        if (t > worst) worst = t;
    }
    return worst;
}

/** Söknyckel för ortnamn: å/ä → a, ö → o, diakriter bort (webbens searchKey). */
export const ortNyckel = (s: string) =>
    s.toLowerCase()
        .replace(/[åä]/g, 'a')
        .replace(/ö/g, 'o')
        .replace(/[éè]/g, 'e')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]/g, '');

const ORT_INDEX = CITIES.map((city, order) => ({ city, order, key: ortNyckel(city.name) }));

/** Exakt uppslag - "kar" ger null, aldrig Karlstad. */
export function findCity(name: string): City | null {
    const key = ortNyckel(name);
    if (!key) return null;
    return ORT_INDEX.find(o => o.key === key)?.city ?? null;
}

/** Orter som matchar söktexten: exakt → börjar på → innehåller, sen listans
 *  ordning (största först). Minst två tecken. */
export function searchCities(query: string, limit = 4): City[] {
    const q = ortNyckel(query);
    if (q.length < 2) return [];
    const hits: { city: City; rank: number; order: number }[] = [];
    for (const o of ORT_INDEX) {
        const rank = o.key === q ? 0 : o.key.startsWith(q) ? 1 : o.key.includes(q) ? 2 : -1;
        if (rank >= 0) hits.push({ city: o.city, rank, order: o.order });
    }
    hits.sort((a, b) => a.rank - b.rank || a.order - b.order);
    return hits.slice(0, limit).map(h => h.city);
}

const CITY_GLUE = new Set(['i', 'på', 'vid', 'nära', 'runt', 'in']);

function dropGlue(rest: string[], side: 'start' | 'end'): string {
    const out = [...rest];
    if (side === 'end') {
        while (out.length > 0 && CITY_GLUE.has(out[out.length - 1])) out.pop();
    } else {
        while (out.length > 0 && CITY_GLUE.has(out[0])) out.shift();
    }
    return out.join(' ');
}

/** Ort i början/slutet av söktexten (1-3 ord, längst först). En ren
 *  ortsökning ger city = null - den sköts av stadsraden. */
export function splitCityFromQuery(q: string): { city: City | null; text: string } {
    const words = q.split(' ').filter(Boolean);
    for (let n = Math.min(3, words.length - 1); n >= 1; n--) {
        const tail = findCity(words.slice(-n).join(' '));
        if (tail) return { city: tail, text: dropGlue(words.slice(0, -n), 'end') };
        const head = findCity(words.slice(0, n).join(' '));
        if (head) return { city: head, text: dropGlue(words.slice(n), 'start') };
    }
    return { city: null, text: q };
}

/**
 * Bästa träffarna först: nivå för nivå, tidsordning inom nivån. Med en ort i
 * texten gäller bara event inom CITY_SEARCH_RADIUS_KM från den. Tom fråga
 * ger tom lista.
 */
export function sokEvent(events: readonly AppFeedEvent[], fråga: string, max = 50): AppFeedEvent[] {
    const q = normalizeSearchQuery(fråga);
    if (!q) return [];
    const { city, text } = splitCityFromQuery(q);
    const träffar: { e: AppFeedEvent; tier: number; t: number }[] = [];
    for (const e of events) {
        if (city && distanceKm(city.lat, city.lng, e.lat, e.lng) > CITY_SEARCH_RADIUS_KM) continue;
        const tier = text ? eventSearchTier(e, text) : 0;
        if (tier >= 0) träffar.push({ e, tier, t: new Date(e.time).getTime() });
    }
    träffar.sort((a, b) => a.tier - b.tier || a.t - b.t);
    return träffar.slice(0, max).map(x => x.e);
}

/** Vanliga sökord som betyder en kategori fast de inte står i dess namn. */
const KATEGORI_SYNONYMER: Record<string, EventCategoryType> = {
    teater: 'stage',
    konsert: 'music',
    utställning: 'art',
    vernissage: 'art',
    loppis: 'market',
    quiz: 'social',
};

/** Svenska böjningsändelser som får hänga på ett kategoriord ("konsten",
 *  "konserter", "barnen"). En lista, inte "några tecken till": "match" är
 *  inte mat och "mats" inte heller. */
const BÖJNINGAR = ['', 'n', 't', 'en', 'et', 'na', 'er', 'ar', 'or', 'erna', 'arna', 'orna'];

/** Grundorden per riktig kategori - kategorinamnens ord (utom Övrigt och
 *  källorna kyrkan/PRO, som inte är kategorier) plus synonymerna. */
const KATEGORI_GRUNDORD: { key: EventCategoryType; ord: string }[] = [
    ...EVENT_CATEGORY_KEYS.filter(k => k !== 'other').flatMap(key =>
        KATEGORIER[key].label.toLowerCase().split(/[^a-zåäöéü]+/)
            .filter(ord => ord.length >= 3)
            .map(ord => ({ key, ord }))),
    ...Object.entries(KATEGORI_SYNONYMER).map(([ord, key]) => ({ key, ord })),
];

/** Kategorin ett HELT sökord står för, annars null. Strängare än
 *  rankningens kategoriträff: ett halvskrivet ord ("kon") räknas inte. */
export function kategoriFörOrd(ord: string): EventCategoryType | null {
    for (const { key, ord: grund } of KATEGORI_GRUNDORD) {
        if (ord.startsWith(grund) && BÖJNINGAR.includes(ord.slice(grund.length))) return key;
    }
    return null;
}

const KATEGORI_KLISTER = new Set([...CITY_GLUE, 'och', '&', 'med']);

/**
 * Kategoriorden i en (normaliserad, ortfri) söktext. Bara när VARJE ord är
 * ett kategoriord eller ett bindeord blir det en kategorisökning - "konst",
 * "musik och teater". Står något annat kvar ("jazz", "konst jazz") är det
 * vanlig textsökning och rankningen sköter kategoriträffarna som förut.
 */
export function tolkaKategorier(text: string): ReadonlySet<EventCategoryType> {
    const ord = text.split(' ').filter(Boolean);
    const kategorier = new Set<EventCategoryType>();
    for (const o of ord) {
        if (KATEGORI_KLISTER.has(o)) continue;
        const k = kategoriFörOrd(o);
        if (!k) return new Set();
        kategorier.add(k);
    }
    return kategorier;
}

/**
 * Filterlistan (inget fritt sökord - bara chips, kategoriord och/eller ort):
 * sticky dagsektioner från `frånDag` (kartans dag, 0 = idag) och framåt, och
 * inom varje dag det NÄRMASTE `från` först. Inom LIKA_NÄRA_KM räknas det
 * som lika långt och då gäller klockslaget - inne i en stad betyder 300 m
 * inget, 17:00 före 18:00 gör det. Dagarna före kartans dag är borta, som
 * på kartan.
 */
export const LIKA_NÄRA_KM = 2;

export function närmastPerDag<T extends { time: string; lat: number; lng: number }>(
    events: readonly T[],
    från: { lat: number; lng: number },
    frånDag: number,
    nu: Date = new Date(),
): DagSektion<T>[] {
    const band = new Map<T, number>();
    for (const e of events) band.set(e, Math.floor(distanceKm(från.lat, från.lng, e.lat, e.lng) / LIKA_NÄRA_KM));
    // Pågående event som startade före idag hör till Idag (som dagSektioner).
    const kvar = events.filter(e => Math.max(0, dagOffset(e.time, nu)) >= frånDag);
    return dagSektioner(kvar, nu).map(s => ({
        ...s,
        data: [...s.data].sort((a, b) => band.get(a)! - band.get(b)! || Date.parse(a.time) - Date.parse(b.time)),
    }));
}

export interface HighlightSegment {
    text: string;
    hit: boolean;
}

/** Fetstilsbitarna för ALLA förekomster; hellre ingen fetstil än fel bokstäver
 *  när gemenerna inte har samma längd som originalet. */
export function highlightSegments(text: string, q: string): HighlightSegment[] {
    const lower = text.toLowerCase();
    if (!q || lower.length !== text.length) return [{ text, hit: false }];
    const out: HighlightSegment[] = [];
    let pos = 0;
    let idx = lower.indexOf(q);
    while (idx >= 0) {
        if (idx > pos) out.push({ text: text.slice(pos, idx), hit: false });
        out.push({ text: text.slice(idx, idx + q.length), hit: true });
        pos = idx + q.length;
        idx = lower.indexOf(q, pos);
    }
    if (pos < text.length) out.push({ text: text.slice(pos), hit: false });
    return out;
}
