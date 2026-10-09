/**
 * Sparade event - ren logik bakom hjärtat (lib/sparadeContext). Listan hålls
 * i tidsordning, och event som varit i mer än en vecka rensas bort så
 * lagringen inte växer i evighet (passerade syns som "har varit" fram till dess).
 */
import type { AppFeedEvent } from '@vadkul/kontrakt';
import { eventPastAt } from './harVarit';

export const SPARAD_KVAR_EFTER_MS = 7 * 24 * 60 * 60 * 1000;

const tid = (e: AppFeedEvent) => new Date(e.time).getTime();

/** Lägg till (i tidsordning) eller ta bort eventet. */
export function växlaSparad(lista: readonly AppFeedEvent[], e: AppFeedEvent): AppFeedEvent[] {
    if (lista.some(x => x.id === e.id)) return lista.filter(x => x.id !== e.id);
    return [...lista, e].sort((a, b) => tid(a) - tid(b));
}

/** Släng event som varit i mer än en vecka. */
export function rensaSparade(lista: readonly AppFeedEvent[], nowMs: number): AppFeedEvent[] {
    return lista.filter(e => {
        const slut = eventPastAt(e);
        return slut === null || nowMs - slut < SPARAD_KVAR_EFTER_MS;
    });
}

/** Slå in event hämtade från kontot (sparade på en annan enhet) i enhetens
 *  lista - de som redan finns behåller sin ögonblicksbild. */
export function slåIhopSparade(lista: readonly AppFeedEvent[], nya: readonly AppFeedEvent[]): AppFeedEvent[] {
    const har = new Set(lista.map(e => e.id));
    const till = nya.filter(e => !har.has(e.id));
    if (!till.length) return lista as AppFeedEvent[];
    return [...lista, ...till].sort((a, b) => tid(a) - tid(b));
}
