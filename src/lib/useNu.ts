/**
 * "Nu" som tickar - ytor som visar "har varit" måste räkna om när tiden går,
 * inte bara när datat ändras. En minut räcker (gränserna går på hela timmar).
 */
import { useEffect, useState } from 'react';

export function useNu(intervallMs = 60_000): number {
    const [nu, setNu] = useState(() => Date.now());
    useEffect(() => {
        const t = setInterval(() => setNu(Date.now()), intervallMs);
        return () => clearInterval(t);
    }, [intervallMs]);
    return nu;
}
