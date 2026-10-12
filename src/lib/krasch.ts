/**
 * Ren logik för kraschrapporteringen (data/krasch kör den mot Crashlytics).
 *
 * Integritetsregeln: rapporterna bär ALDRIG personuppgifter. Det enda som
 * knyter en rapport till en person är uid när man är inloggad på riktigt -
 * anonyma sessioner (svar/tips utan konto) och utloggade får tomt id. Övriga
 * attribut beskriver bara vilket JS-paket som körde (EAS Update når gamla
 * byggen, så buildnumret räcker inte för att veta vilken kod som kraschade).
 */

/**
 * Crashlytics vill ha ett Error - ett kastat värde kan vara vad som helst.
 * Andra värden än Error/sträng serialiseras INTE (ett kastat objekt kan bära
 * användardata), bara typen följer med.
 */
export function somFel(e: unknown): Error {
    if (e instanceof Error) return e;
    if (typeof e === 'string') return new Error(e);
    return new Error(`Kastat icke-Error-värde (${e === null ? 'null' : typeof e})`);
}

export interface UppdateringsInfo {
    updateId: string | null;
    channel: string | null;
    runtimeVersion: string | null;
    isEmbeddedLaunch: boolean;
}

/** Attributen som sätts på varje rapport: vilket JS-paket som körde. */
export function uppdateringsAttribut(u: UppdateringsInfo): Record<string, string> {
    return {
        js_paket: u.isEmbeddedLaunch ? 'inbyggt' : 'ota',
        update_id: u.updateId ?? 'ingen',
        kanal: u.channel ?? 'ingen',
        runtime: u.runtimeVersion ?? 'ingen',
    };
}
