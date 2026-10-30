/**
 * Introt - första starten. Fem sidor på VADKUL-blått: vad VADKUL är, hur
 * kartan läses, sök/filter/spara, platsfrågan och kontot.
 *
 * Två saker introt INTE är:
 *  - ingen kamerarörelse på kartan (kart-ui: "DET FINNS INGET INTRO" gäller
 *    kartan - den står still i startstaden bakom de här sidorna).
 *  - ingen konto-vägg: kontot erbjuds stort men "Fortsätt utan konto" finns
 *    alltid (ägarbeslut 29/9, Apples regel 5.1.1 - kartan funkar utan konto).
 *
 * Platsfrågan ställs HÄR, på egen sida med förklaring, i stället för som en
 * systemdialog ovanpå första sidan (lib/regionContext.begärPlats).
 *
 * Bilderna (bakgrunden, molnet med brickor, telefonerna med riktiga
 * skärmbilder, platspulsen) bor i components/IntroScen (Josef 30/10: introt
 * var "bara blå bakgrund och jätte tråkigt").
 */
import { useRef, useState } from 'react';
import {
    Animated,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from 'react-native';
import { router } from 'expo-router';
import { Ikon, type IkonNamn } from '@/components/Ikon';
import {
    INTRO_EVENT,
    INTRO_KARTA,
    INTRO_SÖK,
    IntroBakgrund,
    MolnMedBrickor,
    PlatsPuls,
    SvävandeTelefon,
    TelefonPar,
    useTelefonHöjd,
} from '@/components/IntroScen';
import { useRegionVal } from '@/lib/regionContext';
import { KONTON_PÅ } from '@/lib/funktioner';

const BLÅ = '#006aa7';
const MOLN = require('../../assets/images/splash-icon.png');

/** Kontosidan utgår i v1 (lib/funktioner: KONTON_PÅ) - då är platsfrågan sista steget. */
const SIDOR = KONTON_PÅ ? 5 : 4;
const PLATS_SIDA = 3;

/** Kontosidans fördelar - symboler, inte emojier, för profil och plats (ägarbeslut 28/10). */
const FÖRDELAR: [IkonNamn | '✨', string][] = [
    ['profil', 'Samma konto här och på vadkul.se'],
    ['plats', 'Din stad sparas - kartan och tipsen blir dina'],
    ['✨', 'Önska och skapa egna event'],
];

export default function IntroScreen() {
    const { width } = useWindowDimensions();
    const { avslutaIntro, begärPlats } = useRegionVal();
    const scrollRef = useRef<ScrollView>(null);
    const scrollX = useRef(new Animated.Value(0)).current;
    const telefonHöjd = useTelefonHöjd();
    const [sida, setSida] = useState(0);
    const [platsSvar, setPlatsSvar] = useState(false);

    const gåTill = (i: number) => {
        scrollRef.current?.scrollTo({ x: i * width, animated: true });
        setSida(i);
    };

    const klar = (vidare?: '/konto?lage=skapa' | '/konto?lage=logga-in') => {
        avslutaIntro();
        router.dismissAll();
        if (vidare) router.push(vidare);
    };

    return (
        <View style={styles.root}>
            <IntroBakgrund scrollX={scrollX} />
            {sida < PLATS_SIDA ? (
                <Pressable style={styles.hoppa} onPress={() => gåTill(PLATS_SIDA)} hitSlop={10}>
                    <Text style={styles.hoppaText}>Hoppa över</Text>
                </Pressable>
            ) : null}
            <Animated.ScrollView
                ref={scrollRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                scrollEventThrottle={16}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                    { useNativeDriver: true },
                )}
                onMomentumScrollEnd={e => setSida(Math.round(e.nativeEvent.contentOffset.x / width))}
            >
                <Sida width={width}>
                    <MolnMedBrickor />
                    <Text style={styles.rubrik}>Hej! Vad vill du hitta på?</Text>
                    <Text style={styles.text}>
                        VADKUL samlar över 20 000 event i hela Sverige på en karta - konserter, loppisar,
                        föreläsningar, sport, barnaktiviteter och allt däremellan.
                    </Text>
                </Sida>

                <Sida width={width}>
                    <TelefonPar bakre={INTRO_KARTA} främre={INTRO_EVENT} höjd={telefonHöjd} />
                    <Text style={styles.rubrik}>Se vad som händer idag</Text>
                    <Text style={styles.text}>
                        Varje bricka på kartan är ett event. Tryck på en för att läsa mer och anmäla dig.
                        Längst ner växlar du mellan idag och hela veckan.
                    </Text>
                </Sida>

                <Sida width={width}>
                    <SvävandeTelefon bild={INTRO_SÖK} höjd={telefonHöjd} lutning={-4} />
                    <Text style={styles.rubrik}>Hitta rätt direkt</Text>
                    <Text style={styles.text}>
                        Sök på event eller ort - "jazz i Göteborg" funkar. Filtrera på kategori eller 🔥 Populära,
                        och spara det du gillar med hjärtat.
                    </Text>
                </Sida>

                <Sida width={width}>
                    <PlatsPuls />
                    <Text style={styles.rubrik}>Var är du?</Text>
                    <Text style={styles.text}>
                        Med din plats öppnar kartan direkt över din stad. Platsen stannar i telefonen - vi sparar
                        bara vilken stad du är i.
                    </Text>
                    {platsSvar ? (
                        <Text style={styles.kvitto}>Tack! Kartan hittar din stad.</Text>
                    ) : (
                        <Pressable
                            style={({ pressed }) => [styles.knappVit, pressed && styles.tryckt]}
                            onPress={() => { begärPlats(); setPlatsSvar(true); }}
                        >
                            <Text style={styles.knappVitText}>Använd min plats</Text>
                        </Pressable>
                    )}
                </Sida>

                {KONTON_PÅ ? (
                    <Sida width={width}>
                        <Image source={MOLN} style={styles.litetMoln} resizeMode="contain" />
                        <Text style={styles.rubrik}>Skapa ett konto</Text>
                        <View style={styles.fördelar}>
                            {FÖRDELAR.map(([ikon, text]) => (
                                <View key={text} style={styles.fördelRad}>
                                    <View style={styles.fördelIkon}>
                                        {ikon === '✨'
                                            ? <Text style={styles.fördelEmoji}>✨</Text>
                                            : <Ikon namn={ikon} storlek={18} färg="#ffffff" />}
                                    </View>
                                    <Text style={styles.fördel}>{text}</Text>
                                </View>
                            ))}
                        </View>
                        <Pressable
                            style={({ pressed }) => [styles.knappVit, pressed && styles.tryckt]}
                            onPress={() => klar('/konto?lage=skapa')}
                        >
                            <Text style={styles.knappVitText}>Skapa konto</Text>
                        </Pressable>
                        <Pressable style={styles.knappKant} onPress={() => klar('/konto?lage=logga-in')}>
                            <Text style={styles.knappKantText}>Jag har redan ett konto</Text>
                        </Pressable>
                        <Pressable onPress={() => klar()} hitSlop={10}>
                            <Text style={styles.utan}>Fortsätt utan konto</Text>
                        </Pressable>
                    </Sida>
                ) : null}
            </Animated.ScrollView>

            <View style={styles.fot}>
                <View style={styles.prickar}>
                    {Array.from({ length: SIDOR }, (_, i) => (
                        <View key={i} style={[styles.prick, i === sida && styles.prickAktiv]} />
                    ))}
                </View>
                {sida < SIDOR - 1 ? (
                    <Pressable
                        style={({ pressed }) => [styles.nästa, pressed && styles.tryckt]}
                        onPress={() => gåTill(sida + 1)}
                    >
                        <Text style={styles.nästaText}>{sida === PLATS_SIDA && !platsSvar ? 'Inte nu' : 'Nästa'}</Text>
                    </Pressable>
                ) : KONTON_PÅ ? (
                    <View style={styles.nästaPlats} />
                ) : (
                    <Pressable
                        style={({ pressed }) => [styles.nästa, pressed && styles.tryckt]}
                        onPress={() => klar()}
                    >
                        <Text style={styles.nästaText}>{platsSvar ? 'Kom igång' : 'Inte nu'}</Text>
                    </Pressable>
                )}
            </View>
        </View>
    );
}

