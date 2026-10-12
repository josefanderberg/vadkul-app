import { describe, expect, it } from 'vitest';
import { somFel, uppdateringsAttribut } from './krasch';

describe('somFel', () => {
    it('släpper igenom riktiga Error orörda', () => {
        const e = new TypeError('x is undefined');
        expect(somFel(e)).toBe(e);
    });

    it('gör om strängar till Error med samma meddelande', () => {
        const e = somFel('trasigt');
        expect(e).toBeInstanceOf(Error);
        expect(e.message).toBe('trasigt');
    });

    it('tar bara med typen för andra värden - aldrig innehållet', () => {
        expect(somFel({ email: 'a@b.se' }).message).toBe('Kastat icke-Error-värde (object)');
        expect(somFel(42).message).toBe('Kastat icke-Error-värde (number)');
        expect(somFel(undefined).message).toBe('Kastat icke-Error-värde (undefined)');
        expect(somFel(null).message).toBe('Kastat icke-Error-värde (null)');
    });
});

describe('uppdateringsAttribut', () => {
    it('märker det inbyggda paketet', () => {
        expect(uppdateringsAttribut({
            updateId: null,
            channel: 'production',
            runtimeVersion: 'abc',
            isEmbeddedLaunch: true,
        })).toEqual({ js_paket: 'inbyggt', update_id: 'ingen', kanal: 'production', runtime: 'abc' });
    });

    it('märker ett OTA-paket med dess update-id', () => {
        expect(uppdateringsAttribut({
            updateId: 'u-1',
            channel: 'production',
            runtimeVersion: 'abc',
            isEmbeddedLaunch: false,
        })).toEqual({ js_paket: 'ota', update_id: 'u-1', kanal: 'production', runtime: 'abc' });
    });

    it('fyller i saknade värden (dev-bygge utan expo-updates-konfig)', () => {
        expect(uppdateringsAttribut({
            updateId: null,
            channel: null,
            runtimeVersion: null,
            isEmbeddedLaunch: true,
        })).toEqual({ js_paket: 'inbyggt', update_id: 'ingen', kanal: 'ingen', runtime: 'ingen' });
    });
});
