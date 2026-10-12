/**
 * Kraschrapportering via @react-native-firebase/crashlytics (samma
 * Firebase-projekt som firestore/storage/messaging). Plattformsplanen §7:
 * kraschrapportering från fas 2.
 *
 * Vad som fångas:
 * - Native-krascher: Crashlytics-SDK:t själv, från appstart.
 * - Ofångade JS-fel och ohanterade promise-avslag: RNFB installerar en global
 *   felhanterare när modulen skapas - därför anropas `startaKraschrapportering`
 *   på modulnivå i app/_layout, innan något hinner renderas.
 * - Renderfel som rotens felgräns fångar (de når aldrig den globala
 *   hanteraren): `rapporteraFel` från ErrorBoundary i app/_layout.
 *
 * Dev-byggen (Debug) skickar ingenting - RNFB:s standard
 * (crashlytics_debug_enabled = false), så bara TestFlight/butiksbyggen syns
 * i konsolen.
 *
 * Integritet: inga loggar med innehåll, bara uid när man är inloggad på
 * riktigt (lib/krasch). Allt här är best-effort - kraschrapporteringen får
 * aldrig själv krascha appen.
 */
import {
    getCrashlytics,
    log,
    recordError,
    setAttributes,
    setUserId,
} from '@react-native-firebase/crashlytics';
import * as Updates from 'expo-updates';
import { somFel, uppdateringsAttribut } from '@/lib/krasch';

/** Skapar modulen (= installerar JS-felhanterarna) och märker JS-paketet. */
export function startaKraschrapportering(): void {
    try {
        const c = getCrashlytics();
        setAttributes(c, uppdateringsAttribut({
            updateId: Updates.updateId,
            channel: Updates.channel,
            runtimeVersion: Updates.runtimeVersion,
            isEmbeddedLaunch: Updates.isEmbeddedLaunch,
        })).catch(() => {});
    } catch {
        // Native-modulen saknas (t.ex. ett bygge från före build 7) - kör vidare utan.
    }
}

/** uid på rapporterna när man är inloggad; null (utloggad ELLER anonym) tömmer id:t. */
export function sättKraschAnvändare(uid: string | null): void {
    try {
        setUserId(getCrashlytics(), uid ?? '').catch(() => {});
    } catch {
        // se startaKraschrapportering
    }
}

/** Icke-dödligt fel till Crashlytics. `källa` är en fast etikett, aldrig data. */
export function rapporteraFel(e: unknown, källa: string): void {
    try {
        const c = getCrashlytics();
        log(c, `källa: ${källa}`);
        recordError(c, somFel(e));
    } catch {
        // se startaKraschrapportering
    }
}
