/**
 * Stadssidans rena logik - appens motsvarighet till webbens
 * /evenemang/<stad>. Utbudet mäts I ORTEN (<= 10 km, ägarbeslutet från
 * stadssidornas utbud 7/9 - inte länets 35 km), och listan grupperas per
 * dag med samma etiketter som väljaren (Idag/Imorgon/veckodag).
 */
import type { AppFeedEvent, City } from '@vadkul/kontrakt';
import { eventIPeriod, periodLabel } from './dagar';
import { distanceKm } from './regionVal';

/** Eventen i orten: inom `maxKm` från stadens centrum. */
export function stadensEvent(events: AppFeedEvent[], city: City, maxKm = 10): AppFeedEvent[] {
    return events.filter(e => distanceKm(city.lat, city.lng, e.lat, e.lng) <= maxKm);
}

export interface DagSektion {
    key: string;
    label: string;
    data: AppFeedEvent[];
}

/** Dagsgrupperade sektioner (tomma dagar hoppas över), event i tidsordning. */
export function grupperaPerDag(events: AppFeedEvent[], nu: Date = new Date(), dagar = 14): DagSektion[] {
    const sektioner: DagSektion[] = [];
    for (let offset = 0; offset < dagar; offset++) {
        const dagens = events
            .filter(e => eventIPeriod(e.time, offset, 1, nu))
            .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
        if (dagens.length > 0) {
            sektioner.push({ key: `dag-${offset}`, label: periodLabel(offset, 1, nu), data: dagens });
        }
    }
    return sektioner;
}
