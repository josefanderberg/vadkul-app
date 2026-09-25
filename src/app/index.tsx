/**
 * Kartan — appens hem. MVP-läget: MapLibre med Voyager-stilen, regionens
 * eventflöde som cirkelpunkter, centrerad på startstaden.
 *
 * MEDVETET ENKELT ÄN: cirklar i kategorifärg-neutral blå, ingen kamera-
 * koreografi. Teardrop-brickorna med emoji (kart-ui-besluten i huvudrepot)
 * portas som nästa steg — och nöjesfälts-transformen av stilen likaså.
 * GPS-regionval kommer med platsbehörigheten; tills dess Stockholm.
 */
import { StyleSheet, Text, View } from 'react-native';
import { Camera, GeoJSONSource, Layer, Map } from '@maplibre/maplibre-react-native';
import { useAppFeed, toFeatureCollection } from '@/api/appFeed';
import { DEFAULT_CITY } from '@/lib/regionVal';

// Samma stil som webben utgår från (v2MapBaseStyles.STREETS_STYLE_URL).
const STYLE_URL = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';

export default function KartScreen() {
    const region = DEFAULT_CITY.region;
    const feed = useAppFeed(region);
    const events = feed.data?.events ?? [];

    return (
        <View style={styles.root}>
            <Map style={styles.map} mapStyle={STYLE_URL}>
                <Camera
                    initialViewState={{
                        center: [DEFAULT_CITY.lng, DEFAULT_CITY.lat],
                        zoom: 11,
                    }}
                />
                {events.length > 0 && (
                    <GeoJSONSource id="events" data={toFeatureCollection(events)}>
                        <Layer
                            type="circle"
                            id="event-dots"
                            style={{
                                circleRadius: 5,
                                circleColor: '#33628f',
                                circleStrokeWidth: 1.5,
                                circleStrokeColor: '#ffffff',
                            }}
                        />
                    </GeoJSONSource>
                )}
            </Map>
            <View style={styles.badge} pointerEvents="none">
                <Text style={styles.badgeText}>
                    {feed.isLoading ? 'Hämtar event …'
                        : feed.isError ? 'Flödet nås inte just nu'
                        : `${events.length} event · ${DEFAULT_CITY.name}s län · 14 dagar`}
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
