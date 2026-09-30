/**
 * Kontot i appen (plattformsplanens fas 3): Firebase Auth via
 * @react-native-firebase (sessionen ligger i nyckelringen/Keystore - aldrig
 * i AsyncStorage) och profilen via API:t v1. Samma konton som webben: ett
 * konto skapat här loggar in på vadkul.se och tvärtom.
 *
 * Inloggningssätt (ägarbeslut 29/9): e-post + lösenord och Google överallt,
 * Sign in with Apple på iOS (Apples regel 4.8 när Google finns).
 *
 * Profilen är best-effort precis som webbens registrering: kontot ÄR skapat
 * när Firebase svarat, och ett API-hicka får inte få registreringen att se
 * misslyckad ut - kontoskärmen erbjuder "Om dig" igen när profilen saknas.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import {
    AppleAuthProvider,
    createUserWithEmailAndPassword,
    getAuth,
    getIdToken,
    GoogleAuthProvider,
    onAuthStateChanged,
    sendPasswordResetEmail,
    signInWithCredential,
    signInWithEmailAndPassword,
    signOut,
    updateProfile,
    type User,
} from '@react-native-firebase/auth';
import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { MeProfil, MeProfilIn } from '@vadkul/kontrakt';
import { hämtaProfil, raderaKontot, sparaProfil } from '@/api/konto';

/** OAuth-webbklienten i Firebase-projektet - Android behöver den för att få
 *  ett idToken som Firebase godtar (publikt värde, står i google-services.json). */
const GOOGLE_WEBB_KLIENT = '888495806926-uj2bn4r5cpth2f2vfl561mi9equ7rcce.apps.googleusercontent.com';

GoogleSignin.configure({ webClientId: GOOGLE_WEBB_KLIENT });

export interface Användare {
    uid: string;
    email: string | null;
    displayName: string | null;
}

export interface KontoState {
    /** undefined = Firebase har inte svarat än; null = utloggad. */
    användare: Användare | null | undefined;
    profil: MeProfil | null;
    profilLaddar: boolean;
    /** Inloggad men profilen saknar namn - "Om dig"-steget ska erbjudas. */
    behöverProfil: boolean;
    appleFinns: boolean;
    registrera: (namn: string, email: string, lösen: string) => Promise<void>;
    loggaIn: (email: string, lösen: string) => Promise<void>;
    loggaInGoogle: () => Promise<boolean>;
    loggaInApple: () => Promise<boolean>;
    glömtLösen: (email: string) => Promise<void>;
    sparaProfil: (input: MeProfilIn) => Promise<void>;
    loggaUt: () => Promise<void>;
    raderaKonto: () => Promise<void>;
}

const KontoContext = createContext<KontoState | null>(null);

const tillAnvändare = (u: User | null): Användare | null =>
    u ? { uid: u.uid, email: u.email, displayName: u.displayName } : null;

