/**
 * Kartrutans rena logik - port av webbens utils/viewportTour + popularList +
 * EventCards sameSpotGroup/pickNext. Allt som "räknar i bild" mäter KARTANS
 * RUTA, aldrig hela flödet (webbens läxa: tom-prompten, auto-hoppet och
 * dagplattans siffror frågade förr hela landet och hade fel):
 *
 *  - iBild: inom rutan och ovanför den nedersta andel som kortet täcker.
 *  - sammaPlats: webbens spotKey (4 decimaler ≈ 10 m).
 *  - nästaIBild: NÄSTA går till närmaste obesökta event i bild räknat från
 *    ankaret (första valda eventet); hela platsen räknas som besökt. Tar det
 *    slut är det dagbytets tur - inget nytt varv, kameran rör sig aldrig
 *    (ägarbeslut 2/9).
 *  - eventDagar: listan under kortet, dag för dag från visad dag och framåt,
 *    passerade bort, lika klockslag skiljs på id (listhoppet 28/9).
 */
import type { AppFeedEvent } from '@vadkul/kontrakt';
import { distanceKm } from './regionVal';

/** MapLibre RN:s LngLatBounds: [väst, syd, öst, nord]. */
export type Ruta = readonly [number, number, number, number];

/** Andel av skärmhöjden (nedifrån) som kortet täcker i peek (webbens 0.22). */
export const KORT_TÄCKER = 0.22;

const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));

/** Syns punkten? Utan ruta (kartan har inte rapporterat än) syns inget. */
export function iBild(lat: number, lng: number, ruta: Ruta | null | undefined, täckt = 0): boolean {
    if (!ruta) return false;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
    const [w, s, e, n] = ruta;
    if (lng < w || lng > e || lat < s || lat > n) return false;
    if (täckt <= 0) return true;
    const yN = mercY(n);
    const yS = mercY(s);
    return mercY(lat) >= yS + (yN - yS) * Math.min(1, täckt);
}

export const platsNyckel = (e: Pick<AppFeedEvent, 'lat' | 'lng'>) => `${e.lat.toFixed(4)},${e.lng.toFixed(4)}`;

/** Alla event på samma plats som `e` (e själv inräknad), i tidsordning. */
export function sammaPlats(events: readonly AppFeedEvent[], e: AppFeedEvent): AppFeedEvent[] {
    const k = platsNyckel(e);
    return events
        .filter(x => platsNyckel(x) === k)
        .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime() || (a.id < b.id ? -1 : 1));
}

/**
 * Nästa event i bild: närmast ankaret bland dem som inte är besökta. Den
 * aktuella platsen läggs till bland de besökta. null = alla genomgångna.
 */
export function nästaIBild(
    ankare: AppFeedEvent,
    aktuellt: AppFeedEvent,
    pool: readonly AppFeedEvent[],
    besökta: ReadonlySet<string>,
): { nästa: AppFeedEvent | null; besökta: Set<string> } {
    const nya = new Set(besökta);
    const k = platsNyckel(aktuellt);
    nya.add(aktuellt.id);
    for (const e of pool) if (platsNyckel(e) === k) nya.add(e.id);
    let bäst: AppFeedEvent | null = null;
    let bästKm = Infinity;
    for (const e of pool) {
        if (nya.has(e.id)) continue;
        const km = distanceKm(ankare.lat, ankare.lng, e.lat, e.lng);
        if (km < bästKm || (km === bästKm && bäst && e.time < bäst.time)) {
            bäst = e;
            bästKm = km;
        }
    }
    return { nästa: bäst, besökta: nya };
}

/** Kalenderdagens offset från idag (lokala dygn, tål sommartid). */
export function dagOffset(time: string | Date, nu: Date = new Date()): number {
    const d = new Date(time);
    d.setHours(0, 0, 0, 0);
    const idag = new Date(nu);
    idag.setHours(0, 0, 0, 0);
    return Math.round((d.getTime() - idag.getTime()) / 86_400_000);
}

/**
 * Nästa periodstart efter `från` vars fönster har minst ett event. Stegar i
 * hela perioder (7 i veckovyn). null när inget finns kvar.
 */
export function nästaPeriodMedEvent(dagar: Iterable<number>, från: number, periodDagar = 1): number | null {
    const steg = Math.max(1, Math.floor(periodDagar));
    const set = new Set<number>();
    let max = -Infinity;
    for (const d of dagar) {
        if (!Number.isFinite(d)) continue;
        set.add(d);
        if (d > max) max = d;
    }
    for (let start = från + steg; start <= max; start += steg) {
        for (let i = 0; i < steg; i++) if (set.has(start + i)) return start;
    }
    return null;
}

export interface Dag<T> {
    /** 0 = idag, 1 = imorgon … */
    offset: number;
    events: T[];
}

/**
 * Dag för dag från `frånOffset`: bara dagar med något, tidsordning inom dagen
 * och id som skiljenyckel. Passerade (`harVarit`) och de som `ta` avvisar
 * sorteras bort.
 */
export function eventDagar<T extends Pick<AppFeedEvent, 'id' | 'time'>>(
    events: readonly T[],
    frånOffset: number,
    nu: Date,
    harVarit: (e: T) => boolean,
    ta: (e: T) => boolean = () => true,
): Dag<T>[] {
    const perDag = new Map<number, T[]>();
    for (const e of events) {
        if (!ta(e) || harVarit(e)) continue;
        const d = dagOffset(e.time, nu);
        if (d < frånOffset) continue;
        const lista = perDag.get(d);
        if (lista) lista.push(e);
        else perDag.set(d, [e]);
    }
    return [...perDag.entries()]
        .sort(([a], [b]) => a - b)
        .map(([offset, lista]) => ({
            offset,
            events: lista.sort((a, b) =>
                new Date(a.time).getTime() - new Date(b.time).getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
        }));
}
