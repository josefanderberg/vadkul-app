/**
 * Arrangörssidans underlag ur APPFLÖDET (28/10). Sidan frågade förr webbens
 * /api/arrangor, men den routen finns inte på vadkul.se (404) - därför stod
 * det "Okänd arrangör" på varje arrangör (Josef 28/10). Appen har sedan 19/10
 * hela Sveriges flöde laddat, så urvalet görs här i stället, med samma
 * slug-regel som webbens arrangörssidor och stadssidornas arrangörschips
 * (kontraktets organizerPageSlug på flödets hostName).
 *
 * Kortets "Fler från samma arrangör" väljer på KÄLLDOMÄNEN (lib/arrangorsRad)
 * - flödet bär hostName bara för arrangörer med sida. Därför tar sidan även
 * med domänen när länken kommer därifrån, så sidan visar samma event som
 * raden lovade.
 */
import { organizerPageSlug, type AppFeedEvent } from '@vadkul/kontrakt';
import { källDomän } from './arrangorsRad';
import { nearestCity } from './regionVal';

/** Högst så många hemorter i underrubriken. */
export const ARRANGÖR_STÄDER_MAX = 4;

export interface ArrangörUrFlöde {
    slug: string;
    name: string;
    /** Källsajterna (utan www), vanligaste först. */
    domains: string[];
    /** Närmaste stad per event, vanligaste först (max ARRANGÖR_STÄDER_MAX). */
    cities: { slug: string; name: string }[];
    /** Arrangörens event i tidsordning - sidan sållar bort de passerade. */
    events: AppFeedEvent[];
}

/** Nycklarna i fallande frekvens; lika många = först sedd först. */
function vanligastFörst(nycklar: string[]): string[] {
    const antal = new Map<string, number>();
    for (const k of nycklar) antal.set(k, (antal.get(k) ?? 0) + 1);
    return [...antal.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
}

/**
 * Arrangören `slug` ur flödet. `namn`/`domän` kommer med länken från kortet
 * (null från stadssidans chips och universella länkar). null = inget event
 * matchar och inget namn finns - sidan visar då "Okänd arrangör".
 */
export function arrangörUrFlöde(
    slug: string,
    flöde: readonly AppFeedEvent[],
    { namn = null, domän = null }: { namn?: string | null; domän?: string | null } = {},
): ArrangörUrFlöde | null {
    const events = flöde
        .filter(e => (!!e.hostName && organizerPageSlug(e.hostName, e.id) === slug)
            || (!!domän && källDomän(e.id) === domän))
        .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    const name = (namn ?? '').replace(/\s+/g, ' ').trim()
        || vanligastFörst(events.flatMap(e => (e.hostName ? [e.hostName] : [])))[0]
        || domän
        || '';
    if (!name) return null;

    const domains = vanligastFörst(events.flatMap(e => {
        const d = källDomän(e.id);
        return d ? [d] : [];
    }));
    const städer = new Map<string, string>();
    const stadSlugs = events.map(e => {
        const c = nearestCity(e.lat, e.lng);
        städer.set(c.slug, c.name);
        return c.slug;
    });
    const cities = vanligastFörst(stadSlugs)
        .slice(0, ARRANGÖR_STÄDER_MAX)
        .map(s => ({ slug: s, name: städer.get(s)! }));
    return { slug, name, domains, cities, events };
}
