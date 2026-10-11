/**
 * Egna användarskapade event: skapa, uppdatera, ta bort och eventbildens
 * uppladdning - port av webbens services/linkEventService.ts (createUserEvent,
 * updateUserEvent, deleteUserEvent) och services/storageService.ts
 * (uploadFile). SAMMA dokument och rules som webben: linkEvents med hårt
 * formbegränsad hasOnly-lista, bilden i Storage under event-images/<uid>/.
 *
 * Payload-besluten bor i lib/skapaEvent (testbara utan Firebase); här sätts
 * bara Firebase-typerna: Timestamp för tiden, serverTimestamp-stämplarna och
 * deleteField för fält som ska bort.
 *
 * APP-ANPASSNING bilden: webbens browser-image-compression (maxSizeMB 0.8,
 * maxWidthOrHeight 1920) motsvaras av expo-image-manipulator - längsta sidan
 * klipps till 1920 och JPEG-komprimeras, sedan putFile i stället för
 * uploadBytes (RN laddar upp från fil-URI, inte Blob).
 */
import {
    addDoc,
    collection,
    deleteDoc,
    deleteField,
    doc,
    getFirestore,
    serverTimestamp,
    Timestamp,
    updateDoc,
} from '@react-native-firebase/firestore';
import { getDownloadURL, getStorage, putFile, ref } from '@react-native-firebase/storage';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { nyttEventDok, ändratEventDok, type EventInmatning } from '@/lib/skapaEvent';

/** Webbens maxWidthOrHeight - längre sidor än så krymps före uppladdning. */
const MAX_BILDSIDA = 1920;

/**
 * Ladda upp eventbilden till Storage (webbens
 * storageService.uploadFile('event-images/<uid>/', fil)). Returnerar
 * nedladdnings-URL:en som sparas i coverImage. Kastar vid fel - anroparen
 * avgör om eventet ska sparas utan bild (webben gör det).
 */
export async function laddaUppEventBild(
    uid: string,
    bild: { uri: string; width?: number; height?: number },
): Promise<string> {
    let uri = bild.uri;
    try {
        const längsta = Math.max(bild.width ?? 0, bild.height ?? 0);
        const sammanhang = ImageManipulator.manipulate(bild.uri);
        // Bara nedskalning - en mindre bild ska inte blåsas upp till 1920.
        if (längsta > MAX_BILDSIDA) {
            sammanhang.resize((bild.width ?? 0) >= (bild.height ?? 0)
                ? { width: MAX_BILDSIDA }
                : { height: MAX_BILDSIDA });
        }
        const renderad = await sammanhang.renderAsync();
        const sparad = await renderad.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
        uri = sparad.uri;
    } catch (e) {
        // Komprimering är best effort precis som på webben - originalet duger.
        console.warn('Bildkomprimering misslyckades, laddar upp originalet:', e);
    }
    // Unikt filnamn per uppladdning (webbens Date.now()_slump när path slutar på /).
    const sökväg = `event-images/${uid}/${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const bildRef = ref(getStorage(), sökväg);
    // putFile tar fil-URI:n rakt av (file://-prefixet skalas i RN Firebase).
    await putFile(bildRef, uri);
    return getDownloadURL(bildRef);
}

/**
 * Skapa ett eget event eller tips (webbens createUserEvent). Reglerna kräver
 * hostUid == auth.uid och - för anonyma sessioner - isTip: true. Returnerar
 * dokument-id:t.
 */
export async function skapaEgetEvent(
    input: EventInmatning & { hostUid: string; anonTip?: boolean },
): Promise<string> {
    const dok = nyttEventDok(input);
    const payload: Record<string, unknown> = {
        ...dok,
        time: Timestamp.fromDate(input.time),
        createdAt: serverTimestamp(),
    };
    const kollektion = collection(getFirestore(), 'linkEvents');
    try {
        const skapad = await addDoc(kollektion, payload);
        return skapad.id;
    } catch (e: unknown) {
        // Gamla rules utan price i hasOnly avvisar HELA skrivningen - släpp
        // priset och spara eventet ändå (webbens reträtt, se createUserEvent).
        const kod = String((e as { code?: unknown })?.code ?? '');
        if (kod.includes('permission-denied') && payload.price !== undefined) {
            console.warn('[event] pris avvisat av reglerna - sparar utan pris');
            delete payload.price;
            const skapad = await addDoc(kollektion, payload);
            return skapad.id;
        }
        throw e;
    }
}

/**
 * Uppdatera ett eget event (webbens updateUserEvent). Tomma valfria fält
 * RADERAS ur dokumentet, och `updatedAt` stämplas som scraperns stamped() -
 * utan den missar den inkrementella SQLite-syncen ändringen.
 */
export async function uppdateraEgetEvent(id: string, input: EventInmatning): Promise<void> {
    const { sätt, radera } = ändratEventDok(input);
    const payload: Record<string, unknown> = {
        ...sätt,
        time: Timestamp.fromDate(input.time),
        updatedAt: serverTimestamp(),
    };
    for (const nyckel of radera) payload[nyckel] = deleteField();
    await updateDoc(doc(getFirestore(), 'linkEvents', id), payload);
}

/**
 * Ta bort ett eget event (webbens deleteUserEvent). Reglerna släpper bara
 * igenom hostUid == auth.uid - eller anonyma tips, som vem som helst får städa.
 */
export async function raderaEgetEvent(id: string): Promise<void> {
    await deleteDoc(doc(getFirestore(), 'linkEvents', id));
}
