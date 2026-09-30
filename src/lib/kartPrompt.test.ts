import { describe, expect, it } from 'vitest';
import { kartPrompt } from './kartPrompt';

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
    it('allt har varit idag → Visa imorgon, men inte andra dagar', () => {
        expect(kartPrompt({ ...bas, levande: 0 })?.knapp?.åtgärd).toBe('imorgon');
        expect(kartPrompt({ ...bas, levande: 0, offset: 1 })).toBeNull();
    });
});
