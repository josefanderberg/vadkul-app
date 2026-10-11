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

const ärHttpUrl = (s: unknown): s is string => typeof s === 'string' && /^https?:\/\//i.test(s);

/**
 * Utlänken bakom ANMÄL: detaljsvarets `url` när den finns (för Ticketmaster
 * är det affiliate-redirecten - den får inte tappas bort till förmån för den
 * rena adressen i id:t), annars id:t självt - url ÄR primärnyckeln för
 * skrapade event. Bara http(s) släpps igenom. (Kopia av webbens
 * utils/eventExpand.eventOutlink.)
 */
export function eventOutlink(id: string, url?: string | null): string | null {
    if (ärHttpUrl(url)) return url;
    if (ärHttpUrl(id)) return id;
    return null;
}

/** Vad beskrivningsstycket visar: texten, "hämtar" medan API-svaret väntas,
 *  annars "ingen beskrivning". Samma ordalydelser som webben. */
export function descriptionText(text: string | null | undefined, pending: boolean): string {
    const t = (text ?? '').trim();
    if (t) return withRecoveredLineBreaks(t);
    return pending ? 'Hämtar beskrivning…' : 'Ingen beskrivning tillgänglig.';
}

/**
 * Källans favicon till Värd-raden i kortets huvud - samma duckduckgo-tjänst
 * som webben (utils/eventExpand.hostFaviconUrl). Värden plockas med regex i
 * stället för new URL(), som hostLabelFor ovan (Hermes).
 */
export function hostFaviconUrl(url: string | null | undefined): string | null {
    const m = (url ?? '').trim().match(/^https?:\/\/([^/:?#]+)/i);
    return m ? `https://icons.duckduckgo.com/ip3/${m[1]}.ico` : null;
}
