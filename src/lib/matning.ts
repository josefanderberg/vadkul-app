/**
 * Ren logik för mätningen (data/matning kör den mot Google Analytics för
 * Firebase). Webbens motsvarighet: services/analyticsService.ts (handlingarna)
 * och components/analytics/FirebaseAnalytics.tsx (sidvisningarna).
 *
 * Händelserna heter SAMMA sak som på webben och bär samma parametrar
 * (event_slug, kategori, status …), så webben och apparna går att jämföra
 * rakt av i GA4 - plattformsfiltret skiljer dem åt. Integritetsregeln: aldrig
 * personuppgifter i parametrarna - slugs, kategorier och status, inget mer.
 */

/** GA4 klipper strängvärden över 100 tecken - klipp själva så det är förutsägbart. */
export const PARAM_MAX = 100;

export type Parametrar = Record<string, string | number | boolean>;

/** Parametrarna som de skickas: strängar klippta, tomma värden bortplockade. */
export function tvättaParametrar(p?: Parametrar): Parametrar {
    const ut: Parametrar = {};
    if (!p) return ut;
    for (const [nyckel, värde] of Object.entries(p)) {
        if (värde === undefined || värde === null) continue;
        ut[nyckel] = typeof värde === 'string' ? värde.slice(0, PARAM_MAX) : värde;
    }
    return ut;
}

export interface Skärmvisning { screen_name: string; screen_class: string }

/**
 * Skärmvisningen för en rutt. screen_name = sökvägen (webbens page_path:
 * '/stad/stockholm'), screen_class = rutten med platshållare ('/stad/[slug]',
 * expo-routers segments sammanfogade med '/') så alla stadssidor kan
 * summeras som en skärm i GA:s standardrapport. Frågeparametrar följer inte
 * med (?event= loggas som event_view i stället, som på webben).
 */
export function skärmvisning(pathname: string, rutt: string): Skärmvisning {
    const namn = pathname.startsWith('/') ? pathname : `/${pathname}`;
    const klass = rutt ? `/${rutt.replace(/^\/+/, '')}` : '/';
    return { screen_name: namn.slice(0, PARAM_MAX), screen_class: klass.slice(0, PARAM_MAX) };
}
