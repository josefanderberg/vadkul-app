/**
 * Kartans filterregler - samma som webbens matchesFilterFor (app/(v2)/page.tsx)
 * + utils/sources + utils/popularFilter, så appen visar exakt det webben visar:
 *
 *  - STORA KÄLLOR (Svenska kyrkan, PRO, Korpen) klassas på länkens värdnamn och
 *    GÖMS tills de väljs. Kyrkan/PRO kan kryssas i ("Visa även på kartan" i
 *    profilen); Korpen nås bara via FLER i sökpanelen (ägarbeslut 8/8 + 16/9).
 *    I Stockholms flöde är det över hälften av alla event.
 *  - 🔥 POPULÄRA smalnar allt, före källgrinden (källornas event är aldrig pop).
 *  - KATEGORIN är EN åt gången och sparas aldrig (webbens mapCategory).
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
    kategori: EventCategoryType | null;
    populärt: boolean;
    /** FLER-valet: bara den här källan. */
    källa: KällNyckel | null;
    /** Ikryssade opt-in-källor ("Visa även på kartan"). */
    optIn: ReadonlySet<KällNyckel>;
}

export const TOMT_FILTER: KartFilter = { kategori: null, populärt: false, källa: null, optIn: new Set() };

/** Syns eventet med det här filtret? `kategori`/`källa` kan skickas separat
 *  så kategoriradens siffror räknas med exakt samma regler (webbens mönster). */
export function matcharFilter(
    e: AppEvent,
    f: KartFilter,
    kategori: EventCategoryType | null = f.kategori,
    källa: KällNyckel | null = f.källa,
): boolean {
    if (e.userCreated) return true;
    if (f.populärt && e.pop !== true) return false;
    const src = klassaKälla(e);
    if (källa) return src === källa;
    if (kategori && e.category !== kategori) return false;
    if (src) return f.optIn.has(src);
    return true;
}

/** Antal per kategorinyckel bland `events` med filtrets 🔥/opt-in men utan
 *  kategori- och källval - "vad visas om jag trycker här". */
export function räknaKategorier(events: readonly AppFeedEvent[], f: KartFilter): Map<string, number> {
    const counts = new Map<string, number>();
    for (const e of events) {
        if (!matcharFilter(e, f, null, null)) continue;
        const k = String(e.category);
        counts.set(k, (counts.get(k) ?? 0) + 1);
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

/** Antal 🔥-event bland `events` med filtrets kategori och opt-in. */
export function räknaPopulära(events: readonly AppFeedEvent[], f: KartFilter): number {
    let n = 0;
    for (const e of events) if (e.pop === true && matcharFilter(e, { ...f, populärt: false }, f.kategori, null)) n++;
    return n;
}

export type KategoriChip = { key: string; count: number };

/**
 * Kategoriraden (webbens planMapCategoryChips): kategorier med event, flest
 * först, Övrigt alltid sist. Den valda följer med även på noll - annars går
 * ett filter som tömt vyn inte att släppa.
 */
export function planeraKategoriChips(
    keys: readonly string[],
    counts: ReadonlyMap<string, number>,
    vald: string | null,
): KategoriChip[] {
    const chips = keys
        .map((key, order) => ({ key, count: counts.get(key) ?? 0, order }))
        .filter(c => c.count > 0 || c.key === vald);
    chips.sort((a, b) =>
        (a.key === 'other' ? 1 : 0) - (b.key === 'other' ? 1 : 0)
        || b.count - a.count
        || a.order - b.order);
    return chips.map(({ key, count }) => ({ key, count }));
}

/** FLER-källorna som syns: de med event, plus den valda även på noll. */
export function synligaKällor(counts: ReadonlyMap<KällNyckel, number>, vald: KällNyckel | null): KällDef[] {
    return KÄLLOR.filter(k => (counts.get(k.key) ?? 0) > 0 || k.key === vald);
}
