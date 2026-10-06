/**
 * Kortsökets matchning - kopia av webbens matchesCardSearch (EventCard,
 * ägarbeslut 6/10: "högst upp på eventkorten, så man direkt kan söka efter
 * event i listan"): enkel delsträngsmatchning, ingen rankning - det är
 * sökpanelens jobb (lib/sok). Webben matchar titel + plats + värdnamn;
 * appflödet bär inget värdnamn (AppFeedEvent), så här är det titel + plats.
 */
import type { AppFeedEvent } from '@vadkul/kontrakt';

export function matcharKortSök(e: AppFeedEvent, term: string): boolean {
    const t = term.trim().toLowerCase();
    if (!t) return true;
    return (
        e.title.toLowerCase().includes(t)
        || (e.locationName ?? '').toLowerCase().includes(t)
    );
}
