/**
 * Appflödets cache på disken - läsning och skrivning. Logiken (giltighet,
 * när man frågar CDN:et, vilka filer som rensas) bor i lib/flodesCache.
 *
 * Paketet är 1,3-1,8 MB okomprimerat - för stort för AsyncStorage (Androids
 * SQLite-rad tar ~2 MB, hela lagringen 6 MB), så det sparas som en fil per
 * region i cachemappen. Cachemappen och inte dokumentmappen: paketet går att
 * hämta igen, så det ska inte följa med i iCloud-backupen, och systemet får
 * rensa det när telefonen har ont om plats. expo-file-system ingår i
 * expo-paketet och är redan länkat i bygget.
 *
 * När CDN:et senast tillfrågades sparas i lib/lagring (några byte per
 * region), så en 304 inte behöver skriva om paketet. Alla fel sväljs: cachen
 * är bara en genväg, aldrig sanningskälla - utan den hämtas paketet som förut.
 */
import { Directory, File, Paths } from 'expo-file-system';
import { NYCKEL, läs, skriv } from './lagring';
import { attRadera, användbartSparat, sparadText, type SparatFlöde } from './flodesCache';

const mapp = () => new Directory(Paths.cache, 'appflode');
const filFör = (region: string) => new File(mapp(), `app-${region}.json`);
const kontrollNyckel = (region: string) => `${NYCKEL.flödesKontroll}.${region}`;

/** Det sparade paketet för regionen, om det finns och duger just nu. */
export async function läsSparatFlöde(region: string, nuMs: number): Promise<SparatFlöde | null> {
    try {
        const fil = filFör(region);
        if (!fil.exists) return null;
        return användbartSparat(JSON.parse(await fil.text()), region, nuMs);
    } catch {
        return null; // trasig eller halvskriven fil - hämtas om
    }
}

/**
 * Spara svarskroppen som den kom (redan parsad och godkänd av anroparen)
 * och rensa bort de äldsta regionerna utöver taket.
 */
export function sparaFlöde(region: string, etag: string | null, payloadText: string): void {
    try {
        const dir = mapp();
        dir.create({ intermediates: true, idempotent: true });
        filFör(region).write(sparadText(region, etag, payloadText));
        const filer = dir.list().filter((x): x is File => x instanceof File);
        const bort = new Set(attRadera(filer.map(f => ({ namn: f.name, ändradMs: f.modificationTime ?? null }))));
        for (const f of filer) if (bort.has(f.name)) f.delete();
    } catch {
        /* full disk o.d. - nästa kallstart hämtar från nätet som förut */
    }
}

/** När CDN:et senast svarade för regionen (304 eller nytt paket). */
export function läsKontrollerad(region: string): Promise<number | null> {
    return läs<number | null>(kontrollNyckel(region), null);
}

export function sparaKontrollerad(region: string, nuMs: number): Promise<void> {
    return skriv(kontrollNyckel(region), nuMs);
}
