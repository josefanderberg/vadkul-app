/**
 * Kategoriernas presentation i appen - etikett, emoji och accentfärg per
 * kategori-NYCKEL ur @vadkul/kontrakt. Etiketter/emojis/färger är avskrivna
 * från webbens utils/categories.ts (EVENT_CATEGORIES) så kortets chip säger
 * samma sak som webben; definitionerna är presentationslager och bor per
 * klient (kontraktet äger bara nycklarna).
 */
import { EVENT_CATEGORY_KEYS, type EventCategoryType } from '@vadkul/kontrakt';

export interface KategoriPresentation {
    label: string;
    /** Kort etikett - kartmarkörernas text under brickan (webbens "Konst"/"Scen"). */
    kort: string;
    emoji: string;
    /** Accent (webbens markerHex) - chipens text; bakgrund tonas ur samma färg. */
    hex: string;
}

export const KATEGORIER: Record<EventCategoryType, KategoriPresentation> = {
    music: { label: 'Musik', kort: 'Musik', emoji: '🎵', hex: '#ec4899' },
    stage: { label: 'Scen', kort: 'Scen', emoji: '🎭', hex: '#9333ea' },
    art: { label: 'Konst', kort: 'Konst', emoji: '🎨', hex: '#f97316' },
    sport: { label: 'Sport & träning', kort: 'Sport', emoji: '⚽', hex: '#ef4444' },
    food: { label: 'Mat & dryck', kort: 'Mat', emoji: '🍽️', hex: '#d97706' },
    market: { label: 'Marknad', kort: 'Marknad', emoji: '🛍️', hex: '#059669' },
    party: { label: 'Fest & uteliv', kort: 'Fest', emoji: '🎉', hex: '#c026d3' },
    social: { label: 'Socialt & spel', kort: 'Socialt', emoji: '🤝', hex: '#14b8a6' },
    course: { label: 'Kurs & föreläsning', kort: 'Kurs', emoji: '📚', hex: '#3b82f6' },
    family: { label: 'Familj & barn', kort: 'Familj', emoji: '🧸', hex: '#06b6d4' },
    other: { label: 'Övrigt', kort: 'Övrigt', emoji: '✨', hex: '#94a3b8' },
};

/** Opt-in-källorna kan dyka upp som kategori i flödet. */
const SPECIAL: Record<string, KategoriPresentation> = {
    svenskakyrkan: { label: 'Svenska kyrkan', kort: 'Kyrkan', emoji: '⛪', hex: '#64748b' },
    pro: { label: 'PRO', kort: 'PRO', emoji: '🧓', hex: '#64748b' },
};

/** Presentationen för en flödeskategori - okänd nyckel faller på Övrigt. */
export function kategoriFor(key: string): KategoriPresentation {
    if ((EVENT_CATEGORY_KEYS as readonly string[]).includes(key)) {
        return KATEGORIER[key as EventCategoryType];
    }
    return SPECIAL[key] ?? KATEGORIER.other;
}
