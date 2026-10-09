/**
 * Uppslagen bakom appens universella länkar (vadkul.se/e/<slug>,
 * /arrangor/<slug>) - samma adresser som webben och notiserna sprider.
 *
 * /e/<slug>: sluggen är en hash av eventets id (kontraktets eventShareSlug)
 * och går inte att vända. Webbens /api/event?slug= slår upp den (8/10 2026);
 * tills den är deployad läses id:t ur delningssidans "Öppna på kartan"-länk
 * (/?event=<id>) - samma server-uppslag, bara i HTML-form.
 */
import { useQuery } from '@tanstack/react-query';
import type { AppFeedEvent } from '@vadkul/kontrakt';
import { idUrDelningssida } from '@/lib/lankar';

const BAS = 'https://vadkul.se';

/** Eventets id för en delningsslug, eller null om eventet inte finns kvar. */
export async function slåUppSlug(slug: string): Promise<string | null> {
    const res = await fetch(`${BAS}/api/event?slug=${encodeURIComponent(slug)}`, { headers: { accept: 'application/json' } });
    if (res.ok) {
        const json = (await res.json()) as { event?: { id?: unknown } };
        return typeof json.event?.id === 'string' ? json.event.id : null;
    }
    if (res.status === 404) return null;
    // 400 = webben känner inte ?slug= än - läs delningssidan i stället.
    const sida = await fetch(`${BAS}/e/${encodeURIComponent(slug)}`, { headers: { accept: 'text/html' } });
    if (!sida.ok) return null;
    return idUrDelningssida(await sida.text());
}

export interface Arrangör {
    slug: string;
    name: string;
    domains: string[];
    cities: { slug: string; name: string }[];
    events: AppFeedEvent[];
}

/** Arrangörssidans data (webbens /api/arrangor, samma urval som sidan). */
export async function hämtaArrangör(slug: string): Promise<Arrangör | null> {
    const res = await fetch(`${BAS}/api/arrangor?slug=${encodeURIComponent(slug)}`, { headers: { accept: 'application/json' } });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`api/arrangor: HTTP ${res.status}`);
    return (await res.json()) as Arrangör;
}

export function useArrangör(slug: string) {
    return useQuery({
        queryKey: ['arrangor', slug],
        queryFn: () => hämtaArrangör(slug),
        staleTime: 60 * 60 * 1000,
        retry: 1,
    });
}
