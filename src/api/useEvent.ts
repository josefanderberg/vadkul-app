/**
 * ALLA event en skärm ska visa: regionens CDN-flöde (api/appFeed) + de
 * användarskapade eventen ur Firestore (data/anvandarEvent, ägarbeslut 8/10
 * 2026). Webben gör samma sammanslagning i linkEventService. Kartan, sök och
 * stadssidan läser härifrån så de aldrig visar olika underlag.
 *
 * De användarskapade pollas som på webben (lib/anvandarEventPoll): en count()
 * var 30:e sekund medan appen är aktiv (react-querys focusManager kopplas mot
 * AppState i rotlayouten), hela listan bara när antalet ändrats eller
 * säkerhetsnätet löpt ut.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAppFeed } from './appFeed';
import type { AppEvent } from '@/lib/appEvent';
import { avgörAnvändarEventPoll, POLL_INTERVALL_MS } from '@/lib/anvandarEventPoll';
import { hämtaAnvändarEvent, räknaAnvändarEvent } from '@/data/anvandarEvent';

// Senaste fulla hämtningen - delas av alla skärmar (en lista för hela appen).
let senaste: { events: AppEvent[]; total: number; hämtadMs: number } | null = null;

async function pollaAnvändarEvent(): Promise<AppEvent[]> {
    const probat = senaste ? await räknaAnvändarEvent() : null;
    const beslut = avgörAnvändarEventPoll({
        nuMs: Date.now(),
        senasteHämtningMs: senaste?.hämtadMs ?? null,
        senasteAntal: senaste?.total ?? null,
        probatAntal: probat,
    });
    if (beslut === 'hämta') {
        const r = await hämtaAnvändarEvent();
        // total null = hämtningen gick inte fram: behåll det vi redan visar.
        if (r.total !== null) senaste = { events: r.events, total: r.total, hämtadMs: Date.now() };
    }
    return senaste?.events ?? [];
}

/** De användarskapade eventen (hela landet - de är få). */
export function useAnvändarEvent() {
    return useQuery({
        queryKey: ['anvandar-event'],
        queryFn: pollaAnvändarEvent,
        refetchInterval: POLL_INTERVALL_MS,
        refetchIntervalInBackground: false,
        staleTime: 0,
        retry: 1,
    });
}

/** Regionens flöde + de användarskapade, i ett. */
export function useEvent(region: string) {
    const feed = useAppFeed(region);
    const anv = useAnvändarEvent();
    const data = useMemo<AppEvent[] | undefined>(() => {
        if (!feed.data) return undefined;
        return anv.data?.length ? [...feed.data.events, ...anv.data] : feed.data.events;
    }, [feed.data, anv.data]);
    return { ...feed, data, användarEvent: anv.data ?? [] };
}

/** Ett användarskapat event ur den delade listan (djuplänkar, Mina event). */
export function hittaAnvändarEvent(id: string): AppEvent | null {
    return senaste?.events.find(e => e.id === id || e.docId === id) ?? null;
}
