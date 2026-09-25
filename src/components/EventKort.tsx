/**
 * Eventkortet — bottenkort när en bricka tappats. MVP: bild, titel, tid,
 * plats och EN knapp som öppnar eventet på vadkul.se (/e/<slug> — samma
 * delningssida som webben; den bär OG-bild och skickar vidare till källan).
 *
 * HÅRD REGEL (CLAUDE.md): appen säljer ingenting — här finns ingen boost,
 * inga priser. Utlänken går till eventets sida, punkt.
 */
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { eventShareSlug, type AppFeedEvent } from '@vadkul/kontrakt';
import { formatEventTid } from '@/lib/eventTid';

export function eventUrl(e: AppFeedEvent): string {
    return `https://vadkul.se/e/${eventShareSlug(e.id)}`;
}

export function EventKort({ event, onClose }: { event: AppFeedEvent; onClose: () => void }) {
    const tid = formatEventTid(event.time, event.hasSpecificTime);
    return (
        <View style={styles.kort}>
            {event.img ? (
                <Image source={{ uri: event.img }} style={styles.bild} contentFit="cover" transition={150} />
            ) : null}
            <View style={styles.rad}>
                <View style={styles.textkol}>
                    <Text style={styles.titel} numberOfLines={2}>{event.title}</Text>
                    <Text style={styles.meta} numberOfLines={1}>
                        {tid}{event.locationName ? ` · ${event.locationName}` : ''}
                    </Text>
                </View>
                <Pressable onPress={onClose} hitSlop={12} style={styles.stang} accessibilityLabel="Stäng">
                    <Text style={styles.stangText}>✕</Text>
                </Pressable>
            </View>
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
        backgroundColor: '#ffffff',
        borderRadius: 20,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 8,
    },
    bild: { width: '100%', height: 140 },
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
