/**
 * Brickorna under dagplattan när ett filter är på (kart-ui 16/9 + 24/9):
 * "⚽ Sport ✕", "🔥 Populära ✕", "⛪ Svenska kyrkan ✕" - tryck släpper just
 * det valet. Syns ALLTID när filtret är på, så inget osynligt filter blir kvar.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFilter } from '@/lib/filterContext';
import { KÄLLOR } from '@/lib/kartFilter';
import { kategoriFor } from '@/lib/kategorier';

export function FilterBricka() {
    const f = useFilter();
    if (!f.aktivt) return null;
    const källa = f.källa ? KÄLLOR.find(k => k.key === f.källa) : null;
    const kat = f.kategori ? kategoriFor(f.kategori) : null;
    return (
        <View style={styles.rad} pointerEvents="box-none">
            {f.populärt ? <Bricka text="🔥 Populära" onPress={f.växlaPopulärt} /> : null}
            {kat && f.kategori ? <Bricka text={`${kat.emoji} ${kat.label}`} onPress={() => f.växlaKategori(f.kategori!)} /> : null}
            {källa ? <Bricka text={`${källa.emoji} ${källa.label}`} onPress={() => f.växlaKälla(källa.key)} /> : null}
        </View>
    );
}

function Bricka({ text, onPress }: { text: string; onPress: () => void }) {
    return (
        <Pressable onPress={onPress} style={({ pressed }) => [styles.bricka, pressed && styles.tryckt]}
            accessibilityLabel={`Släpp filtret ${text}`}>
            <Text style={styles.text}>{text} ✕</Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    rad: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 8 },
    bricka: {
        backgroundColor: '#ffffff',
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 6,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 5,
        shadowOffset: { width: 0, height: 2 },
        elevation: 4,
    },
    tryckt: { opacity: 0.75 },
    text: { fontSize: 13, fontWeight: '800', color: '#0f172a' },
});
