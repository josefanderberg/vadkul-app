/**
 * De genomskinliga bilderna bakom titlarnas krockytor och spärr
 * (josefanderberg/VADKUL#261, se lib/etikettLagen). Måtten står i
 * etikettLagen.HINDER_BILDER - etikettLagen.test kontrollerar att PNG:erna i
 * assets/hinder har exakt dem. Byts en ruta: gör om bilden i samma mått.
 */
import type { ImageRequireSource } from 'react-native';

export const HINDER_IMAGES: Record<string, ImageRequireSource> = {
    'hinder-halva': require('../../assets/hinder/hinder-halva.png'),
    'hinder-badge': require('../../assets/hinder/hinder-badge.png'),
    'etikett-sparr': require('../../assets/hinder/etikett-sparr.png'),
};
