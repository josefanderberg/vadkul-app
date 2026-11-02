/**
 * Teardrop-brickorna - kart-ui-beslutet från huvudrepot: "bricka bakom emojin,
 * bar emoji är prövad och avvisad". MapLibre kan inte rendera färg-emoji som
 * text (SDF-glyfsystemet), så brickorna är förbakade PNG:er med exakt webbens
 * ritkod (scripts/baka-brickor.mjs → assets/brickor/ + brickBilder.generated).
 *
 * Varianterna följer webbens makeBrickaImageData-prioritet:
 *   kropp: guld (Ticketmaster, ägarbeslut 1/9) > sparad (vit) > grön (VADKUL-
 *          värdat användarevent, webbens USER_EVENT_HEX - tips är INTE gröna) >
 *          kategorifärg
 *   kant:  vald (vit ram) > guld/sparad > 🔥 pop (tjockare) > vanlig
 *
 * De förbakade brickorna bär kategorins emoji. Eventets egen emoji (webbens
 * eventEmoji) sätts ihop i appen ur kropp + emoji - lib/emojiBricka.
 * Ren modul (inga require) så den går att testa; bildregistret importeras
 * av kartan direkt ur brickBilder.generated.
 */
import { EVENT_CATEGORY_KEYS } from '@vadkul/kontrakt';

/** PNG:erna bakades vid DPR 2,5 → rita dem i 1/2,5 så kroppen blir 40 pt. */
export const BRICKA_ICON_SIZE = 1 / 2.5;

/** "+N"-badgens mitt relativt spetsen i pt (webbens COUNT_BADGE_CORNER_X/Y
 *  vid icon-size 1) - kartans antal-lager och stadsherons brickor. */
export const BADGE_X = 20 * Math.SQRT1_2 + 4;
export const BADGE_Y = 7 + 20 * Math.SQRT2 + 20 * Math.SQRT1_2 + 5;

export interface BrickTillstånd {
    category: string;
    pop?: boolean;
    guld?: boolean;
    sparad?: boolean;
    /** Eget VADKUL-event (lib/appEvent ärEgetVadkulEvent) - smaragdgrön kropp. */
    grön?: boolean;
    vald?: boolean;
}

/** Kategorin vars bricka ett event får. Okänd kategori → other (webbens fallback). */
export function brickansKategori(category: string): string {
    return (EVENT_CATEGORY_KEYS as readonly string[]).includes(category) ? category : 'other';
}

/** Bildnyckeln i registret för en bricka. */
export function brickaIkon(t: BrickTillstånd): string {
    const cat = brickansKategori(t.category);
    const kropp = t.guld ? 'guld' : t.sparad ? 'sparad' : t.grön ? 'gron' : '';
    let variant: string;
    if (kropp) variant = t.vald ? `${kropp}-vald` : kropp;
    else variant = t.vald ? 'vald' : t.pop ? 'pop' : '';
    return variant ? `bricka-${cat}-${variant}` : `bricka-${cat}`;
}
