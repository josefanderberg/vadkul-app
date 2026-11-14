/**
 * Rutan som visar vad en platsskylt är när man trycker på den (VADKUL#225,
 * hit i #234): platstypen ("Badplats") och platsens namn när kaklen har ett.
 * Josef 13/11: "det kan väl komma upp vad det är om man klickar på en skylt
 * okså. gärna namnet på badplatsen eller naturreservatet. de som har namn".
 *
 * Webbens motsvarighet är MapLibres popup (components/v2/v2MapPoiSignPopup):
 * en vit ruta ovanför skylten som följer med kartan. Här är den en vanlig vy
 * OVANPÅ kartan, lagd på skyltens skärmpunkt. Kartskärmen ropar `följ()` när
 * kartan rör sig, och rutan frågar då kartan var skylten står nu - i den här
 * lilla komponenten, så kartskärmen inte ritas om under en panorering.
 * Rutan tar aldrig emot tryck: nästa tryck på kartan stänger den (eller
 * öppnar nästa skylt), som på webben.
 */
import { useCallback, useImperativeHandle, useRef, useState, type Ref, type RefObject } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { MapRef } from '@maplibre/maplibre-react-native';
import { POI_SIGN_HIT } from '@vadkul/kontrakt';
import type { SkyltKandidat } from '@/lib/kartSkyltar';

export interface SkyltRutaRef {
    /** Visa rutan för skylten, vars fot står på skärmpunkten (x, y). */
    visa(skylt: SkyltKandidat, fot: { x: number; y: number }): void;
    stäng(): void;
    /** Kartan har rört sig: lägg rutan där skylten står nu. */
    följ(): void;
}

type Öppen = SkyltKandidat & { x: number; y: number };

/** Rutans största bredd, som webbens popup (maxWidth 220px). */
const BREDD = 220;

export function SkyltRuta({ ref, kartaRef }: { ref: Ref<SkyltRutaRef>; kartaRef: RefObject<MapRef | null> }) {
    const [öppen, setÖppen] = useState<Öppen | null>(null);
    const öppenRef = useRef<Öppen | null>(null);
    const mäterRef = useRef(false);
    const igenRef = useRef(false);

    const sätt = useCallback((ny: Öppen | null) => {
        öppenRef.current = ny;
        setÖppen(ny);
    }, []);

    // En mätning åt gången: kartan skickar rörelsehändelser tätare än svaren
    // hinner tillbaka. Kom det en rörelse under mätningen mäts det en gång till.
    const följ = useCallback(() => {
        if (mäterRef.current) {
            igenRef.current = true;
            return;
        }
        const karta = kartaRef.current;
        if (!öppenRef.current || !karta) return;
        mäterRef.current = true;
        void (async () => {
            try {
                do {
                    igenRef.current = false;
                    const nu = öppenRef.current;
                    if (!nu) break;
                    const [x, y] = await karta.project(nu.lngLat);
                    // Bara om samma skylt fortfarande visas.
                    if (öppenRef.current === nu) sätt({ ...nu, x, y });
                } while (igenRef.current);
            } catch {
                // Kartan inte klar - rutan står kvar där den stod.
            } finally {
                mäterRef.current = false;
            }
        })();
    }, [kartaRef, sätt]);

    useImperativeHandle(ref, () => ({
        visa: (skylt, fot) => sätt({ ...skylt, x: fot.x, y: fot.y }),
        stäng: () => { if (öppenRef.current) sätt(null); },
        följ,
    }), [sätt, följ]);

    if (!öppen) return null;
    const { info } = öppen;
    return (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            {/* Ankaret slutar strax ovanför plattan (webbens offset): rutan
                står i dess nederkant, mitt över skylten. */}
            <View
                style={[styles.ankare, {
                    left: öppen.x - BREDD / 2,
                    height: Math.max(0, öppen.y - POI_SIGN_HIT.above),
                }]}
            >
                <View style={styles.ruta} accessibilityRole="text">
                    <Text style={info.name ? styles.typ : styles.namn} numberOfLines={1}>{info.type}</Text>
                    {info.name ? <Text style={styles.namn} numberOfLines={2}>{info.name}</Text> : null}
                </View>
                <View style={styles.spets} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    ankare: {
        position: 'absolute',
        top: 0,
        width: BREDD,
        alignItems: 'center',
        justifyContent: 'flex-end',
    },
    ruta: {
        maxWidth: BREDD,
        paddingVertical: 7,
        paddingHorizontal: 12,
        borderRadius: 12,
        backgroundColor: '#ffffff',
        alignItems: 'center',
        shadowColor: '#0f172a',
        shadowOpacity: 0.25,
        shadowRadius: 9,
        shadowOffset: { width: 0, height: 6 },
        elevation: 6,
    },
    typ: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        color: '#64748b',
        textAlign: 'center',
    },
    namn: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0f172a',
        textAlign: 'center',
    },
    // Popupens spets: en liten vit trekant som pekar ner mot skylten.
    spets: {
        width: 0,
        height: 0,
        borderLeftWidth: 7,
        borderRightWidth: 7,
        borderTopWidth: 8,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderTopColor: '#ffffff',
        marginTop: -1,
    },
});
