/**
 * Kontot i appen: Firebase Auth via @react-native-firebase (sessionen ligger
 * i nyckelringen/Keystore - aldrig i AsyncStorage) och profilen i
 * users/{uid} DIREKT i Firestore sedan 8/10 2026 (data/anvandare, port av
 * webbens AuthContext + userService). Samma konton som webben: ett konto
 * skapat här loggar in på vadkul.se och tvärtom.
 *
 * ANONYM SESSION (webbens ensureTipIdentity): svar och tips kräver inget
 * konto, bara ett uid. `säkerställIdentitet` skapar en anonym session vid
 * behov; `användare` är ALLTID null för den, så varje kontogrind beter sig
 * som förut. Skapar man sedan konto LÄNKAS den anonyma sessionen, så svar och
 * tips följer med (samma räddning som webbens register/Google).
 *
 * Inloggningssätt (ägarbeslut 29/9): e-post + lösenord och Google överallt,
 * Sign in with Apple på iOS (Apples regel 4.8 när Google finns).
 *
 * Profilen är best-effort precis som webbens registrering: kontot ÄR skapat
 * när Firebase svarat, och ett Firestore-hicka får inte få registreringen att
 * se misslyckad ut - kontoskärmen erbjuder "Om dig" igen när profilen saknas.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import {
    AppleAuthProvider,
    createUserWithEmailAndPassword,
    deleteUser,
    EmailAuthProvider,
    getAdditionalUserInfo,
    getAuth,
    GoogleAuthProvider,
    linkWithCredential,
    onAuthStateChanged,
    sendPasswordResetEmail,
    signInAnonymously,
    signInWithCredential,
    signInWithEmailAndPassword,
    signOut,
    updateProfile,
    type AuthCredential,
    type UserCredential,
    type User,
} from '@react-native-firebase/auth';
import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { MeProfil, MeProfilIn } from '@vadkul/kontrakt';
import { hämtaProfil, raderaAnvändarDoc, skapaGrundprofil, sparaProfil } from '@/data/anvandare';

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
    /** undefined = Firebase har inte svarat än; null = utloggad ELLER anonym. */
    användare: Användare | null | undefined;
    /** uid för svar/tips - inloggad eller anonym session, null om ingen finns. */
    uid: string | null;
    /** Ge mig ett uid utan att be om konto (anonym session vid behov). */
    säkerställIdentitet: () => Promise<string>;
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
    // råAnvändare = vad Firebase har (kan vara anonym); `användare` nedan är
    // den filtrerade vyn resten av appen ser.
    const [råAnvändare, setRåAnvändare] = useState<User | null | undefined>(undefined);
    const [namnSpegel, setNamnSpegel] = useState<string | null>(null);
    const [appleFinns, setAppleFinns] = useState(false);

    useEffect(() => onAuthStateChanged(auth, u => { setRåAnvändare(u); setNamnSpegel(null); }), [auth]);
    useEffect(() => {
        if (Platform.OS !== 'ios') return;
        AppleAuthentication.isAvailableAsync().then(setAppleFinns).catch(() => setAppleFinns(false));
    }, []);

    const användare = useMemo<Användare | null | undefined>(() => {
        if (råAnvändare === undefined) return undefined;
        if (!råAnvändare || råAnvändare.isAnonymous) return null;
        const a = tillAnvändare(råAnvändare)!;
        // onAuthStateChanged fyrar före updateProfile hinner slå igenom - spegla namnet lokalt.
        return namnSpegel && !a.displayName ? { ...a, displayName: namnSpegel } : a;
    }, [råAnvändare, namnSpegel]);

    const säkerställIdentitet = useCallback(async () => {
        if (auth.currentUser) return auth.currentUser.uid;
        return (await signInAnonymously(auth)).user.uid;
    }, [auth]);

    const profilQuery = useQuery({
        queryKey: ['me', användare?.uid ?? null],
        queryFn: async () => hämtaProfil(användare!.uid, användare!.email),
        enabled: !!användare,
        staleTime: 5 * 60 * 1000,
        retry: 1,
    });
    const profil = användare ? profilQuery.data ?? null : null;

    const spara = useCallback(async (input: MeProfilIn) => {
        const u = auth.currentUser;
        if (!u || u.isAnonymous) throw new Error('Inte inloggad');
        await sparaProfil(u.uid, u.email, input);
        if (input.displayName) {
            await updateProfile(u, { displayName: input.displayName.trim() }).catch(() => {});
            setNamnSpegel(input.displayName.trim());
        }
        await qc.invalidateQueries({ queryKey: ['me', u.uid] });
    }, [auth, qc]);

    /**
     * Logga in med en credential. En pågående ANONYM session länkas i stället
     * (svar och tips följer med); finns kontot redan loggar vi in på det -
     * då blir det anonyma kvar hos sitt uid, samma avvägning som webben.
     */
    const medCredential = useCallback(async (cred: AuthCredential) => {
        const anon = auth.currentUser?.isAnonymous ? auth.currentUser : null;
        let res: UserCredential;
        if (anon) {
            try {
                res = await linkWithCredential(anon, cred);
            } catch (e) {
                const code = String((e as { code?: unknown })?.code ?? '');
                if (!code.includes('credential-already-in-use') && !code.includes('email-already-in-use')) throw e;
                res = await signInWithCredential(auth, cred);
            }
        } else {
            res = await signInWithCredential(auth, cred);
        }
        const länkad = !!anon && res.user.uid === anon.uid;
        if (länkad || getAdditionalUserInfo(res)?.isNewUser) {
            await skapaGrundprofil(res.user.uid, res.user.email, res.user.displayName).catch(() => {});
        }
        return res;
    }, [auth]);

    const registrera = useCallback(async (namn: string, email: string, lösen: string) => {
        const anon = auth.currentUser?.isAnonymous ? auth.currentUser : null;
        let user: User;
        if (anon) {
            try {
                user = (await linkWithCredential(anon, EmailAuthProvider.credential(email.trim(), lösen))).user;
            } catch {
                user = (await createUserWithEmailAndPassword(auth, email.trim(), lösen)).user;
            }
        } else {
            user = (await createUserWithEmailAndPassword(auth, email.trim(), lösen)).user;
        }
        if (namn.trim()) {
            await updateProfile(user, { displayName: namn.trim() });
            setNamnSpegel(namn.trim());
        }
        // Best effort - kontot finns redan, "Om dig" tar igen det som saknas.
        await skapaGrundprofil(user.uid, user.email, namn.trim() || null).catch(() => {});
        await qc.invalidateQueries({ queryKey: ['me', user.uid] });
    }, [auth, qc]);

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
        await medCredential(GoogleAuthProvider.credential(idToken));
        return true;
    }, [medCredential]);

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
        const cred = await medCredential(AppleAuthProvider.credential(svar.identityToken, råNonce));
        // Apple skickar namnet BARA första gången - spara det direkt.
        const namn = [svar.fullName?.givenName, svar.fullName?.familyName].filter(Boolean).join(' ');
        if (namn && !cred.user.displayName) {
            await updateProfile(cred.user, { displayName: namn });
            setNamnSpegel(namn);
            await sparaProfil(cred.user.uid, cred.user.email, { displayName: namn }).catch(() => {});
        }
        return true;
    }, [medCredential]);

    const glömtLösen = useCallback(async (email: string) => {
        await sendPasswordResetEmail(auth, email.trim());
    }, [auth]);

    const loggaUt = useCallback(async () => {
        await GoogleSignin.signOut().catch(() => {});
        await signOut(auth);
        qc.removeQueries({ queryKey: ['me'] });
    }, [auth, qc]);

    // App Store 5.1.1: radering inifrån appen. Samma ordning som webbens
    // profilpanel - users-dokumentet först (best effort), sedan Auth-kontot.
    // Auth kan kasta auth/requires-recent-login; felText förklarar då.
    const raderaKonto = useCallback(async () => {
        const u = auth.currentUser;
        if (!u || u.isAnonymous) throw new Error('Inte inloggad');
        await raderaAnvändarDoc(u.uid).catch(() => {});
        await deleteUser(u);
        await GoogleSignin.signOut().catch(() => {});
        qc.removeQueries({ queryKey: ['me'] });
    }, [auth, qc]);

    const value = useMemo<KontoState>(() => ({
        användare,
        uid: råAnvändare?.uid ?? null,
        säkerställIdentitet,
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
    }), [användare, råAnvändare, säkerställIdentitet, profil, profilQuery.isLoading, appleFinns, registrera, loggaIn,
        loggaInGoogle, loggaInApple, glömtLösen, spara, loggaUt, raderaKonto]);

    return <KontoContext.Provider value={value}>{children}</KontoContext.Provider>;
}

export function useKonto(): KontoState {
    const ctx = useContext(KontoContext);
    if (!ctx) throw new Error('useKonto kräver KontoProvider (rotlayouten).');
    return ctx;
}
