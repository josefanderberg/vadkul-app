/**
 * Privata eventchatten - port av webbens src/services/privateChatService.ts
 * (spår 3): eventChats/{nyckel}/privat/{inbjudarUid}, tråd-/medlemslogiken
 * bor i lib/privatChat (REN, testad). Skild från den publika tråden
 * (data/eventChatt) - och till skillnad från den speglas INGENTING till
 * latestActivity/latestComment: det dokumentet läses av alla, och privata
 * meddelanden ska aldrig dit.
 *
 * Reglerna (deployade 7/10): läsning bara för medlemmar, gå-med bara via sin
 * egen members-nyckel, skapa bara tråden med sitt eget uid som id. Varje väg
 * in har en fel-gren som UI:t visar som "inte aktiverad än" i stället för
 * att krascha (samma degradering som webben).
 */
import {
    FieldPath,
    addDoc,
    collection,
    doc,
    getDoc,
    getFirestore,
    limit,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
} from '@react-native-firebase/firestore';
import type { ChatMessage } from '@vadkul/kontrakt';
import { rsvpShareId } from '@/lib/rsvp';
import { parsePrivateThread, privateChatKey, type PrivateThreadLite } from '@/lib/privatChat';

function threadRef(eventId: string, userCreated: boolean | undefined, threadId: string) {
    return doc(getFirestore(), 'eventChats', privateChatKey(eventId, userCreated), 'privat', threadId);
}

function messagesCol(eventId: string, userCreated: boolean | undefined, threadId: string) {
    return collection(getFirestore(), 'eventChats', privateChatKey(eventId, userCreated), 'privat', threadId, 'messages');
}

// En tråd-skapning per event och session räcker (Bjud in kan tryckas flera
// gånger) - cachen nollas inte vid fel: nekas skapningen hjälper inga
// omförsök den här sessionen.
const ensuredThreads = new Set<string>();

/** Skapa inbjudarens tråd om den saknas - best-effort, fire-and-forget från
 *  Bjud in/Kopiera länk (delningen ÄR redan gjord, tråden får aldrig fälla
 *  den). */
export async function säkerställPrivatTråd(
    eventId: string,
    userCreated: boolean | undefined,
    me: { uid: string; name: string | null },
): Promise<void> {
    const key = `${privateChatKey(eventId, userCreated)}/${me.uid}`;
    if (ensuredThreads.has(key)) return;
    ensuredThreads.add(key);
    try {
        const ref = threadRef(eventId, userCreated, me.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) return;
        await setDoc(ref, {
            eventId: rsvpShareId(eventId, userCreated),
            members: { [me.uid]: true },
            ...(me.name ? { inviterName: me.name.slice(0, 80) } : {}),
            createdAt: serverTimestamp(),
        });
    } catch (e) {
        console.warn('Kunde inte skapa privata chatten:', e);
    }
}

/** Gå med i en tråd via inbjudningslänken (?fran= är trådens id). Rör BARA
 *  sin egen members-nyckel (reglernas Map.diff-lås). Kastar vid fel -
 *  anroparen visar "inte aktiverad än"/"tråden saknas". */
export async function gåMedIPrivatTråd(
    eventId: string,
    userCreated: boolean | undefined,
    threadId: string,
    myUid: string,
): Promise<void> {
    await updateDoc(threadRef(eventId, userCreated, threadId), new FieldPath('members', myUid), true);
}

/** Lyssna på trådarna JAG är med i för ett event. Filtret på den egna
 *  members-nyckeln är det som gör queryn tillåten i reglerna. Fel →
 *  onUnavailable, lyssnaren dör tyst. Riv avprenumerationen vid unmount. */
export function lyssnaPåMinaPrivatTrådar(
    eventId: string,
    userCreated: boolean | undefined,
    myUid: string,
    callback: (threads: PrivateThreadLite[]) => void,
    onUnavailable?: () => void,
) {
    const q = query(
        collection(getFirestore(), 'eventChats', privateChatKey(eventId, userCreated), 'privat'),
        where(new FieldPath('members', myUid), '==', true),
        limit(5),
    );
    return onSnapshot(q, snap => {
        callback(snap.docs
            .map(d => parsePrivateThread(d.id, d.data()))
            .filter((t): t is PrivateThreadLite => t !== null));
    }, () => onUnavailable?.());
}

/** Meddelandena i en tråd - samma 50-senaste-mönster som publika chatten. */
export function lyssnaPåPrivatMeddelanden(
    eventId: string,
    userCreated: boolean | undefined,
    threadId: string,
    callback: (msgs: ChatMessage[]) => void,
    onUnavailable?: () => void,
) {
    const q = query(messagesCol(eventId, userCreated, threadId), orderBy('createdAt', 'desc'), limit(50));
    return onSnapshot(q, snapshot => {
        const messages = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as ChatMessage[];
        callback(messages.reverse());
    }, () => onUnavailable?.());
}

export async function skickaPrivatMeddelande(
    eventId: string,
    userCreated: boolean | undefined,
    threadId: string,
    message: Omit<ChatMessage, 'id' | 'createdAt'>,
): Promise<void> {
    await addDoc(messagesCol(eventId, userCreated, threadId), {
        ...message,
        createdAt: serverTimestamp(),
    });
    // INGEN latestActivity-spegel här - privata meddelanden ska aldrig synas
    // i kartans "senaste kommentaren"-flöde.
}
