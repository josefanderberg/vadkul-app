/**
 * Bakar kartans platsskyltar till PNG med WEBBENS EGEN ritkod (drawSignCanvas
 * i huvudrepots apps/web/src/components/v2/v2MapPoiSignImages.ts) i en
 * headless Chrome, så appens skyltar är samma bilder som webbens
 * (josefanderberg/VADKUL#234, Josef 14/11: apparna ska bli som webben, "med
 * moln och skyltar för badplats osv").
 *
 * Webben ritar skylten på en canvas första gången kartan ber om bilden; appen
 * har ingen canvas, så samma canvas sparas här som bild, en per skylt i
 * kontraktets POI_SIGN_KEYS. Bilden bakas i TÄTHET gånger webbens mått och
 * skyltlagret skalar ner lika mycket (lib/kartSkyltar SKYLT_SKALA), som
 * brickorna.
 *
 * Kör från vadkul-app/ när ett motiv, en färg eller ett mått ändrats på
 * webben, eller när kontraktet fått en ny skylt (lib/kartSkyltar.test faller
 * tills den är bakad):
 *   node scripts/baka-skyltar.mjs
 * Kräver huvudrepots node_modules (esbuild + puppeteer), som baka-brickor.
 * Lägg aldrig till ett npm-script för det: `scripts` i package.json ingår i
 * OTA-avtrycket.
 */
import { Buffer } from 'node:buffer';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Bildens pixeltäthet: telefonernas skärmar är 3x. */
const TÄTHET = 3;

const här = dirname(fileURLToPath(import.meta.url));
const appRot = resolve(här, '..');
const huvudRot = resolve(appRot, '..');
const req = createRequire(join(huvudRot, 'package.json'));
const esbuild = req('esbuild');
const puppeteer = req('puppeteer');

const bundle = await esbuild.build({
    stdin: {
        contents: `
            import { drawSignCanvas, POI_SIGN_IMAGE } from './components/v2/v2MapPoiSignImages';
            import { POI_SIGN_KEYS, poiSignImageId } from '@vadkul/kontrakt';
            window.__baka = { drawSignCanvas, POI_SIGN_IMAGE, POI_SIGN_KEYS, poiSignImageId };
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
    const bakat = await page.evaluate(täthet => {
        const b = window.__baka;
        return {
            bredd: b.POI_SIGN_IMAGE.width,
            höjd: b.POI_SIGN_IMAGE.height,
            skyltar: b.POI_SIGN_KEYS.map(nyckel => ({
                nyckel,
                bildId: b.poiSignImageId(nyckel),
                png: b.drawSignCanvas(nyckel, täthet).toDataURL('image/png'),
            })),
        };
    }, TÄTHET);

    const mapp = join(appRot, 'assets/skyltar');
    mkdirSync(mapp, { recursive: true });
    for (const s of bakat.skyltar) {
        writeFileSync(join(mapp, `${s.nyckel}.png`), Buffer.from(s.png.split(',')[1], 'base64'));
    }

    writeFileSync(join(appRot, 'src/lib/skyltBilder.generated.ts'), [
        '// GENERERAD av scripts/baka-skyltar.mjs - redigera inte för hand.',
        "import type { ImageRequireSource } from 'react-native';",
        '',
        '/** Skyltbilderna per bild-id (kontraktets poiSignImageId), till kartans Images. */',
        'export const SKYLT_BILDER: Readonly<Record<string, ImageRequireSource>> = {',
        ...bakat.skyltar.map(s => `    '${s.bildId}': require('../../assets/skyltar/${s.nyckel}.png'),`),
        '};',
        '',
    ].join('\n'));
    // Utan require, så vitest kan läsa måtten.
    writeFileSync(join(appRot, 'src/lib/skyltMatt.generated.ts'), [
        '// GENERERAD av scripts/baka-skyltar.mjs - redigera inte för hand.',
        '/**',
        ' * Skyltbildens mått i pt (webbens POI_SIGN_IMAGE) och pixeltätheten den är',
        ' * bakad i. Stolpens fot står mitt i nederkanten.',
        ' */',
        `export const SKYLT_BILD = { bredd: ${bakat.bredd}, höjd: ${bakat.höjd}, täthet: ${TÄTHET} } as const;`,
        '/** Skyltarna som är bakade, i kontraktets ordning. */',
        `export const BAKADE_SKYLTAR: readonly string[] = [${bakat.skyltar.map(s => `'${s.nyckel}'`).join(', ')}];`,
        '',
    ].join('\n'));
    console.log(`${bakat.skyltar.length} skyltar bakade (${bakat.bredd}x${bakat.höjd} pt, ${TÄTHET}x)`);
} finally {
    await browser.close();
}
