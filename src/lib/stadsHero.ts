/**
 * Stadssidans KART-HERO - port av webbens CityMapHero.tsx + heroMarkers.ts
 * (app/(v1)/evenemang/). Kartbotten är webbens FÖRRENDERADE kartbild
 * (vadkul.se/kartbilder/<slug>.webp, nöjesfälts-stilen ur egna kakel, byggd
 * av huvudrepots scripts/render-city-maps.mjs) - heron har aldrig gått att
 * dra eller zooma, så ingen andra kartmotor behövs. Brickorna är LEVANDE
 * ovanpå bilden: de följer periodvalet, kartfiltret och sökningen och visar
 * dagens utbud. Passiv men klickbar: tryck på kartbotten öppnar huvudkartan
 * över staden, tryck på en bricka öppnar eventet på kartan (lib/kartHopp).
 *
 * Positionerna räknas i KAKELRUTNÄTETS skala (256 px-kakel, zoom 12) från
 * bildens mitt - exakt samma webbmercator som bilden ritades i. Appens hero
 * är smalare än bildens 630x318 och beskär den som object-cover, så
 * offseten skalas med samma faktor som bilden (heroSkala).
 *
 * HERO_STÄDER är en KOPIA av webbens utils/cityPages.ts (lat/lng/small):
 * bilderna är renderade kring DE koordinaterna, som avviker lite från
 * kontraktets CITIES (Stockholm 18.06 mot 18.0686 = 25 px fel på bilden).
 * Ändras en stadssida på webben ska raden följa. Städer utan rad (kontraktets
 * orter utan webbens stadssida) saknar kartbild - där visas bara periodchipsen.
 */
import type { AppEvent } from './appEvent';
import { platsNyckel } from './vy';

/** Kakel-zoom bilden är renderad i (webbens HERO_ZOOM). */
const HERO_ZOOM = 12;
const TILE = 256;
/** Bildens mått i CSS-px (webbens HERO_IMG_W/H). Renderad i 2x. */
export const HERO_BILD_B = 630;
export const HERO_BILD_H = 318;
/** Minsta avstånd i BILD-px mellan två brickor (webbens MIN_DIST_PX). */
export const MIN_AVSTÅND_PX = 40;
/** Tak på antalet brickor - en telefonbred hero rymmer långt färre än webbens 140. */
export const MAX_BRICKOR = 40;

/** Webbens stadssidor: { lat, lng } = kartbildens mitt, small = 20 km-radie. */
export const HERO_STÄDER: Readonly<Record<string, { lat: number; lng: number; small?: true }>> = {
    'stockholm': { lat: 59.33, lng: 18.06 },
    'goteborg': { lat: 57.71, lng: 11.97 },
    'malmo': { lat: 55.60, lng: 13.00 },
    'uppsala': { lat: 59.86, lng: 17.64 },
    'linkoping': { lat: 58.41, lng: 15.62 },
    'orebro': { lat: 59.27, lng: 15.21 },
    'vasteras': { lat: 59.61, lng: 16.55 },
    'helsingborg': { lat: 56.05, lng: 12.69 },
    'norrkoping': { lat: 58.59, lng: 16.19 },
    'jonkoping': { lat: 57.78, lng: 14.16 },
    'umea': { lat: 63.83, lng: 20.26 },
    'lund': { lat: 55.70, lng: 13.19 },
    'boras': { lat: 57.72, lng: 12.94 },
    'sundsvall': { lat: 62.39, lng: 17.31 },
    'gavle': { lat: 60.67, lng: 17.14 },
    'eskilstuna': { lat: 59.37, lng: 16.51 },
    'halmstad': { lat: 56.67, lng: 12.86 },
    'vaxjo': { lat: 56.88, lng: 14.81 },
    'karlstad': { lat: 59.40, lng: 13.51 },
    'sodertalje': { lat: 59.20, lng: 17.63 },
    'kristianstad': { lat: 56.03, lng: 14.16 },
    'lulea': { lat: 65.58, lng: 22.15 },
    'skelleftea': { lat: 64.75, lng: 20.95 },
    'kalmar': { lat: 56.66, lng: 16.36 },
    'ostersund': { lat: 63.18, lng: 14.64 },
    'falun': { lat: 60.61, lng: 15.63 },
    'karlskrona': { lat: 56.16, lng: 15.59 },
    'visby': { lat: 57.64, lng: 18.30 },
    'trollhattan': { lat: 58.28, lng: 12.29 },
    'nykoping': { lat: 58.75, lng: 17.01 },
    'skovde': { lat: 58.39, lng: 13.85 },
    'kungsbacka': { lat: 57.49, lng: 12.08, small: true },
    'varberg': { lat: 57.11, lng: 12.25, small: true },
    'norrtalje': { lat: 59.76, lng: 18.70, small: true },
    'marsta': { lat: 59.62, lng: 17.86, small: true },
    'akersberga': { lat: 59.48, lng: 18.30, small: true },
    'upplands-vasby': { lat: 59.52, lng: 17.91, small: true },
    'enkoping': { lat: 59.64, lng: 17.08, small: true },
    'falkenberg': { lat: 56.90, lng: 12.49, small: true },
    'landskrona': { lat: 55.87, lng: 12.83, small: true },
    'motala': { lat: 58.54, lng: 15.04, small: true },
    'angelholm': { lat: 56.25, lng: 12.86, small: true },
    'pitea': { lat: 65.32, lng: 21.48, small: true },
    'alingsas': { lat: 57.93, lng: 12.53, small: true },
    'strangnas': { lat: 59.38, lng: 17.03, small: true },
    'vastervik': { lat: 57.76, lng: 16.64, small: true },
    'kinna': { lat: 57.51, lng: 12.69, small: true },
    'varnamo': { lat: 57.19, lng: 14.04, small: true },
    'vallentuna': { lat: 59.53, lng: 18.08, small: true },
    'nodinge': { lat: 57.90, lng: 12.05, small: true },
    'kungsangen': { lat: 59.48, lng: 17.75, small: true },
    'karlshamn': { lat: 56.17, lng: 14.86, small: true },
    'ystad': { lat: 55.43, lng: 13.82, small: true },
    'ljungby': { lat: 56.83, lng: 13.94, small: true },
    'stenungsund': { lat: 58.07, lng: 11.82, small: true },
    'laholm': { lat: 56.51, lng: 13.04, small: true },
    'arvika': { lat: 59.65, lng: 12.59, small: true },
    'osthammar': { lat: 60.26, lng: 18.37, small: true },
    'sjobo': { lat: 55.63, lng: 13.70, small: true },
    'tranas': { lat: 58.03, lng: 14.98, small: true },
    'almhult': { lat: 56.55, lng: 14.14, small: true },
    'hoor': { lat: 55.93, lng: 13.54, small: true },
    'solvesborg': { lat: 56.05, lng: 14.58, small: true },
    'vimmerby': { lat: 57.67, lng: 15.86, small: true },
    'saffle': { lat: 59.13, lng: 12.92, small: true },
    'trosa': { lat: 58.90, lng: 17.55, small: true },
    'arboga': { lat: 59.39, lng: 15.84, small: true },
    'olofstrom': { lat: 56.28, lng: 14.53, small: true },
    'borgholm': { lat: 56.88, lng: 16.66, small: true },
    'markaryd': { lat: 56.46, lng: 13.60, small: true },
    'mullsjo': { lat: 57.92, lng: 13.88, small: true },
};

