/**
 * TILLBAKA TILL DÄR MAN VAR I LISTAN (Josef 5/11 2026: "om man går ifrån
 * stadssidorna eller arrangörssidorna. då kommer man ju till eventkortet på
 * kartan. Men ha då så den tillbaka knappen är aktiv då. så att om man
 * klickar på den så går man tillbaka till där man var i listan").
 *
 * Hoppet till kartan (lib/kartHopp) stänger listskärmen, så tillbakavägen
 * öppnar den på nytt. Var man stod följer med i returlänkens parametrar:
 * listans scrollläge (y), eventet man tryckte på (id) och stadssidans
 * period. Den nyöppnade listan renderar minst fram till det eventet och
 * rullar sedan till y (lib/useListRetur). Ren modul, testad.
 */
import type { Period } from './stadsPeriod';

export interface ListLäge {
    y: number;
    id: string | null;
}

const PERIODER: readonly Period[] = ['alla', 'idag', 'imorgon', 'helgen', 'veckan'];

/** Parametrarna returlänken bär (alla värden strängar, som routern vill ha). */
export function returParametrar(läge: ListLäge): { y: string; id?: string } {
    return { y: String(Math.max(0, Math.round(läge.y))), ...(läge.id ? { id: läge.id } : {}) };
}

/** Läget ur skärmens parametrar, eller null när skärmen inte öppnades som retur. */
export function läsListLäge(p: { y?: string | string[]; id?: string | string[] }): ListLäge | null {
    const yStr = Array.isArray(p.y) ? p.y[0] : p.y;
    if (yStr == null || yStr === '') return null;
    const y = Number(yStr);
    if (!Number.isFinite(y) || y < 0) return null;
    const id = Array.isArray(p.id) ? p.id[0] : p.id;
    return { y, id: id || null };
}

/** Stadssidans period ur parametrarna (okänt värde = alla dagar). */
export function läsPeriod(p: string | string[] | undefined): Period {
    const v = Array.isArray(p) ? p[0] : p;
    return (PERIODER as readonly string[]).includes(v ?? '') ? (v as Period) : 'alla';
}

/** Löpnumret (över alla sektioner) för eventet - hur långt listan måste
 *  rendera innan den kan rulla dit. -1 när det inte finns i listan. */
export function löpnummer(sektioner: readonly { data: readonly { id: string }[] }[], id: string): number {
    let n = 0;
    for (const s of sektioner) {
        const i = s.data.findIndex(e => e.id === id);
        if (i >= 0) return n + i;
        n += s.data.length;
    }
    return -1;
}

/** Hur många rader listan ska rendera direkt: fram till eventet och en
 *  skärm till, minst listans vanliga start. */
export function raderAttRendera(sektioner: readonly { data: readonly { id: string }[] }[], läge: ListLäge | null, vanligt = 10): number {
    if (!läge) return vanligt;
    const n = läge.id ? löpnummer(sektioner, läge.id) : -1;
    if (n >= 0) return Math.max(vanligt, n + 15);
    // Okänt event: räkna grovt på radhöjden (~80 pt) - hellre för många än för få.
    return Math.max(vanligt, Math.ceil(läge.y / 80) + 15);
}
