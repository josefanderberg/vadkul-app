/**
 * Enhetens lokala inställningar (webbens localStorage-motsvarighet): startstad,
 * opt-in-källor, sparade event och engångshintar. AsyncStorage är okrypterat -
 * HÅRD REGEL: aldrig tokens eller annat känsligt här (expo-secure-store när
 * auth kommer). Läs-/skrivfel sväljs: en trasig lagring får aldrig fälla appen,
 * den faller bara tillbaka på standardvärdet.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';

/** Nycklarna på ett ställe så ingen skriver över en annan av misstag. */
export const NYCKEL = {
    startstad: 'vadkul.startstad',
    optIn: 'vadkul.optIn',
    sparade: 'vadkul.sparade',
    rsvp: 'vadkul.rsvp',
    växlaHintKlar: 'vadkul.vaxlaHintKlar',
    välkomstKlar: 'vadkul.valkomstKlar',
    sverigeTipsKlar: 'vadkul.sverigeTipsKlar',
} as const;

export async function läs<T>(key: string, fallback: T): Promise<T> {
    try {
        const raw = await AsyncStorage.getItem(key);
        return raw == null ? fallback : (JSON.parse(raw) as T);
    } catch {
        return fallback;
    }
}

export async function skriv<T>(key: string, value: T): Promise<void> {
    try {
        await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch {
        /* full disk o.d. - inställningen gäller bara det här besöket */
    }
}

/**
 * useState som överlever omstart. `laddad` är false tills lagringen lästs -
 * ytor som inte får blinka förbi (engångshintar) väntar på den.
 */
export function useLagrad<T>(key: string, fallback: T): [T, (v: T | ((prev: T) => T)) => void, boolean] {
    const [värde, setVärde] = useState<T>(fallback);
    const [laddad, setLaddad] = useState(false);
    const rördRef = useRef(false);

    useEffect(() => {
        let aktiv = true;
        läs(key, fallback).then(v => {
            if (!aktiv) return;
            // Hann användaren ändra värdet innan lagringen svarade vinner ändringen.
            if (!rördRef.current) setVärde(v);
            setLaddad(true);
        });
        return () => { aktiv = false; };
        // fallback är ett startvärde, inte ett beroende
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);

    const sätt = useCallback((v: T | ((prev: T) => T)) => {
        rördRef.current = true;
        setVärde(prev => {
            const nytt = typeof v === 'function' ? (v as (p: T) => T)(prev) : v;
            void skriv(key, nytt);
            return nytt;
        });
    }, [key]);

    return [värde, sätt, laddad];
}
