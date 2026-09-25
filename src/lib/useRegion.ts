/**
 * GPS-regionvalet: fråga om platsbehörighet, ta FÖRSTA positionen och lås
 * region/stad till den — regionen ska inte flappa mellan län när man rör sig
 * (flödet cachas per region; ett byte mitt i är bara förvirrande). Nekad
 * behörighet eller ingen fix → Stockholm (DEFAULT_CITY), samma standard som
 * innan behörigheten fanns.
 *
 * MapLibre RN:s egen LocationManager/useCurrentPosition används — ingen extra
 * expo-location-modul; kartans blåa punkt delar samma behörighet.
 */
import { useEffect, useRef, useState } from 'react';
import { LocationManager, useCurrentPosition } from '@maplibre/maplibre-react-native';
import type { City } from '@vadkul/kontrakt';
import { DEFAULT_CITY, nearestCity } from './regionVal';

export interface RegionVal {
    /** Närmaste stad — kameran öppnar här. */
    city: City;
    /** Flödets region (län-slug). */
    region: string;
    /** true när staden kommer ur en riktig GPS-fix (inte fallbacken). */
    fromGps: boolean;
}

export function useRegion(): RegionVal {
    const [granted, setGranted] = useState(false);
    const [val, setVal] = useState<RegionVal>({
        city: DEFAULT_CITY,
        region: DEFAULT_CITY.region,
        fromGps: false,
    });
    const lockedRef = useRef(false);

    useEffect(() => {
        let aktiv = true;
        LocationManager.requestPermissions()
            .then(ok => { if (aktiv) setGranted(ok); })
            .catch(() => { /* nekad/fel → fallbacken står kvar */ });
        return () => { aktiv = false; };
    }, []);

    const pos = useCurrentPosition({ enabled: granted && !lockedRef.current });

    useEffect(() => {
        if (!pos || lockedRef.current) return;
        lockedRef.current = true;
        const city = nearestCity(pos.coords.latitude, pos.coords.longitude);
        setVal({ city, region: city.region, fromGps: true });
    }, [pos]);

    return val;
}
