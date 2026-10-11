import { describe, expect, it, vi } from 'vitest';
import type { AppFeedEvent } from '@vadkul/kontrakt';
import { begärKartHopp, hoppDag, hoppPanorering, hoppStad, prenumereraKartHopp, taKartHopp } from './kartHopp';
import { iBild, type Ruta } from './vy';

const NU = new Date(2026, 9, 11, 14, 0); // sön 11 okt 2026, lokal tid
const ev = (over: Partial<AppFeedEvent> = {}): AppFeedEvent => ({
    id: 'https://x.se/a', title: 'A', time: new Date(2026, 9, 13, 19, 0).toISOString(),
    hasSpecificTime: true, lat: 56.8777, lng: 14.8094, category: 'music', ...over,
});

describe('kön', () => {
    it('senaste hoppet vinner och tas bara en gång', () => {
        begärKartHopp({ event: ev({ id: 'ett' }) });
        begärKartHopp({ event: ev({ id: 'två' }) });
        expect(taKartHopp()?.event.id).toBe('två');
        expect(taKartHopp()).toBeNull();
    });
    it('lyssnaren väcks direkt och kan avregistreras', () => {
        const fn = vi.fn();
        const av = prenumereraKartHopp(fn);
        begärKartHopp({ event: ev() });
        expect(fn).toHaveBeenCalledTimes(1);
        av();
        begärKartHopp({ event: ev() });
        expect(fn).toHaveBeenCalledTimes(1);
        taKartHopp();
    });
});

describe('hoppDag', () => {
    it('eventets kalenderdag', () => {
        expect(hoppDag(ev(), NU, 13)).toBe(2);
        expect(hoppDag(ev({ time: new Date(2026, 9, 11, 23, 30).toISOString() }), NU, 13)).toBe(0);
    });
    it('passerade dagar landar på idag, bortom horisonten på sista dagen', () => {
        expect(hoppDag(ev({ time: new Date(2026, 9, 2, 19, 0).toISOString() }), NU, 13)).toBe(0);
        expect(hoppDag(ev({ time: new Date(2026, 10, 20, 19, 0).toISOString() }), NU, 13)).toBe(13);
    });
    it('trasig tid → idag', () => {
        expect(hoppDag(ev({ time: 'inte en tid' }), NU, 13)).toBe(0);
    });
});

describe('hoppStad', () => {
    const VÄXJÖ = { slug: 'vaxjo', region: 'kronoberg' };
    it('finns eventet i flödet byts aldrig stad', () => {
        expect(hoppStad(ev({ lat: 57.7089, lng: 11.9746 }), { iFlödet: true, stad: VÄXJÖ })).toBeNull();
    });
    it('annat län → närmaste stad', () => {
        expect(hoppStad(ev({ lat: 57.71, lng: 11.97 }), { iFlödet: false, stad: VÄXJÖ })?.slug).toBe('goteborg');
    });
    it('samma län räcker, även om eventet saknas i flödet (användarskapat, nytt tips)', () => {
        expect(hoppStad(ev({ lat: 56.55, lng: 14.14 }), { iFlödet: false, stad: VÄXJÖ })).toBeNull();
    });
    it('skärmens stad vinner - också i samma län, men inte när kartan redan står där', () => {
        expect(hoppStad(ev({ lat: 57.71, lng: 11.97 }), { iFlödet: false, stad: VÄXJÖ, stadSlug: 'goteborg' })?.slug).toBe('goteborg');
        expect(hoppStad(ev({ lat: 56.55, lng: 14.14 }), { iFlödet: true, stad: VÄXJÖ, stadSlug: 'almhult' })?.slug).toBe('almhult');
        expect(hoppStad(ev(), { iFlödet: true, stad: VÄXJÖ, stadSlug: 'vaxjo' })).toBeNull();
    });
    it('okänd slug faller tillbaka på närmaste stad', () => {
        expect(hoppStad(ev({ lat: 57.71, lng: 11.97 }), { iFlödet: false, stad: VÄXJÖ, stadSlug: 'finns-inte' })?.slug)
            .toBe('goteborg');
    });
});

describe('hoppPanorering', () => {
    const RUTA: Ruta = [14.7, 56.8, 14.9, 56.95];
    it('brickan syns ovanför kortet → kameran står still', () => {
        expect(hoppPanorering(ev({ lat: 56.93, lng: 14.8 }), RUTA)).toBeNull();
    });
    it('bakom kortet → panorera dit, brickan hamnar ovanför kortet', () => {
        const e = ev({ lat: 56.82, lng: 14.8 });
        const mitt = hoppPanorering(e, RUTA);
        expect(mitt).not.toBeNull();
        const [lng, lat] = mitt!;
        expect(lng).toBe(14.8);
        // Samma rutstorlek kring den nya mitten: brickan syns ovanför kortet.
        const h = RUTA[3] - RUTA[1];
        const w = RUTA[2] - RUTA[0];
        const ny: Ruta = [lng - w / 2, lat - h / 2, lng + w / 2, lat + h / 2];
        expect(iBild(e.lat, e.lng, ny, 0.42)).toBe(true);
    });
    it('utanför rutan → också panorering', () => {
        expect(hoppPanorering(ev({ lat: 57.71, lng: 11.97 }), RUTA)).not.toBeNull();
    });
});
