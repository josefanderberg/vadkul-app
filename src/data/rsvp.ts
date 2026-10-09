/**
 * Det publika Kommer/Intresserad-svaret - port av webbens
 * services/rsvpService.ts: eventRsvps/{slug}/svar/{uid}, slug =
 * eventShareSlug(rsvpShareId(...)) som eventStats. ANONYMA svar räknas med
 * (webbens ensureTipIdentity, här kontoContext.säkerställIdentitet) och har
 * varken namn eller bild - grå avatar i svarsraden.
 *
 * Räknarna (eventStats.going/.interested) skrivs separat (data/eventStats);
 * kontots spegel (users.goingEventIds) i data/anvandare.
 */
import {
    collection,
    deleteDoc,
    doc,
    getDocs,
    getFirestore,
    limit,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
} from '@react-native-firebase/firestore';
import { eventShareSlug } from '@vadkul/kontrakt';
import { rsvpShareId, type RsvpStatus } from '@/lib/rsvp';

export interface RsvpAnsikte {
    uid: string;
    name: string | null;
    photoURL: string | null;
    status: RsvpStatus;
}

const slugFör = (eventId: string, userCreated: boolean | undefined) =>
    eventShareSlug(rsvpShareId(eventId, userCreated));

/** Skriv (eller ta bort, status null) sitt svar. Kastar vid fel. */
export async function sparaRsvp(
    eventId: string,
    userCreated: boolean | undefined,
    uid: string,
    status: RsvpStatus | null,
    vem: { name?: string | null; photoURL?: string | null },
): Promise<void> {
    const slug = slugFör(eventId, userCreated);
    const ref = doc(getFirestore(), 'eventRsvps', slug, 'svar', uid);
    if (status === null) {
        await deleteDoc(ref);
    } else {
        await setDoc(ref, {
            eventId: rsvpShareId(eventId, userCreated),
            status,
            ...(vem.name ? { name: vem.name } : {}),
            ...(vem.photoURL ? { photoURL: vem.photoURL } : {}),
            createdAt: serverTimestamp(),
        });
    }
    ansikten.delete(slug);
}

// En läsning per event och appsession; egna svar invaliderar (ovan).
const ansikten = new Map<string, Promise<RsvpAnsikte[]>>();

/** De första svaren för avatarraden, äldst först (inbjudaren står främst).
 *  Fel ger tom lista - raden döljs i stället för att ljuga. */
export function hämtaAnsikten(eventId: string, userCreated: boolean | undefined, max = 12): Promise<RsvpAnsikte[]> {
    const slug = slugFör(eventId, userCreated);
    let p = ansikten.get(slug);
    if (!p) {
        p = (async () => {
            try {
                const snap = await getDocs(query(
                    collection(getFirestore(), 'eventRsvps', slug, 'svar'),
                    orderBy('createdAt', 'asc'),
                    limit(max),
                ));
                return snap.docs.map(d => {
                    const data = d.data() as Record<string, unknown>;
                    return {
                        uid: d.id,
                        name: typeof data.name === 'string' ? data.name : null,
                        photoURL: typeof data.photoURL === 'string' ? data.photoURL : null,
                        status: data.status === 'interested' ? 'interested' : 'going',
                    } satisfies RsvpAnsikte;
                });
            } catch {
                return [];
            }
        })();
        ansikten.set(slug, p);
    }
    return p;
}
