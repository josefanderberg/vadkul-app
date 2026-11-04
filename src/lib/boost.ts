/**
 * BOOSTADE EVENT I APPEN (Josef 4/11 2026, andra betalande kunden: boostade
 * event ska ha en stjärna uppe till vänster på kortet och i listan under,
 * och ligga högst upp - "gäller på web och mobil, så de syns ännu längre").
 *
 * Port av webbens isEventFeatured (services/linkEventService.ts) och dess
 * boost-overlay (fetchActiveBoosts): ett boostat EGET event bär
 * `featuredUntil` på sitt linkEvents-dokument (lib/anvandarEvent läser det),
 * ett boostat SKRAPAT event ligger i eventBoosts/{slug} med eventId (= käll-
 * URL:en = appens id) och featuredUntil (data/boostar lyssnar). Själva
 * regeln - aktiv = featuredUntil efter nu, boostade först - bor i kontraktet
 * (featured.ts) så webben och appen räknar lika.
 *
 * HÅRD REGEL (CLAUDE.md): appen säljer ingenting. Det här VISAR bara att
 * någon boostat på webben; ordet "boost" står aldrig i UI:t - stjärnan är
 * kvittot, precis som på kartbrickan.
 */
import { featuredFirst, featuredUntilMs, isFeaturedAt, type AppFeedEvent } from '@vadkul/kontrakt';

/** eventId → featuredUntil i ms, de aktiva boostarna ur eventBoosts. */
export type Boostar = ReadonlyMap<string, number>;

export const INGA_BOOSTAR: Boostar = new Map();

type Boostbar = Pick<AppFeedEvent, 'id'> & { featuredUntil?: string };

/** När boosten slutar (ms) - eventets eget fält först, annars overlayn.
 *  null = inte boostat alls (aktiv eller ej avgörs av isFeaturedAt). */
export function boostSlut(e: Boostbar, boostar: Boostar): number | null {
    return featuredUntilMs(e.featuredUntil) ?? boostar.get(e.id) ?? null;
}

/** Aktiv boost just nu? Passerad boost = ingen stjärna, ingen lyftning. */
export function ärBoostad(e: Boostbar, boostar: Boostar, nuMs: number): boolean {
    return isFeaturedAt(boostSlut(e, boostar), nuMs);
}

/**
 * BOOST-LÖFTET: ett boostat event syns på kartan VARJE dag t.o.m.
 * featuredUntil, inte bara sin egen dag (webbens isBoostShownEveryDay -
 * "99 kr/vecka köper synlighet alla dagar"). Två villkor: boosten är aktiv
 * OCH eventets egen dag har inte passerat (`dygnetsStartMs` = dagens
 * midnatt) - dagen efter eventet är det färdigspelat och ska bort oavsett
 * hur många boostdagar som återstår. Josef 4/11: "boostade event ... synligt
 * 1 vecka i förväg på iOS-appen? Det visas ju inte där."
 */
export function synligVarjeDag(
    e: Boostbar & Pick<AppFeedEvent, 'time'>,
    boostar: Boostar,
    nuMs: number,
    dygnetsStartMs: number,
): boolean {
    if (!ärBoostad(e, boostar, nuMs)) return false;
    const t = new Date(e.time).getTime();
    return Number.isFinite(t) && t >= dygnetsStartMs;
}

/** Boostade först inom dagen (stabilt), resten i sin vanliga ordning. */
export function boostadeFörst<T extends Boostbar>(events: readonly T[], boostar: Boostar, nuMs: number): T[] {
    return featuredFirst(events, e => ärBoostad(e, boostar, nuMs));
}

/**
 * De aktivt boostade bland `events` som inte varit, i tidsordning - pinnas
 * överst i listan under kortet oavsett dag och bildflöde (webbens
 * boostedRows). `harVarit` är listans eget passerat-/uteslutnings-villkor.
 */
export function boostadeRader<T extends Boostbar & Pick<AppFeedEvent, 'time'>>(
    events: readonly T[],
    boostar: Boostar,
    nuMs: number,
    harVarit: (e: T) => boolean,
): T[] {
    return events
        .filter(e => ärBoostad(e, boostar, nuMs) && !harVarit(e))
        .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
