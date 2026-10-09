/**
 * Rapportera ett event.
 *
 * App Store-regel 1.2 kräver att appar som visar användarskapat innehåll låter
 * användaren anmäla stötande material och nå oss. VADKUL-flödet blandar skrapat
 * och användarskapat utan att skilja dem åt (AppFeedEvent har ingen UGC-flagga),
 * så rapportvägen ligger på ALLA event.
 *
 * Appen har ingen egen skrivyta mot backend (CLAUDE.md: inget Firestore-SDK,
 * allt via /v1-API:t som inte är deployat än), så rapporten går som ett mejl
 * till hej@vadkul.se med allt vi behöver för att hitta eventet igen. När
 * /v1-API:t är ute kan den här modulen byta ut mailto-raden mot ett POST.
 */
import type { AppFeedEvent } from '@vadkul/kontrakt';

export const RAPPORT_MOTTAGARE = 'hej@vadkul.se';

export const RAPPORT_SKÄL = [
    'Olämpligt eller stötande innehåll',
    'Spam eller bedrägeri',
    'Fel tid, plats eller inställt',
    'Något annat',
] as const;

export type RapportSkäl = (typeof RAPPORT_SKÄL)[number];

/** Käll-URL:en är primärnyckel i hela pipelinen - `url` finns bara när länken skrivits om. */
export function rapportLänk(event: AppFeedEvent): string {
    return event.url ?? event.id;
}

export function rapportÄmne(event: AppFeedEvent): string {
    return `Rapporterat event: ${event.title}`;
}

export function rapportBrödtext(event: AppFeedEvent, skäl: RapportSkäl): string {
    const rader = [
        `Skäl: ${skäl}`,
        '',
        `Event: ${event.title}`,
        `Tid: ${event.time}`,
    ];
    if (event.locationName) rader.push(`Plats: ${event.locationName}`);
    rader.push(`Länk: ${rapportLänk(event)}`);
    rader.push('', 'Beskriv gärna vad som är fel:', '');
    return rader.join('\n');
}

export function rapportMailto(event: AppFeedEvent, skäl: RapportSkäl): string {
    const ämne = encodeURIComponent(rapportÄmne(event));
    const text = encodeURIComponent(rapportBrödtext(event, skäl));
    return `mailto:${RAPPORT_MOTTAGARE}?subject=${ämne}&body=${text}`;
}
