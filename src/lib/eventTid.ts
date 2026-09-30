/**
 * Tidsraden i eventkortet — ren, testad formattering på svenska.
 * Flödets `time` är en ISO-sträng; hasSpecificTime=false betyder "vi vet
 * dagen men inte klockslaget" (visas utan tid, precis som webben).
 */

export const VECKODAGAR = ['sön', 'mån', 'tis', 'ons', 'tors', 'fre', 'lör'];
export const MANADER = ['jan', 'feb', 'mars', 'april', 'maj', 'juni', 'juli', 'aug', 'sep', 'okt', 'nov', 'dec'];

const sammaDag = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** "Idag · 19:00", "Imorgon", "lör 27 sep · 19:00" … */
export function formatEventTid(timeIso: string, hasSpecificTime: boolean, now: Date = new Date()): string {
    const t = new Date(timeIso);
    if (Number.isNaN(t.getTime())) return '';

    const imorgon = new Date(now);
    imorgon.setDate(imorgon.getDate() + 1);
    const dag = sammaDag(t, now)
        ? 'Idag'
        : sammaDag(t, imorgon)
        ? 'Imorgon'
        : `${VECKODAGAR[t.getDay()]} ${t.getDate()} ${MANADER[t.getMonth()]}`;

    if (!hasSpecificTime) return dag;
    const hh = String(t.getHours()).padStart(2, '0');
    const mm = String(t.getMinutes()).padStart(2, '0');
    return `${dag} · ${hh}:${mm}`;
}

const klocka = (t: Date) => `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;

/**
 * Tidsraden med slut: samma dag → "Idag · 19:00-21:00", annan dag →
 * "Idag · 19:00 - lör 4 okt" (flerdagsevent, marknader). Slut före eller lika
 * med start ignoreras (skrapfel ska inte synas som "19:00-19:00").
 */
export function formatTidSpann(
    timeIso: string,
    hasSpecificTime: boolean,
    endIso?: string | null,
    now: Date = new Date(),
): string {
    const start = formatEventTid(timeIso, hasSpecificTime, now);
    if (!start || !endIso) return start;
    const s = new Date(timeIso);
    const e = new Date(endIso);
    if (Number.isNaN(e.getTime()) || e.getTime() <= s.getTime()) return start;
    if (sammaDag(s, e)) return hasSpecificTime ? `${start}-${klocka(e)}` : start;
    return `${start} - ${formatEventTid(endIso, false, now)}`;
}
