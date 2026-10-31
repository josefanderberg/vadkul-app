/**
 * VALD STARTSTAD - webbens utils/startChoice (ägarbeslut 8/10 2026, förebild
 * happymap.se): introts platssida låter en välja staden kartan ska öppna i.
 * Ett AKTIVT val VINNER över GPS:en och Stockholm-fallbacken och går aldrig
 * ut - till skillnad från lib/startstad, den GPS-landade stadens månadsminne.
 *
 * Lagras (NYCKEL.startval) som kontraktets slug; null = "där jag är" (dagens
 * beteende), saknas = aldrig frågat. Webbens väljare söker bland cityPoints
 * (291 orter), men appens regionval kräver en kontraktsstad - därför är
 * orterna här kontraktets CITIES, samma lista som stadssidorna.
 */
import { CITIES, CITY_BY_SLUG, type City } from '@vadkul/kontrakt';

/** Tolka det lagrade värdet - okänd slug (omdöpt/borttagen) eller skräp =
 *  inget val, hellre dagens beteende än fel stad. */
export function tolkaStartval(raw: unknown): City | null {
    if (typeof raw !== 'string') return null;
    return CITY_BY_SLUG.get(raw) ?? null;
}

/** Snabbvalen innan man sökt: största städerna först (webbens
 *  popularStartCities sorterar likadant). */
export function snabbvalsStäder(antal = 8): City[] {
    return [...CITIES]
        .sort((a, b) => (b.population ?? 0) - (a.population ?? 0))
        .slice(0, antal);
}

export interface StadsUnderlag {
    /** Besökets manuella stadsval (sökets stadsrad, stadssidan). */
    manuell: City | null;
    /** Staden ur GPS-fixen, null utan fix. */
    gpsStad: City | null;
    /** "Återgå till min plats" tryckt - GPS:en går då före startvalet,
     *  men bara under besöket. */
    gpsVald: boolean;
    /** Den valda startstaden (det här valet vinner över GPS:en). */
    startval: City | null;
    /** GPS-landningen från förra besöket (lib/startstad). */
    sparad: City | null;
    /** Stockholm-fallbacken (lib/regionVal DEFAULT_CITY). */
    standard: City;
}

/**
 * Staden kartan och flödet utgår från - regionContexts prioritetskedja som
 * ren funktion: manuellt besöksval > begärd GPS-återgång > vald startstad >
 * GPS > sparad landning > standard.
 */
export function utgångsStad(u: StadsUnderlag): { city: City; fromGps: boolean } {
    if (u.manuell) return { city: u.manuell, fromGps: false };
    if (u.gpsVald && u.gpsStad) return { city: u.gpsStad, fromGps: true };
    if (u.startval) return { city: u.startval, fromGps: false };
    if (u.gpsStad) return { city: u.gpsStad, fromGps: true };
    return { city: u.sparad ?? u.standard, fromGps: false };
}
