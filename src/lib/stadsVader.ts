/**
 * Vädret i stadsplattans dagchip (josefanderberg/VADKUL#237) - reglerna kring
 * plattan, port av webbens apps/web/src/app/(v2)/page.tsx (plattaWeatherPoint
 * och väder-spannet i dagchipet, #202 och #221). Ändras webben ska kopian
 * följa. Själva vädret (tolkningen av SMHI, valet av timme, vad som visas
 * medan en ny ort laddas) räknas av kontraktets smhiWeather - SAMMA kod som
 * webben.
 *
 * Ren modul: hämtningen bor i api/smhi och lib/useStadsVader.
 */
import type { CityWeather } from '@vadkul/kontrakt';
import { nearestCityPoint } from './orter';

export interface Punkt {
    lat: number;
    lng: number;
}

/**
 * Orten vars väder plattan visar: alltid SAMMA ort som plattans namn, aldrig
 * användarens position. Mitt i ett stadshopp är det målets ort (kartans mitt
 * beskriver ännu förra stället), och innan kartan rapporterat sin vy är det
 * startstadens. Hopp och start slås upp till närmaste ort, så adressen till
 * SMHI är densamma före, under och efter hoppet - annars hämtades samma stad
 * två gånger och vädret tonades ner i onödan. null = "Sverige", inget väder.
 */
export function plattansVäderOrt(p: {
    /** Stadshoppets mål, null när inget hopp pågår. */
    hopp: Punkt | null;
    /** Har kartan rapporterat sin vy (mitt och zoom)? */
    kartKlar: boolean;
    /** Kartans ort (lib/kartOrt), null = "Sverige". */
    kartOrt: Punkt | null;
    /** Startstaden - det plattan visar innan kartan är klar. */
    start: Punkt;
}): Punkt | null {
    if (p.hopp) return ortsPunkt(p.hopp);
    if (!p.kartKlar) return ortsPunkt(p.start);
    return p.kartOrt;
}

function ortsPunkt(p: Punkt): Punkt {
    const ort = nearestCityPoint(p.lat, p.lng);
    return { lat: ort.lat, lng: ort.lng };
}

/**
 * Hur starkt vädret ritas (webbens opacity-klasser, #221): ortens egen prognos
 * fullt, förra ortens nedtonad medan den nya hämtas, och utfyllnaden före
 * första svaret osynlig - den håller bara platsen så dagchipet inte byter
 * bredd.
 */
export function väderOpacitet(state: CityWeather['state']): number {
    return state === 'fresh' ? 1 : state === 'stale' ? 0.5 : 0;
}

/**
 * Plattans text för skärmläsare. Vädret läses BARA när det är ortens eget
 * ('fresh') - förra ortens väder och utfyllnaden är inte fakta om orten som
 * står i plattan.
 */
export function plattansLästext(ort: string, dag: string, väder: CityWeather | null): string {
    const grund = `${ort}, ${dag}`;
    return väder?.state === 'fresh' ? `${grund}. Väder: ${väder.text}, ${väder.temp} (SMHI)` : grund;
}
