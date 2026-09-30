/**
 * Klienten mot API:t v1 (huvudrepots apps/functions/src/api, plattformsplanen
 * fas 3): profilen och kontoraderingen. Allt skickar Firebase ID-token som
 * Bearer. Läsdata (eventflödet) går ALDRIG hit - den går via CDN:et.
 *
 * Adressen är funktionens egen tills api.vadkul.se finns (planen §9.3).
 */
import type { MeProfil, MeProfilIn } from '@vadkul/kontrakt';
import { ApiFel } from '@/lib/kontoFel';

export const API_BAS = 'https://europe-west1-vadkul-f2cb2.cloudfunctions.net/api/v1';

async function anropa<T>(token: string, metod: 'GET' | 'PUT' | 'DELETE', väg: string, kropp?: unknown): Promise<T> {
    let res: Response;
    try {
        res = await fetch(`${API_BAS}${väg}`, {
            method: metod,
            headers: {
                authorization: `Bearer ${token}`,
                accept: 'application/json',
                ...(kropp !== undefined ? { 'content-type': 'application/json' } : {}),
            },
            body: kropp !== undefined ? JSON.stringify(kropp) : undefined,
        });
    } catch {
        throw new ApiFel('Ingen anslutning - kolla nätet och försök igen.', 0);
    }
    const json = await res.json().catch(() => null) as { fel?: string } | null;
    if (!res.ok) throw new ApiFel(json?.fel ?? 'Något gick fel hos oss - försök igen.', res.status);
    return json as T;
}

export async function hämtaProfil(token: string): Promise<MeProfil | null> {
    return (await anropa<{ profil: MeProfil | null }>(token, 'GET', '/me')).profil;
}

export async function sparaProfil(token: string, input: MeProfilIn): Promise<MeProfil> {
    return (await anropa<{ profil: MeProfil }>(token, 'PUT', '/me', input)).profil;
}

export async function raderaKontot(token: string): Promise<void> {
    await anropa<{ raderat: true }>(token, 'DELETE', '/me');
}
