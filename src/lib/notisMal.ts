/**
 * Vart ett tryck på en push-notis ska leda. functions skickar webbens sökväg
 * i data.url (huvudrepots apps/functions: påminnelsen '/e/<slug>', helgtipset
 * '/evenemang/<stad>', larmen '/'). Appen har samma rutter som de universella
 * länkarna (app/e, app/evenemang, app/arrangor), så sökvägen går rakt in i
 * routern - men bara sökvägar vi känner igen. Allt annat (gamla notistyper som
 * '/event/<id>' och '/chat', fulla URL:er) landar på kartan.
 */
const KÄNDA_PREFIX = ['/e/', '/evenemang/', '/arrangor/', '/stad/'];

export function notisMål(data: Record<string, unknown> | undefined | null): string | null {
    if (!data) return null;
    const url = data.url;
    if (typeof url !== 'string' || url.length === 0) return null;
    if (!url.startsWith('/') || url.startsWith('//')) return '/';
    if (url === '/' || url.startsWith('/?')) return url;
    return KÄNDA_PREFIX.some(p => url.startsWith(p) && url.length > p.length) ? url : '/';
}
