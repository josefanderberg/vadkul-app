/**
 * Listans botten zoomar ut - port av webbens utils/listZoomRings.ts +
 * zoomOutStepsToReveal (utils/viewportTour.ts) och page.tsx
 * handleListZoomOut (ägarbeslut 8/10, Josef: "när man scrollat ner i listan
 * för man redan sett allt denna månaden på eventkorten. Då ska ju kartan
 * zooma ut så att listan kan börja om på nästa zoomsteg, så tar man in fler
 * event runtomkring och visa på när de börjar").
 *
 * Kortets lista (Månaden/Populärt) är eventen i kartans ruta. Når man
 * botten zoomar kartan ut och listan FORTSÄTTER i stället för att ta slut:
 * det man redan sett står kvar överst, och eventen som kom in runtomkring
 * läggs under en avdelare - dag för dag från den visade dagen igen. Varje
 * utzoomning fryser vilka id:n som fanns i rutan (en RING); allt okänt hör
 * till den yttersta ringen. (Webbens Från idag-val och dubblett-grupper
 * finns inte i appen - listan börjar alltid på den visade dagen.)
 */
import type { Dag, Ruta } from './vy';
import { KORT_TÄCKER } from './vy';

/** Under den här zoomen (ungefär halva Sverige tvärs en mobil) zoomar
 *  listan inte ut längre - där är "runtomkring" inte runtomkring längre. */
export const ZOOM_UT_GOLV = 6;

export interface RingDag<T> extends Dag<T> {
    /** 0 = rutan innan första utzoomningen, 1 = det som kom in vid den … */
    ring: number;
}

/**
 * Delar listans dagar i ringar: först alla dagar med ring 0-event, sedan
 * ring 1 från första dagen igen, osv. Dagarna behåller sin ordning inom
 * varje ring och tomma dagar följer inte med. `ringar[i]` = id:na som fanns
 * i rutan när kartan zoomade ut för (i+1):e gången - ett event hör till den
 * första ringen som kände det.
 */
export function delaIRingar<T extends { id: string }>(
    dagar: readonly Dag<T>[],
    ringar: readonly ReadonlySet<string>[],
): RingDag<T>[] {
    if (ringar.length === 0) return dagar.map(d => ({ offset: d.offset, events: [...d.events], ring: 0 }));
    const ringAv = (id: string) => {
        for (let i = 0; i < ringar.length; i++) if (ringar[i].has(id)) return i;
        return ringar.length;
    };
    const perRing = new Map<number, RingDag<T>[]>();
    for (const dag of dagar) {
        const delar = new Map<number, RingDag<T>>();
        for (const e of dag.events) {
            const r = ringAv(e.id);
            const träff = delar.get(r);
            if (träff) träff.events.push(e);
            else delar.set(r, { offset: dag.offset, ring: r, events: [e] });
        }
        for (const [r, d] of delar) {
            const lista = perRing.get(r);
            if (lista) lista.push(d);
            else perRing.set(r, [d]);
        }
    }
    return [...perRing.entries()].sort(([a], [b]) => a - b).flatMap(([, lista]) => lista);
}

/**
 * Närmaste event UTANFÖR rutan, räknat från kartans mitt - utzoomningens
 * mål, så steget alltid tar in minst ett nytt event när det finns något.
 * Avståndet är platt (longitud skalad med cos(lat)) - det räcker för att
 * välja närmast. null = inget utanför (eller inget med koordinater).
 */
export function närmastUtanför<T extends { lat: number; lng: number }>(
    events: readonly T[],
    ruta: Ruta,
    mitt: { lat: number; lng: number },
    ta: (e: T) => boolean = () => true,
): T | null {
    const [w, s, e, n] = ruta;
    const kx = Math.cos((mitt.lat * Math.PI) / 180);
    let bäst: T | null = null;
    let bästD = Infinity;
    for (const ev of events) {
        const { lat, lng } = ev;
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) continue;
        if (lat >= s && lat <= n && lng >= w && lng <= e) continue;
        if (!ta(ev)) continue;
        const dx = (lng - mitt.lng) * kx;
        const dy = lat - mitt.lat;
        const d = dx * dx + dy * dy;
        if (d < bästD) {
            bästD = d;
            bäst = ev;
        }
    }
    return bäst;
}

const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));

/**
 * Ny zoomnivå för utzoomningssteget: minst ETT steg ut kring samma mitt,
 * och så långt att `mål` får plats i bild med 10 % marginal - ovanför den
 * nedersta andel av skärmen som kortet täcker (webbens zoomOutStepsToReveal,
 * samma rum-räkning i rutans andelar i stället för pixlar). null = kartan
 * står redan på golvet och kan inte zooma ut mer.
 */
export function utzoomning(
    ruta: Ruta,
    zoom: number,
    mål: { lat: number; lng: number } | null,
): number | null {
    if (zoom <= ZOOM_UT_GOLV) return null;
    let steg = 1;
    if (mål) {
        const [w, s, e, n] = ruta;
        const spannLng = e - w;
        const spannMerc = mercY(n) - mercY(s);
        if (spannLng > 0 && spannMerc > 0) {
            // Andel av rutans bredd/höjd som målet ligger från mitten.
            // dyAndel > 0 = söderut (nedåt skärmen, mot kortet).
            const dxAndel = (mål.lng - (w + e) / 2) / spannLng;
            const dyAndel = ((mercY(n) + mercY(s)) / 2 - mercY(mål.lat)) / spannMerc;
            const rumX = 0.5 - 0.1;
            const rumY = dyAndel < 0 ? 0.5 - 0.1 : 0.5 - KORT_TÄCKER - 0.1;
            let skala = 1;
            if (dxAndel !== 0) skala = Math.min(skala, rumX / Math.abs(dxAndel));
            if (dyAndel !== 0 && rumY > 0) skala = Math.min(skala, rumY / Math.abs(dyAndel));
            if (skala < 1) steg = Math.max(1, -Math.log2(skala));
        }
    }
    return Math.max(ZOOM_UT_GOLV, zoom - steg);
}
