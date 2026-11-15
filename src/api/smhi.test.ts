import { afterEach, describe, expect, it, vi } from 'vitest';
import { hämtaSmhi, SMHI_TIMEOUT_MS } from './smhi';

// Inget nät i testerna: fetch byts ut mot en fejk.
const URL_A = 'https://smhi.invalid/a';

afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

describe('hämtaSmhi', () => {
    it('ger svarets JSON och frågar efter just den adressen', async () => {
        const fejk = vi.fn(async (_url: string, _init?: RequestInit) => ({ ok: true, json: async () => ({ timeSeries: [] }) }));
        vi.stubGlobal('fetch', fejk);
        expect(await hämtaSmhi(URL_A)).toEqual({ timeSeries: [] });
        expect(fejk).toHaveBeenCalledTimes(1);
        expect(fejk.mock.calls[0][0]).toBe(URL_A);
    });

    it('SMHI saknar orten (felsvar): null, inget kast', async () => {
        vi.stubGlobal('fetch', async () => ({ ok: false, status: 404, json: async () => { throw new Error('ska inte läsas'); } }));
        expect(await hämtaSmhi(URL_A)).toBeNull();
    });

    it('nätfel kastar - laddaren i kontraktet försöker då snart igen', async () => {
        vi.stubGlobal('fetch', async () => { throw new TypeError('Network request failed'); });
        await expect(hämtaSmhi(URL_A)).rejects.toThrow('Network request failed');
    });

    it('en hängd hämtning avbryts efter tidsgränsen', async () => {
        vi.useFakeTimers();
        // Svarar aldrig - faller först när signalen avbryts, som riktig fetch.
        vi.stubGlobal('fetch', (_url: string, init?: RequestInit) => new Promise((_, avvisa) => {
            init?.signal?.addEventListener('abort', () => avvisa(new Error('avbruten')));
        }));
        const utfall = hämtaSmhi(URL_A).then(() => 'svar', (e: Error) => e.message);
        await vi.advanceTimersByTimeAsync(SMHI_TIMEOUT_MS - 1);
        expect(await Promise.race([utfall, Promise.resolve('väntar')])).toBe('väntar');
        await vi.advanceTimersByTimeAsync(1);
        expect(await utfall).toBe('avbruten');
    });
});
