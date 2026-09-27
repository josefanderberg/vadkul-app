/**
 * Dag/vecka-väljarens rena logik. Kart-ui-arvet från webben: EN dag eller
 * HELA VECKAN i taget, pilarna stegar EN dag i BÅDA lägena (veckohoppet till
 * nästa måndag byggdes och revs på webben 31/8 - återinför det inte), "Hela
 * veckan" bara på offset 0, annars datumspannet. Dagfiltret går på
 * STARTDAGEN, precis som webben.
 */
import { MANADER, VECKODAGAR } from './eventTid';

/** Lokal midnatt `offset` dagar fram. */
export function dagStart(nu: Date, offset: number): Date {
    const d = new Date(nu);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + offset);
    return d;
}

const kortDatum = (d: Date) => `${d.getDate()} ${MANADER[d.getMonth()]}`;

/**
 * Väljarens etikett. Dag: "Idag", "Imorgon", "ons 30 sep". Vecka:
 * "Hela veckan" på offset 0, annars spannet "28 sep-4 okt".
 */
export function periodLabel(offset: number, längd: 1 | 7, nu: Date = new Date()): string {
    const start = dagStart(nu, offset);
    if (längd === 1) {
        if (offset === 0) return 'Idag';
        if (offset === 1) return 'Imorgon';
        return `${VECKODAGAR[start.getDay()]} ${kortDatum(start)}`;
    }
    if (offset === 0) return 'Hela veckan';
    return `${kortDatum(start)}-${kortDatum(dagStart(nu, offset + 6))}`;
}

/** Startar eventet i perioden [offset, offset + längd) dagar från nu? */
export function eventIPeriod(timeIso: string, offset: number, längd: number, nu: Date = new Date()): boolean {
    const t = new Date(timeIso).getTime();
    if (Number.isNaN(t)) return false;
    return t >= dagStart(nu, offset).getTime() && t < dagStart(nu, offset + längd).getTime();
}
