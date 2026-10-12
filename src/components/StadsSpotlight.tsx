/**
 * "Skapade på VADKUL" överst på stadssidan - webbens CityVadkulSpotlight
 * (app/(v1)/evenemang/). Raderna räknas i lib/stadsSpotlight ur appens redan
 * hämtade användarskapade event.
 *
 *  - Ram per rad (Josef 6/9): grön = arrangerat på VADKUL (samma gröna som
 *    kartbrickan), blå = tips. Skapat/Tipsat-märket uppe till vänster på
 *    bildkortet, i högerkolumnen på den kompakta raden.
 *  - Bildkort när eventet har bild, annars kompakt emoji-rad.
 *  - Tryck öppnar eventet PÅ KARTAN (lib/kartHopp, som listans rader) i
 *    stället för webbens utfällning på plats.
 *  - Inget att visa → en SMAL inbjudan, aldrig en stor tom hylla.
 *
 * Ingen guldnivå och ingen boost-text: appen visar ingen boost (CLAUDE.md).
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { ärEgetVadkulEvent } from '@/lib/appEvent';
import type { AppEvent } from '@/lib/appEvent';
import { kategoriFor } from '@/lib/kategorier';
import { spotSpann, spotTid, type SpotRad } from '@/lib/stadsSpotlight';

const BLÅ = '#006AA7';

export function StadsSpotlight({
    stadsnamn,
    rader,
    onVälj,
    onSkapa,
}: {
    stadsnamn: string;
    /** null = de användarskapade eventen är inte hämtade än - rendera ingenting. */
    rader: readonly SpotRad[] | null;
    onVälj: (e: AppEvent) => void;
    onSkapa: () => void;
}) {
    if (!rader) return null;

    if (rader.length === 0) {
        return (
            <View style={styles.inbjudan}>
                <Text style={styles.inbjudanEmoji}>🚀</Text>
                <Text style={styles.inbjudanText}>
                    <Text style={styles.fet}>Ditt event överst här. </Text>
                    Quizkväll, kurs, popup-marknad - testa din eventidé gratis, den visas först på den här sidan.
                </Text>
                <Pressable onPress={onSkapa} style={({ pressed }) => [styles.inbjudanKnapp, pressed && styles.tryckt]}>
                    <Text style={styles.inbjudanKnappText}>Skapa event</Text>
                </Pressable>
            </View>
        );
    }

    return (
        <View style={styles.sektion}>
            <View style={styles.huvud}>
                <Text style={styles.rubrik}>SKAPADE PÅ VADKUL</Text>
                <Pressable onPress={onSkapa} hitSlop={8}>
                    <Text style={styles.skapaLänk}>Skapa ditt →</Text>
                </Pressable>
            </View>
            {rader.map(r => (
                <Rad key={r.e.id} rad={r} stadsnamn={stadsnamn} onPress={() => onVälj(r.e)} />
            ))}
            <Text style={styles.fot}>Event skapade på VADKUL visas överst här.</Text>
        </View>
    );
}

