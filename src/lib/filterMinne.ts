/**
 * Kartfiltrets persistens - port av webbens utils/mapFilter (ägarbeslut
 * 6/10: kategorifiltret är FLERVAL och SPARAS, 30 dagars TTL; kontot vinner
 * över enheten). 15/9-läxan gäller: ett sparat filter får ALDRIG vara
 * osynligt - det är FilterBrickas alltid synliga brickor (en per vald
 * kategori, varje ✕ släpper sin) som gör persistensen okej.
 */
import { EVENT_CATEGORY_KEYS, type EventCategoryType } from '@vadkul/kontrakt';

export const FILTER_TTL_DAGAR = 30;

export interface SparatFilter {
    kategorier: string[];
    sparadVid: number;
}

/** Det som läggs i lagringen - null när valet är tomt (posten rensas). */
export function tillSparat(kategorier: ReadonlySet<string>, nuMs: number): SparatFilter | null {
    if (kategorier.size === 0) return null;
    return { kategorier: [...kategorier], sparadVid: nuMs };
}

/** Giltiga kategorinycklar ur en lagrad/kontosparad post - tom lista vid
 *  utgången TTL, okänd form eller bara skräpnycklar. */
export function läsSparat(v: unknown, nuMs: number): EventCategoryType[] {
    if (!v || typeof v !== 'object') return [];
    const post = v as Partial<SparatFilter>;
    if (typeof post.sparadVid !== 'number' || nuMs - post.sparadVid > FILTER_TTL_DAGAR * 86_400_000) return [];
    if (!Array.isArray(post.kategorier)) return [];
    return post.kategorier.filter(
        (k): k is EventCategoryType => typeof k === 'string' && (EVENT_CATEGORY_KEYS as readonly string[]).includes(k),
    );
}

/** Kontofältet users.mapFilter (webbens form: ren nyckellista). */
export function läsKontoFilter(v: unknown): EventCategoryType[] {
    if (!Array.isArray(v)) return [];
    return v.filter(
        (k): k is EventCategoryType => typeof k === 'string' && (EVENT_CATEGORY_KEYS as readonly string[]).includes(k),
    );
}
