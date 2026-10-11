/**
 * Publika eventchatten - port av webbens src/services/eventChatService.ts
 * (linkEventChatService-delen; den gamla events/-varianten gäller inte
 * kartevent). Kart-events id:n är URL:er (innehåller '/', ogiltigt i
 * dokument-id) - nyckeln URL-enkodas och chatten bor i
 * eventChats/{nyckel}/messages (firestore.rules 8b: läsning öppen på
 * REGELNIVÅ, skrivning kräver konto). UI:t låser chatten bakom inloggning -
 * EventChat startar ingen prenumeration alls för utloggade, så
 * prenumerationen anropas bara med konto (noll läsningar annars).
 *
 * OBS nyckeln går på RÅTT event-id (per tillfälle), till skillnad från
 * privata chatten som går på seriens dokument (lib/privatChat).
 */
import {
    addDoc,
    collection,
    doc,
    getFirestore,
    limit,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
} from '@react-native-firebase/firestore';
import type { ChatMessage } from '@vadkul/kontrakt';

const chatKeyFor = (eventId: string) => encodeURIComponent(eventId).slice(0, 1400);

/** De 50 senaste meddelandena i realtid, äldst först. Returnerar
 *  avprenumerationen - riv den när blocket försvinner (egress). */
export function lyssnaPåChatt(eventId: string, callback: (msgs: ChatMessage[]) => void) {
    const q = query(
        collection(getFirestore(), 'eventChats', chatKeyFor(eventId), 'messages'),
        orderBy('createdAt', 'desc'),
        limit(50),
    );
    return onSnapshot(q, snapshot => {
        const messages = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as ChatMessage[];
        // Vänd tillbaka ordningen så de kommer kronologiskt (äldst → nyast).
        callback(messages.reverse());
    }, () => callback([]));
}

export async function skickaChattMeddelande(
    eventId: string,
    message: Omit<ChatMessage, 'id' | 'createdAt'>,
    eventTitle?: string,
): Promise<void> {
    await addDoc(collection(getFirestore(), 'eventChats', chatKeyFor(eventId), 'messages'), {
        ...message,
        createdAt: serverTimestamp(),
    });
    // Spegla till latestActivity/latestComment - kart-bubblan "senaste
    // kommentaren" (webben) lyssnar på DET dokumentet. Best-effort:
    // meddelandet ÄR redan skickat, spegeln får aldrig fälla det.
    try {
        await setDoc(doc(getFirestore(), 'latestActivity', 'latestComment'), {
            senderId: message.senderId,
            senderName: message.senderName || 'Deltagare',
            text: message.text,
            eventId,
            eventTitle: eventTitle || '',
            createdAt: serverTimestamp(),
        });
    } catch (e) {
        console.warn('Kunde inte uppdatera senaste-kommentaren:', e);
    }
}
