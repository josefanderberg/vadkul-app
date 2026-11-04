/**
 * Mätning via @react-native-firebase/analytics - Google Analytics för
 * Firebase, SAMMA GA4-egendom som webben (projektet vadkul-f2cb2). Port av
 * webbens services/analyticsService.ts (handlingarna) och components/
 * analytics/FirebaseAnalytics.tsx (sidvisningarna, här skärmvisningar).
 *
 * Före 4/11 2026 fanns ingen analytics-modul alls i appen (bara
 * Crashlytics), så Firebase-konsolen hade ingen iOS-/Android-statistik.
 *
 * Vad som samlas:
 * - SDK:ts automatiska händelser (first_open, session_start, app_update …)
 *   - de är underlaget för konsolens användartal per plattform.
 * - screen_view per rutt (app/_layout → MätSkärm): screen_name = sökvägen,
 *   screen_class = rutten med platshållare (lib/matning).
 * - Handlingarna med webbens namn och parametrar: event_view,
 *   event_anmal_click, event_like, event_rsvp (data/eventStats),
 *   event_create (data/egnaEvent), event_wish (data/onskningar),
 *   star_placed (data/stjarnor), invite_share (data/vanner) och introts
 *   welcome_* och startstad_* (app/intro).
 *
 * Dev-byggen mäter inte (setAnalyticsCollectionEnabled(false) - webben
 * hoppar över analytics lokalt på samma sätt), så bara TestFlight-/butiks-
 * byggen syns i konsolen. Inget användar-id sätts (webben sätter inget), och
 * iOS byggs utan annons-id (app.json: withoutAdIdSupport) - ingen IDFA, ingen
 * ATT-prompt. Deklarationerna bor i huvudrepots docs/app-store-butik.md och
 * docs/google-play-butik.md.
 *
 * Allt är fire-and-forget som eventStats-räknarna: mätningen får ALDRIG
 * störa handlingen, och saknas native-modulen (ett bygge från före analytics
 * kom in - OTA når sådana) körs appen vidare utan.
 */
import {
    getAnalytics,
    logEvent,
    logScreenView,
    setAnalyticsCollectionEnabled,
} from '@react-native-firebase/analytics';
import { skärmvisning, tvättaParametrar, type Parametrar } from '@/lib/matning';

/** Dev-byggen mäter inte. Flaggan sätts om vid varje start, så en dev-klient
 *  som stängt av insamlingen på enheten slår inte igenom i nästa butiksbygge. */
const MÄTNING_PÅ = !__DEV__;

/** Slår på/av insamlingen efter byggtyp. Anropas på modulnivå i app/_layout. */
export function startaMätning(): void {
    try {
        setAnalyticsCollectionEnabled(getAnalytics(), MÄTNING_PÅ).catch(() => {});
    } catch {
        // Native-modulen saknas (ett bygge från före analytics kom in) - kör vidare utan.
    }
}

/** En handling - webbens track(). Namn och parametrar som på webben. */
export function spåra(namn: string, parametrar?: Parametrar): void {
    if (!MÄTNING_PÅ) return;
    try {
        logEvent(getAnalytics(), namn, tvättaParametrar(parametrar));
    } catch {
        // se startaMätning - eller ett namn SDK:t avvisar; får aldrig fälla handlingen
    }
}

/** En skärmvisning per ruttbyte (webbens page_view). `rutt` = segments.join('/'). */
export function spåraSkärm(pathname: string, rutt: string): void {
    if (!MÄTNING_PÅ) return;
    try {
        logScreenView(getAnalytics(), skärmvisning(pathname, rutt)).catch(() => {});
    } catch {
        // se startaMätning
    }
}
