/**
 * Modalskärmarnas paddingTop (lib/modalTopp) med statusradens riktiga höjd -
 * PR #1:s useModalTopp, portad 31/10. Läggs på skärmens rot ovanpå
 * styles.root: `[styles.root, { paddingTop: modalTopp }]`.
 */
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { modalTopp } from './modalTopp';

export function useModalTopp(): number {
    const { top } = useSafeAreaInsets();
    return modalTopp(Platform.OS, top);
}
