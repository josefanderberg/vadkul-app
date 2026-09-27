/**
 * Delad region-state för flikarna: GPS-staden ur useRegion som grund, med
 * MANUELLT stadsval ovanpå (Städer-fliken). Manuellt val vinner alltid över
 * GPS tills det nollställs - samma princip som webbens users.city
 * ("manual vinner"). Ingen persistens ännu: appen öppnar i GPS-/standardstaden
 * varje start, precis som kartan på webben.
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { City } from '@vadkul/kontrakt';
import { useRegion } from './useRegion';

export interface RegionState {
    /** Staden kartan och flödet utgår från (manuell vinner över GPS). */
    city: City;
    /** Flödets region (län-slug). */
    region: string;
    /** true när staden kommer ur en riktig GPS-fix (och inget manuellt val gjorts). */
    fromGps: boolean;
    /** true när användaren valt stad själv i Städer-fliken. */
    manuell: boolean;
    väljStad: (city: City) => void;
    tillGpsStad: () => void;
}

const RegionContext = createContext<RegionState | null>(null);

export function RegionProvider({ children }: { children: ReactNode }) {
    const gps = useRegion();
    const [vald, setVald] = useState<City | null>(null);

    const value = useMemo<RegionState>(() => ({
        city: vald ?? gps.city,
        region: vald ? vald.region : gps.region,
        fromGps: !vald && gps.fromGps,
        manuell: vald !== null,
        väljStad: setVald,
        tillGpsStad: () => setVald(null),
    }), [vald, gps]);

    return <RegionContext.Provider value={value}>{children}</RegionContext.Provider>;
}

export function useRegionVal(): RegionState {
    const ctx = useContext(RegionContext);
    if (!ctx) throw new Error('useRegionVal kräver RegionProvider (rotlayouten).');
    return ctx;
}
