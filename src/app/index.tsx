/**
 * Kartan — appens hem. Nöjesfälts-stilen (samma transform som webben),
 * teardrop-brickor med kategori-emoji som symbol-lager, och GPS-regionval:
 * kameran öppnar över närmaste stad och flödet hämtas för dess län.
 *
 * Kart-ui-arv från huvudrepot som gäller HÄR: ingen intro-kamera (kartan
 * öppnar i staden och står still), brickor — inte bara prickar/emoji.
 * Nästa steg: eventets FRIA emoji (runtime-bakning), eventkort + utlänk.
 */
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Camera, GeoJSONSource, Images, Layer, Map } from '@maplibre/maplibre-react-native';
import type { CameraRef, Expression, StyleSpecification } from '@maplibre/maplibre-react-native';
import { useAppFeed, toFeatureCollection } from '@/api/appFeed';
import { useRegion } from '@/lib/useRegion';
import { BOOTSTRAP_STYLE, fetchThemeParkStyle, STREETS_STYLE_URL, type StyleJson } from '@/lib/themeParkStyle';
import { BRICKA_IMAGES, BRICKA_ICON_EXPRESSION, BRICKA_ICON_SIZE } from '@/lib/brickor';

export default function KartScreen() {
    const { city, region, fromGps } = useRegion();
    const feed = useAppFeed(region);
    const events = feed.data?.events ?? [];

    // Nöjesfälts-stilen hämtas async; tills dess den enfärgade bootstrap-
    // plattan (samma land-grön → bytet tonar in). Nätfel → rå Voyager-URL,
    // webbens reservväg.
    const [mapStyle, setMapStyle] = useState<StyleJson | string>(BOOTSTRAP_STYLE);
    useEffect(() => {
        let aktiv = true;
        fetchThemeParkStyle()
            .then(s => { if (aktiv) setMapStyle(s); })
            .catch(() => { if (aktiv) setMapStyle(STREETS_STYLE_URL); });
        return () => { aktiv = false; };
    }, []);

    // GPS-staden kommer efter mount. Kart-ui-arvet: kartan öppnar stilla i
    // startstaden och GPS-svaret gör ETT hopp hem — via ref, inte via
    // kontrollerade Camera-props (en stop-prop som återappliceras vid varje
    // flödesrender skulle slåss med användarens panorering).
    const cameraRef = useRef<CameraRef>(null);
    useEffect(() => {
        if (fromGps) cameraRef.current?.flyTo({ center: [city.lng, city.lat], zoom: 11, duration: 1500 });
    }, [fromGps, city.lng, city.lat]);

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
                {events.length > 0 && (
                    <GeoJSONSource id="events" data={toFeatureCollection(events)}>
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
                        : `${events.length} event · ${city.name}${fromGps ? '' : ' (standard)'} · 14 dagar`}
                </Text>
            </View>
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
});
