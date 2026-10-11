/**
 * Önskningar mot Firestore - port av webbens services/wishService.ts, mot
 * SAMMA eventWishes-collection och rules (uid == auth.uid vid skapande,
 * ägarskap vid radering, bara fulfilled → true vid uppfyllnad). Hela
 * collectionen läses och filtreras på klienten precis som webben - volymen
 * är liten och det slipper composite-index.
 */
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDocs,
    getFirestore,
    Timestamp,
    updateDoc,
} from '@react-native-firebase/firestore';
import { EVENT_CATEGORY_KEYS } from '@vadkul/kontrakt';
import { aktivaÖnskningar, utgångsTid, type Önskan } from '@/lib/onskningar';

const tillMs = (v: unknown): number => {
    if (v instanceof Timestamp) return v.toMillis();
    const d = new Date(v as string | number | Date).getTime();
    return Number.isFinite(d) ? d : 0;
};

/** Alla AKTIVA önskningar (ej uppfyllda, ej utgångna). */
export async function hämtaÖnskningar(): Promise<Önskan[]> {
    try {
        const snap = await getDocs(collection(getFirestore(), 'eventWishes'));
        const alla: Önskan[] = snap.docs.map(d => {
            const v = d.data() as Record<string, unknown>;
            return {
                id: d.id,
                title: typeof v.title === 'string' ? v.title : '',
                category: typeof v.category === 'string' && (EVENT_CATEGORY_KEYS as readonly string[]).includes(v.category)
                    ? v.category : 'other',
                description: typeof v.description === 'string' ? v.description : '',
                lat: Number(v.lat) || 0,
                lng: Number(v.lng) || 0,
                uid: typeof v.uid === 'string' ? v.uid : '',
                hostName: typeof v.hostName === 'string' && v.hostName ? v.hostName : 'VADKUL-användare',
                createdAt: tillMs(v.createdAt ?? Date.now()),
                expiresAt: tillMs(v.expiresAt ?? Date.now()),
                fulfilled: v.fulfilled === true,
            };
        });
        return aktivaÖnskningar(alla, Date.now());
    } catch (e) {
        console.warn('Kunde inte hämta önskningar:', e);
        return [];
    }
}

/** Skapa en önskan (kräver inloggning - reglerna verifierar uid == auth.uid).
 *  expiresAt sätts på klienten, precis som webben. */
export async function skapaÖnskan(input: {
    title: string;
    category: string;
    description?: string;
    lat: number;
    lng: number;
    uid: string;
    hostName: string;
}): Promise<string> {
    const createdAt = Date.now();
    const ref = await addDoc(collection(getFirestore(), 'eventWishes'), {
        title: input.title.trim(),
        category: input.category || 'other',
        description: input.description?.trim() || '',
        lat: input.lat,
        lng: input.lng,
        uid: input.uid,
        hostName: input.hostName,
        createdAt: Timestamp.fromMillis(createdAt),
        expiresAt: Timestamp.fromMillis(utgångsTid(createdAt)),
        fulfilled: false,
    });
    return ref.id;
}

/** Markera en önskan som uppfylld - kallas när någon skapat eventet av den.
 *  Reglerna tillåter ENBART fulfilled → true. Best effort. */
export async function markeraÖnskanUppfylld(id: string): Promise<void> {
    try {
        await updateDoc(doc(getFirestore(), 'eventWishes', id), { fulfilled: true });
    } catch (e) {
        console.warn('Kunde inte markera önskan som uppfylld:', e);
    }
}

/** Ta bort sin EGEN önskan (reglerna verifierar ägarskap). */
export async function taBortÖnskan(id: string): Promise<void> {
    await deleteDoc(doc(getFirestore(), 'eventWishes', id));
}
