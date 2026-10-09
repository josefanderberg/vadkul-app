/**
 * Kartbannrarna i botten-prompt-slotten - port av webbens
 * utils/popularWeekPrompt.ts + utils/zoomInCenter.ts och kart-ui-besluten
 * 30/9 och 1/10 (VECKANS POPULÄRA-BANNERN, ZOOM-BANNERN). Ändras webben ska
 * kopian följa.
 *
 *  - "🔥 Visa alla N populära event i veckan →" när veckan har MER ÄN 5
 *    kommande 🔥 i kartans ruta. Tryck = veckovy + 🔥 på.
 *  - "🔍 Zooma in över {stad} →" när 🔥 är på och kartan står under
 *    titelgränsen (zoom 13). Tryck = flyg till zoom 14,5 över den TÄTASTE
 *    klungan av markörer i orten, inte ortens mittpunkt.
 *
 * De kan aldrig synas samtidigt (🔥 av vs på). Åtgärdsprompterna (lib/
 * kartPrompt) går före båda. Stängda per STAD (✕ eller kartklick).
 */

/** "Mer än 5" populära i veckan i vyn. */
export const POPULÄR_VECKA_MIN = 6;
/** Veckan går att välja från den här zoomen (webbens WEEK_VIEW_MIN_ZOOM). */
export const VECKA_MIN_ZOOM = 9;
/** Titlarna under markörerna syns brett härifrån (webbens LABEL_TITLE_MIN_ZOOM). */
export const TITEL_MIN_ZOOM = 13;
/** Zoom-bannerns mål: titelgränsen + 1,5 (Josef 30/9 kväll: "ännu mer inzoomad"). */
export const ZOOM_IN_MÅL = 14.5;

export type KartBanner =
    | { typ: 'populärVecka'; antal: number }
    | { typ: 'zoomaIn' };

export function kartBanner(s: {
    /** Kommande 🔥 i veckofönstret i kartans ruta (grinden). */
    populäraKommande: number;
    /** Veckoradens tal efter trycket: alla 🔥 i veckan i rutan, även passerade. */
    populäraIVeckan: number;
    populärtPå: boolean;
    /** En opt-in-källa är vald - källornas event är aldrig populära. */
    annatFilter: boolean;
    zoom: number | null;
    stängd: boolean;
}): KartBanner | null {
    if (s.stängd || s.annatFilter || s.zoom === null) return null;
    if (s.populärtPå) return s.zoom < TITEL_MIN_ZOOM ? { typ: 'zoomaIn' } : null;
    if (s.zoom < VECKA_MIN_ZOOM) return null;
    return s.populäraKommande >= POPULÄR_VECKA_MIN ? { typ: 'populärVecka', antal: s.populäraIVeckan } : null;
}

export interface LatLng {
    lat: number;
    lng: number;
}

export const STAD_RADIE_KM = 10;
export const KLUNG_RADIE_KM = 1;

// Ekvirektangulär närmelse - exakt nog på några km, och billig i O(n²)-loopen.
function avståndKm(a: LatLng, b: LatLng): number {
    const kx = 111.32 * Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180);
    const dx = (a.lng - b.lng) * kx;
    const dy = (a.lat - b.lat) * 110.57;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Målzoomen visar bara ~1,5 km tvärs en telefon, så ett genomsnitt av ALLA
 * markörer räcker inte - en ensam i utkanten drar klungan ur bild. Därför:
 * markörerna inom 10 km från orten → den med flest grannar inom 1 km (lika
 * många → närmast ortens mitt) → genomsnittet av dess grannar. Inga
 * markörer i orten → ortens mittpunkt.
 */
export function zoomInMitt(punkter: readonly LatLng[], stad: LatLng): LatLng {
    const nära = punkter.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng) && avståndKm(p, stad) <= STAD_RADIE_KM);
    if (nära.length === 0) return { lat: stad.lat, lng: stad.lng };

    let bäst: LatLng[] = [];
    let bästStadAvstånd = Infinity;
    for (const p of nära) {
        const grannar = nära.filter(q => avståndKm(p, q) <= KLUNG_RADIE_KM);
        const stadAvstånd = avståndKm(p, stad);
        if (grannar.length > bäst.length || (grannar.length === bäst.length && stadAvstånd < bästStadAvstånd)) {
            bäst = grannar;
            bästStadAvstånd = stadAvstånd;
        }
    }
    return {
        lat: bäst.reduce((s, p) => s + p.lat, 0) / bäst.length,
        lng: bäst.reduce((s, p) => s + p.lng, 0) / bäst.length,
    };
}
