/**
 * Kommer/Intresserad-svaret - port av webbens utils/rsvpTransition (ägarbeslut
 * 6/10, spår 3): ett tryck på samma knapp togglar av, ett tryck på den andra
 * byter - ömsesidigt uteslutande.
 *
 * APP-LÄGE: svaret bor PÅ ENHETEN (lib/rsvpContext, NYCKEL.rsvp) tills
 * konto-API:t är deployat - webbens räknare (eventStats.going/.interested),
 * avatarraden och inbjudningsbannern kräver Firestore och utelämnas här,
 * samma mönster som sparadeContext ("favoriter cacheas lokalt"). Webbens
 * rsvpShareId (veckoserietillfällen svarar på seriens dokument) behövs inte:
 * appflödet bär inga användarskapade event.
 */

export type RsvpStatus = 'going' | 'interested';

export interface RsvpLista {
    going: string[];
    interested: string[];
}

export const TOM_RSVP: RsvpLista = { going: [], interested: [] };

/** Fler event än så minns enheten inte - äldsta svaret åker ut först. */
export const RSVP_MAX = 500;

/** Webbens nextRsvp: samma knapp = av, andra knappen = byt. */
export function nextRsvp(prev: RsvpStatus | null, pressed: RsvpStatus): RsvpStatus | null {
    return prev === pressed ? null : pressed;
}

/** Mitt svar på eventet, eller null. */
export function minRsvp(lista: RsvpLista, id: string): RsvpStatus | null {
    if (lista.going.includes(id)) return 'going';
    if (lista.interested.includes(id)) return 'interested';
    return null;
}

/** Nästa lagringstillstånd efter ett tryck på `tryckt` för eventet. */
export function växlaRsvp(lista: RsvpLista, id: string, tryckt: RsvpStatus): RsvpLista {
    const nästa = nextRsvp(minRsvp(lista, id), tryckt);
    const utan = (xs: string[]) => xs.filter(x => x !== id);
    const going = utan(lista.going);
    const interested = utan(lista.interested);
    if (nästa) {
        const mål = nästa === 'going' ? going : interested;
        mål.push(id);
        if (mål.length > RSVP_MAX) mål.splice(0, mål.length - RSVP_MAX);
    }
    return { going, interested };
}
