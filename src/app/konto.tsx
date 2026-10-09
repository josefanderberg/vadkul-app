/**
 * Kontoskärmen: skapa konto, logga in, glömt lösenord och "Om dig" (webbens
 * registreringsfält: namn, ålder, kön, stad, barn - samma users/{uid}).
 * Nås från introt och profilen; ?lage= väljer startläge.
 *
 * Apple-knappen visas bara på iOS (Apples regel 4.8 kräver den där när Google
 * finns); Google och e-post finns överallt. Knapparna är plattformarnas egna
 * (AppleAuthenticationButton, GoogleSigninButton) - deras riktlinjer kräver det.
 */
import { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    View,
} from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import { GoogleSigninButton } from '@react-native-google-signin/google-signin';
import { CITIES, KÖN, valideraMeProfilIn, type Kön } from '@vadkul/kontrakt';
import { KONTON_PÅ } from '@/lib/funktioner';
import { useKonto } from '@/lib/kontoContext';
import { felText, ärAvbrutet } from '@/lib/kontoFel';
import { useRegionVal } from '@/lib/regionContext';

type Läge = 'skapa' | 'logga-in' | 'om-dig' | 'glömt';

const KÖN_TEXT: Record<Kön, string> = { kvinna: 'Kvinna', man: 'Man', annat: 'Annat', vill_ej_ange: 'Vill inte ange' };

export default function KontoScreen() {
    // Kontona är avstängda i v1 (lib/funktioner). Skärmen är kvar och färdig,
    // men ingen djuplänk ska kunna nå den så länge /v1/me är odeployat.
    if (!KONTON_PÅ) return <Redirect href="/" />;
    return <KontoInnehåll />;
}

