/**
 * "Nu" som tickar - ytor som visar "har varit" måste räkna om när tiden går,
 * inte bara när datat ändras. En minut räcker (gränserna går på hela timmar).
 */
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

export function useNu(intervallMs = 60_000): number {
    const [nu, setNu] = useState(() => Date.now());
    useEffect(() => {
        const t = setInterval(() => setNu(Date.now()), intervallMs);
        // Intervallet står still i bakgrunden - väcks appen nästa dag ska
        // "nu" stämma direkt, inte först efter en minut.
        const sub = AppState.addEventListener('change', s => { if (s === 'active') setNu(Date.now()); });
        return () => { clearInterval(t); sub.remove(); };
    }, [intervallMs]);
    return nu;
}
