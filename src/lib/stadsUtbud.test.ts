import { describe, expect, it } from 'vitest';
import type { AppFeedEvent, City } from '@vadkul/kontrakt';
import {
    grupperaPerDag,
    matcharStadsSök,
    närmasteStäder,
    stadensEvent,
    stadsIntro,
    svJämför,
    svLista,
    topPlatser,
    toppArrangörer,
    utanStoraKällor,
} from './stadsUtbud';

const STAD: City = { slug: 'lulea', name: 'Luleå', lat: 65.5848, lng: 22.1547, region: 'norrbotten' };
const NU = new Date(2026, 8, 27, 14, 0);

const ev = (id: string, lat: number, lng: number, time: Date): AppFeedEvent => ({
    id,
    title: id,
    time: time.toISOString(),
    hasSpecificTime: true,
    lat,
    lng,
    category: 'music',
});

describe('stadensEvent', () => {
    it('behåller event i orten och släpper länets ytterkanter', () => {
        const nära = ev('nära', 65.59, 22.16, NU);
        const kiruna = ev('kiruna', 67.8558, 20.2253, NU); // ~29 mil bort, samma län
        expect(stadensEvent([nära, kiruna], STAD).map(e => e.id)).toEqual(['nära']);
    });
});

describe('grupperaPerDag', () => {
    it('grupperar per dag med väljarens etiketter, tomma dagar hoppas', () => {
        const idag = ev('a', 65.59, 22.16, new Date(2026, 8, 27, 19, 0));
        const påMåndag = ev('b', 65.59, 22.16, new Date(2026, 8, 29, 18, 0));
        const sektioner = grupperaPerDag([påMåndag, idag], NU);
        expect(sektioner.map(s => s.label)).toEqual(['Idag', 'tis 29 sep']);
        expect(sektioner[0].data.map(e => e.id)).toEqual(['a']);
    });
    it('sorterar dagens event i tidsordning', () => {
        const sen = ev('sen', 65.59, 22.16, new Date(2026, 8, 27, 21, 0));
        const tidig = ev('tidig', 65.59, 22.16, new Date(2026, 8, 27, 15, 0));
        const [sektion] = grupperaPerDag([sen, tidig], NU);
        expect(sektion.data.map(e => e.id)).toEqual(['tidig', 'sen']);
    });
});

describe('utanStoraKällor', () => {
    it('släpper Svenska kyrkan/PRO/Korpen, behåller resten', () => {
        const kyrkan = { ...ev('https://www.svenskakyrkan.se/vaxjo/x', 65.59, 22.16, NU) };
        const vanligt = ev('https://konserthus.se/a', 65.59, 22.16, NU);
        expect(utanStoraKällor([kyrkan, vanligt]).map(e => e.id)).toEqual(['https://konserthus.se/a']);
    });
});

describe('topPlatser + svLista + stadsIntro', () => {
    const plats = (locationName: string) => ({ locationName });
    it('flest event först, minst två, stadens namn och kladd bort', () => {
        const ev = [
            plats('Konserthuset'), plats('Konserthuset'), plats('Konserthuset'),
            plats('Domkyrkan'), plats('Domkyrkan'),
            plats('Luleå'), plats('Luleå'),
            plats('Kackelstugan, Rotaryklubben'), plats('Kackelstugan, Rotaryklubben'),
            plats('Ensam plats'),
        ];
        expect(topPlatser(ev, 'Luleå')).toEqual(['Konserthuset', 'Domkyrkan']);
    });
    it('svLista', () => {
        expect(svLista([])).toBe('');
        expect(svLista(['A'])).toBe('A');
        expect(svLista(['A', 'B', 'C'])).toBe('A, B och C');
    });
    it('intro-raden: siffrorna bara när något händer, platserna från två', () => {
        expect(stadsIntro({ stad: 'Luleå', antal: 40, idag: 3, veckan: 20, platser: ['A', 'B'] }))
            .toBe('40 kommande event i Luleå de närmaste 14 dagarna - 3 idag och 20 i veckan. Mest händer på A och B.');
        expect(stadsIntro({ stad: 'Luleå', antal: 2, idag: 0, veckan: 0, platser: ['A'] }))
            .toBe('2 kommande event i Luleå de närmaste 14 dagarna.');
    });
});

describe('matcharStadsSök', () => {
    const e = { title: 'Jazzkväll på puben', locationName: 'Kulturens hus' };
    it('titel eller plats, tom term matchar allt', () => {
        expect(matcharStadsSök(e, '')).toBe(true);
        expect(matcharStadsSök(e, 'jazz')).toBe(true);
        expect(matcharStadsSök(e, 'kulturens')).toBe(true);
        expect(matcharStadsSök(e, 'rock')).toBe(false);
    });
});

describe('toppArrangörer', () => {
    const arr = (id: string, hostName: string, extra = {}) => ({ ...ev(id, 65.59, 22.16, NU), hostName, ...extra });
    it('minst tre event, flest först, vanligaste stavningen, aldrig användarskapade', () => {
        const ev = [
            arr('https://kulturenshus.se/1', 'Kulturens hus'),
            arr('https://kulturenshus.se/2', 'Kulturens hus'),
            arr('https://kulturenshus.se/3', 'Kulturens  hus'),
            arr('https://kulturenshus.se/4', 'Kulturens hus'),
            arr('https://teatern.se/1', 'Norrbottensteatern'),
            arr('https://teatern.se/2', 'Norrbottensteatern'),
            arr('egetdok', 'Norrbottensteatern', { userCreated: true as const }),
        ];
        const chips = toppArrangörer(ev);
        expect(chips.map(c => [c.namn, c.antal])).toEqual([['Kulturens hus', 4]]);
        expect(chips[0].slug).toBeTruthy();
    });
});

describe('närmasteStäder', () => {
    it('de närmaste först, aldrig staden själv', () => {
        const n = närmasteStäder(STAD, 3);
        expect(n).toHaveLength(3);
        expect(n.map(c => c.slug)).not.toContain('lulea');
        expect(n[0].slug).toBe('pitea');
    });
});

describe('svJämför', () => {
    it('å, ä, ö efter z', () => {
        expect(['Örebro', 'Ängelholm', 'Åmål', 'Zinkgruvan', 'Alingsås'].sort(svJämför))
            .toEqual(['Alingsås', 'Zinkgruvan', 'Åmål', 'Ängelholm', 'Örebro']);
    });
});
