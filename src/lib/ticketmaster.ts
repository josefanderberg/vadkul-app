/**
 * Ticketmaster-event - kopia av webbens utils/ticketmasterEvent. Känns igen på
 * värdnamnet i url/id (url är affiliate-redirecten sedan Impact 27/8, id den
 * rena ticketmaster.se-adressen). Ägarbeslut 1/9: guld-bricka och BOKA i guld.
 *
 * Affiliatelänken är ingen försäljning i appen: den öppnar Ticketmasters egen
 * sida, precis som ANMÄL öppnar källans. Upplysningen om provision står i
 * kortet (webbens affiliate-rad) - krav för affiliatelänkar.
 */
const TM_HOST = /(^|\.)ticketmaster\.(se|com|dk|no|fi|de|nl|evyy\.net)$/i;

const värd = (url: string | null | undefined): string | null =>
    (url ?? '').match(/^https?:\/\/([^/:?#]+)/i)?.[1] ?? null;

/** Kopia av webbens utils/affiliateLink (i sin tur pipelinens
 *  AFFILIATE_REDIRECT_HOST) - hålls i synk. */
const AFFILIATE_REDIRECT_HOST = /\.(evyy\.net|sjv\.io|pxf\.io|7eer\.net|ojrq\.net|i\d+\.net|prf\.hn|go2cloud\.org)$/i;

/** Länk vi kan få provision på? Då MÅSTE den märkas "Annons"
 *  (marknadsföringslagen + Impact-villkoren). */
export function isAffiliateUrl(url: string | null | undefined): boolean {
    const h = värd(url);
    if (!h) return false;
    if (AFFILIATE_REDIRECT_HOST.test(h)) return true;
    // Bältet: våra wrappade länkar bär alltid utm_medium=affiliate.
    return /[?&]utm_medium=affiliate(&|#|$)/.test(url ?? '');
}

/** Märkningstexten - samma lydelse som webbens AFFILIATE_DISCLOSURE. */
export const AFFILIATE_DISCLOSURE = 'Annons - biljettlänk från partner, VADKUL kan få provision vid köp.';

export function isTicketmasterEvent(e: { id?: string | null; url?: string | null } | null | undefined): boolean {
    if (!e) return false;
    for (const raw of [e.url, e.id]) {
        const h = värd(raw);
        if (h && TM_HOST.test(h)) return true;
    }
    return false;
}
