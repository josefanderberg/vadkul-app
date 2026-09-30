/**
 * Kartans brick-lager som GeoJSON - EN bricka per plats (webbens grupper):
 * event på samma plats (lib/vy.platsNyckel) blir en bricka med antal, och ett
 * tryck på den öppnar väljarlistan i kortet (ägarbeslut 31/8). Ren logik så
 * den går att testa utan karta.
 *
 * Representanten är första eventet som inte varit (tidsordning) - eller det
 * valda, om det ligger i gruppen. Ticketmaster blir aldrig representant före
 * ett tidigare event (sortKey-lyftningen är stjärnans/boostens privilegium,
 * kart-ui). "Har varit" = ALLA i gruppen passerade → brickan dimmas.
 */
import type { AppFeedEvent } from '@vadkul/kontrakt';
import { brickaIkon } from './brickor';
import { isEventPast } from './harVarit';
import { kategoriFor } from './kategorier';
import { isTicketmasterEvent } from './ticketmaster';
import { platsNyckel } from './vy';

export interface BrickProps {
    /** Representantens id - trycket slår upp gruppen via platsNyckel. */
    id: string;
    ikon: string;
    label: string;
    antal: number;
    past: boolean;
    /** Ritordning: vald överst, sedan guld/pop, sist har varit. */
    sort: number;
}

export function byggBrickor(
    events: readonly AppFeedEvent[],
    opts: { nowMs: number; valtId?: string | null; ärSparad?: (id: string) => boolean },
): GeoJSON.FeatureCollection<GeoJSON.Point, BrickProps> {
    const grupper = new Map<string, AppFeedEvent[]>();
    for (const e of events) {
        const k = platsNyckel(e);
        const g = grupper.get(k);
        if (g) g.push(e);
        else grupper.set(k, [e]);
    }
    const features: GeoJSON.Feature<GeoJSON.Point, BrickProps>[] = [];
    for (const grupp of grupper.values()) {
        grupp.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime() || (a.id < b.id ? -1 : 1));
        const levande = grupp.filter(e => !isEventPast(e, opts.nowMs));
        const vald = opts.valtId ? grupp.find(e => e.id === opts.valtId) : undefined;
        const rep = vald ?? levande[0] ?? grupp[0];
        const past = levande.length === 0;
        const guld = isTicketmasterEvent(rep);
        const sparad = !!opts.ärSparad && grupp.some(e => opts.ärSparad!(e.id));
        features.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [rep.lng, rep.lat] },
            properties: {
                id: rep.id,
                ikon: brickaIkon({ category: String(rep.category), pop: rep.pop === true, guld, sparad, vald: !!vald }),
                label: kategoriFor(String(rep.category)).kort,
                antal: grupp.length,
                past,
                sort: vald ? 4 : past ? 0 : guld || rep.pop ? 2 : 1,
            },
        });
    }
    return { type: 'FeatureCollection', features };
}
