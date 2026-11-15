/**
 * Vädret i stadsplattans dagchip, t.ex. "IDAG · ⛅ 3°"
 * (josefanderberg/VADKUL#237) - port av väder-spannet i webbens platta
 * (apps/web/src/app/(v2)/page.tsx, #202). Ändras webben ska kopian följa.
 *
 * VÄDRET HÅLLER SIN PLATS VID ORTSBYTE (#221, Josef 13/11: "när temperaturen
 * ändras när man går till en annan stad. då försvinner allt. så söndag flyttas
 * snabbt mot mitten i några sekunder. kan du inte ha en placeholder"): medan
 * den nya ortens prognos hämtas ritas förra ortens väder nedtonat, och före
 * allra första svaret en OSYNLIG utfyllnad - dagchipet får aldrig byta bredd
 * under laddningen. Rita därför alltid texten, även när den inte ska synas,
 * och töm aldrig vädret medan en ny ort laddas.
 *
 * Egen Text bredvid dagen (inte nästlad i den): genomskinligheten sitter då
 * på en riktig vy och gäller även emojin på båda plattformarna. Toningen är
 * webbens 300 ms. Bara Animated, ingen ny native-modul (OTA-säkert).
 */
import { useEffect, useState } from 'react';
import { Animated, type StyleProp, type TextStyle } from 'react-native';
import type { CityWeather } from '@vadkul/kontrakt';
import { väderOpacitet } from '@/lib/stadsVader';

export function PlattVader({ väder, stil }: { väder: CityWeather; stil: StyleProp<TextStyle> }) {
    const mål = väderOpacitet(väder.state);
    const [opacitet] = useState(() => new Animated.Value(mål));
    useEffect(() => {
        const toning = Animated.timing(opacitet, { toValue: mål, duration: 300, useNativeDriver: true });
        toning.start();
        return () => toning.stop();
    }, [mål, opacitet]);

    return (
        // Skärmläsaren får vädret ur plattans egen text (lib/stadsVader
        // plattansLästext) - där läses det bara när det är ortens eget.
        <Animated.Text
            style={[stil, { opacity: opacitet }]}
            numberOfLines={1}
            accessibilityElementsHidden
            importantForAccessibility="no"
        >
            {` · ${väder.emoji} ${väder.temp}`}
        </Animated.Text>
    );
}
