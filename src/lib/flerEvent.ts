/**
 * Avståndstexten i kortet och listraderna. (Listan "fler event" sorterades
 * t.o.m. 28/9 på avstånd från det öppna eventet - webben rev det 23-24/9,
 * siffran och ordningen stämde inte; listorna är nu dag för dag, lib/vy.)
 */

/** "1,2 km" under 10 km, annars "13 km". */
export function formatKm(km: number): string {
    return km < 10 ? `${km.toFixed(1).replace('.', ',')} km` : `${Math.round(km)} km`;
}
