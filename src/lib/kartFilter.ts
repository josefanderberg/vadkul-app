/**
 * Kartans filterregler - samma som webbens matchesFilterFor (app/(v2)/page.tsx)
 * + utils/sources + utils/popularFilter, så appen visar exakt det webben visar:
 *
 *  - STORA KÄLLOR (Svenska kyrkan, PRO, Korpen) klassas på länkens värdnamn och
 *    GÖMS tills de väljs. Kyrkan/PRO kan kryssas i ("Visa även på kartan" i
 *    profilen); Korpen nås bara via FLER i sökpanelen (ägarbeslut 8/8 + 16/9).
 *    I Stockholms flöde är det över hälften av alla event.
 *  - 🔥 POPULÄRA ensamt smalnar allt, före källgrinden (källornas event är
 *    aldrig pop). IHOP MED KATEGORIER är 🔥 en UNION (ägarbeslut 11/10,
 *    Josef: "om jag väljer populära och scen, så ska det vara både scen och
 *    populära, inte bara de populära inom scen") - samma regel som webben.
 *  - KATEGORIERNA är FLERVAL och SPARAS (webbens mapCategories, ägarbeslut
 *    6/10 - ersätter 16/9-regeln "en åt gången, sparas aldrig"): tom mängd =
 *    alla, varje chip togglar sin. Persistensen bor i lib/filterMinne +
 *    filterContext; de alltid synliga filterbrickorna är 15/9-läxans krav.
 *  - FLER-KÄLLAN = "visa bara källan", även om den inte är ikryssad; den släpper
 *    kategorin och 🔥 (det sköts av den som sätter state, se väljKälla).
 *
 *  - ANVÄNDARSKAPADE event (sedan 8/10 i appen, api/useEvent) är sajtens kärna
 *    och kringgår HELA filtret, även ett aktivt kategorival - webbens första rad.
 *
 * Appen visar ingen boost, så webbens boost-bypass finns inte här. Familj-
 * opt-in gäller bara inloggade vuxna utan barn (utils/familyFilter) - inte
 * portat än, så 🧸 syns alltid.
 */
import type { AppFeedEvent, EventCategoryType } from '@vadkul/kontrakt';
import type { AppEvent } from './appEvent';

export type KällNyckel = 'svenskakyrkan' | 'pro' | 'korpen';

export interface KällDef {
    key: KällNyckel;
    label: string;
    emoji: string;
    /** Går att kryssa i som "visa även" i profilen (Korpen gör det inte). */
    optIn: boolean;
    test: (host: string) => boolean;
}

/** Spegel av webbens SOURCE_DEFS - ändras den ena ska den andra följa. */
export const KÄLLOR: readonly KällDef[] = [
    { key: 'svenskakyrkan', label: 'Svenska kyrkan', emoji: '⛪', optIn: true, test: h => h.includes('svenskakyrkan') },
    { key: 'pro', label: 'PRO', emoji: '🧓', optIn: true, test: h => h === 'pro.se' || h.endsWith('.pro.se') },
    { key: 'korpen', label: 'Korpen', emoji: '🏃', optIn: false, test: h => h.includes('korpen') },
];

