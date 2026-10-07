/**
 * Städer (modal från stadsplattan) - listan in till stadssidorna
 * (/stad/<slug>, appens motsvarighet till webbens /evenemang/<stad>).
 * Manuellt kartval görs på stadssidan ("Visa på kartan") och vinner över
 * GPS tills det nollställs (RegionProvider). Stadslistan är kontraktets
 * CITIES - samma lista som regionvalet och scraperns flödesbygge.
 */
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { CITIES, type City } from '@vadkul/kontrakt';
import { useRegionVal } from '@/lib/regionContext';
import { useModalTopp } from '@/lib/useModalTopp';

export default function StaderScreen() {
    const modalTopp = useModalTopp();
    const { city, manuell, tillGpsStad } = useRegionVal();
    const [filter, setFilter] = useState('');

    const q = filter.toLowerCase().trim();
    const städer = q ? CITIES.filter(c => c.name.toLowerCase().includes(q)) : CITIES;

    const välj = (c: City) => {
        router.push(`/stad/${c.slug}`);
    };

    return (
        <View style={[styles.root, { paddingTop: modalTopp }]}>
            <View style={styles.huvud}>
                <View style={styles.huvudText}>
                    <Text style={styles.rubrik}>Städer</Text>
                    <Text style={styles.underRubrik}>
                        Kartans stad: {city.name}{manuell ? '' : ' (via din plats)'}
                    </Text>
                </View>
                <Pressable onPress={() => router.back()} hitSlop={12} style={styles.stangKnapp} accessibilityLabel="Stäng">
                    <Text style={styles.stangText}>✕</Text>
                </Pressable>
            </View>
            <TextInput
                style={styles.falt}
                placeholder="Filtrera städer …"
                placeholderTextColor="#94a3b8"
                value={filter}
                onChangeText={setFilter}
                autoCorrect={false}
                clearButtonMode="while-editing"
            />
            {manuell ? (
                <Pressable style={({ pressed }) => [styles.gpsKnapp, pressed && styles.tryckt]} onPress={tillGpsStad}>
                    <Text style={styles.gpsText}>📡 Återgå till min plats</Text>
                </Pressable>
            ) : null}
            <FlatList
                data={städer}
                keyExtractor={(c) => c.slug}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => {
                    const vald = item.slug === city.slug;
                    return (
                        <Pressable
                            style={({ pressed }) => [styles.rad, pressed && styles.tryckt]}
                            onPress={() => välj(item)}
                        >
                            <Text style={[styles.radNamn, vald && styles.radNamnVald]}>{item.name}</Text>
                            {vald ? <Text style={styles.bock}>✓</Text> : null}
                        </Pressable>
                    );
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#f8fafc' },
    huvud: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16 },
    huvudText: { flex: 1 },
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
    underRubrik: { marginTop: 4, fontSize: 13, color: '#475569' },
    falt: {
        margin: 16,
        marginBottom: 8,
        backgroundColor: '#ffffff',
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        color: '#0f172a',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    gpsKnapp: {
        marginHorizontal: 16,
        marginBottom: 8,
        backgroundColor: '#e0f2fe',
        borderRadius: 14,
        paddingVertical: 10,
        alignItems: 'center',
    },
    gpsText: { fontSize: 14, fontWeight: '700', color: '#0369a1' },
    rad: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#ffffff',
        marginHorizontal: 16,
        marginVertical: 3,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    tryckt: { opacity: 0.7 },
    radNamn: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
    radNamnVald: { fontWeight: '800' },
    bock: { fontSize: 15, fontWeight: '800', color: '#059669' },
});
