/**
 * Regionvalet: vilken app-feed-region (län-slug) hör en position hemma i?
 * Samma närmaste-stad-logik som scraperns appFeed använder när flödet byggs —
 * bägge räknar mot SAMMA stadslista (@vadkul/kontrakt), så ett event som
 * hamnade i 'skane' på servern hittas i 'skane' av klienten.
 */
import { CITIES, type City } from '@vadkul/kontrakt';

const toRad = (d: number) => (d * Math.PI) / 180;

/** Haversine i km — samma formel som webben/scrapern. */
export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2
        + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}

/** Närmaste stad ur kontraktets lista — utan radietak, precis som servern. */
export function nearestCity(lat: number, lng: number): City {
    let best = CITIES[0];
    let bestD = Infinity;
    for (const c of CITIES) {
        const d = distanceKm(lat, lng, c.lat, c.lng);
        if (d < bestD) { bestD = d; best = c; }
    }
    return best;
}

/** Region (län-slug) för en position. */
export function regionFor(lat: number, lng: number): string {
    return nearestCity(lat, lng).region;
}

/** Startläge innan GPS svarat (eller nekats): Stockholm — flest event. */
export const DEFAULT_CITY: City = CITIES.find(c => c.slug === 'stockholm') ?? CITIES[0];
