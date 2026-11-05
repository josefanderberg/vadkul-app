/**
 * Push via FCM (@react-native-firebase/messaging) - samma token-samling som
 * webben (fcmTokens/{uid}/tokens/{token}, webbens notificationService), så
 * hela sändkedjan i functions (påminnelsen 1 h före, helgtipset) når appen.
 * Tokens märks `platform: 'ios' | 'android'`: functions skickar en riktig
 * notis-payload till dem (webbens data-only-meddelanden ritas av service
 * workern - en native app visar dem aldrig).
 *
 * Av/på är PER ENHET som på webben: av = enhetens token raderas ur kontot
 * och hos FCM. Tillståndsfrågan får bara ställas efter ett riktigt tryck.
 *
 * TOKENEN HÅLLS VID LIV (5/11 2026: Josefs iPhone hade ingen token på något
 * konto fast reglaget stod på - det visar bara iOS-tillståndet). Rotlayouten
 * sparar enhetens token på kontot vid inloggning, när appen kommer fram och
 * när FCM byter token; utloggning tar bort den från det gamla kontot.
 */
import { PermissionsAndroid, Platform } from 'react-native';
import {
    AuthorizationStatus,
    deleteToken,
    getInitialNotification,
    getMessaging,
    getToken,
    hasPermission,
    onNotificationOpenedApp,
    onTokenRefresh,
    requestPermission,
} from '@react-native-firebase/messaging';
import { notisMål } from '@/lib/notisMal';
import { deleteDoc, doc, getFirestore, serverTimestamp, setDoc } from '@react-native-firebase/firestore';

const tokenDoc = (uid: string, token: string) => doc(getFirestore(), 'fcmTokens', uid, 'tokens', token);

export type PushTillstånd = 'på' | 'nekad' | 'ej-frågad';

const tillåten = (s: number) => s === AuthorizationStatus.AUTHORIZED || s === AuthorizationStatus.PROVISIONAL;

/** Vad systemet säger just nu (utan att fråga). */
export async function pushTillstånd(): Promise<PushTillstånd> {
    try {
        if (Platform.OS === 'android' && Platform.Version >= 33) {
            const ok = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
            return ok ? 'på' : 'ej-frågad';
        }
        const s = await hasPermission(getMessaging());
        if (tillåten(s)) return 'på';
        return s === AuthorizationStatus.DENIED ? 'nekad' : 'ej-frågad';
    } catch {
        return 'ej-frågad';
    }
}

/** uid|token som senast skrevs - samma par skrivs inte om vid varje väckning. */
let senastSparad: string | null = null;

async function sparaToken(uid: string, token: string): Promise<void> {
    senastSparad = `${uid}|${token}`;
    await setDoc(tokenDoc(uid, token), {
        token,
        platform: Platform.OS,
        userAgent: `VADKUL-app ${Platform.OS}`,
        createdAt: serverTimestamp(),
    });
}

/** Slå PÅ på den här enheten: fråga (efter ett tryck), hämta token, spara på kontot. */
export async function slåPåPush(uid: string): Promise<'på' | 'nekad' | 'fel'> {
    try {
        if (Platform.OS === 'android' && Platform.Version >= 33) {
            const svar = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
            if (svar !== PermissionsAndroid.RESULTS.GRANTED) return 'nekad';
        } else {
            const s = await requestPermission(getMessaging());
            if (!tillåten(s)) return 'nekad';
        }
        const token = await getToken(getMessaging());
        if (!token) return 'fel';
        await sparaToken(uid, token);
        return 'på';
    } catch {
        return 'fel';
    }
}

/** Slå AV på den här enheten: tokenen bort ur kontot och hos FCM. */
export async function slåAvPush(uid: string): Promise<void> {
    try {
        const token = await getToken(getMessaging());
        if (token) await deleteDoc(tokenDoc(uid, token)).catch(() => {});
        await deleteToken(getMessaging());
        senastSparad = null;
    } catch { /* inget att städa */ }
}

/** Tyst uppfräschning när tillståndet redan finns (webbens FCMHandler) -
 *  tokens roterar, iOS återkallar dem ibland, och en token sparad på ett
 *  annat konto når aldrig det här. Skriver bara när paret är nytt. */
export async function fräschaUppToken(uid: string): Promise<void> {
    if ((await pushTillstånd()) !== 'på') return;
    try {
        const token = await getToken(getMessaging());
        if (token && senastSparad !== `${uid}|${token}`) await sparaToken(uid, token);
    } catch {
        senastSparad = null; // nästa väckning försöker igen
    }
}

/** FCM bytte enhetens token: spara den nya på kontot direkt. */
export function lyssnaPåNyToken(uid: string): () => void {
    try {
        return onTokenRefresh(getMessaging(), token => {
            void (async () => {
                if ((await pushTillstånd()) !== 'på') return;
                await sparaToken(uid, token).catch(() => { senastSparad = null; });
            })();
        });
    } catch {
        return () => {};
    }
}

/** Före utloggning/radering: enhetens token bort från kontot (FCM-tokenen
 *  behålls, nästa konto som loggar in sparar den på sig). */
export async function släppEnhetensToken(uid: string): Promise<void> {
    try {
        const token = await getToken(getMessaging());
        if (token) await deleteDoc(tokenDoc(uid, token));
    } catch { /* rules eller nät - kontot städas av functions när tokenen dör */ }
    senastSparad = null;
}

/** Tryck på en notis (appen stängd eller i bakgrunden) → rätt skärm
 *  (lib/notisMal). Returnerar avregistreringen. */
export function lyssnaPåNotisTryck(öppna: (mål: string) => void): () => void {
    try {
        const m = getMessaging();
        void getInitialNotification(m)
            .then(msg => {
                const mål = notisMål(msg?.data);
                if (mål) öppna(mål);
            })
            .catch(() => {});
        return onNotificationOpenedApp(m, msg => {
            const mål = notisMål(msg?.data);
            if (mål) öppna(mål);
        });
    } catch {
        return () => {};
    }
}
