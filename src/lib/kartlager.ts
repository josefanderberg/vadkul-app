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
 *
 * Etiketterna är webbens (components/v2/v2MapLabel.ts + LABEL_LAYER_IDS i
 * V2Map): titeln (kapad) när den får plats, annars kategorin, annars inget.
 * Kartan lägger titellagret ÖVER kategorilagret - MapLibre placerar uppifrån
 * och ner, så titlarna tar plats först. `etikettPrio` avgör vem som får
 * platsen först inom lagret (lägst först): de populäraste, sedan större
 * grupper (Josef 9/10: "på avstånd så ska det populäraste eventet visas").
 */
import type { AppFeedEvent } from '@vadkul/kontrakt';
import { ärEgetVadkulEvent, type AppEvent } from './appEvent';
import { brickaIkon } from './brickor';
import { isEventPast } from './harVarit';
import { kategoriFor } from './kategorier';
import { isTicketmasterEvent } from './ticketmaster';
import { platsNyckel } from './vy';

/** Webbens LABEL_MAX_CHARS: en rad under en 40 px-bricka - längre läses inte. */
export const ETIKETT_MAX_TECKEN = 18;

export interface BrickProps {
    /** Representantens id - trycket slår upp gruppen via platsNyckel. */
    id: string;
    ikon: string;
    /** Kategorins kortnamn ("Musik") - reserven när titeln inte får plats. */
    label: string;
    /** Representantens titel, kapad till ETIKETT_MAX_TECKEN. */
    titel: string;
    antal: number;
    /** Den bakade "+N"-badgen (antal-N / antal-99plus), tom för ensamma event. */
    antalIkon: string;
    past: boolean;
    vald: boolean;
    /** Ritordning: vald överst, sedan guld/pop, sist har varit. */
    sort: number;
    /** Etikettplaceringens turordning, lägst först: populärt före stora grupper. */
    etikettPrio: number;
}

/** Webbens truncateLabel: Array.from så emoji/surrogatpar aldrig klyvs. */
export function kapaEtikett(text: string, max = ETIKETT_MAX_TECKEN): string {
    const tecken = Array.from(text.trim());
    if (tecken.length <= max) return tecken.join('');
    return tecken.slice(0, max).join('').trimEnd() + '…';
}

export function antalIkon(antal: number): string {
    if (antal < 2) return '';
    return antal > 99 ? 'antal-99plus' : `antal-${antal}`;
}

export function byggBrickor(
    events: readonly AppEvent[],
    opts: { nowMs: number; valtId?: string | null; ärSparad?: (id: string) => boolean },
): GeoJSON.FeatureCollection<GeoJSON.Point, BrickProps> {
    const grupper = new Map<string, AppEvent[]>();
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
        const grön = ärEgetVadkulEvent(rep);
        const nivå = rep.pop || guld ? 0 : grön ? 1 : 2;
        features.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [rep.lng, rep.lat] },
            properties: {
                id: rep.id,
                ikon: brickaIkon({ category: String(rep.category), pop: rep.pop === true, guld, sparad, grön, vald: !!vald }),
                label: kategoriFor(String(rep.category)).kort,
                titel: kapaEtikett(rep.title ?? ''),
                antal: grupp.length,
                antalIkon: antalIkon(grupp.length),
                past,
                vald: !!vald,
                sort: vald ? 4 : past ? 0 : guld || grön || rep.pop ? 2 : 1,
                etikettPrio: nivå * 1000 - Math.min(grupp.length, 999),
            },
        });
    }
    return { type: 'FeatureCollection', features };
}
