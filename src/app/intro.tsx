/**
 * Introt - första starten. Sex sidor på VADKUL-blått: vad VADKUL är, hur
 * kartan läses, sök/filter/spara, startstadsvalet, kategorierna och kontot.
 *
 * Startstadsvalet (sida 4) + kategorisidan (sida 5) är webbens StartCityPicker
 * (ägarbeslut 8/10 2026, förebild happymap.se) i introts form:
 *  - "Använd min plats" ELLER en startstad ur kontraktets CITIES (snabbval +
 *    sök). Valet sparas (lib/startval via regionContext.väljStartstad) och
 *    VINNER över GPS:en och Stockholm-fallbacken; med vald stad ställs ingen
 *    platsfråga vid start.
 *  - Kategorisidan är väljarens steg 2: 🔥 Populära först, kategorierna och
 *    Fler (källorna). Valen går rakt in i det vanliga sparade kartfiltret
 *    (lib/filterContext, som redan har sökpanelens växlingsregler: källan
 *    utesluter kategorierna och 🔥; kategorier sparas, 🔥/källa gäller besöket).
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
    Keyboard,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    useWindowDimensions,
    View,
} from 'react-native';
import { router } from 'expo-router';
import { CITIES, EVENT_CATEGORY_KEYS, type City, type EventCategoryType } from '@vadkul/kontrakt';
import { Ikon, type IkonNamn } from '@/components/Ikon';
import {
    INTRO_EVENT,
    INTRO_KARTA,
    INTRO_SÖK,
    IntroBakgrund,
    MolnMedBrickor,
    SvävandeTelefon,
    TelefonPar,
    useTelefonHöjd,
} from '@/components/IntroScen';
import { useFilter } from '@/lib/filterContext';
import { KONTON_PÅ } from '@/lib/funktioner';
import { KÄLLOR } from '@/lib/kartFilter';
import { KATEGORIER } from '@/lib/kategorier';
import { useRegionVal } from '@/lib/regionContext';
import { searchCities } from '@/lib/sok';
import { snabbvalsStäder } from '@/lib/startval';

const BLÅ = '#006aa7';
const MOLN = require('../../assets/images/splash-icon.png');

/** Kontosidan utgår i v1 (lib/funktioner: KONTON_PÅ) - då är kategorisidan sista steget. */
const SIDOR = KONTON_PÅ ? 6 : 5;
const PLATS_SIDA = 3;
const KATEGORI_SIDA = 4;

/** Väljarens kategorier - Övrigt är inget val (webbens CATEGORY_KEYS). */
const INTRO_KATEGORIER = EVENT_CATEGORY_KEYS.filter(k => k !== 'other');
const SNABBVAL = snabbvalsStäder(8);

/** Kontosidans fördelar - symboler, inte emojier, för profil och plats (ägarbeslut 28/10). */
const FÖRDELAR: [IkonNamn | '✨', string][] = [
    ['profil', 'Samma konto här och på vadkul.se'],
    ['plats', 'Din stad sparas - kartan och tipsen blir dina'],
    ['✨', 'Önska och skapa egna event'],
];

