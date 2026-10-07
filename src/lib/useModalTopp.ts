/**
 * Toppluften i modalskärmarna (sök, profil, konto, städer). På iOS är de
 * kortark under statusraden - 24 pt räcker. På Android är modaler helskärm
 * bakom en genomskinlig statusrad (edge-to-edge), så rubriken måste ner
 * under den.
 */
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function useModalTopp(): number {
    const { top } = useSafeAreaInsets();
    return Platform.OS === 'android' ? top + 16 : 24;
}
