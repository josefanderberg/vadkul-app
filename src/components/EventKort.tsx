/**
 * Eventkortet - bottenkort när en bricka tappats. Samma innehållshierarki som
 * webbens kort (LinkEventCard): bild med 🔥-märke, emoji+titel, tid/plats,
 * kategori- och värdchip, beskrivning och EN knapp som öppnar eventet på
 * vadkul.se (/e/<slug> - delningssidan; den bär OG-bild och skickar vidare
 * till källan). Beskrivning + värdnamn finns inte i det bantade appflödet
 * utan hämtas per event via useEventDetalj när kortet öppnas.
 *
 * HÅRD REGEL (CLAUDE.md): appen säljer ingenting - här finns ingen boost,
 * inga priser. Utlänken går till eventets sida, punkt.
 */
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { eventShareSlug, type AppFeedEvent } from '@vadkul/kontrakt';
import { useEventDetalj } from '@/api/eventDetalj';
import { descriptionText, hostLabelFor } from '@/lib/eventDetalj';
import { formatEventTid } from '@/lib/eventTid';
import { kategoriFor } from '@/lib/kategorier';

export function eventUrl(e: AppFeedEvent): string {
    return `https://vadkul.se/e/${eventShareSlug(e.id)}`;
}

export function EventKort({ event, onClose }: { event: AppFeedEvent; onClose: () => void }) {
    const detalj = useEventDetalj(event.id);
    const kat = kategoriFor(String(event.category));
    const emoji = event.emoji || kat.emoji;

    let tid = formatEventTid(event.time, event.hasSpecificTime);
    if (event.endDate) tid += ` – ${formatEventTid(event.endDate, false)}`;

    const värd = hostLabelFor(detalj.data?.hostName, detalj.data?.url ?? event.url ?? event.id);
    const beskrivning = descriptionText(detalj.data?.description, detalj.isLoading);

    return (
        <View style={styles.kort}>
            {event.img ? (
                <View>
                    <Image source={{ uri: event.img }} style={styles.bild} contentFit="cover" transition={150} />
                    {event.pop && (
                        <View style={styles.popMärke}>
                            <Text style={styles.popText}>🔥 Populär</Text>
                        </View>
                    )}
                </View>
            ) : null}
            <View style={styles.rad}>
                <View style={styles.textkol}>
                    <Text style={styles.titel} numberOfLines={2}>{emoji} {event.title}</Text>
                    <Text style={styles.meta} numberOfLines={1}>{tid}</Text>
                    {event.locationName ? (
                        <Text style={styles.meta} numberOfLines={1}>📍 {event.locationName}</Text>
                    ) : null}
                </View>
                <Pressable onPress={onClose} hitSlop={12} style={styles.stang} accessibilityLabel="Stäng">
                    <Text style={styles.stangText}>✕</Text>
                </Pressable>
            </View>
            <View style={styles.chipRad}>
                <View style={[styles.chip, { backgroundColor: `${kat.hex}1F` }]}>
                    <Text style={[styles.chipText, { color: kat.hex }]}>{kat.emoji} {kat.label}</Text>
                </View>
                {!event.img && event.pop ? (
                    <View style={[styles.chip, styles.popChip]}>
                        <Text style={[styles.chipText, styles.popChipText]}>🔥 Populär</Text>
                    </View>
                ) : null}
                <View style={[styles.chip, styles.värdChip]}>
                    <Text style={[styles.chipText, styles.värdText]} numberOfLines={1}>{värd}</Text>
                </View>
            </View>
            <ScrollView style={styles.beskrivningYta} contentContainerStyle={styles.beskrivningInre}>
                <Text style={styles.beskrivning}>{beskrivning}</Text>
            </ScrollView>
            <Pressable
                style={({ pressed }) => [styles.knapp, pressed && styles.knappTryckt]}
                onPress={() => WebBrowser.openBrowserAsync(eventUrl(event))}
            >
                <Text style={styles.knappText}>Läs mer på VADKUL</Text>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    kort: {
        position: 'absolute',
        left: 12,
        right: 12,
        bottom: 24,
        maxHeight: '78%',
        backgroundColor: '#ffffff',
        borderRadius: 20,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 8,
    },
    bild: { width: '100%', height: 150 },
    popMärke: {
        position: 'absolute',
        top: 10,
        left: 10,
        backgroundColor: 'rgba(255,255,255,0.94)',
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    popText: { fontSize: 12, fontWeight: '700', color: '#c2410c' },
    rad: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingTop: 12 },
    textkol: { flex: 1, paddingRight: 8 },
    titel: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
    meta: { marginTop: 4, fontSize: 13, fontWeight: '500', color: '#475569' },
    stang: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    stangText: { fontSize: 13, fontWeight: '700', color: '#475569' },
    chipRad: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 16,
        paddingTop: 10,
    },
    chip: {
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
        maxWidth: '55%',
    },
    chipText: { fontSize: 12, fontWeight: '700' },
    popChip: { backgroundColor: '#ffedd5' },
    popChipText: { color: '#c2410c' },
    värdChip: { backgroundColor: '#f1f5f9', flexShrink: 1 },
    värdText: { color: '#475569' },
    beskrivningYta: { maxHeight: 150, marginTop: 10 },
    beskrivningInre: { paddingHorizontal: 16, paddingBottom: 2 },
    beskrivning: { fontSize: 14, lineHeight: 20, color: '#1e293b' },
    knapp: {
        margin: 16,
        marginTop: 12,
        borderRadius: 999,
        backgroundColor: '#0f172a',
        paddingVertical: 12,
        alignItems: 'center',
    },
    knappTryckt: { opacity: 0.85 },
    knappText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
});
