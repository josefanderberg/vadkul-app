/**
 * Bildklick i eventkortet = HELSKÄRM på alla event (ägarbeslut 14/9: affischer
 * bär ofta all info i bilden och blev oläsliga beskurna). Tryck var som helst
 * stänger. Inline-växt i kortet är prövad och riven på webben - helskärm.
 */
import { Modal, Pressable, StyleSheet, Text } from 'react-native';
import { Image } from 'expo-image';

export function HelskarmsBild({ uri, onClose }: { uri: string | null; onClose: () => void }) {
    return (
        <Modal visible={uri !== null} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
            <Pressable style={styles.bakgrund} onPress={onClose} accessibilityLabel="Stäng bilden">
                {uri ? <Image source={{ uri }} style={styles.bild} contentFit="contain" transition={150} /> : null}
                <Text style={styles.stäng}>✕</Text>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    bakgrund: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', alignItems: 'center', justifyContent: 'center' },
    bild: { width: '100%', height: '85%' },
    stäng: { position: 'absolute', top: 60, right: 20, color: '#ffffff', fontSize: 22, fontWeight: '700' },
});
