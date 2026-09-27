/**
 * Eventsöket: fritext mot regionens hela 14-dagarsflöde (titel + plats,
 * rankningen i lib/sok - titeln väger tyngst, webbens läxa). Träff öppnar
 * eventkortet direkt här som ark, precis som på kartan.
 */
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import type { AppFeedEvent } from '@vadkul/kontrakt';
import { useAppFeed } from '@/api/appFeed';
import { EventKort } from '@/components/EventKort';
import { formatEventTid } from '@/lib/eventTid';
import { kategoriFor } from '@/lib/kategorier';
import { useRegionVal } from '@/lib/regionContext';
import { sokEvent } from '@/lib/sok';

export default function SokScreen() {
    const { city, region } = useRegionVal();
    const feed = useAppFeed(region);
    const [fråga, setFråga] = useState('');
    const [valt, setValt] = useState<AppFeedEvent | null>(null);

    const träffar = sokEvent(feed.data?.events ?? [], fråga);

    return (
        <View style={styles.root}>
            <View style={styles.huvud}>
                <Text style={styles.rubrik}>Sök event</Text>
                <Pressable onPress={() => router.back()} hitSlop={12} style={styles.stangKnapp} accessibilityLabel="Stäng">
                    <Text style={styles.stangText}>✕</Text>
                </Pressable>
            </View>
            <TextInput
                autoFocus
                style={styles.falt}
                placeholder={`Sök bland ${feed.data?.events.length ?? 0} event i ${city.name}s län …`}
                placeholderTextColor="#94a3b8"
                value={fråga}
                onChangeText={setFråga}
                autoCorrect={false}
                clearButtonMode="while-editing"
            />
            <FlatList
                data={träffar}
                keyExtractor={(e) => e.id}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                    fråga.trim() ? (
                        <Text style={styles.tomt}>Inga träffar på "{fråga.trim()}".</Text>
                    ) : (
                        <Text style={styles.tomt}>Skriv för att söka på titel eller plats.</Text>
                    )
                }
                renderItem={({ item }) => {
                    const kat = kategoriFor(String(item.category));
                    return (
                        <Pressable style={({ pressed }) => [styles.radKort, pressed && styles.radTryckt]} onPress={() => setValt(item)}>
                            <Text style={styles.radEmoji}>{item.emoji || kat.emoji}</Text>
                            <View style={styles.radText}>
                                <Text style={styles.radTitel} numberOfLines={1}>{item.title}</Text>
                                <Text style={styles.radMeta} numberOfLines={1}>
                                    {formatEventTid(item.time, item.hasSpecificTime)}
                                    {item.locationName ? ` · ${item.locationName}` : ''}
                                </Text>
                            </View>
                        </Pressable>
                    );
                }}
            />
            {valt && <EventKort event={valt} onClose={() => setValt(null)} />}
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
    tomt: { textAlign: 'center', color: '#64748b', marginTop: 32, paddingHorizontal: 24, fontSize: 14 },
    radKort: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#ffffff',
        marginHorizontal: 16,
        marginVertical: 4,
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    radTryckt: { opacity: 0.7 },
    radEmoji: { fontSize: 24 },
    radText: { flex: 1 },
    radTitel: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
    radMeta: { marginTop: 2, fontSize: 13, color: '#475569' },
});
