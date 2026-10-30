/**
 * Introts bilder (Josef 30/10 2026: "det är ju bara blå bakgrund och jätte
 * tråkigt"). Fortfarande VADKUL-blått, men med djup och riktiga skärmbilder:
 *  - IntroBakgrund: mjuka ljusa cirklar som glider i otakt med svepet.
 *  - MolnMedBrickor: molnet med kategoribrickorna svävande runt sig.
 *  - TelefonPar / Telefon: appens egna skärmbilder (butiksbilderna i
 *    huvudrepots docs/butik-assets/ra/, statusraden bortskuren) i telefonram.
 *  - PlatsPuls: platsnålen med pulsande ringar - ingen 📍-emoji (ägarbeslut
 *    28/10: inga tid/plats/profil-emojier).
 *
 * Bara Animated + Image + View, ingen ny native-modul (OTA-säkert).
 */
import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, useWindowDimensions, View } from 'react-native';
import type { ImageSourcePropType, StyleProp, ViewStyle } from 'react-native';
import { Ikon } from '@/components/Ikon';
import { BRICKA_IMAGES } from '@/lib/brickBilder.generated';

const BLÅ = '#006aa7';
const MOLN = require('../../assets/images/splash-icon.png');
export const INTRO_KARTA = require('../../assets/intro/intro-karta.jpg');
export const INTRO_EVENT = require('../../assets/intro/intro-event.jpg');
export const INTRO_SÖK = require('../../assets/intro/intro-sok.jpg');

/** Skärmbildernas proportion (540x1106 efter beskärningen). */
const BILD_KVOT = 540 / 1106;

/** Telefonhöjden följer skärmen: 40 % av höjden, aldrig över 360 pt. */
export function useTelefonHöjd() {
    const { height } = useWindowDimensions();
    return Math.min(360, Math.round(height * 0.4));
}

