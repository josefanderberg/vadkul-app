/**
 * Troféerna bredvid ett namn - port av webbens TrophyBadges (ägarbeslut
 * 23/10, Josef: "det räcker med en symbol, men att det kanske syns om man
 * klickar på den"). Bara symbolen; ett tryck visar förklaringen i en Alert.
 * Data = users/{uid}.trophies via kontraktets readTrophies - inga egna
 * läsningar här.
 */
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { describeTrophy, type TrophyMirror } from '@vadkul/kontrakt';

export function Troféer({ troféer }: { troféer: readonly TrophyMirror[] }) {
    if (troféer.length === 0) return null;
    return (
        <View style={styles.rad}>
            {troféer.map(t => {
                const d = describeTrophy(t);
                return (
                    <Pressable
                        key={t.id}
                        onPress={() => Alert.alert(`${d.symbol} ${d.title}`, d.text)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={d.title}
                    >
                        <Text style={styles.symbol}>{d.symbol}</Text>
                    </Pressable>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    rad: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    symbol: { fontSize: 16 },
});
