/**
 * Eventsökets rena logik: fritext mot titel och plats i regionens flöde.
 * Rankningen följer webbens läxa (eventsök-rankningen 11/9): titeln väger
 * tyngst - prefixträff i titeln först, sen titelträff, sist platsträff.
 * Ingen fuzzy/autocorrect (avstängd på webben av samma skäl).
 */
import type { AppFeedEvent } from '@vadkul/kontrakt';

const normalisera = (s: string) => s.toLowerCase().trim();

/** Bästa träffarna först; tom fråga ger tom lista. */
export function sokEvent(events: AppFeedEvent[], fråga: string, max = 50): AppFeedEvent[] {
    const q = normalisera(fråga);
    if (!q) return [];
    const träffar: { e: AppFeedEvent; vikt: number }[] = [];
    for (const e of events) {
        const titel = normalisera(e.title);
        const plats = normalisera(e.locationName ?? '');
        let vikt = -1;
        if (titel.startsWith(q)) vikt = 0;
        else if (titel.includes(q)) vikt = 1;
        else if (plats.includes(q)) vikt = 2;
        if (vikt >= 0) träffar.push({ e, vikt });
    }
    träffar.sort((a, b) => a.vikt - b.vikt
        || new Date(a.e.time).getTime() - new Date(b.e.time).getTime());
    return träffar.slice(0, max).map(t => t.e);
}
