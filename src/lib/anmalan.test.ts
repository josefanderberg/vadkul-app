import { describe, expect, it } from 'vitest';
import { ANMÄLAN_NAMN_MAX, anmäldaRad, anmälanVem, sorteraAnmälda, type Anmäld } from './anmalan';

const a = (name: string, uid = name): Anmäld => ({ uid, name, photoURL: null });

describe('anmälanVem', () => {
    it('profilens namn först, sedan kontots, sedan e-posten', () => {
        expect(anmälanVem('Anna Profil', { displayName: 'Anna K', email: 'a@x.se' }, null).name).toBe('Anna Profil');
        expect(anmälanVem(null, { displayName: 'Anna K', email: 'a@x.se' }, null).name).toBe('Anna K');
        expect(anmälanVem('  ', { displayName: '', email: 'a@x.se' }, null).name).toBe('a@x.se');
    });

    it('inget namn alls = webbens reservnamn', () => {
        expect(anmälanVem(undefined, {}, null).name).toBe('VADKUL-användare');
    });

    it('namnet kortas till reglernas tak', () => {
        expect(anmälanVem('x'.repeat(200), {}, null).name).toHaveLength(ANMÄLAN_NAMN_MAX);
    });

    it('bilden bara som https - annars nekar reglerna skrivningen', () => {
        expect(anmälanVem('A', {}, 'https://img.se/a.jpg').photoURL).toBe('https://img.se/a.jpg');
        expect(anmälanVem('A', {}, 'http://img.se/a.jpg').photoURL).toBeNull();
        expect(anmälanVem('A', {}, `https://img.se/${'x'.repeat(600)}`).photoURL).toBeNull();
        expect(anmälanVem('A', {}, undefined).photoURL).toBeNull();
    });
});

describe('sorteraAnmälda', () => {
    it('äldst först, trasiga fält får reservvärden', () => {
        const lista = sorteraAnmälda([
            { id: 'u2', uid: 'u2', name: 'Sen', t: 20 },
            { id: 'u1', name: '', photoURL: 'https://img.se/a.jpg', t: 10 },
            { id: 'u3', uid: 7, name: 'Utan tid', t: 0 },
        ]);
        expect(lista).toEqual([
            { uid: 'u3', name: 'Utan tid', photoURL: null },
            { uid: 'u1', name: 'Anonym', photoURL: 'https://img.se/a.jpg' },
            { uid: 'u2', name: 'Sen', photoURL: null },
        ]);
    });
});

describe('anmäldaRad', () => {
    it('ingen anmäld = uppmaningen', () => {
        expect(anmäldaRad([])).toBe('Ingen anmäld än - bli först!');
    });

    it('en och flera anmälda med namnen', () => {
        expect(anmäldaRad([a('Anna')])).toBe('1 anmäld: Anna');
        expect(anmäldaRad([a('Anna'), a('Erik')])).toBe('2 anmälda: Anna, Erik');
    });

    it('fler än fem namn = "och N till"', () => {
        const sju = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map(n => a(n));
        expect(anmäldaRad(sju)).toBe('7 anmälda: A, B, C, D, E och 2 till');
    });
});
