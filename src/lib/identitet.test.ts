import { describe, expect, it, vi } from 'vitest';
import { deladIdentitet } from './identitet';

/** En falsk auth: loggaInAnonymt löses först när testet säger till. */
function falskAuth(startUid: string | null = null) {
    let uid: string | null = startUid;
    let nr = 0;
    const väntande: (() => void)[] = [];
    const loggaInAnonymt = vi.fn(() => new Promise<string>(resolve => {
        väntande.push(() => { uid = `anon-${++nr}`; resolve(uid); });
    }));
    return {
        nuvarandeUid: () => uid,
        loggaInAnonymt,
        blirKlar: () => väntande.shift()?.(),
        sättUid: (u: string | null) => { uid = u; },
    };
}

describe('deladIdentitet (josefanderberg/VADKUL#164)', () => {
    it('Bjud med + svara samtidigt ger EN anonym inloggning och samma uid', async () => {
        const a = falskAuth();
        const säkerställ = deladIdentitet(a);
        const anrop = [säkerställ(), säkerställ()];
        await Promise.resolve();
        a.blirKlar();
        const uids = await Promise.all(anrop);
        expect(a.loggaInAnonymt).toHaveBeenCalledTimes(1);
        expect(uids).toEqual(['anon-1', 'anon-1']);
    });

    it('finns en session redan loggas ingen in', async () => {
        const a = falskAuth('konto-1');
        expect(await deladIdentitet(a)()).toBe('konto-1');
        expect(a.loggaInAnonymt).not.toHaveBeenCalled();
    });

    it('efter en klar inloggning återanvänds sessionen', async () => {
        const a = falskAuth();
        const säkerställ = deladIdentitet(a);
        const första = säkerställ();
        await Promise.resolve();
        a.blirKlar();
        expect(await första).toBe('anon-1');
        expect(await säkerställ()).toBe('anon-1');
        expect(a.loggaInAnonymt).toHaveBeenCalledTimes(1);
    });

    it('väntar på den sparade sessionen innan en ny skapas', async () => {
        const a = falskAuth();
        let återställ!: () => void;
        const klar = () => new Promise<void>(resolve => { återställ = () => { a.sättUid('sparad-1'); resolve(); }; });
        const anrop = deladIdentitet({ ...a, klar })();
        await Promise.resolve();
        återställ();
        expect(await anrop).toBe('sparad-1');
        expect(a.loggaInAnonymt).not.toHaveBeenCalled();
    });

    it('ett misslyckat försök släpper låset så att nästa tryck försöker igen', async () => {
        let uid: string | null = null;
        const loggaInAnonymt = vi.fn()
            .mockRejectedValueOnce(new Error('offline'))
            .mockImplementationOnce(async () => { uid = 'anon-2'; return uid; });
        const säkerställ = deladIdentitet({ nuvarandeUid: () => uid, loggaInAnonymt });
        await expect(säkerställ()).rejects.toThrow('offline');
        expect(await säkerställ()).toBe('anon-2');
        expect(loggaInAnonymt).toHaveBeenCalledTimes(2);
    });
});
