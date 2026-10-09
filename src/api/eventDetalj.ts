/**
 * Detaljhämtningen bakom eventkortet: webbens /api/event?id= svarar med det
 * enskilda eventets kortfält (~1 kB, CDN-cachat) - samma endpoint som webbens
 * djuplänkar använder. 404 = eventet har hunnit försvinna ur aggregaten;
 * kortet visar då flödesfälten utan beskrivning i stället för att krascha.
 */
import { useQuery } from '@tanstack/react-query';
import type { AppFeedEvent } from '@vadkul/kontrakt';
import type { EventDetalj } from '@/lib/eventDetalj';

const BASE = 'https://vadkul.se/api/event';

export async function fetchEventDetalj(id: string): Promise<EventDetalj> {
    const res = await fetch(`${BASE}?id=${encodeURIComponent(id)}`, {
        headers: { accept: 'application/json' },
    });
    if (res.status === 404) return {};
    if (!res.ok) throw new Error(`api/event: HTTP ${res.status}`);
    const json = (await res.json()) as { event?: EventDetalj };
    return json.event ?? {};
}

/** Detaljerna för ett öppnat kort. CDN:et cachar; samma staleTime här.
 *  id null = hoppa över (användarskapade event bär redan sina detaljer). */
export function useEventDetalj(id: string | null) {
    return useQuery({
        queryKey: ['event-detalj', id],
        queryFn: () => fetchEventDetalj(id!),
        enabled: !!id,
        staleTime: 60 * 60 * 1000,
        retry: 1,
    });
}

/**
 * Hela eventet i flödets form - för event som inte finns i det laddade
 * flödet: sparade på en annan enhet, djuplänkar och vänners svar. Samma
 * endpoint, som svarar med webbens DeepLinkEvent. null = finns inte (längre).
 */
export async function fetchEventSomFlöde(id: string): Promise<AppFeedEvent | null> {
    const res = await fetch(`${BASE}?id=${encodeURIComponent(id)}`, { headers: { accept: 'application/json' } });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`api/event: HTTP ${res.status}`);
    const e = ((await res.json()) as { event?: Record<string, unknown> }).event;
    if (!e || typeof e.title !== 'string' || typeof e.time !== 'string') return null;
    if (typeof e.lat !== 'number' || typeof e.lng !== 'number') return null;
    return {
        id,
        title: e.title,
        time: e.time,
        ...(typeof e.endDate === 'string' ? { endDate: e.endDate } : {}),
        hasSpecificTime: e.hasSpecificTime !== false,
        lat: e.lat,
        lng: e.lng,
        ...(typeof e.locationName === 'string' && e.locationName ? { locationName: e.locationName } : {}),
        category: typeof e.category === 'string' ? e.category : 'other',
        ...(typeof e.coverImage === 'string' && e.coverImage ? { img: e.coverImage } : {}),
        ...(typeof e.url === 'string' && e.url ? { url: e.url } : {}),
    };
}
