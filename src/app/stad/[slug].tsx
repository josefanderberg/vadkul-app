/**
 * Stadssidan - appens motsvarighet till webbens /evenemang/<stad>: ortens
 * event (<= 10 km, inte länets) dagsgrupperade i 14 dagar, med "Visa på
 * kartan" som lägger staden på kartan. Rad öppnar eventkortet som ark.
 */
import { useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CITIES, type AppFeedEvent } from '@vadkul/kontrakt';
import { useAppFeed } from '@/api/appFeed';
import { EventKort } from '@/components/EventKort';
import { formatEventTid } from '@/lib/eventTid';
import { kategoriFor } from '@/lib/kategorier';
import { useRegionVal } from '@/lib/regionContext';
import { grupperaPerDag, stadensEvent } from '@/lib/stadsUtbud';

export default function StadScreen() {
    const { slug } = useLocalSearchParams<{ slug: string }>();
    const stad = CITIES.find(c => c.slug === slug);
    const { väljStad } = useRegionVal();
    const feed = useAppFeed(stad?.region ?? '');
    const [valt, setValt] = useState<AppFeedEvent | null>(null);

    if (!stad) {
        return (
            <View style={styles.root}>
                <Text style={styles.rubrik}>Okänd stad</Text>
            </View>
        );
    }

    const iOrten = stadensEvent(feed.data?.events ?? [], stad);
    const sektioner = grupperaPerDag(iOrten);

    const visaPåKartan = () => {
        väljStad(stad);
        router.dismissTo('/');
    };

    return (
        <View style={styles.root}>
            <View style={styles.huvud}>
                <View style={styles.huvudText}>
                    <Text style={styles.rubrik}>{stad.name}</Text>
                    <Text style={styles.underRubrik}>
                        {feed.isLoading ? 'Hämtar event …' : `${iOrten.length} event i orten · 14 dagar`}
                    </Text>
                </View>
                <Pressable onPress={() => router.back()} hitSlop={12} style={styles.stang} accessibilityLabel="Tillbaka">
                    <Text style={styles.stangText}>✕</Text>
                </Pressable>
            </View>
            <Pressable style={({ pressed }) => [styles.kartKnapp, pressed && styles.tryckt]} onPress={visaPåKartan}>
                <Text style={styles.kartKnappText}>🗺️ Visa på kartan</Text>
            </Pressable>
            <SectionList
                sections={sektioner}
                keyExtractor={(e) => e.id}
                stickySectionHeadersEnabled
                ListEmptyComponent={
                    feed.isLoading ? null : (
                        <Text style={styles.tomt}>Inga event i {stad.name} de närmaste 14 dagarna.</Text>
                    )
                }
                renderSectionHeader={({ section }) => (
                    <Text style={styles.dagRubrik}>{section.label}</Text>
                )}
                renderItem={({ item }) => {
                    const kat = kategoriFor(String(item.category));
                    return (
                        <Pressable
                            style={({ pressed }) => [styles.rad, pressed && styles.tryckt]}
                            onPress={() => setValt(item)}
                        >
                            <Text style={styles.radEmoji}>{item.emoji || kat.emoji}</Text>
                            <View style={styles.radText}>
                                <Text style={styles.radTitel} numberOfLines={1}>{item.title}</Text>
                                <Text style={styles.radMeta} numberOfLines={1}>
                                    {formatEventTid(item.time, item.hasSpecificTime)}
                                    {item.locationName ? ` · ${item.locationName}` : ''}
                                </Text>
                            </View>
                            {item.pop ? <Text style={styles.pop}>🔥</Text> : null}
                        </Pressable>
                    );
                }}
            />
            {valt && <EventKort event={valt} onClose={() => setValt(null)} alla={iOrten} onVälj={setValt} />}
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#f8fafc', paddingTop: 64 },
    huvud: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16 },
    huvudText: { flex: 1 },
    rubrik: { fontSize: 24, fontWeight: '800', color: '#0f172a' },
    underRubrik: { marginTop: 2, fontSize: 13, color: '#475569' },
    stang: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#e2e8f0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    stangText: { fontSize: 13, fontWeight: '700', color: '#475569' },
    kartKnapp: {
        margin: 16,
        marginBottom: 8,
        borderRadius: 999,
        backgroundColor: '#0f172a',
        paddingVertical: 11,
        alignItems: 'center',
    },
    kartKnappText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
    tryckt: { opacity: 0.75 },
    tomt: { textAlign: 'center', color: '#64748b', marginTop: 32, paddingHorizontal: 24, fontSize: 14 },
    dagRubrik: {
        backgroundColor: '#f8fafc',
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 6,
        fontSize: 13,
        fontWeight: '800',
        color: '#334155',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
    rad: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#ffffff',
        marginHorizontal: 16,
        marginVertical: 3,
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    radEmoji: { fontSize: 24 },
    radText: { flex: 1 },
    radTitel: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
    radMeta: { marginTop: 2, fontSize: 13, color: '#475569' },
    pop: { fontSize: 16 },
});
