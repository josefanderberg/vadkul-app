/**
 * Eventkortet - dragbart bottenark med webbens innehåll (LinkEventCard) och
 * webbens arkbeteende (ETT stopp per gest, lib/sheetSnap): öppnas i
 * peek-läget (handtag, titel, tid/plats, chips, knappar), dras upp för bild
 * och beskrivning, dras ner för att stänga. Dragytan är handtaget + huvudet
 * och bilden - beskrivningen skrollar för sig. Beskrivning + värdnamn hämtas
 * per event via useEventDetalj (appflödet är bantat).
 *
 * HÅRD REGEL (CLAUDE.md): appen säljer ingenting - ingen boost, inga priser.
 * ANMÄL öppnar källans egen sida (webbens eventOutlink-logik) och Dela delar
 * /e/<slug>-länken - inget mer.
 */
import { useEffect, useMemo, useRef } from 'react';
import {
    Animated,
    PanResponder,
    Pressable,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from 'react-native';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { eventShareSlug, type AppFeedEvent } from '@vadkul/kontrakt';
import { useEventDetalj } from '@/api/eventDetalj';
import { descriptionText, eventOutlink, hostLabelFor } from '@/lib/eventDetalj';
import { formatEventTid } from '@/lib/eventTid';
import { kategoriFor } from '@/lib/kategorier';
import { nästaLäge } from '@/lib/sheetSnap';

export function eventUrl(e: AppFeedEvent): string {
    return `https://vadkul.se/e/${eventShareSlug(e.id)}`;
}

/** Peek-lägets synliga höjd: handtag + tvåradig titel + tid/plats + chips + knappar. */
const PEEK_HÖJD = 268;

export function EventKort({ event, onClose }: { event: AppFeedEvent; onClose: () => void }) {
    const { height: fönsterHöjd } = useWindowDimensions();
    const utfälldHöjd = Math.round(fönsterHöjd * 0.85);
    const peekOffset = Math.max(0, utfälldHöjd - PEEK_HÖJD);

    const detalj = useEventDetalj(event.id);
    const kat = kategoriFor(String(event.category));
    const emoji = event.emoji || kat.emoji;

    let tid = formatEventTid(event.time, event.hasSpecificTime);
    if (event.endDate) tid += ` - ${formatEventTid(event.endDate, false)}`;

    const värd = hostLabelFor(detalj.data?.hostName, detalj.data?.url ?? event.url ?? event.id);
    const beskrivning = descriptionText(detalj.data?.description, detalj.isLoading);
    const anmälUrl = eventOutlink(event.id, detalj.data?.url ?? event.url);

    // Arket: translateY 0 = utfällt, peekOffset = peek. Läget bor i en ref
    // (PanResponder-callbacks lever mellan renders), onClose likaså.
    const läge = useRef<'utfällt' | 'peek'>('peek');
    const translate = useRef(new Animated.Value(peekOffset)).current;
    const stäng = useRef(onClose);
    stäng.current = onClose;

    useEffect(() => {
        läge.current = 'peek';
        Animated.spring(translate, { toValue: peekOffset, bounciness: 4, useNativeDriver: true }).start();
    }, [event.id, peekOffset, translate]);

    const pan = useMemo(() => {
        const till = (mål: 'utfällt' | 'peek' | 'stängt') => {
            if (mål === 'stängt') {
                stäng.current();
                return;
            }
            läge.current = mål;
            Animated.spring(translate, {
                toValue: mål === 'utfällt' ? 0 : peekOffset,
                bounciness: 4,
                useNativeDriver: true,
            }).start();
        };
        return PanResponder.create({
            onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
            onPanResponderMove: (_e, g) => {
                const bas = läge.current === 'utfällt' ? 0 : peekOffset;
                translate.setValue(Math.max(0, bas + g.dy));
            },
            onPanResponderRelease: (_e, g) => {
                const bas = läge.current === 'utfällt' ? 0 : peekOffset;
                till(nästaLäge(läge.current, Math.max(0, bas + g.dy), g.vy, peekOffset));
            },
        });
    }, [peekOffset, translate]);

    const dela = () =>
        Share.share({ title: event.title, message: `${event.title} - ${eventUrl(event)}`, url: eventUrl(event) });

    return (
        <Animated.View style={[styles.ark, { height: utfälldHöjd, transform: [{ translateY: translate }] }]}>
            <View {...pan.panHandlers}>
                <View style={styles.handtag} />
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
                    {event.pop ? (
                        <View style={[styles.chip, styles.popChip]}>
                            <Text style={[styles.chipText, styles.popChipText]}>🔥 Populär</Text>
                        </View>
                    ) : null}
                    <View style={[styles.chip, styles.värdChip]}>
                        <Text style={[styles.chipText, styles.värdText]} numberOfLines={1}>{värd}</Text>
                    </View>
                </View>
            </View>
            <View style={styles.knappRad}>
                {anmälUrl ? (
                    <Pressable
                        style={({ pressed }) => [styles.knapp, styles.anmälKnapp, pressed && styles.knappTryckt]}
                        onPress={() => WebBrowser.openBrowserAsync(anmälUrl)}
                    >
                        <Text style={styles.anmälText}>ANMÄL</Text>
                    </Pressable>
                ) : null}
                <Pressable
                    style={({ pressed }) => [styles.knapp, styles.delaKnapp, pressed && styles.knappTryckt]}
                    onPress={dela}
                >
                    <Text style={styles.delaText}>Dela</Text>
                </Pressable>
            </View>
            {event.img ? (
                <View {...pan.panHandlers}>
                    <Image source={{ uri: event.img }} style={styles.bild} contentFit="cover" transition={150} />
                </View>
            ) : null}
            <ScrollView style={styles.beskrivningYta} contentContainerStyle={styles.beskrivningInre}>
                <Text style={styles.beskrivning}>{beskrivning}</Text>
            </ScrollView>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    ark: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#ffffff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: -4 },
        elevation: 12,
    },
    handtag: {
        alignSelf: 'center',
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#cbd5e1',
        marginTop: 8,
        marginBottom: 6,
    },
    rad: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16 },
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
        maxWidth: '48%',
    },
    chipText: { fontSize: 12, fontWeight: '700' },
    popChip: { backgroundColor: '#ffedd5' },
    popChipText: { color: '#c2410c' },
    värdChip: { backgroundColor: '#f1f5f9', flexShrink: 1 },
    värdText: { color: '#475569' },
    knappRad: {
        flexDirection: 'row',
        gap: 10,
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 12,
    },
    knapp: {
        borderRadius: 999,
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    knappTryckt: { opacity: 0.85 },
    anmälKnapp: { flex: 1, backgroundColor: '#0f172a' },
    anmälText: { color: '#ffffff', fontSize: 15, fontWeight: '700', letterSpacing: 0.5 },
    delaKnapp: { flex: 1, backgroundColor: '#f1f5f9' },
    delaText: { color: '#0f172a', fontSize: 15, fontWeight: '700' },
    bild: { width: '100%', height: 170 },
    beskrivningYta: { flex: 1, marginTop: 12 },
    beskrivningInre: { paddingHorizontal: 16, paddingBottom: 28 },
    beskrivning: { fontSize: 14, lineHeight: 20, color: '#1e293b' },
});
