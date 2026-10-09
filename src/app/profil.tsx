/**
 * Profil - webbens ProfilePanel: kontot (inloggning, "Om dig", utloggning och
 * radering - App Store 5.1.1 kräver radering inifrån appen), sparade event
 * (hjärtat, sparat på enheten), "Visa även på kartan" (Svenska kyrkan/PRO -
 * opt-in-källorna, kart-ui 15/9), din stad och - för inloggade - NOTISER
 * (sedan 8/10, webbens två reglage): påminnelse 1 h före sparade event är
 * per ENHET (FCM-token, data/push) och veckans helgtips är per KONTO
 * (users.weeklyDigest, default på - functions/digest kräver även citySlug).
 *
 * HÅRD REGEL (CLAUDE.md): appen säljer ingenting - ingen boost, inga priser.
 */
import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import type { AppFeedEvent } from '@vadkul/kontrakt';
import { EventKort } from '@/components/EventKort';
import { EventRad } from '@/components/EventRad';
import { useFilter } from '@/lib/filterContext';
import { KONTON_PÅ } from '@/lib/funktioner';
import { isEventPast } from '@/lib/harVarit';
import { KÄLLOR } from '@/lib/kartFilter';
import { useKonto } from '@/lib/kontoContext';
import { felText } from '@/lib/kontoFel';
import { useRegionVal } from '@/lib/regionContext';
import { useSparade } from '@/lib/sparadeContext';
import { läsFält, sättFält } from '@/data/anvandare';
import { pushTillstånd, slåAvPush, slåPåPush, type PushTillstånd } from '@/data/push';

/** Notisreglagen - bara för inloggade (påminnelsejobbet frågar kontots
 *  sparade event, helgtipset kontots stad). */
function Notiser({ uid, harStad }: { uid: string; harStad: boolean }) {
    const [push, setPush] = useState<PushTillstånd | null>(null);
    const [helgtips, setHelgtips] = useState(true);
    const [upptagen, setUpptagen] = useState(false);
    useEffect(() => {
        void pushTillstånd().then(setPush);
        void läsFält(uid).then(d => setHelgtips(d?.weeklyDigest !== false)).catch(() => {});
    }, [uid]);

    const växlaPush = async () => {
        if (upptagen) return;
        setUpptagen(true);
        try {
            if (push === 'på') {
                await slåAvPush(uid);
                setPush('ej-frågad');
            } else {
                const r = await slåPåPush(uid);
                if (r === 'nekad') {
                    setPush('nekad');
                    Alert.alert('Notiser är avstängda', 'Slå på notiser för VADKUL i telefonens inställningar.', [
                        { text: 'Inte nu', style: 'cancel' },
                        { text: 'Öppna inställningar', onPress: () => void Linking.openSettings() },
                    ]);
                } else if (r === 'fel') {
                    Alert.alert('Kunde inte slå på notiser', 'Försök igen om en stund.');
                } else {
                    setPush('på');
                }
            }
        } finally {
            setUpptagen(false);
        }
    };
    const växlaHelgtips = () => {
        const nästa = !helgtips;
        setHelgtips(nästa);
        sättFält(uid, { weeklyDigest: nästa }).catch(() => {
            setHelgtips(!nästa);
            Alert.alert('Kunde inte spara', 'Försök igen om en stund.');
        });
    };

    return (
        <>
            <Text style={styles.sektion}>Notiser</Text>
            <View style={styles.kort}>
                <View style={styles.växelRad}>
                    <Text style={[styles.växelText, styles.växelEtikett]}>🔔 Notiser på den här telefonen</Text>
                    <Switch value={push === 'på'} onValueChange={() => void växlaPush()} disabled={push === null || upptagen} />
                </View>
                <Text style={styles.kortHjalp}>Påminnelse en timme innan event du sparat med hjärtat.</Text>
                <View style={[styles.växelRad, styles.växelRadLuft]}>
                    <Text style={[styles.växelText, styles.växelEtikett]}>Veckans helgtips (torsdagar)</Text>
                    <Switch value={helgtips} onValueChange={växlaHelgtips} />
                </View>
                {!harStad ? (
                    <Text style={styles.kortHjalp}>Välj din stad under Redigera profil så vet vi vilka tips du ska få.</Text>
                ) : null}
            </View>
        </>
    );
}

