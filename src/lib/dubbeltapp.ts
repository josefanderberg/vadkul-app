/**
 * Dubbeltapp-tolkningen för eventkortet (11/10, Josef: "funkar inte att
 * dubbelklicka på listan, den åker inte ner"): två snabba stillastående
 * tapp nära varandra fäller ihop arket till default-stoppet. Ren logik så
 * EventKorts touch-handlers bara behöver hålla två punkter - radernas
 * enkeltryck och scrollsvep ska aldrig räknas.
 */

export interface Tapp {
    /** nativeEvent.timestamp (ms, monoton inom plattformen). */
    t: number;
    x: number;
    y: number;
}

/** Ett tapp: kort och stillastående. Längre/rörligare = scroll eller drag. */
export const TAPP_MAX_MS = 280;
export const TAPP_MAX_FLYTT = 12;
/** Dubbelt: andra tappet strax efter och nära det första. */
export const DUBBEL_MAX_MS = 340;
export const DUBBEL_MAX_AVSTÅND = 48;

/** Var nedsläpp → uppsläpp ett tapp (inte ett svep eller långtryck)? */
export function ärTapp(start: Tapp, slut: Tapp): boolean {
    return slut.t - start.t <= TAPP_MAX_MS
        && Math.hypot(slut.x - start.x, slut.y - start.y) <= TAPP_MAX_FLYTT;
}

/** Fullbordar `tapp` en dubbeltapp efter `förra` fullbordade tapp? */
export function ärDubbeltapp(förra: Tapp | null, tapp: Tapp): boolean {
    return förra !== null
        && tapp.t - förra.t <= DUBBEL_MAX_MS
        && Math.hypot(tapp.x - förra.x, tapp.y - förra.y) <= DUBBEL_MAX_AVSTÅND;
}
