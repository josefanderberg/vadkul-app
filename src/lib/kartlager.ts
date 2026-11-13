/**
 * Kartans brick-lager som GeoJSON - EN bricka per plats (webbens grupper):
 * event på samma plats (lib/vy.platsNyckel) blir en bricka med antal, och ett
 * tryck på den öppnar väljarlistan i kortet (ägarbeslut 31/8). Ren logik så
 * den går att testa utan karta.
 *
 * Representanten är första eventet som inte varit (tidsordning) - eller det
 * valda, om det ligger i gruppen. Ticketmaster blir aldrig representant före
 * ett tidigare event (sortKey-lyftningen är stjärnans/boostens privilegium,
 * kart-ui). "Har varit" = ALLA i gruppen passerade → brickan dimmas.
 *
 * Etiketterna är webbens (components/v2/v2MapLabel.ts + LABEL_LAYER_IDS i
 * V2Map): titeln (kapad) när den får plats, annars kategorin, annars inget.
 * Kartan lägger titellagret ÖVER kategorilagret - MapLibre placerar uppifrån
 * och ner, så titlarna tar plats först. `etikettPrio` avgör vem som får
 * platsen först inom lagret (lägst först): de populäraste, sedan större
 * grupper (Josef 9/10: "på avstånd så ska det populäraste eventet visas").
 */
import type { AppFeedEvent } from '@vadkul/kontrakt';
import { ärEgetVadkulEvent, type AppEvent } from './appEvent';
import { INGA_BOOSTAR, ärBoostad, type Boostar } from './boost';
import { brickaIkon, brickansKategori, type BrickTillstånd } from './brickor';
import { emojiBild } from './emojiBricka';
import { isEventPast } from './harVarit';
import { eventEmoji, kategoriFor } from './kategorier';
import type { Önskan } from './onskningar';
import { isTicketmasterEvent } from './ticketmaster';
import { platsNyckel } from './vy';

/** Webbens LABEL_MAX_CHARS: en rad under en 40 px-bricka - längre läses inte. */
export const ETIKETT_MAX_TECKEN = 18;

/** En ram i en växlande multibricka (lib/brickCykel): ett av gruppens
 *  kommande event, en per synlig bild. */
export interface BrickRam {
    ikon: string;
    emojiBild: string;
    titel: string;
    label: string;
}

export interface BrickProps {
    /** Representantens id - trycket slår upp gruppen via platsNyckel. */
    id: string;
    /** Den förbakade brickan - kategorins emoji. */
    ikon: string;
    /** Brickan med representantens EGEN emoji (lib/emojiBricka), '' när
     *  `ikon` redan visar den. Kartan byter till den när bilden är klar. */
    emojiBild: string;
    /** Samma bild för brickan som VALD - förbakas så trycket inte visar
     *  kategorins emoji en stund. '' när brickan redan är vald. */
    valdEmojiBild: string;
    /** Kategorins kortnamn ("Musik") - reserven när titeln inte får plats. */
    label: string;
    /** Representantens titel, kapad till ETIKETT_MAX_TECKEN. */
    titel: string;
    antal: number;
    /** Den bakade "+N"-badgen (antal-N / antal-99plus), tom för ensamma event. */
    antalIkon: string;
    past: boolean;
    vald: boolean;
    /** Ritordning: vald överst, sedan guld/pop, sist har varit. */
    sort: number;
    /** Etikettplaceringens turordning, lägst först: populärt före stora grupper. */
    etikettPrio: number;
    /** Alltid bricka, oavsett avstånd till mitten (lib/kartUrval): guld,
     *  sparad eller användarskapad - webbens sticky-brickor. */
    fast: boolean;
    /** Populär eller guld - går först i urvalet kring mitten. */
    pop: boolean;
    /** Kategorins färg - pricken när platsen inte är bricka. */
    färg: string;
    /** Multibrickans växling (lib/brickCykel), tom när brickan står still:
     *  ensam, vald, boostad/stjärnmärkt, passerad eller bara en synlig bild. */
    ramar?: BrickRam[];
}

/** Webbens truncateLabel: Array.from så emoji/surrogatpar aldrig klyvs. */
export function kapaEtikett(text: string, max = ETIKETT_MAX_TECKEN): string {
    const tecken = Array.from(text.trim());
    if (tecken.length <= max) return tecken.join('');
    return tecken.slice(0, max).join('').trimEnd() + '…';
}

