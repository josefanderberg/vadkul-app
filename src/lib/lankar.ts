/**
 * vadkul.se-länkar i appen: universella länkar, notisernas url-fält
 * (functions: /e/<slug>, /evenemang/<stad>) och delningssidans HTML. Appens
 * rutter speglar webbens adresser (src/app/e, evenemang, arrangor), så en
 * länk blir en appsökväg genom att bara skala bort ursprunget.
 * Regex i stället för new URL - Hermes URL-stöd är inte heltäckande.
 */

/** Sökvägen (med query) för en vadkul.se-adress eller en relativ sökväg;
 *  null för allt annat (främmande domäner, trasiga värden). */
export function appSökväg(url: string | null | undefined): string | null {
    const u = (url ?? '').trim();
    if (u.startsWith('/')) return u;
    const m = u.match(/^https?:\/\/(?:www\.)?vadkul\.se(\/[^#]*)?(?:#.*)?$/i);
    if (!m) return null;
    return m[1] || '/';
}

/** Eventets id ur delningssidans "Öppna på kartan"-länk (/?event=<id>). */
export function idUrDelningssida(html: string): string | null {
    const m = html.match(/href="\/\?event=([^"&]+)/);
    if (!m) return null;
    try {
        return decodeURIComponent(m[1].replace(/&amp;/g, '&'));
    } catch {
        return null;
    }
}