function Sida({ width, children }: { width: number; children: React.ReactNode }) {
    return <View style={[styles.sida, { width }]}>{children}</View>;
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: BLÅ },
    hoppa: { position: 'absolute', top: 62, right: 22, zIndex: 2 },
    hoppaText: { color: 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: '700' },
    sida: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingBottom: 110 },
    litetMoln: { width: 120, height: 84, marginBottom: 20 },
    rubrik: { color: '#ffffff', fontSize: 28, fontWeight: '900', textAlign: 'center' },
    text: { marginTop: 14, color: 'rgba(255,255,255,0.9)', fontSize: 16, lineHeight: 24, textAlign: 'center' },
    kvitto: { marginTop: 26, color: '#ffffff', fontSize: 16, fontWeight: '800' },
    fördelar: { marginTop: 18, marginBottom: 26, gap: 10, alignSelf: 'stretch' },
    fördelRad: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    fördelIkon: { width: 26, height: 22, alignItems: 'center', justifyContent: 'center' },
    fördelEmoji: { fontSize: 18 },
    fördel: { flex: 1, color: '#ffffff', fontSize: 16, fontWeight: '600', lineHeight: 22 },
    knappVit: {
        marginTop: 26,
        alignSelf: 'stretch',
        backgroundColor: '#ffffff',
        borderRadius: 999,
        paddingVertical: 15,
        alignItems: 'center',
    },
    knappVitText: { color: BLÅ, fontSize: 17, fontWeight: '900' },
    knappKant: {
        marginTop: 12,
        alignSelf: 'stretch',
        borderRadius: 999,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.8)',
        paddingVertical: 13,
        alignItems: 'center',
    },
    knappKantText: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
    utan: { marginTop: 20, color: 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: '700', textDecorationLine: 'underline' },
    tryckt: { opacity: 0.8 },
    fot: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 48,
        paddingHorizontal: 32,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    prickar: { flexDirection: 'row', gap: 8 },
    prick: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.35)' },
    prickAktiv: { backgroundColor: '#ffffff', width: 22 },
    nästa: { backgroundColor: '#ffffff', borderRadius: 999, paddingHorizontal: 26, paddingVertical: 12 },
    nästaText: { color: BLÅ, fontSize: 16, fontWeight: '900' },
    nästaPlats: { width: 1, height: 44 },
});
