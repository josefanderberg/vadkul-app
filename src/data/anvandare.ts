/**
 * users/{uid} direkt i Firestore (ägarbeslut 8/10 2026) - port av webbens
 * services/userService.ts och profilspeglingen i context/AuthContext.tsx.
 * SAMMA dokument som webben skriver, så ett konto är samma konto på båda.
 *
 * Profilfälten valideras med kontraktets valideraMeProfilIn innan de skrivs
 * (samma felmeddelanden som /v1/me-API:t hade), och staden slås upp i
 * CITIES så `city` + `citySlug` alltid följs åt - webbens profilpanel läser båda.
 */
import {
    arrayRemove,
    arrayUnion,
    deleteDoc,
    doc,
    getDoc,
    getFirestore,
    serverTimestamp,
    setDoc,
} from '@react-native-firebase/firestore';
import { CITIES, valideraMeProfilIn, type Kön, type MeProfil, type MeProfilIn } from '@vadkul/kontrakt';
import { ApiFel } from '@/lib/kontoFel';

const användarDoc = (uid: string) => doc(getFirestore(), 'users', uid);

/** Webbens getUserProfile, i kontraktets MeProfil-form. null = inget dokument. */
export async function hämtaProfil(uid: string, email: string | null): Promise<MeProfil | null> {
    const snap = await getDoc(användarDoc(uid));
    if (!snap.exists()) return null;
    const d = snap.data() as Record<string, unknown>;
    const text = (v: unknown) => (typeof v === 'string' && v ? v : null);
    return {
        uid,
        email: text(d.email) ?? email,
        displayName: text(d.displayName),
        age: typeof d.age === 'number' ? d.age : null,
        gender: text(d.gender) as Kön | null,
        city: text(d.city),
        citySlug: text(d.citySlug),
        hasChildren: typeof d.hasChildren === 'boolean' ? d.hasChildren : null,
    };
}

/**
 * Spara profilfält (slå ihop). Staden sätts som ett AKTIVT val
 * (citySource 'manual', som webbens profilpanel) - GPS-vägen skriver aldrig
 * över den. Kastar ApiFel med kontraktets text vid ogiltig indata.
 */
export async function sparaProfil(uid: string, email: string | null, input: MeProfilIn): Promise<void> {
    const v = valideraMeProfilIn(input);
    if (!v.ok) throw new ApiFel(v.fel, 400);
    const { citySlug, ...rest } = v.värde;
    const stad = citySlug ? CITIES.find(c => c.slug === citySlug) : null;
    await setDoc(användarDoc(uid), {
        uid,
        ...(email ? { email } : {}),
        ...rest,
        ...(citySlug === null ? { city: null, citySlug: null, citySource: 'manual', cityUpdatedAt: serverTimestamp() } : {}),
        ...(stad ? { city: stad.name, citySlug: stad.slug, citySource: 'manual', cityUpdatedAt: serverTimestamp() } : {}),
    }, { merge: true });
}

/** Första inloggningen (webbens register/Google-spegling): grunddokumentet. */
export async function skapaGrundprofil(uid: string, email: string | null, displayName: string | null): Promise<void> {
    await setDoc(användarDoc(uid), {
        uid,
        ...(email ? { email } : {}),
        ...(displayName ? { displayName } : {}),
        createdAt: serverTimestamp(),
    }, { merge: true });
}

/** Kontoradering steg 1 (webbens deleteUserDoc) - Auth-kontot raderas efter. */
export async function raderaAnvändarDoc(uid: string): Promise<void> {
    await deleteDoc(användarDoc(uid));
}

/** Läs ett fält som är en lista av strängar (savedEventIds, goingEventIds ...). */
export async function läsIdLista(uid: string, fält: 'savedEventIds' | 'goingEventIds' | 'interestedEventIds'): Promise<string[]> {
    const snap = await getDoc(användarDoc(uid));
    const v = snap.exists() ? (snap.data() as Record<string, unknown>)[fält] : null;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

/** Webbens addSavedEventId/removeSavedEventId: ETT id i taget med
 *  arrayUnion/arrayRemove, så gillningar gjorda på andra enheter aldrig
 *  skrivs över. Påminnelsejobbet (functions/reminders) frågar på listan. */
export async function sättSparad(uid: string, id: string, på: boolean): Promise<void> {
    await setDoc(användarDoc(uid), { savedEventIds: på ? arrayUnion(id) : arrayRemove(id) }, { merge: true });
}

/** Webbens applyRsvpEventId: svaret läggs i den nya listan och tas ur den andra. */
export async function sättRsvpId(uid: string, id: string, nästa: 'going' | 'interested' | null): Promise<void> {
    await setDoc(användarDoc(uid), {
        goingEventIds: nästa === 'going' ? arrayUnion(id) : arrayRemove(id),
        interestedEventIds: nästa === 'interested' ? arrayUnion(id) : arrayRemove(id),
    }, { merge: true });
}

/** Ett enskilt inställningsfält på kontot (weeklyDigest, mapCategories ...). */
export async function sättFält(uid: string, fält: Record<string, unknown>): Promise<void> {
    await setDoc(användarDoc(uid), fält, { merge: true });
}

/** Läs råa fält ur kontots dokument (inställningar som inte hör till MeProfil). */
export async function läsFält(uid: string): Promise<Record<string, unknown> | null> {
    const snap = await getDoc(användarDoc(uid));
    return snap.exists() ? (snap.data() as Record<string, unknown>) : null;
}