function KontoInnehåll() {
    const { lage } = useLocalSearchParams<{ lage?: string }>();
    const konto = useKonto();
    const [läge, setLäge] = useState<Läge>(
        lage === 'logga-in' || lage === 'om-dig' || lage === 'glömt' ? lage : 'skapa',
    );
    const [upptagen, setUpptagen] = useState(false);
    const [fel, setFel] = useState<string | null>(null);
    const [kvitto, setKvitto] = useState<string | null>(null);

    // Inloggad: vidare till "Om dig" om profilen saknar namn, annars klart.
    useEffect(() => {
        if (!konto.användare || konto.profilLaddar || läge === 'om-dig') return;
        if (konto.behöverProfil) setLäge('om-dig');
        else if (läge === 'skapa' || läge === 'logga-in') router.back();
    }, [konto.användare, konto.profilLaddar, konto.behöverProfil, läge]);

    const kör = async (f: () => Promise<unknown>) => {
        setFel(null);
        setUpptagen(true);
        try {
            await f();
        } catch (err) {
            if (!ärAvbrutet(err)) setFel(felText(err));
        } finally {
            setUpptagen(false);
        }
    };

    return (
        <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.huvud}>
                <Text style={styles.rubrik}>
                    {läge === 'skapa' ? 'Skapa konto' : läge === 'logga-in' ? 'Logga in' : läge === 'glömt' ? 'Glömt lösenordet' : 'Om dig'}
                </Text>
                <Pressable onPress={() => router.back()} hitSlop={12} style={styles.stangKnapp} accessibilityLabel="Stäng">
                    <Text style={styles.stangText}>✕</Text>
                </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.innehåll} keyboardShouldPersistTaps="handled">
                {läge === 'om-dig' ? (
                    <OmDig upptagen={upptagen} kör={kör} />
                ) : läge === 'glömt' ? (
                    <Glömt upptagen={upptagen} kör={kör} kvitto={kvitto} setKvitto={setKvitto} />
                ) : (
                    <>
                        <Text style={styles.ingress}>
                            {läge === 'skapa'
                                ? 'Samma konto funkar här och på vadkul.se.'
                                : 'Logga in med kontot du har på vadkul.se.'}
                        </Text>
                        {konto.appleFinns ? (
                            <AppleAuthentication.AppleAuthenticationButton
                                buttonType={läge === 'skapa'
                                    ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP
                                    : AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                                cornerRadius={999}
                                style={styles.appleKnapp}
                                onPress={() => kör(konto.loggaInApple)}
                            />
                        ) : null}
                        <GoogleSigninButton
                            style={styles.googleKnapp}
                            size={GoogleSigninButton.Size.Wide}
                            color={GoogleSigninButton.Color.Light}
                            onPress={() => kör(konto.loggaInGoogle)}
                            disabled={upptagen}
                        />
                        <View style={styles.eller}>
                            <View style={styles.ellerLinje} />
                            <Text style={styles.ellerText}>eller med e-post</Text>
                            <View style={styles.ellerLinje} />
                        </View>
                        <EpostForm läge={läge} upptagen={upptagen} kör={kör} />
                        {läge === 'logga-in' ? (
                            <Pressable onPress={() => { setFel(null); setLäge('glömt'); }} hitSlop={8}>
                                <Text style={styles.länk}>Glömt lösenordet?</Text>
                            </Pressable>
                        ) : null}
                        <Pressable
                            onPress={() => { setFel(null); setLäge(läge === 'skapa' ? 'logga-in' : 'skapa'); }}
                            hitSlop={8}
                        >
                            <Text style={styles.länk}>
                                {läge === 'skapa' ? 'Har du redan ett konto? Logga in' : 'Ny här? Skapa konto'}
                            </Text>
                        </Pressable>
                    </>
                )}
                {fel ? <Text style={styles.fel}>{fel}</Text> : null}
                {upptagen ? <ActivityIndicator style={styles.snurra} color="#006aa7" /> : null}
                {läge === 'skapa' ? (
                    <Text style={styles.villkor}>
                        Genom att skapa ett konto godkänner du hur vi hanterar dina uppgifter (vadkul.se/integritet).
                        Du kan radera kontot när du vill under Profil.
                    </Text>
                ) : null}
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

type Kör = (f: () => Promise<unknown>) => Promise<void>;

function EpostForm({ läge, upptagen, kör }: { läge: 'skapa' | 'logga-in'; upptagen: boolean; kör: Kör }) {
    const konto = useKonto();
    const [namn, setNamn] = useState('');
    const [email, setEmail] = useState('');
    const [lösen, setLösen] = useState('');
    const skicka = () =>
        kör(() => (läge === 'skapa' ? konto.registrera(namn, email, lösen) : konto.loggaIn(email, lösen)));
    return (
        <>
            {läge === 'skapa' ? (
                <TextInput style={styles.fält} placeholder="Namn" placeholderTextColor="#94a3b8" value={namn}
                    onChangeText={setNamn} textContentType="name" autoComplete="name" />
            ) : null}
            <TextInput style={styles.fält} placeholder="E-post" placeholderTextColor="#94a3b8" value={email}
                onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
                textContentType="emailAddress" autoComplete="email" />
            <TextInput style={styles.fält} placeholder="Lösenord (minst 6 tecken)" placeholderTextColor="#94a3b8"
                value={lösen} onChangeText={setLösen} secureTextEntry
                textContentType={läge === 'skapa' ? 'newPassword' : 'password'}
                autoComplete={läge === 'skapa' ? 'new-password' : 'current-password'}
                onSubmitEditing={skicka} returnKeyType="go" />
            <Pressable
                style={({ pressed }) => [styles.primär, (pressed || upptagen) && styles.tryckt]}
                disabled={upptagen}
                onPress={skicka}
            >
                <Text style={styles.primärText}>{läge === 'skapa' ? 'Skapa konto' : 'Logga in'}</Text>
            </Pressable>
        </>
    );
}

function Glömt({ upptagen, kör, kvitto, setKvitto }: {
    upptagen: boolean; kör: Kör; kvitto: string | null; setKvitto: (s: string) => void;
}) {
    const konto = useKonto();
    const [email, setEmail] = useState('');
    return (
        <>
            <Text style={styles.ingress}>Vi mejlar en länk där du väljer ett nytt lösenord.</Text>
            <TextInput style={styles.fält} placeholder="E-post" placeholderTextColor="#94a3b8" value={email}
                onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
            <Pressable
                style={({ pressed }) => [styles.primär, (pressed || upptagen) && styles.tryckt]}
                disabled={upptagen}
                onPress={() => kör(async () => {
                    await konto.glömtLösen(email);
                    setKvitto(`Klart - kolla din inkorg (${email.trim()}).`);
                })}
            >
                <Text style={styles.primärText}>Skicka länken</Text>
            </Pressable>
            {kvitto ? <Text style={styles.kvitto}>{kvitto}</Text> : null}
        </>
    );
}

/** "Om dig" - webbens registreringsfält. Allt utom namnet går att hoppa över. */
function OmDig({ upptagen, kör }: { upptagen: boolean; kör: Kör }) {
    const konto = useKonto();
    const { city } = useRegionVal();
    const p = konto.profil;
    const [namn, setNamn] = useState(p?.displayName ?? konto.användare?.displayName ?? '');
    const [ålder, setÅlder] = useState(p?.age ? String(p.age) : '');
    const [kön, setKön] = useState<Kön | null>(p?.gender ?? null);
    const [stadSlug, setStadSlug] = useState<string | null>(p?.citySlug ?? city.slug);
    const [barn, setBarn] = useState(p?.hasChildren === true);
    const [stadFilter, setStadFilter] = useState('');
    const [fel, setFel] = useState<string | null>(null);

    const städer = useMemo(() => {
        const q = stadFilter.trim().toLowerCase();
        return (q ? CITIES.filter(c => c.name.toLowerCase().includes(q)) : CITIES).slice(0, 12);
    }, [stadFilter]);
    const vald = CITIES.find(c => c.slug === stadSlug);

    const spara = () => {
        const input = {
            displayName: namn,
            ...(ålder.trim() ? { age: Number(ålder.trim()) } : {}),
            ...(kön ? { gender: kön } : {}),
            citySlug: stadSlug,
            hasChildren: barn,
        };
        const v = valideraMeProfilIn(input);
        if (!v.ok) {
            setFel(v.fel);
            return;
        }
        setFel(null);
        return kör(async () => {
            await konto.sparaProfil(v.värde);
            router.back();
        });
    };

    return (
        <>
            <Text style={styles.ingress}>Hjälper oss visa rätt event och skicka tips för din stad.</Text>
            <Text style={styles.etikett}>Namn</Text>
            <TextInput style={styles.fält} value={namn} onChangeText={setNamn} placeholder="Ditt namn"
                placeholderTextColor="#94a3b8" textContentType="name" />
            <Text style={styles.etikett}>Ålder (valfritt)</Text>
            <TextInput style={styles.fält} value={ålder} onChangeText={setÅlder} placeholder="t.ex. 34"
                placeholderTextColor="#94a3b8" keyboardType="number-pad" maxLength={3} />
            <Text style={styles.etikett}>Kön (valfritt)</Text>
            <View style={styles.chipRad}>
                {KÖN.map(k => (
                    <Pressable key={k} onPress={() => setKön(kön === k ? null : k)}
                        style={[styles.chip, kön === k && styles.chipVald]}>
                        <Text style={[styles.chipText, kön === k && styles.chipTextVald]}>{KÖN_TEXT[k]}</Text>
                    </Pressable>
                ))}
            </View>
            <Text style={styles.etikett}>Stad: {vald?.name ?? 'ingen vald'}</Text>
            <TextInput style={styles.fält} value={stadFilter} onChangeText={setStadFilter} placeholder="Sök stad …"
                placeholderTextColor="#94a3b8" autoCorrect={false} />
            <View style={styles.chipRad}>
                {städer.map(c => (
                    <Pressable key={c.slug} onPress={() => setStadSlug(c.slug)}
                        style={[styles.chip, stadSlug === c.slug && styles.chipVald]}>
                        <Text style={[styles.chipText, stadSlug === c.slug && styles.chipTextVald]}>{c.name}</Text>
                    </Pressable>
                ))}
            </View>
            <View style={styles.växelRad}>
                <Text style={styles.växelText}>Jag har barn (0-13 år)</Text>
                <Switch value={barn} onValueChange={setBarn} />
            </View>
            <Pressable
                style={({ pressed }) => [styles.primär, (pressed || upptagen) && styles.tryckt]}
                disabled={upptagen}
                onPress={spara}
            >
                <Text style={styles.primärText}>Spara</Text>
            </Pressable>
            {fel ? <Text style={styles.fel}>{fel}</Text> : null}
        </>
    );
}

const BLÅ = '#006aa7';

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#f8fafc', paddingTop: 24 },
    huvud: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
    rubrik: { fontSize: 24, fontWeight: '900', color: '#0f172a' },
    stangKnapp: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
    stangText: { fontSize: 13, fontWeight: '700', color: '#475569' },
    innehåll: { padding: 20, paddingBottom: 60 },
    ingress: { fontSize: 15, color: '#475569', marginBottom: 18, lineHeight: 21 },
    appleKnapp: { height: 50, width: '100%', marginBottom: 10 },
    googleKnapp: { width: '100%', height: 52 },
    eller: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 18 },
    ellerLinje: { flex: 1, height: 1, backgroundColor: '#e2e8f0' },
    ellerText: { fontSize: 13, color: '#94a3b8', fontWeight: '700' },
    etikett: { fontSize: 13, fontWeight: '800', color: '#64748b', marginTop: 12, marginBottom: 6 },
    fält: {
        backgroundColor: '#ffffff',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        paddingHorizontal: 14,
        paddingVertical: 13,
        fontSize: 16,
        color: '#0f172a',
        marginBottom: 10,
    },
    primär: { marginTop: 8, backgroundColor: BLÅ, borderRadius: 999, paddingVertical: 15, alignItems: 'center' },
    primärText: { color: '#ffffff', fontSize: 16, fontWeight: '900' },
    tryckt: { opacity: 0.75 },
    länk: { marginTop: 16, textAlign: 'center', color: BLÅ, fontSize: 15, fontWeight: '700' },
    fel: { marginTop: 14, color: '#b91c1c', fontSize: 14, fontWeight: '700', textAlign: 'center' },
    kvitto: { marginTop: 14, color: '#047857', fontSize: 14, fontWeight: '700', textAlign: 'center' },
    snurra: { marginTop: 14 },
    villkor: { marginTop: 22, fontSize: 12, color: '#94a3b8', textAlign: 'center', lineHeight: 17 },
    chipRad: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
    chip: { borderRadius: 999, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 12, paddingVertical: 7 },
    chipVald: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
    chipText: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
    chipTextVald: { color: '#ffffff' },
    växelRad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, marginBottom: 6 },
    växelText: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
});
