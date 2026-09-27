/**
 * Eventkortets detaljlager. Appflödet (AppFeedEvent) är medvetet bantat -
 * beskrivning och värdnamn finns inte där, utan hämtas per event från webbens
 * /api/event?id= (~1 kB, CDN-cachat) när kortet öppnas. Hjälparna här är
 * kopior av webbens utils/hostLabel + utils/eventExpand så att appens kort
 * säger exakt samma sak som webbens - ändras de där ska de ändras här.
 */

/** Detaljfälten kortet bryr sig om ur /api/event-svaret (webbens DeepLinkEvent). */
export interface EventDetalj {
    description?: string;
    hostName?: string;
    url?: string;
}

/**
 * Värdetikett - hostName när den finns, annars källans domän ("Facebook",
 * "svenskakyrkan.se"), "Okänd" bara när inte ens en länk finns. Webben
 * använder new URL(); här parsas värden med regex eftersom Hermes URL-stöd
 * inte är heltäckande - beteendet för http(s)-adresser är detsamma.
 */
export function hostLabelFor(hostName: string | null | undefined, url: string | null | undefined): string {
    const h = (hostName ?? '').trim();
    if (h) return h;
    const m = (url ?? '').trim().match(/^https?:\/\/([^/:?#]+)/i);
    const host = m?.[1]?.replace(/^(?:www|m|mobile)\./i, '') ?? '';
    if (!host) return 'Okänd';
    if (/(^|\.)facebook\.com$/i.test(host)) return 'Facebook';
    if (/(^|\.)instagram\.com$/i.test(host)) return 'Instagram';
    return host;
}

/**
 * Äldre skrapade beskrivningar tappade radbrytningarna helt - styckena sitter
 * ihop ("…11:30Klasserna…"). Saknar texten \n men har sådana skarvar stoppas
 * radbrytningar in. Nyskrapat innehåll har riktiga \n och lämnas orört.
 * (Kopia av webbens utils/eventExpand.withRecoveredLineBreaks.)
 */
export function withRecoveredLineBreaks(text: string): string {
    if (!text || text.includes('\n')) return text;
    return text
        .replace(/([.!?…)])(?=[A-ZÅÄÖ"“])/g, '$1\n')
        .replace(/(\d)(?=[A-ZÅÄÖ])/g, '$1\n');
}

/** Vad beskrivningsstycket visar: texten, "hämtar" medan API-svaret väntas,
 *  annars "ingen beskrivning". Samma ordalydelser som webben. */
export function descriptionText(text: string | null | undefined, pending: boolean): string {
    const t = (text ?? '').trim();
    if (t) return withRecoveredLineBreaks(t);
    return pending ? 'Hämtar beskrivning…' : 'Ingen beskrivning tillgänglig.';
}
