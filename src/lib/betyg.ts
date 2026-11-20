/**
 * Grinden för systemets betygsruta (josefanderberg/VADKUL#194): NÄR appen får
 * be om ett betyg. Ren logik - lagringen och själva rutan bor i
 * lib/betygsFraga.
 *
 * Reglerna:
 *  - Frågan ställs bara efter ett lyckat ögonblick: ett eget tryck på Kommer.
 *    Aldrig vid start och aldrig på väg ut ur appen (ANMÄL-länken, Bjud med).
 *  - Först när man visat att man använder appen: tredje Kommer-svaret, eller
 *    ett Kommer-svar från och med tredje dagen man öppnat appen.
 *  - Högst en gång per appversion. Apple släpper dessutom bara fram rutan tre
 *    gånger per år och användare, och Google har en egen kvot.
 */

export interface BetygsLäge {
    /** Antal gånger man tryckt PÅ Kommer (av-tryck räknas inte). */
    kommer: number;
    /** Antal olika dagar appen öppnats. */
    dagar: number;
    /** Senast räknade dag, 'ÅÅÅÅ-MM-DD' lokal tid. */
    senasteDag: string | null;
    /** Appversionen som frågan senast ställdes i. */
    frågadVersion: string | null;
}

export const TOMT_BETYGSLÄGE: BetygsLäge = { kommer: 0, dagar: 0, senasteDag: null, frågadVersion: null };

export const KOMMER_TRÖSKEL = 3;
export const DAGAR_TRÖSKEL = 3;

/** Dagen som nyckel i lokal tid - en ny dag börjar vid midnatt där man är. */
export function dagNyckel(nu: Date): string {
    const två = (n: number) => String(n).padStart(2, '0');
    return `${nu.getFullYear()}-${två(nu.getMonth() + 1)}-${två(nu.getDate())}`;
}

/** Lagringen kan vara trasig eller från en äldre form - ta bara det som håller. */
export function läsBetygsLäge(rå: unknown): BetygsLäge {
    if (!rå || typeof rå !== 'object') return TOMT_BETYGSLÄGE;
    const r = rå as Record<string, unknown>;
    const antal = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
    const text = (v: unknown) => (typeof v === 'string' && v ? v : null);
    return {
        kommer: antal(r.kommer),
        dagar: antal(r.dagar),
        senasteDag: text(r.senasteDag),
        frågadVersion: text(r.frågadVersion),
    };
}

/** Appen öppnades `dag`: en ny dag räknas, samma dag igen gör ingenting. */
export function noteraDag(läge: BetygsLäge, dag: string): BetygsLäge {
    if (läge.senasteDag === dag) return läge;
    return { ...läge, dagar: läge.dagar + 1, senasteDag: dag };
}

/** Ett tryck som satte Kommer. */
export function noteraKommer(läge: BetygsLäge): BetygsLäge {
    return { ...läge, kommer: läge.kommer + 1 };
}

/** Ska rutan visas nu? Anropas direkt efter noteraKommer, alltså bara i det
 *  lyckade ögonblicket. */
export function skaFrågaOmBetyg(läge: BetygsLäge, version: string): boolean {
    if (läge.kommer < 1) return false;
    if (läge.frågadVersion === version) return false;
    return läge.kommer >= KOMMER_TRÖSKEL || läge.dagar >= DAGAR_TRÖSKEL;
}

/** Frågan är ställd i den här versionen - nästa tidigast i nästa version. */
export function markeraFrågad(läge: BetygsLäge, version: string): BetygsLäge {
    return { ...läge, frågadVersion: version };
}
