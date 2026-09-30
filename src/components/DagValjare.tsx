/**
 * Dag/vecka-kontrollen fast i botten - webbens mörka platta med BÅDA raderna
 * och antal i kartans ruta (vald rad = vit pill, allt rounded-full). Pilarna
 * stegar EN dag i båda lägena. ↺ svävar rakt ovanför bakåtpilen och tar en
 * till HEMMADAGEN (Imorgon om idag är slut i rutan, annars Idag) - göms när
 * man redan står där (kart-ui 24/9). "Tryck för att växla" är ENGÅNGS-
 * onboarding: första trycket på någon av väljarens knappar släcker den för
 * gott på enheten (kart-ui 1/9).
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { periodLabel } from '@/lib/dagar';
import { NYCKEL, useLagrad } from '@/lib/lagring';

/** Flödets horisont är 14 dagar - längre än så kan väljaren inte stega. */
export const MAX_OFFSET = 13;

export function DagValjare({
    offset,
    längd,
    antalDag,
    antalVecka,
    hemmadag,
    onOffset,
    onLängd,
}: {
    offset: number;
    längd: 1 | 7;
    /** null = rutan inte känd än ("…"). */
    antalDag: number | null;
    antalVecka: number | null;
    hemmadag: number;
    onOffset: (o: number) => void;
    onLängd: (l: 1 | 7) => void;
}) {
    const [hintKlar, setHintKlar, hintLaddad] = useLagrad(NYCKEL.växlaHintKlar, false);
    const kvittera = () => { if (!hintKlar) setHintKlar(true); };

    return (
        <View style={styles.yta} pointerEvents="box-none">
            {hintLaddad && !hintKlar ? (
                <View style={styles.växlaPill}>
                    <Text style={styles.växlaText}>TRYCK FÖR ATT VÄXLA</Text>
                </View>
            ) : null}
            <View style={styles.rad}>
                {offset !== hemmadag ? (
                    <Pressable
                        style={styles.nollKnapp}
                        onPress={() => { kvittera(); onOffset(hemmadag); }}
                        accessibilityLabel={hemmadag === 0 ? 'Till idag' : 'Till imorgon'}
                    >
                        <Text style={styles.nollText}>↺</Text>
                    </Pressable>
                ) : null}
                <View style={styles.platta}>
                    <Pressable
                        onPress={() => { kvittera(); onOffset(Math.max(0, offset - 1)); }}
                        disabled={offset === 0}
                        hitSlop={8}
                        style={[styles.pil, offset === 0 && styles.pilDimmad]}
                        accessibilityLabel="Föregående dag"
                    >
                        <Text style={styles.pilText}>‹</Text>
                    </Pressable>
                    <Pressable style={styles.radKolumn} onPress={() => { kvittera(); onLängd(längd === 1 ? 7 : 1); }}>
                        {([1, 7] as const).map(l => {
                            const vald = längd === l;
                            const antal = l === 1 ? antalDag : antalVecka;
                            return (
                                <View key={l} style={[styles.periodRad, vald && styles.periodRadVald]}>
                                    <Text style={[styles.radText, vald && styles.radTextVald]}>
                                        {periodLabel(offset, l).toUpperCase()}
                                    </Text>
                                    <Text style={[styles.radAntal, vald && styles.radTextVald]}>{antal ?? '…'}</Text>
                                </View>
                            );
                        })}
                    </Pressable>
                    <Pressable
                        onPress={() => { kvittera(); onOffset(Math.min(MAX_OFFSET, offset + 1)); }}
                        disabled={offset >= MAX_OFFSET}
                        hitSlop={8}
                        style={[styles.pil, offset >= MAX_OFFSET && styles.pilDimmad]}
                        accessibilityLabel="Nästa dag"
                    >
                        <Text style={styles.pilText}>›</Text>
                    </Pressable>
                </View>
            </View>
        </View>
    );
}

const MÖRK = 'rgba(36,42,51,0.92)';

const styles = StyleSheet.create({
    yta: { position: 'absolute', left: 0, right: 0, bottom: 72, alignItems: 'center', gap: 6 },
    växlaPill: { backgroundColor: MÖRK, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
    växlaText: { fontSize: 10, fontWeight: '700', color: '#e2e8f0', letterSpacing: 1.2 },
    rad: { flexDirection: 'row', alignItems: 'center' },
    nollKnapp: {
        position: 'absolute',
        left: 4,
        top: -58,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: MÖRK,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 5,
    },
    nollText: { fontSize: 20, color: '#ffffff', fontWeight: '700' },
    platta: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: MÖRK,
        borderRadius: 26,
        paddingHorizontal: 6,
        paddingVertical: 6,
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 6,
    },
    pil: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
    pilDimmad: { opacity: 0.35 },
    pilText: { fontSize: 24, fontWeight: '700', color: '#ffffff', marginTop: -3 },
    radKolumn: { minWidth: 210, gap: 2 },
    periodRad: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 5,
    },
    periodRadVald: { backgroundColor: '#ffffff' },
    radText: { fontSize: 13, fontWeight: '800', color: 'rgba(255,255,255,0.85)', letterSpacing: 1 },
    radTextVald: { color: '#0f172a' },
    radAntal: { fontSize: 15, fontWeight: '800', color: 'rgba(255,255,255,0.85)', marginLeft: 12 },
});
