/**
 * Stjärngåvan ⭐ mot Firestore och Cloud Functions - port av webbens
 * services/starService.ts. Klienten LÄSER bara: eventStars (liten, max en
 * stjärna per tidig användare) och users starsAvailable; placeringen går
 * via callablen placeStar som rå HTTPS (lib/stjarnor - appen saknar
 * functions-native-modulen).
 *
 * Prenumerationen är EN delad Firestore-lyssnare oavsett hur många ytor som
 * lyssnar (kortet + kartan): refräknad singleton, rivs när sista ytan
 * släpper - samma reads-disciplin som övriga datalagret.
 */
import { getAuth } from '@react-native-firebase/auth';
import { collection, doc, getDoc, getFirestore, onSnapshot } from '@react-native-firebase/firestore';
import { byggCallableAnrop, tolkaCallableSvar } from '@/lib/stjarnor';

type Lyssnare = (ids: ReadonlySet<string>) => void;

let senaste: ReadonlySet<string> = new Set();
const lyssnare = new Set<Lyssnare>();
let riv: (() => void) | null = null;

/**
 * Prenumerera på ALLA stjärnmärkta event-id:n (webbens
 * subscribeStarredEventIds). Callbacken får senaste mängden direkt och
 * sedan varje ändring. Returnerar avprenumerationen.
 */
export function prenumereraStjärnmärkta(cb: Lyssnare): () => void {
    lyssnare.add(cb);
    cb(senaste);
    if (!riv) {
        riv = onSnapshot(
            collection(getFirestore(), 'eventStars'),
            snap => {
                const ids = new Set<string>();
                snap.forEach(d => {
                    const eventId = (d.data() as { eventId?: unknown }).eventId;
                    if (typeof eventId === 'string') ids.add(eventId);
                });
                senaste = ids;
                for (const l of lyssnare) l(ids);
            },
            err => console.warn('Kunde inte läsa stjärnmärkta event:', err),
        );
    }
    return () => {
        lyssnare.delete(cb);
        if (lyssnare.size === 0 && riv) {
            riv();
            riv = null;
            senaste = new Set();
        }
    };
}

// starsAvailable cachas per uid och appsession - egna placeringar justerar
// cachen direkt ur funktionssvaret (starsLeft), så ingen omläsning behövs.
const kvarCache = new Map<string, number>();

/** Antal oplacerade stjärnor på kontot (users.starsAvailable). */
export async function hämtaStjärnorKvar(uid: string): Promise<number> {
    const cachad = kvarCache.get(uid);
    if (cachad !== undefined) return cachad;
    try {
        const snap = await getDoc(doc(getFirestore(), 'users', uid));
        const v = snap.exists() ? (snap.data() as { starsAvailable?: unknown }).starsAvailable : 0;
        const n = typeof v === 'number' ? Math.max(0, v) : 0;
        kvarCache.set(uid, n);
        return n;
    } catch {
        return 0;
    }
}

/** Sätt EN av sina oplacerade stjärnor på ett event - går inte att ångra.
 *  Webbens placeStar: svaret bär starsLeft (antal kvar efter placeringen). */
export async function sättStjärna(eventId: string): Promise<{ success: boolean; message: string; starsLeft?: number }> {
    try {
        const användare = getAuth().currentUser;
        const token = användare ? await användare.getIdToken() : null;
        const { url, init } = byggCallableAnrop('placeStar', { eventId }, token);
        const res = await fetch(url, init);
        const svar = tolkaCallableSvar<{ success: boolean; message: string; starsLeft?: number }>(await res.json());
        if (!svar) return { success: false, message: 'Kunde inte sätta stjärnan. Försök igen.' };
        if (användare && typeof svar.starsLeft === 'number') kvarCache.set(användare.uid, Math.max(0, svar.starsLeft));
        return svar;
    } catch (e) {
        console.warn('Kunde inte placera stjärnan:', e);
        return { success: false, message: 'Kunde inte sätta stjärnan. Försök igen.' };
    }
}
