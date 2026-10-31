/**
 * "Staden man är i" - staden kartan ÖPPNAR i nästa start (webbens
 * utils/startCity, ägarbeslut 31/8: inget intro, kartan ligger över din stad
 * direkt). GPS-svaret gör sedan ett hopp om man flyttat sig. Vi sparar ORTEN
 * (kontraktets slug), aldrig den råa positionen. Äldre än en månad ignoreras -
 * flyttar man ska kartan inte öppna i fel stad i evighet.
 */
import { CITIES, type City } from '@vadkul/kontrakt';

export interface SparadStartstad {
    slug: string;
    savedAt: number;
}

export const STARTSTAD_MAX_ÅLDER_MS = 30 * 24 * 60 * 60 * 1000;

/** Tolka det lagrade värdet - all validering här så skräp aldrig når kartan. */
export function tolkaStartstad(raw: unknown, nowMs: number): City | null {
    if (!raw || typeof raw !== 'object') return null;
    const { slug, savedAt } = raw as Record<string, unknown>;
    if (typeof slug !== 'string' || typeof savedAt !== 'number' || !Number.isFinite(savedAt)) return null;
    if (nowMs - savedAt > STARTSTAD_MAX_ÅLDER_MS) return null;
    return CITIES.find(c => c.slug === slug) ?? null;
}

/** Kartans stadsläge - det kamerans stadshopp jämför före och efter. */
export interface KartStadsläge {
    slug: string;
    /** Staden kommer ur en riktig GPS-fix (regionContext). */
    fromGps: boolean;
    /** Staden är ett eget val (stadssidan, söket, Städer) - eller en egen
     *  begäran om GPS-staden ("Återgå till min plats", regionContext gpsValt). */
    manuell: boolean;
}

/**
 * Ska kameran flyga till staden när kartans stad ändras? Alltid - utom när
 * GPS-svaret bara bekräftar staden kartan redan öppnat i: då står kameran
 * redan där, och man kan ha hunnit panorera, så ett hopp till stadens mitt
 * vore ett ryck tillbaka (PR #1:s kamerafix, portad 31/10). Har man flyttat
 * sig (annan stad) gör GPS-svaret ETT hopp som förut, och egna val flyger
 * alltid - även tillbaka till samma stad.
 */
export function stadsbyteFlyger(förra: KartStadsläge, ny: KartStadsläge): boolean {
    const gpsLandning = ny.fromGps && !förra.fromGps && !ny.manuell && !förra.manuell;
    return !(gpsLandning && ny.slug === förra.slug);
}
