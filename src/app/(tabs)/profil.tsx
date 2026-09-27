/**
 * Profil - än så länge lokala val och app-info. Inloggning, sparade event
 * och notiser hör till fas 3 i plattformsplanen (auth/push via
 * @react-native-firebase) och byggs INTE här innan dess.
 *
 * HÅRD REGEL (CLAUDE.md): appen säljer ingenting - ingen boost, inga priser.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useRegionVal } from '@/lib/regionContext';

export default function ProfilScreen() {
    const { city, fromGps, manuell } = useRegionVal();
    const källa = manuell ? 'vald i Städer-fliken' : fromGps ? 'via din plats' : 'standard';

    return (
        <View style={styles.root}>
            <Text style={styles.rubrik}>Profil</Text>

            <View style={styles.kort}>
                <Text style={styles.kortRubrik}>Din stad</Text>
                <Text style={styles.kortText}>{city.name} ({källa})</Text>
                <Text style={styles.kortHjalp}>Byt stad i Städer-fliken - kartan och flödet följer med.</Text>
            </View>

            <View style={styles.kort}>
                <Text style={styles.kortRubrik}>Konto</Text>
                <Text style={styles.kortText}>Inloggning, sparade event och notiser kommer i en senare version.</Text>
                <Text style={styles.kortHjalp}>Tills dess finns allt det på vadkul.se.</Text>
                <Pressable
                    style={({ pressed }) => [styles.knapp, pressed && styles.tryckt]}
                    onPress={() => WebBrowser.openBrowserAsync('https://vadkul.se')}
                >
                    <Text style={styles.knappText}>Öppna vadkul.se</Text>
                </Pressable>
            </View>

            <View style={styles.kort}>
                <Text style={styles.kortRubrik}>Om appen</Text>
                <Text style={styles.kortText}>VADKUL - eventkartan för Sverige.</Text>
                <Text style={styles.kortHjalp}>Version 1.0.0 (utvecklingsbygge)</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#f8fafc', paddingTop: 64, paddingHorizontal: 16 },
    rubrik: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
    kort: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 16,
        marginTop: 12,
    },
    kortRubrik: { fontSize: 13, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.4 },
    kortText: { marginTop: 6, fontSize: 15, fontWeight: '600', color: '#0f172a' },
    kortHjalp: { marginTop: 4, fontSize: 13, color: '#475569' },
    knapp: {
        marginTop: 12,
        borderRadius: 999,
        backgroundColor: '#0f172a',
        paddingVertical: 10,
        alignItems: 'center',
    },
    tryckt: { opacity: 0.85 },
    knappText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
});
