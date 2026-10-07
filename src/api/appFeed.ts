/**
 * Klienten mot appflödet: /api/events/app-<region> på vadkul.se — CDN-cachade
 * per-region-payloader som nattkedjan bygger (huvudrepots plattformsplan §3.4).
 * 503 betyder "blobben är inte byggd ännu" (första natten efter deploy) —
 * react-query får försöka igen, inte krascha.
 */
import { useQuery } from '@tanstack/react-query';
import type { AppFeedPayload } from '@vadkul/kontrakt';

const BASE = 'https://vadkul.se/api/events';

export async function fetchAppFeed(region: string): Promise<AppFeedPayload> {
    const res = await fetch(`${BASE}/app-${region}`, {
        headers: { accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`app-flödet ${region}: HTTP ${res.status}`);
    return (await res.json()) as AppFeedPayload;
}

/** Flödet för en region. CDN:et cachar en timme — samma staleTime här. */
export function useAppFeed(region: string) {
    return useQuery({
        queryKey: ['app-feed', region],
        queryFn: () => fetchAppFeed(region),
        staleTime: 60 * 60 * 1000,
        retry: 2,
        // Stadssidan med okänd slug har ingen region - fråga inte efter "app-".
        enabled: region !== '',
    });
}