/** En evig upp-och-ner-rörelse; fördröjningen gör att flera inte går i takt. */
function useSväva(amplitud: number, period: number, fördröjning = 0) {
    const v = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        const loop = Animated.loop(Animated.sequence([
            Animated.delay(fördröjning),
            Animated.timing(v, { toValue: 1, duration: period / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(v, { toValue: 0, duration: period / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]));
        loop.start();
        return () => loop.stop();
    }, [v, period, fördröjning]);
    return v.interpolate({ inputRange: [0, 1], outputRange: [0, -amplitud] });
}

const CIRKLAR = [
    { storlek: 340, top: -90, left: -120, färg: 'rgba(255,255,255,0.07)', fart: 0.25 },
    { storlek: 260, top: 330, left: 210, färg: 'rgba(120,200,255,0.16)', fart: 0.45 },
    { storlek: 180, top: 600, left: -60, färg: 'rgba(255,204,2,0.10)', fart: 0.6 },
];

/**
 * Bakgrunden bakom alla sidor. scrollX är svepets position; cirklarna glider
 * med en bråkdel av farten, så sidorna får djup när man sveper.
 */
export function IntroBakgrund({ scrollX }: { scrollX: Animated.Value }) {
    const { width } = useWindowDimensions();
    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {CIRKLAR.map((c, i) => (
                <Animated.View
                    key={i}
                    style={{
                        position: 'absolute',
                        top: c.top,
                        left: c.left,
                        width: c.storlek,
                        height: c.storlek,
                        borderRadius: c.storlek / 2,
                        backgroundColor: c.färg,
                        transform: [{
                            translateX: scrollX.interpolate({
                                inputRange: [0, width],
                                outputRange: [0, -width * c.fart],
                                extrapolate: 'extend',
                            }),
                        }],
                    }}
                />
            ))}
        </View>
    );
}

/** Brickorna runt molnet: kategori, läge relativt molnets mitt och storlek. */
const RUNT_MOLNET: { k: string; x: number; y: number; s: number }[] = [
    { k: 'music', x: -128, y: -64, s: 1 },
    { k: 'sport', x: 118, y: -84, s: 0.86 },
    { k: 'food', x: 146, y: 34, s: 0.8 },
    { k: 'family', x: -150, y: 46, s: 0.84 },
    { k: 'art', x: -62, y: 104, s: 0.74 },
    { k: 'market', x: 72, y: 110, s: 0.78 },
];

/** Scenen är ritad för 340 pt bredd och krymper på smalare telefoner. */
const SCEN_BREDD = 340;

/** Första sidan: molnet svävar och kategoribrickorna svävar runt det i otakt. */
export function MolnMedBrickor() {
    const { width } = useWindowDimensions();
    const moln = useSväva(10, 3200);
    const k = Math.min(1, (width - 24) / SCEN_BREDD);
    return (
        <View style={[styles.molnScen, { width: SCEN_BREDD * k, height: 270 * k }]}>
            {RUNT_MOLNET.map((b, i) => (
                <SvävandeBricka key={b.k} kategori={b.k} x={b.x * k} y={b.y * k} skala={b.s * k} index={i} />
            ))}
            <Animated.Image
                source={MOLN}
                style={{ width: 200 * k, height: 140 * k, transform: [{ translateY: moln }] }}
                resizeMode="contain"
            />
        </View>
    );
}

function SvävandeBricka({ kategori, x, y, skala, index }: {
    kategori: string;
    x: number;
    y: number;
    skala: number;
    index: number;
}) {
    const sväv = useSväva(8, 2600 + index * 350, index * 260);
    const w = 58 * skala;
    const h = 50 * skala;
    return (
        <Animated.Image
            source={BRICKA_IMAGES[`bricka-${kategori}`]}
            style={{
                position: 'absolute',
                width: w,
                height: h,
                left: '50%',
                top: '50%',
                marginLeft: x - w / 2,
                marginTop: y - h / 2,
                transform: [{ translateY: sväv }],
            }}
            resizeMode="contain"
        />
    );
}

/** En telefon med en av appens skärmbilder. Höjden styr; bredden följer bilden. */
export function Telefon({ bild, höjd, lutning = 0, style }: {
    bild: ImageSourcePropType;
    höjd: number;
    lutning?: number;
    style?: StyleProp<ViewStyle>;
}) {
    const ram = Math.round(höjd * 0.022);
    const bildHöjd = höjd - ram * 2;
    const bildBredd = Math.round(bildHöjd * BILD_KVOT);
    const radie = Math.round(höjd * 0.075);
    return (
        <View
            style={[
                styles.telefon,
                {
                    padding: ram,
                    borderRadius: radie,
                    transform: [{ rotate: `${lutning}deg` }],
                },
                style,
            ]}
        >
            <Image
                source={bild}
                style={{ width: bildBredd, height: bildHöjd, borderRadius: radie - ram }}
                resizeMode="cover"
            />
        </View>
    );
}

/** Andra sidan: kartan bakom, ett eventkort framför - "tryck på en bricka". */
export function TelefonPar({ bakre, främre, höjd }: {
    bakre: ImageSourcePropType;
    främre: ImageSourcePropType;
    höjd: number;
}) {
    const sväv = useSväva(6, 3400);
    const bakreHöjd = Math.round(höjd * 0.9);
    const förskjutning = Math.round(höjd * 0.17);
    return (
        <View style={[styles.par, { height: höjd + 16 }]}>
            {/* style ersätter Telefons egen transform: förskjutning + lutning här. */}
            <Telefon
                bild={bakre}
                höjd={bakreHöjd}
                style={{ position: 'absolute', transform: [{ translateX: -förskjutning }, { rotate: '-7deg' }], opacity: 0.95 }}
            />
            <Animated.View style={{ transform: [{ translateX: förskjutning }, { translateY: sväv }] }}>
                <Telefon bild={främre} höjd={höjd} lutning={5} />
            </Animated.View>
        </View>
    );
}

/** En ensam telefon som svävar sakta (tredje sidan, söket). */
export function SvävandeTelefon({ bild, höjd, lutning }: {
    bild: ImageSourcePropType;
    höjd: number;
    lutning: number;
}) {
    const sväv = useSväva(6, 3400);
    return (
        <Animated.View style={[styles.ensam, { transform: [{ translateY: sväv }] }]}>
            <Telefon bild={bild} höjd={höjd} lutning={lutning} />
        </Animated.View>
    );
}

/** Platssidan: nålen i en vit cirkel med ringar som pulserar ut. */
export function PlatsPuls() {
    return (
        <View style={styles.pulsScen}>
            {[0, 1, 2].map(i => <PulsRing key={i} fördröjning={i * 800} />)}
            <View style={styles.pulsKärna}>
                <Ikon namn="plats" storlek={46} färg={BLÅ} />
            </View>
        </View>
    );
}

function PulsRing({ fördröjning }: { fördröjning: number }) {
    const v = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        const loop = Animated.loop(Animated.sequence([
            Animated.delay(fördröjning),
            Animated.timing(v, { toValue: 1, duration: 2400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
            Animated.delay(Math.max(0, 1600 - fördröjning)),
        ]));
        loop.start();
        return () => loop.stop();
    }, [v, fördröjning]);
    return (
        <Animated.View
            style={[
                styles.pulsRing,
                {
                    opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
                    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] }) }],
                },
            ]}
        />
    );
}

const styles = StyleSheet.create({
    molnScen: { alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
    telefon: {
        backgroundColor: '#0f172a',
        shadowColor: '#001a2c',
        shadowOpacity: 0.45,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
        elevation: 12,
    },
    par: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', marginBottom: 30 },
    ensam: { marginBottom: 30 },
    pulsScen: { width: 220, height: 220, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
    pulsRing: {
        position: 'absolute',
        width: 96,
        height: 96,
        borderRadius: 48,
        borderWidth: 3,
        borderColor: '#ffffff',
    },
    pulsKärna: {
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#001a2c',
        shadowOpacity: 0.35,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 6 },
        elevation: 10,
    },
});