/** Kartbildens adress, eller null när staden saknar webbens stadssida. */
export function heroBildUrl(slug: string): string | null {
    return HERO_STÄDER[slug] ? `https://vadkul.se/kartbilder/${slug}.webp` : null;
}

/**
 * Radien för stadens spotlight och önskningar (webbens `city.small ? 20 :
 * 35`). Orter utan webbens stadssida är alla småorter - 20 km.
 */
export function stadsRadieKm(slug: string): number {
    const h = HERO_STÄDER[slug];
    return h && !h.small ? 35 : 20;
}

/** Webbmercator: världs-pixel vid kakel-zoomen (samma projektion som MapLibre). */
export function världsPx(lat: number, lng: number, zoom = HERO_ZOOM): { x: number; y: number } {
    const skala = TILE * 2 ** zoom;
    const x = ((lng + 180) / 360) * skala;
    const s = Math.sin((lat * Math.PI) / 180);
    const y = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * skala;
    return { x, y };
}

/** Bildens skala i en hero på bredd x höjd: object-cover = den STÖRRE kvoten. */
export function heroSkala(bredd: number, höjd: number): number {
    return Math.max(bredd / HERO_BILD_B, höjd / HERO_BILD_H);
}

/** En bricka i heron: platsens tidigaste event, hur många som delar platsen
 *  och brickspetsens läge i heron (pt från övre vänstra hörnet). */
export interface HeroMarkör {
    e: AppEvent;
    antal: number;
    x: number;
    y: number;
}

/**
 * Brickorna heron ska rita, i ritordning (webbens pickHeroMarkers).
 * `events` är redan filtrerade (period, kartfilter, sökning, har varit) -
 * här bara:
 *  1. Gruppera per plats (lib/vy.platsNyckel, samma som huvudkartan) - en
 *     bricka med räknare, tidigaste eventet är ansiktet.
 *  2. Kasta grupper utanför heron (bilden beskärs - en bricka ute i kanten
 *     syns ändå inte) med `kant` pt marginal för brickans bredd.
 *  3. Greedy gallring: närmare än MIN_AVSTÅND_PX bild-px från en redan
 *     placerad bricka hoppas över. Tidigast först vinner.
 */
export function väljHeroMarkörer(
    events: readonly AppEvent[],
    mitt: { lat: number; lng: number },
    ruta: { bredd: number; höjd: number; kant?: number },
    maxAntal = MAX_BRICKOR,
): HeroMarkör[] {
    const { bredd, höjd } = ruta;
    if (!(bredd > 0 && höjd > 0)) return [];
    const kant = ruta.kant ?? 12;
    const s = heroSkala(bredd, höjd);
    const c = världsPx(mitt.lat, mitt.lng);

    const sorterade = [...events].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    const grupper = new Map<string, AppEvent[]>();
    for (const e of sorterade) {
        if (!Number.isFinite(e.lat) || !Number.isFinite(e.lng) || (e.lat === 0 && e.lng === 0)) continue;
        const k = platsNyckel(e);
        const g = grupper.get(k);
        if (g) g.push(e);
        else grupper.set(k, [e]);
    }

    const ut: (HeroMarkör & { dx: number; dy: number })[] = [];
    for (const grupp of grupper.values()) {
        if (ut.length >= maxAntal) break;
        const e = grupp[0];
        const p = världsPx(e.lat, e.lng);
        const dx = p.x - c.x;
        const dy = p.y - c.y;
        const x = bredd / 2 + dx * s;
        const y = höjd / 2 + dy * s;
        if (x < kant || x > bredd - kant || y < kant || y > höjd) continue;
        if (ut.some(m => (m.dx - dx) ** 2 + (m.dy - dy) ** 2 < MIN_AVSTÅND_PX ** 2)) continue;
        ut.push({ e, antal: grupp.length, x, y, dx, dy });
    }
    return ut.map(({ e, antal, x, y }) => ({ e, antal, x, y }));
}
