/**
 * Platsskyltarna på appens karta (VADKUL#216, #225; hit i #234, Josef 14/11:
 * apparna ska bli som webben, "med moln och skyltar för badplats osv"):
 * vägmärken för badplatser, museer, bibliotek, naturreservat, golfbanor,
 * lekplatser, idrottsplaner och parker.
 *
 * Vilka skyltar som finns, vad de heter, när de tänds, hur lagren ser ut och
 * vilken skylt ett tryck träffar bestäms av kontraktets `poiSigns` - SAMMA kod
 * som webben, så en ändring görs i huvudrepot och hämtas med
 * `npm run kontrakt:sync`, aldrig här. Bilderna bakas med webbens ritkod
 * (scripts/baka-skyltar.mjs -> assets/skyltar/ + skylt*.generated.ts).
 *
 * TVÅ SKILLNADER MOT WEBBEN, båda påtvingade:
 *  1. Webben hämtar skyltarnas punkter ur kakel ett zoomsteg djupare (#222)
 *     bakom ett eget kakelprotokoll som appens MapLibre saknar. Här ritas de
 *     ur baskartans egna kakel: bad, naturreservat, golf, museum och bibliotek
 *     från zoom 13 (webben 12), namn från 14,5; lekplats, idrottsplan och park
 *     från 15 som på webben.
 *  2. Rutan vid tryck är en egen vy (components/SkyltRuta) i stället för
 *     MapLibres popup.
 *
 * Ren, React-fri modul (testas i vitest utan nät).
 */
import { addPoiSignLayers, POI_SIGN_HIT, POI_SIGN_LAYER_ID, poiSignInfo, type PoiSignInfo, type PoiSignStyle } from '@vadkul/kontrakt';
import { SKYLT_BILD } from './skyltMatt.generated';
import type { StyleJson } from './themeParkStyle';

/** Bilden är bakad i SKYLT_BILD.täthet gånger webbens mått - lagret skalar ner lika mycket. */
export const SKYLT_SKALA = 1 / SKYLT_BILD.täthet;

/** Lägg skyltlagren i stilen (muterar den - anropas på transformens egen kopia). */
export function läggTillSkyltar(style: StyleJson): boolean {
    return addPoiSignLayers(style as unknown as PoiSignStyle, { iconScale: SKYLT_SKALA });
}

/** Har stilen skyltlagren? Reservstilen (ren Voyager vid nätfel) har dem inte. */
export function harSkyltar(style: StyleJson | string): boolean {
    return typeof style !== 'string' && (style.layers?.some(l => l.id === POI_SIGN_LAYER_ID) ?? false);
}

// ── Tryck på en skylt ────────────────────────────────────────────────────────

export interface SkyltKandidat {
    info: PoiSignInfo;
    lngLat: [number, number];
}

/**
 * Rutan kartan frågas om kring ett tryck: var en träffad skylts fot kan stå
 * (plattan ligger ovanför foten, namnet under). Samma ruta som webbens
 * v2MapPoiSignPopup.
 */
export function skyltFrågeruta(x: number, y: number): [[number, number], [number, number]] {
    return [
        [x - POI_SIGN_HIT.halfWidth, y - POI_SIGN_HIT.below],
        [x + POI_SIGN_HIT.halfWidth, y + POI_SIGN_HIT.above],
    ];
}

/**
 * Skyltarna bland kartans träffar: punkter vars platstyp har en skylt.
 * Kartans svar används aldrig rakt av - varje kandidat räknas sedan om från
 * sin egen koordinat och prövas mot trycket (kontraktets pickPoiSignHit), så
 * skräpträffar faller bort där.
 */
export function skyltKandidater(features: readonly GeoJSON.Feature[]): SkyltKandidat[] {
    const ut: SkyltKandidat[] = [];
    for (const f of features) {
        if (f.geometry?.type !== 'Point') continue;
        const info = poiSignInfo(f.properties?.kind, f.properties?.name);
        if (!info) continue;
        const [lng, lat] = f.geometry.coordinates;
        if (typeof lng !== 'number' || typeof lat !== 'number') continue;
        ut.push({ info, lngLat: [lng, lat] });
    }
    return ut;
}
