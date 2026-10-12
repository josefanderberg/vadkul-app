/**
 * STADSTOPPLISTAN i Städer - port av webbens app/(v1)/evenemang/
 * CityLeaderboard.tsx (/evenemang, "Evenemang i Sverige - stad för stad").
 *
 * RADEN ÄR SIFFRORNA (Josef 14/8): idag (eller i helgen i helgsorteringen),
 * i veckan och totalt - ingen fjärde kolumn, den tränger ut namnet på en
 * telefon. Sorteringsvalen är samma nycklar som kolumnerna, så listan och
 * rubrikerna aldrig kan säga olika saker. A-Ö (Josef 2/9) byter platssiffran
 * mot bokstavsavdelare. INGA BESÖKSSIFFROR (ägarbeslut 29/8) - lägg inte till.
 *
 * APP-ANPASSNING: webben bakar antal per stad och dag vid build. Appen har
 * bara länsflödena (api/appFeed), så api/stadsAntal räknar fram samma tal ur
 * dem: event I ORTEN (<= 10 km, samma mått som stadssidan - lib/stadsUtbud),
 * utan de stora opt-in-källorna, startdag idag eller senare. Flödet är 14
 * dagar, så "totalt" är de närmaste 14 dagarna (webben: allt kommande).
 */
import type { AppFeedEvent, City } from '@vadkul/kontrakt';
import { periodOffsets } from './stadsPeriod';
import { stadensEvent, svJämför, utanStoraKällor } from './stadsUtbud';
import { dagOffset } from './vy';

/** Antal event per dagoffset (0 = idag) för en stad. */
export type DagAntal = Readonly<Record<number, number>>;

export type TopplistSortering = 'totalt' | 'veckan' | 'helgen' | 'idag' | 'namn';

export const TOPPLIST_SORTERINGAR: readonly { key: TopplistSortering; label: string }[] = [
    { key: 'totalt', label: 'Flest totalt' },
    { key: 'veckan', label: 'Mest i veckan' },
    { key: 'helgen', label: 'Mest i helgen' },
    { key: 'idag', label: 'Mest idag' },
    { key: 'namn', label: 'A-Ö' },
];

/**
 * Antal per stad och dag ur ETT länsflöde. `städer` = länets städer
 * (bara de kan ha sina event i flödet). Passerade dagar räknas inte; dagens
 * event räknas hela dagen (webbens "kommande = idag eller senare").
 */
export function räknaStäderPerDag(
    events: readonly AppFeedEvent[],
    städer: readonly City[],
    nu: Date = new Date(),
): Record<string, Record<number, number>> {
    const ut: Record<string, Record<number, number>> = {};
    const kandidater = utanStoraKällor(events);
    for (const stad of städer) {
        const perDag: Record<number, number> = {};
        for (const e of stadensEvent(kandidater, stad)) {
            const d = dagOffset(e.time, nu);
            if (!Number.isFinite(d) || d < 0) continue;
            perDag[d] = (perDag[d] ?? 0) + 1;
        }
        ut[stad.slug] = perDag;
    }
    return ut;
}

export interface TopplistRad {
    stad: City;
    /** null = länets flöde är inte hämtat än ("-" i raden). */
    idag: number | null;
    helgen: number | null;
    veckan: number | null;
    totalt: number | null;
}

const summa = (perDag: DagAntal, dagar: readonly number[]) => dagar.reduce((s, d) => s + (perDag[d] ?? 0), 0);

/**
 * Raderna i sorteringens ordning. Städer vars siffror inte hämtats än
 * sorteras sist (utom i A-Ö) - listan hoppar på plats när de landar, som
 * webbens mounted-hopp. Lika tal: flest totalt först, sedan namnet.
 */
export function topplistRader(
    städer: readonly City[],
    antal: Readonly<Record<string, DagAntal | undefined>>,
    sortering: TopplistSortering,
    nu: Date = new Date(),
): TopplistRad[] {
    const helg = periodOffsets('helgen', nu) ?? [];
    const vecka = periodOffsets('veckan', nu) ?? [];
    const rader: TopplistRad[] = städer.map(stad => {
        const perDag = antal[stad.slug];
        if (!perDag) return { stad, idag: null, helgen: null, veckan: null, totalt: null };
        let totalt = 0;
        for (const n of Object.values(perDag)) totalt += n;
        return { stad, idag: perDag[0] ?? 0, helgen: summa(perDag, helg), veckan: summa(perDag, vecka), totalt };
    });
    if (sortering === 'namn') return rader.sort((a, b) => svJämför(a.stad.name, b.stad.name));
    const värde = (r: TopplistRad) => r[sortering] ?? -1;
    return rader.sort((a, b) =>
        värde(b) - värde(a)
        || (b.totalt ?? -1) - (a.totalt ?? -1)
        || svJämför(a.stad.name, b.stad.name));
}

/** A-Ö-lägets avdelare: första bokstaven när den skiljer sig från raden ovanför, annars ''. */
export function bokstavsAvdelare(rader: readonly TopplistRad[], i: number): string {
    const bokstav = (r: TopplistRad) => r.stad.name.charAt(0).toUpperCase();
    return i === 0 || bokstav(rader[i - 1]) !== bokstav(rader[i]) ? bokstav(rader[i]) : '';
}
