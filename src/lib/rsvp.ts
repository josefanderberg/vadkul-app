/**
 * Kommer/Intresserad-svaret - port av webbens utils/rsvpTransition (ägarbeslut
 * 6/10, spår 3): ett tryck på samma knapp togglar av, ett tryck på den andra
 * byter - ömsesidigt uteslutande.
 *
 * Svaret bor PÅ ENHETEN (lib/rsvpContext, NYCKEL.rsvp) för snabb visning och
 * skrivs SEDAN 8/10 också till Firestore (data/rsvp + räknarna i
 * data/eventStats + kontots spegel) - samma dokument som webben.
 */
import { eventShareSlug } from '@vadkul/kontrakt';

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

/** Räknardeltat för övergången prev -> next (webbens rsvpCountDeltas), så
 *  eventStats.going/.interested aldrig glider ur synk med valet. */
export function rsvpDeltan(
    prev: RsvpStatus | null,
    nästa: RsvpStatus | null,
): { going: number; interested: number } {
    const d = { going: 0, interested: 0 };
    if (prev === nästa) return d;
    if (prev) d[prev] -= 1;
    if (nästa) d[nästa] += 1;
    return d;
}

/** Svarets dokument-id: veckoserietillfällen ("<docId>__2026-09-18") svarar
 *  på seriens DOKUMENT - samma regel som delningslänken (/e/). */
export function rsvpShareId(eventId: string, userCreated: boolean | undefined): string {
    return userCreated ? eventId.split('__')[0] : eventId;
}

/** BJUD MED-länken (webbens inviteUrl): /e/<slug>?inb=1&fran=<uid>.
 *  fromUid null = ingen identitet än (länken funkar, men utan avsändare). */
export function inbjudningsUrl(eventId: string, userCreated: boolean | undefined, fromUid: string | null): string {
    const fran = fromUid ? `&fran=${encodeURIComponent(fromUid)}` : '';
    return `https://vadkul.se/e/${eventShareSlug(rsvpShareId(eventId, userCreated))}?inb=1${fran}`;
}

/**
 * VADKUL-VÄRDADE EVENT: KOMMER OCH ANMÄL ÄR SAMMA SVAR (ägarbeslut 4/11,
 * Josef: "man ska väl kunna klicka på någon av dem ... de ska ha samma
 * verkan") - port av webbens hostedAttendeeAction/hostedRegisterAction.
 * Två lager finns kvar (svaret här + anmälan i linkEvents/{id}/attendees,
 * lib/useAnmalan) men ett tryck på den ena slår båda.
 */

/** Kommer/Intresserad-trycket (prev → next): vad händer med anmälan? */
export function anmälanVidSvar(prev: RsvpStatus | null, next: RsvpStatus | null): 'anmäl' | 'avanmäl' | null {
    if (next === 'going' && prev !== 'going') return 'anmäl';
    if (prev === 'going' && next !== 'going') return 'avanmäl';
    return null;
}

/** ANMÄL-knappen: 'svara' = tryck Kommer (svaret byter och anmälan följer
 *  med via anmälanVidSvar); 'växla' = bara anmälan, svaret står redan rätt
 *  (anmäld på en annan enhet, eller ett svar från före kopplingen). */
export function anmälKnappensVerkan(anmäld: boolean, mitt: RsvpStatus | null): 'svara' | 'växla' {
    if (!anmäld) return mitt !== 'going' ? 'svara' : 'växla';
    return mitt === 'going' ? 'svara' : 'växla';
}
