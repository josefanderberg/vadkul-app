/**
 * BRICKOR KRING MITTEN, PRICKAR ÖVERALLT ANNARS (Josef 19/10: "vi kan väl göra
 * så att de eventmarkörerna som visas att de är centrerade i mitten så man får
 * flytta sig på kartan så blir det andra 50 event som visas. annars är det
 * bara en prick") - webbens reveal-urval (components/v2/V2Map.tsx:
 * REVEAL_SEED_COUNT, revealAllowance, nearestRevealCands, pickRevealKeys).
 *
 * - KANDIDATERNA är de URVAL_KANDIDATER (50) platserna närmast kartans mitt.
 *   Panorerar man följer urvalet med till nya mitten.
 * - Hur många som TÄNDS styrs av zoomen (webbens zoom-ranson, ägarbeslut 7/10
 *   kväll): URVAL_MIN vid/under URVAL_RAMP_START_ZOOM, linjärt upp till alla 50
 *   vid URVAL_TITEL_ZOOM, där titlarna börjar. Populära/guld går först,
 *   närmast först inom varje skikt.
 * - FASTA platser (valt, guld, sparat, användarskapat - webbens sticky-
 *   brickor) är alltid brickor. Passerade platser är alltid prickar (dämpade),
 *   utom den valda.
 *
 * Ren logik så den kan testas utan karta.
 */
import type { BrickProps } from './kartlager';

export const URVAL_KANDIDATER = 50;
export const URVAL_MIN = 12;
export const URVAL_RAMP_START_ZOOM = 10.5;
/** Webbens LABEL_TITLE_MIN_ZOOM. */
export const URVAL_TITEL_ZOOM = 13;

/** Webbens revealAllowance: hur många av kandidaterna som tänds vid en zoom. */
export function urvalsTak(zoom: number): number {
    if (zoom >= URVAL_TITEL_ZOOM) return URVAL_KANDIDATER;
    if (zoom <= URVAL_RAMP_START_ZOOM) return URVAL_MIN;
    const t = (zoom - URVAL_RAMP_START_ZOOM) / (URVAL_TITEL_ZOOM - URVAL_RAMP_START_ZOOM);
    return Math.round(URVAL_MIN + (URVAL_KANDIDATER - URVAL_MIN) * t);
}

export interface UrvalsPunkt {
    id: string;
    lng: number;
    lat: number;
    /** Populär eller guld - rankas först bland kandidaterna. */
    pop: boolean;
}

/**
 * Id:na som tänds kring `mitt` (webbens nearestRevealCands + pickRevealKeys):
 * de 50 närmaste (kvadrerat avstånd, cos-lat-skalad longitud - samma billiga
 * partiella urval som webben), rankade populära först och kapade till
 * urvalsTak(zoom).
 */
export function väljTända(
    punkter: readonly UrvalsPunkt[],
    mitt: { lng: number; lat: number },
    zoom: number,
    kandidater = URVAL_KANDIDATER,
): Set<string> {
    const kx = Math.cos((mitt.lat * Math.PI) / 180);
    const bästa: { id: string; d2: number; pop: boolean }[] = [];
    let sämst = -Infinity;
    let sämstIdx = -1;
    for (const p of punkter) {
        const dx = kx * (p.lng - mitt.lng);
        const dy = p.lat - mitt.lat;
        const d2 = dx * dx + dy * dy;
        if (bästa.length < kandidater) {
            bästa.push({ id: p.id, d2, pop: p.pop });
            if (d2 > sämst) { sämst = d2; sämstIdx = bästa.length - 1; }
        } else if (d2 < sämst) {
            bästa[sämstIdx] = { id: p.id, d2, pop: p.pop };
            sämst = -Infinity;
            for (let j = 0; j < bästa.length; j++) {
                if (bästa[j].d2 > sämst) { sämst = bästa[j].d2; sämstIdx = j; }
            }
        }
    }
    bästa.sort((a, b) => (Number(b.pop) - Number(a.pop)) || (a.d2 - b.d2));
    return new Set(bästa.slice(0, urvalsTak(zoom)).map(k => k.id));
}

export interface PrickProps {
    /** Representantens id - samma som brickans, trycket öppnar platsen. */
    id: string;
    /** Kategorins färg (webbens nål-prick). ASCII-namn: läses av kartans
     *  uttryck i den native kartan, som alla andra lagerfält. */
    farg: string;
    past: boolean;
    antal: number;
}

type Brickor = GeoJSON.FeatureCollection<GeoJSON.Point, BrickProps>;

/**
 * BRICKORNA kring kartans mitt ur platserna (lib/kartlager.byggBrickor):
 * urvalet + de fasta + den valda. `mitt` null = kartan har inte rapporterat
 * sin vy än: då tänds bara de fasta, som på webben när utgångspunkten saknas.
 * Liten samling (~50) - den är det enda som byts när man panorerar.
 */
export function väljBrickor(platser: Brickor, mitt: { lng: number; lat: number } | null, zoom: number): Brickor {
    const punkter: UrvalsPunkt[] = [];
    for (const f of platser.features) {
        const p = f.properties;
        if (p.fast || p.past) continue;
        const [lng, lat] = f.geometry.coordinates;
        punkter.push({ id: p.id, lng, lat, pop: p.pop });
    }
    const tända = mitt ? väljTända(punkter, mitt, zoom) : new Set<string>();
    return {
        type: 'FeatureCollection',
        features: platser.features.filter(f => {
            const p = f.properties;
            return p.vald || (p.fast && !p.past) || tända.has(p.id);
        }),
    };
}

/**
 * PRICKARNA: en per plats, hela landet. Beror bara på platserna - inte på
 * mitten - så källan skickas inte om till kartan vid varje panorering; de
 * platser som just nu är brickor döljs i stället med prickFilter.
 */
export function byggPrickar(platser: Brickor): GeoJSON.FeatureCollection<GeoJSON.Point, PrickProps> {
    return {
        type: 'FeatureCollection',
        features: platser.features.map(f => ({
            type: 'Feature',
            geometry: f.geometry,
            properties: { id: f.properties.id, farg: f.properties.färg, past: f.properties.past, antal: f.properties.antal },
        })),
    };
}

/**
 * Nyckel för prickarnas synliga innehåll: plats-id, antal och "har varit".
 * Platserna byggs om varje minut (useNu) men prickarna ändras sällan -
 * kartan memoiserar prick-källan på nyckeln, så den native kartan inte får
 * tusentals punkter skickade varje minut. Färg och läge följer id:t.
 */
export function prickNyckel(platser: Brickor): string {
    let nyckel = '';
    for (const f of platser.features) {
        const p = f.properties;
        nyckel += `${p.id}:${p.antal}${p.past ? 'p' : ''},`;
    }
    return nyckel;
}

/** Etiketten när inga brickor finns - inget event har det id:t. */
export const INGEN_BRICKA = '__ingen-bricka__';

/**
 * Prick-lagrets filter: göm prickarna under brickorna. `match` med en
 * etikettlista (inte `in`) - fungerar i alla MapLibre Native-versioner.
 * Alltid ett filter, aldrig undefined: match kräver minst en etikett, och
 * ett filter som släpps helt rensas inte säkert i den native kartan.
 */
export function prickFilter(brickIds: readonly string[]): unknown[] {
    const unika = [...new Set(brickIds)];
    return ['match', ['get', 'id'], unika.length > 0 ? unika : [INGEN_BRICKA], false, true];
}