/** Värdnamnet i gemener (regex - Hermes URL-stöd är inte heltäckande). */
function värdnamn(url: string | undefined): string | null {
    const m = (url ?? '').match(/^https?:\/\/([^/:?#]+)/i);
    return m ? m[1].toLowerCase() : null;
}

/** Källnyckeln för ett event, eller null om det inte hör till en stor källa. */
export function klassaKälla(e: Pick<AppFeedEvent, 'id' | 'url'>): KällNyckel | null {
    const host = värdnamn(e.url || e.id);
    if (!host) return null;
    return KÄLLOR.find(k => k.test(host))?.key ?? null;
}

export interface KartFilter {
    /** Valda kategorier - TOM mängd = alla (webbens mapCategories). */
    kategorier: ReadonlySet<EventCategoryType>;
    populärt: boolean;
    /** FLER-valet: bara den här källan. */
    källa: KällNyckel | null;
    /** Ikryssade opt-in-källor ("Visa även på kartan"). */
    optIn: ReadonlySet<KällNyckel>;
}

export const TOMT_FILTER: KartFilter = { kategorier: new Set(), populärt: false, källa: null, optIn: new Set() };

/** Syns eventet med det här filtret? `kategorier`/`källa` kan skickas separat
 *  så kategoriradens siffror räknas med exakt samma regler (webbens
 *  enelements-mängder genom matchesFilterFor). */
export function matcharFilter(
    e: AppEvent,
    f: KartFilter,
    kategorier: ReadonlySet<EventCategoryType> = f.kategorier,
    källa: KällNyckel | null = f.källa,
): boolean {
    if (e.userCreated) return true;
    // 🔥 ensamt smalnar allt; 🔥 + kategorier är en UNION (ägarbeslut 11/10:
    // "både scen och populära, inte bara de populära inom scen").
    const harKategorier = kategorier.size > 0;
    const iKategorierna = harKategorier && kategorier.has(e.category as EventCategoryType);
    const unionPop = f.populärt && harKategorier && e.pop === true;
    if (f.populärt && e.pop !== true && !iKategorierna) return false;
    const src = klassaKälla(e);
    if (källa) return src === källa;
    if (harKategorier && !iKategorierna && !unionPop) return false;
    if (src) return f.optIn.has(src);
    return true;
}

/** Antal per kategorinyckel bland `events` - "vad visas om jag trycker här",
 *  räknat per kategori med exakt matcharFilter (webbens enelements-mönster).
 *  Med 🔥 på räknas unionen in: populära utanför kategorin höjer siffran,
 *  precis som vyn ser ut efter trycket. */
export function räknaKategorier(events: readonly AppFeedEvent[], f: KartFilter): Map<string, number> {
    const nycklar = new Set<string>();
    for (const e of events) nycklar.add(String(e.category));
    const counts = new Map<string, number>();
    for (const k of nycklar) {
        const enelement = new Set([k as EventCategoryType]);
        let n = 0;
        for (const e of events) if (matcharFilter(e, f, enelement, null)) n++;
        if (n > 0) counts.set(k, n);
    }
    return counts;
}

/** Antal per stor källa bland `events` (utan 🔥 - källorna är aldrig pop). */
export function räknaKällor(events: readonly AppFeedEvent[]): Map<KällNyckel, number> {
    const counts = new Map<KällNyckel, number>();
    for (const e of events) {
        const src = klassaKälla(e);
        if (src) counts.set(src, (counts.get(src) ?? 0) + 1);
    }
    return counts;
}

/** Antal 🔥-event bland `events` med filtrets opt-in - UTAN kategorismalning
 *  sedan unionsbeslutet 11/10: trycket LÄGGER TILL alla populära, så siffran
 *  är antalet populära, inte "populära inom valda kategorier". */
export function räknaPopulära(events: readonly AppFeedEvent[], f: KartFilter): number {
    let n = 0;
    const utanKategorier = new Set<EventCategoryType>();
    for (const e of events) if (e.pop === true && matcharFilter(e, { ...f, populärt: false }, utanKategorier, null)) n++;
    return n;
}

export type KategoriChip = { key: string; count: number };

/**
 * Kategoriraden (webbens planMapCategoryChips): VALDA kategorier längst till
 * vänster (ägarbeslut 7/10), sedan resten med event flest först, Övrigt
 * alltid sist bland de ovalda. Valda följer med även på noll - annars går
 * ett filter som tömt vyn inte att släppa.
 */
export function planeraKategoriChips(
    keys: readonly string[],
    counts: ReadonlyMap<string, number>,
    valda: ReadonlySet<string>,
): KategoriChip[] {
    const chips = keys
        .map((key, order) => ({ key, count: counts.get(key) ?? 0, order, vald: valda.has(key) }))
        .filter(c => c.count > 0 || c.vald);
    chips.sort((a, b) =>
        (a.vald ? 0 : 1) - (b.vald ? 0 : 1)
        || (a.key === 'other' ? 1 : 0) - (b.key === 'other' ? 1 : 0)
        || b.count - a.count
        || a.order - b.order);
    return chips.map(({ key, count }) => ({ key, count }));
}

/** FLER-källorna som syns: de med event, plus den valda även på noll. */
export function synligaKällor(counts: ReadonlyMap<KällNyckel, number>, vald: KällNyckel | null): KällDef[] {
    return KÄLLOR.filter(k => (counts.get(k.key) ?? 0) > 0 || k.key === vald);
}
