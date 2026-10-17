/**
 * "Rapportera eventet" - ligger under beskrivningen i eventkortet.
 *
 * Kravet kommer från App Store-regel 1.2 (användarskapat innehåll måste gå att
 * anmäla). Dämpad text, ingen knapp-tyngd: den ska finnas, inte konkurrera med
 * ANMÄL i footern. Logiken för själva rapporten bor i lib/rapportera.
 *
 * Skälvalet är ett Modal-ark (samma mönster och utseende som ChattMeny), inte
 * en Alert: skälen är fyra + avbryt och Android visar högst tre knappar i en
 * Alert - på Android föll "Något annat" och Avbryt bort helt.
 */
import { useState } from 'react';
import { Alert, Linking, Modal, Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AppFeedEvent } from '@vadkul/kontrakt';
import { RAPPORT_MOTTAGARE, RAPPORT_SKÄL, rapportMailto, type RapportSkäl } from '@/lib/rapportera';

export function Rapportera({ event }: { event: AppFeedEvent }) {
    const insets = useSafeAreaInsets();
    const [öppen, setÖppen] = useState(false);

    const skicka = (skäl: RapportSkäl) => {
        setÖppen(false);
        Linking.openURL(rapportMailto(event, skäl)).catch(() =>
            Alert.alert(
                'Kunde inte öppna mejlappen',
                `Mejla oss på ${RAPPORT_MOTTAGARE} så tar vi hand om det.`,
            ),
        );
    };

    return (
        <>
            <Pressable onPress={() => setÖppen(true)} hitSlop={10} style={styles.rad} accessibilityRole="button">
                <Text style={styles.text}>⚑ Rapportera eventet</Text>
            </Pressable>
            {öppen ? (
                <Modal visible transparent animationType="fade" onRequestClose={() => setÖppen(false)}>
                    <Pressable style={styles.bakgrund} onPress={() => setÖppen(false)} accessibilityLabel="Stäng">
                        {/* Arket sväljer sina egna tryck - bara utanför stänger. */}
                        <Pressable style={[styles.ark, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]} onPress={() => {}}>
                            <Text style={styles.rubrik}>Rapportera eventet</Text>
                            <Text style={styles.brödtext}>Vad är det som är fel?</Text>
                            {RAPPORT_SKÄL.map(skäl => (
                                <Pressable
                                    key={skäl}
                                    onPress={() => skicka(skäl)}
                                    accessibilityRole="button"
                                    style={({ pressed }) => [styles.knapp, pressed && styles.tryckt]}
                                >
                                    <Text style={styles.knappText}>{skäl}</Text>
                                </Pressable>
                            ))}
                            <Pressable
                                onPress={() => setÖppen(false)}
                                accessibilityRole="button"
                                style={({ pressed }) => [styles.knapp, styles.knappAvbryt, pressed && styles.tryckt]}
                            >
                                <Text style={[styles.knappText, styles.knappTextAvbryt]}>Avbryt</Text>
                            </Pressable>
                        </Pressable>
                    </Pressable>
                </Modal>
            ) : null}
        </>
    );
}

const KANT = '#e2e8f0';

const styles = StyleSheet.create({
    rad: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
    text: { fontSize: 13, color: '#94a3b8' },
    bakgrund: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.45)' },
    ark: {
        backgroundColor: '#ffffff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingHorizontal: 16,
        paddingTop: 18,
        gap: 8,
    },
    rubrik: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
    brödtext: { fontSize: 13, fontWeight: '500', color: '#475569', lineHeight: 18, marginBottom: 4 },
    knapp: {
        borderRadius: 12,
        borderWidth: 1,
        borderColor: KANT,
        backgroundColor: '#ffffff',
        paddingVertical: 13,
        alignItems: 'center',
    },
    knappAvbryt: { backgroundColor: '#f1f5f9', borderColor: '#f1f5f9' },
    knappText: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
    knappTextAvbryt: { color: '#475569' },
    tryckt: { opacity: 0.85 },
});
