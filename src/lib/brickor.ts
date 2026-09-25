/**
 * Teardrop-brickorna — kart-ui-beslutet från huvudrepot: "bricka bakom emojin,
 * bar emoji är prövad och avvisad". MapLibre kan inte rendera färg-emoji som
 * text (SDF-glyfsystemet), så emojin BAKAS in i brick-bilden precis som på
 * webben (makeBrickaImageData). PNG:erna i assets/brickor/ är förbakade med
 * exakt webbens ritkod (kropp i kategorins markerHex, alpha 0.9, svag vit
 * kant, kategori-emojin centrerad) vid 2,5× — därav BRICKA_ICON_SIZE.
 *
 * MEDVETEN AVGRÄNSNING ÄN SÅ LÄNGE: kategorins standard-emoji, inte eventets
 * fria LLM-emoji (den kräver runtime-bakning — skia — och är ett eget steg).
 * Kategorifärgerna/emojin ska matcha webbens utils/categories.ts; nycklarna ägs
 * av @vadkul/kontrakt och match-uttrycket nedan byggs ur EVENT_CATEGORY_KEYS,
 * så en ny kategori utan PNG ger tsc-fel här (Record-vakten) i stället för en
 * osynlig bricka.
 */
import type { ImageRequireSource } from 'react-native';
import { EVENT_CATEGORY_KEYS, type EventCategoryType } from '@vadkul/kontrakt';

/** PNG:erna bakades vid DPR 2,5 → rita dem i 1/2,5 så kroppen blir 40 pt. */
export const BRICKA_ICON_SIZE = 1 / 2.5;

/** Bild-nyckel i stilen per kategori. */
export const brickaImageKey = (cat: EventCategoryType): string => `bricka-${cat}`;

/** Kartstilens bildregister — ges till <Images images={…}>. */
export const BRICKA_IMAGES: Record<string, ImageRequireSource> = {
    'bricka-music': require('../../assets/brickor/bricka-music.png'),
    'bricka-stage': require('../../assets/brickor/bricka-stage.png'),
    'bricka-art': require('../../assets/brickor/bricka-art.png'),
    'bricka-sport': require('../../assets/brickor/bricka-sport.png'),
    'bricka-food': require('../../assets/brickor/bricka-food.png'),
    'bricka-market': require('../../assets/brickor/bricka-market.png'),
    'bricka-party': require('../../assets/brickor/bricka-party.png'),
    'bricka-social': require('../../assets/brickor/bricka-social.png'),
    'bricka-course': require('../../assets/brickor/bricka-course.png'),
    'bricka-family': require('../../assets/brickor/bricka-family.png'),
    'bricka-other': require('../../assets/brickor/bricka-other.png'),
} satisfies Record<`bricka-${EventCategoryType}`, ImageRequireSource>;

/**
 * MapLibre-uttryck: eventets `category`-property → bild-nyckel, okänd/saknad
 * kategori → other (samma fallback som webbens brickaBodyHex).
 */
export const BRICKA_ICON_EXPRESSION: unknown[] = [
    'match',
    ['get', 'category'],
    ...EVENT_CATEGORY_KEYS.flatMap(k => [k, brickaImageKey(k)]),
    brickaImageKey('other'),
];
