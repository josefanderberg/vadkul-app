/**
 * Stadssidans PERIODVAL - port av webbens app/(v1)/evenemang/periods.ts.
 * Chipsen ligger överst till vänster på kart-heron och styr BÅDE herons
 * brickor och daglistan under (webbens delade dayFilter). Sidans ENDA
 * periodfilter: listans egen filterrad (period- och dagchips, timstaplarna)
 * revs på webben 20/9 och ska inte tillbaka - "periodvalet hör hemma i heron".
 *
 * APP-ANPASSNING: webben räknar 'ÅÅÅÅ-MM-DD'-nycklar i svensk tidszon via
 * Intl; appen räknar DAGOFFSETS i enhetens lokala tid (lib/vy.dagOffset),
 * samma som dagväljaren och resten av appen (Hermes Intl skiljer mellan
 * plattformarna, jfr eventTid). Perioderna betyder samma sak.
 */
import { dagOffset } from './vy';

// 'veckan' ersatte 'helgen' 18/8 på webben, 'helgen' kom TILLBAKA 10/9 som
// eget val bredvid veckan (Josef: "det är ju ändå det många söker efter").
export type Period = 'alla' | 'idag' | 'imorgon' | 'helgen' | 'veckan';

export const PERIODER: readonly { key: Period; label: string }[] = [
    { key: 'alla', label: 'Alla' },
    { key: 'idag', label: 'Idag' },
    { key: 'imorgon', label: 'Imorgon' },
    { key: 'helgen', label: 'I helgen' },
    { key: 'veckan', label: 'I veckan' },
];

/**
 * Dagoffsets (0 = idag) som perioden motsvarar just nu. null = ingen
 * dagbegränsning (Alla).
 *  - I helgen = nästkommande lör + sön; på lördag idag + imorgon, på söndag
 *    bara idag (webbens periodKeys).
 *  - I veckan = idag + 6 dagar framåt (webbens weekKeys - samma "i veckan"
 *    som intro-raden och topplistan).
 */
export function periodOffsets(period: Period, nu: Date = new Date()): number[] | null {
    switch (period) {
        case 'alla': return null;
        case 'idag': return [0];
        case 'imorgon': return [1];
        case 'helgen': {
            const dow = nu.getDay(); // 0 = söndag
            if (dow === 0) return [0];
            const lördag = 6 - dow;
            return [lördag, lördag + 1];
        }
        case 'veckan': return [0, 1, 2, 3, 4, 5, 6];
    }
}

/** Startar eventet inom perioden? Dagfiltret går på STARTDAGEN, som webben. */
export function iPeriod(time: string, period: Period, nu: Date = new Date()): boolean {
    const offsets = periodOffsets(period, nu);
    if (offsets === null) return true;
    const d = dagOffset(time, nu);
    return Number.isFinite(d) && offsets.includes(d);
}

/** Antal event vars startdag ligger i perioden. */
export function räknaIPeriod(events: readonly { time: string }[], period: Period, nu: Date = new Date()): number {
    let n = 0;
    for (const e of events) if (iPeriod(e.time, period, nu)) n++;
    return n;
}

/**
 * Tomlägets fras efter "Inga event": "idag", "i helgen", "just nu" - webbens
 * PERIODS.unit ("just nu" för Alla).
 */
export function periodFras(period: Period): string {
    switch (period) {
        case 'alla': return 'just nu';
        case 'idag': return 'idag';
        case 'imorgon': return 'imorgon';
        case 'helgen': return 'i helgen';
        case 'veckan': return 'i veckan';
    }
}
