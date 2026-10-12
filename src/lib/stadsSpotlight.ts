/**
 * "Skapade på VADKUL" överst på stadssidan - port av webbens
 * utils/citySpotlight.ts (composeSpotlightRows + groupSpotEvents +
 * spotSpanTag/spotRangeWhen). Exponeringstrappans nivå 2: event skapade
 * eller tipsade på VADKUL lyfts ovanför den externa dag-för-dag-listan.
 *
 * Underlaget är de användarskapade eventen appen REDAN har (api/useEvent -
 * samma userCreated-poll som kartan), inga nya Firestore-läsningar.
 *
 * APP-AVVIKELSER (medvetna):
 *  - Ingen boost-nivå (guldraderna). Appen säljer och visar ingen boost
 *    (CLAUDE.md, lib/kartFilter) - eventBoosts läses aldrig.
 *  - "Har varit" är appens delade isEventPast (lib/harVarit, NO_TIME_PAST_HOUR)
 *    i stället för webbens "startat för mer än en timme sedan" - samma regel
 *    som alla andra ytor i appen.
 *  - Tiderna i appens format (lib/eventTid: "Idag · 19:00"), inte Intl.
 */
import type { AppEvent } from './appEvent';
import { normaliseraDagar, seriensRytmKort } from './anvandarEvent';
import { MANADER, VECKODAGAR, formatEventTid } from './eventTid';
import { isEventPast } from './harVarit';
import { distanceKm } from './regionVal';
import { dagOffset } from './vy';

/** Max rader (webbens SPOTLIGHT_MAX_VADKUL). */
export const SPOTLIGHT_MAX = 4;

export interface SpotRad {
    /** Radens event - första dagen/nästa tillfälle. Trycket öppnar DET på kartan. */
    e: AppEvent;
    /** Flera dagar i rad slagna till en rad: antal dagar och sista dagens event. */
    dagar?: number;
    sista?: AppEvent;
    /** Veckoseriens rytm ("Varje vecka") - en veckoserie är EN rad. */
    rytm?: string;
    /** Dokumenten raden står för - daglistan hoppar över dem (ingen dubblett). */
    docIds: string[];
}

const docIdFör = (e: AppEvent) => e.docId ?? e.id;

/** "Samma event igen": titel + plats (platsnamnet, annars koordinaten) - webbens spotRepeatKey. */
function upprepNyckel(e: AppEvent): string {
    const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, ' ');
    const plats = e.locationName ? norm(e.locationName) : '';
    return `${norm(e.title)}@@${plats || `${(e.lat ?? 0).toFixed(3)},${(e.lng ?? 0).toFixed(3)}`}`;
}

const tid = (e: AppEvent) => new Date(e.time).getTime();

/** Veckoseriens rytmchip - bara veckoserier, dagsserier grupperas som "N dagar". */
function veckorytm(e: AppEvent): string | undefined {
    return e.repeatWeekly && normaliseraDagar(e.repeatDays) === null ? seriensRytmKort(e) : undefined;
}

/**
 * EN rad per sak, inte en per dag eller tillfälle (webbens groupSpotEvents,
 * Josef 22/9: konstrundan lör + sön ska vara EN rad, "2 dagar").
 *  1. VECKOSERIER: nästa tillfälle står för serien.
 *  2. DAGAR I RAD: samma titel på samma plats utan lucka mellan
 *     kalenderdagarna - både dagsserier och sådant som lagts in en gång per dag.
 * Två tillfällen SAMMA dag är två rader. `events` ska vara tidssorterade.
 */
