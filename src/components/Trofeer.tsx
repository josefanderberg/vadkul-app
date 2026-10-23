/**
 * Troféerna som en diskret rad under namnet - port av webbens TrophyLines
 * (ägarbeslut 23/10, Josef: "det behöver kanske inte vara synligt på det
 * sättet" - ingen pokal vid namnet): "✦ Förtur till appen · nr 1 av 4".
 * Data = users/{uid}.trophies via kontraktets readTrophies - inga egna
 * läsningar här.
 */
import { StyleSheet, Text } from 'react-native';
import { describeTrophy, type TrophyMirror } from '@vadkul/kontrakt';

export function Troféer({ troféer }: { troféer: readonly TrophyMirror[] }) {
    if (troféer.length === 0) return null;
    return (
        <>
            {troféer.map(t => (
                <Text key={t.id} style={styles.rad} numberOfLines={1}>{describeTrophy(t).line}</Text>
            ))}
        </>
    );
}

const styles = StyleSheet.create({
    rad: { fontSize: 12, fontWeight: '700', color: '#d97706', marginTop: 2 },
});