export function antalIkon(antal: number): string {
    if (antal < 2) return '';
    return antal > 99 ? 'antal-99plus' : `antal-${antal}`;
}

export interface BrickVal {
    nowMs: number;
    valtId?: string | null;
    ärSparad?: (id: string) => boolean;
    /** Stjärnmärkta event-id:n (eventStars) - guldbricka, och stjärnan
     *  LYFTER representanten i en grupp (kart-ui: "sortKey-lyftningen är
     *  stjärnans/boostens privilegium"). */
    stjärnor?: ReadonlySet<string>;
    /** Aktiva boostar (data/boostar; egna event bär featuredUntil själva)
     *  - samma guldbricka + lyftning som stjärnan (webbens boostedRep,
     *  Josef 4/11: "så de syns ännu längre"). */
    boostar?: Boostar;
}

export function byggBrickor(
    events: readonly AppEvent[],
    opts: BrickVal,
): GeoJSON.FeatureCollection<GeoJSON.Point, BrickProps> {
    const boostar = opts.boostar ?? INGA_BOOSTAR;
    const boostad = (e: AppEvent) => ärBoostad(e, boostar, opts.nowMs);
    const grupper = new Map<string, AppEvent[]>();
    for (const e of events) {
        const k = platsNyckel(e);
        const g = grupper.get(k);
        if (g) g.push(e);
        else grupper.set(k, [e]);
    }
    const features: GeoJSON.Feature<GeoJSON.Point, BrickProps>[] = [];
    for (const grupp of grupper.values()) {
        grupp.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime() || (a.id < b.id ? -1 : 1));
        const levande = grupp.filter(e => !isEventPast(e, opts.nowMs));
        const vald = opts.valtId ? grupp.find(e => e.id === opts.valtId) : undefined;
        const stjärnmärkt = opts.stjärnor ? levande.find(e => opts.stjärnor!.has(e.id)) : undefined;
        const boostadRep = levande.find(boostad);
        const rep = vald ?? stjärnmärkt ?? boostadRep ?? levande[0] ?? grupp[0];
        const past = levande.length === 0;
        // KROPPENS FLAGGOR SITTER PÅ GRUPPEN, som på webben (deriveGroupBrick:
        // drawStar/drawGold/drawPop, och den valda DOM-markörens isGoldStar):
        // guldet och ⭐ följer platsen även när man valt ett annat event där
        // (Josef 11/11, VADKUL#189 - annars stack platsens ⭐ ut under den
        // valda brickan). Guldkropp MED ⭐ (webbens starred): ett kommande
        // stjärnmärkt eller boostat event. Ticketmaster = guld UTAN ⭐ (kart-
        // ui 1/9: stjärnan är boostens/stjärngåvans kvitto). Passerade räknas
        // inte - en förbrukad stjärna eller boost lyser inte.
        const stjärna = !!stjärnmärkt || !!boostadRep;
        const guld = levande.some(isTicketmasterEvent);
        const pop = levande.some(e => e.pop === true);
        const sparad = !!opts.ärSparad && grupp.some(e => opts.ärSparad!(e.id));
        const grön = ärEgetVadkulEvent(rep);
        const nivå = pop || guld || stjärna ? 0 : grön ? 1 : 2;
        // Webbens sticky (kart-ui): boostar/stjärnor (⭐), TM (guld), gillade
        // (sparad) och användarskapade - de senare så fort NÅGOT kommande i
        // gruppen är det.
        const fast = stjärna || guld || sparad || grön || levande.some(e => e.userCreated === true);
        const tillstånd: BrickTillstånd = { category: String(rep.category), pop, stjärna, guld, sparad, grön };
        const ikon = brickaIkon({ ...tillstånd, vald: !!vald });
        // Kortets emoji mot den som är bakad i brickan (okänd kategori - även
        // kyrkan och PRO - har Övrigts bricka).
        const kortets = eventEmoji(rep);
        const brickans = kategoriFor(brickansKategori(tillstånd.category)).emoji;
        // VÄXLINGEN (webbens cycleRotations, Josef 5/11): de kommande eventen i
        // tidsordning, EN ram per synlig bild - dubbletterna hoppas över.
        // Kroppens flaggor (guld/sparad/pop) är gruppens och följer med varje
        // ram, så brickan inte blinkar mellan kroppar; kategori, egen emoji
        // och grönt (eget VADKUL-event) är eventets.
        const ramar: BrickRam[] = [];
        if (!vald && !stjärna && levande.length > 1) {
            const sedda = new Set<string>();
            for (const e of levande) {
                const t: BrickTillstånd = { ...tillstånd, category: String(e.category), grön: ärEgetVadkulEvent(e) };
                const ik = brickaIkon(t);
                const em = emojiBild(ik, eventEmoji(e), kategoriFor(brickansKategori(t.category)).emoji);
                const synlig = em || ik;
                if (sedda.has(synlig)) continue;
                sedda.add(synlig);
                ramar.push({ ikon: ik, emojiBild: em, titel: kapaEtikett(e.title ?? ''), label: kategoriFor(String(e.category)).kort });
            }
            if (ramar.length < 2) ramar.length = 0;
        }
        features.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [rep.lng, rep.lat] },
            properties: {
                id: rep.id,
                ikon,
                emojiBild: emojiBild(ikon, kortets, brickans),
                valdEmojiBild: vald ? '' : emojiBild(brickaIkon({ ...tillstånd, vald: true }), kortets, brickans),
                label: kategoriFor(String(rep.category)).kort,
                titel: kapaEtikett(rep.title ?? ''),
                antal: grupp.length,
                antalIkon: antalIkon(grupp.length),
                past,
                vald: !!vald,
                // Ritordning: vald överst, sedan BOOSTADE/stjärnmärkta (Josef
                // 4/11: "den ska alltid ha högst z-index"), guld/grön/pop,
                // vanliga, har varit sist.
                sort: vald ? 4 : past ? 0 : stjärna ? 3 : guld || grön || pop ? 2 : 1,
                etikettPrio: nivå * 1000 - Math.min(grupp.length, 999),
                fast,
                pop: pop || guld || stjärna,
                färg: kategoriFor(String(rep.category)).hex,
                ...(ramar.length > 1 ? { ramar } : {}),
            },
        });
    }
    return { type: 'FeatureCollection', features };
}

