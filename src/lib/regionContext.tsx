/**
 * Delad region-state: GPS-staden ur useRegion som grund, med MANUELLT stadsval
 * ovanpå (stadssidans "Visa på kartan", sökets stadsrad). Manuellt val vinner
 * över GPS tills det nollställs - samma princip som webbens users.city
 * ("manual vinner"), men bara under besöket.
 *
 * Startstaden (lib/startstad): kartan öppnar i staden man senast var i och
 * står still; GPS-svaret gör ETT hopp om man flyttat sig. `klar` är false tills
 * lagringen lästs - kartan väntar på den så första bildrutan redan ligger rätt
 * (ingen hoppande kamera från Stockholm).
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { City } from '@vadkul/kontrakt';
import { läs, NYCKEL, skriv, useLagrad } from './lagring';
import { DEFAULT_CITY } from './regionVal';
import { tolkaStartstad, type SparadStartstad } from './startstad';
import { useRegion } from './useRegion';

export interface RegionState {
    /** Staden kartan och flödet utgår från (manuell > GPS > sparad start > standard). */
    city: City;
    /** Flödets region (län-slug). */
    region: string;
    /** true när staden kommer ur en riktig GPS-fix (och inget manuellt val gjorts). */
    fromGps: boolean;
    /** true när användaren valt stad själv. */
    manuell: boolean;
    /** Startstaden är inläst - kartan kan ritas. */
    klar: boolean;
    /** Användarens position (första GPS-fixen), null utan behörighet. */
    minPos: { lat: number; lng: number } | null;
    väljStad: (city: City) => void;
    tillGpsStad: () => void;
    /** Introt är klart (eller hoppat) - null tills lagringen lästs. */
    introKlar: boolean | null;
    /** Markera introt klart. Hoppade man över platsfrågan ställs den först
     *  vid nästa start - inte direkt efter att man sagt nej till den. */
    avslutaIntro: () => void;
    /** Ställ platsfrågan nu (introts "Använd min plats"). */
    begärPlats: () => void;
}

const RegionContext = createContext<RegionState | null>(null);

export function RegionProvider({ children }: { children: ReactNode }) {
    const [introKlar, setIntroKlar, introLaddad] = useLagrad(NYCKEL.välkomstKlar, false);
    const [platsBegärd, setPlatsBegärd] = useState(false);
    const gps = useRegion(platsBegärd || (introLaddad && introKlar));
    const [vald, setVald] = useState<City | null>(null);
    const [start, setStart] = useState<City | null>(null);
    const [klar, setKlar] = useState(false);

    useEffect(() => {
        let aktiv = true;
        läs<unknown>(NYCKEL.startstad, null).then(raw => {
            if (!aktiv) return;
            setStart(tolkaStartstad(raw, Date.now()));
            setKlar(true);
        });
        return () => { aktiv = false; };
    }, []);

    const city = vald ?? (gps.fromGps ? gps.city : start ?? DEFAULT_CITY);

    // Staden man landat i skrivs ner för nästa start (GPS eller eget val).
    useEffect(() => {
        if (!klar) return;
        if (!vald && !gps.fromGps) return;
        const post: SparadStartstad = { slug: city.slug, savedAt: Date.now() };
        void skriv(NYCKEL.startstad, post);
    }, [klar, city.slug, vald, gps.fromGps]);

    const value = useMemo<RegionState>(() => ({
        city,
        region: city.region,
        fromGps: !vald && gps.fromGps,
        manuell: vald !== null,
        klar,
        minPos: gps.pos,
        väljStad: setVald,
        tillGpsStad: () => setVald(null),
        introKlar: introLaddad ? introKlar : null,
        avslutaIntro: () => setIntroKlar(true),
        begärPlats: () => setPlatsBegärd(true),
    }), [city, vald, gps.fromGps, gps.pos, klar, introLaddad, introKlar, setIntroKlar]);

    return <RegionContext.Provider value={value}>{children}</RegionContext.Provider>;
}

export function useRegionVal(): RegionState {
    const ctx = useContext(RegionContext);
    if (!ctx) throw new Error('useRegionVal kräver RegionProvider (rotlayouten).');
    return ctx;
}
