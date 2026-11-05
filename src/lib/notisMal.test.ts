import { describe, expect, it } from 'vitest';
import { notisMål } from './notisMal';

describe('notisMål', () => {
    it('påminnelsen och helgtipset går rakt in i routern', () => {
        expect(notisMål({ url: '/e/konsert-i-vaxjo-ab12' })).toBe('/e/konsert-i-vaxjo-ab12');
        expect(notisMål({ url: '/evenemang/vaxjo' })).toBe('/evenemang/vaxjo');
        expect(notisMål({ url: '/arrangor/palatset' })).toBe('/arrangor/palatset');
    });

    it('kartan och dess parametrar behålls', () => {
        expect(notisMål({ url: '/' })).toBe('/');
        expect(notisMål({ url: '/?event=abc' })).toBe('/?event=abc');
    });

    it('okända sökvägar och fulla URL:er landar på kartan', () => {
        expect(notisMål({ url: '/event/abc' })).toBe('/');
        expect(notisMål({ url: '/chat' })).toBe('/');
        expect(notisMål({ url: '/e/' })).toBe('/');
        expect(notisMål({ url: 'https://evil.example/x' })).toBe('/');
        expect(notisMål({ url: '//evil.example' })).toBe('/');
    });

    it('ingen data = inget mål', () => {
        expect(notisMål(undefined)).toBeNull();
        expect(notisMål({})).toBeNull();
        expect(notisMål({ url: '' })).toBeNull();
        expect(notisMål({ url: 42 })).toBeNull();
    });
});
