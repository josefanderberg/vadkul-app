/**
 * Kartplattans ortsnamn - port av webbens liveCityName (app/(v2)/page.tsx,
 * Josef 10/8: "bor man i Hudiksvall ska rutan säga Hudiksvall"; appen 13/10:
 * "när jag tar mig över kartan så står det fortfarande kvar växjö även om jag
 * är över göteborg"). Närmaste ort (lib/orter) till kartans mitt, räknad när
 * kartan stannat. Utzoomat förbi stadsnivå, eller inzoomat i ödemark långt
 * från närmaste ort, finns ingen ärlig stad - då står det "Sverige" (null).
 */
import { nearestCityPoint, type CityPoint } from './orter';
import { distanceKm } from './regionVal';

/** Under den zoomen täcker vyn halva landskap - ingen stad (webbens CITY_NAME_MIN_ZOOM). */
export const ORT_MIN_ZOOM = 8;
/** Längre än så från närmaste ort är namnet en lögn (webbens CITY_NAME_MAX_KM). */
export const ORT_MAX_KM = 60;

/** Kartans mitt ur rutan [väst, syd, öst, nord] - samma mitt som skapa-knappen. */
export function rutansMitt(ruta: readonly number[]): { lat: number; lng: number } {
    return { lat: (ruta[1] + ruta[3]) / 2, lng: (ruta[0] + ruta[2]) / 2 };
}

/** Orten plattan ska visa, null = "Sverige". */
export function kartansOrt(mitt: { lat: number; lng: number }, zoom: number): CityPoint | null {
    if (zoom < ORT_MIN_ZOOM) return null;
    const ort = nearestCityPoint(mitt.lat, mitt.lng);
    return distanceKm(mitt.lat, mitt.lng, ort.lat, ort.lng) > ORT_MAX_KM ? null : ort;
}
