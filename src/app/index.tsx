/**
 * Kartan - appens hem, med webbens kromlayout och formspråk: profil +
 * skapa (mörkblå med guldring - guld betyder boost/skapa, aldrig i
 * väljaren) uppe till vänster, mörka period/stads-plattan uppe i mitten,
 * sök uppe till höger, mörka dag/vecka-kontrollen fast i botten med
 * BÅDA raderna och antal (vald rad = vit pill).
 *
 * Kart-ui-arv från huvudrepot som gäller HÄR: ingen intro-kamera (kartan
 * öppnar i staden och står still; stadsbyte gör ETT hopp), pilarna stegar
 * EN dag i båda lägena, kalenderknappen morphar till nollställare (↺ tar
 * en till idag, perioden behålls), ingen snurra vid periodbyte, brickor
 * med kategoritext under - inte bara prickar/emoji.
 */
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Camera, GeoJSONSource, Images, Layer, Map } from '@maplibre/maplibre-react-native';
import type { CameraRef, Expression, StyleSpecification } from '@maplibre/maplibre-react-native';
import type { AppFeedEvent } from '@vadkul/kontrakt';
import { useAppFeed, toFeatureCollection } from '@/api/appFeed';
import { EventKort } from '@/components/EventKort';
import { useRegionVal } from '@/lib/regionContext';
import { eventIPeriod, periodLabel } from '@/lib/dagar';
import { BOOTSTRAP_STYLE, fetchThemeParkStyle, STREETS_STYLE_URL, type StyleJson } from '@/lib/themeParkStyle';
import { BRICKA_IMAGES, BRICKA_ICON_EXPRESSION, BRICKA_ICON_SIZE } from '@/lib/brickor';

/** Flödets horisont är 14 dagar - längre än så kan väljaren inte stega. */
const MAX_OFFSET = 13;

