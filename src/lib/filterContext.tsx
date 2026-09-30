/**
 * Kartfiltret som delat state (regler i lib/kartFilter). Kartan, sökpanelen
 * och stadssidorna läser samma filter, precis som webbens page-state:
 *
 *  - kategori/🔥/FLER-källa gäller besöket och sparas ALDRIG (ägarbeslut
 *    15-16/9: ett sparat normal-val var ett osynligt filter utan väg ut).
 *  - opt-in-källorna (Svenska kyrkan/PRO, "Visa även på kartan") sparas på
 *    enheten - webben sparar dem i profilen, appen har inga konton än.
 *
 * Växlingsreglerna är webbens: källval släpper kategori och 🔥, 🔥 på släpper
 * källvalet, kategori släpper källvalet men kombineras med 🔥.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { EventCategoryType } from '@vadkul/kontrakt';
import type { KartFilter, KällNyckel } from './kartFilter';
import { NYCKEL, useLagrad } from './lagring';

export interface FilterState extends KartFilter {
    /** Trycker man på den valda kategorin släpps den. */
    växlaKategori: (k: EventCategoryType) => void;
    växlaPopulärt: () => void;
    växlaKälla: (k: KällNyckel) => void;
    växlaOptIn: (k: KällNyckel) => void;
    /** Släpp kategori, 🔥 och källa ("Visa alla"). */
    rensa: () => void;
    /** Något av kategori/🔥/källa är på. */
    aktivt: boolean;
}

const FilterContext = createContext<FilterState | null>(null);

export function FilterProvider({ children }: { children: ReactNode }) {
    const [kategori, setKategori] = useState<EventCategoryType | null>(null);
    const [populärt, setPopulärt] = useState(false);
    const [källa, setKälla] = useState<KällNyckel | null>(null);
    const [optInLista, setOptInLista] = useLagrad<KällNyckel[]>(NYCKEL.optIn, []);

    const växlaKategori = useCallback((k: EventCategoryType) => {
        setKälla(null);
        setKategori(prev => (prev === k ? null : k));
    }, []);
    const växlaPopulärt = useCallback(() => {
        setKälla(null);
        setPopulärt(p => !p);
    }, []);
    const växlaKälla = useCallback((k: KällNyckel) => {
        setKategori(null);
        setPopulärt(false);
        setKälla(prev => (prev === k ? null : k));
    }, []);
    const växlaOptIn = useCallback((k: KällNyckel) => {
        setOptInLista(prev => (prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]));
    }, [setOptInLista]);
    const rensa = useCallback(() => {
        setKategori(null);
        setPopulärt(false);
        setKälla(null);
    }, []);

    const optIn = useMemo(() => new Set(optInLista), [optInLista]);

    const value = useMemo<FilterState>(() => ({
        kategori,
        populärt,
        källa,
        optIn,
        växlaKategori,
        växlaPopulärt,
        växlaKälla,
        växlaOptIn,
        rensa,
        aktivt: kategori !== null || populärt || källa !== null,
    }), [kategori, populärt, källa, optIn, växlaKategori, växlaPopulärt, växlaKälla, växlaOptIn, rensa]);

    return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
}

export function useFilter(): FilterState {
    const ctx = useContext(FilterContext);
    if (!ctx) throw new Error('useFilter kräver FilterProvider (rotlayouten).');
    return ctx;
}
