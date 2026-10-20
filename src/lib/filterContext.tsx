/**
 * Kartfiltret som delat state (regler i lib/kartFilter). Kartan, sökpanelen
 * och stadssidorna läser samma filter, precis som webbens page-state:
 *
 *  - KATEGORIERNA är FLERVAL och SPARAS (ägarbeslut 6/10, webbens
 *    mapCategories - ersätter 16/9-regeln "en åt gången, sparas aldrig"):
 *    enheten via lagringen (30 dagars TTL, lib/filterMinne) och kontot via
 *    users.mapFilter - KONTOT VINNER över enheten vid inloggning.
 *    15/9-läxan hålls av FilterBrickas alltid synliga brickor.
 *  - 🔥 och FLER-källan gäller besöket och sparas aldrig (källan är en
 *    drilldown, inte en preferens - webbens beslut).
 *  - opt-in-källorna (Svenska kyrkan/PRO, "Visa även på kartan") sparas på
 *    enheten.
 *
 * Växlingsreglerna är webbens: källval släpper kategorierna och 🔥, 🔥 på
 * släpper källvalet, kategorival släpper källvalet men kombineras med 🔥.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { EventCategoryType } from '@vadkul/kontrakt';
import { läsFält, sättFält } from '@/data/anvandare';
import { läsKontoFilter, läsSparat, tillSparat, type SparatFilter } from './filterMinne';
import type { KartFilter, KällNyckel } from './kartFilter';
import { useKonto } from './kontoContext';
import { NYCKEL, useLagrad } from './lagring';

export interface FilterState extends KartFilter {
    /** Togglar kategorin i mängden (webbens chips). */
    växlaKategori: (k: EventCategoryType) => void;
    växlaPopulärt: () => void;
    växlaKälla: (k: KällNyckel) => void;
    växlaOptIn: (k: KällNyckel) => void;
    /** Släpp kategorierna, 🔥 och källan ("Visa alla"). */
    rensa: () => void;
    /** Exakt de här kategorierna, utan 🔥 och källa - sökets kategoriord
     *  ("konst växjö") när en träff öppnas på kartan. */
    sättUrval: (k: ReadonlySet<EventCategoryType>) => void;
    /** Något av kategorier/🔥/källa är på. */
    aktivt: boolean;
}

const FilterContext = createContext<FilterState | null>(null);

export function FilterProvider({ children }: { children: ReactNode }) {
    const { användare } = useKonto();
    const [sparat, setSparat] = useLagrad<SparatFilter | null>(NYCKEL.kartfilter, null);
    const [populärt, setPopulärt] = useState(false);
    const [källa, setKälla] = useState<KällNyckel | null>(null);
    const [optInLista, setOptInLista] = useLagrad<KällNyckel[]>(NYCKEL.optIn, []);

    const kategorier = useMemo(
        () => new Set<EventCategoryType>(läsSparat(sparat, Date.now())),
        [sparat],
    );

    // KONTOT VINNER vid inloggning (webbens prioritet enhet < konto): finns
    // users.mapFilter skrivs det över enhetens val; saknas fältet står
    // enhetens kvar. Körs en gång per inloggat uid.
    useEffect(() => {
        if (!användare) return;
        let aktiv = true;
        void läsFält(användare.uid).then(fält => {
            if (!aktiv || !fält || !('mapFilter' in fält)) return;
            const konto = läsKontoFilter(fält.mapFilter);
            setSparat(tillSparat(new Set(konto), Date.now()));
        }).catch(() => {});
        return () => { aktiv = false; };
        // setSparat är stabil (useLagrad).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [användare?.uid]);

    /** Skriv nya valet till enheten och - inloggad - kontot (fire-and-forget). */
    const sättKategorier = useCallback((nästa: ReadonlySet<EventCategoryType>) => {
        setSparat(tillSparat(nästa, Date.now()));
        if (användare) {
            sättFält(användare.uid, { mapFilter: [...nästa] }).catch(() => {
                /* offline - enhetens val gäller, kontot hinner ikapp nästa gång */
            });
        }
    }, [setSparat, användare]);

    const växlaKategori = useCallback((k: EventCategoryType) => {
        setKälla(null);
        const nästa = new Set(kategorier);
        if (nästa.has(k)) nästa.delete(k);
        else nästa.add(k);
        sättKategorier(nästa);
    }, [kategorier, sättKategorier]);
    const växlaPopulärt = useCallback(() => {
        setKälla(null);
        setPopulärt(p => !p);
    }, []);
    const växlaKälla = useCallback((k: KällNyckel) => {
        sättKategorier(new Set());
        setPopulärt(false);
        setKälla(prev => (prev === k ? null : k));
    }, [sättKategorier]);
    const växlaOptIn = useCallback((k: KällNyckel) => {
        setOptInLista(prev => (prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]));
    }, [setOptInLista]);
    const rensa = useCallback(() => {
        sättKategorier(new Set());
        setPopulärt(false);
        setKälla(null);
    }, [sättKategorier]);
    const sättUrval = useCallback((k: ReadonlySet<EventCategoryType>) => {
        sättKategorier(new Set(k));
        setPopulärt(false);
        setKälla(null);
    }, [sättKategorier]);

    const optIn = useMemo(() => new Set(optInLista), [optInLista]);

    const value = useMemo<FilterState>(() => ({
        kategorier,
        populärt,
        källa,
        optIn,
        växlaKategori,
        växlaPopulärt,
        växlaKälla,
        växlaOptIn,
        rensa,
        sättUrval,
        aktivt: kategorier.size > 0 || populärt || källa !== null,
    }), [kategorier, populärt, källa, optIn, växlaKategori, växlaPopulärt, växlaKälla, växlaOptIn, rensa, sättUrval]);

    return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
}

export function useFilter(): FilterState {
    const ctx = useContext(FilterContext);
    if (!ctx) throw new Error('useFilter kräver FilterProvider (rotlayouten).');
    return ctx;
}
