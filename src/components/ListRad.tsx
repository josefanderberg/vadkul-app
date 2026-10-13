/**
 * En rad i listan under eventkortet - webbens NearbyRow (components/v2/
 * EventCard.tsx) med dess TVÅ layouter:
 *
 *  - MED BILD: bilden kant till kant överst (112 pt, webbens h-28), titeln
 *    OVANPÅ bilden med emojin till vänster och status-, VADKUL- och
 *    kategoribrickan i bildens högerkant, allt på en mörk gradient. Inforaden
 *    (avstånd · plats · tid) under bilden.
 *  - KOMPAKT: emoji-cirkel till vänster, titel + brickor, inforaden under.
 *
 * Bildflödet (kortets infovy) visar bara bildrader - en rad vars bild redan
 * är känd som trasig renderas inte alls där, och felar den medan raden syns
 * står ramen kvar tom så inget under hoppar (webbens keepFrame +
 * failedCoverImages, lib/listRad). Webbens viewport-koll (byta till kompakt
 * om raden ligger under kortets kant) har ingen motsvarighet här.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import type { AppFeedEvent } from '@vadkul/kontrakt';
import { ärEgetVadkulEvent, type AppEvent } from '@/lib/appEvent';
import { formatKm } from '@/lib/flerEvent';
import { kategoriFor } from '@/lib/kategorier';
import { eventStatus, harBild, markeraTrasigBild, STATUS_BRICKA, tidsHint } from '@/lib/listRad';

export function ListRad({
    event: e,
    km,
    nuMs,
    visaBild,
    baraMedBild = false,
    onPress,
}: {
    event: AppFeedEvent;
    km: number | null;
    nuMs: number;
    /** Bildlayouten när eventet har en bild (bildflödet, eller Visa bilder). */
    visaBild: boolean;
    /** Bildflödet: en rad utan visningsbar bild renderas inte alls. */
    baraMedBild?: boolean;
    onPress: () => void;
}) {
    // Känd trasig länk vid mount → bildlös direkt (webben: 'fallback').
    const [bildOk] = useState(() => harBild(e));
    const [bildFel, setBildFel] = useState(false);
    const medBild = visaBild && bildOk;
    if (baraMedBild && !medBild) return null;

    const k = kategoriFor(String(e.category));
    const emoji = e.emoji || k.emoji;
    const status = eventStatus(e, nuMs);
    const bricka = status === 'later' ? null : STATUS_BRICKA[status];
    const hint = tidsHint(e, nuMs);
    const vadkul = ärEgetVadkulEvent(e as AppEvent);

    const info = (
        <View style={styles.infoRad}>
            <Text style={styles.info} numberOfLines={1}>
                <Text style={styles.infoIkon}>📍 </Text>
                {km != null ? `${formatKm(km)}  ` : ''}
                <Text style={styles.infoPlats}>{e.locationName ?? ''}</Text>
            </Text>
            {hint ? <Text style={styles.infoTid} numberOfLines={1}>🕐 {hint}</Text> : null}
        </View>
    );
    const brickor = (påBild: boolean) => (
        <>
            {vadkul ? (
                <View style={[styles.bricka, styles.vadkulBricka]}>
                    <Text style={[styles.brickText, styles.vadkulText]}>VADKUL</Text>
                </View>
            ) : null}
            {bricka ? (
                <View style={[styles.bricka, { backgroundColor: bricka.bg }]}>
                    <Text style={[styles.brickText, { color: bricka.färg }]}>{bricka.text.toUpperCase()}</Text>
                </View>
            ) : null}
            {/* Kategorins KORTFORM nere till höger på bilden - samma ord som
                under markörerna på kartan (webben 16/9). Bara i bildlayouten. */}
            {påBild ? (
                <View style={[styles.bricka, styles.glasBricka]}>
                    <Text style={[styles.brickText, styles.glasText]}>{k.kort.toUpperCase()}</Text>
                </View>
            ) : null}
        </>
    );

    if (medBild) {
        return (
            <Pressable style={({ pressed }) => [styles.rad, pressed && styles.tryckt]} onPress={onPress}>
                <View style={styles.bildRam}>
                    {!bildFel ? (
                        <Image
                            source={{ uri: e.img }}
                            style={StyleSheet.absoluteFill}
                            contentFit="cover"
                            transition={120}
                            recyclingKey={e.id}
                            priority="low"
                            onError={() => {
                                if (e.img) markeraTrasigBild(e.img);
                                setBildFel(true);
                            }}
                        />
                    ) : null}
                    <View style={styles.bildToning} pointerEvents="none">
                        {/* Vit platta bakom emojin (Josef 13/10: "så att det är en
                            vitbakgrund på den, så ser man den tydligare. kanske
                            lite opacity") - på bildens mörka toning försvann den. */}
                        <View style={styles.bildEmojiPlatta}>
                            <Text style={styles.bildEmoji}>{emoji}</Text>
                        </View>
                        <Text style={styles.bildTitel} numberOfLines={1}>{e.title}</Text>
                        {brickor(true)}
                    </View>
                </View>
                <View style={styles.underBild}>
                    <View style={styles.flex}>{info}</View>
                    <Text style={styles.chevron}>›</Text>
                </View>
            </Pressable>
        );
    }

    return (
        <Pressable style={({ pressed }) => [styles.rad, styles.kompakt, pressed && styles.tryckt]} onPress={onPress}>
            <View style={[styles.emojiCirkel, vadkul && styles.emojiCirkelVadkul]}>
                <Text style={styles.emojiText}>{emoji}</Text>
            </View>
            <View style={styles.flex}>
                <View style={styles.titelRad}>
                    <Text style={styles.titel} numberOfLines={1}>{e.title}</Text>
                    {brickor(false)}
                </View>
                {info}
            </View>
            <Text style={styles.chevron}>›</Text>
        </Pressable>
    );
}

