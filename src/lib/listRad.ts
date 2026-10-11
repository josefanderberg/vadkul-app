/**
 * Raderna i listorna under eventkortet - ren logik portad från webbens
 * components/v2/EventCard.tsx (NearbyRow, getEventStatus, formatTimeHint,
 * failedCoverImages) och EventCardGroupList.tsx (väljarlistans dagar och
 * den hopfällda "har redan varit"-delen).
 *
 *  - BILDFLÖDET (webben 26/8): i kortets infovy är listan under kortet bara
 *    event MED bild, med bilderna på - en rad utan bild visas inte alls.
 *    I listvyn (kortsöket, eller filtret har valt bort eventet) visas ALLA
 *    rader och "Visa bilder"/"Dölj bilder" styr layouten (AV som default,
 *    valet sparas på enheten). Flikarnas tal räknar det som visas.
 *  - Statusbrickan (Pågår/Snart/Idag/Inom 3h/Inom 5h/Har varit) och
 *    tidshinten ("kl 19:00", "tors 19:00") är webbens - samma gränser som
 *    kartans dämpning (lib/harVarit).
 *  - Väljarlistan (multievent): kommande dag för dag, passerade HOPFÄLLDA
 *    längst ner ("🕐 N har redan varit · Visa") - webbens EventCardGroupList.
 */
import type { AppFeedEvent } from '@vadkul/kontrakt';
import { MANADER, VECKODAGAR } from './eventTid';
import { isEventPast, NO_TIME_PAST_HOUR } from './harVarit';
import { eventDagar, type Dag } from './vy';

type Tidsatt = Pick<AppFeedEvent, 'time' | 'hasSpecificTime'>;

export type EventStatus = 'past' | 'ongoing' | 'soon' | 'within3' | 'within5' | 'later' | 'today';

const TIMME = 60 * 60 * 1000;

/** Webbens getEventStatus: en timmes standardlängd, kl 20 för event utan klockslag. */
export function eventStatus(e: Tidsatt, nuMs: number): EventStatus {
    const t = new Date(e.time);
    if (Number.isNaN(t.getTime())) return 'later';
    if (e.hasSpecificTime === false) {
        const gräns = new Date(t);
        gräns.setHours(NO_TIME_PAST_HOUR, 0, 0, 0);
        if (nuMs >= gräns.getTime()) return 'past';
        return t.toDateString() === new Date(nuMs).toDateString() ? 'today' : 'later';
    }
    const start = t.getTime();
    if (nuMs >= start + TIMME) return 'past';
    if (nuMs >= start) return 'ongoing';
    const kvar = start - nuMs;
    if (kvar <= TIMME) return 'soon';
    if (kvar <= 3 * TIMME) return 'within3';
    if (kvar <= 5 * TIMME) return 'within5';
    return 'later';
}

/** Statusbrickan (webbens StatusBadge) - null för 'later' (ingen bricka). */
export const STATUS_BRICKA: Record<Exclude<EventStatus, 'later'>, { text: string; bg: string; färg: string }> = {
    ongoing: { text: 'Pågår', bg: '#10b981', färg: '#ffffff' },
    // Event utan klockslag: vi vet inte när på dagen - säg bara "Idag".
    today: { text: 'Idag', bg: '#6ee7b7', färg: '#064e3b' },
    soon: { text: 'Snart', bg: '#f59e0b', färg: '#ffffff' },
    within3: { text: 'Inom 3h', bg: '#fcd34d', färg: '#78350f' },
    within5: { text: 'Inom 5h', bg: '#7dd3fc', färg: '#0c4a6e' },
    past: { text: 'Har varit', bg: '#cbd5e1', färg: '#334155' },
};

const klocka = (t: Date) => `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;

/**
 * Webbens formatTimeHint: klockslaget alltid ("kl 19:00" idag, "tors 19:00"
 * en annan dag). Utan klockslag: bara dagen - och idag före kl 20 ingenting
 * (brickan säger redan "Idag").
 */
export function tidsHint(e: Tidsatt, nuMs: number): string {
    const t = new Date(e.time);
    if (Number.isNaN(t.getTime())) return '';
    const sammaDag = t.toDateString() === new Date(nuMs).toDateString();
    if (e.hasSpecificTime === false) {
        if (sammaDag) {
            const gräns = new Date(t);
            gräns.setHours(NO_TIME_PAST_HOUR, 0, 0, 0);
            return nuMs >= gräns.getTime() ? 'Idag' : '';
        }
        return `${VECKODAGAR[t.getDay()]} ${t.getDate()} ${MANADER[t.getMonth()]}`;
    }
    return sammaDag ? `kl ${klocka(t)}` : `${VECKODAGAR[t.getDay()]} ${klocka(t)}`;
}

// Trasiga bildlänkar (webbens failedCoverImages - bl.a. biblioteksevent med
// https://…:80/-bilder som aldrig laddar). En rad vars bild redan är känd
// som trasig renderas bildlös direkt (eller inte alls i bildflödet); felar
// den medan raden syns står ramen kvar så inget under hoppar.
const trasigaBilder = new Set<string>();

export function markeraTrasigBild(url: string): void {
    trasigaBilder.add(url);
}

/** Har eventet en visningsbar bild (finns och har inte felat förut)? */
export function harBild(e: Pick<AppFeedEvent, 'img'>): boolean {
    return !!e.img && !trasigaBilder.has(e.img);
}

/** Bildflödet: bara event med bild (webbens imagesOnlyList-filter). */
export function bildflöde<T extends Pick<AppFeedEvent, 'img'>>(events: readonly T[]): T[] {
    return events.filter(e => !!e.img);
}

/**
 * Väljarlistan: kommande dag för dag (tidsordning inom dagen) och de
 * passerade för sig i tidsordning - de visas hopfällda längst ner.
 */
export function delaVäljarlista<T extends Pick<AppFeedEvent, 'id' | 'time' | 'hasSpecificTime'>>(
    grupp: readonly T[],
    nu: Date,
): { dagar: Dag<T>[]; passerade: T[] } {
    const nuMs = nu.getTime();
    const passerad = (e: T) => isEventPast(e, nuMs);
    const dagar = eventDagar(grupp, -Infinity, nu, passerad);
    const passerade = grupp
        .filter(passerad)
        .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return { dagar, passerade };
}

/** Väljarlistans räknarrad: "5 event på samma plats · 2 dagar · 1 har varit". */
export function väljarRäknare(antal: number, dagar: number, passerade: number): string {
    return `${antal} event på samma plats`
        + (dagar > 1 ? ` · ${dagar} dagar` : '')
        + (passerade > 0 && passerade < antal ? ` · ${passerade} har varit` : '');
}
