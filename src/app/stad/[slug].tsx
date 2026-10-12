/**
 * Stadssidan - appens motsvarighet till webbens /evenemang/<stad>
 * (app/(v1)/evenemang/[stad]/page.tsx), sektionerna i webbens ordning:
 *
 *   rubrik → KART-HERON med periodchipsen (components/StadsHero) →
 *   intro-raden → SKAPADE PÅ VADKUL (StadsSpotlight) → hopfälld pitch +
 *   snabbönskan (StadsPitch) → KATEGORIRADEN (🔥, kategorier, FLER med
 *   kyrkan/PRO/Korpen - klistrar under toppen) + SÖKFÄLTET → dag-för-dag-
 *   listan → utfälld pitch → ÖNSKAS I X (StadsOnskningar) → arrangörer,
 *   fler städer och källraden.
 *
 * Utbudet är ortens event (<= 10 km, inte länets - ägarbeslutet 7/9) dag för
 * dag i 14 dagar, bara event som inte varit (webbens freshDays). Kategorier
 * och FLER-källor är kartans delade filter (lib/filterContext), periodvalet
 * och sökningen gäller bara sidan. Spotlightens event står inte en gång
 * till i listan.
 *
 * Ett event härifrån - rad, bricka eller spotlight - öppnas PÅ KARTAN i
 * stadens vy (lib/kartHopp, som webbens ?event=-länk): kortet får Nästa +
 * listan under kortet, och ← ☰ tar en tillbaka hit.
 *
 * MEDVETET UTE jämfört med webben: FAQ-sektionen och ForFun-raden (SEO och
 * länkbyte, appen indexeras inte), boost-nivån i spotlighten och pitchen
 * (appen säljer ingenting), toppnavens Sverige-siffra och "Uppdaterad"-raden.
 * Webbens "Evenemang i Sverige"-länk är riven (20/9) - ✕ tar en tillbaka.
 */
