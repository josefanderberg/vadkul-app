#!/usr/bin/env node
/**
 * Håller den inbakade kopian i kontrakt/ i synk med huvudrepots
 * packages/kontrakt/src.
 *
 * Varför en kopia: EAS bygger i molnet och kör npm install där. En
 * workspace-/file:-länk utanför projektet finns inte på den maskinen, och
 * @vadkul/kontrakt ligger inte på npm. Kopian är därför det enda som gör
 * molnbyggen möjliga - men den får ALDRIG redigeras här. Ändra i huvudrepot
 * och kör `npm run kontrakt:sync`.
 *
 *   node scripts/sync-kontrakt.mjs          kopierar källan hit
 *   node scripts/sync-kontrakt.mjs --check  jämför och faller vid avvikelse
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const kalla = resolve(appRot, '..', 'packages', 'kontrakt', 'src');
const mal = join(appRot, 'kontrakt');
const check = process.argv.includes('--check');

if (!existsSync(kalla)) {
    console.error(
        `Hittar inte huvudrepots kontrakt på ${kalla}.\n` +
            'Skriptet förutsätter att vadkul-app ligger i VADKUL-repots rot ' +
            '(~/source/VADKUL/vadkul-app). Kör det på den maskin där båda finns.',
    );
    process.exit(1);
}

const filer = readdirSync(kalla).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
const avvikande = [];

for (const fil of filer) {
    const kallText = readFileSync(join(kalla, fil), 'utf8');
    const malFil = join(mal, fil);
    const malText = existsSync(malFil) ? readFileSync(malFil, 'utf8') : null;

    if (kallText === malText) continue;

    if (check) {
        avvikande.push(malText === null ? `${fil} (saknas här)` : `${fil} (skiljer sig)`);
    } else {
        writeFileSync(malFil, kallText);
        console.log(`${malText === null ? 'ny' : 'uppdaterad'}: kontrakt/${fil}`);
    }
}

const extra = readdirSync(mal)
    .filter((f) => f.endsWith('.ts'))
    .filter((f) => !filer.includes(f));
for (const fil of extra) avvikande.push(`${fil} (finns inte i huvudrepot)`);

if (check && avvikande.length > 0) {
    console.error('Kopian i kontrakt/ har glidit isär från huvudrepot:');
    for (const rad of avvikande) console.error(`  - ${rad}`);
    console.error('\nKör `npm run kontrakt:sync` (och committa) om huvudrepot är rätt.');
    process.exit(1);
}

console.log(check ? 'kontrakt/ är i synk med huvudrepot.' : 'Klart.');
