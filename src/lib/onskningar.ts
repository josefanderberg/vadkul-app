/**
 * Önskningar ("någon borde ordna X här") - ren logik, port av webbens
 * services/wishService.ts. Önskningar bor i EGNA collectionen eventWishes
 * och blandas ALDRIG in i linkEvents, aggregaten eller Nästa-poolen; på
 * kartan renderas de som egna drömska brickor (lib/kartlager.byggÖnskningar).
 */

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
