import { describe, expect, it } from 'vitest';
import { kartPrompt, TOM_PROMPT_MAX_ZOOM } from './kartPrompt';
import { SKYLT_NÄRA_ZOOM } from './kartSkyltar';

const bas = { antal: 5, levande: 5, filterNamn: null, längd: 1 as const, offset: 0, periodText: 'idag' };

describe('kartPrompt', () => {
    it('ingen prompt när det finns något, eller rutan är okänd', () => {
        expect(kartPrompt(bas)).toBeNull();
        expect(kartPrompt({ ...bas, antal: null })).toBeNull();
    });
    it('tomt med filter → Visa alla', () => {
        expect(kartPrompt({ ...bas, antal: 0, filterNamn: 'Sport' })).toEqual({
            text: 'Inget inom Sport här idag', knapp: { text: 'Visa alla', åtgärd: 'visaAlla' },
        });
    });
    it('tom dag → testa veckan, tom vecka → bara text', () => {
        expect(kartPrompt({ ...bas, antal: 0 })?.knapp?.åtgärd).toBe('vecka');
        expect(kartPrompt({ ...bas, antal: 0, längd: 7 })?.knapp).toBeUndefined();
    });
    // VADKUL#252, Josef 15/11: "den täcker för mycket av skärmen. och är
    // ivägen när man kanske letar efter restaurangen".
    it('tom-prompten tiger där kvarterets skyltar tänds, men visas på stadsnivå', () => {
        expect(TOM_PROMPT_MAX_ZOOM).toBe(SKYLT_NÄRA_ZOOM);
        expect(kartPrompt({ ...bas, antal: 0, zoom: TOM_PROMPT_MAX_ZOOM })).toBeNull();
        expect(kartPrompt({ ...bas, antal: 0, filterNamn: 'Sport', zoom: 16 })).toBeNull();
        expect(kartPrompt({ ...bas, antal: 0, zoom: 11 })?.knapp?.åtgärd).toBe('vecka');
        expect(kartPrompt({ ...bas, antal: 0, zoom: null })?.knapp?.åtgärd).toBe('vecka');
        // En rad, utan förklaring.
        expect(kartPrompt({ ...bas, antal: 0, längd: 7, zoom: 11 })?.text).toBe('Inget här de närmaste dagarna');
    });
    it('allt har varit idag → Visa imorgon, men inte andra dagar', () => {
        expect(kartPrompt({ ...bas, levande: 0 })?.knapp?.åtgärd).toBe('imorgon');
        expect(kartPrompt({ ...bas, levande: 0, offset: 1 })).toBeNull();
    });
});
