/**
 * Hoppet till kartan - port av webbens jumpToEvent (app/(v2)/page.tsx) +
 * V2Maps recenterOnSelected. Ett event som väljs i SÖKET, PROFILEN (sparade,
 * Mina event, vänner) eller på STADSSIDAN öppnas PÅ KARTAN i stället för i
 * ett eget kort ovanpå skärmen: panelen stängs, dagen blir eventets dag och
 * eventet väljs som vid ett kartklick - så kortet får Nästa-knappen och
 * listan under kortet precis som när man tryckt på en bricka (§10).
 *
 *  - Kön: skärmen lägger hoppet med `begärKartHopp` och stänger sig själv
 *    (router.dismissTo('/')); kartskärmen prenumererar och tar hoppet. Hela
 *    eventobjektet följer med, så ett event ur ett annat läns flöde (söket
 *    "jazz i göteborg", en sparad Malmö-konsert) inte behöver hämtas om.
 *  - Kameran (webbens recenterOnSelected): syns brickan redan ovanför kortet
 *    står kameran still; annars panorerar den dit på SAMMA zoom med brickan
 *    på 40 % av höjden - aldrig inzoomning.
 *  - Kommer hoppet från en stadssida (eller sökets ort) landar kartan i den
 *    staden; annars byts stad bara när eventet ligger i ett annat län
 *    (flödet är per län) - då närmaste stad.
 *  - Retur (webbens searchReturn): ett kort som kom från söket eller
 *    stadssidan bär ← ☰ tillbaka dit så länge man står kvar på eventet.
 */
import type { Href } from 'expo-router';
import { CITIES, type AppFeedEvent, type City } from '@vadkul/kontrakt';
import { nearestCity } from './regionVal';
import { dagOffset, iBild, type Ruta } from './vy';

/** Vart ← ☰ tar en tillbaka. */
export interface HoppRetur {
    /** Tillgänglighetsetiketten på pilen: "Tillbaka till sökningen". */
    etikett: string;
    href: Href;
}

export interface KartHopp {
    event: AppFeedEvent;
    /** Staden eventet hör till om skärmen vet det (stadssidan, sökets ort). */
    stadSlug?: string | null;
    retur?: HoppRetur | null;
}

let väntande: KartHopp | null = null;
const lyssnare = new Set<() => void>();

/** Lägg ett hopp i kön - kartskärmen tar det (direkt om den lyssnar). */
export function begärKartHopp(hopp: KartHopp): void {
    väntande = hopp;
    for (const l of [...lyssnare]) l();
}

/** Ta det väntande hoppet (högst ett - det senaste vinner). */
export function taKartHopp(): KartHopp | null {
    const h = väntande;
    väntande = null;
    return h;
}

/** Lyssna på nya hopp. Returnerar avregistreringen. */
export function prenumereraKartHopp(fn: () => void): () => void {
    lyssnare.add(fn);
    return () => { lyssnare.delete(fn); };
}

/**
 * Hoppets dag: eventets kalenderdag, klampad till flödets horisont. Ett
 * passerat event från profilens historik landar på idag (kartan visar inga
 * förflutna dagar) - kortet visar ändå eventet.
 */
export function hoppDag(e: Pick<AppFeedEvent, 'time'>, nu: Date, maxOffset: number): number {
    const d = dagOffset(e.time, nu);
    if (!Number.isFinite(d)) return 0;
    return Math.max(0, Math.min(maxOffset, d));
}

/**
 * Staden kartan ska byta till, eller null när den kan stå kvar.
 *  - Skärmens stad (stadssidan, sökets ort "jazz i göteborg") vinner: kartan
 *    landar i den staden så stadsplattan stämmer - som stadssidans "Visa på
 *    kartan".
 *  - Annars byts stad bara när eventet inte finns i kartans flöde och ligger
 *    i ett annat län (flödet är per län) - då närmaste stad.
 */
export function hoppStad(
    e: Pick<AppFeedEvent, 'lat' | 'lng'>,
    { iFlödet, stad, stadSlug }: { iFlödet: boolean; stad: Pick<City, 'slug' | 'region'>; stadSlug?: string | null },
): City | null {
    const känd = stadSlug ? CITIES.find(c => c.slug === stadSlug) : undefined;
    if (känd) return känd.slug === stad.slug ? null : känd;
    if (iFlödet || !Number.isFinite(e.lat) || !Number.isFinite(e.lng)) return null;
    const närmast = nearestCity(e.lat, e.lng);
    return närmast.region === stad.region ? null : närmast;
}

/** Hur stor del av skärmen (nedifrån) kortet döljer när det öppnar -
 *  webbens recenterOnSelected (cardBottom 0.42). */
export const KORT_DÖLJER = 0.42;
/** Brickans höjd i bild efter panoreringen (webbens targetYRatio 0.40). */
const MÅL_Y = 0.4;

/**
 * Kamerans nya mitt, eller null när brickan redan syns ovanför kortet
 * (kameran står still). Panoreringen behåller zoomen: mitten läggs så att
 * brickan hamnar på 40 % av höjden, alltså ovanför kortet.
 */
export function hoppPanorering(e: Pick<AppFeedEvent, 'lat' | 'lng'>, ruta: Ruta): [number, number] | null {
    if (iBild(e.lat, e.lng, ruta, KORT_DÖLJER)) return null;
    const [, s, , n] = ruta;
    // Rutans höjd i grader räcker på stadszoom (mercatorfelet är försumbart
    // över några kilometer): brickan 10 % ovanför mitten → mitten 10 % söderut.
    return [e.lng, e.lat - (n - s) * (0.5 - MÅL_Y)];
}
