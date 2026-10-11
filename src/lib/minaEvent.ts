/**
 * Profilens "Mina event": EN rad per sak man skapat, inte per tillfälle -
 * port av webbens utils/myEventRows.ts (buildMyEventRows). Ändras webben ska
 * kopian följa.
 *
 * Två sorters upprepning slås ihop:
 *  1. SERIER: ett dokument med repeatWeekly eller repeatDays, utvecklat till
 *     tillfällen av vecklaUtSerie.
 *  2. SAMMA EVENT INLAGT FLERA GÅNGER - separata dokument med samma titel på
 *     samma plats (Stobirk-fallet: oregelbunden rytm, olika klockslag).
 *
 * Raden representeras av NÄSTA KOMMANDE tillfälle (en helt passerad grupp av
 * sitt senaste). `docIds` bär alla dokument raden står för - soptunnan
 * raderar hela gruppen.
 *
 * APP-ANPASSNING: AppEvent bär tiden som ISO-sträng (inte Date) och
 * serietillfällen pekar på dokumentet via `docId` (webbens seriesId).
 */
import type { AppEvent } from './appEvent';
import { ärSerie, seriensRytmKort } from './anvandarEvent';

export interface MinEventRad {
    /** Tillfället raden visar. */
    evt: AppEvent;
    /** Dokument-id:n raden står för (serier: seriens bas-id, en gång). */
    docIds: string[];
    /** Hur många tillfällen raden döljer. 1 = vanligt engångsevent. */
    count: number;
    /** Chip efter titeln: "Varannan vecka" eller "4 tillfällen". Saknas för engångsevent. */
    tag?: string;
}

/** Dokument-id:t bakom ett (möjligen utvecklat) tillfälle. */
function dokId(evt: AppEvent): string {
    return (evt.docId ?? evt.id).split('__')[0];
}

/** Serienyckel - samma stam som raderingen redan går på. Null = ingen serie. */
function serieNyckel(evt: AppEvent): string | null {
    return ärSerie(evt) ? dokId(evt) : null;
}

/**
 * Nyckel för "samma event igen": titel + plats. Platsen är locationName när
 * den finns och annars koordinaten - två olika event med samma titel i olika
 * orter ska INTE slås ihop.
 */
function upprepningsNyckel(evt: AppEvent): string {
    const titel = evt.title.trim().toLowerCase().replace(/\s+/g, ' ');
    const plats = evt.locationName?.trim().toLowerCase().replace(/\s+/g, ' ');
    const ort = plats || `${evt.lat.toFixed(3)},${evt.lng.toFixed(3)}`;
    return `${titel}@@${ort}`;
}

const tidMs = (e: AppEvent): number => Date.parse(e.time);

/** Nästa kommande i högen; är allt passerat representerar det senaste. */
function representant(tillfällen: AppEvent[], nuMs: number): AppEvent {
    const kommande = tillfällen.filter(e => tidMs(e) >= nuMs);
    const taTidigaste = kommande.length > 0;
    const pool = taTidigaste ? kommande : tillfällen;
    return pool.reduce((bäst, e) => {
        const bättre = taTidigaste ? tidMs(e) < tidMs(bäst) : tidMs(e) > tidMs(bäst);
        return bättre ? e : bäst;
    });
}

export function minaEventRader(events: AppEvent[], nuMs: number): MinEventRad[] {
    // Steg 1: serier - alla tillfällen av ETT dokument blir en rad.
    const lösa: AppEvent[] = [];
    const perSerie = new Map<string, AppEvent[]>();
    for (const evt of events) {
        const nyckel = serieNyckel(evt);
        if (!nyckel) { lösa.push(evt); continue; }
        const arr = perSerie.get(nyckel);
        if (arr) arr.push(evt); else perSerie.set(nyckel, [evt]);
    }

    const rader: MinEventRad[] = [];
    for (const tillfällen of perSerie.values()) {
        const evt = representant(tillfällen, nuMs);
        rader.push({
            evt,
            docIds: [dokId(evt)],
            count: tillfällen.length,
            tag: seriensRytmKort(evt),
        });
    }

    // Steg 2: separata dokument som är samma event om och om igen.
    const perUpprepning = new Map<string, AppEvent[]>();
    for (const evt of lösa) {
        const nyckel = upprepningsNyckel(evt);
        const arr = perUpprepning.get(nyckel);
        if (arr) arr.push(evt); else perUpprepning.set(nyckel, [evt]);
    }
    for (const grupp of perUpprepning.values()) {
        const evt = representant(grupp, nuMs);
        rader.push(grupp.length > 1
            ? {
                evt,
                // I tidsordning: raderingen (och bekräftelsedialogen) ska
                // följa samma ordning som listan man tittat på.
                docIds: [...grupp].sort((a, b) => tidMs(a) - tidMs(b)).map(dokId),
                count: grupp.length,
                tag: `${grupp.length} tillfällen`,
            }
            : { evt, docIds: [dokId(evt)], count: 1 });
    }

    return rader.sort((a, b) => tidMs(a.evt) - tidMs(b.evt));
}
