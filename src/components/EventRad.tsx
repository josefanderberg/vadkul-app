/**
 * En eventrad - samma rad i kortets listor (mörk), sök, stadssidor och
 * sparade (ljus): bild (eller emoji-ruta), titel, plats + tid, kategori-
 * märke. Sökningen skickar `fråga` så träffen står i fetstil (webbens
 * highlightSegments). Passerade event dimmas i stället för att försvinna
 * där listan ändå visar dem (sparade).
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import type { AppFeedEvent } from '@vadkul/kontrakt';
import { formatEventTid } from '@/lib/eventTid';
import { formatKm } from '@/lib/flerEvent';
import { kategoriFor } from '@/lib/kategorier';
import { highlightSegments } from '@/lib/sok';
import { isTicketmasterEvent } from '@/lib/ticketmaster';

export function EventRad({
    event: e,
    onPress,
    tema = 'ljus',
    fråga,
    km,
    dimmad = false,
    höger,
}: {
    event: AppFeedEvent;
    onPress: () => void;
    tema?: 'ljus' | 'mörk';
    /** Normaliserad söktext - träffen i titeln i fetstil. */
    fråga?: string;
    /** Avstånd (från dig) att visa före platsen. */
    km?: number | null;
    dimmad?: boolean;
    /** Extra kontroll längst till höger (t.ex. hjärtat i sparade). */
    höger?: React.ReactNode;
}) {
    const k = kategoriFor(String(e.category));
    const emoji = e.emoji || k.emoji;
    const mörk = tema === 'mörk';
    const s = mörk ? mörkStil : ljusStil;
    const plats = [km != null ? formatKm(km) : null, e.locationName].filter(Boolean).join(' · ');
    return (
        <Pressable style={({ pressed }) => [s.rad, pressed && bas.tryckt, dimmad && bas.dimmad]} onPress={onPress}>
            {e.img ? (
                <Image source={{ uri: e.img }} style={bas.bild} contentFit="cover" transition={100} recyclingKey={e.id} />
            ) : (
                <View style={[bas.bild, s.bildTom]}>
                    <Text style={bas.bildEmoji}>{emoji}</Text>
                </View>
            )}
            <View style={bas.text}>
                <Text style={s.titel} numberOfLines={2}>
                    {emoji}{' '}
                    {fråga
                        ? highlightSegments(e.title, fråga).map((seg, i) => (
                            <Text key={i} style={seg.hit ? bas.träff : undefined}>{seg.text}</Text>
                        ))
                        : e.title}
                </Text>
                {plats ? <Text style={s.meta} numberOfLines={1}>📍 {plats}</Text> : null}
                <Text style={s.meta} numberOfLines={1}>
                    🕐 {formatEventTid(e.time, e.hasSpecificTime)}
                    {e.pop ? '  🔥' : ''}
                </Text>
            </View>
            {höger ?? (
                <View style={[bas.märke, { backgroundColor: isTicketmasterEvent(e) ? '#f0b42933' : `${k.hex}33` }]}>
                    <Text style={[bas.märkeText, { color: isTicketmasterEvent(e) ? '#f0b429' : k.hex }]}>
                        {k.kort.toUpperCase()}
                    </Text>
                </View>
            )}
        </Pressable>
    );
}

const bas = StyleSheet.create({
    tryckt: { opacity: 0.75 },
    dimmad: { opacity: 0.5 },
    bild: { width: 56, height: 56, borderRadius: 10 },
    bildEmoji: { fontSize: 24 },
    text: { flex: 1 },
    träff: { fontWeight: '900' },
    märke: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3 },
    märkeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
});

const mörkStil = StyleSheet.create({
    rad: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#22252d',
        marginHorizontal: 16,
        marginVertical: 4,
        borderRadius: 14,
        padding: 8,
    },
    bildTom: { backgroundColor: '#17191f', alignItems: 'center', justifyContent: 'center' },
    titel: { fontSize: 14, fontWeight: '700', color: '#f1f5f9' },
    meta: { marginTop: 2, fontSize: 12, fontWeight: '600', color: '#94a3b8' },
});

const ljusStil = StyleSheet.create({
    rad: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#ffffff',
        marginHorizontal: 16,
        marginVertical: 4,
        borderRadius: 14,
        padding: 8,
    },
    bildTom: { backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
    titel: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
    meta: { marginTop: 2, fontSize: 13, color: '#475569' },
});
