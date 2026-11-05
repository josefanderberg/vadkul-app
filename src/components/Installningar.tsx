/**
 * Inställningar i profilen - webbens utfällbara Inställningar-mapp
 * (apps/web components/v2/ProfilePanel.tsx, Josef 5/11 2026: "radera konto
 * ska ju på profilen i apparna vara under inställningar ... mer likt så som
 * vi har det på webben"). Samma rader i samma ordning:
 *
 *   Byt lösenord (via e-post) · Min stad (helgtipset) · Jag har barn (0-13)
 *   med barnens åldrar · Användarvillkor · Integritet · Radera konto
 *
 * Fälten är kontots (users/{uid}: citySlug via Redigera profil, hasChildren
 * och childAges direkt), samma som webben läser. Utloggad = bara villkoren.
 * Radera konto frågar först (App Store 5.1.1 - radering inifrån appen).
 */
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useQueryClient } from '@tanstack/react-query';
import { läsFält, sättFält } from '@/data/anvandare';
import { useKonto } from '@/lib/kontoContext';
import { felText } from '@/lib/kontoFel';

const BLÅ = '#006aa7';
/** Barn-definitionen i kryssrutan: 0-13 år. */
const ÅLDRAR = Array.from({ length: 14 }, (_, a) => a);

export function Installningar() {
    const konto = useKonto();
    const qc = useQueryClient();
    const [öppen, setÖppen] = useState(false);
    const inloggad = !!konto.användare;
    const uid = konto.användare?.uid ?? null;
    const email = konto.användare?.email ?? null;

    const [barn, setBarn] = useState(konto.profil?.hasChildren === true);
    const [åldrar, setÅldrar] = useState<number[]>([]);
    const [upptagen, setUpptagen] = useState(false);
    useEffect(() => {
        if (!öppen || !uid) return;
        let aktiv = true;
        läsFält(uid)
            .then(d => {
                if (!aktiv || !d) return;
                setBarn(d.hasChildren === true);
                setÅldrar(Array.isArray(d.childAges) ? d.childAges.filter((a): a is number => typeof a === 'number') : []);
            })
            .catch(() => {});
        return () => { aktiv = false; };
    }, [öppen, uid]);

    const spara = async (fält: Record<string, unknown>, ångra: () => void) => {
        if (!uid) return;
        setUpptagen(true);
        try {
            await sättFält(uid, fält);
            void qc.invalidateQueries({ queryKey: ['me'] });
        } catch {
            ångra();
            Alert.alert('Kunde inte spara', 'Försök igen om en stund.');
        } finally {
            setUpptagen(false);
        }
    };
    const växlaBarn = (på: boolean) => {
        const förra = { barn, åldrar };
        setBarn(på);
        // Utan barn försvinner åldrarna också (webbens handleHasChildrenToggle).
        if (!på) setÅldrar([]);
        void spara(på ? { hasChildren: true } : { hasChildren: false, childAges: [] }, () => {
            setBarn(förra.barn);
            setÅldrar(förra.åldrar);
        });
    };
    const växlaÅlder = (a: number) => {
        const förra = åldrar;
        const nya = åldrar.includes(a) ? åldrar.filter(x => x !== a) : [...åldrar, a].sort((x, y) => x - y);
        setÅldrar(nya);
        void spara({ childAges: nya }, () => setÅldrar(förra));
    };

    const bytLösenord = () => {
        if (!email) return;
        konto.glömtLösen(email)
            .then(() => Alert.alert('Kolla din e-post', `Vi har skickat en länk till ${email} där du väljer ett nytt lösenord.`))
            .catch(err => Alert.alert('Kunde inte skicka länken', felText(err)));
    };

    const radera = () => Alert.alert(
        'Radera kontot?',
        'Kontot och din profil raderas för gott - även på vadkul.se. Det går inte att ångra.',
        [
            { text: 'Avbryt', style: 'cancel' },
            {
                text: 'Ja, radera kontot',
                style: 'destructive',
                onPress: () => konto.raderaKonto()
                    .then(() => Alert.alert('Kontot är raderat.'))
                    .catch(err => Alert.alert('Kunde inte radera kontot', felText(err))),
            },
        ],
    );

    const minStad = konto.profil?.city ?? null;
    // Gamla sparade åldrar över 13 ska alltid gå att kryssa ur (webben).
    const allaÅldrar = [...new Set([...ÅLDRAR, ...åldrar])].sort((x, y) => x - y);

    return (
        <View style={styles.kort}>
            <Pressable
                onPress={() => setÖppen(o => !o)}
                style={({ pressed }) => [styles.rad, pressed && styles.tryckt]}
                accessibilityRole="button"
                accessibilityState={{ expanded: öppen }}
            >
                <Text style={styles.radText}>Inställningar</Text>
                <Text style={[styles.chevron, öppen && styles.chevronÖppen]}>›</Text>
            </Pressable>
            {öppen ? (
                <View style={styles.mapp}>
                    {inloggad && email ? (
                        <Pressable onPress={bytLösenord} style={({ pressed }) => [styles.rad, styles.delad, pressed && styles.tryckt]}>
                            <Text style={styles.radText}>Byt lösenord</Text>
                            <Text style={styles.radVärde}>via e-post</Text>
                        </Pressable>
                    ) : null}
                    {inloggad ? (
                        <Pressable
                            onPress={() => router.push('/konto?lage=om-dig')}
                            style={({ pressed }) => [styles.radKolumn, styles.delad, pressed && styles.tryckt]}
                        >
                            <View style={styles.radInre}>
                                <Text style={styles.radText}>Min stad</Text>
                                <Text style={styles.radVärde} numberOfLines={1}>{minStad ?? 'Ingen stad'}</Text>
                                <Text style={styles.chevron}>›</Text>
                            </View>
                            <Text style={styles.hjälp}>
                                Staden styr helgtipset på torsdagar - det som händer i och runt orten.
                            </Text>
                        </Pressable>
                    ) : null}
                    {inloggad ? (
                        <View style={[styles.radKolumn, styles.delad]}>
                            <View style={styles.radInre}>
                                <Text style={[styles.radText, styles.fyll]}>Jag har barn (0-13 år)</Text>
                                <Switch value={barn} onValueChange={växlaBarn} disabled={upptagen} />
                            </View>
                            {barn ? (
                                <View style={styles.åldrar}>
                                    <Text style={styles.underRubrik}>BARNENS ÅLDRAR</Text>
                                    <View style={styles.chips}>
                                        {allaÅldrar.map(a => {
                                            const på = åldrar.includes(a);
                                            return (
                                                <Pressable
                                                    key={a}
                                                    onPress={() => växlaÅlder(a)}
                                                    disabled={upptagen}
                                                    accessibilityLabel={`${a} år`}
                                                    accessibilityState={{ selected: på }}
                                                    style={[styles.chip, på && styles.chipPå]}
                                                >
                                                    <Text style={[styles.chipText, på && styles.chipTextPå]}>{a}</Text>
                                                </Pressable>
                                            );
                                        })}
                                    </View>
                                </View>
                            ) : null}
                        </View>
                    ) : null}
                    <Pressable
                        onPress={() => WebBrowser.openBrowserAsync('https://vadkul.se/villkor')}
                        style={({ pressed }) => [styles.rad, styles.delad, pressed && styles.tryckt]}
                    >
                        <Text style={styles.radText}>Användarvillkor</Text>
                        <Text style={styles.chevron}>›</Text>
                    </Pressable>
                    <Pressable
                        onPress={() => WebBrowser.openBrowserAsync('https://vadkul.se/integritet')}
                        style={({ pressed }) => [styles.rad, styles.delad, pressed && styles.tryckt]}
                    >
                        <Text style={styles.radText}>Integritet</Text>
                        <Text style={styles.chevron}>›</Text>
                    </Pressable>
                    {inloggad ? (
                        <Pressable onPress={radera} style={({ pressed }) => [styles.rad, styles.delad, pressed && styles.tryckt]}>
                            <Text style={styles.raderaText}>Radera konto</Text>
                        </Pressable>
                    ) : null}
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    kort: { backgroundColor: '#ffffff', borderRadius: 16, marginHorizontal: 16, marginTop: 4, overflow: 'hidden' },
    rad: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14 },
    radKolumn: { paddingHorizontal: 16, paddingVertical: 14 },
    radInre: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    delad: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e2e8f0' },
    mapp: { backgroundColor: '#f8fafc' },
    radText: { flex: 1, fontSize: 15, fontWeight: '700', color: '#0f172a' },
    fyll: { paddingRight: 12 },
    radVärde: { maxWidth: '45%', fontSize: 12, fontWeight: '700', color: '#64748b' },
    chevron: { fontSize: 20, fontWeight: '600', color: '#94a3b8', lineHeight: 22 },
    chevronÖppen: { transform: [{ rotate: '90deg' }] },
    hjälp: { marginTop: 6, fontSize: 12, lineHeight: 17, color: '#64748b' },
    raderaText: { flex: 1, fontSize: 15, fontWeight: '700', color: '#dc2626' },
    åldrar: { marginTop: 10 },
    underRubrik: { fontSize: 10, fontWeight: '900', letterSpacing: 1, color: '#64748b' },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
    chip: {
        minWidth: 32,
        paddingHorizontal: 6,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        backgroundColor: '#ffffff',
        alignItems: 'center',
    },
    chipPå: { backgroundColor: BLÅ, borderColor: BLÅ },
    chipText: { fontSize: 12, fontWeight: '900', color: '#475569' },
    chipTextPå: { color: '#ffffff' },
    tryckt: { opacity: 0.7 },
});
