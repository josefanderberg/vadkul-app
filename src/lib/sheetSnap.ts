/**
 * Eventkortets TRE STOPP - port av webbens utils/sheetSnap (ägarbeslut 2/9):
 * default (header + bildremsa) → tapp-höjden (~halva skärmen) → taket. Ett
 * fingerdrag tar alltid minst ett steg i dragets riktning och HOPPAR VIDARE
 * när det är tydligt att man vill längre (Josef 11/10: "om man slidar längre
 * upp så ska den hoppa upp 2 steg direkt ... som att bara slida ner hela
 * eventkortet hela vägen ner om man gör en mer längre dragning"): ett stopp
 * passeras när släppet nått SKIP_FRAC av vägen förbi det, och farten i
 * släppet räknas in (projicerad PROJ_MS framåt, högst MAX_PROJ). Under det
 * lägsta stoppet väntar "stängt". Samma regel som webbens utils/sheetSnap.
 * Här i synliga punkter (webben räknar i vh). Ren logik utan gester så den
 * kan testas i vitest.
 */

/** Andel av avståndet till NÄSTA stopp som släppet måste ha passerat ett
 *  stopp med för att hoppa vidare (0,5 = närmaste stopp, det gamla läget). */
export const SKIP_FRAC = 0.25;
/** Så långt fram (ms) släppets fart projiceras. */
export const PROJ_MS = 100;
/** Tak för projektionen i punkter (~15 % av en telefonskärm, webbens 15 vh). */
export const MAX_PROJ = 140;

/** Stopplista stigande, utan dubbletter närmare än minGap (tapp-höjden kan
 *  sammanfalla med default eller taket på små skärmar). */
export function sheetStops(values: number[], minGap = 24): number[] {
    const sorted = values.filter(v => Number.isFinite(v)).sort((a, b) => a - b);
    const out: number[] = [];
    for (const v of sorted) {
        if (out.length === 0 || v - out[out.length - 1] > minGap) out.push(v);
    }
    return out;
}

/** Släpp efter ett UPPÅT-drag från `start`, släppt på höjden `h` (gärna med
 *  farten inräknad): första stoppet ovanför start (minst ett steg), sedan
 *  vidare så länge h passerat stoppet med SKIP_FRAC av gapet till nästa.
 *  Inget ovanför → högsta. */
export function snapUp(stops: number[], start: number, h: number, tolerance = 8): number {
    const above = stops.filter(s => s > start + tolerance);
    if (above.length === 0) return stops[stops.length - 1];
    let i = 0;
    while (i + 1 < above.length && h >= above[i] + SKIP_FRAC * (above[i + 1] - above[i])) i++;
    return above[i];
}

/** Släpp efter ett NEDÅT-drag: första stoppet nedanför start (minst ett
 *  steg), sedan vidare nedåt med samma regel. Under det lägsta stoppet
 *  väntar "stängt" (höjd 0). null = stäng kortet. */
export function snapDown(stops: number[], start: number, h: number, tolerance = 8): number | null {
    const below = stops.filter(s => s < start - tolerance).reverse();
    if (below.length === 0) return null;
    const path = [...below, 0];
    let i = 0;
    while (i + 1 < path.length && h <= path[i] - SKIP_FRAC * (path[i] - path[i + 1])) i++;
    return i === path.length - 1 ? null : path[i];
}

/**
 * Var arket ska stå när default-stoppet flyttat sig (huvudet växte eller
 * krympte: chipsen fälldes ut, sökningen gömde eventet). null = stå kvar.
 *
 *  - Allt från mellanhöjden och uppåt står still - filterknappens
 *    halvvägslyft och taket dras inte runt (11/10).
 *  - Under mellanhöjden följer arket default-stoppet - UTOM i sökläget
 *    (chipsen ute eller en term i fältet): där är mellanhöjden golvet.
 *    Annars sjunker arket under tangentbordet när första tecknet gömmer
 *    eventet (Josef 11/10: "ha den i typ mellanhöjd när man söker").
 *
 * `mellan` är den FASTA mellanhöjden, inte stopp[1]: sheetStops slår ihop
 * stopp som ligger nära, och då kan stopp[1] vara taket.
 */
export function höjdEfterHuvudbyte(läge: {
    höjd: number;
    nyttDefault: number;
    mellan: number;
    sökläge: boolean;
}): number | null {
    if (läge.höjd >= läge.mellan) return null;
    return läge.sökläge ? läge.mellan : läge.nyttDefault;
}

/** px/ms - snabbare svep än så avgör riktningen även för ett kort ryck. */
const SNABB = 0.5;
/** Kortare drag än så (och långsamt) är ett tryck, inget steg. */
const DÖDZON = 10;

/**
 * Var kortet landar efter en gest. dy/vy är gestens förflyttning/fart (positivt
 * = nedåt, vy i pt/ms som PanResponder ger). Riktningen avgörs som förut;
 * vilket stopp av släpphöjden med farten projicerad PROJ_MS framåt (högst
 * MAX_PROJ), så ett långt eller snabbt drag hoppar förbi stopp. Returnerar
 * ny höjd eller null = stäng.
 */
export function landning(stops: number[], start: number, dy: number, vy: number): number | null {
    const h = start - dy;
    const hp = h - Math.max(-MAX_PROJ, Math.min(MAX_PROJ, vy * PROJ_MS));
    if (vy <= -SNABB || dy < -DÖDZON) return snapUp(stops, start, hp);
    if (vy >= SNABB || dy > DÖDZON) return snapDown(stops, start, hp);
    return start;
}
