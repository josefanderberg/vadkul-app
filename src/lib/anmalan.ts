/**
 * Anmälan till VADKUL-värdade event - ren logik bakom ANMÄL i svarsraden
 * (data/anmalan skriver, lib/useAnmalan håller läget). Port av webbens
 * LinkEventCard (handleRsvpToggle + listan "N anmälda") och
 * services/linkEventService rsvp/subscribeAttendees.
 *
 * Skrapade event och tips har en utlänk - där är ANMÄL länken ut. Egna
 * VADKUL-event har ingen länk, anmälan sker i appen (Josef 29/10: "man kan
 * inte anmäla sig till event som är skapade på vadkul. anmälknappen finns
 * inte ens").
 */

/** En anmälan som den visas: linkEvents/{id}/attendees/{uid}. */
export interface Anmäld {
    uid: string;
    name: string;
    photoURL: string | null;
}

/** Reglernas tak för namnet (firestore.rules, attendees). */
export const ANMÄLAN_NAMN_MAX = 80;
/** Så många namn räknas upp under raden - resten blir "och N till". */
export const ANMÄLDA_NAMN_VISAS = 5;

/**
 * Namn och bild att skriva i anmälan. Namnet: profilens, kontots, e-posten,
 * annars webbens "VADKUL-användare". Bilden bara som https och högst 500
 * tecken - annars nekar reglerna hela skrivningen, så hellre ingen bild.
 */
export function anmälanVem(
    profilNamn: string | null | undefined,
    användare: { displayName?: string | null; email?: string | null },
    photoURL: string | null | undefined,
): { name: string; photoURL: string | null } {
    const namn = [profilNamn, användare.displayName, användare.email]
        .map(n => (n ?? '').replace(/\s+/g, ' ').trim())
        .find(n => n.length > 0);
    const bild = typeof photoURL === 'string' && /^https:\/\//.test(photoURL) && photoURL.length <= 500
        ? photoURL
        : null;
    return { name: (namn || 'VADKUL-användare').slice(0, ANMÄLAN_NAMN_MAX), photoURL: bild };
}

/** Dokumenten i anmälningsordning (äldst först, som webben); trasiga fält
 *  får webbens reservvärden. `t` = createdAt i ms (0 om det saknas). */
export function sorteraAnmälda(
    rader: readonly { id: string; uid?: unknown; name?: unknown; photoURL?: unknown; t: number }[],
): Anmäld[] {
    return [...rader]
        .sort((a, b) => a.t - b.t)
        .map(r => ({
            uid: typeof r.uid === 'string' && r.uid ? r.uid : r.id,
            name: typeof r.name === 'string' && r.name.trim() ? r.name.trim() : 'Anonym',
            photoURL: typeof r.photoURL === 'string' ? r.photoURL : null,
        }));
}

/** Raden under svarsraden: vilka som kommer (webbens "N anmälda"). */
export function anmäldaRad(lista: readonly Anmäld[]): string {
    if (lista.length === 0) return 'Ingen anmäld än - bli först!';
    const rubrik = lista.length === 1 ? '1 anmäld' : `${lista.length} anmälda`;
    const namn = lista.slice(0, ANMÄLDA_NAMN_VISAS).map(a => a.name).join(', ');
    const fler = lista.length - ANMÄLDA_NAMN_VISAS;
    return `${rubrik}: ${namn}${fler > 0 ? ` och ${fler} till` : ''}`;
}
