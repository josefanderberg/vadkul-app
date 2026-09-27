/**
 * "Fler event"-listan under eventkortet - webbens ark: chipsen MÅNADEN
 * (hela flödet) och POPULÄRT (pop-flaggade), raderna sorterade på avstånd
 * från det öppna eventet. Ren logik, testad utan UI.
 */
import type { AppFeedEvent } from '@vadkul/kontrakt';
import { distanceKm } from './regionVal';

export type FlerLäge = 'månaden' | 'populärt';

export interface FlerRad {
    event: AppFeedEvent;
    /** Avstånd från det öppna eventet i km. */
    km: number;
}

/** Kandidaterna för ett läge (utan det öppna eventet självt). */
export function flerEventKandidater(alla: AppFeedEvent[], valtId: string, läge: FlerLäge): AppFeedEvent[] {
    return alla.filter(e => e.id !== valtId && (läge === 'månaden' || e.pop === true));
}

/** Listan: närmast först, lika nära avgörs på tid. */
export function flerEventLista(
    alla: AppFeedEvent[],
    valt: AppFeedEvent,
    läge: FlerLäge,
    max = 40,
): FlerRad[] {
    return flerEventKandidater(alla, valt.id, läge)
        .map(e => ({ event: e, km: distanceKm(valt.lat, valt.lng, e.lat, e.lng) }))
        .sort((a, b) => a.km - b.km
            || new Date(a.event.time).getTime() - new Date(b.event.time).getTime())
        .slice(0, max);
}

/** "1,2 km" under 10 km, annars "13 km". */
export function formatKm(km: number): string {
    return km < 10 ? `${km.toFixed(1).replace('.', ',')} km` : `${Math.round(km)} km`;
}
