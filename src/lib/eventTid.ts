/**
 * Tidsraden i eventkortet — ren, testad formattering på svenska.
 * Flödets `time` är en ISO-sträng; hasSpecificTime=false betyder "vi vet
 * dagen men inte klockslaget" (visas utan tid, precis som webben).
 */

const VECKODAGAR = ['sön', 'mån', 'tis', 'ons', 'tors', 'fre', 'lör'];
const MANADER = ['jan', 'feb', 'mars', 'april', 'maj', 'juni', 'juli', 'aug', 'sep', 'okt', 'nov', 'dec'];

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