export default function KartScreen() {
    const { city, region, fromGps, manuell } = useRegionVal();
    const feed = useAppFeed(region);
    const events = feed.data?.events ?? [];

    // Dag/vecka-väljaren: offset i dagar + periodlängd (1 eller 7).
    const [offset, setOffset] = useState(0);
    const [längd, setLängd] = useState<1 | 7>(1);
    const dagens = events.filter((e) => eventIPeriod(e.time, offset, 1));
    const veckans = events.filter((e) => eventIPeriod(e.time, offset, 7));
    const synliga = längd === 1 ? dagens : veckans;

    // Nöjesfälts-stilen hämtas async; tills dess den enfärgade bootstrap-
    // plattan (samma land-grön → bytet tonar in). Nätfel → rå Voyager-URL,
    // webbens reservväg.
    const [mapStyle, setMapStyle] = useState<StyleJson | string>(BOOTSTRAP_STYLE);
    const [valt, setValt] = useState<AppFeedEvent | null>(null);
    useEffect(() => {
        let aktiv = true;
        fetchThemeParkStyle()
            .then(s => { if (aktiv) setMapStyle(s); })
            .catch(() => { if (aktiv) setMapStyle(STREETS_STYLE_URL); });
        return () => { aktiv = false; };
    }, []);

    // Stadsbytet (GPS-fixen eller ett manuellt val) gör ETT hopp - via ref,
    // inte kontrollerade Camera-props (en stop-prop som återappliceras vid
    // varje flödesrender skulle slåss med användarens panorering).
    const cameraRef = useRef<CameraRef>(null);
    const förstaRef = useRef(true);
    useEffect(() => {
        if (förstaRef.current) {
            förstaRef.current = false;
            if (!fromGps && !manuell) return; // startstaden ligger redan i initialViewState
        }
        cameraRef.current?.flyTo({ center: [city.lng, city.lat], zoom: 11, duration: 1500 });
    }, [city.slug, city.lng, city.lat, fromGps, manuell]);

    const skapa = () =>
        WebBrowser.openBrowserAsync(`https://vadkul.se/?plats=${city.lat},${city.lng},13&skapa=1`);

    return (
        <View style={styles.root}>
            <Map style={styles.map} mapStyle={mapStyle as StyleSpecification | string}>
                <Camera
                    ref={cameraRef}
                    initialViewState={{
                        center: [city.lng, city.lat],
                        zoom: 11,
                    }}
                />
                <Images images={BRICKA_IMAGES} />
                {synliga.length > 0 && (
                    <GeoJSONSource
                        id="events"
                        data={toFeatureCollection(synliga)}
                        onPress={(e) => {
                            const id = e.nativeEvent.features[0]?.properties?.id as string | undefined;
                            const träff = id ? synliga.find(ev => ev.id === id) : undefined;
                            if (träff) setValt(träff);
                        }}
                    >
                        <Layer
                            type="symbol"
                            id="event-brickor"
                            style={{
                                iconImage: BRICKA_ICON_EXPRESSION as Expression,
                                iconSize: BRICKA_ICON_SIZE,
                                iconAnchor: 'bottom',
                                iconAllowOverlap: true,
                                iconIgnorePlacement: true,
                                // Kategoritexten under brickan - webbens "Konst"/
                                // "Scen". Montserrat finns i CARTO-glyphsen.
                                textField: ['get', 'label'] as unknown as Expression,
                                textFont: ['Montserrat Medium', 'Open Sans Bold'],
                                textSize: 12,
                                textAnchor: 'top',
                                textOffset: [0, 0.35],
                                textColor: '#ffffff',
                                textHaloColor: 'rgba(36,42,51,0.9)',
                                textHaloWidth: 1.4,
                                textOptional: true,
                            }}
                        />
                    </GeoJSONSource>
                )}
            </Map>

            {/* Toppkromet - webbens layout: profil + skapa till vänster,
                mörka period/stads-plattan i mitten, sök till höger. */}
            <View style={styles.topKrom} pointerEvents="box-none">
                <View style={styles.topKolumn}>
                    <Pressable style={styles.rundKnapp} onPress={() => router.push('/profil')} accessibilityLabel="Profil">
                        <Text style={styles.rundIkon}>👤</Text>
                    </Pressable>
                    <Pressable style={styles.skapaKnapp} onPress={skapa} accessibilityLabel="Skapa event">
                        <Text style={styles.skapaIkon}>＋</Text>
                    </Pressable>
                </View>
                <Pressable style={styles.periodPlatta} onPress={() => router.push('/stader')}>
                    <Text style={styles.periodText}>{periodLabel(offset, längd)}</Text>
                    <Text style={styles.periodStad}>{city.name.toUpperCase()}</Text>
                </Pressable>
                <View style={styles.topKolumn}>
                    <Pressable style={styles.rundKnapp} onPress={() => router.push('/sok')} accessibilityLabel="Sök">
                        <Text style={styles.rundIkon}>🔍</Text>
                    </Pressable>
                </View>
            </View>

            {/* Dag/vecka-kontrollen fast i botten - webbens mörka platta med
                båda raderna och antal. ↺ utanför plattan tar en till idag. */}
            <View style={styles.väljarYta} pointerEvents="box-none">
                <View style={styles.växlaPill}>
                    <Text style={styles.växlaText}>TRYCK FÖR ATT VÄXLA</Text>
                </View>
                <View style={styles.väljarRad}>
                    {offset > 0 ? (
                        <Pressable style={styles.nollKnapp} onPress={() => setOffset(0)} accessibilityLabel="Till idag">
                            <Text style={styles.nollText}>↺</Text>
                        </Pressable>
                    ) : null}
                    <View style={styles.mörkPlatta}>
                        <Pressable
                            onPress={() => setOffset(o => Math.max(0, o - 1))}
                            disabled={offset === 0}
                            hitSlop={8}
                            style={[styles.pilKnapp, offset === 0 && styles.pilDimmad]}
                            accessibilityLabel="Föregående dag"
                        >
                            <Text style={styles.pilText}>‹</Text>
                        </Pressable>
                        <Pressable style={styles.radKolumn} onPress={() => setLängd(l => (l === 1 ? 7 : 1))}>
                            <View style={[styles.periodRad, längd === 1 && styles.periodRadVald]}>
                                <Text style={[styles.radText, längd === 1 && styles.radTextVald]}>
                                    {periodLabel(offset, 1).toUpperCase()}
                                </Text>
                                <Text style={[styles.radAntal, längd === 1 && styles.radTextVald]}>
                                    {feed.isLoading ? '…' : dagens.length}
                                </Text>
                            </View>
                            <View style={[styles.periodRad, längd === 7 && styles.periodRadVald]}>
                                <Text style={[styles.radText, längd === 7 && styles.radTextVald]}>
                                    {periodLabel(offset, 7).toUpperCase()}
                                </Text>
                                <Text style={[styles.radAntal, längd === 7 && styles.radTextVald]}>
                                    {feed.isLoading ? '…' : veckans.length}
                                </Text>
                            </View>
                        </Pressable>
                        <Pressable
                            onPress={() => setOffset(o => Math.min(MAX_OFFSET, o + 1))}
                            hitSlop={8}
                            style={styles.pilKnapp}
                            accessibilityLabel="Nästa dag"
                        >
                            <Text style={styles.pilText}>›</Text>
                        </Pressable>
                    </View>
                </View>
            </View>

            {valt && <EventKort event={valt} onClose={() => setValt(null)} />}
        </View>
    );
}

