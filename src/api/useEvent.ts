/**
 * ALLA event en skärm ska visa: CDN-flödena (api/appFeed) + de
 * användarskapade eventen ur Firestore (data/anvandarEvent, ägarbeslut 8/10
 * 2026). Webben gör samma sammanslagning i linkEventService. Kartan, sök och
 * stadssidan läser härifrån så de aldrig visar olika underlag.
 *
 * HELA SVERIGE (Josef 19/10: "varför ser man inte alla event markörer på
 * kartan? ... man kan aldrig se hela sverige typ"): förr bara det egna
 * länets flöde, så kartan var tom utanför länet. Nu det egna länet FÖRST
 * (det är det första bildrutan visar), och när det landat de övriga 20 i
 * bakgrunden - ~1,3 MB brotli första gången, sedan diskcache + ETag-
 * kontroll högst en gång i timmen per län (lib/flodesCache). Kartan visar
 * bara ~50 som brickor och resten som prickar (lib/kartUrval).
 *
 * De användarskapade pollas som på webben (lib/anvandarEventPoll): en count()
 * var 30:e sekund medan appen är aktiv (react-querys focusManager kopplas mot
 * AppState i rotlayouten), hela listan bara när antalet ändrats eller
 * säkerhetsnätet löpt ut.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { REGIONER, useAppFeed, useAppFeeds } from './appFeed';
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

/** Hela landets flöden (det egna länet först) + de användarskapade, i ett.
 *  `data` är undefined tills det EGNA länet landat - övriga län fylls på
 *  efter hand. Laddningsläget (isPending/isError …) är det egna länets. */
export function useEvent(region: string) {
    const feed = useAppFeed(region);
    const övriga = useMemo(() => REGIONER.filter(r => r !== region), [region]);
    const andra = useAppFeeds(övriga, !!feed.data);
    const anv = useAnvändarEvent();
    const data = useMemo<AppEvent[] | undefined>(() => {
        if (!feed.data) return undefined;
        // Ett event hör till exakt ett län (närmaste stadens), så flödena
        // överlappar inte - en ren konkatenering räcker.
        const delar: (readonly AppEvent[])[] = [feed.data.events];
        for (const p of andra) if (p) delar.push(p.events);
        if (anv.data?.length) delar.push(anv.data);
        return delar.length === 1 ? feed.data.events : delar.flat();
    }, [feed.data, andra, anv.data]);
    // Horisonten (flödets `days`) styr hur långt dagväljaren når. Alla län
    // byggs i samma nattkörning, så det egna länets värde gäller alla.
    return { ...feed, data, användarEvent: anv.data ?? [], horisontDagar: feed.data?.days };
}

/** Ett användarskapat event ur den delade listan (djuplänkar, Mina event). */
export function hittaAnvändarEvent(id: string): AppEvent | null {
    return senaste?.events.find(e => e.id === id || e.docId === id) ?? null;
}

/**
 * Glöm den senaste hämtningen så nästa poll hämtar ALLT - anropas efter egna
 * skrivningar (skapa/redigera/ta bort). Redigeringar ändrar inte antalet, så
 * utan den hade ändringen varit osynlig tills säkerhetsnätet löpt ut.
 * Invalidera queryn ['anvandar-event'] direkt efteråt så kartan uppdateras nu.
 */
export function glömAnvändarEvent(): void {
    senaste = null;
}
