/**
 * Sökpanelen - webbens FloatingNavbar-sök + SearchResults:
 *  - Kategoriraden överst, även utan söktext (kategorifiltret BOR i sökpanelen,
 *    ägarbeslut 16/9): 🔥 Populära först, FLER sist. Valet gäller kartan.
 *  - Filter på utan söktext = träffarna visas DIREKT (webbens ägarbeslut 7/10
 *    "kategorival visar listan", hit 18/10) - inte först när man skrivit
 *    något. Listan får STICKY dagrubriker ("Idag", "Imorgon", "ons 30 sep")
 *    som paneler, börjar på KARTANS dag (?dag=) och har det NÄRMASTE först
 *    inom varje dag (Josef 20/10: "då ska det vara de som är närmst en den
 *    dagen som ska visas") - från ens position, annars från staden. Fritt
 *    textsök behåller rankningens ordning utan rubriker.
 *  - Kategoriord i texten ("konst växjö", "musik och teater") ERSÄTTER
 *    chipsen och 🔥 för sökningen (Josef 20/10: "då ska jag ju få upp allt
 *    med konst i växjö" - med 🔥 på blev det bara populär konst, oftast
 *    inget). Det blir en filterlista som ovan, med orten som mittpunkt; öppnas
 *    en träff får kartan samma kategorier så kortet inte står bortfiltrerat.
 *  - Stadsraden: orter som matchar texten - tryck lägger staden på kartan.
 *  - Träffarna: webbens rankning (lib/sok), träffen i fetstil, samma filter
 *    som kartan (kategori/🔥/källor - utom när kategoriord ersätter det) och
 *    bara event som inte varit.
 *  - "jazz i göteborg" söker i ortens län även om kartan står någon annanstans.
 *  - En träff öppnas PÅ KARTAN (lib/kartHopp, webbens listval "som ett
 *    kartklick"): panelen stängs, kortet får Nästa + listan under kortet och
 *    ← ☰ tar en tillbaka hit med samma sökord (webbens searchReturn).
 */
import { useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { AppFeedEvent } from '@vadkul/kontrakt';
import { useEvent } from '@/api/useEvent';
import { EventRad } from '@/components/EventRad';
import { KategoriRad } from '@/components/KategoriRad';
import { useFilter } from '@/lib/filterContext';
import { isEventPast } from '@/lib/harVarit';
import { matcharFilter } from '@/lib/kartFilter';
import { begärKartHopp } from '@/lib/kartHopp';
import { KATEGORIER } from '@/lib/kategorier';
import { useRegionVal } from '@/lib/regionContext';
import { distanceKm } from '@/lib/regionVal';
import {
    CITY_SEARCH_RADIUS_KM,
    närmastPerDag,
    normalizeSearchQuery,
    searchCities,
    sokEvent,
    splitCityFromQuery,
    tolkaKategorier,
} from '@/lib/sok';

export default function SokScreen() {
    const { city, region, väljStad, minPos } = useRegionVal();
    const filter = useFilter();
    // ?q= = tillbaka från kortet (← ☰ "Tillbaka till sökningen"); ?dag= =
    // kartans dag (0 = idag) - filterlistan börjar där.
    const { q: frånKortet, dag } = useLocalSearchParams<{ q?: string; dag?: string }>();
    const [fråga, setFråga] = useState(frånKortet ?? '');
    const frånDag = Math.max(0, Number(dag) || 0);

    const q = normalizeSearchQuery(fråga);
    const { city: sökOrt, text: sökText } = splitCityFromQuery(q);
    const sökKategorier = useMemo(() => tolkaKategorier(sökText), [sökText]);
    const kategoriSök = sökKategorier.size > 0;
    // Filterlista (dagsektioner, närmast först) = inget fritt sökord: bara
    // chips, bara kategoriord och/eller bara en ort ("i växjö").
    const filterLista = q ? kategoriSök || (!!sökOrt && !sökText) : filter.aktivt;
    const feed = useEvent(sökOrt?.region ?? region);

    const underlag = useMemo(() => {
        const nu = Date.now();
        // Kategoriorden ersätter chipsen och 🔥 - opt-in-källorna gäller som förut.
        const f = kategoriSök
            ? { kategorier: sökKategorier, populärt: false, källa: null, optIn: filter.optIn }
            : filter;
        return (feed.data ?? []).filter(e => matcharFilter(e, f) && !isEventPast(e, nu));
    }, [feed.data, filter, kategoriSök, sökKategorier]);
    const träffar = useMemo(() => (filterLista ? [] : sokEvent(underlag, fråga)), [filterLista, underlag, fråga]);
    const sektioner = useMemo(() => {
        if (filterLista) {
            const iOrten = sökOrt
                ? underlag.filter(e => distanceKm(sökOrt.lat, sökOrt.lng, e.lat, e.lng) <= CITY_SEARCH_RADIUS_KM)
                : underlag;
            return närmastPerDag(iOrten, sökOrt ?? minPos ?? city, frånDag);
        }
        // Textsöket får EN rubriklös sektion - rankningens ordning ska inte
        // brytas av daggrupper.
        return träffar.length > 0 ? [{ titel: '', data: träffar }] : [];
    }, [filterLista, sökOrt, underlag, minPos, city, frånDag, träffar]);
    const städer = searchCities(fråga);
    const markera = sökText || q;

    const öppna = (e: AppFeedEvent) => {
        begärKartHopp({
            event: e,
            stadSlug: sökOrt?.slug ?? null,
            kategorier: kategoriSök ? sökKategorier : null,
            retur: {
                etikett: 'Tillbaka till sökningen',
                href: { pathname: '/sok', params: { q: fråga, dag: String(frånDag) } },
            },
        });
        router.dismissTo('/');
    };

    const visaStad = (slug: string) => {
        const c = städer.find(s => s.slug === slug);
        if (!c) return;
        väljStad(c);
        router.back();
    };

    return (
        <View style={styles.root}>
            <View style={styles.huvud}>
                <Text style={styles.rubrik}>Sök</Text>
                <Pressable onPress={() => router.back()} hitSlop={12} style={styles.stangKnapp} accessibilityLabel="Stäng">
                    <Text style={styles.stangText}>✕</Text>
                </Pressable>
            </View>
            <TextInput
                autoFocus
                style={styles.falt}
                placeholder={`Event eller ort - t.ex. "jazz i ${city.name}"`}
                placeholderTextColor="#94a3b8"
                value={fråga}
                onChangeText={setFråga}
                autoCorrect={false}
                autoCapitalize="none"
                clearButtonMode="while-editing"
                returnKeyType="search"
            />
            <View>
                <KategoriRad events={feed.data ?? []} />
            </View>
            {kategoriSök && filter.aktivt ? (
                // Chipsen kan lysa (🔥) fast listan inte följer dem - säg varför.
                <Text style={styles.ordFöre}>
                    Visar allt inom {[...sökKategorier].map(k => KATEGORIER[k].kort).join(' och ')} - sökordet går före filtret.
                </Text>
            ) : null}
            <SectionList
                sections={sektioner}
                keyExtractor={e => e.id}
                stickySectionHeadersEnabled
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                renderSectionHeader={({ section }) => section.titel ? (
                    <View style={styles.dagRubrik}>
                        <Text style={styles.dagRubrikText}>{section.titel}</Text>
                    </View>
                ) : null}
                ListHeaderComponent={
                    städer.length > 0 && !sökOrt ? (
                        <View style={styles.städer}>
                            {städer.map(c => (
                                <Pressable
                                    key={c.slug}
                                    style={({ pressed }) => [styles.stadRad, pressed && styles.tryckt]}
                                    onPress={() => visaStad(c.slug)}
                                >
                                    <Text style={styles.stadNamn}>📍 {c.name}</Text>
                                    <Text style={styles.stadLänk}>Visa på kartan ›</Text>
                                </Pressable>
                            ))}
                        </View>
                    ) : null
                }
                ListEmptyComponent={
                    !q && !filter.aktivt ? (
                        <Text style={styles.tomt}>Skriv titel, plats eller ort - eller välj en kategori.</Text>
                    ) : feed.isLoading ? (
                        <Text style={styles.tomt}>Hämtar event …</Text>
                    ) : !q ? (
                        <Text style={styles.tomt}>Inga kommande event matchar filtret just nu.</Text>
                    ) : (
                        <Text style={styles.tomt}>
                            Inga träffar på "{fråga.trim()}"{filter.aktivt && !kategoriSök ? ' med filtret som är på' : ''}.
                        </Text>
                    )
                }
                renderItem={({ item }) => (
                    <EventRad
                        event={item}
                        fråga={markera}
                        km={minPos ? distanceKm(minPos.lat, minPos.lng, item.lat, item.lng) : null}
                        onPress={() => öppna(item)}
                    />
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#f8fafc', paddingTop: 24 },
    huvud: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
    stangKnapp: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#e2e8f0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    stangText: { fontSize: 13, fontWeight: '700', color: '#475569' },
    rubrik: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
    falt: {
        marginHorizontal: 16,
        marginTop: 16,
        backgroundColor: '#ffffff',
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        color: '#0f172a',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    städer: { paddingBottom: 6 },
    stadRad: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#e0f2fe',
        marginHorizontal: 16,
        marginVertical: 3,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 11,
    },
    stadNamn: { fontSize: 15, fontWeight: '700', color: '#0c4a6e' },
    stadLänk: { fontSize: 13, fontWeight: '700', color: '#0369a1' },
    tryckt: { opacity: 0.7 },
    // Sticky dagpanelen: heltäckande band i sidbakgrunden så raderna inte
    // skymtar bakom, med mörk pill som själva rubriken.
    dagRubrik: { backgroundColor: '#f8fafc', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 },
    dagRubrikText: {
        alignSelf: 'flex-start',
        backgroundColor: '#0f172a',
        color: '#ffffff',
        fontSize: 12,
        fontWeight: '800',
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 5,
        overflow: 'hidden',
    },
    ordFöre: { marginHorizontal: 16, marginTop: 4, marginBottom: 2, fontSize: 13, color: '#64748b' },
    tomt: { textAlign: 'center', color: '#64748b', marginTop: 32, paddingHorizontal: 24, fontSize: 14 },
});
