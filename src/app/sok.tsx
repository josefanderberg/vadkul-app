/**
 * Sökpanelen - webbens FloatingNavbar-sök + SearchResults:
 *  - Kategoriraden överst, även utan söktext (kategorifiltret BOR i sökpanelen,
 *    ägarbeslut 16/9): 🔥 Populära först, FLER sist. Valet gäller kartan.
 *  - Stadsraden: orter som matchar texten - tryck lägger staden på kartan.
 *  - Träffarna: webbens rankning (lib/sok), träffen i fetstil, samma filter
 *    som kartan (kategori/🔥/källor) och bara event som inte varit.
 *  - "jazz i göteborg" söker i ortens län även om kartan står någon annanstans.
 */
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import type { AppFeedEvent } from '@vadkul/kontrakt';
import { useEvent } from '@/api/useEvent';
import { EventKort } from '@/components/EventKort';
import { EventRad } from '@/components/EventRad';
import { KategoriRad } from '@/components/KategoriRad';
import { useFilter } from '@/lib/filterContext';
import { isEventPast } from '@/lib/harVarit';
import { matcharFilter } from '@/lib/kartFilter';
import { useRegionVal } from '@/lib/regionContext';
import { distanceKm } from '@/lib/regionVal';
import { normalizeSearchQuery, searchCities, sokEvent, splitCityFromQuery } from '@/lib/sok';

export default function SokScreen() {
    const { city, region, väljStad, minPos } = useRegionVal();
    const filter = useFilter();
    const [fråga, setFråga] = useState('');
    const [valt, setValt] = useState<AppFeedEvent | null>(null);

    const q = normalizeSearchQuery(fråga);
    const { city: sökOrt, text: sökText } = splitCityFromQuery(q);
    const feed = useEvent(sökOrt?.region ?? region);

    const underlag = useMemo(() => {
        const nu = Date.now();
        return (feed.data ?? []).filter(e => matcharFilter(e, filter) && !isEventPast(e, nu));
    }, [feed.data, filter]);
    const träffar = useMemo(() => sokEvent(underlag, fråga), [underlag, fråga]);
    const städer = searchCities(fråga);
    const markera = sökText || q;

    const visaStad = (slug: string) => {
        const c = städer.find(s => s.slug === slug);
        if (!c) return;
        väljStad(c);
        router.back();
    };

    return (
        <View style={styles.root}>
            <View style={styles.huvud}>
                <Text style={styles.rubrik}>Sök</Text>
                <Pressable onPress={() => router.back()} hitSlop={12} style={styles.stangKnapp} accessibilityLabel="Stäng">
                    <Text style={styles.stangText}>✕</Text>
                </Pressable>
            </View>
            <TextInput
                autoFocus
                style={styles.falt}
                placeholder={`Event eller ort - t.ex. "jazz i ${city.name}"`}
                placeholderTextColor="#94a3b8"
                value={fråga}
                onChangeText={setFråga}
                autoCorrect={false}
                autoCapitalize="none"
                clearButtonMode="while-editing"
                returnKeyType="search"
            />
            <View>
                <KategoriRad events={feed.data ?? []} />
            </View>
            <FlatList
                data={q ? träffar : []}
                keyExtractor={e => e.id}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                ListHeaderComponent={
                    städer.length > 0 && !sökOrt ? (
                        <View style={styles.städer}>
                            {städer.map(c => (
                                <Pressable
                                    key={c.slug}
                                    style={({ pressed }) => [styles.stadRad, pressed && styles.tryckt]}
                                    onPress={() => visaStad(c.slug)}
                                >
                                    <Text style={styles.stadNamn}>📍 {c.name}</Text>
                                    <Text style={styles.stadLänk}>Visa på kartan ›</Text>
                                </Pressable>
                            ))}
                        </View>
                    ) : null
                }
                ListEmptyComponent={
                    !q ? (
                        filter.aktivt ? (
                            <Pressable style={styles.kartKnapp} onPress={() => router.back()}>
                                <Text style={styles.kartKnappText}>Visa på kartan</Text>
                            </Pressable>
                        ) : (
                            <Text style={styles.tomt}>Skriv titel, plats eller ort - eller välj en kategori.</Text>
                        )
                    ) : feed.isLoading ? (
                        <Text style={styles.tomt}>Hämtar event …</Text>
                    ) : (
                        <Text style={styles.tomt}>
                            Inga träffar på "{fråga.trim()}"{filter.aktivt ? ' med filtret som är på' : ''}.
                        </Text>
                    )
                }
                renderItem={({ item }) => (
                    <EventRad
                        event={item}
                        fråga={markera}
                        km={minPos ? distanceKm(minPos.lat, minPos.lng, item.lat, item.lng) : null}
                        onPress={() => setValt(item)}
                    />
                )}
            />
            {valt ? <EventKort event={valt} grupp={[valt]} onClose={() => setValt(null)} /> : null}
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#f8fafc', paddingTop: 24 },
    huvud: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
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
    falt: {
        marginHorizontal: 16,
        marginTop: 16,
        backgroundColor: '#ffffff',
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        color: '#0f172a',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    städer: { paddingBottom: 6 },
    stadRad: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#e0f2fe',
        marginHorizontal: 16,
        marginVertical: 3,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 11,
    },
    stadNamn: { fontSize: 15, fontWeight: '700', color: '#0c4a6e' },
    stadLänk: { fontSize: 13, fontWeight: '700', color: '#0369a1' },
    tryckt: { opacity: 0.7 },
    tomt: { textAlign: 'center', color: '#64748b', marginTop: 32, paddingHorizontal: 24, fontSize: 14 },
    kartKnapp: {
        alignSelf: 'center',
        marginTop: 24,
        borderRadius: 999,
        backgroundColor: '#0f172a',
        paddingHorizontal: 22,
        paddingVertical: 12,
    },
    kartKnappText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
});
