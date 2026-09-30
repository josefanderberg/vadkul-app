/**
 * Teardrop-brickorna - kart-ui-beslutet från huvudrepot: "bricka bakom emojin,
 * bar emoji är prövad och avvisad". MapLibre kan inte rendera färg-emoji som
 * text (SDF-glyfsystemet), så brickorna är förbakade PNG:er med exakt webbens
 * ritkod (scripts/baka-brickor.mjs → assets/brickor/ + brickBilder.generated).
 *
 * Varianterna följer webbens makeBrickaImageData-prioritet:
 *   kropp: guld (Ticketmaster, ägarbeslut 1/9) > sparad (vit) > kategorifärg
 *   kant:  vald (vit ram) > guld/sparad > 🔥 pop (tjockare) > vanlig
 *
 * MEDVETEN AVGRÄNSNING: kategorins standard-emoji, inte eventets fria
 * LLM-emoji (den kräver runtime-bakning - skia - och är ett eget steg).
 * Ren modul (inga require) så den går att testa; bildregistret importeras
 * av kartan direkt ur brickBilder.generated.
 */
import { EVENT_CATEGORY_KEYS } from '@vadkul/kontrakt';

/** PNG:erna bakades vid DPR 2,5 → rita dem i 1/2,5 så kroppen blir 40 pt. */
export const BRICKA_ICON_SIZE = 1 / 2.5;

export interface BrickTillstånd {
    category: string;
    pop?: boolean;
    guld?: boolean;
    sparad?: boolean;
    vald?: boolean;
}

/** Bildnyckeln i registret för en bricka. Okänd kategori → other (webbens fallback). */
export function brickaIkon(t: BrickTillstånd): string {
    const cat = (EVENT_CATEGORY_KEYS as readonly string[]).includes(t.category) ? t.category : 'other';
    const kropp = t.guld ? 'guld' : t.sparad ? 'sparad' : '';
    let variant: string;
    if (kropp) variant = t.vald ? `${kropp}-vald` : kropp;
    else variant = t.vald ? 'vald' : t.pop ? 'pop' : '';
    return variant ? `bricka-${cat}-${variant}` : `bricka-${cat}`;
}
