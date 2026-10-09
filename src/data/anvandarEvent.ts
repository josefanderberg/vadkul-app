/**
 * Användarskapade event direkt ur Firestore (ägarbeslut 8/10 2026) - port av
 * webbens services/linkEventService.ts (fetchUserCreatedCount +
 * fetchUserCreatedEvents). De finns inte i appflödet (aggregaten byggs ur
 * pipelinens SQLite och känner inte till dem), så det här är den enda
 * Firestore-läsningen av event: SAMMA fråga som webben, userCreated == true,
 * aldrig hela linkEvents. Tolkningen bor i lib/anvandarEvent, pollens
 * count-prob i lib/anvandarEventPoll.
 */
import {
    collection,
    getCountFromServer,
    getDocs,
    getFirestore,
    query,
    where,
} from '@react-native-firebase/firestore';
import type { AppEvent } from '@/lib/appEvent';
import { tolkaAnvändarEvent } from '@/lib/anvandarEvent';

const användarEventFråga = () =>
    query(collection(getFirestore(), 'linkEvents'), where('userCreated', '==', true));

/**
 * Antalet användarskapade dokument - ETT read oavsett antal (count()).
 * null = frågan gick inte fram ("vet inte"), ALDRIG "noll event".
 */
export async function räknaAnvändarEvent(): Promise<number | null> {
    try {
        const snap = await getCountFromServer(användarEventFråga());
        return snap.data().count;
    } catch (e) {
        console.warn('Kunde inte räkna användarskapade event:', e);
        return null;
    }
}

/**
 * Alla användarskapade event, tolkade och serie-utvecklade. `total` = antalet
 * DOKUMENT frågan matchade (inte längden på `events`) - det är det
 * count-proben jämförs mot. `total: null` = hämtningen misslyckades;
 * anroparen behåller då eventen den redan visar.
 */
export async function hämtaAnvändarEvent(): Promise<{ events: AppEvent[]; total: number | null }> {
    try {
        const snap = await getDocs(användarEventFråga());
        const docs = snap.docs.map(d => ({ id: d.id, data: d.data() as Record<string, unknown> }));
        return { events: tolkaAnvändarEvent(docs, new Date()), total: snap.size };
    } catch (e) {
        console.warn('Kunde inte hämta användarskapade event:', e);
        return { events: [], total: null };
    }
}
