/**
 * Vädret för stadsplattan (josefanderberg/VADKUL#237) - port av webbens
 * apps/web/src/hooks/useCityWeather.ts. SMHI:s punktprognos för ORTEN i
 * plattan (aldrig användarens position), vald för plattans dag.
 *
 * Allt som räknas bor i kontraktets smhiWeather - samma kod som webben:
 * en prognos per ort hålls i minnet en halvtimme, medan en ny ort hämtas står
 * förra ortens väder kvar ('stale'), och före allra första svaret ges en
 * utfyllnad ('pending') så dagchipet inte byter bredd (#221). Svarar SMHI
 * inte, eller ligger orten utanför deras område, visas inget.
 *
 * Skillnaden mot webben: klockan. Webben tickar själv var tionde minut; här
 * skickas kartans `nuMs` in (lib/useNu - en gång i minuten och direkt när
 * appen väcks), så en app som legat i bakgrunden över natten frågar om
 * prognosen i första bildrutan. Varje tick är bara ett uppslag i minnet -
 * SMHI nås högst en gång per halvtimme och ort.
 */
import { useEffect, useMemo, useState } from 'react';
import { cityWeatherFor, createSmhiLoader, smhiPointUrl, type CityWeather, type WeatherStep } from '@vadkul/kontrakt';
import { hämtaSmhi } from '@/api/smhi';

const ladda = createSmhiLoader(hämtaSmhi);

/**
 * Vädret för `ort` på dag `dagOffset` (0 = idag), eller null. `ort` null eller
 * `på` false = ingen hämtning och inget väder. Läs `state` innan värdet
 * används som fakta (lib/stadsVader plattansLästext).
 */
export function useStadsVader(
    ort: { lat: number; lng: number } | null,
    dagOffset: number,
    på: boolean,
    nuMs: number,
): CityWeather | null {
    const url = på && ort ? smhiPointUrl(ort.lat, ort.lng) : null;
    const [inläst, setInläst] = useState<{ url: string; steps: WeatherStep[] } | null>(null);

    useEffect(() => {
        if (!url) return;
        let lever = true;
        ladda(url).then(steps => {
            if (!lever) return;
            // Minnet lämnar samma lista tillbaka tills prognosen hämtats om -
            // då behålls tillståndet, och minuttickarna ritar inte om plattan.
            setInläst(förra => (förra && förra.url === url && förra.steps === steps ? förra : { url, steps }));
        });
        return () => {
            lever = false;
        };
    }, [url, nuMs]);

    return useMemo(() => cityWeatherFor(url, inläst, dagOffset, new Date(nuMs)), [url, inläst, dagOffset, nuMs]);
}
