/**
 * Stadssidans rena logik - appens motsvarighet till webbens
 * /evenemang/<stad>. Utbudet mäts I ORTEN (<= 10 km, ägarbeslutet från
 * stadssidornas utbud 7/9 - inte länets 35 km), och listan grupperas per
 * dag med samma etiketter som väljaren (Idag/Imorgon/veckodag).
 *
 * Intro-raden, sökningen, arrangörerna och grannstäderna är portar av
 * webbens app/(v1)/evenemang/cityData.ts (topVenues, svList),
 * DayFilteredList (qMatch), utils/organizerPages (topOrganizers) och
 * [stad]/page.tsx (otherCities) - ändras webben ska kopian följa.
 */
import { CITIES, organizerPageSlug, type AppFeedEvent, type City } from '@vadkul/kontrakt';
import type { AppEvent } from './appEvent';
import { eventIPeriod, periodLabel } from './dagar';
import { klassaKälla } from './kartFilter';
import { distanceKm } from './regionVal';

/** Eventen i orten: inom `maxKm` från stadens centrum. */
export function stadensEvent<T extends AppFeedEvent>(events: readonly T[], city: City, maxKm = 10): T[] {
    return events.filter(e => distanceKm(city.lat, city.lng, e.lat, e.lng) <= maxKm);
}

export interface DagSektion {
    key: string;
    label: string;
    data: AppFeedEvent[];
}

/** Dagsgrupperade sektioner (tomma dagar hoppas över), event i tidsordning. */
export function grupperaPerDag(events: AppFeedEvent[], nu: Date = new Date(), dagar = 14): DagSektion[] {
    const sektioner: DagSektion[] = [];
    for (let offset = 0; offset < dagar; offset++) {
        const dagens = events
            .filter(e => eventIPeriod(e.time, offset, 1, nu))
            .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
        if (dagens.length > 0) {
            sektioner.push({ key: `dag-${offset}`, label: periodLabel(offset, 1, nu), data: dagens });
        }
    }
    return sektioner;
}

/**
 * Eventen utan de stora opt-in-källorna (Svenska kyrkan/PRO/Korpen) - det
 * webbens siffror räknar på: källorna ligger utanför stadssidornas HTML,
 * intro-siffror och topplista (SEO-beslutet 1/9) och nås bara via Fler.
 */
export function utanStoraKällor<T extends Pick<AppFeedEvent, 'id' | 'url'>>(events: readonly T[]): T[] {
    return events.filter(e => klassaKälla(e) === null);
}

/**
 * Platserna med flest event (webbens topVenues): korta/tomma namn och
 * kladdiga kompositsträngar (komma, över 40 tecken) hoppas över, liksom
 * stadens eget namn ("Mest händer på … Växjö" säger inget). Minst 2 event
 * för att räknas som en vanlig plats.
 */
export function topPlatser(events: readonly Pick<AppFeedEvent, 'locationName'>[], stadsnamn: string, n = 4): string[] {
    const antal = new Map<string, number>();
    const stad = stadsnamn.toLowerCase();
    for (const e of events) {
        const namn = e.locationName?.replace(/\s+/g, ' ').trim();
        if (!namn || namn.length < 3 || namn.length > 40 || namn.includes(',')) continue;
        if (namn.toLowerCase() === stad) continue;
        antal.set(namn, (antal.get(namn) ?? 0) + 1);
    }
    return [...antal.entries()]
        .filter(([, c]) => c >= 2)
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .map(([namn]) => namn);
}

/** "A, B och C" (webbens svList). */
export function svLista(xs: readonly string[]): string {
    if (xs.length <= 1) return xs.join('');
    return `${xs.slice(0, -1).join(', ')} och ${xs[xs.length - 1]}`;
}

/**
 * Intro-raden under heron (webbens "Just nu ligger N kommande evenemang …
 * - T idag och W i veckan … Mest händer på …"). Appflödet är 14 dagar och
 * mäts i orten, så meningen säger det i stället för "med omnejd".
 */
export function stadsIntro(p: { stad: string; antal: number; idag: number; veckan: number; platser: readonly string[] }): string {
    const siffror = p.idag > 0 || p.veckan > 0 ? ` - ${p.idag} idag och ${p.veckan} i veckan` : '';
    const platser = p.platser.length >= 2 ? ` Mest händer på ${svLista(p.platser)}.` : '';
    return `${p.antal} kommande event i ${p.stad} de närmaste 14 dagarna${siffror}.${platser}`;
}

/**
 * Sökfältet: titel eller plats innehåller termen (webbens qMatch i
 * DayFilteredList). `q` ska vara normaliserad (lib/sok.normalizeSearchQuery);
 * tom term matchar allt.
 */
export function matcharStadsSök(e: Pick<AppFeedEvent, 'title' | 'locationName'>, q: string): boolean {
    if (!q) return true;
    return e.title.toLowerCase().includes(q) || (e.locationName ?? '').toLowerCase().includes(q);
}

export interface ArrangörChip { slug: string; namn: string; antal: number }

/**
 * "Arrangörer i X" (webbens topOrganizers med ORGANIZER_CITY_CHIP_MIN = 3,
 * max 12): arrangörer MED arrangörssida (kontraktets organizerPageSlug - samma
 * regel som webben och pipelinen), minst `min` event, flest först. Namnet är
 * den vanligaste stavningen. Användarskapade event hör aldrig till en sida.
 */
export function toppArrangörer(events: readonly AppEvent[], min = 3, n = 12): ArrangörChip[] {
    const acc = new Map<string, { antal: number; namn: Map<string, number> }>();
    for (const e of events) {
        if (e.userCreated || !e.hostName) continue;
        const slug = organizerPageSlug(e.hostName, e.id);
        if (!slug) continue;
        let a = acc.get(slug);
        if (!a) { a = { antal: 0, namn: new Map() }; acc.set(slug, a); }
        a.antal++;
        const namn = e.hostName.replace(/\s+/g, ' ').trim();
        a.namn.set(namn, (a.namn.get(namn) ?? 0) + 1);
    }
    return [...acc.entries()]
        .filter(([, a]) => a.antal >= min)
        .map(([slug, a]) => ({
            slug,
            antal: a.antal,
            namn: [...a.namn.entries()].sort((x, y) => y[1] - x[1] || svJämför(x[0], y[0]))[0][0],
        }))
        .sort((a, b) => b.antal - a.antal || svJämför(a.namn, b.namn))
        .slice(0, n);
}

/**
 * "Evenemang i fler städer": de `n` närmaste, inte alla (webbens
 * otherCities - närhetsurvalet är det enda som är relevant för läsaren).
 */
export function närmasteStäder(stad: Pick<City, 'slug' | 'lat' | 'lng'>, n = 12): City[] {
    return CITIES
        .filter(c => c.slug !== stad.slug)
        .map(c => ({ c, d: distanceKm(stad.lat, stad.lng, c.lat, c.lng) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, n)
        .map(x => x.c);
}

/**
 * Svensk bokstavsordning utan Intl (Hermes Intl skiljer mellan
 * plattformarna): å, ä, ö efter z, accenter som grundbokstaven.
 */
export function svJämför(a: string, b: string): number {
    const nyckel = (s: string) => s.toLowerCase()
        .replace(/[éèêë]/g, 'e').replace(/[áàâ]/g, 'a').replace(/ü/g, 'u')
        .replace(/å/g, '{').replace(/[äæ]/g, '|').replace(/[öø]/g, '}');
    const x = nyckel(a);
    const y = nyckel(b);
    return x < y ? -1 : x > y ? 1 : 0;
}
