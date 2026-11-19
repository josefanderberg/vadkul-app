/**
 * VAR TITLARNA FÅR STÅ (josefanderberg/VADKUL#261) - port av webbens
 * apps/web/src/components/v2/v2MapLabel.ts (#196, #204). Ändras webben ska
 * kopian följa.
 *
 * Josef 19/11: "på webben, så har vi titlarna både över, under och höger och
 * vänster om eventmarkörerna. Alltså så vi får se maximalt med event titlar
 * och att de inte hamnar bakom något ... se till att det funkar likadant på
 * appen" (iOS och Android).
 *
 * Webben ger titellagret alla lägen på en gång (MapLibres
 * text-variable-anchor-offset). Appens kartbibliotek kan inte den egenskapen
 * (MapLibre RN 11.x, inte heller den senaste), och vanliga
 * text-variable-anchor speglar förskjutningen runt koordinaten - men brickan
 * står OVANFÖR koordinaten, så "över" och "vid sidan av kroppen" går inte att
 * uttrycka. Därför:
 *
 *  - ETT LAGER PER LÄGE, i webbens ordning (ETIKETT_LÄGEN). MapLibre placerar
 *    lagren uppifrån och ner, så alla titlar provar "under" först, sedan
 *    höger, vänster, över och snett. (Webben provar alla lägen för en titel
 *    innan nästa titel - här provar alla titlar ett läge i taget. Lägena och
 *    var de står är desamma.)
 *  - SPÄRREN hindrar att samma bricka får titel i två lager: varje titellager
 *    bär en osynlig 2x2-ikon mitt i brickans kropp. Ikonen placeras ihop med
 *    titeln, så när en titel väl stått tar spärren platsen och brickans
 *    titlar i senare lager krockar med den. I första lagret är spärren valfri
 *    (titeln under spetsen får stå även om spärren inte får plats), i de
 *    andra krävs den.
 *  - SPRINGAN gör spärren ostörd av titlar: krockytan över kroppen (#204) är
 *    två halvor med en smal springa i mitten där spärren står. En titel är
 *    alltid bredare än springan, så en titel som skulle nå in i springan
 *    krockar redan med en halva - ingen titel kan ta en spärrs plats. Bara en
 *    granne vars kropp täcker brickans mitt (två brickor nästan ovanpå
 *    varandra) kan det.
 *  - KATEGORIRESERVEN (webbens #196-spärr) bär samma spärr, krävd: har
 *    brickan fått en titel står ingen kategori under den.
 *
 * TITLARNA VÄXER MOT MITTEN (#262): lagret i provar läge i i brickans
 * ordning - den vanliga i bildens mitt, inåt i kanterna (kontraktets
 * mapTitles). Spärren bryr sig inte om vilket läge som vann.
 *
 * Alla mått i pt relativt koordinaten (spetsen), y nedåt, vid icon-size 1 -
 * appens brickor ritas alltid i den storleken (lib/brickor: kroppen 40 pt,
 * bakad med webbens ritkod, så webbens mått vid icon-size 1 gäller).
 * Ren modul: inga kart- eller React-API:er.
 */

import { TITLE_PLACEMENTS, type TitleAnchor, type TitlePlacement } from '@vadkul/kontrakt';

/** MapLibres ankarnamn - sidan av texten som står på punkten. */
export type EtikettAnkare = TitleAnchor;

/**
 * Lägena i den vanliga ordningen: kontraktets TITLE_PLACEMENTS, SAMMA lista
 * som webben (#262). Ankare + förskjutning i em av textstorleken. I bildens
 * kanter provas de i en annan ordning så titeln växer inåt
 * (TITLE_PLACEMENTS_BY_SIDE, egenskapen `side` på brickan).
 */
export const ETIKETT_LÄGEN: readonly TitlePlacement[] = TITLE_PLACEMENTS;

/** Webbens LABEL_CAT_PLACEMENT: kategorireserven står bara under brickan. */
export const KATEGORI_LÄGE: readonly [EtikettAnkare, readonly [number, number]] = ['top', [0, 0.35]];

/** Etiketternas textstorlek per zoom (pt) - webbens LABEL_TEXT_SIZE_STOPS. */
export const ETIKETT_TEXTSTORLEK: readonly (readonly [number, number])[] = [[9, 11], [13, 12.5], [16, 13.5]];

/** Textens luft i kollisionen (MapLibres text-padding, webbens LABEL_TEXT_PADDING_PX). */
export const ETIKETT_LUFT = 2;

// ── Brickans mått (webbens v2MapBricka vid icon-size 1) ─────────────────────
/** Kroppens diameter. */
export const KROPP_S = 40;
/** Luft under spetsen i den bakade bilden. */
export const KROPP_PAD = 7;
/** Kroppens mitt ovanför koordinaten (webbens BRICKA_CENTER_ABOVE_COORD). */
export const KROPP_MITT_OVAN = KROPP_PAD + (KROPP_S * Math.SQRT2) / 2;
/** "+N"-pillens mitt relativt spetsen och dess höjd/minsta bredd (lib/brickor). */
export const BADGE_MITT_X = 20 * Math.SQRT1_2 + 4;
export const BADGE_MITT_Y = 7 + 20 * Math.SQRT2 + 20 * Math.SQRT1_2 + 5;
export const BADGE_D = 20;

