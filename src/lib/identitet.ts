/**
 * Den anonyma identiteten, delad mellan samtidiga anrop (josefanderberg/VADKUL#164).
 * Port av webbens utils/anonymousIdentity.
 *
 * Förut kollade säkerställIdentitet bara `auth.currentUser` och anropade sedan
 * signInAnonymously. Bjud med anropar svara (som säkerställer identiteten i
 * bakgrunden) och direkt därefter säkerställIdentitet igen, så båda passerade
 * kollen innan den första inloggningen var klar och två anonyma konton
 * skapades. Ungefär 7 % av de anonyma kontona kom i par inom en sekund.
 *
 * Nu delas ett pågående anrop: alla som frågar medan inloggningen pågår får
 * samma promise och samma uid. När den är klar (eller har kastat) börjar nästa
 * anrop om. `klar` behövs inte i appen (RN Firebase har den sparade sessionen
 * synkront vid start) men finns för paritet med webben.
 *
 * Ren logik utan firebase-import: kontoContext kopplar in auth-anropen.
 */
export interface IdentitetsBeroenden {
    /** Löses när Firebase vet om det finns en sparad session. */
    klar?: () => Promise<void>;
    /** uid för sessionen som är aktiv nu (inloggad eller anonym), annars null. */
    nuvarandeUid: () => string | null;
    /** Skapar en anonym session och ger dess uid. */
    loggaInAnonymt: () => Promise<string>;
}

export function deladIdentitet(b: IdentitetsBeroenden): () => Promise<string> {
    let pågående: Promise<string> | null = null;
    return () => {
        const uid = b.nuvarandeUid();
        if (uid) return Promise.resolve(uid);
        if (!pågående) {
            const p = (async () => {
                if (b.klar) await b.klar();
                return b.nuvarandeUid() ?? await b.loggaInAnonymt();
            })();
            pågående = p;
            const släpp = () => { if (pågående === p) pågående = null; };
            p.then(släpp, släpp);
        }
        return pågående;
    };
}