export function KontoProvider({ children }: { children: ReactNode }) {
    const auth = getAuth();
    const qc = useQueryClient();
    const [användare, setAnvändare] = useState<Användare | null | undefined>(undefined);
    const [appleFinns, setAppleFinns] = useState(false);

    useEffect(() => onAuthStateChanged(auth, u => setAnvändare(tillAnvändare(u))), [auth]);
    useEffect(() => {
        if (Platform.OS !== 'ios') return;
        AppleAuthentication.isAvailableAsync().then(setAppleFinns).catch(() => setAppleFinns(false));
    }, []);

    const token = useCallback(async () => {
        const u = auth.currentUser;
        if (!u) throw new Error('Inte inloggad');
        return getIdToken(u);
    }, [auth]);

    const profilQuery = useQuery({
        queryKey: ['me', användare?.uid ?? null],
        queryFn: async () => hämtaProfil(await token()),
        enabled: !!användare,
        staleTime: 5 * 60 * 1000,
        retry: 1,
    });
    const profil = användare ? profilQuery.data ?? null : null;

    const spara = useCallback(async (input: MeProfilIn) => {
        const ny = await sparaProfil(await token(), input);
        qc.setQueryData(['me', ny.uid], ny);
        if (input.displayName && auth.currentUser) setAnvändare(tillAnvändare(auth.currentUser));
    }, [token, qc, auth]);

    const registrera = useCallback(async (namn: string, email: string, lösen: string) => {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), lösen);
        if (namn.trim()) {
            await updateProfile(cred.user, { displayName: namn.trim() });
            setAnvändare(tillAnvändare(cred.user));
        }
        // Best effort - kontot finns redan, "Om dig" tar igen det som saknas.
        await spara({ displayName: namn.trim() || undefined }).catch(() => {});
    }, [auth, spara]);

    const loggaIn = useCallback(async (email: string, lösen: string) => {
        await signInWithEmailAndPassword(auth, email.trim(), lösen);
    }, [auth]);

    /** false = användaren avbröt. */
    const loggaInGoogle = useCallback(async () => {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
        const svar = await GoogleSignin.signIn();
        if (!isSuccessResponse(svar)) return false;
        const idToken = svar.data.idToken;
        if (!idToken) throw new Error('Google gav inget idToken');
        await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
        return true;
    }, [auth]);

    const loggaInApple = useCallback(async () => {
        // Nonce: Apple får hashen, Firebase råvärdet - så ingen kan återanvända
        // Apples token mot vårt projekt.
        const råNonce = Crypto.randomUUID();
        const hashad = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, råNonce);
        const svar = await AppleAuthentication.signInAsync({
            requestedScopes: [
                AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                AppleAuthentication.AppleAuthenticationScope.EMAIL,
            ],
            nonce: hashad,
        });
        if (!svar.identityToken) throw new Error('Apple gav ingen identityToken');
        const cred = await signInWithCredential(auth, AppleAuthProvider.credential(svar.identityToken, råNonce));
        // Apple skickar namnet BARA första gången - spara det direkt.
        const namn = [svar.fullName?.givenName, svar.fullName?.familyName].filter(Boolean).join(' ');
        if (namn && !cred.user.displayName) {
            await updateProfile(cred.user, { displayName: namn });
            await spara({ displayName: namn }).catch(() => {});
        }
        return true;
    }, [auth, spara]);

    const glömtLösen = useCallback(async (email: string) => {
        await sendPasswordResetEmail(auth, email.trim());
    }, [auth]);

    const loggaUt = useCallback(async () => {
        await GoogleSignin.signOut().catch(() => {});
        await signOut(auth);
        qc.removeQueries({ queryKey: ['me'] });
    }, [auth, qc]);

    // Servern raderar data OCH Auth-kontot (App Store 5.1.1) - här loggar vi
    // bara ut sessionen som inte längre har något konto bakom sig.
    const raderaKonto = useCallback(async () => {
        await raderaKontot(await token());
        await loggaUt();
    }, [token, loggaUt]);

    const value = useMemo<KontoState>(() => ({
        användare,
        profil,
        profilLaddar: !!användare && profilQuery.isLoading,
        behöverProfil: !!användare && !profilQuery.isLoading && !profil?.displayName,
        appleFinns,
        registrera,
        loggaIn,
        loggaInGoogle,
        loggaInApple,
        glömtLösen,
        sparaProfil: spara,
        loggaUt,
        raderaKonto,
    }), [användare, profil, profilQuery.isLoading, appleFinns, registrera, loggaIn, loggaInGoogle, loggaInApple,
        glömtLösen, spara, loggaUt, raderaKonto]);

    return <KontoContext.Provider value={value}>{children}</KontoContext.Provider>;
}

export function useKonto(): KontoState {
    const ctx = useContext(KontoContext);
    if (!ctx) throw new Error('useKonto kräver KontoProvider (rotlayouten).');
    return ctx;
}
