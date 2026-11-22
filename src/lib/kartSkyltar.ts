/**
 * Platsskyltarna på appens karta (VADKUL#216, #225; hit i #234, Josef 14/11:
 * apparna ska bli som webben, "med moln och skyltar för badplats osv"):
 * vägmärken för badplatser, museer, bibliotek, naturreservat, golfbanor,
 * lekplatser, idrottsplaner och parker, sedan #241 även bio, teater, arena,
 * idrottsanläggning (#231), restaurang och kafé (#242).
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
 *     ur baskartans egna kakel.
 *  2. Rutan vid tryck är en egen vy (components/SkyltRuta) i stället för
 *     MapLibres popup.
 *
 * ETT ZOOMSTEG TIDIGARE ÄN WEBBEN (#251, ägarbeslut 15/11, Josef: "skyltarna
 * hade kunnat visas snäppet tidigare på iphone. jag måste zooma in så mycket
 * annars för att de ska dyka upp. blir bättre så på en mobil"): en telefon
 * visar mycket mindre yta på samma zoom. Resmålen (bad, naturreservat, golf,
 * museum, bibliotek, bio, teater, arena) tänds från zoom 12 med namn från
 * 13,5, kvarterets skyltar (idrott, lekplats, plan, park) från 14 och
 * restaurang och kafé från 15. Kaklen sätter golvet: mätt 15/11 i centrala
 * Växjö och Göteborg bär CARTO-kaklen bio, teater, lekplats, restaurang och
 * kafé först på z15, och z14 bara några museer, bibliotek, parker,
 * idrottsanläggningar och restauranger. Under sin kakelzoom syns en skylt
 * alltså inte hur lågt lagret än börjar.
 *
 * BADPLATSERNA FRÅN ZOOM 9, SOM PÅ WEBBEN (josefanderberg/VADKUL#279, Josef
 * 22/11: "badplatser syns bara när man zoomar in jättemycket. Fixa så det är
 * mycket högre upp synligt"): badskylten ritas ur webbens badplatsfil
 * (https://vadkul.se/badplatser.json, byggd av nattkedjan ur OSM) i stället för
 * ur kaklen, som bär badplatserna först från z13. Kontraktet lägger källan och
 * lagret och tar bort baden ur kakellagret, så ingen skylt står dubbelt.
 * Zoom 9 är Josefs val och gäller både webb och app (inte ett steg tidigare
 * här, som de andra skyltarna).
 *
 * Ren, React-fri modul (testas i vitest utan nät).
 */
import {
    addPoiSignLayers, BADPLATS_DATA_PATH, POI_SIGN_CLOSE_MIN_ZOOM, POI_SIGN_HIT, POI_SIGN_LAYER_ID, POI_SIGN_MIN_ZOOM, POI_SIGN_NAME_ZOOM,
    POI_SIGN_NEAR_MIN_ZOOM, poiSignInfo, type PoiSignInfo, type PoiSignStyle,
} from '@vadkul/kontrakt';
import { SKYLT_BILD } from './skyltMatt.generated';
import type { StyleJson } from './themeParkStyle';

/** Bilden är bakad i SKYLT_BILD.täthet gånger webbens mått - lagret skalar ner lika mycket. */
export const SKYLT_SKALA = 1 / SKYLT_BILD.täthet;

/** Hur många zoomsteg tidigare än webben skyltarna tänds i appen (#251). */
export const SKYLT_TIDIGARE = 1;
/** Resmålens startzoom i appen - under den finns inga skyltar att trycka på. */
export const SKYLT_MIN_ZOOM = POI_SIGN_MIN_ZOOM - SKYLT_TIDIGARE;
export const SKYLT_NAMN_ZOOM = POI_SIGN_NAME_ZOOM - SKYLT_TIDIGARE;
export const SKYLT_NÄRA_ZOOM = POI_SIGN_NEAR_MIN_ZOOM - SKYLT_TIDIGARE;
export const SKYLT_NÄRMAST_ZOOM = POI_SIGN_CLOSE_MIN_ZOOM - SKYLT_TIDIGARE;
/** Badplatsfilen på webben (#279). Hel adress - native-koden hämtar den. */
export const BADPLATS_URL = 'https://vadkul.se' + BADPLATS_DATA_PATH;

/** Lägg skyltlagren i stilen (muterar den - anropas på transformens egen kopia). */
export function läggTillSkyltar(style: StyleJson): boolean {
    return addPoiSignLayers(style as unknown as PoiSignStyle, {
        iconScale: SKYLT_SKALA,
        minZoom: SKYLT_MIN_ZOOM,
        nameZoom: SKYLT_NAMN_ZOOM,
        nearMinZoom: SKYLT_NÄRA_ZOOM,
        closeMinZoom: SKYLT_NÄRMAST_ZOOM,
        badData: BADPLATS_URL,
    });
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
