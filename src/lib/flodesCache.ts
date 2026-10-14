/**
 * Appflödets cache på telefonen - den rena logiken. Disken bor i
 * lib/flodesDisk, hämtningen i api/appFeed.
 *
 * BAKGRUND (14/10 2026, driftkostnaden): regionpaketet
 * (/api/events/app-<region>, 1,3-1,8 MB okomprimerat) låg bara i minnet, så
 * varje kallstart laddade ner det igen. Nattkedjan bygger om det ungefär en
 * gång per dygn och servern/CDN:et svarar 304 på If-None-Match. Nu sparas
 * senaste paketet + ETag:en på telefonen: appen visar det sparade direkt och
 * frågar CDN:et i bakgrunden, högst en gång per KONTROLL_INTERVALL_MS.
 *
 * Ett sparat paket kan vara från en tidigare dag. Det får aldrig visa
 * passerade event som kommande: utanPasserade drar samma gräns som
 * pipelinen bygger flödet med (scraperns utils/appFeed buildAppFeeds -
 * eventet måste starta i dag eller senare).
 */
import type { AppFeedPayload } from '@vadkul/kontrakt';
import { dagStart } from './dagar';

/**
 * Så länge räcker en kontroll. Samma timme som CDN:ets s-maxage - att fråga
 * oftare ger samma svar ur kant-cachen.
 */
export const KONTROLL_INTERVALL_MS = 60 * 60 * 1000;

/** Så många regioner sparas på disken; äldst skrivna åker ut. */
export const SPARADE_REGIONER = 3;

/** Höjs när filformatet ändras - gamla filer underkänns då och hämtas om. */
export const SPARAT_VERSION = 1;

/** Flödets horisont om paketet inte anger någon (pipelinens APP_FEED_DAYS). */
const STANDARD_DAGAR = 14;
const DAG_MS = 24 * 60 * 60 * 1000;

/** Filen på disken: paketet + ETag:en det kom med. */
export interface SparatFlöde {
    v: typeof SPARAT_VERSION;
    region: string;
    etag: string | null;
    payload: AppFeedPayload;
}

/** Duger det som ett appflöde? (Svarskroppen eller en sparad fil.) */
export function ärFlöde(x: unknown): x is AppFeedPayload {
    if (!x || typeof x !== 'object') return false;
    const p = x as Partial<AppFeedPayload>;
    return typeof p.updatedAt === 'string' && Array.isArray(p.events);
}

/**
 * Filens text, byggd av svarskroppen som den kom - ingen JSON.stringify av
 * ett paket på närmare 2 MB på JS-tråden. `payloadText` måste vara giltig
 * JSON (anroparen har redan parsat den).
 */
export function sparadText(region: string, etag: string | null, payloadText: string): string {
    return `{"v":${SPARAT_VERSION},"region":${JSON.stringify(region)},"etag":${JSON.stringify(etag)},"payload":${payloadText}}`;
}

/**
 * Det som lästes från disken, om det duger för regionen just nu. null =
 * hämta från nätet: saknas, trasigt, gammalt format, fel region eller så
 * gammalt att hela horisonten passerat (då finns inget kvar att visa).
 */
export function användbartSparat(x: unknown, region: string, nuMs: number): SparatFlöde | null {
    if (!x || typeof x !== 'object') return null;
    const s = x as Partial<SparatFlöde>;
    if (s.v !== SPARAT_VERSION || s.region !== region) return null;
    if (s.etag !== null && typeof s.etag !== 'string') return null;
    if (!ärFlöde(s.payload)) return null;
    const byggd = Date.parse(s.payload.updatedAt);
    if (!Number.isFinite(byggd)) return null;
    const dagar = typeof s.payload.days === 'number' && s.payload.days > 0 ? s.payload.days : STANDARD_DAGAR;
    const horisontSlut = dagStart(new Date(byggd), 0).getTime() + dagar * DAG_MS;
    if (nuMs >= horisontSlut) return null;
    return s as SparatFlöde;
}

/**
 * Dags att fråga CDN:et? Aldrig kontrollerat, intervallet har gått eller
 * klockan har gått bakåt (då vet vi inte hur länge sedan det var).
 */
export function behöverKontroll(nuMs: number, kontrolleradMs: number | null | undefined): boolean {
    if (kontrolleradMs == null || !Number.isFinite(kontrolleradMs)) return true;
    if (nuMs < kontrolleradMs) return true;
    return nuMs - kontrolleradMs >= KONTROLL_INTERVALL_MS;
}

export type Svar = 'oförändrat' | 'nytt' | 'fel';

/**
 * CDN-svaret på en villkorlig hämtning. 304 = det sparade gäller. iOS
 * URL-cache kan också svara 200 med sin egen kopia av samma version - samma
 * ETag räknas då som oförändrat, så filen inte skrivs om i onödan.
 */
export function tolkaSvar(status: number, etag: string | null, sparat: SparatFlöde | null): Svar {
    if (status === 304) return sparat ? 'oförändrat' : 'fel';
    if (status < 200 || status >= 300) return 'fel';
    if (sparat?.etag && etag === sparat.etag) return 'oförändrat';
    return 'nytt';
}

/**
 * Paketet utan event som startade före i dag (lokal midnatt) - pipelinens
 * gräns. Event som redan varit TIDIGARE I DAG blir kvar (kartan tonar dem,
 * lib/harVarit), precis som i ett färskt paket. Samma objekt tillbaka om
 * inget föll bort, så minnade härledningar inte räknas om i onödan.
 */
export function utanPasserade(payload: AppFeedPayload, nuMs: number): AppFeedPayload {
    const idag = dagStart(new Date(nuMs), 0).getTime();
    const kvar = payload.events.filter(e => {
        const t = Date.parse(e.time);
        return Number.isFinite(t) && t >= idag;
    });
    return kvar.length === payload.events.length ? payload : { ...payload, events: kvar };
}

/**
 * Filerna som ska bort när fler än `behåll` regioner sparats: äldst skrivna
 * först (en fil utan ändringstid räknas som äldst).
 */
export function attRadera(
    filer: readonly { namn: string; ändradMs: number | null }[],
    behåll: number = SPARADE_REGIONER,
): string[] {
    if (filer.length <= behåll) return [];
    return [...filer]
        .sort((a, b) => (b.ändradMs ?? -Infinity) - (a.ändradMs ?? -Infinity))
        .slice(behåll)
        .map(f => f.namn);
}
