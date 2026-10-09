/**
 * eventStats/{slug} - port av webbens services/eventStatsService.ts. Samma
 * dokument som webben: likes, going/interested, views och ANMÄL-klicken
 * (clicks/clicksByMonth/clicksByDay, outreach-mejlens underlag). Doc-id är
 * eventShareSlug(id) eftersom skrapade events rå-id är en URL.
 *
 * Räknarna är best-effort precis som på webben: fire-and-forget, fel sväljs,
 * och läsningen ger null (siffran döljs) i stället för att ljuga "0".
 */
import { doc, getDoc, getFirestore, increment, setDoc } from '@react-native-firebase/firestore';
import { eventShareSlug } from '@vadkul/kontrakt';

const statsDoc = (eventId: string) => doc(getFirestore(), 'eventStats', eventShareSlug(eventId));

function skrivTyst(eventId: string, fält: Record<string, unknown>): void {
    try {
        setDoc(statsDoc(eventId), { ...fält, eventId }, { merge: true }).catch(() => {
            /* nätverk/regler nere - släpp räknaren, aldrig själva handlingen */
        });
    } catch {
        /* defensivt - en trasig räknare får aldrig fälla kortet */
    }
}

/** Hjärtat: +1 vid gillning, -1 när den tas bort (webbens recordEventLike). */
export function räknaGilla(eventId: string, delta: 1 | -1): void {
    skrivTyst(eventId, { likes: increment(delta) });
}

/** Kommer/Intresserad-räknarna - deltan från lib/rsvp (rsvpDeltan). */
export function räknaRsvp(eventId: string, d: { going: number; interested: number }): void {
    const fält: Record<string, unknown> = {};
    if (d.going) fält.going = increment(d.going);
    if (d.interested) fält.interested = increment(d.interested);
    if (Object.keys(fält).length) skrivTyst(eventId, fält);
}

/** En kortöppning (webbens recordEventView). Siffran visas aldrig (31/8). */
export function räknaVisning(eventId: string): void {
    skrivTyst(eventId, { views: increment(1) });
}

/**
 * ANMÄL/BOKA-klicket = en besökare skickad till arrangören (webbens
 * recordEventClick). NÄSTLADE mapar - setDoc+merge deep-mergar dem, medan en
 * punktnyckel hade blivit ett bokstavligt fältnamn.
 */
export function räknaKlick(e: { id: string; url?: string; title?: string; hostName?: string }): void {
    const nu = new Date().toISOString();
    let domain: string | null = null;
    try { domain = new URL(e.url || e.id).hostname.replace(/^www\./, ''); } catch { /* icke-URL */ }
    skrivTyst(e.id, {
        clicks: increment(1),
        clicksByMonth: { [nu.slice(0, 7)]: increment(1) },
        clicksByDay: { [nu.slice(0, 10)]: increment(1) },
        ...(e.title ? { title: e.title } : {}),
        ...(e.hostName ? { hostName: e.hostName } : {}),
        ...(domain ? { domain } : {}),
    });
}

export interface Engagemang { likes: number; going: number; interested: number }

// En läsning per event och appsession - hjärtat och svarsraden delar den.
// Fel cachas inte (nästa öppning försöker igen).
const cache = new Map<string, Promise<Engagemang | null>>();

export function hämtaEngagemang(eventId: string): Promise<Engagemang | null> {
    const slug = eventShareSlug(eventId);
    let p = cache.get(slug);
    if (!p) {
        p = (async () => {
            try {
                const snap = await getDoc(statsDoc(eventId));
                const d = snap.exists() ? (snap.data() as Record<string, unknown>) : null;
                // Ett decrement vars +1 aldrig nådde servern kan ge minus - visa aldrig det.
                const n = (v: unknown) => (typeof v === 'number' ? Math.max(0, v) : 0);
                return { likes: n(d?.likes), going: n(d?.going), interested: n(d?.interested) };
            } catch {
                return null;
            }
        })();
        cache.set(slug, p);
        void p.then(v => { if (v === null) cache.delete(slug); });
    }
    return p;
}
