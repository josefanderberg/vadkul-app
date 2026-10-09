/**
 * Bakar kartans brick-PNG:er med WEBBENS EGEN ritkod (makeBrickaImageData i
 * huvudrepots apps/web/src/components/v2/v2MapBricka.ts) i en headless Chrome,
 * så appens brickor är pixelidentiska med webbens. MapLibre RN kan inte rita
 * färg-emoji som text, därför förbakas allt (se src/lib/brickor.ts).
 *
 * Varianter per kategori: vanlig, pop (tjockare vit kant), vald (vit ram),
 * sparad (vit kropp), sparad+vald, guld (Ticketmaster), guld+vald.
 *
 * "+N"-badgen bakas som EGNA bilder (antal-2 … antal-99, antal-99plus): vit
 * pill + siffra i EN bild, med webbens mått (COUNT_BADGE_D, 900 13px). Webben
 * bakar in siffran i brick-bilden; här skulle det bli kategori × variant ×
 * antal (tusentals PNG:er). Med cirkel och siffra i samma bild kan en
 * grannbadges siffra aldrig hamna ovanpå en annan badges cirkel - det var
 * felet med det gamla cirkel- + textlagret, där alla siffror ritades sist.
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
            import { makeBrickaImageData, USER_EVENT_HEX, COUNT_BADGE_D } from './components/v2/v2MapBricka';
            import { EVENT_CATEGORIES } from './utils/categories';
            window.__baka = { makeBrickaImageData, EVENT_CATEGORIES, USER_EVENT_HEX, COUNT_BADGE_D };
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
    // Egna VADKUL-event: smaragdgrön kropp oavsett kategori (webbens brickaBodyHex).
    gron: { selected: false, saved: false, gold: false, pop: false, grön: true },
    'gron-vald': { selected: true, saved: false, gold: false, pop: false, grön: true },
};

const browser = await puppeteer.launch({ headless: true });
try {
    const page = await browser.newPage();
    await page.setContent('<!doctype html><meta charset="utf-8"><body></body>');
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    const bilder = await page.evaluate((varianter) => {
        const { makeBrickaImageData, EVENT_CATEGORIES, USER_EVENT_HEX } = window.__baka;
        const ut = {};
        for (const [cat, def] of Object.entries(EVENT_CATEGORIES)) {
            for (const [namn, v] of Object.entries(varianter)) {
                // makeBrickaImageData(emoji, bodyColor, selected, saved, wish, starred, count, gold, pop)
                const res = makeBrickaImageData(def.emoji, v.grön ? USER_EVENT_HEX : def.markerHex, v.selected, v.saved, false, false, 0, v.gold, v.pop);
                const c = document.createElement('canvas');
                c.width = res.data.width;
                c.height = res.data.height;
                c.getContext('2d').putImageData(res.data, 0, 0);
                ut[namn ? `bricka-${cat}-${namn}` : `bricka-${cat}`] = c.toDataURL('image/png');
            }
        }
        // Badgen: samma pill som makeBrickaImageData ritar i brickhörnet -
        // vit, min-bredd D, växer med sifferantalet, skugga, mörk siffra.
        // DPR 2,5 som brickorna, så samma BRICKA_ICON_SIZE gäller.
        const { COUNT_BADGE_D } = window.__baka;
        const DPR = 2.5;
        const pad = 3; // luft för skuggan
        for (let n = 2; n <= 100; n++) {
            const label = n > 99 ? '99+' : String(n);
            const mät = document.createElement('canvas').getContext('2d');
            mät.font = '900 13px system-ui,-apple-system,"Segoe UI",sans-serif';
            const D = COUNT_BADGE_D;
            const pillW = Math.max(D, mät.measureText(label).width + 8);
            const c = document.createElement('canvas');
            c.width = Math.ceil((pillW + pad * 2) * DPR);
            c.height = Math.ceil((D + pad * 2) * DPR);
            const ctx = c.getContext('2d');
            ctx.scale(DPR, DPR);
            const cx = c.width / DPR / 2;
            const cy = c.height / DPR / 2;
            ctx.beginPath();
            ctx.roundRect(cx - pillW / 2, cy - D / 2, pillW, D, [D / 2]);
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = 'rgba(0,0,0,0.35)';
            ctx.shadowBlur = 3;
            ctx.shadowOffsetY = 1;
            ctx.fill();
            ctx.shadowColor = 'transparent';
            ctx.font = '900 13px system-ui,-apple-system,"Segoe UI",sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#0f172a';
            ctx.fillText(label, cx, cy);
            ut[n > 99 ? 'antal-99plus' : `antal-${n}`] = c.toDataURL('image/png');
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
