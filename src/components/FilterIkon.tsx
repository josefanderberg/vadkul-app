/**
 * Filtersymbolen - webbens lucide ListFilter (components/v2/EventCard.tsx,
 * strokeWidth 2.5): tre centrerade streck som blir kortare nedåt. Josef
 * 29/10: "gör så det ser ut precis som i webversionen. alltså 3 sträck som
 * är olika långa" (ersätter ☰-tecknet i kartans högra hörn).
 *
 * Ritad med vyer i stället för SVG (appen har ingen react-native-svg).
 * Måtten är lucides 24-rutnät: strecken M2 5h20, M6 12h12 och M9 19h6 med
 * runda ändar, så varje streck syns stroke/2 längre åt båda hållen.
 */
import { View } from 'react-native';

const RUTA = 24;
const STRECK = 2.5;
/** [mitten i höjdled, längd] per streck i lucides rutnät. */
const STRECKEN = [[5, 20], [12, 12], [19, 6]] as const;

export function FilterIkon({ storlek = 20, färg = '#0f172a' }: { storlek?: number; färg?: string }) {
    const s = storlek / RUTA;
    const tjocklek = STRECK * s;
    return (
        <View style={{ width: storlek, height: storlek }} accessible={false}>
            {STRECKEN.map(([y, längd]) => {
                const bredd = (längd + STRECK) * s;
                return (
                    <View
                        key={y}
                        style={{
                            position: 'absolute',
                            left: (storlek - bredd) / 2,
                            top: y * s - tjocklek / 2,
                            width: bredd,
                            height: tjocklek,
                            borderRadius: tjocklek / 2,
                            backgroundColor: färg,
                        }}
                    />
                );
            })}
        </View>
    );
}
