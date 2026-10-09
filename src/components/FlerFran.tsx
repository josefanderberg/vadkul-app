/**
 * "Fler från samma arrangör" + stadssidelänken - webbens CardMoreRows
 * (ägarbeslut 6/10): sidledsrullande rad med max 12 kommande från samma
 * arrangör (urvalet i lib/arrangorsRad - källdomänen, se app-anpassningen
 * där), brickor med BILD-FYRKANT till vänster ("bilder i dem också om det
 * finns, fast i en fyrkant åt vänster") och emoji-fyrkant som reserv,
 * "Alla event från {namn} →" när sluggen finns (appens arrangörsskärm
 * src/app/arrangor sedan 8/10, förr webbens sida), och under raden länken till
 * stadssidan (appens /stad/<slug>). Webbens ?q=-medföljning till stadssidan
 * utelämnas - appens stadsskärm har inget sökfält än. Bara i infovyn
 * (EventKort gömmer raden under kortsökning).
 */
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import type { AppFeedEvent } from '@vadkul/kontrakt';
import type { ArrangörsRad } from '@/lib/arrangorsRad';
import { formatEventTid } from '@/lib/eventTid';
import { kategoriFor } from '@/lib/kategorier';

export function FlerFran({
    rad,
    stad,
    stadAntal,
    onVälj,
}: {
    /** null = ingen arrangörsrad (lib/arrangorsRad) - stadslänken visas ändå. */
    rad: ArrangörsRad | null;
    /** Stadssidelänken - utelämnas på stadsskärmen (man är redan där). */
    stad: { slug: string; name: string } | null;
    /** Månaden-flikens tal - underraden i stadsknappen (7/10 kväll). */
    stadAntal: number | null;
    onVälj: (e: AppFeedEvent) => void;
}) {
    if (!rad && !stad) return null;
    return (
        <View style={styles.yta}>
            {rad ? (
                <View style={styles.radYta}>
                    <View style={styles.rubrikRad}>
                        <Text style={styles.rubrik} numberOfLines={1}>FLER FRÅN {rad.namn.toUpperCase()}</Text>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.brickRad}>
                        {rad.rader.map(e => (
                            <Pressable
                                key={e.id}
                                onPress={() => onVälj(e)}
                                style={({ pressed }) => [styles.bricka, pressed && styles.tryckt]}
                            >
                                {e.img ? (
                                    <Image source={{ uri: e.img }} style={styles.bild} contentFit="cover" transition={100} />
                                ) : (
                                    <View style={styles.emojiFyrkant}>
                                        <Text style={styles.emoji}>{e.emoji || kategoriFor(String(e.category)).emoji}</Text>
                                    </View>
                                )}
                                <View style={styles.brickText}>
                                    <Text style={styles.brickTid} numberOfLines={1}>
                                        {formatEventTid(e.time, e.hasSpecificTime).toUpperCase()}
                                    </Text>
                                    <Text style={styles.brickTitel} numberOfLines={2}>{e.title}</Text>
                                </View>
                            </Pressable>
                        ))}
                    </ScrollView>
                    {/* Konturknapp i stället för den lilla textlänken
                        (ägarbeslut 7/10 kväll) - sekundär, så den blå
                        stadsknappen behåller tyngden. */}
                    {rad.slug ? (
                        <Pressable
                            onPress={() => router.push({ pathname: '/arrangor/[slug]', params: { slug: rad.slug! } })}
                            style={({ pressed }) => [styles.arrangörKnapp, pressed && styles.tryckt]}
                        >
                            <Text style={styles.arrangörText} numberOfLines={1}>Alla event från {rad.namn} →</Text>
                        </Pressable>
                    ) : null}
                </View>
            ) : null}
            {stad ? (
                /* Riktig knapp, inte en textlänk (ägarbeslut 7/10 kväll:
                   "mer av en knapp som visar hur många de är kommande
                   månaden i den staden"). */
                <Pressable
                    onPress={() => router.push(`/stad/${stad.slug}`)}
                    style={({ pressed }) => [styles.stadKnapp, pressed && styles.tryckt]}
                >
                    <Text style={styles.stadText}>Allt som händer i {stad.name} →</Text>
                    {stadAntal != null ? (
                        <Text style={styles.stadAntal}>{stadAntal} event kommande månaden</Text>
                    ) : null}
                </Pressable>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    yta: { marginTop: 14, borderTopWidth: 1, borderTopColor: '#2a2e37' },
    radYta: { paddingTop: 12 },
    rubrikRad: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        paddingHorizontal: 16,
        marginBottom: 8,
    },
    rubrik: { flex: 1, fontSize: 11, fontWeight: '800', color: '#94a3b8', letterSpacing: 1 },
    sidLänk: { fontSize: 11, fontWeight: '800', color: '#5aa2ff', letterSpacing: 1 },
    brickRad: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
    bricka: {
        width: 210,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#2a2e37',
        backgroundColor: '#22252d',
        padding: 8,
    },
    bild: { width: 48, height: 48, borderRadius: 8, backgroundColor: '#2a2e37' },
    emojiFyrkant: {
        width: 48,
        height: 48,
        borderRadius: 8,
        backgroundColor: '#17191f',
        borderWidth: 1,
        borderColor: '#2a2e37',
        alignItems: 'center',
        justifyContent: 'center',
    },
    emoji: { fontSize: 22 },
    brickText: { flex: 1 },
    brickTid: { fontSize: 10, fontWeight: '800', color: '#94a3b8', letterSpacing: 0.8 },
    brickTitel: { marginTop: 2, fontSize: 12, fontWeight: '700', color: '#e2e8f0', lineHeight: 16 },
    arrangörKnapp: {
        marginTop: 10,
        marginHorizontal: 16,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#3f4650',
        paddingVertical: 9,
        alignItems: 'center',
    },
    arrangörText: { fontSize: 13, fontWeight: '800', color: '#cbd5e1' },
    stadKnapp: {
        marginTop: 14,
        marginHorizontal: 16,
        marginBottom: 2,
        borderRadius: 14,
        backgroundColor: '#006AA7',
        paddingVertical: 11,
        paddingHorizontal: 14,
        alignItems: 'center',
    },
    stadText: { fontSize: 14, fontWeight: '800', color: '#ffffff' },
    stadAntal: { marginTop: 2, fontSize: 12, fontWeight: '600', color: '#cfe4f5' },
    tryckt: { opacity: 0.8 },
});
