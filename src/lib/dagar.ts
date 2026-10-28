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

export interface DagSektion<T> {
    titel: string;
    data: T[];
}

/**
 * Söklistans dagrubriker (18/10, "tydliga tidsrubriker" när filtret visar
 * listan): det filtrerade underlaget i tidsordning, grupperat på STARTDAGEN
 * med periodLabels etiketter ("Idag", "Imorgon", "ons 30 sep"). Ett pågående
 * event som startade före idag klumpas under "Idag" - en gårdagsrubrik över
 * dagens lista förvirrar bara. Otolkbar tid filtreras bort (samma hållning
 * som eventIPeriod).
 */
export function dagSektioner<T extends { time: string }>(events: T[], nu: Date = new Date()): DagSektion<T>[] {
    const idag = dagStart(nu, 0).getTime();
    const tidsatta = events
        .map(e => ({ e, t: new Date(e.time).getTime() }))
        .filter(x => !Number.isNaN(x.t))
        .sort((a, b) => a.t - b.t);
    const ut: DagSektion<T>[] = [];
    let senast: string | null = null;
    for (const { e, t } of tidsatta) {
        const d = new Date(t);
        d.setHours(0, 0, 0, 0);
        // Math.round av samma skäl som offsetFörDatum: sommartidsbyten.
        const offset = Math.max(0, Math.round((d.getTime() - idag) / 86_400_000));
        const titel = periodLabel(offset, 1, nu);
        if (titel !== senast) {
            ut.push({ titel, data: [] });
            senast = titel;
        }
        ut[ut.length - 1].data.push(e);
    }
    return ut;
}

/** Appflödets horisont innan nattkedjan började skicka `days` i flödet. */
export const STANDARD_HORISONT_DAGAR = 14;

/**
 * Sista dagen dagväljaren och kalendern når: flödets horisont (`days` i
 * appflödet) minus ett, eftersom idag är dag 0. Flödet bestämmer - förlängs
 * horisonten i nattkedjan följer appen med utan ny version (Josef 28/10:
 * "varför går det inte klicka sig längre fram än 10 november"). Saknat eller
 * trasigt värde = den gamla 14-dagarshorisonten.
 */
export function horisontOffset(dagar: number | null | undefined): number {
    const d = typeof dagar === 'number' && Number.isFinite(dagar) && dagar >= 1 ? Math.floor(dagar) : STANDARD_HORISONT_DAGAR;
    return d - 1;
}

/**
 * Kalenderns val (webbens handleCalendarPick i dagväljaren): datumet blir
 * dagens offset från idag. Passerade dygn ger null ("passerade dygn visas
 * inte"), liksom dagar bortom flödets horisont (horisontOffset - webben har
 * ingen övre gräns, där hämtas resten av tidslinjen).
 */
export function offsetFörDatum(datum: Date, maxOffset: number, nu: Date = new Date()): number | null {
    if (Number.isNaN(datum.getTime())) return null;
    const dag = new Date(datum);
    dag.setHours(0, 0, 0, 0);
    // Math.round: ett sommartidsbyte emellan ger 23/25-timmarsdygn.
    const offset = Math.round((dag.getTime() - dagStart(nu, 0).getTime()) / 86_400_000);
    return offset < 0 || offset > maxOffset ? null : offset;
}
