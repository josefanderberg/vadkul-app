import { describe, expect, it } from 'vitest';
import { appSökväg, idUrDelningssida } from './lankar';

describe('appSökväg', () => {
    it('relativa sökvägar (notisernas url) går rakt igenom', () => {
        expect(appSökväg('/e/abc123')).toBe('/e/abc123');
        expect(appSökväg('/evenemang/vaxjo')).toBe('/evenemang/vaxjo');
    });
    it('vadkul.se skalas till sökvägen, med query', () => {
        expect(appSökväg('https://vadkul.se/e/abc?inb=1&fran=u1')).toBe('/e/abc?inb=1&fran=u1');
        expect(appSökväg('https://www.vadkul.se/arrangor/abf-vaxjo')).toBe('/arrangor/abf-vaxjo');
        expect(appSökväg('https://vadkul.se')).toBe('/');
    });
    it('främmande domäner och skräp ger null', () => {
        expect(appSökväg('https://evil.se/vadkul.se/e/x')).toBeNull();
        expect(appSökväg('https://vadkul.se.evil.se/e/x')).toBeNull();
        expect(appSökväg('')).toBeNull();
        expect(appSökväg(undefined)).toBeNull();
    });
});

describe('idUrDelningssida', () => {
    it('läser och avkodar id:t ur Öppna på kartan-länken', () => {
        const html = '<a href="/?event=https%3A%2F%2Fx.se%2Fe%3Fa%3D1" class="mt-5">Öppna på kartan</a>';
        expect(idUrDelningssida(html)).toBe('https://x.se/e?a=1');
    });
    it('dokument-id för användarskapade', () => {
        expect(idUrDelningssida('<a href="/?event=AbC123xyz">')).toBe('AbC123xyz');
    });
    it('null när länken saknas (eventet har flugit vidare)', () => {
        expect(idUrDelningssida('<h1>Eventet har flugit vidare</h1><a href="/">')).toBeNull();
    });
});
