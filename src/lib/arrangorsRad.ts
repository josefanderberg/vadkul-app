/**
 * "Fler från samma arrangör"-raden - port av webbens cardOrganizerRow
 * ((v2)/page.tsx) + CardMoreRows (ägarbeslut 6/10: sidledsrullande rad, max
 * 12 kommande i tidsordning över ALLA laddade dagar, direktlänk till
 * arrangörssidan när den finns).
 *
 * APP-ANPASSNING: flödet (AppFeedEvent) bär inget hostName, så "samma
 * arrangör" avgörs på KÄLLDOMÄNEN - id ÄR käll-URL:en. Raden visas bara när
 * domänen inte är en biljettplattform/Facebook/Instagram/opt-in-källa
 * (kontraktets ORGANIZER_PLATFORM_DOMAINS) - där säger domänen inget om
 * arrangören. Webben matchar värdnamnet även för plattformar; det kan appen
 * inte förrän flödet bär värdnamn. Domänen parsas med regex, inte new URL -
 * Hermes URL-stöd är inte heltäckande (samma skäl som lib/eventDetalj).
 *
 * Sluggen till arrangörssidan räknas med kontraktets organizerSlug ur
 * värdnamnet (detaljsvarets hostName) - plattforms-/opt-in-fallen är redan
 * bortsållade på domänen ovan, så kontraktets fulla isOrganizerCandidate
 * behövs inte här.
 */
import { organizerSlug, ORGANIZER_PLATFORM_DOMAINS, type AppFeedEvent } from '@vadkul/kontrakt';
import { isEventPast } from './harVarit';

/** Max antal brickor i raden (webbens cardOrganizerRow). */
export const ARRANGÖRSRAD_MAX = 12;

/** Domäner där källdomänen inte är arrangören. Plattformslistan delas med
 *  kontraktet; FB/IG och opt-in-källorna (kyrkan/PRO/Korpen) läggs till här
 *  (webbens isOptInSourceUrl, utan new URL). */
const INTE_ARRANGÖR = /facebook\.com|instagram\.com|svenskakyrkan|(^|\.)pro\.se$|korpen/i;

/** Källdomänen utan www/m/mobile ("abf.se"), null för icke-URL:er. */
export function källDomän(url: string | null | undefined): string | null {
    const m = (url ?? '').trim().match(/^https?:\/\/([^/:?#]+)/i);
    const host = m?.[1]?.replace(/^(?:www|m|mobile)\./i, '').toLowerCase() ?? '';
    return host || null;
}

export interface ArrangörsRad {
    /** null = ingen arrangörssida (värdnamnet har inte landat/dög inte). */
    slug: string | null;
    /** Värdnamnet när det finns, annars domänen. */
    namn: string;
    rader: AppFeedEvent[];
}

/**
 * Raden för det valda eventet: arrangörens övriga KOMMANDE event i flödet,
 * tidsordning, max 12 - eller null när domänen inte pekar ut en arrangör
 * eller inget mer finns. `värdNamn` är detaljsvarets hostName (kan dröja).
 */
export function arrangörsRad(
    valt: AppFeedEvent,
    värdNamn: string | null,
    flöde: readonly AppFeedEvent[],
    nuMs: number,
): ArrangörsRad | null {
    const domän = källDomän(valt.id);
    if (!domän || ORGANIZER_PLATFORM_DOMAINS.test(domän) || INTE_ARRANGÖR.test(domän)) return null;

    const rader = flöde
        .filter(e => e.id !== valt.id && källDomän(e.id) === domän && !isEventPast(e, nuMs))
        .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
        .slice(0, ARRANGÖRSRAD_MAX);
    if (rader.length === 0) return null;

    const namn = (värdNamn ?? '').replace(/\s+/g, ' ').trim();
    const slug = namn.length >= 3 ? organizerSlug(namn) : '';
    return { slug: slug.length >= 2 ? slug : null, namn: namn || domän, rader };
}
