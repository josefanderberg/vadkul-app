import { describe, expect, it } from 'vitest';
import { byggCallableAnrop, FUNKTIONS_BAS, kanSättaStjärna, tolkaCallableSvar } from './stjarnor';

describe('byggCallableAnrop', () => {
    it('bygger callable-protokollets POST med data-kuvert och Bearer-token', () => {
        const { url, init } = byggCallableAnrop('placeStar', { eventId: 'e1' }, 'tok123');
        expect(url).toBe(`${FUNKTIONS_BAS}/placeStar`);
        expect(init.method).toBe('POST');
        expect(init.headers.Authorization).toBe('Bearer tok123');
        expect(init.headers['Content-Type']).toBe('application/json');
        expect(JSON.parse(init.body)).toEqual({ data: { eventId: 'e1' } });
    });
    it('utan token skickas ingen Authorization-header', () => {
        const { init } = byggCallableAnrop('placeStar', {}, null);
        expect(init.headers.Authorization).toBeUndefined();
    });
});

describe('tolkaCallableSvar', () => {
    it('plockar result-kuvertet', () => {
        expect(tolkaCallableSvar<{ ok: boolean }>({ result: { ok: true } })).toEqual({ ok: true });
    });
    it('felsvar och skräp blir null', () => {
        expect(tolkaCallableSvar({ error: { message: 'nej' } })).toBeNull();
        expect(tolkaCallableSvar(undefined)).toBeNull();
        expect(tolkaCallableSvar('text')).toBeNull();
    });
});

describe('kanSättaStjärna', () => {
    it('kräver inloggning, stjärnor kvar och ett opasserat event', () => {
        expect(kanSättaStjärna(true, 1, false)).toBe(true);
        expect(kanSättaStjärna(false, 1, false)).toBe(false);
        expect(kanSättaStjärna(true, 0, false)).toBe(false);
        expect(kanSättaStjärna(true, 2, true)).toBe(false);
    });
});
