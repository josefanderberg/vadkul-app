/**
 * Eventkortet - dragbart MÖRKT bottenark, samma formspråk som webbens
 * LinkEventCard: blå titel, tid/plats-rad, värd, bild, beskrivning - och
 * under den "Scrolla ner för fler event" med webbens lista: chipsen
 * MÅNADEN/🔥 POPULÄRT och fler event sorterade på avstånd från det öppna
 * eventet (lib/flerEvent). Arkbeteendet är webbens (ETT stopp per gest,
 * lib/sheetSnap): öppnas i peek, dras upp för allt, dras ner för att
 * stänga. Dragytan är handtaget + huvudet; innehållet skrollar för sig.
 *
 * HÅRD REGEL (CLAUDE.md): appen säljer ingenting - ingen boost, inga
 * priser (webbens lista visar pris på raderna; appens gör det INTE).
 * ANMÄL öppnar källans egen sida, Dela delar /e/<slug>-länken.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { flerEventLista, formatKm, type FlerLäge } from '@/lib/flerEvent';
import { kategoriFor } from '@/lib/kategorier';
import { nästaLäge } from '@/lib/sheetSnap';

export function eventUrl(e: AppFeedEvent): string {
    return `https://vadkul.se/e/${eventShareSlug(e.id)}`;
}

/** Peek-lägets synliga höjd: handtag + tvåradig titel + tid/plats + chips + knappar. */
const PEEK_HÖJD = 268;

