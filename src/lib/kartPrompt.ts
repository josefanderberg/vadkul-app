/**
 * Prompten ovanför dagväljaren (webbens botten-prompt-slot): tom ruta med
 * filter → "Inget inom Sport här idag" + Visa alla; tom dag → "testa veckan";
 * allt i rutan har redan varit idag → Visa imorgon. Mäter KARTANS RUTA
 * (tom-prompten = stadsrutans mått), aldrig hela flödet.
 *
 * TOM-PROMPTEN TIGER PÅ KVARTERSNIVÅ (VADKUL#252, ägarbeslut 15/11, Josef om
 * webbens ruta: "den täcker för mycket av skärmen. och är ivägen när man
 * kanske letar efter restaurangen"): från zoomen där kvarterets platsskyltar
 * tänds (appens eget lager, lib/kartSkyltar) visas ingen "Inget här"-prompt -
 * så nära inzoomat är en tom ruta det normala. Webbens regel:
 * apps/web/src/utils/emptyPrompt.ts. Texten är EN RAD, utan förklaring.
 */
import { SKYLT_NÄRA_ZOOM } from './kartSkyltar';

/** Härifrån tiger tom-prompten (#252). */
export const TOM_PROMPT_MAX_ZOOM = SKYLT_NÄRA_ZOOM;

export type PromptÅtgärd = 'visaAlla' | 'vecka' | 'imorgon';

export interface KartPrompt {
    text: string;
    knapp?: { text: string; åtgärd: PromptÅtgärd };
}

export function kartPrompt(p: {
    /** null = rutan inte känd än → ingen prompt. */
    antal: number | null;
    /** Antal i perioden som inte varit. */
    levande: number;
    filterNamn: string | null;
    längd: 1 | 7;
    offset: number;
    /** "idag", "imorgon", "ons 1 okt", "hela veckan" … */
    periodText: string;
    /** Kartans zoom, null innan kartan rapporterat den. */
    zoom?: number | null;
}): KartPrompt | null {
    if (p.antal === null) return null;
    if (p.antal === 0) {
        if (p.zoom != null && p.zoom >= TOM_PROMPT_MAX_ZOOM) return null;
        if (p.filterNamn) {
            return { text: `Inget inom ${p.filterNamn} här ${p.periodText}`, knapp: { text: 'Visa alla', åtgärd: 'visaAlla' } };
        }
        if (p.längd === 1) return { text: `Inget här ${p.periodText}`, knapp: { text: 'Visa hela veckan', åtgärd: 'vecka' } };
        return { text: 'Inget här de närmaste dagarna' };
    }
    if (p.levande === 0 && p.längd === 1 && p.offset === 0) {
        return { text: 'Allt här har redan varit idag', knapp: { text: 'Visa imorgon', åtgärd: 'imorgon' } };
    }
    return null;
}