/** Den valda platsen: brickan som ritas överst och platsens id i brickkällan. */
export interface ValdPlats {
    /** Platsens bricka som VALD (vald-varianten, valda eventet som
     *  representant, sort 4, inga ramar). */
    bricka: GeoJSON.Feature<GeoJSON.Point, BrickProps>;
    /** Samma plats id i brickkällan och prickarna - representanten UTAN
     *  valet. Pricken under den valda göms med det. */
    basId: string;
}

/**
 * DEN VALDA PLATSEN SOM EGEN BRICKA (Josef 11/11 2026, VADKUL#187: "varje gång
 * jag byter eventbricka då blinkar massa till", och multibrickorna "börjar
 * alltid om vid första bilden"). Brickkällan byggs UTAN valet: ny data i
 * den får appens MapLibre att lägga ut och tona in ALLA brickor, och den
 * valda brickans ramar och högar byggde om hela tonlagret (lib/brickCykel),
 * så varje multibricka hoppade till ram 0. Kartan ritar i stället den valda
 * i en egen liten källa överst (components/KartBrickor), ovanpå platsens
 * vanliga bricka - vald-varianten har tjockast kant och samma ruta, så den
 * täcker den helt. Ett byte skickar då bara om den lilla källan.
 * null = inget valt, eller det valda finns inte bland eventen (ingen bricka
 * blev vald förr heller).
 */
export function valdPlats(
    events: readonly AppEvent[],
    valtId: string | null | undefined,
    opts: Omit<BrickVal, 'valtId'>,
    /** Bläddringsordningen på platsen (Bläddring.ordning) - +N räknar ner
     *  med den (VADKUL#190). Tom = totalen, som förut. */
    ordning: readonly string[] = [],
): ValdPlats | null {
    if (!valtId) return null;
    const valt = events.find(e => e.id === valtId);
    if (!valt) return null;
    const k = platsNyckel(valt);
    const grupp = events.filter(e => platsNyckel(e) === k);
    const byggd = byggBrickor(grupp, { ...opts, valtId }).features[0];
    const bas = byggBrickor(grupp, opts).features[0];
    const { antal } = byggd.properties;
    const bricka = antal > 1
        ? { ...byggd, properties: { ...byggd.properties, antalIkon: kvarIkon(kvarAttBläddra(antal, ordning, valtId), antal) } }
        : byggd;
    return { bricka, basId: bas.properties.id };
}

