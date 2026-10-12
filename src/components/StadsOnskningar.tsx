/**
 * "✨ Önskas i X" som stadssidans avslut - webbens CityWishes
 * (app/(v1)/evenemang/). Josef 14/9: "ingen vill byta till en annan stad -
 * bättre att ha önskningar där": den som scrollat till slutet möts av synlig
 * efterfrågan med skapa-vägen bredvid. Urvalet bor i lib/onskningar
 * (önskningarNära), datat är kartans ['onskningar']-query (data/onskningar).
 *
 * "Skapa det här" öppnar skapa-arket med önskans titel, kategori och plats
 * och markerar önskan uppfylld när eventet skapats - samma väg som
 * önskebrickans "Arrangera det här" på kartan (webben skickar bara
 * &skapa=1 utan förifyllning).
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { kategoriFor } from '@/lib/kategorier';
import { ÖNSKE_LIVSLÄNGD_DAGAR, önskansÅlder, type Önskan } from '@/lib/onskningar';

const BLÅ = '#006AA7';

export function StadsOnskningar({
    stadsnamn,
    önskningar,
    nuMs,
    onÖnska,
    onSkapaFrån,
}: {
    stadsnamn: string;
    /** null = hämtar fortfarande - rendera ingenting (inget hoppigt skelett långt ner på sidan). */
    önskningar: readonly Önskan[] | null;
    nuMs: number;
    onÖnska: () => void;
    onSkapaFrån: (w: Önskan) => void;
}) {
    if (!önskningar) return null;

    return (
        <View style={styles.ruta}>
            <Text style={styles.rubrik}>✨ Önskas i {stadsnamn}</Text>
            {önskningar.length === 0 ? (
                <>
                    <Text style={styles.text}>
                        Inga önskningar just nu. Saknar du något i {stadsnamn} - en quizkväll, en loppis, en löprunda?
                        Önska det, så syns det som en egen bricka på kartan för alla i {ÖNSKE_LIVSLÄNGD_DAGAR} dagar.
                        Kanske är det någon annan som ordnar det.
                    </Text>
                    <Pressable onPress={onÖnska} style={({ pressed }) => [styles.knapp, pressed && styles.tryckt]}>
                        <Text style={styles.knappText}>Önska ett event ✨</Text>
                    </Pressable>
                </>
            ) : (
                <>
                    <Text style={styles.text}>
                        Det här vill folk i {stadsnamn} att någon ordnar. Är det du? Skapa eventet - gratis, och det
                        hamnar överst på den här sidan.
                    </Text>
                    <View style={styles.lista}>
                        {önskningar.map(w => (
                            <View key={w.id} style={styles.rad}>
                                <Text style={styles.emoji}>{kategoriFor(w.category).emoji}</Text>
                                <View style={styles.radText}>
                                    <Text style={styles.titel}>{w.title}</Text>
                                    {w.description ? (
                                        <Text style={styles.beskrivning} numberOfLines={1}>{w.description}</Text>
                                    ) : null}
                                    <Text style={styles.ålder}>Önskades {önskansÅlder(w.createdAt, nuMs)}</Text>
                                </View>
                                <Pressable
                                    onPress={() => onSkapaFrån(w)}
                                    style={({ pressed }) => [styles.skapa, pressed && styles.tryckt]}
                                >
                                    <Text style={styles.skapaText}>Skapa det här</Text>
                                </Pressable>
                            </View>
                        ))}
                    </View>
                    <Text style={styles.fot}>
                        Saknar du något annat?{' '}
                        <Text style={styles.fotLänk} onPress={onÖnska}>Önska det</Text>
                        {' '}- syns för alla i {ÖNSKE_LIVSLÄNGD_DAGAR} dagar.
                    </Text>
                </>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    tryckt: { opacity: 0.8 },
    ruta: {
        marginTop: 32,
        borderRadius: 24,
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: 'rgba(0,106,167,0.3)',
        backgroundColor: 'rgba(240,249,255,0.6)',
        paddingHorizontal: 18,
        paddingVertical: 20,
    },
    rubrik: { fontSize: 20, fontWeight: '900', color: '#0f172a' },
    text: { marginTop: 8, fontSize: 14, lineHeight: 21, fontWeight: '500', color: '#475569' },
    knapp: { marginTop: 14, alignSelf: 'flex-start', borderRadius: 999, backgroundColor: BLÅ, paddingHorizontal: 18, paddingVertical: 10 },
    knappText: { color: '#ffffff', fontSize: 14, fontWeight: '900' },
    lista: { marginTop: 14, gap: 8 },
    rad: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        backgroundColor: '#ffffff',
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    emoji: { fontSize: 20, alignSelf: 'flex-start' },
    radText: { flex: 1 },
    titel: { fontSize: 14, fontWeight: '900', color: '#0f172a' },
    beskrivning: { fontSize: 12, fontWeight: '500', color: '#64748b' },
    ålder: { marginTop: 2, fontSize: 11, fontWeight: '600', color: '#94a3b8' },
    skapa: { borderRadius: 999, backgroundColor: '#FECC02', paddingHorizontal: 13, paddingVertical: 7 },
    skapaText: { fontSize: 12, fontWeight: '900', color: '#052846' },
    fot: { marginTop: 12, fontSize: 11, fontWeight: '500', color: '#64748b' },
    fotLänk: { color: BLÅ, textDecorationLine: 'underline' },
});
