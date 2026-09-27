/**
 * Kartan - appens hem, med webbens kromlayout: profil + skapa uppe till
 * vänster, stadsplattan uppe i mitten (visar BARA namnet - webbens
 * ägarbeslut), sök uppe till höger, dag/vecka-väljaren fast i botten.
 *
 * Kart-ui-arv från huvudrepot som gäller HÄR: ingen intro-kamera (kartan
 * öppnar i staden och står still; stadsbyte gör ETT hopp), EN dag eller
 * HELA VECKAN i taget, pilarna stegar EN dag i båda lägena, ALDRIG guld i
 * väljaren (guld betyder boost), ingen snurra vid periodbyte, brickor -
 * inte bara prickar/emoji.
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
    const synliga = events.filter((e) => eventIPeriod(e.time, offset, längd));

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

    const väljarHjälp = feed.isLoading
        ? 'Hämtar event …'
        : feed.isError
        ? 'Flödet nås inte just nu'
        : `${synliga.length} event · tryck för ${längd === 1 ? 'hela veckan' : 'en dag'}`;

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
                            }}
                        />
                    </GeoJSONSource>
                )}
            </Map>

            {/* Toppkromet: vänsterkolumn (profil + skapa), stadsplattan i
                mitten, sök till höger - webbens layout. */}
            <View style={styles.topKrom} pointerEvents="box-none">
                <View style={styles.topKolumn}>
                    <Pressable style={styles.rundKnapp} onPress={() => router.push('/profil')} accessibilityLabel="Profil">
                        <Text style={styles.rundIkon}>👤</Text>
                    </Pressable>
                    <Pressable style={styles.rundKnapp} onPress={skapa} accessibilityLabel="Skapa event">
                        <Text style={styles.plusIkon}>＋</Text>
                    </Pressable>
                </View>
                <Pressable style={styles.stadsPlatta} onPress={() => router.push('/stader')}>
                    <Text style={styles.stadsNamn}>{city.name}</Text>
                </Pressable>
                <View style={styles.topKolumn}>
                    <Pressable style={styles.rundKnapp} onPress={() => router.push('/sok')} accessibilityLabel="Sök">
                        <Text style={styles.rundIkon}>🔍</Text>
                    </Pressable>
                </View>
            </View>

            {/* Dag/vecka-väljaren fast i botten. ↺ tar en till idag när
                offset > 0 (webbens nollställare); perioden behålls. */}
            <View style={styles.väljarYta} pointerEvents="box-none">
                {offset > 0 ? (
                    <Pressable style={styles.nollKnapp} onPress={() => setOffset(0)} accessibilityLabel="Till idag">
                        <Text style={styles.nollText}>↺</Text>
                    </Pressable>
                ) : null}
                <View style={styles.väljarPlatta}>
                    <Pressable
                        onPress={() => setOffset(o => Math.max(0, o - 1))}
                        hitSlop={8}
                        style={styles.pil}
                        accessibilityLabel="Föregående dag"
                    >
                        <Text style={styles.pilText}>‹</Text>
                    </Pressable>
                    <Pressable style={styles.väljarMitt} onPress={() => setLängd(l => (l === 1 ? 7 : 1))}>
                        <Text style={styles.väljarEtikett}>{periodLabel(offset, längd)}</Text>
                        <Text style={styles.väljarHjälp}>{väljarHjälp}</Text>
                    </Pressable>
                    <Pressable
                        onPress={() => setOffset(o => Math.min(MAX_OFFSET, o + 1))}
                        hitSlop={8}
                        style={styles.pil}
                        accessibilityLabel="Nästa dag"
                    >
                        <Text style={styles.pilText}>›</Text>
                    </Pressable>
                </View>
            </View>

            {valt && <EventKort event={valt} onClose={() => setValt(null)} />}
        </View>
    );
}

const KNAPP = 44;

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
        backgroundColor: 'rgba(255,255,255,0.94)',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 4,
    },
    rundIkon: { fontSize: 19 },
    plusIkon: { fontSize: 24, fontWeight: '700', color: '#0f172a', marginTop: -2 },
    stadsPlatta: {
        backgroundColor: 'rgba(255,255,255,0.94)',
        borderRadius: 999,
        paddingHorizontal: 26,
        paddingVertical: 11,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 4,
    },
    stadsNamn: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
    väljarYta: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 30,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    nollKnapp: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(15,23,42,0.82)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    nollText: { fontSize: 17, color: '#ffffff', fontWeight: '700' },
    väljarPlatta: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderRadius: 999,
        paddingHorizontal: 6,
        paddingVertical: 5,
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 6,
    },
    pil: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pilText: { fontSize: 22, fontWeight: '700', color: '#0f172a', marginTop: -2 },
    väljarMitt: { alignItems: 'center', paddingHorizontal: 14, minWidth: 150 },
    väljarEtikett: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
    väljarHjälp: { marginTop: 1, fontSize: 11, fontWeight: '600', color: '#64748b' },
});
