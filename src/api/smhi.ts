/**
 * Hämtningen av SMHI:s punktprognos till stadsplattans väder
 * (josefanderberg/VADKUL#237) - appens motsvarighet till fetch-raden i
 * webbens apps/web/src/hooks/useCityWeather.ts. Telefonen hämtar direkt från
 * SMHI:s öppna API (gratis, ingen nyckel, CC BY 4.0 - krediteras i profilens
 * Om-ruta), ingen server hos oss. Adressen bär bara ORTENS koordinater
 * (kontraktets smhiPointUrl), aldrig användarens position.
 *
 * Tolkningen och minnet kring hämtningen bor i kontraktets smhiWeather
 * (createSmhiLoader): null härifrån = SMHI saknar orten, ett kast = nätfel
 * som får försöka igen snart.
 */

/**
 * Så länge får SMHI på sig. Androids nätlager har ingen egen tidsgräns - en
 * hängd anslutning skulle annars hålla ortens hämtning öppen för alltid, och
 * plattan stod utan väder tills appen startades om.
 */
export const SMHI_TIMEOUT_MS = 15_000;

/** Prognosens JSON, null när SMHI inte har orten. Kastar vid nätfel och tidsgräns. */
export async function hämtaSmhi(url: string): Promise<unknown> {
    const avbryt = new AbortController();
    const klocka = setTimeout(() => avbryt.abort(), SMHI_TIMEOUT_MS);
    try {
        const res = await fetch(url, { headers: { accept: 'application/json' }, signal: avbryt.signal });
        return res.ok ? await res.json() : null;
    } finally {
        clearTimeout(klocka);
    }
}