function Rad({ rad, stadsnamn, onPress }: { rad: SpotRad; stadsnamn: string; onPress: () => void }) {
    const { e } = rad;
    const k = kategoriFor(String(e.category));
    const emoji = e.emoji || k.emoji;
    const värdat = ärEgetVadkulEvent(e);
    const ram = värdat ? styles.ramVärdat : styles.ramTips;
    const spann = spotSpann(rad);
    const info = [e.locationName || stadsnamn, spotTid(rad)].filter(Boolean).join(' · ');
    const märke = (
        <View style={[styles.märke, e.img ? styles.märkePåBild : värdat ? styles.märkeVärdat : styles.märkeTips]}>
            <Text style={[styles.märkeText, värdat ? styles.märkeTextVärdat : styles.märkeTextTips]}>
                {e.isTip ? 'TIPSAT' : 'SKAPAT'}
            </Text>
        </View>
    );

    if (e.img) {
        return (
            <Pressable onPress={onPress} style={({ pressed }) => [styles.kort, ram, pressed && styles.tryckt]}>
                <View>
                    <Image source={{ uri: e.img }} style={styles.bild} contentFit="cover" transition={100} recyclingKey={e.id} />
                    <View style={styles.märkeHörn}>{märke}</View>
                    <View style={styles.bildFot}>
                        <Text style={styles.bildEmoji}>{emoji}</Text>
                        <Text style={styles.bildTitel} numberOfLines={1}>{e.title}</Text>
                        {spann ? <Text style={[styles.chip, styles.chipPåBild]}>{spann.toUpperCase()}</Text> : null}
                    </View>
                </View>
                <Text style={[styles.info, styles.infoBild]} numberOfLines={1}>{info}</Text>
            </Pressable>
        );
    }

    return (
        <Pressable onPress={onPress} style={({ pressed }) => [styles.kort, styles.kompakt, ram, pressed && styles.tryckt]}>
            <View style={[styles.bubbla, värdat ? styles.bubblaVärdat : styles.bubblaTips]}>
                <Text style={styles.bubblaEmoji}>{emoji}</Text>
            </View>
            <View style={styles.kompaktText}>
                <Text style={styles.titel} numberOfLines={2}>{e.title}</Text>
                <View style={styles.chipRad}>
                    {spann ? <Text style={styles.chip}>{spann.toUpperCase()}</Text> : null}
                    <Text style={[styles.chip, styles.chipKategori]}>{k.kort.toUpperCase()}</Text>
                    {märke}
                </View>
                <Text style={[styles.info, styles.infoKompakt]} numberOfLines={1}>{info}</Text>
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    tryckt: { opacity: 0.8 },
    fet: { fontWeight: '900', color: '#0f172a' },
    inbjudan: {
        marginTop: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        borderRadius: 16,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: 'rgba(0,106,167,0.4)',
        backgroundColor: 'rgba(224,242,254,0.6)',
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    inbjudanEmoji: { fontSize: 20 },
    inbjudanText: { flex: 1, fontSize: 12, lineHeight: 17, color: '#475569', fontWeight: '500' },
    inbjudanKnapp: { borderRadius: 999, backgroundColor: BLÅ, paddingHorizontal: 13, paddingVertical: 8 },
    inbjudanKnappText: { color: '#ffffff', fontSize: 12, fontWeight: '900' },
    sektion: { marginTop: 16, gap: 8 },
    huvud: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
    rubrik: { fontSize: 12, fontWeight: '900', letterSpacing: 1.2, color: BLÅ },
    skapaLänk: { fontSize: 12, fontWeight: '700', color: BLÅ },
    fot: { fontSize: 11, fontWeight: '500', color: '#94a3b8' },
    kort: { borderRadius: 16, overflow: 'hidden', backgroundColor: '#ffffff' },
    ramVärdat: { borderWidth: 2, borderColor: 'rgba(16,185,129,0.8)' },
    ramTips: { borderWidth: 1, borderColor: '#bae6fd' },
    bild: { width: '100%', height: 112 },
    märkeHörn: { position: 'absolute', top: 8, left: 8 },
    bildFot: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 7,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    bildEmoji: { fontSize: 17 },
    bildTitel: { flex: 1, fontSize: 14, fontWeight: '900', color: '#ffffff' },
    info: { fontSize: 12, fontWeight: '600', color: '#64748b' },
    infoBild: { paddingHorizontal: 14, paddingVertical: 8 },
    infoKompakt: { marginTop: 5, marginBottom: 12 },
    kompakt: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingLeft: 14, paddingTop: 12 },
    bubbla: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
    bubblaVärdat: { backgroundColor: '#ecfdf5' },
    bubblaTips: { backgroundColor: '#f0f9ff' },
    bubblaEmoji: { fontSize: 18 },
    kompaktText: { flex: 1, paddingRight: 14 },
    titel: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
    chipRad: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 4 },
    chip: {
        overflow: 'hidden',
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 2,
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 0.6,
        color: BLÅ,
        backgroundColor: 'rgba(0,106,167,0.1)',
    },
    chipPåBild: { backgroundColor: '#ffffff' },
    chipKategori: { color: '#475569', backgroundColor: '#f1f5f9' },
    märke: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
    märkePåBild: { backgroundColor: 'rgba(255,255,255,0.92)' },
    märkeVärdat: { backgroundColor: '#d1fae5' },
    märkeTips: { backgroundColor: '#e0f2fe' },
    märkeText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
    märkeTextVärdat: { color: '#047857' },
    märkeTextTips: { color: '#0369a1' },
});