export default function IntroScreen() {
    const { width } = useWindowDimensions();
    const { avslutaIntro, begärPlats, väljStartstad } = useRegionVal();
    const filter = useFilter();
    const scrollRef = useRef<ScrollView>(null);
    const scrollX = useRef(new Animated.Value(0)).current;
    const telefonHöjd = useTelefonHöjd();
    const [sida, setSida] = useState(0);
    /** Platssidans svar: 'plats' = min plats, City = vald startstad. */
    const [svar, setSvar] = useState<'plats' | City | null>(null);
    const [ortSök, setOrtSök] = useState('');
    const [flerÖppet, setFlerÖppet] = useState(false);

    const valdOrt = svar !== null && svar !== 'plats' ? svar : null;
    const träffar = ortSök.trim().length >= 2 ? searchCities(ortSök, 8) : SNABBVAL;

    const gåTill = (i: number) => {
        scrollRef.current?.scrollTo({ x: i * width, animated: true });
        setSida(i);
    };

    const väljPlats = () => {
        väljStartstad(null);
        setSvar('plats');
        begärPlats();
    };

    const väljOrt = (c: City) => {
        väljStartstad(c);
        setSvar(c);
        Keyboard.dismiss();
        gåTill(KATEGORI_SIDA);
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
                keyboardShouldPersistTaps="handled"
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

                {/* Startvalet behöver plats för sökfält och orter ovanför
                    tangentbordet - därför innehållet i topp och ingen
                    platspuls här (components/IntroScen PlatsPuls). */}
                <Sida width={width} topp>
                    <Text style={styles.rubrik}>Var vill du börja?</Text>
                    <Text style={styles.text}>
                        Kartan öppnar där varje gång du kommer tillbaka - och din plats stannar i telefonen.
                    </Text>
                    {svar === 'plats' ? (
                        <Text style={styles.kvitto}>Tack! Kartan hittar din stad.</Text>
                    ) : (
                        <Pressable
                            style={({ pressed }) => [styles.knappVit, pressed && styles.tryckt]}
                            onPress={väljPlats}
                        >
                            <View style={styles.knappRad}>
                                <Ikon namn="plats" storlek={17} färg={BLÅ} />
                                <Text style={styles.knappVitText}>Använd min plats</Text>
                            </View>
                        </Pressable>
                    )}
                    <Text style={styles.eller}>eller välj en startstad</Text>
                    <TextInput
                        style={styles.sökFält}
                        value={ortSök}
                        onChangeText={setOrtSök}
                        placeholder={`Sök bland ${CITIES.length} orter …`}
                        placeholderTextColor="rgba(255,255,255,0.55)"
                        autoCorrect={false}
                        autoCapitalize="words"
                        returnKeyType="search"
                        clearButtonMode="while-editing"
                        onSubmitEditing={() => { if (träffar[0]) väljOrt(träffar[0]); }}
                    />
                    <View style={styles.valChipRad}>
                        {träffar.length === 0 ? (
                            <Text style={styles.ingenTräff}>Hittar ingen ort som heter så.</Text>
                        ) : (
                            träffar.map(c => (
                                <ValChip
                                    key={c.slug}
                                    text={c.name}
                                    vald={valdOrt?.slug === c.slug}
                                    onPress={() => väljOrt(c)}
                                />
                            ))
                        )}
                    </View>
                </Sida>

                <Sida width={width}>
                    <Text style={styles.rubrik}>Vad gillar du?</Text>
                    <Text style={styles.text}>
                        {valdOrt ? `Vi visar det först i ${valdOrt.name}.` : 'Vi visar det först där du är.'}
                        {' '}Välj ingen så ser du allt.
                    </Text>
                    <View style={styles.valChipRad}>
                        <ValChip text="🔥 Populära" vald={filter.populärt} onPress={filter.växlaPopulärt} />
                        {INTRO_KATEGORIER.map(k => (
                            <ValChip
                                key={k}
                                text={`${KATEGORIER[k].emoji} ${KATEGORIER[k].label}`}
                                vald={filter.kategorier.has(k as EventCategoryType)}
                                onPress={() => filter.växlaKategori(k as EventCategoryType)}
                            />
                        ))}
                        <ValChip
                            text={flerÖppet ? 'Färre' : 'Fler …'}
                            vald={flerÖppet || filter.källa !== null}
                            onPress={() => setFlerÖppet(o => !o)}
                        />
                        {flerÖppet
                            ? KÄLLOR.map(k => (
                                <ValChip
                                    key={k.key}
                                    text={`${k.emoji} ${k.label}`}
                                    vald={filter.källa === k.key}
                                    onPress={() => filter.växlaKälla(k.key)}
                                />
                            ))
                            : null}
                    </View>
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
                        <Text style={styles.nästaText}>{sida === PLATS_SIDA && !svar ? 'Inte nu' : 'Nästa'}</Text>
                    </Pressable>
                ) : KONTON_PÅ ? (
                    <View style={styles.nästaPlats} />
                ) : (
                    <Pressable
                        style={({ pressed }) => [styles.nästa, pressed && styles.tryckt]}
                        onPress={() => klar()}
                    >
                        <Text style={styles.nästaText}>{filter.aktivt ? 'Visa kartan' : 'Visa allt'}</Text>
                    </Pressable>
                )}
            </View>
        </View>
    );
}

function Sida({ width, topp, children }: { width: number; topp?: boolean; children: React.ReactNode }) {
    return <View style={[styles.sida, { width }, topp && styles.sidaTopp]}>{children}</View>;
}

/** Valbart chip på den blå botten (orter, kategorier, källor). */
function ValChip({ text, vald, onPress }: { text: string; vald: boolean; onPress: () => void }) {
    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [styles.valChip, vald && styles.valChipVald, pressed && styles.tryckt]}
        >
            <Text style={[styles.valChipText, vald && styles.valChipTextVald]}>{text}</Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: BLÅ },
    hoppa: { position: 'absolute', top: 62, right: 22, zIndex: 2 },
    hoppaText: { color: 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: '700' },
    sida: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingBottom: 110 },
    /** Platssidan: innehållet i topp så sökfältet och orterna går fria från tangentbordet. */
    sidaTopp: { alignItems: 'stretch', justifyContent: 'flex-start', paddingTop: 84 },
    litetMoln: { width: 120, height: 84, marginBottom: 20 },
    rubrik: { color: '#ffffff', fontSize: 28, fontWeight: '900', textAlign: 'center' },
    text: { marginTop: 14, color: 'rgba(255,255,255,0.9)', fontSize: 16, lineHeight: 24, textAlign: 'center' },
    kvitto: { marginTop: 24, color: '#ffffff', fontSize: 16, fontWeight: '800', textAlign: 'center', paddingVertical: 8 },
    knappRad: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    eller: {
        marginTop: 20,
        marginBottom: 10,
        color: 'rgba(255,255,255,0.75)',
        fontSize: 13,
        fontWeight: '800',
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    sökFält: {
        backgroundColor: 'rgba(255,255,255,0.16)',
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
    },
    valChipRad: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 8,
        marginTop: 14,
    },
    valChip: {
        backgroundColor: 'rgba(255,255,255,0.16)',
        borderRadius: 999,
        paddingHorizontal: 13,
        paddingVertical: 8,
    },
    valChipVald: { backgroundColor: '#ffffff' },
    valChipText: { fontSize: 14, fontWeight: '800', color: '#ffffff' },
    valChipTextVald: { color: BLÅ },
    ingenTräff: { color: 'rgba(255,255,255,0.75)', fontSize: 14, fontWeight: '600' },
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
