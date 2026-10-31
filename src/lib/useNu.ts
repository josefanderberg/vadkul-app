/**
 * "Nu" som tickar - ytor som visar "har varit" måste räkna om när tiden går,
 * inte bara när datat ändras. En minut räcker (gränserna går på hela timmar).
 *
 * VÄCKNINGEN (PR #1:s dagbyte, portad 31/10): intervallet står still medan
 * appen ligger i bakgrunden (iOS fryser JS-tråden, Android stryper timers).
 * Kommer appen fram igen - kanske nästa morgon - sätts "nu" direkt i stället
 * för först vid nästa tick, så "Idag" och "har varit" stämmer i första
 * bildrutan. Kartans dagfilter nycklas på dygnet (lib/dagar dygnetsStart).
 */
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

export function useNu(intervallMs = 60_000): number {
    const [nu, setNu] = useState(() => Date.now());
    useEffect(() => {
        const t = setInterval(() => setNu(Date.now()), intervallMs);
        const sub = AppState.addEventListener('change', s => {
            if (s === 'active') setNu(Date.now());
        });
        return () => {
            clearInterval(t);
            sub.remove();
        };
    }, [intervallMs]);
    return nu;
}
