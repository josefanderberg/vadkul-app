/**
 * Stadstopplistans siffror (lib/stadsTopplista) ur länsflödena - webben
 * bakar dem vid build, appen har bara /api/events/app-<region>. Hämtas
 * BARA när Städer är öppen: alla 22 län (~1,5 MB brotli via CDN:et, som
 * kartans eget flöde), och varje flöde räknas ner till antal per stad och
 * dag direkt - de fulla eventlistorna hålls inte kvar i cachen. Ett län
 * kartan redan har i cachen återanvänds utan ny hämtning.
 *
 * Eventflödet läses aldrig ur Firestore (CLAUDE.md) - bara CDN-flödet.
 */
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { CITIES, type AppFeedPayload } from '@vadkul/kontrakt';
import { räknaStäderPerDag, type DagAntal } from '@/lib/stadsTopplista';
import { fetchAppFeed } from './appFeed';

const REGIONER = [...new Set(CITIES.map(c => c.region))];

/** Antal per stad och dagoffset; städer vars län inte landat än saknas. */
export function useStadsAntal(): { antal: Record<string, DagAntal>; laddar: boolean } {
    const qc = useQueryClient();
    return useQueries({
        queries: REGIONER.map(region => ({
            queryKey: ['stad-antal', region],
            queryFn: async () => {
                const feed = qc.getQueryData<AppFeedPayload>(['app-feed', region]) ?? await fetchAppFeed(region);
                return räknaStäderPerDag(feed.events, CITIES.filter(c => c.region === region));
            },
            // Samma timme som CDN:et och kartans flöde.
            staleTime: 60 * 60 * 1000,
            retry: 1,
        })),
        combine: resultat => ({
            antal: Object.assign({}, ...resultat.map(r => r.data ?? {})) as Record<string, DagAntal>,
            laddar: resultat.some(r => r.isPending),
        }),
    });
}
