/**
 * Boost-overlayn för SKRAPADE event - port av webbens fetchActiveBoosts
 * (services/linkEventService.ts): eventBoosts/{slug} skrivs av backend efter
 * en betald boost på webben (skrapade event har inget linkEvents-dokument
 * att sätta featuredUntil på). Dokumentet bär eventId (= käll-URL:en =
 * appens id) och featuredUntil. Egna event bär fältet på sitt eget dokument
 * och läses av data/anvandarEvent - lib/boost slår ihop de två vägarna.
 *
 * EN delad Firestore-lyssnare oavsett hur många ytor som frågar (kortet,
 * listan, kartan) - samma refräknade singleton som data/stjarnor. Frågan
 * tar bara AKTIVA boostar (featuredUntil > nu vid prenumerationen): en
 * handfull små dokument, ingen egress-fälla. Att en boost gått ut syns
 * ändå direkt - lib/boost jämför featuredUntil mot nu vid varje rendering.
 *
 * Reglerna: eventBoosts är läsbar för alla, aldrig skrivbar från klienten.
 */
import { collection, getFirestore, onSnapshot, query, where } from '@react-native-firebase/firestore';
import { tolkaTid } from '@/lib/anvandarEvent';
import { INGA_BOOSTAR, type Boostar } from '@/lib/boost';

type Lyssnare = (boostar: Boostar) => void;

let senaste: Boostar = INGA_BOOSTAR;
const lyssnare = new Set<Lyssnare>();
let riv: (() => void) | null = null;

/**
 * Prenumerera på de aktiva boostarna (eventId → featuredUntil i ms).
 * Callbacken får senaste kartan direkt och sedan varje ändring. Returnerar
 * avprenumerationen.
 */
export function prenumereraBoostar(cb: Lyssnare): () => void {
    lyssnare.add(cb);
    cb(senaste);
    if (!riv) {
        riv = onSnapshot(
            query(collection(getFirestore(), 'eventBoosts'), where('featuredUntil', '>', new Date())),
            snap => {
                const boostar = new Map<string, number>();
                snap.forEach(d => {
                    const v = d.data() as { eventId?: unknown; featuredUntil?: unknown };
                    const slut = tolkaTid(v.featuredUntil);
                    if (typeof v.eventId === 'string' && v.eventId && slut) boostar.set(v.eventId, slut.getTime());
                });
                senaste = boostar;
                for (const l of lyssnare) l(boostar);
            },
            // Overlayn är ren kosmetik ovanpå flödet - ett fel får aldrig
            // stoppa något, boosten dyker upp vid nästa start i stället.
            err => console.warn('Kunde inte läsa boostarna:', err),
        );
    }
    return () => {
        lyssnare.delete(cb);
        if (lyssnare.size === 0 && riv) {
            riv();
            riv = null;
            senaste = INGA_BOOSTAR;
        }
    };
}
