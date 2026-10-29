/**
 * Systemsymboler i stället för emojier för tid, plats, pris och profil (Josef
 * 28/10: "jag tycker inte om emoji för platser och tid. det blir för många
 * sådana emoji ikoner. även profilknappen ... ha vanlig symbol bara").
 * SF Symbols på iOS, Material Symbols på Android (expo-symbols - finns i
 * bygget sedan MVP:n, ingen ny native-modul). Kategori-emojierna på titlar
 * och brickor är kvar: de är eventens egna tecken, inte ikoner.
 *
 * Symbolen är en View, inte text - den kan inte stå inuti en <Text>. Lägg den
 * bredvid texten i en rad (flexDirection: 'row', alignItems: 'center').
 */
import type { StyleProp, ViewStyle } from 'react-native';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';

const SYMBOLER = {
    tid: { ios: 'clock', android: 'schedule' },
    plats: { ios: 'mappin', android: 'location_on' },
    profil: { ios: 'person.fill', android: 'person' },
    pris: { ios: 'ticket', android: 'confirmation_number' },
} as const satisfies Record<string, SymbolViewProps['name']>;

export type IkonNamn = keyof typeof SYMBOLER;

export function Ikon({
    namn,
    storlek = 13,
    färg = '#475569',
    style,
}: {
    namn: IkonNamn;
    storlek?: number;
    färg?: string;
    style?: StyleProp<ViewStyle>;
}) {
    return (
        <SymbolView
            name={SYMBOLER[namn]}
            size={storlek}
            tintColor={färg}
            weight="semibold"
            style={style}
            accessible={false}
        />
    );
}
