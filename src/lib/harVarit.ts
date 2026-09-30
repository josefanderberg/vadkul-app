/**
 * "Har varit"-gränsen - kopia av webbens eventPastAt/isEventPast
 * (components/v2/v2MapBricka) som ALLA ytor delar: ett event räknas som
 * passerat en timme efter start, eller kl 20 sin dag om klockslag saknas
 * (NO_TIME_PAST_HOUR). Uppfinn ingen egen gräns för en ny yta - använd den här.
 *
 * Här bor också auto-hoppet till Imorgon (webbens utils/autoDayBump): kommer
 * man till staden när allt redan varit står kartan själv på Imorgon.
 */
import type { AppFeedEvent } from '@vadkul/kontrakt';

export const NO_TIME_PAST_HOUR = 20;
const ONE_HOUR_MS = 60 * 60 * 1000;

type Tidsatt = Pick<AppFeedEvent, 'time' | 'hasSpecificTime'>;

/** Tidpunkten då eventet slocknar, null = aldrig (ogiltig tid). */
export function eventPastAt(e: Tidsatt): number | null {
    const t = new Date(e.time);
    if (Number.isNaN(t.getTime())) return null;
    if (e.hasSpecificTime === false) {
        t.setHours(NO_TIME_PAST_HOUR, 0, 0, 0);
        return t.getTime();
    }
    return t.getTime() + ONE_HOUR_MS;
}

export function isEventPast(e: Tidsatt, nowMs: number): boolean {
    const at = eventPastAt(e);
    return at !== null && at <= nowMs;
}

/** Från den här timmen räknas heldagsposter inte som skäl att stanna på idag. */
export const AUTO_BUMP_EVENING_HOUR = 17;

/** Finns det inget kvar att gå på idag? En helt tom dag räknas som slut först
 *  på kvällen (dagtid är det tom-promptens jobb). */
export function todayIsSpent(today: readonly Tidsatt[], nowMs: number): boolean {
    const evening = new Date(nowMs).getHours() >= AUTO_BUMP_EVENING_HOUR;
    if (today.length === 0) return evening;
    const live = today.filter(e => !isEventPast(e, nowMs));
    if (live.length === 0) return true;
    if (!evening) return false;
    return live.every(e => e.hasSpecificTime === false);
}

/** Hoppa till Imorgon: idag är slut OCH imorgon har något. */
export function shouldAutoBumpDay(today: readonly Tidsatt[], tomorrow: readonly Tidsatt[], nowMs: number): boolean {
    return todayIsSpent(today, nowMs) && tomorrow.length > 0;
}
