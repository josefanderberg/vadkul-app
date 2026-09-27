/**
 * Detaljhämtningen bakom eventkortet: webbens /api/event?id= svarar med det
 * enskilda eventets kortfält (~1 kB, CDN-cachat) - samma endpoint som webbens
 * djuplänkar använder. 404 = eventet har hunnit försvinna ur aggregaten;
 * kortet visar då flödesfälten utan beskrivning i stället för att krascha.
 */
import { useQuery } from '@tanstack/react-query';
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

/** Detaljerna för ett öppnat kort. CDN:et cachar; samma staleTime här. */
export function useEventDetalj(id: string) {
    return useQuery({
        queryKey: ['event-detalj', id],
        queryFn: () => fetchEventDetalj(id),
        staleTime: 60 * 60 * 1000,
        retry: 1,
    });
}
