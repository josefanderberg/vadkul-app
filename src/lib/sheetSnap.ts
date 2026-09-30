/**
 * Eventkortets TRE STOPP - port av webbens utils/sheetSnap (ägarbeslut 2/9):
 * default (header + bildremsa) → tapp-höjden (~halva skärmen) → taket. Ett
 * fingerdrag landar på närmaste stopp i dragets riktning, alltid minst ett
 * steg; nedåt från lägsta stoppet stänger. Här i synliga punkter (webben
 * räknar i vh). Ren logik utan gester så den kan testas i vitest.
 */

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

/** Släpp efter ett UPPÅT-drag från `start`, släppt på höjden `h`: närmaste
 *  stopp ovanför start (minst ett steg). Inget ovanför → högsta. */
export function snapUp(stops: number[], start: number, h: number, tolerance = 8): number {
    const above = stops.filter(s => s > start + tolerance);
    if (above.length === 0) return stops[stops.length - 1];
    let best = above[0];
    for (const s of above) if (Math.abs(s - h) <= Math.abs(best - h)) best = s;
    return best;
}

/** Släpp efter ett NEDÅT-drag: närmaste stopp nedanför start (minst ett
 *  steg). null = inget kvar → stäng kortet. */
export function snapDown(stops: number[], start: number, h: number, tolerance = 8): number | null {
    const below = stops.filter(s => s < start - tolerance);
    if (below.length === 0) return null;
    let best = below[below.length - 1];
    for (let i = below.length - 1; i >= 0; i--) {
        if (Math.abs(below[i] - h) <= Math.abs(best - h)) best = below[i];
    }
    return best;
}

/** px/ms - snabbare svep än så avgör riktningen även för ett kort ryck. */
const SNABB = 0.5;
/** Kortare drag än så (och långsamt) är ett tryck, inget steg. */
const DÖDZON = 10;

/**
 * Var kortet landar efter en gest. dy/vy är gestens förflyttning/fart (positivt
 * = nedåt). Returnerar ny höjd eller null = stäng.
 */
export function landning(stops: number[], start: number, dy: number, vy: number): number | null {
    const h = start - dy;
    if (vy <= -SNABB || dy < -DÖDZON) return snapUp(stops, start, h);
    if (vy >= SNABB || dy > DÖDZON) return snapDown(stops, start, h);
    return start;
}
