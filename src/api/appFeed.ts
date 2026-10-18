/**
 * Klienten mot appflödet: /api/events/app-<region> på vadkul.se — CDN-cachade
 * per-region-payloader som nattkedjan bygger (huvudrepots plattformsplan §3.4).
 * 503 betyder "blobben är inte byggd ännu" (första natten efter deploy) —
 * react-query får försöka igen, inte krascha.
 *
 * Paketet sparas på telefonen med sin ETag (lib/flodesCache + lib/flodesDisk,
 * 14/10 2026): en kallstart visar det sparade direkt och frågar CDN:et i
 * bakgrunden, högst en gång i timmen - 304 behåller det sparade, 200 byter ut
 * det. Utan sparat paket väntar första visningen på nätet som förut.
 */
import { useQueries, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { CITIES, type AppFeedPayload } from '@vadkul/kontrakt';
import {
    KONTROLL_INTERVALL_MS,
    behöverKontroll,
    tolkaSvar,
    utanPasserade,
    ärFlöde,
    type SparatFlöde,
} from '@/lib/flodesCache';
import { läsKontrollerad, läsSparatFlöde, sparaFlöde, sparaKontrollerad } from '@/lib/flodesDisk';

const BASE = 'https://vadkul.se/api/events';

export async function fetchAppFeed(region: string): Promise<AppFeedPayload> {
    const res = await fetch(`${BASE}/app-${region}`, {
        headers: { accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`app-flödet ${region}: HTTP ${res.status}`);
    return (await res.json()) as AppFeedPayload;
}

/**
 * Villkorlig hämtning med det sparade paketets ETag. Oförändrat = det
 * sparade paketet tillbaka (samma objekt); nytt = sparas på disken. Kastar
 * vid nätfel och felsvar.
 */
async function kontrollera(region: string, sparat: SparatFlöde | null): Promise<AppFeedPayload> {
    const res = await fetch(`${BASE}/app-${region}`, {
        headers: {
            accept: 'application/json',
            ...(sparat?.etag ? { 'if-none-match': sparat.etag } : {}),
        },
    });
    const etag = res.headers.get('etag');
    const svar = tolkaSvar(res.status, etag, sparat);
    if (svar === 'fel') throw new Error(`app-flödet ${region}: HTTP ${res.status}`);
    let payload: AppFeedPayload;
    if (svar === 'oförändrat' && sparat) {
        payload = sparat.payload;
    } else {
        const text = await res.text();
        const p: unknown = JSON.parse(text);
        if (!ärFlöde(p)) throw new Error(`app-flödet ${region}: oväntat svar`);
        sparaFlöde(region, etag, text);
        payload = p;
    }
    void sparaKontrollerad(region, Date.now());
    return payload;
}

// En kontroll i taget per region - kartan, sök och stadssidan delar flödet.
const pågående = new Map<string, Promise<AppFeedPayload>>();

function kontrolleraEnGång(region: string, sparat: SparatFlöde | null): Promise<AppFeedPayload> {
    let p = pågående.get(region);
    if (!p) {
        p = kontrollera(region, sparat).finally(() => pågående.delete(region));
        pågående.set(region, p);
    }
    return p;
}

/**
 * Flödet för regionen.
 *
 * - Första visningen (inget i react-querys cache): det sparade paketet
 *   direkt, och en kontroll i bakgrunden om timmen gått sedan förra - ett
 *   nytt paket läggs in med `nytt`. Inget sparat = vänta på nätet.
 * - Omhämtning (förgrunden efter staleTime): fråga CDN:et nu; react-query
 *   visar det gamla under tiden. Svarar inte nätet visas det sparade vidare
 *   i stället för ett fel.
 *
 * Allt som lämnar funktionen går genom utanPasserade - ett paket från en
 * tidigare dag visar aldrig gårdagens event som kommande.
 */
async function hämtaFlöde(
    region: string,
    nuvarande: AppFeedPayload | undefined,
    nytt: (p: AppFeedPayload) => void,
): Promise<AppFeedPayload> {
    const nu = Date.now();
    const sparat = await läsSparatFlöde(region, nu);
    if (nuvarande) {
        try {
            return utanPasserade(await kontrolleraEnGång(region, sparat), Date.now());
        } catch {
            return utanPasserade(sparat?.payload ?? nuvarande, Date.now());
        }
    }
    if (!sparat) return utanPasserade(await kontrolleraEnGång(region, null), Date.now());
    if (behöverKontroll(nu, await läsKontrollerad(region))) {
        kontrolleraEnGång(region, sparat).then(
            p => { if (p !== sparat.payload) nytt(utanPasserade(p, Date.now())); },
            () => { /* offline o.d. - det sparade gäller, nästa förgrund försöker igen */ },
        );
    }
    return utanPasserade(sparat.payload, nu);
}

/** Alla län i stadslistan - flödets regioner (samma härledning som routen). */
export const REGIONER: readonly string[] = [...new Set(CITIES.map(c => c.region))];

function flödesQuery(qc: QueryClient, region: string) {
    return {
        queryKey: ['app-feed', region],
        queryFn: () => hämtaFlöde(
            region,
            qc.getQueryData<AppFeedPayload>(['app-feed', region]),
            p => qc.setQueryData(['app-feed', region], p),
        ),
        staleTime: KONTROLL_INTERVALL_MS,
        retry: 2,
    };
}

/**
 * Flödet för en region. staleTime = kontrollintervallet: förgrunden efter
 * en timme kör hämtaFlöde igen, som frågar CDN:et (304 när inget ändrats).
 */
export function useAppFeed(region: string) {
    const qc = useQueryClient();
    return useQuery(flödesQuery(qc, region));
}

// Modulnivå = stabil referens: react-query kör då combine bara när någon
// query faktiskt ändrats, och med FAST position per län (undefined tills det
// landat) blir replaceEqualDeep en referensjämförelse per plats - inte en
// djupjämförelse av två olika läns tusentals event.
const bara = (resultat: { data?: AppFeedPayload }[]) => resultat.map(r => r.data);

/**
 * Flera regioners flöden på en gång (hela Sverige på kartan, 19/10) - samma
 * query-nycklar, diskcache och ETag-kontroll som useAppFeed, så ett län som
 * redan hämtats delas. `enabled` false = vänta (det egna länet först).
 * En plats per region i samma ordning; undefined = inte landat än. Arrayen
 * behåller sin referens så länge inget län ändrats.
 */
export function useAppFeeds(regioner: readonly string[], enabled: boolean): (AppFeedPayload | undefined)[] {
    const qc = useQueryClient();
    return useQueries({
        queries: regioner.map(region => ({ ...flödesQuery(qc, region), enabled })),
        combine: bara,
    });
}