import { useMemo, useRef, useState } from 'react';
import { Animated, Pressable, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { CITIES, type AppFeedEvent } from '@vadkul/kontrakt';
import { useAnvändarEvent, useEvent } from '@/api/useEvent';
import { EventRad } from '@/components/EventRad';
import { KategoriRad } from '@/components/KategoriRad';
import { StadsHero } from '@/components/StadsHero';
import { StadsOnskningar } from '@/components/StadsOnskningar';
import { StadsPitch } from '@/components/StadsPitch';
import { StadsSpotlight } from '@/components/StadsSpotlight';
import { hämtaÖnskningar } from '@/data/onskningar';
import type { AppEvent } from '@/lib/appEvent';
import { useFilter } from '@/lib/filterContext';
import { isEventPast } from '@/lib/harVarit';
import { matcharFilter } from '@/lib/kartFilter';
import { begärKartHopp } from '@/lib/kartHopp';
import { önskningarNära, type Önskan } from '@/lib/onskningar';
import { useRegionVal } from '@/lib/regionContext';
import { normalizeSearchQuery } from '@/lib/sok';
import { stadsRadieKm } from '@/lib/stadsHero';
import { iPeriod, periodFras, räknaIPeriod, type Period } from '@/lib/stadsPeriod';
import { spotlightDokument, spotlightRader } from '@/lib/stadsSpotlight';
import {
    grupperaPerDag,
    matcharStadsSök,
    type DagSektion,
    närmasteStäder,
    stadensEvent,
    stadsIntro,
    topPlatser,
    toppArrangörer,
    utanStoraKällor,
} from '@/lib/stadsUtbud';
import { useNu } from '@/lib/useNu';

const BLÅ = '#006AA7';
const BAKGRUND = '#f8fafc';
/** Kategoriradens fasta höjd - platshållaren i flödet, den klistrade raden
 *  och dagrubrikernas luft ovanför sig (där raden ligger när de klistrar). */
const CHIPS_H = 50;

export default function StadScreen() {
    const { slug, q } = useLocalSearchParams<{ slug: string; q?: string }>();
    const stad = CITIES.find(c => c.slug === slug);
    const { väljStad } = useRegionVal();
    const filter = useFilter();
    const feed = useEvent(stad?.region ?? '');
    const användarEvent = useAnvändarEvent();
    // Samma query som kartans önskebrickor - färsk cache = ingen ny läsning.
    const önskningar = useQuery({ queryKey: ['onskningar'], queryFn: hämtaÖnskningar, staleTime: 10 * 60_000 });
    const nuMs = useNu();

    const [period, setPeriod] = useState<Period>('alla');
    // ?q= följer med från länkar (webbens kortsök → stadssidan) och tillbaka från kortet.
    const [sök, setSök] = useState(typeof q === 'string' ? q : '');
    const qNorm = normalizeSearchQuery(sök);

    const radie = stad ? stadsRadieKm(stad.slug) : 20;

    const iOrten = useMemo(() => {
        if (!stad) return [];
        return stadensEvent(feed.data ?? [], stad).filter(e => !isEventPast(e, nuMs));
    }, [feed.data, stad, nuMs]);

    const spotRader = useMemo(() => {
        if (!stad || användarEvent.isPending) return null;
        return spotlightRader(användarEvent.data ?? [], stad, radie, new Date(nuMs));
    }, [stad, användarEvent.isPending, användarEvent.data, radie, nuMs]);
    const spotDok = useMemo(() => spotlightDokument(spotRader ?? []), [spotRader]);

    // Herons brickor och listan: SAMMA urval (webbens delade dayFilter).
    const filtrerade = useMemo(
        () => iOrten.filter(e => matcharFilter(e, filter) && iPeriod(e.time, period) && matcharStadsSök(e, qNorm)),
        [iOrten, filter, period, qNorm],
    );
    const listan = useMemo(() => filtrerade.filter(e => !spotDok.has(e.docId ?? e.id)), [filtrerade, spotDok]);
    const sektioner = useMemo(() => grupperaPerDag(listan), [listan]);

    const intro = useMemo(() => {
        if (!stad) return '';
        const bas = utanStoraKällor(iOrten);
        return stadsIntro({
            stad: stad.name,
            antal: bas.length,
            idag: räknaIPeriod(bas, 'idag'),
            veckan: räknaIPeriod(bas, 'veckan'),
            platser: topPlatser(bas, stad.name),
        });
    }, [iOrten, stad]);
    const arrangörer = useMemo(() => toppArrangörer(iOrten), [iOrten]);
    const grannar = useMemo(() => (stad ? närmasteStäder(stad) : []), [stad]);
    // hämtaÖnskningar ger [] vid fel, så null betyder bara "hämtar".
    const önskasHär = useMemo(
        () => (stad && önskningar.data ? önskningarNära(önskningar.data, stad, radie) : null),
        [önskningar.data, stad, radie],
    );

    // Den klistrade kategoriraden: EN rad, absolut placerad över listan, som
    // följer med flödet tills den når toppen och står kvar där (webbens
    // sticky top-[57px], ägarbeslut 8/10). Platshållaren i flödet mäter var.
    const [scrollY] = useState(() => new Animated.Value(0));
    const [chipsY, setChipsY] = useState<number | null>(null);
    const listRef = useRef<SectionList<AppFeedEvent, DagSektion>>(null);
    // Fokus i sökfältet: rulla så kategoriraden klistrar och fältet står
    // direkt under den - tangentbordet ska inte täcka det man skriver i.
    const visaSökfältet = () => {
        if (chipsY !== null) listRef.current?.getScrollResponder()?.scrollTo({ y: chipsY, animated: true });
    };

    if (!stad) {
        return (
            <View style={styles.root}>
                <Text style={[styles.h1, styles.sidmarginal]}>Okänd stad</Text>
            </View>
        );
    }

    const öppna = (e: AppEvent) => {
        begärKartHopp({
            event: e,
            stadSlug: stad.slug,
            // Sökningen följer med tillbaka från kortet.
            retur: {
                etikett: 'Tillbaka till stadssidan',
                href: { pathname: '/stad/[slug]', params: { slug: stad.slug, ...(sök ? { q: sök } : {}) } },
            },
        });
        router.dismissTo('/');
    };
    const visaPåKartan = () => {
        väljStad(stad);
        router.dismissTo('/');
    };
    // Native sedan 11/10: skapa-arket äger skapa och önska.
    const skapa = () =>
        router.push({ pathname: '/skapa', params: { lat: String(stad.lat), lng: String(stad.lng), zoom: '13' } });
    const önska = (titel?: string) =>
        router.push({
            pathname: '/skapa',
            params: { lat: String(stad.lat), lng: String(stad.lng), zoom: '13', roll: 'wish', ...(titel ? { titel } : {}) },
        });
    const skapaFrånÖnskan = (w: Önskan) =>
        router.push({
            pathname: '/skapa',
            params: { lat: String(w.lat), lng: String(w.lng), zoom: '13', titel: w.title, kategori: w.category, onskanId: w.id },
        });

    const tomText = qNorm
        ? `Inget matchar "${sök.trim()}" i ${stad.name} ${periodFras(period)}.`
        : filter.aktivt
            ? `Inget med filtret som är på i ${stad.name} ${periodFras(period)}.`
            : `Inga event i ${stad.name} ${periodFras(period)}.`;

    const topp = (
        <View style={styles.sidmarginal}>
            <Text style={styles.h1}>Vad händer i {stad.name}?</Text>
            <View style={styles.hero}>
                <StadsHero
                    stad={stad}
                    events={filtrerade}
                    period={period}
                    onPeriod={setPeriod}
                    onÖppnaKartan={visaPåKartan}
                    onVäljEvent={öppna}
                />
            </View>
            <Text style={styles.intro}>{feed.isLoading ? 'Hämtar event …' : intro}</Text>
            <StadsSpotlight stadsnamn={stad.name} rader={spotRader} onVälj={öppna} onSkapa={skapa} />
            <StadsPitch stadsnamn={stad.name} hopfällbar onSkapa={skapa} onÖnska={önska} />
            <View
                style={styles.chipsPlats}
                onLayout={ev => setChipsY(ev.nativeEvent.layout.y)}
            />
            <View style={styles.sök}>
                <Text style={styles.sökIkon}>🔎</Text>
                <TextInput
                    value={sök}
                    onChangeText={setSök}
                    placeholder={`Sök bland eventen i ${stad.name}`}
                    placeholderTextColor="#94a3b8"
                    autoCorrect={false}
                    returnKeyType="search"
                    onFocus={visaSökfältet}
                    style={styles.sökFält}
                    accessibilityLabel={`Sök bland eventen i ${stad.name}`}
                />
                {sök ? (
                    <Pressable onPress={() => setSök('')} hitSlop={10} accessibilityLabel="Rensa sökningen">
                        <Text style={styles.sökRensa}>✕</Text>
                    </Pressable>
                ) : null}
            </View>
        </View>
    );

    const botten = (
        <View style={styles.sidmarginal}>
            <StadsPitch stadsnamn={stad.name} onSkapa={skapa} />
            <StadsOnskningar
                stadsnamn={stad.name}
                önskningar={önskasHär}
                nuMs={nuMs}
                onÖnska={() => önska()}
                onSkapaFrån={skapaFrånÖnskan}
            />
            <View style={styles.fot}>
                {arrangörer.length > 0 ? (
                    <>
                        <Text style={styles.fotRubrik}>ARRANGÖRER I {stad.name.toUpperCase()}</Text>
                        <View style={styles.fotChips}>
                            {arrangörer.map(a => (
                                <Pressable
                                    key={a.slug}
                                    onPress={() => router.push({ pathname: '/arrangor/[slug]', params: { slug: a.slug } })}
                                    style={({ pressed }) => [styles.fotChip, pressed && styles.tryckt]}
                                >
                                    <Text style={styles.fotChipText}>{a.namn}</Text>
                                </Pressable>
                            ))}
                        </View>
                    </>
                ) : null}
                <Text style={styles.fotRubrik}>EVENEMANG I FLER STÄDER</Text>
                <View style={styles.fotChips}>
                    {grannar.map(c => (
                        <Pressable
                            key={c.slug}
                            onPress={() => router.push({ pathname: '/stad/[slug]', params: { slug: c.slug } })}
                            style={({ pressed }) => [styles.fotChip, pressed && styles.tryckt]}
                        >
                            <Text style={styles.fotChipText}>{c.name}</Text>
                        </Pressable>
                    ))}
                    {/* Sista chipset: ut till kartan (webben 22/9), ifyllt i blått. */}
                    <Pressable onPress={visaPåKartan} style={({ pressed }) => [styles.fotChip, styles.fotChipKarta, pressed && styles.tryckt]}>
                        <Text style={[styles.fotChipText, styles.fotChipKartaText]}>Se alla event →</Text>
                    </Pressable>
                </View>
                <Text style={styles.källor}>
                    Eventen hämtas från öppna källor - arrangörers webbplatser, biljettplattformar och
                    föreningskalendrar. Fel i ett event? Rapportera det via eventkortet på kartan.
                </Text>
            </View>
        </View>
    );

    return (
        <View style={styles.root}>
            {/* Toppraden: kart-ingången till vänster (webbens toppnav), ✕ till höger. */}
            <View style={[styles.toppRad, styles.sidmarginal]}>
                <Pressable onPress={visaPåKartan} hitSlop={8} style={({ pressed }) => [styles.kartLänk, pressed && styles.tryckt]}>
                    <Text style={styles.kartLänkText}>← Se alla event på kartan</Text>
                </Pressable>
                <Pressable onPress={() => router.back()} hitSlop={12} style={styles.stang} accessibilityLabel="Tillbaka">
                    <Text style={styles.stangText}>✕</Text>
                </Pressable>
            </View>
            <View style={styles.listYta}>
                <Animated.SectionList
                    ref={listRef}
                    sections={sektioner}
                    keyExtractor={e => e.id}
                    stickySectionHeadersEnabled
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    automaticallyAdjustKeyboardInsets
                    scrollEventThrottle={16}
                    onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
                    ListHeaderComponent={topp}
                    ListEmptyComponent={
                        feed.isLoading ? null : (
                            <View style={styles.tom}>
                                <Text style={styles.tomText}>{tomText}</Text>
                                {period !== 'alla' ? (
                                    <Pressable onPress={() => setPeriod('alla')} style={({ pressed }) => [styles.tomKnapp, pressed && styles.tryckt]}>
                                        <Text style={styles.tomKnappText}>Visa alla dagar</Text>
                                    </Pressable>
                                ) : null}
                            </View>
                        )
                    }
                    ListFooterComponent={botten}
                    renderSectionHeader={({ section }) => (
                        // Luften ovanför rubriken är genomskinlig: när rubriken klistrar
                        // ligger kategoriraden där, och rubriken syns precis under den.
                        <View pointerEvents="none">
                            <View style={styles.dagLuft} />
                            <Text style={styles.dagRubrik}>{section.label}</Text>
                        </View>
                    )}
                    renderItem={({ item }) => (
                        <EventRad event={item} fråga={qNorm || undefined} onPress={() => öppna(item as AppEvent)} />
                    )}
                />
                {chipsY !== null && chipsY > 0 ? (
                    <Animated.View
                        style={[
                            styles.chipsKlister,
                            {
                                transform: [{
                                    translateY: scrollY.interpolate({
                                        inputRange: [0, chipsY],
                                        outputRange: [chipsY, 0],
                                        extrapolateLeft: 'extend',
                                        extrapolateRight: 'clamp',
                                    }),
                                }],
                            },
                        ]}
                    >
                        <KategoriRad events={iOrten} />
                    </Animated.View>
                ) : null}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: BAKGRUND, paddingTop: 64 },
    sidmarginal: { paddingHorizontal: 16 },
    tryckt: { opacity: 0.75 },
    toppRad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8 },
    kartLänk: { flexShrink: 1 },
    kartLänkText: { fontSize: 14, fontWeight: '900', color: BLÅ },
    stang: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#e2e8f0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    stangText: { fontSize: 13, fontWeight: '700', color: '#475569' },
    listYta: { flex: 1 },
    h1: { marginTop: 8, fontSize: 28, fontWeight: '900', color: BLÅ, letterSpacing: -0.4 },
    hero: { marginTop: 14 },
    intro: { marginTop: 10, fontSize: 14, lineHeight: 21, fontWeight: '500', color: '#475569' },
    chipsPlats: { height: CHIPS_H, marginTop: 20, marginHorizontal: -16 },
    chipsKlister: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: CHIPS_H,
        justifyContent: 'center',
        backgroundColor: 'rgba(248,250,252,0.97)',
        zIndex: 10,
        elevation: 3,
    },
    sök: {
        marginTop: 6,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        backgroundColor: '#ffffff',
        paddingHorizontal: 12,
    },
    sökIkon: { fontSize: 13 },
    sökFält: { flex: 1, paddingVertical: 10, fontSize: 15, color: '#0f172a' },
    sökRensa: { fontSize: 13, fontWeight: '900', color: '#64748b' },
    dagLuft: { height: CHIPS_H },
    dagRubrik: {
        backgroundColor: BAKGRUND,
        paddingHorizontal: 16,
        paddingTop: 4,
        paddingBottom: 6,
        fontSize: 13,
        fontWeight: '800',
        color: '#334155',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
    tom: { alignItems: 'center', marginTop: 28, paddingHorizontal: 24, gap: 12 },
    tomText: { textAlign: 'center', color: '#64748b', fontSize: 14 },
    tomKnapp: { borderRadius: 999, backgroundColor: '#e2e8f0', paddingHorizontal: 14, paddingVertical: 8 },
    tomKnappText: { fontSize: 13, fontWeight: '800', color: '#0f172a' },
    fot: { marginTop: 32, paddingTop: 20, paddingBottom: 48, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
    fotRubrik: { fontSize: 11, fontWeight: '900', letterSpacing: 1.4, color: '#94a3b8', marginBottom: 10 },
    fotChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 22 },
    fotChip: {
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        backgroundColor: '#ffffff',
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    fotChipText: { fontSize: 12, fontWeight: '700', color: '#475569' },
    fotChipKarta: { backgroundColor: BLÅ, borderColor: BLÅ },
    fotChipKartaText: { color: '#ffffff' },
    källor: { fontSize: 12, lineHeight: 17, fontWeight: '500', color: '#94a3b8' },
});
