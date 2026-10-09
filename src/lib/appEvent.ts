/**
 * Appens eventtyp: flödets AppFeedEvent plus fälten ett ANVÄNDARSKAPAT event
 * (eget VADKUL-event eller tips) bär. Appflödet innehåller bara skrapade
 * event - de användarskapade läses ur Firestore (data/anvandarEvent) och
 * tolkas av lib/anvandarEvent. Alla extrafält är valfria, så ett vanligt
 * AppFeedEvent ÄR ett AppEvent och kan gå genom samma kod.
 *
 * Fälten speglar kontraktets LinkEvent (webbens form) men tiderna är
 * ISO-strängar, som i resten av flödet.
 *
 * OBS id: för skrapade event är `id` käll-URL:en (och utlänken). För
 * användarskapade är det dokument-id:t (serietillfällen "<docId>__<datum>")
 * - kod som gör `e.url ?? e.id` till en länk måste först kolla userCreated.
 */
import { isVadkulHostedEvent, type AppFeedEvent } from '@vadkul/kontrakt';

export type AppEvent = AppFeedEvent & {
    /** Skapat av en användare på VADKUL - eget event eller tips. */
    userCreated?: true;
    /**
     * Dokument-id:t i linkEvents. För serietillfällen SERIENS dokument: allt
     * som rör själva dokumentet (rapportera, ta bort, RSVP) går hit, inte på
     * tillfällets eget id.
     */
    docId?: string;
    /** Uttryckligt tips - tipsaren är inte arrangör (se ärEgetVadkulEvent). */
    isTip?: boolean;
    /** Tipset lämnades utan konto. */
    anonTip?: boolean;
    hostName?: string;
    /** Skaparens uid - ägarskap (ta bort/redigera). */
    hostUid?: string;
    description?: string;
    price?: number | string;
    repeatWeekly?: boolean;
    /** Seriens längd i VECKOR inklusive första. Saknas = tills vidare. */
    repeatWeeks?: number;
    /** 2 = varannan vecka. Saknas = varje vecka. */
    repeatIntervalWeeks?: number;
    /** Dagsserie: så många dagar i rad (2-14). Vinner över repeatWeekly. */
    repeatDays?: number;
    /**
     * Bara på utvecklade tillfällen av en BEGRÄNSAD serie: sista tillfällets
     * tid (ISO). Tillfällets `time` är dess eget datum, så utan fältet hade
     * "t.o.m."-raden flyttat fram ett steg för varje tillfälle.
     */
    seriesEndsAt?: string;
};

/**
 * Eget VADKUL-event (grön presentation, anmälan på sidan)? Kontraktets
 * isVadkulHostedEvent - falskt för tips och skrapade event. AppEvent saknar
 * url när länken saknas, kontraktet vill ha en sträng.
 */
export function ärEgetVadkulEvent(e: AppEvent): boolean {
    return isVadkulHostedEvent({ userCreated: e.userCreated, url: e.url ?? '', isTip: e.isTip });
}
