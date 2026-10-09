/**
 * "Rapportera eventet" - ligger under beskrivningen i eventkortet.
 *
 * Kravet kommer från App Store-regel 1.2 (användarskapat innehåll måste gå att
 * anmäla). Dämpad text, ingen knapp-tyngd: den ska finnas, inte konkurrera med
 * ANMÄL i footern. Logiken för själva rapporten bor i lib/rapportera.
 */
import { Alert, Linking, Pressable, StyleSheet, Text } from 'react-native';
import type { AppFeedEvent } from '@vadkul/kontrakt';
import { RAPPORT_MOTTAGARE, RAPPORT_SKÄL, rapportMailto, type RapportSkäl } from '@/lib/rapportera';

export function Rapportera({ event }: { event: AppFeedEvent }) {
    const skicka = (skäl: RapportSkäl) => {
        Linking.openURL(rapportMailto(event, skäl)).catch(() =>
            Alert.alert(
                'Kunde inte öppna mejlappen',
                `Mejla oss på ${RAPPORT_MOTTAGARE} så tar vi hand om det.`,
            ),
        );
    };

    const fråga = () =>
        Alert.alert('Rapportera eventet', 'Vad är det som är fel?', [
            ...RAPPORT_SKÄL.map(skäl => ({ text: skäl, onPress: () => skicka(skäl) })),
            { text: 'Avbryt', style: 'cancel' as const },
        ]);

    return (
        <Pressable onPress={fråga} hitSlop={10} style={styles.rad} accessibilityRole="button">
            <Text style={styles.text}>⚑ Rapportera eventet</Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    rad: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
    text: { fontSize: 13, color: '#94a3b8' },
});
