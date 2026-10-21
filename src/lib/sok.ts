/**
 * Eventsöket i appen. SJÄLVA SÖKET bor sedan 21/10 i @vadkul/kontrakt
 * (huvudrepots packages/kontrakt/src/search.ts + cityPoints.ts, hit via
 * `npm run kontrakt:sync`) - webben kör exakt samma kod (Josef 21/10: "nu är
 * de ju inte synkade riktigt webb och app"). Förut var det här en handport
 * av webbens utils/eventSearch som hade glidit isär.
 *
 * Kontraktets två lägen (se search.ts):
 *  - FILTERLISTA (inget fritt sökord - bara chips, kategoriord och/eller en
 *    ort): dag för dag från kartans dag, närmast först (`närmastPerDag`).
 *    Kategoriorden ersätter chipsen och 🔥 för sökningen.
 *  - FRITT SÖK: rankat (`sokEvent`) - titel → plats/arrangör → kategori,
 *    NÄROMRÅDET först inom varje nivå (ägarbeslut 21/10 "närområdet
 *    prioriterat"). Orten i texten tolkas med kontraktets 291 orter.
 *
 * Här bor bara det appspecifika: stadsraden (`searchCities`/`findCity` ger
 * kontraktets CITIES-städer, som regionvalet kan landa i) och
 * dagsektionerna (lib/dagar).
 */
import {
    CITIES,
    SAME_DISTANCE_KM,
    searchEvents,
    sortNearestFirst,
    type AppFeedEvent,
    type City,
    type LatLng,
} from '@vadkul/kontrakt';
import { dagSektioner, type DagSektion } from './dagar';
import { dagOffset } from './vy';

export {
    CATEGORY_SEARCH_WORDS,
    CITY_SEARCH_RADIUS_KM,
    SEARCH_TIER,
    categoryForWord,
    eventSearchTier,
    highlightSegments,
    isFilterQuery,
    normalizeSearchQuery,
    parseCategoryQuery,
    splitCityFromQuery,
    withinCitySearch,
    type HighlightSegment,
} from '@vadkul/kontrakt';

/** Söknyckel för ortnamn: å/ä → a, ö → o, diakriter bort (kontraktets
 *  cityPoints searchKey). */
export const ortNyckel = (s: string) =>
    s.toLowerCase()
        .replace(/[åä]/g, 'a')
        .replace(/ö/g, 'o')
        .replace(/[éè]/g, 'e')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');

const ORT_INDEX = CITIES.map((city, order) => ({ city, order, key: ortNyckel(city.name) }));

/** Stadslistans stad med exakt det namnet - "kar" ger null, aldrig
 *  Karlstad. Sökets ort ("jazz i alvesta") kan vara en av kontraktets 291
 *  orter som inte är en stad; då null. */
export function findCity(name: string): City | null {
    const key = ortNyckel(name);
    if (!key) return null;
    return ORT_INDEX.find(o => o.key === key)?.city ?? null;
}

/** Stadsraden: städer som matchar söktexten - exakt → börjar på →
 *  innehåller, sen listans ordning (största först). Minst två tecken. */
export function searchCities(query: string, limit = 4): City[] {
    const q = ortNyckel(query);
    if (q.length < 2) return [];
    const hits: { city: City; rank: number; order: number }[] = [];
    for (const o of ORT_INDEX) {
        const rank = o.key === q ? 0 : o.key.startsWith(q) ? 1 : o.key.includes(q) ? 2 : -1;
        if (rank >= 0) hits.push({ city: o.city, rank, order: o.order });
    }
    hits.sort((a, b) => a.rank - b.rank || a.order - b.order);
    return hits.slice(0, limit).map(h => h.city);
}

/**
 * Fria sökets träffar, bäst först (kontraktets searchEvents): en ort i
 * texten begränsar till ortcirkeln och är då närområdet, annars `nära`
 * (ens position, annars kartans stad). Flödets id ÄR källänken, så
 * länksöket ("tickster") fungerar utan url-fältet. Tom fråga = tom lista.
 */
export function sokEvent(
    events: readonly AppFeedEvent[],
    fråga: string,
    max = 50,
    nära: LatLng | null = null,
): AppFeedEvent[] {
    return searchEvents(events, fråga, nära).slice(0, max);
}

/**
 * Filterlistan (inget fritt sökord - bara chips, kategoriord och/eller ort):
 * sticky dagsektioner från `frånDag` (kartans dag, 0 = idag) och framåt, och
 * inom varje dag det NÄRMASTE `från` först (kontraktets sortNearestFirst:
 * inom SAME_DISTANCE_KM gäller klockslaget). Dagarna före kartans dag är
 * borta, som på kartan.
 */
export const LIKA_NÄRA_KM = SAME_DISTANCE_KM;

export function närmastPerDag<T extends { time: string; lat: number; lng: number }>(
    events: readonly T[],
    från: LatLng,
    frånDag: number,
    nu: Date = new Date(),
): DagSektion<T>[] {
    // Pågående event som startade före idag hör till Idag (som dagSektioner).
    const kvar = events.filter(e => Math.max(0, dagOffset(e.time, nu)) >= frånDag);
    return dagSektioner(kvar, nu).map(s => ({ ...s, data: sortNearestFirst(s.data, från) }));
}
