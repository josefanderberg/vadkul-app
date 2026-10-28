/**
 * Uppslaget bakom appens universella länkar till event (vadkul.se/e/<slug>) -
 * samma adresser som webben och notiserna sprider. /arrangor/<slug> behöver
 * inget uppslag: arrangörssidan väljer ur appflödet (lib/arrangorFlode).
 *
 * /e/<slug>: sluggen är en hash av eventets id (kontraktets eventShareSlug)
 * och går inte att vända. Webbens /api/event?slug= slår upp den (8/10 2026);
 * tills den är deployad läses id:t ur delningssidans "Öppna på kartan"-länk
 * (/?event=<id>) - samma server-uppslag, bara i HTML-form.
 */
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