export function grupperaSpotEvent(events: readonly AppEvent[], nu: Date = new Date()): SpotRad[] {
    const ut: SpotRad[] = [];
    const veckoSedda = new Set<string>();
    const perNyckel = new Map<string, AppEvent[]>();
    for (const e of events) {
        const rytm = veckorytm(e);
        if (rytm) {
            const doc = docIdFör(e);
            if (veckoSedda.has(doc)) continue;
            veckoSedda.add(doc);
            ut.push({ e, rytm, docIds: [doc] });
            continue;
        }
        const k = upprepNyckel(e);
        const g = perNyckel.get(k);
        if (g) g.push(e);
        else perNyckel.set(k, [e]);
    }

    for (const grupp of perNyckel.values()) {
        let kedja: AppEvent[] = [];
        const töm = () => {
            if (kedja.length === 0) return;
            const docIds = [...new Set(kedja.map(docIdFör))];
            ut.push(kedja.length > 1
                ? { e: kedja[0], dagar: kedja.length, sista: kedja[kedja.length - 1], docIds }
                : { e: kedja[0], docIds });
            kedja = [];
        };
        for (const e of grupp) {
            const förra = kedja[kedja.length - 1];
            const diff = förra ? dagOffset(e.time, nu) - dagOffset(förra.time, nu) : null;
            if (diff === 1) kedja.push(e);
            else if (diff === 0) ut.push({ e, docIds: [docIdFör(e)] });
            else { töm(); kedja = [e]; }
        }
        töm();
    }
    return ut.sort((a, b) => tid(a.e) - tid(b.e));
}

/**
 * Spotlightens rader (webbens composeSpotlightRows utan boost-nivån):
 * användarskapade event inom `radieKm` från stadens mitt som inte varit,
 * EN rad per sak, BILD FÖRST och sedan tid (Josef 22/9: "precis som i
 * listan"), max SPOTLIGHT_MAX. Sorteringen sker FÖRE taket så eventen med
 * bild får platserna först.
 */
export function spotlightRader(
    användarEvent: readonly AppEvent[],
    mitt: { lat: number; lng: number },
    radieKm: number,
    nu: Date = new Date(),
): SpotRad[] {
    const nuMs = nu.getTime();
    const färska = användarEvent
        .filter(e => e.userCreated
            && Number.isFinite(e.lat) && Number.isFinite(e.lng) && !(e.lat === 0 && e.lng === 0)
            && distanceKm(e.lat, e.lng, mitt.lat, mitt.lng) <= radieKm
            && Number.isFinite(tid(e))
            && !isEventPast(e, nuMs))
        .sort((a, b) => tid(a) - tid(b));
    return grupperaSpotEvent(färska, nu)
        .sort((a, b) => (a.e.img ? 0 : 1) - (b.e.img ? 0 : 1) || tid(a.e) - tid(b.e))
        .slice(0, SPOTLIGHT_MAX);
}

/** Alla dokument spotlighten visar - daglistan hoppar över deras tillfällen. */
export function spotlightDokument(rader: readonly SpotRad[]): Set<string> {
    return new Set(rader.flatMap(r => r.docIds));
}

/** Radens chip för en sammanslagen rad: "2 dagar" / "Varje vecka" (webbens spotSpanTag). */
export function spotSpann(r: Pick<SpotRad, 'dagar' | 'rytm'>): string | null {
    if (r.dagar && r.dagar > 1) return `${r.dagar} dagar`;
    return r.rytm ?? null;
}

const kortDag = (d: Date, medMånad: boolean) =>
    `${VECKODAGAR[d.getDay()]} ${d.getDate()}${medMånad ? ` ${MANADER[d.getMonth()]}` : ''}`;
const klocka = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/**
 * Radens tid. En rad: appens vanliga tidsrad ("Idag · 19:00"). Flera dagar
 * i rad (webbens spotRangeWhen): "lör 10-sön 11 okt · 11:00",
 * "Idag-imorgon · 18:00", "fre 30 okt-sön 1 nov" - klockslaget är första dagens.
 */
export function spotTid(r: Pick<SpotRad, 'e' | 'dagar' | 'sista'>, nu: Date = new Date()): string {
    if (!r.dagar || r.dagar < 2 || !r.sista) return formatEventTid(r.e.time, r.e.hasSpecificTime !== false, nu);
    const a = new Date(r.e.time);
    const b = new Date(r.sista.time);
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return formatEventTid(r.e.time, r.e.hasSpecificTime !== false, nu);
    const oa = dagOffset(a, nu);
    const ob = dagOffset(b, nu);
    const sammaMånad = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
    const från = oa === 0 ? 'Idag' : oa === 1 ? 'Imorgon' : kortDag(a, !sammaMånad);
    const till = ob === 1 ? 'imorgon' : kortDag(b, true);
    return r.e.hasSpecificTime === false ? `${från}-${till}` : `${från}-${till} · ${klocka(a)}`;
}
