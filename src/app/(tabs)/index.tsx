/**
 * Kartan - appens hem. Nöjesfälts-stilen (samma transform som webben),
 * teardrop-brickor med kategori-emoji som symbol-lager, och regionval via
 * delade RegionProvider (GPS-stad, eller manuellt val från Städer-fliken).
 *
 * Kart-ui-arv från huvudrepot som gäller HÄR: ingen intro-kamera (kartan
 * öppnar i staden och står still; stadsbyte gör ETT hopp), EN dag i taget
 * med dagväljaren FAST i botten (valt läge = vit platta, ALDRIG guld -
 * guld betyder boost), brickor - inte bara prickar/emoji.
 */
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Camera, GeoJSONSource, Images, Layer, Map } from '@maplibre/maplibre-react-native';
import type { CameraRef, Expression, StyleSpecification } from '@maplibre/maplibre-react-native';
import type { AppFeedEvent } from '@vadkul/kontrakt';
import { useAppFeed, toFeatureCollection } from '@/api/appFeed';
import { EventKort } from '@/components/EventKort';
import { useRegionVal } from '@/lib/regionContext';
import { dagKey, eventPåDag, kommandeDagar } from '@/lib/dagar';
import { BOOTSTRAP_STYLE, fetchThemeParkStyle, STREETS_STYLE_URL, type StyleJson } from '@/lib/themeParkStyle';
import { BRICKA_IMAGES, BRICKA_ICON_EXPRESSION, BRICKA_ICON_SIZE } from '@/lib/brickor';

export default function KartScreen() {
    const { city, region, fromGps, manuell } = useRegionVal();
    const feed = useAppFeed(region);
    const events = feed.data?.events ?? [];

    // Dagväljaren: flödets horisont är 14 dagar; EN dag visas i taget.
    const dagar = kommandeDagar(14);
    const [dag, setDag] = useState(() => dagKey(new Date()));
    const synliga = events.filter((e) => eventPåDag(e.time, dag));

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
            <View style={styles.badge} pointerEvents="none">
                <Text style={styles.badgeText}>
                    {feed.isLoading ? 'Hämtar event …'
                        : feed.isError ? 'Flödet nås inte just nu'
                        : `${synliga.length} event · ${city.name}${fromGps || manuell ? '' : ' (standard)'}`}
                </Text>
            </View>
            <View style={styles.dagRadYta}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.dagRad}
                >
                    {dagar.map((d) => {
                        const vald = d.key === dag;
                        return (
                            <Pressable
                                key={d.key}
                                onPress={() => setDag(d.key)}
                                style={[styles.dagPill, vald && styles.dagPillVald]}
                            >
                                <Text style={[styles.dagText, vald && styles.dagTextVald]}>{d.label}</Text>
                            </Pressable>
                        );
                    })}
                </ScrollView>
            </View>
            {valt && <EventKort event={valt} onClose={() => setValt(null)} />}
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    map: { flex: 1 },
    badge: {
        position: 'absolute',
        top: 60,
        alignSelf: 'center',
        backgroundColor: 'rgba(255,255,255,0.92)',
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 6,
    },
    badgeText: { fontSize: 13, fontWeight: '600', color: '#242a33' },
    dagRadYta: { position: 'absolute', left: 0, right: 0, bottom: 14 },
    dagRad: { paddingHorizontal: 12, gap: 6 },
    dagPill: {
        backgroundColor: 'rgba(15,23,42,0.82)',
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 8,
    },
    dagPillVald: { backgroundColor: '#ffffff' },
    dagText: { fontSize: 13, fontWeight: '600', color: '#e2e8f0' },
    dagTextVald: { color: '#0f172a', fontWeight: '700' },
});
