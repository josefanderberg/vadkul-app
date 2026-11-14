/**
 * Bakar kartans moln-PNG:er med WEBBENS EGEN ritkod (makeSprite och
 * makeShadowSprite i huvudrepots apps/web/src/components/v2/v2MapClouds.ts)
 * i en headless Chrome, så appens moln är samma bilder som webbens
 * (josefanderberg/VADKUL#233, Josef 14/11: "ta hela moln designen. alltså den
 * för webb. alltså exakt så likt som möjligt").
 *
 * Webben ritar formerna till små canvasar vid start; appen har ingen canvas,
 * så samma canvasar sparas här som bilder: åtta former (sex stackmoln från
 * sidan + två sedda uppifrån), var och en med sin markskugga. Speglingarna
 * (webbens mirrorSprite) bakas INTE - appen vänder bilden själv (scaleX -1),
 * så ordningen i MOLN_FORMER är webbens `sprites` utan de spegelvända.
 *
 * Kör från vadkul-app/ när en form, en färg eller ett ankare ändrats på webben:
 *   node scripts/baka-moln.mjs
 * Kräver huvudrepots node_modules (esbuild + puppeteer), som baka-brickor.
 * Lägg aldrig till ett npm-script för det: `scripts` i package.json ingår i
 * OTA-avtrycket.
 */
import { Buffer } from 'node:buffer';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const här = dirname(fileURLToPath(import.meta.url));
const appRot = resolve(här, '..');
const huvudRot = resolve(appRot, '..');
const req = createRequire(join(huvudRot, 'package.json'));
const esbuild = req('esbuild');
const puppeteer = req('puppeteer');

const bundle = await esbuild.build({
    stdin: {
        contents: `
            import {
                SPRITE_W, SPRITE_H, SIDE_ANCHOR_Y, TOP_ANCHOR_Y,
                SPRITE_PUFFS, TOP_PUFFS, makeSprite, makeShadowSprite,
            } from './components/v2/v2MapClouds';
            window.__baka = {
                SPRITE_W, SPRITE_H, SIDE_ANCHOR_Y, TOP_ANCHOR_Y,
                SPRITE_PUFFS, TOP_PUFFS, makeSprite, makeShadowSprite,
            };
        `,
        resolveDir: join(huvudRot, 'apps/web/src'),
        loader: 'ts',
    },
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    alias: {
        '@': join(huvudRot, 'apps/web/src'),
        '@vadkul/kontrakt': join(huvudRot, 'packages/kontrakt/src/index.ts'),
    },
    loader: { '.png': 'empty', '.svg': 'empty', '.jpg': 'empty' },
    nodePaths: [join(huvudRot, 'node_modules')],
});

const browser = await puppeteer.launch({ headless: true });
try {
    const page = await browser.newPage();
    await page.setContent('<!doctype html><meta charset="utf-8"><body></body>');
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    const bakat = await page.evaluate(() => {
        const b = window.__baka;
        // Webbens ordning: sidoformerna först, sedan de sedda uppifrån.
        const former = [
            ...b.SPRITE_PUFFS.map(puffar => ({ puffar, uppifrån: false })),
            ...b.TOP_PUFFS.map(puffar => ({ puffar, uppifrån: true })),
        ];
        return {
            bredd: b.SPRITE_W,
            höjd: b.SPRITE_H,
            former: former.map(f => ({
                uppifrån: f.uppifrån,
                ankareY: f.uppifrån ? b.TOP_ANCHOR_Y : b.SIDE_ANCHOR_Y,
                moln: b.makeSprite(f.puffar, f.uppifrån).toDataURL('image/png'),
                skugga: b.makeShadowSprite(f.puffar).toDataURL('image/png'),
            })),
        };
    });

    const mapp = join(appRot, 'assets/moln');
    mkdirSync(mapp, { recursive: true });
    bakat.former.forEach((f, i) => {
        writeFileSync(join(mapp, `moln-${i}.png`), Buffer.from(f.moln.split(',')[1], 'base64'));
        writeFileSync(join(mapp, `skugga-${i}.png`), Buffer.from(f.skugga.split(',')[1], 'base64'));
    });

    writeFileSync(join(appRot, 'src/lib/molnBilder.generated.ts'), [
        '// GENERERAD av scripts/baka-moln.mjs - redigera inte för hand.',
        "import type { ImageRequireSource } from 'react-native';",
        '',
        '/** Molnformernas bilder, i samma ordning som MOLN_FORMER. */',
        'export const MOLN_BILDER: readonly ImageRequireSource[] = [',
        ...bakat.former.map((_, i) => `    require('../../assets/moln/moln-${i}.png'),`),
        '];',
        '',
        '/** Markskuggorna - molnets egen form som en mjuk mörk fläck. */',
        'export const SKUGG_BILDER: readonly ImageRequireSource[] = [',
        ...bakat.former.map((_, i) => `    require('../../assets/moln/skugga-${i}.png'),`),
        '];',
        '',
    ].join('\n'));
    // Utan require, så vitest kan läsa formerna.
    writeFileSync(join(appRot, 'src/lib/molnFormer.generated.ts'), [
        '// GENERERAD av scripts/baka-moln.mjs - redigera inte för hand.',
        '/** Molnbildens mått i px (webbens SPRITE_W x SPRITE_H). */',
        `export const MOLN_BILD = { bredd: ${bakat.bredd}, höjd: ${bakat.höjd} } as const;`,
        '/**',
        ' * Formerna i webbens ordning, utan speglingarna. `uppifrån` = sedd uppifrån',
        ' * (bara de växer fortare än kartan vid zoom), `ankareY` = var i bilden',
        ' * molnet har sin mitt, som andel av höjden.',
        ' */',
        'export const MOLN_FORMER: readonly { uppifrån: boolean; ankareY: number }[] = [',
        ...bakat.former.map(f => `    { uppifrån: ${f.uppifrån}, ankareY: ${f.ankareY} },`),
        '];',
        '',
    ].join('\n'));
    console.log(`${bakat.former.length} molnformer + ${bakat.former.length} skuggor bakade (${bakat.bredd}x${bakat.höjd} px)`);
} finally {
    await browser.close();
}