export function EventKort({
    event,
    onClose,
    alla = [],
    onVälj,
}: {
    event: AppFeedEvent;
    onClose: () => void;
    /** Flödet listan "fler event" hämtas ur (utan = ingen lista). */
    alla?: AppFeedEvent[];
    /** Byt öppet event när en rad i listan trycks. */
    onVälj?: (e: AppFeedEvent) => void;
}) {
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

    // Fler event-listan (webbens MÅNADEN/POPULÄRT-chips).
    const [läge, setLäge] = useState<FlerLäge>('månaden');
    const lista = useMemo(() => flerEventLista(alla, event, läge), [alla, event, läge]);
    const antalMånaden = useMemo(() => Math.max(0, alla.length - 1), [alla]);
    const antalPop = useMemo(
        () => alla.filter(e => e.pop === true && e.id !== event.id).length,
        [alla, event.id],
    );

    // Arket: translateY 0 = utfällt, peekOffset = peek. Läget bor i en ref
    // (PanResponder-callbacks lever mellan renders), onClose likaså.
    const arkLäge = useRef<'utfällt' | 'peek'>('peek');
    const translate = useRef(new Animated.Value(peekOffset)).current;
    const stäng = useRef(onClose);
    stäng.current = onClose;
    const scrollRef = useRef<ScrollView>(null);

    useEffect(() => {
        arkLäge.current = 'peek';
        scrollRef.current?.scrollTo({ y: 0, animated: false });
        Animated.spring(translate, { toValue: peekOffset, bounciness: 4, useNativeDriver: true }).start();
    }, [event.id, peekOffset, translate]);

    const pan = useMemo(() => {
        const till = (mål: 'utfällt' | 'peek' | 'stängt') => {
            if (mål === 'stängt') {
                stäng.current();
                return;
            }
            arkLäge.current = mål;
            Animated.spring(translate, {
                toValue: mål === 'utfällt' ? 0 : peekOffset,
                bounciness: 4,
                useNativeDriver: true,
            }).start();
        };
        return PanResponder.create({
            onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
            onPanResponderMove: (_e, g) => {
                const bas = arkLäge.current === 'utfällt' ? 0 : peekOffset;
                translate.setValue(Math.max(0, bas + g.dy));
            },
            onPanResponderRelease: (_e, g) => {
                const bas = arkLäge.current === 'utfällt' ? 0 : peekOffset;
                till(nästaLäge(arkLäge.current, Math.max(0, bas + g.dy), g.vy, peekOffset));
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
                        <Text style={styles.meta} numberOfLines={1}>🕐 {tid}</Text>
                        {event.locationName ? (
                            <Text style={styles.meta} numberOfLines={1}>📍 {event.locationName}</Text>
                        ) : null}
                    </View>
                    <Pressable onPress={onClose} hitSlop={12} style={styles.stang} accessibilityLabel="Stäng">
                        <Text style={styles.stangText}>✕</Text>
                    </Pressable>
                </View>
                <View style={styles.chipRad}>
                    <View style={[styles.chip, { backgroundColor: `${kat.hex}33` }]}>
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
                        <Text style={styles.anmälText}>ANMÄL →</Text>
                    </Pressable>
                ) : null}
                <Pressable
                    style={({ pressed }) => [styles.knapp, styles.delaKnapp, pressed && styles.knappTryckt]}
                    onPress={dela}
                >
                    <Text style={styles.delaText}>Dela</Text>
                </Pressable>
            </View>
            <ScrollView ref={scrollRef} style={styles.innehåll} contentContainerStyle={styles.innehållInre}>
                {event.img ? (
                    <Image source={{ uri: event.img }} style={styles.bild} contentFit="cover" transition={150} />
                ) : null}
                <Text style={styles.beskrivning}>{beskrivning}</Text>

                {lista.length > 0 || antalPop > 0 ? (
                    <>
                        <View style={styles.scrollaPill}>
                            <Text style={styles.scrollaText}>Fler event nedanför ⌄</Text>
                        </View>
                        <View style={styles.flerChipRad}>
                            <Pressable
                                onPress={() => setLäge('månaden')}
                                style={[styles.flerChip, läge === 'månaden' && styles.flerChipVald]}
                            >
                                <Text style={[styles.flerChipText, läge === 'månaden' && styles.flerChipTextVald]}>
                                    MÅNADEN · {antalMånaden}
                                </Text>
                            </Pressable>
                            <Pressable
                                onPress={() => setLäge('populärt')}
                                style={[styles.flerChip, läge === 'populärt' && styles.flerChipVald]}
                            >
                                <Text style={[styles.flerChipText, läge === 'populärt' && styles.flerChipTextVald]}>
                                    🔥 POPULÄRT · {antalPop}
                                </Text>
                            </Pressable>
                        </View>
                        {lista.map(({ event: e, km }) => {
                            const k = kategoriFor(String(e.category));
                            return (
                                <Pressable
                                    key={e.id}
                                    style={({ pressed }) => [styles.flerRad, pressed && styles.flerRadTryckt]}
                                    onPress={() => onVälj?.(e)}
                                >
                                    {e.img ? (
                                        <Image source={{ uri: e.img }} style={styles.flerBild} contentFit="cover" transition={100} />
                                    ) : (
                                        <View style={[styles.flerBild, styles.flerBildTom]}>
                                            <Text style={styles.flerBildEmoji}>{e.emoji || k.emoji}</Text>
                                        </View>
                                    )}
                                    <View style={styles.flerText}>
                                        <Text style={styles.flerTitel} numberOfLines={1}>
                                            {e.emoji || k.emoji} {e.title}
                                        </Text>
                                        <Text style={styles.flerMeta} numberOfLines={1}>
                                            📍 {formatKm(km)}
                                            {e.locationName ? ` · ${e.locationName}` : ''}
                                        </Text>
                                        <Text style={styles.flerMeta} numberOfLines={1}>
                                            🕐 {formatEventTid(e.time, e.hasSpecificTime)}
                                        </Text>
                                    </View>
                                    <View style={[styles.flerBadge, { backgroundColor: `${k.hex}33` }]}>
                                        <Text style={[styles.flerBadgeText, { color: k.hex }]}>{k.kort.toUpperCase()}</Text>
                                    </View>
                                </Pressable>
                            );
                        })}
                        {lista.length === 0 ? (
                            <Text style={styles.flerTomt}>Inga populära event i flödet just nu.</Text>
                        ) : null}
                    </>
                ) : null}
            </ScrollView>
        </Animated.View>
    );
}

const MÖRK_YTA = '#17191f';
const MÖRK_RAD = '#22252d';

const styles = StyleSheet.create({
    ark: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: MÖRK_YTA,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOpacity: 0.35,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: -4 },
        elevation: 14,
    },
    handtag: {
        alignSelf: 'center',
        width: 44,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#3f4650',
        marginTop: 10,
        marginBottom: 8,
    },
    rad: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16 },
    textkol: { flex: 1, paddingRight: 8 },
    titel: { fontSize: 18, fontWeight: '800', color: '#5aa2ff' },
    meta: { marginTop: 5, fontSize: 13, fontWeight: '600', color: '#cbd5e1' },
    stang: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: MÖRK_RAD,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stangText: { fontSize: 13, fontWeight: '700', color: '#cbd5e1' },
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
    popChip: { backgroundColor: 'rgba(249,115,22,0.25)' },
    popChipText: { color: '#fb923c' },
    värdChip: { backgroundColor: MÖRK_RAD, flexShrink: 1 },
    värdText: { color: '#cbd5e1' },
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
    anmälKnapp: { flex: 1.4, backgroundColor: '#2563eb' },
    anmälText: { color: '#ffffff', fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
    delaKnapp: { flex: 1, backgroundColor: MÖRK_RAD },
    delaText: { color: '#e2e8f0', fontSize: 15, fontWeight: '700' },
    innehåll: { flex: 1 },
    innehållInre: { paddingBottom: 32 },
    bild: { width: '100%', height: 180 },
    beskrivning: {
        paddingHorizontal: 16,
        paddingTop: 12,
        fontSize: 14,
        lineHeight: 21,
        color: '#e2e8f0',
    },
    scrollaPill: {
        alignSelf: 'center',
        marginTop: 16,
        borderRadius: 999,
        borderWidth: 1.5,
        borderColor: '#FECC02',
        paddingHorizontal: 18,
        paddingVertical: 8,
    },
    scrollaText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
    flerChipRad: {
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 6,
    },
    flerChip: {
        borderRadius: 999,
        backgroundColor: MÖRK_RAD,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    flerChipVald: { backgroundColor: '#ffffff' },
    flerChipText: { fontSize: 12, fontWeight: '800', color: '#cbd5e1', letterSpacing: 0.8 },
    flerChipTextVald: { color: '#0f172a' },
    flerRad: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: MÖRK_RAD,
        marginHorizontal: 16,
        marginVertical: 4,
        borderRadius: 14,
        padding: 8,
    },
    flerRadTryckt: { opacity: 0.75 },
    flerBild: { width: 56, height: 56, borderRadius: 10 },
    flerBildTom: { backgroundColor: MÖRK_YTA, alignItems: 'center', justifyContent: 'center' },
    flerBildEmoji: { fontSize: 24 },
    flerText: { flex: 1 },
    flerTitel: { fontSize: 14, fontWeight: '700', color: '#f1f5f9' },
    flerMeta: { marginTop: 2, fontSize: 12, fontWeight: '600', color: '#94a3b8' },
    flerBadge: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3 },
    flerBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
    flerTomt: { textAlign: 'center', color: '#94a3b8', marginTop: 16, fontSize: 13 },
});
