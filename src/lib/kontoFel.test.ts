import { describe, expect, it } from 'vitest';
import { ApiFel, felText, ärAvbrutet } from './kontoFel';

describe('felText', () => {
    it('översätter Firebase-koder', () => {
        expect(felText({ code: 'auth/email-already-in-use' })).toMatch(/redan ett konto/);
        expect(felText({ code: 'auth/invalid-credential' })).toBe('Fel e-post eller lösenord.');
    });
    it('API-fel visar serverns rad', () => {
        expect(felText(new ApiFel('Okänd stad.', 400))).toBe('Okänd stad.');
    });
    it('okänt fel ger en generisk rad utan teknik', () => {
        expect(felText(new Error('TypeError: x is undefined'))).toBe('Något gick fel - försök igen.');
        expect(felText(null)).toBe('Något gick fel - försök igen.');
    });
});

describe('ärAvbrutet', () => {
    it('känner igen avbrutna Apple-/Google-rutor', () => {
        expect(ärAvbrutet({ code: 'ERR_REQUEST_CANCELED' })).toBe(true);
        expect(ärAvbrutet({ code: 'auth/invalid-credential' })).toBe(false);
    });
});
