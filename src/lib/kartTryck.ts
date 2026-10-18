/**
 * Vilken bricka ett tryck på kartan träffade (Josef 13/10: "när jag klickar
 * på eventmarkören så markerar den inte den. men om jag klickar lite ner åt
 * vänster då markeras den"). MapLibres källa-onPress matchade trycket mot
 * symbolernas träffrutor och missade den synliga brickan - samma läxa som
 * webben (kart-ui: "queryRenderedFeatures är OPÅLITLIG", all träff via
 * pickHoverKey, aldrig e.features). Här räknas träffen själv: brickans spets
 * projiceras till skärmen (MapRef.project, exakt även roterat och lutat) och
 * trycket jämförs mot brickans SYNLIGA kropp ovanför spetsen. Brickorna står
 * alltid upprätt på skärmen (icon-rotation/pitch-alignment viewport), så
 * rutan är rak i skärmpunkter. Ren logik så den kan testas.
 */
import { BADGE_X, BADGE_Y } from './brickor';

/** Kroppens halva bredd i pt (40 pt bred) plus lite fingermån. */
export const KROPP_HALV_BREDD = 24;
/** Kroppens topp ovanför spetsen (cirkeln når 55 pt) plus fingermån. */
export const KROPP_HÖJD = 60;
/** Fingermån under spetsen. */
export const KROPP_UNDER = 6;
/** "+N"-badgens träffradie runt dess mitt. */
export const BADGE_RADIE = 13;
/** Förfiltrets radie i pt: längre bort från spetsen än så kan inget träffa
 *  (kroppen når 60 pt upp) - marginal för lutad karta. */
export const FÖRFILTER_PT = 110;

export type Kandidat = {
    id: string;
    /** Ritordningen (symbolSortKey) - högst ritas överst och vinner. */
    sort: number;
    /** Har "+N"-badge (grupp) - badgen är också en träffyta. */
    grupp: boolean;
    /** Spetsens skärmpunkt. */
    x: number;
    y: number;
};

/** Brickan trycket (tx, ty) träffade, eller null = tom karta. Flera träffar:
 *  den som ritas överst (högst sort), vid lika den vars kropp ligger
 *  närmast trycket. */
export function träffadBricka(kandidater: readonly Kandidat[], tx: number, ty: number): string | null {
    let bäst: { id: string; sort: number; avstånd: number } | null = null;
    for (const k of kandidater) {
        const rx = tx - k.x;
        const ry = ty - k.y;
        const iKropp = Math.abs(rx) <= KROPP_HALV_BREDD && ry >= -KROPP_HÖJD && ry <= KROPP_UNDER;
        const iBadge = k.grupp && Math.hypot(rx - BADGE_X, ry + BADGE_Y) <= BADGE_RADIE;
        if (!iKropp && !iBadge) continue;
        // Avståndet till kroppens mitt (cirkeln ~35 pt ovanför spetsen).
        const avstånd = Math.hypot(rx, ry + 35);
        if (!bäst || k.sort > bäst.sort || (k.sort === bäst.sort && avstånd < bäst.avstånd)) {
            bäst = { id: k.id, sort: k.sort, avstånd };
        }
    }
    return bäst?.id ?? null;
}

/** Prickens träffradie i pt: pricken är 5-9 pt bred, resten är fingermån. */
export const PRICK_RADIE = 16;

/** Pricken (lib/kartUrval) trycket träffade - den närmaste inom
 *  PRICK_RADIE från prickens mitt, annars null. Prövas efter brickorna:
 *  en bricka som står ovanpå en prick vinner alltid. */
export function träffadPrick(kandidater: readonly Pick<Kandidat, 'id' | 'x' | 'y'>[], tx: number, ty: number): string | null {
    let bäst: { id: string; avstånd: number } | null = null;
    for (const k of kandidater) {
        const avstånd = Math.hypot(tx - k.x, ty - k.y);
        if (avstånd > PRICK_RADIE) continue;
        if (!bäst || avstånd < bäst.avstånd) bäst = { id: k.id, avstånd };
    }
    return bäst?.id ?? null;
}

/** Ungefärligt avstånd i pt mellan två punkter vid en zoom (Web Mercator,
 *  512 pt-rutor som MapLibre). Rotation ändrar inte avstånd - bara
 *  förfiltret använder det, den exakta träffen går via project(). */
export function avståndPt(
    a: { lng: number; lat: number },
    b: { lng: number; lat: number },
    zoom: number,
): number {
    const världen = 512 * 2 ** zoom;
    const merY = (lat: number) => {
        const r = (lat * Math.PI) / 180;
        return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2;
    };
    const dx = ((a.lng - b.lng) / 360) * världen;
    const dy = (merY(a.lat) - merY(b.lat)) * världen;
    return Math.hypot(dx, dy);
}