const KNAPP = 46;
const MÖRK = 'rgba(36,42,51,0.92)';

const styles = StyleSheet.create({
    root: { flex: 1 },
    map: { flex: 1 },
    topKrom: {
        position: 'absolute',
        top: 58,
        left: 12,
        right: 12,
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
    },
    topKolumn: { width: KNAPP, gap: 10 },
    rundKnapp: {
        width: KNAPP,
        height: KNAPP,
        borderRadius: KNAPP / 2,
        backgroundColor: 'rgba(255,255,255,0.95)',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 4,
    },
    rundIkon: { fontSize: 19 },
    skapaKnapp: {
        width: KNAPP,
        height: KNAPP,
        borderRadius: KNAPP / 2,
        backgroundColor: '#1d4ed8',
        borderWidth: 3,
        borderColor: '#FECC02',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 4,
    },
    skapaIkon: { fontSize: 24, fontWeight: '700', color: '#ffffff', marginTop: -2 },
    periodPlatta: {
        backgroundColor: MÖRK,
        borderRadius: 24,
        paddingHorizontal: 28,
        paddingVertical: 10,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 6,
    },
    periodText: { fontSize: 19, fontWeight: '800', color: '#ffffff' },
    periodStad: { marginTop: 1, fontSize: 11, fontWeight: '700', color: '#cbd5e1', letterSpacing: 1.6 },
    väljarYta: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 26,
        alignItems: 'center',
        gap: 6,
    },
    växlaPill: {
        backgroundColor: MÖRK,
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 4,
    },
    växlaText: { fontSize: 10, fontWeight: '700', color: '#e2e8f0', letterSpacing: 1.2 },
    väljarRad: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    nollKnapp: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: MÖRK,
        alignItems: 'center',
        justifyContent: 'center',
    },
    nollText: { fontSize: 18, color: '#ffffff', fontWeight: '700' },
    mörkPlatta: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: MÖRK,
        borderRadius: 26,
        paddingHorizontal: 6,
        paddingVertical: 6,
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 6,
    },
    pilKnapp: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pilDimmad: { opacity: 0.35 },
    pilText: { fontSize: 24, fontWeight: '700', color: '#ffffff', marginTop: -3 },
    radKolumn: { minWidth: 210, gap: 2 },
    periodRad: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 5,
    },
    periodRadVald: { backgroundColor: '#ffffff' },
    radText: { fontSize: 13, fontWeight: '800', color: 'rgba(255,255,255,0.85)', letterSpacing: 1 },
    radTextVald: { color: '#0f172a' },
    radAntal: { fontSize: 15, fontWeight: '800', color: 'rgba(255,255,255,0.85)', marginLeft: 12 },
});
