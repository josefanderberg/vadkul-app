/**
 * Anmälningar till VADKUL-värdade event - port av webbens
 * services/linkEventService.ts (rsvp, cancelRsvp, subscribeAttendees):
 * linkEvents/{eventId}/attendees/{uid}, ett konto = en anmälan. Reglerna
 * (firestore.rules, attendees) släpper bara igenom ens EGEN anmälan med
 * fälten uid, name, photoURL (https eller null) och createdAt - formen
 * byggs av lib/anmalan anmälanVem. Läsning är publik.
 *
 * eventId är eventets RÅA id, precis som webben (serietillfällen
 * "<docId>__<datum>" anmäls per tillfälle). Prenumerationen startas bara för
 * VADKUL-värdade event som är öppna i kortet (lib/useAnmalan) - riv den när
 * kortet byter event.
 */
import {
    collection,
    deleteDoc,
    doc,
    getFirestore,
    onSnapshot,
    serverTimestamp,
    setDoc,
} from '@react-native-firebase/firestore';
import { sorteraAnmälda, type Anmäld } from '@/lib/anmalan';

const anmälanRef = (eventId: string, uid: string) =>
    doc(getFirestore(), 'linkEvents', eventId, 'attendees', uid);

/** Anmäl sig. Kastar vid fel (nekad skrivning, offline). */
export async function anmäl(eventId: string, vem: { uid: string; name: string; photoURL: string | null }): Promise<void> {
    await setDoc(anmälanRef(eventId, vem.uid), {
        uid: vem.uid,
        name: vem.name,
        photoURL: vem.photoURL,
        createdAt: serverTimestamp(),
    });
}

/** Ta bort sin anmälan. Kastar vid fel. */
export async function avanmäl(eventId: string, uid: string): Promise<void> {
    await deleteDoc(anmälanRef(eventId, uid));
}

/** Vilka som anmält sig, i realtid (äldst först). Returnerar avprenumerationen. */
export function lyssnaPåAnmälda(eventId: string, callback: (lista: Anmäld[]) => void): () => void {
    return onSnapshot(
        collection(getFirestore(), 'linkEvents', eventId, 'attendees'),
        snapshot => {
            callback(sorteraAnmälda(snapshot.docs.map(d => {
                const v = d.data() as { uid?: unknown; name?: unknown; photoURL?: unknown; createdAt?: { toMillis?: () => number } | null };
                const t = typeof v.createdAt?.toMillis === 'function' ? v.createdAt.toMillis() : 0;
                return { id: d.id, uid: v.uid, name: v.name, photoURL: v.photoURL, t };
            })));
        },
        () => callback([]),
    );
}