export default function ProfilScreen() {
    const { city, fromGps, manuell } = useRegionVal();
    const { sparade, växla } = useSparade();
    const filter = useFilter();
    const konto = useKonto();
    const [valt, setValt] = useState<AppFeedEvent | null>(null);

    const radera = () => Alert.alert(
        'Radera kontot?',
        'Kontot och din profil raderas för gott - även på vadkul.se. Det går inte att ångra.',
        [
            { text: 'Avbryt', style: 'cancel' },
            {
                text: 'Radera',
                style: 'destructive',
                onPress: () => konto.raderaKonto()
                    .then(() => Alert.alert('Kontot är raderat.'))
                    .catch(err => Alert.alert('Kunde inte radera kontot', felText(err))),
            },
        ],
    );
    const källa = manuell ? 'vald av dig' : fromGps ? 'via din plats' : 'standard';
    const nu = Date.now();

    return (
        <View style={styles.root}>
            <View style={styles.huvud}>
                <Text style={styles.rubrik}>Profil</Text>
                <Pressable onPress={() => router.back()} hitSlop={12} style={styles.stangKnapp} accessibilityLabel="Stäng">
                    <Text style={styles.stangText}>✕</Text>
                </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.innehåll}>
                {KONTON_PÅ ? (
                    <>
                    <Text style={styles.sektion}>Konto</Text>
                    {konto.användare ? (
                        <View style={styles.kort}>
                            <Text style={styles.kortText}>{konto.profil?.displayName ?? konto.användare.displayName ?? 'Inloggad'}</Text>
                            {konto.användare.email ? <Text style={styles.kortHjalp}>{konto.användare.email}</Text> : null}
                            {konto.profil?.city ? <Text style={styles.kortHjalp}>📍 {konto.profil.city}</Text> : null}
                            <Pressable
                                style={({ pressed }) => [styles.knapp, pressed && styles.tryckt]}
                                onPress={() => router.push('/konto?lage=om-dig')}
                            >
                                <Text style={styles.knappText}>{konto.behöverProfil ? 'Fyll i din profil' : 'Redigera profil'}</Text>
                            </Pressable>
                            <View style={styles.kontoRad}>
                                <Pressable onPress={() => konto.loggaUt()} hitSlop={8}>
                                    <Text style={styles.länk}>Logga ut</Text>
                                </Pressable>
                                <Pressable onPress={radera} hitSlop={8}>
                                    <Text style={styles.raderaLänk}>Radera konto</Text>
                                </Pressable>
                            </View>
                        </View>
                    ) : (
                        <View style={styles.kort}>
                            <Text style={styles.kortText}>Du är inte inloggad.</Text>
                            <Text style={styles.kortHjalp}>Samma konto funkar här och på vadkul.se.</Text>
                            <Pressable
                                style={({ pressed }) => [styles.knapp, pressed && styles.tryckt]}
                                onPress={() => router.push('/konto?lage=skapa')}
                            >
                                <Text style={styles.knappText}>Skapa konto</Text>
                            </Pressable>
                            <Pressable onPress={() => router.push('/konto?lage=logga-in')} hitSlop={8}>
                                <Text style={[styles.länk, styles.centrerad]}>Logga in</Text>
                            </Pressable>
                        </View>
                    )}
                    {konto.användare ? <Notiser uid={konto.användare.uid} harStad={!!konto.profil?.citySlug} /> : null}
                    </>
                ) : null}

                <Text style={styles.sektion}>♥ Sparade event</Text>
                {sparade.length === 0 ? (
                    <View style={styles.kort}>
                        <Text style={styles.kortHjalp}>Tryck på hjärtat i ett eventkort så hamnar eventet här - även utan nät.</Text>
                    </View>
                ) : (
                    sparade.map(e => (
                        <EventRad
                            key={e.id}
                            event={e}
                            dimmad={isEventPast(e, nu)}
                            onPress={() => setValt(e)}
                            höger={
                                <Pressable onPress={() => växla(e)} hitSlop={10} accessibilityLabel="Ta bort från sparade">
                                    <Text style={styles.hjärta}>♥</Text>
                                </Pressable>
                            }
                        />
                    ))
                )}

                <Text style={styles.sektion}>Visa även på kartan</Text>
                <View style={styles.kort}>
                    {KÄLLOR.filter(k => k.optIn).map(k => (
                        <View key={k.key} style={styles.växelRad}>
                            <Text style={styles.växelText}>{k.emoji} {k.label}</Text>
                            <Switch value={filter.optIn.has(k.key)} onValueChange={() => filter.växlaOptIn(k.key)} />
                        </View>
                    ))}
                    <Text style={styles.kortHjalp}>
                        Källor med väldigt många event visas bara när du vill. Korpen hittar du under FLER i sökningen.
                    </Text>
                </View>

                <Text style={styles.sektion}>Din stad</Text>
                <View style={styles.kort}>
                    <Text style={styles.kortText}>{city.name} ({källa})</Text>
                    <Text style={styles.kortHjalp}>Byt stad via sökningen eller stadssidan - kartan och flödet följer med.</Text>
                </View>

                <Text style={styles.sektion}>Om VADKUL</Text>
                <View style={styles.kort}>
                    <Text style={styles.kortText}>Eventkartan för Sverige.</Text>
                    <Text style={styles.kortHjalp}>Kartdata © OpenStreetMap-bidragsgivare · © CARTO</Text>
                    <Pressable
                        style={({ pressed }) => [styles.knapp, pressed && styles.tryckt]}
                        onPress={() => WebBrowser.openBrowserAsync('https://vadkul.se/integritet')}
                    >
                        <Text style={styles.knappText}>Integritet</Text>
                    </Pressable>
                </View>
            </ScrollView>
            {valt ? <EventKort event={valt} grupp={[valt]} onClose={() => setValt(null)} /> : null}
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#f8fafc', paddingTop: 24 },
    huvud: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
    innehåll: { paddingBottom: 48 },
    stangKnapp: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#e2e8f0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    stangText: { fontSize: 13, fontWeight: '700', color: '#475569' },
    rubrik: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
    sektion: {
        marginTop: 22,
        marginBottom: 4,
        marginHorizontal: 16,
        fontSize: 13,
        fontWeight: '800',
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
    kort: { backgroundColor: '#ffffff', borderRadius: 16, padding: 16, marginHorizontal: 16, marginTop: 4 },
    kortText: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
    kortHjalp: { marginTop: 6, fontSize: 13, color: '#475569' },
    växelRad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
    växelText: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
    växelEtikett: { flex: 1, paddingRight: 12 },
    växelRadLuft: { marginTop: 10 },
    hjärta: { fontSize: 22, color: '#e11d48', paddingHorizontal: 6 },
    knapp: { marginTop: 12, borderRadius: 999, backgroundColor: '#0f172a', paddingVertical: 10, alignItems: 'center' },
    tryckt: { opacity: 0.85 },
    knappText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
    kontoRad: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
    länk: { color: '#006aa7', fontSize: 14, fontWeight: '700', marginTop: 12 },
    centrerad: { textAlign: 'center' },
    raderaLänk: { color: '#b91c1c', fontSize: 14, fontWeight: '700', marginTop: 12 },
});
