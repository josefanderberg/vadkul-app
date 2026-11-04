/**
 * Stjärnan på boostade event (Josef 4/11 2026: "ha en stjärna längst upp åt
 * vänster på eventkortet och även i listan under ... gäller på web och
 * mobil") - webbens components/ui/BoostStar: samma guldrunda platta med ⭐
 * som kartbrickans badge, uppe till vänster på kortet (`pill` med texten
 * BOOSTAD - ägarbeslut 4/11, Josef: "jag ser hellre att det står boostad";
 * ett STATUSORD, ingen köpknapp eller pris - CLAUDE.md) och på raderna
 * (bara stjärnan; `liten` på emoji-cirkeln i de kompakta raderna).
 */
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

export const BOOST_GULD = '#fbbf24';

export function BoostStjärna({ pill = false, liten = false, style }: { pill?: boolean; liten?: boolean; style?: StyleProp<ViewStyle> }) {
    if (pill) {
        return (
            <View style={[styles.pill, style]} accessibilityLabel="Boostat event">
                <Text style={styles.pillText}>⭐ BOOSTAD</Text>
            </View>
        );
    }
    return (
        <View style={[styles.platta, liten && styles.liten, style]} accessibilityLabel="Boostat event">
            <Text style={[styles.stjärna, liten && styles.litenStjärna]}>⭐</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    pill: { flexShrink: 0, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: BOOST_GULD },
    pillText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.6, color: '#78350f' },
    platta: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: BOOST_GULD,
        borderWidth: 2,
        borderColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 2,
        shadowOffset: { width: 0, height: 1 },
        elevation: 2,
    },
    liten: { width: 16, height: 16, borderRadius: 8 },
    stjärna: { fontSize: 10, lineHeight: 12 },
    litenStjärna: { fontSize: 8, lineHeight: 10 },
});
