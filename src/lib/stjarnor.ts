/**
 * Stjärngåvan ⭐ - ren logik för appens stjärnor (webbens services/
 * starService.ts). All skrivning går via Cloud Functions (placeStar) -
 * Firestore-reglerna blockerar klientskrivning av eventStars och users
 * stjärnfält, så gåvan inte går att förfalska; klienten läser bara.
 *
 * Appen saknar @react-native-firebase/functions (native-modul, dev-bygget
 * är låst), så callablen anropas som RÅ HTTPS enligt callable-protokollet:
 * POST {"data": ...} med Bearer-idToken, svaret är {"result": ...} vid
 * framgång. Funktionerna bor i europe-west1 (apps/functions shared.ts).
 */

export const FUNKTIONS_BAS = 'https://europe-west1-vadkul-f2cb2.cloudfunctions.net';

/** Callable-anropets url + fetch-init (testbart utan nät). */
export function byggCallableAnrop(
    namn: string,
    data: unknown,
    idToken: string | null,
): { url: string; init: { method: 'POST'; headers: Record<string, string>; body: string } } {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (idToken) headers.Authorization = `Bearer ${idToken}`;
    return {
        url: `${FUNKTIONS_BAS}/${namn}`,
        init: { method: 'POST', headers, body: JSON.stringify({ data }) },
    };
}

/** Callable-svarets {"result": ...} - null för felsvar/okänd form. */
export function tolkaCallableSvar<T>(json: unknown): T | null {
    if (json && typeof json === 'object' && 'result' in json) {
        return (json as { result: T }).result ?? null;
    }
    return null;
}

/** Webbens canPlaceStar-grind: inloggad med stjärnor kvar, och eventet har
 *  inte varit - stjärnan vore förbrukad direkt (LinkEventCard 12/7 + 30/9). */
export function kanSättaStjärna(inloggad: boolean, kvar: number, harVarit: boolean): boolean {
    return inloggad && kvar > 0 && !harVarit;
}
