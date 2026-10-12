/**
 * Önskningar ("någon borde ordna X här") - ren logik, port av webbens
 * services/wishService.ts. Önskningar bor i EGNA collectionen eventWishes
 * och blandas ALDRIG in i linkEvents, aggregaten eller Nästa-poolen; på
 * kartan renderas de som egna drömska brickor (lib/kartlager.byggÖnskningar),
 * på stadssidan som "Önskas i X" (önskningarNära, webbens utils/cityWishes).
 */
import { distanceKm as avståndKm } from './regionVal';

/** En önskan lever så här länge - webbens WISH_LIFETIME_DAYS (7 sedan 22/9). */
export const ÖNSKE_LIVSLÄNGD_DAGAR = 7;

export interface Önskan {
    id: string;
    title: string;
    /** Kategorinyckel - valideras mot kontraktets lista av anroparen. */
    category: string;
    description: string;
    lat: number;
    lng: number;
    uid: string;
    hostName: string;
    /** Epoch-ms - Firestore-Timestamps görs om av datalagret. */
    createdAt: number;
    expiresAt: number;
    fulfilled: boolean;
}

/** När en önskan skapad `createdAt` går ut (webbens klientsatta expiresAt). */
export function utgångsTid(createdAtMs: number): number {
    return createdAtMs + ÖNSKE_LIVSLÄNGD_DAGAR * 86_400_000;
}

/**
 * Webbens fetchActiveWishes-filter: ej uppfyllda, ej utgångna - och även
 * createdAt-gränsen, för önskningar skapade medan livslängden var 14 dagar
 * bär ett expiresAt som ligger för långt fram.
 */
export function aktivaÖnskningar(önskningar: readonly Önskan[], nuMs: number): Önskan[] {
    return önskningar.filter(w =>
        w.title !== ''
        && !w.fulfilled
        && w.expiresAt > nuMs
        && utgångsTid(w.createdAt) > nuMs);
}

/** Max önskningar på stadssidan - sektionen är en aptitretare, inte ett arkiv (webbens CITY_WISHES_MAX). */
export const STADS_ÖNSKNINGAR_MAX = 6;

/**
 * Stadssidans önskningar (webbens utils/cityWishes.wishesNearCity): inom
 * radien (samma som stadens spotlight, 20/35 km - hellre en önskan från
 * grannorten än en tom sektion), nyaste först. (0,0) är "plats saknas".
 */
export function önskningarNära(
    önskningar: readonly Önskan[],
    mitt: { lat: number; lng: number },
    radieKm: number,
    max = STADS_ÖNSKNINGAR_MAX,
): Önskan[] {
    return önskningar
        .filter(w => !(w.lat === 0 && w.lng === 0) && avståndKm(w.lat, w.lng, mitt.lat, mitt.lng) <= radieKm)
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, max);
}

/** "idag" / "igår" / "för 3 dagar sedan" - önskans ålder i löptext (webbens wishAgeLabel). */
export function önskansÅlder(createdAtMs: number, nuMs: number): string {
    const dagar = Math.floor((nuMs - createdAtMs) / 86_400_000);
    if (dagar <= 0) return 'idag';
    if (dagar === 1) return 'igår';
    return `för ${dagar} dagar sedan`;
}
