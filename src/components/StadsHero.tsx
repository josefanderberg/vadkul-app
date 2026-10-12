/**
 * Kart-heron överst på stadssidan - webbens CityMapHero + CityMapHeroMarkers
 * + CityHeroPeriodChips (app/(v1)/evenemang/). Logiken bor i lib/stadsHero
 * och lib/stadsPeriod.
 *
 *  - Kartbotten = webbens förrenderade bild (ingen andra kartmotor). PASSIV
 *    MEN KLICKBAR: tryck på kartan öppnar huvudkartan över staden, tryck på
 *    en bricka öppnar eventet på kartan. Ingen "Öppna kartan"-pill och ingen
 *    läsbarhets-scrim (rivna på webben 20/9, "den behövs inte").
 *  - Brickorna är kartans egna bakade PNG:er (samma kropp, kant och "+N"-
 *    badge som huvudkartan) i webbherons storlek, 32 i stället för 40 pt.
 *  - PERIODCHIPSEN överst till vänster är sidans ENDA periodval och styr
 *    både brickorna och daglistan. Flytta dem inte till listan (webbens
 *    filterrad revs 20/9).
 *  - KARTKREDITEN under rutan är ett licenskrav (OSM ODbL, CARTO-stilen,
 *    OpenMapTiles CC-BY) - tas raden bort måste krediten bo någon annanstans.
 *
 * Orter utan webbens stadssida saknar kartbild: då visas bara periodchipsen.
 */