/**
 * BLÄDDRINGEN PÅ DEN VALDA PLATSEN (VADKUL#190, webbens visitedOrderRef i
 * V2Map): i vilken ordning man valt eventen där - med pagern, ur listan, med
 * Bakåt eller en djuplänk. Den valda brickans +N visar hur många som är kvar
 * att bläddra till, som på webben. Ordningen börjar om när valet byter plats
 * och töms när inget är valt. Ett event man går tillbaka till står kvar på
 * sin plats i ordningen, så siffran följer det valda (Bakåt → större).
 */
export interface Bläddring {
    plats: string | null;
    ordning: readonly string[];
}

export const INGEN_BLÄDDRING: Bläddring = { plats: null, ordning: [] };

/** Nästa bläddringsläge när `valt` är valt. Samma objekt tillbaka när inget
 *  ändrats, så kartskärmen kan härleda den under renderingen utan loop. */
export function bläddraTill(b: Bläddring, valt: Pick<AppFeedEvent, 'id' | 'lat' | 'lng'> | null): Bläddring {
    if (!valt) return b.plats === null && b.ordning.length === 0 ? b : INGEN_BLÄDDRING;
    const plats = platsNyckel(valt);
    if (plats !== b.plats) return { plats, ordning: [valt.id] };
    if (b.ordning.includes(valt.id)) return b;
    return { plats, ordning: [...b.ordning, valt.id] };
}

/** Webbens remaining: antal minus det valdas läge i ordningen, aldrig under
 *  1 och aldrig över antal. Ett val som inte finns i ordningen = läge 0. */
export function kvarAttBläddra(antal: number, ordning: readonly string[], valtId: string): number {
    const läge = ordning.indexOf(valtId);
    return Math.min(antal, Math.max(1, antal - (läge >= 0 ? läge : 0)));
}

/**
 * Den valda brickans +N-bild för `kvar` av platsens `antal`. Till skillnad från
 * antalIkon visas även 1 (webben visar "1" på sista eventet). Den valda badgen
 * ligger OVANPÅ platsens vanliga badge i brickkällan, som alltid visar totalen
 * (källan rörs inte vid ett val, #187). Är totalen tvåsiffrig och det som är
 * kvar ensiffrigt är den undre pillen bredare och skulle sticka ut på sidorna,
 * så då används den breda varianten (antal-N-bred, bakad med tvåsiffrig
 * bredd). Totaler över 99 (99+) med kvar under 100 täcks inte helt - så stora
 * platser finns i praktiken inte.
 */
export function kvarIkon(kvar: number, antal: number): string {
    if (kvar < 1) return '';
    if (kvar > 99) return 'antal-99plus';
    return kvar < 10 && antal >= 10 ? `antal-${kvar}-bred` : `antal-${kvar}`;
}

export interface ÖnskeProps {
    /** Önskans dokument-id - trycket slår upp önskan i listan. */
    id: string;
    ikon: string;
    /** "Önskas · {titel}" - etikettraden under den drömska brickan. */
    etikett: string;
}

/**
 * Önskningarna som eget lager (webbens drömska wish-brickor): kategorins
 * vanliga bricka men renderad halvt genomskinlig av kartan (iconOpacity -
 * appen bakar inga egna önske-ikoner), med "Önskas · {titel}" som etikett.
 * Egen källa - blandas aldrig med event-brickorna eller Nästa-poolen.
 */
export function byggÖnskningar(
    önskningar: readonly Önskan[],
): GeoJSON.FeatureCollection<GeoJSON.Point, ÖnskeProps> {
    return {
        type: 'FeatureCollection',
        features: önskningar.map(w => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [w.lng, w.lat] },
            properties: {
                id: w.id,
                ikon: brickaIkon({ category: w.category, pop: false, guld: false, sparad: false, grön: false, vald: false }),
                etikett: `Önskas · ${kapaEtikett(w.title)}`,
            },
        })),
    };
}
