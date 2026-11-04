import { describe, expect, it } from 'vitest';
import { PARAM_MAX, skärmvisning, tvättaParametrar } from './matning';

describe('tvättaParametrar', () => {
    it('ger ett tomt objekt utan parametrar', () => {
        expect(tvättaParametrar()).toEqual({});
    });

    it('släpper igenom korta strängar, tal och booleaner orörda', () => {
        expect(tvättaParametrar({ event_slug: 'abc123', status: 'going', antal: 3, ny_stjarna: true }))
            .toEqual({ event_slug: 'abc123', status: 'going', antal: 3, ny_stjarna: true });
    });

    it('klipper strängar till GA4:s 100 tecken', () => {
        const lång = 'x'.repeat(250);
        const ut = tvättaParametrar({ domain: lång });
        expect(ut.domain).toHaveLength(PARAM_MAX);
    });

    it('plockar bort tomma värden som smugit sig in', () => {
        const ut = tvättaParametrar({ a: 'x', b: undefined as unknown as string, c: null as unknown as string });
        expect(ut).toEqual({ a: 'x' });
    });
});

describe('skärmvisning', () => {
    it('kartan: roten blir "/" i båda fälten', () => {
        expect(skärmvisning('/', '')).toEqual({ screen_name: '/', screen_class: '/' });
    });

    it('stadssidan: sökvägen som namn, rutten med platshållare som klass', () => {
        expect(skärmvisning('/stad/stockholm', 'stad/[slug]'))
            .toEqual({ screen_name: '/stad/stockholm', screen_class: '/stad/[slug]' });
    });

    it('modalerna utan dynamiska segment får samma namn och klass', () => {
        expect(skärmvisning('/sok', 'sok')).toEqual({ screen_name: '/sok', screen_class: '/sok' });
    });

    it('djuplänken /e/<slug> grupperas under /e/[slug]', () => {
        expect(skärmvisning('/e/kul-fest-abc1', 'e/[slug]').screen_class).toBe('/e/[slug]');
    });

    it('tål sökväg utan inledande snedstreck och rutt med', () => {
        expect(skärmvisning('profil', '/profil')).toEqual({ screen_name: '/profil', screen_class: '/profil' });
    });

    it('klipper till 100 tecken', () => {
        const v = skärmvisning('/' + 'a'.repeat(300), 'a'.repeat(300));
        expect(v.screen_name).toHaveLength(PARAM_MAX);
        expect(v.screen_class).toHaveLength(PARAM_MAX);
    });
});