import { useState } from 'react';
import { Image as RNImage, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import type { City } from '@vadkul/kontrakt';
import { ärEgetVadkulEvent, type AppEvent } from '@/lib/appEvent';
import { BRICKA_IMAGES } from '@/lib/brickBilder.generated';
import { BADGE_X, BADGE_Y, BRICKA_ICON_SIZE, brickaIkon } from '@/lib/brickor';
import { antalIkon } from '@/lib/kartlager';
import { HERO_STÄDER, heroBildUrl, väljHeroMarkörer } from '@/lib/stadsHero';
import { PERIODER, type Period } from '@/lib/stadsPeriod';
import { THEMEPARK_LAND_COLOR_NEAR } from '@/lib/themeParkStyle';
import { isTicketmasterEvent } from '@/lib/ticketmaster';

/** Herons höjd i pt - webbens h-72 på telefon är 288, appen är lite lägre. */
const HÖJD = 250;
/** Webbherons bricka är 32 px mot kartans 40 pt. */
const SKALA = 0.8;
const BLÅ = '#006AA7';

/** En bakad bild i heron-storlek (PNG:erna är bakade i DPR 2,5, se lib/brickor). */
function mått(nyckel: string): { width: number; height: number } | null {
    const src = BRICKA_IMAGES[nyckel];
    if (!src) return null;
    const { width, height } = RNImage.resolveAssetSource(src);
    return { width: width * BRICKA_ICON_SIZE * SKALA, height: height * BRICKA_ICON_SIZE * SKALA };
}

export function StadsHero({
    stad,
    events,
    period,
    onPeriod,
    onÖppnaKartan,
    onVäljEvent,
}: {
    stad: City;
    /** Eventen brickorna väljs ur - redan filtrerade som listan (period, kartfilter, sökning). */
    events: readonly AppEvent[];
    period: Period;
    onPeriod: (p: Period) => void;
    onÖppnaKartan: () => void;
    onVäljEvent: (e: AppEvent) => void;
}) {
    const [bredd, setBredd] = useState(0);
    const [bildFel, setBildFel] = useState(false);
    const mitt = HERO_STÄDER[stad.slug];
    const bild = heroBildUrl(stad.slug);

    const chips = (
        <View style={[styles.chipRad, !bild && styles.chipRadFristående]}>
            {PERIODER.map(p => {
                const vald = p.key === period;
                return (
                    <Pressable
                        key={p.key}
                        onPress={() => onPeriod(p.key)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: vald }}
                        hitSlop={4}
                        style={({ pressed }) => [styles.chip, !bild && styles.chipFristående, vald && styles.chipVald, pressed && styles.tryckt]}
                    >
                        <Text style={[styles.chipText, vald && styles.chipTextVald]}>{p.label}</Text>
                    </Pressable>
                );
            })}
        </View>
    );

    if (!bild || !mitt) return chips;

    const markörer = bredd > 0 ? väljHeroMarkörer(events, mitt, { bredd, höjd: HÖJD, kant: 14 }) : [];

    return (
        <View>
            <Pressable
                style={styles.ruta}
                onPress={onÖppnaKartan}
                onLayout={ev => setBredd(ev.nativeEvent.layout.width)}
                accessibilityRole="button"
                accessibilityLabel={`Öppna kartan över ${stad.name}`}
            >
                {!bildFel ? (
                    <Image
                        source={{ uri: bild }}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                        transition={150}
                        onError={() => setBildFel(true)}
                    />
                ) : null}
                {markörer.map(({ e, antal, x, y }) => {
                    const ikon = brickaIkon({
                        category: String(e.category),
                        pop: e.pop === true,
                        guld: isTicketmasterEvent(e),
                        grön: ärEgetVadkulEvent(e),
                    });
                    const m = mått(ikon);
                    if (!m) return null;
                    const badge = antalIkon(antal);
                    const bm = badge ? mått(badge) : null;
                    return (
                        <Pressable
                            key={e.id}
                            onPress={() => onVäljEvent(e)}
                            accessibilityRole="button"
                            accessibilityLabel={`Visa ${e.title} på kartan${antal > 1 ? ` (${antal} på platsen)` : ''}`}
                            style={[styles.bricka, { left: x - m.width / 2, top: y - m.height, width: m.width, height: m.height }]}
                        >
                            <Image source={BRICKA_IMAGES[ikon]} style={m} contentFit="contain" />
                            {bm ? (
                                <Image
                                    source={BRICKA_IMAGES[badge]}
                                    contentFit="contain"
                                    style={[
                                        bm,
                                        styles.badge,
                                        {
                                            // Badgens mitt = spetsen + (BADGE_X, -BADGE_Y), som kartans antal-lager.
                                            left: m.width / 2 + BADGE_X * SKALA - bm.width / 2,
                                            top: m.height - BADGE_Y * SKALA - bm.height / 2,
                                        },
                                    ]}
                                />
                            ) : null}
                        </Pressable>
                    );
                })}
                {chips}
            </Pressable>
            <Text style={styles.kredit}>
                Kartdata ©{' '}
                <Text style={styles.kreditLänk} onPress={() => Linking.openURL('https://www.openstreetmap.org/copyright')}>
                    OpenStreetMap
                </Text>
                {' '}· stil © CARTO ·{' '}
                <Text style={styles.kreditLänk} onPress={() => Linking.openURL('https://openmaptiles.org/')}>
                    OpenMapTiles
                </Text>
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    ruta: {
        height: HÖJD,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        backgroundColor: THEMEPARK_LAND_COLOR_NEAR,
    },
    bricka: { position: 'absolute' },
    badge: { position: 'absolute' },
    // Överst till vänster på kartan, bryts till en rad till hellre än att klippas (webbens flex-wrap).
    chipRad: { position: 'absolute', top: 8, left: 8, right: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
    chipRadFristående: { position: 'relative', top: 0, left: 0, right: 0, gap: 6 },
    chip: {
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 5,
        backgroundColor: 'rgba(255,255,255,0.88)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.6)',
    },
    chipFristående: { backgroundColor: '#ffffff', borderColor: '#e2e8f0', paddingHorizontal: 12, paddingVertical: 7 },
    chipVald: { backgroundColor: BLÅ, borderColor: BLÅ },
    chipText: { fontSize: 11, fontWeight: '900', color: '#334155' },
    chipTextVald: { color: '#ffffff' },
    tryckt: { opacity: 0.75 },
    kredit: { marginTop: 4, textAlign: 'right', fontSize: 10, color: '#94a3b8' },
    kreditLänk: { textDecorationLine: 'underline' },
});
