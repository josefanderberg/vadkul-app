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
 */
import { PermissionsAndroid, Platform } from 'react-native';
import {
    AuthorizationStatus,
    deleteToken,
    getMessaging,
    getToken,
    hasPermission,
    requestPermission,
} from '@react-native-firebase/messaging';
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

async function sparaToken(uid: string, token: string): Promise<void> {
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
    } catch { /* inget att städa */ }
}

/** Tyst uppfräschning vid inloggning när tillståndet redan finns (webbens
 *  FCMHandler) - tokens roterar, och iOS återkallar dem ibland. */
export async function fräschaUppToken(uid: string): Promise<void> {
    if ((await pushTillstånd()) !== 'på') return;
    try {
        const token = await getToken(getMessaging());
        if (token) await sparaToken(uid, token);
    } catch { /* nästa start försöker igen */ }
}