const KANT = '#e2e8f0';

const styles = StyleSheet.create({
    rad: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: KANT, backgroundColor: '#f8fafc' },
    tryckt: { backgroundColor: '#ffffff' },
    flex: { flex: 1, minWidth: 0 },
    bildRam: { height: 112, backgroundColor: KANT, overflow: 'hidden', justifyContent: 'flex-end' },
    /** Webbens bg-gradient-to-t from-black/75 via-black/35 to-transparent. */
    bildToning: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 16,
        paddingTop: 28,
        paddingBottom: 8,
        experimental_backgroundImage: 'linear-gradient(to top, rgba(0,0,0,0.75), rgba(0,0,0,0.35) 55%, rgba(0,0,0,0))',
    },
    bildEmojiPlatta: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: 'rgba(255,255,255,0.85)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    bildEmoji: { fontSize: 17 },
    bildTitel: {
        flex: 1,
        minWidth: 0,
        fontSize: 14,
        fontWeight: '900',
        color: '#ffffff',
        textShadowColor: 'rgba(0,0,0,0.8)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    underBild: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
    kompakt: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 16, paddingRight: 12, paddingVertical: 10 },
    emojiCirkel: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
    emojiCirkelVadkul: { backgroundColor: '#ecfdf5', borderWidth: 2, borderColor: 'rgba(52,211,153,0.8)' },
    emojiText: { fontSize: 18 },
    titelRad: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
    titel: { flexShrink: 1, fontSize: 14, fontWeight: '900', color: '#000000' },
    bricka: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
    brickText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
    vadkulBricka: { backgroundColor: '#10b981' },
    vadkulText: { color: '#ffffff' },
    glasBricka: { backgroundColor: 'rgba(255,255,255,0.25)' },
    glasText: { color: '#ffffff' },
    infoRad: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    info: { flexShrink: 1, fontSize: 11, fontWeight: '700', color: '#64748b' },
    infoIkon: { fontSize: 10 },
    infoPlats: { fontWeight: '700' },
    infoTid: { flexShrink: 0, fontSize: 11, fontWeight: '700', color: '#64748b' },
    chevron: { fontSize: 20, color: '#94a3b8', marginTop: -2 },
});
