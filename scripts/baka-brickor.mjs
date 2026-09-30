/**
 * Bakar kartans brick-PNG:er med WEBBENS EGEN ritkod (makeBrickaImageData i
 * huvudrepots apps/web/src/components/v2/v2MapBricka.ts) i en headless Chrome,
 * så appens brickor är pixelidentiska med webbens. MapLibre RN kan inte rita
 * färg-emoji som text, därför förbakas allt (se src/lib/brickor.ts).
 *
 * Varianter per kategori: vanlig, pop (tjockare vit kant), vald (vit ram),
 * sparad (vit kropp), sparad+vald, guld (Ticketmaster), guld+vald.
 *
 * Kör från vadkul-app/ när webbens ritkod eller kategorifärgerna ändrats:
 *   node scripts/baka-brickor.mjs
 * Kräver huvudrepots node_modules (esbuild + puppeteer) - appen ligger i
 * huvudrepots mapp och läser dem därifrån.
 */
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
            import { makeBrickaImageData } from './components/v2/v2MapBricka';
            import { EVENT_CATEGORIES } from './utils/categories';
            window.__baka = { makeBrickaImageData, EVENT_CATEGORIES };
        `,
        resolveDir: join(huvudRot, 'apps/web/src'),
        loader: 'ts',
    },
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    loader: { '.png': 'empty', '.svg': 'empty', '.jpg': 'empty' },
    nodePaths: [join(huvudRot, 'node_modules')],
});

const VARIANTER = {
    '': { selected: false, saved: false, gold: false, pop: false },
    pop: { selected: false, saved: false, gold: false, pop: true },
    vald: { selected: true, saved: false, gold: false, pop: false },
    sparad: { selected: false, saved: true, gold: false, pop: false },
    'sparad-vald': { selected: true, saved: true, gold: false, pop: false },
    guld: { selected: false, saved: false, gold: true, pop: false },
    'guld-vald': { selected: true, saved: false, gold: true, pop: false },
};

const browser = await puppeteer.launch({ headless: true });
try {
    const page = await browser.newPage();
    await page.setContent('<!doctype html><meta charset="utf-8"><body></body>');
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    const bilder = await page.evaluate((varianter) => {
        const { makeBrickaImageData, EVENT_CATEGORIES } = window.__baka;
        const ut = {};
        for (const [cat, def] of Object.entries(EVENT_CATEGORIES)) {
            for (const [namn, v] of Object.entries(varianter)) {
                // makeBrickaImageData(emoji, bodyColor, selected, saved, wish, starred, count, gold, pop)
                const res = makeBrickaImageData(def.emoji, def.markerHex, v.selected, v.saved, false, false, 0, v.gold, v.pop);
                const c = document.createElement('canvas');
                c.width = res.data.width;
                c.height = res.data.height;
                c.getContext('2d').putImageData(res.data, 0, 0);
                ut[namn ? `bricka-${cat}-${namn}` : `bricka-${cat}`] = c.toDataURL('image/png');
            }
        }
        return ut;
    }, VARIANTER);

    const mapp = join(appRot, 'assets/brickor');
    mkdirSync(mapp, { recursive: true });
    for (const [namn, url] of Object.entries(bilder)) {
        writeFileSync(join(mapp, `${namn}.png`), Buffer.from(url.split(',')[1], 'base64'));
    }
    // Metro kräver statiska require() - registret genereras här i stället för
    // att skrivas för hand (77 rader som annars glider isär från PNG:erna).
    const namn = Object.keys(bilder).sort();
    const rader = namn.map(n => `    '${n}': require('../../assets/brickor/${n}.png'),`);
    writeFileSync(join(appRot, 'src/lib/brickBilder.generated.ts'), [
        '// GENERERAD av scripts/baka-brickor.mjs - redigera inte för hand.',
        "import type { ImageRequireSource } from 'react-native';",
        '',
        'export const BRICKA_IMAGES: Record<string, ImageRequireSource> = {',
        ...rader,
        '};',
        '',
    ].join('\n'));
    // Nyckellistan separat (utan require) så vitest kan kolla att varje
    // variant brickaIkon kan ge faktiskt finns bakad.
    writeFileSync(join(appRot, 'src/lib/brickNycklar.generated.ts'), [
        '// GENERERAD av scripts/baka-brickor.mjs - redigera inte för hand.',
        `export const BRICKA_NYCKLAR: readonly string[] = ${JSON.stringify(namn, null, 4).replace(/"/g, "'")};`,
        '',
    ].join('\n'));
    console.log(`${namn.length} brickor bakade till assets/brickor/ + src/lib/brickBilder.generated.ts`);
} finally {
    await browser.close();
}
