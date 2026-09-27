/**
 * Dagväljarens rena logik. Kart-ui-arvet från webben: kartan visar EN dag i
 * taget, väljaren bor fast i botten, valt läge är en vit platta (aldrig guld -
 * guld betyder boost). Flödet bär 14 dagar; dagfiltreringen går på STARTDAGEN,
 * precis som webben (flerdagars-event visas på sin första dag).
 */
import { MANADER, VECKODAGAR } from './eventTid';

export interface Dag {
    /** Lokal YYYY-MM-DD - nyckeln filtreringen matchar på. */
    key: string;
    /** "Idag", "Imorgon", "ons 30 sep" … */
    label: string;
}

/** Lokal YYYY-MM-DD för ett datum (INTE toISOString - den är UTC). */
export function dagKey(d: Date): string {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dag = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${dag}`;
}

/** Väljarens dagar: idag och `antal - 1` dagar framåt. */
export function kommandeDagar(antal: number, nu: Date = new Date()): Dag[] {
    const dagar: Dag[] = [];
    for (let i = 0; i < antal; i++) {
        const d = new Date(nu);
        d.setDate(d.getDate() + i);
        const label = i === 0
            ? 'Idag'
            : i === 1
            ? 'Imorgon'
            : `${VECKODAGAR[d.getDay()]} ${d.getDate()} ${MANADER[d.getMonth()]}`;
        dagar.push({ key: dagKey(d), label });
    }
    return dagar;
}

/** Startar eventet på den valda dagen? (Lokal dag ur ISO-tiden.) */
export function eventPåDag(timeIso: string, key: string): boolean {
    const t = new Date(timeIso);
    if (Number.isNaN(t.getTime())) return false;
    return dagKey(t) === key;
}