export interface Ruta { x0: number; y0: number; x1: number; y1: number }

/** Halva springans bredd mitt i kroppens krockyta. */
export const SPRINGA_HALV = 2;
/** Spärrens sida (pt). Måste rymmas i springan med luft åt båda håll. */
export const SPÄRR_S = 2;

/** Kroppens krockyta (webbens LABEL_BODY_BOX): från cirkelns topp till spetsens luft. */
export const KROPP_RUTA: Ruta = {
    x0: -KROPP_S / 2,
    x1: KROPP_S / 2,
    y0: -(KROPP_MITT_OVAN + KROPP_S / 2),
    y1: -KROPP_PAD,
};
/** Kroppens krockyta som två halvor med springan emellan. */
export const HINDER_VÄNSTER: Ruta = { ...KROPP_RUTA, x1: -SPRINGA_HALV };
export const HINDER_HÖGER: Ruta = { ...KROPP_RUTA, x0: SPRINGA_HALV };
/** "+N"-pillens krockyta (webbens LABEL_BADGE_BOX). */
export const HINDER_BADGE: Ruta = {
    x0: BADGE_MITT_X - BADGE_D / 2,
    x1: BADGE_MITT_X + BADGE_D / 2,
    y0: -BADGE_MITT_Y - BADGE_D / 2,
    y1: -BADGE_MITT_Y + BADGE_D / 2,
};
/** Spärrens plats: kroppens mitt, i springan. */
export const SPÄRR_MITT: readonly [number, number] = [0, -KROPP_MITT_OVAN];
export const SPÄRR_RUTA: Ruta = {
    x0: SPÄRR_MITT[0] - SPÄRR_S / 2,
    x1: SPÄRR_MITT[0] + SPÄRR_S / 2,
    y0: SPÄRR_MITT[1] - SPÄRR_S / 2,
    y1: SPÄRR_MITT[1] + SPÄRR_S / 2,
};

/**
 * Krocklagrets bild + placering för en ruta (webbens obstacleIcon): en
 * genomskinlig bild i rutans storlek (heltal, avrundad uppåt) med övre
 * vänstra hörnet i rutans hörn (icon-anchor top-left + icon-offset).
 */
export function hinderIkon(r: Ruta): { width: number; height: number; offset: [number, number] } {
    return { width: Math.ceil(r.x1 - r.x0), height: Math.ceil(r.y1 - r.y0), offset: [r.x0, r.y0] };
}

/** Rutan MapLibre faktiskt krockar mot (icon-padding 0): bildens mått från hörnet. */
export function hinderRuta(r: Ruta): Ruta {
    const { width, height, offset } = hinderIkon(r);
    return { x0: offset[0], y0: offset[1], x1: offset[0] + width, y1: offset[1] + height };
}

/** De genomskinliga bilderna kartan behöver: namn → mått. Halvorna delar bild. */
export const HINDER_BILDER = {
    'hinder-halva': { width: hinderIkon(HINDER_VÄNSTER).width, height: hinderIkon(HINDER_VÄNSTER).height },
    'hinder-badge': { width: hinderIkon(HINDER_BADGE).width, height: hinderIkon(HINDER_BADGE).height },
    'etikett-sparr': { width: SPÄRR_S, height: SPÄRR_S },
} as const;

/**
 * Krockrutan för en enradig etikett med FAST ankare: en radhöjd (1,2 em)
 * hög, ankarsidan på punkten, plus förskjutningen och textens luft. (Webbens
 * labelTextBox, utan baslinjeskiftet - det lägger MapLibre bara på vid
 * rörliga ankare.)
 */
export function etikettRuta(ankare: EtikettAnkare, förskjutning: readonly [number, number], textPt: number, breddPt: number): Ruta {
    const h = 1.2 * textPt;
    const ha = ankare.endsWith('left') ? 0 : ankare.endsWith('right') ? 1 : 0.5;
    const va = ankare.startsWith('top') ? 0 : ankare.startsWith('bottom') ? 1 : 0.5;
    const x0 = -ha * breddPt + förskjutning[0] * textPt;
    const y0 = -va * h + förskjutning[1] * textPt;
    const p = ETIKETT_LUFT;
    return { x0: x0 - p, y0: y0 - p, x1: x0 + breddPt + p, y1: y0 + h + p };
}

export function överlappar(a: Ruta, b: Ruta): boolean {
    return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
}

/** Titellagrets id för läge i (0-baserat) i en källa ("etikett" eller "hal"). */
export function titelLagerId(prefix: string, i: number): string {
    return `${prefix}-titel-${i + 1}`;
}
