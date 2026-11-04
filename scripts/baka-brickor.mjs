/**
 * Bakar kartans brick-PNG:er med WEBBENS EGEN ritkod (makeBrickaImageData i
 * huvudrepots apps/web/src/components/v2/v2MapBricka.ts) i en headless Chrome,
 * så appens brickor är pixelidentiska med webbens. MapLibre RN kan inte rita
 * färg-emoji som text, därför förbakas allt (se src/lib/brickor.ts).
 *
 * Varianter per kategori: vanlig, pop (tjockare vit kant), vald (vit ram),
 * sparad (vit kropp), sparad+vald, guld (Ticketmaster, utan ⭐), guld+vald,
 * stjarna (guld MED ⭐-badge: boostade och stjärnmärkta event, webbens
 * starred - Josef 4/11: "på appen ser jag inte guldstjärna på
 * eventmarkören"), stjarna+vald.
 *
 * "+N"-badgen bakas som EGNA bilder (antal-2 … antal-99, antal-99plus): vit
 * pill + siffra i EN bild, med webbens mått (COUNT_BADGE_D, 900 13px). Webben
 * bakar in siffran i brick-bilden; här skulle det bli kategori × variant ×
 * antal (tusentals PNG:er). Med cirkel och siffra i samma bild kan en
 * grannbadges siffra aldrig hamna ovanpå en annan badges cirkel - det var
 * felet med det gamla cirkel- + textlagret, där alla siffror ritades sist.
 *
 * EVENTETS EGEN EMOJI (Josef 1/11: markören visade ⚽ men kortet 🤿): webbens
 * markör ritar eventets fria emoji, inte kategorins. Alla kombinationer
 * emoji × kategori × variant går inte att förbaka, så appen sätter ihop dem
 * själv (lib/emojiBricka): en KROPP utan emoji (kropp-<kategori>[-variant],
 * samma ritkod med tom emoji) plus EMOJIN för sig (emoji/<id>.png, beskuren,
 * med sin position i brickans ruta). Webben ritar emojin sist och utan skugga,
 * så kropp + emoji ovanpå blir samma bild som webbens. Emoji-lagret ritas med
 * webbens egen ritkod med fill/stroke avstängda, så positionen (inklusive
 * VS16-korrigeringen) är exakt webbens.
 *
 * Emojierna som bakas: kategoriernas, alla som finns i appflödena just nu
 * (hämtas från vadkul.se) och alla som bakats förut (scripts/brick-
 * emojier.json - listan krymper aldrig). En emoji som saknas visar
 * kategorins bricka tills nästa bakning.
 *
 * Kör från vadkul-app/ när webbens ritkod eller kategorifärgerna ändrats, och
 * då och då så nya emojier från flödet kommer med:
 *   node scripts/baka-brickor.mjs
 * Kräver huvudrepots node_modules (esbuild + puppeteer) - appen ligger i
 * huvudrepots mapp och läser dem därifrån.
 */
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
    // Boostade/stjärnmärkta: webbens starred = guldkropp + ⭐ vid axeln.
    stjarna: { selected: false, saved: false, gold: false, pop: false, starred: true },
    'stjarna-vald': { selected: true, saved: false, gold: false, pop: false, starred: true },
    // Egna VADKUL-event: smaragdgrön kropp oavsett kategori (webbens brickaBodyHex).
    gron: { selected: false, saved: false, gold: false, pop: false, grön: true },
    'gron-vald': { selected: true, saved: false, gold: false, pop: false, grön: true },
};

// Emojins id = kodpunkterna utan VS16 (U+FE0F), hex med bindestreck - SAMMA
// regel som appens lib/emojiBricka.emojiId (testet där jämför dem).
const emojiId = (e) => Array.from(e).map(c => c.codePointAt(0)).filter(cp => cp !== 0xfe0f).map(cp => cp.toString(16)).join('-');
const listfil = join(här, 'brick-emojier.json');
const emojier = new Map(); // id → emojin som ritas (helst med VS16)
const läggTill = (e) => {
    if (typeof e !== 'string' || !e.trim()) return;
    const id = emojiId(e);
    const förra = emojier.get(id);
    if (!förra || (e.includes('️') && !förra.includes('️'))) emojier.set(id, e);
};
if (existsSync(listfil)) for (const e of JSON.parse(readFileSync(listfil, 'utf8'))) läggTill(e);
// Kategoriernas egna (lib/kategorier) - ett event i "other" kan ha ⚽.
for (const m of readFileSync(join(appRot, 'src/lib/kategorier.ts'), 'utf8').matchAll(/emoji: '([^']+)'/g)) läggTill(m[1]);
const regioner = [...new Set([...readFileSync(join(appRot, 'kontrakt/cities.ts'), 'utf8').matchAll(/region: '([a-z-]+)'/g)].map(m => m[1]))];
const flöden = await Promise.all(regioner.map(async (r) => {
    const svar = await fetch(`https://vadkul.se/api/events/app-${r}`);
    if (!svar.ok) throw new Error(`app-${r}: HTTP ${svar.status}`);
    return (await svar.json()).events ?? [];
}));
for (const lista of flöden) for (const ev of lista) läggTill(ev.emoji);

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
                const res = makeBrickaImageData(def.emoji, v.grön ? USER_EVENT_HEX : def.markerHex, v.selected, v.saved, false, !!v.starred, 0, v.gold, v.pop);
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

    // ── Delarna till eventets egen emoji (lib/emojiBricka) ─────────────────
    const delar = await page.evaluate((varianter, par) => {
        const { makeBrickaImageData, EVENT_CATEGORIES, USER_EVENT_HEX } = window.__baka;
        const tillUrl = (data) => {
            const c = document.createElement('canvas');
            c.width = data.width;
            c.height = data.height;
            c.getContext('2d').putImageData(data, 0, 0);
            return c.toDataURL('image/png');
        };
        // Kropparna: samma anrop som brickorna ovan, med tom emoji.
        const kroppar = {};
        for (const [cat, def] of Object.entries(EVENT_CATEGORIES)) {
            for (const [namn, v] of Object.entries(varianter)) {
                const res = makeBrickaImageData('', v.grön ? USER_EVENT_HEX : def.markerHex, v.selected, v.saved, false, !!v.starred, 0, v.gold, v.pop);
                kroppar[namn ? `kropp-${cat}-${namn}` : `kropp-${cat}`] = tillUrl(res.data);
            }
        }
        // Emoji-lagret: webbens ritkod med kroppen avstängd, så bara emojins
        // fillText ritar - på exakt webbens plats. Beskärs till glyfen.
        const proto = CanvasRenderingContext2D.prototype;
        const { fill, stroke } = proto;
        proto.fill = function () {};
        proto.stroke = function () {};
        const emojier = {};
        let ruta = null;
        try {
            for (const [id, emoji] of par) {
                const { data } = makeBrickaImageData(emoji, '#000000', false, false, false, false, 0, false, false);
                ruta = [data.width, data.height];
                const a = data.data;
                let x0 = data.width, y0 = data.height, x1 = -1, y1 = -1;
                for (let y = 0; y < data.height; y++) {
                    for (let x = 0; x < data.width; x++) {
                        if (a[(y * data.width + x) * 4 + 3] === 0) continue;
                        if (x < x0) x0 = x;
                        if (x > x1) x1 = x;
                        if (y < y0) y0 = y;
                        if (y > y1) y1 = y;
                    }
                }
                if (x1 < 0) continue; // glyfen saknas - kategorins bricka får gälla
                const c = document.createElement('canvas');
                c.width = x1 - x0 + 1;
                c.height = y1 - y0 + 1;
                c.getContext('2d').putImageData(data, -x0, -y0);
                emojier[id] = { emoji, x: x0, y: y0, url: c.toDataURL('image/png') };
            }
        } finally {
            proto.fill = fill;
            proto.stroke = stroke;
        }
        return { kroppar, emojier, ruta };
    }, VARIANTER, [...emojier.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)));

    const emojiMapp = join(mapp, 'emoji');
    mkdirSync(emojiMapp, { recursive: true });
    const hash = createHash('sha1');
    const kroppNamn = Object.keys(delar.kroppar).sort();
    for (const n of kroppNamn) {
        const png = Buffer.from(delar.kroppar[n].split(',')[1], 'base64');
        writeFileSync(join(mapp, `${n}.png`), png);
        hash.update(n).update(png);
    }
    const emojiIds = Object.keys(delar.emojier).sort();
    for (const id of emojiIds) {
        const { x, y, url } = delar.emojier[id];
        const png = Buffer.from(url.split(',')[1], 'base64');
        writeFileSync(join(emojiMapp, `${id}.png`), png);
        hash.update(`${id}:${x},${y}`).update(png);
    }
    writeFileSync(listfil, JSON.stringify(emojiIds.map(id => delar.emojier[id].emoji), null, 1) + '\n');
    writeFileSync(join(appRot, 'src/lib/emojiBilder.generated.ts'), [
        '// GENERERAD av scripts/baka-brickor.mjs - redigera inte för hand.',
        "import type { ImageRequireSource } from 'react-native';",
        '',
        '/** Brickornas kroppar utan emoji (lib/emojiBricka sätter ihop dem). */',
        'export const KROPP_KÄLLOR: Record<string, ImageRequireSource> = {',
        ...kroppNamn.map(n => `    '${n}': require('../../assets/brickor/${n}.png'),`),
        '};',
        '',
        '/** Emojierna för sig, beskurna - läget står i emojiNycklar.generated. */',
        'export const EMOJI_KÄLLOR: Record<string, ImageRequireSource> = {',
        ...emojiIds.map(id => `    '${id}': require('../../assets/brickor/emoji/${id}.png'),`),
        '};',
        '',
    ].join('\n'));
    // Utan require, så vitest kan läsa lägena och kropparnas namn.
    const lägen = Object.fromEntries(emojiIds.map(id => [id, { e: delar.emojier[id].emoji, x: delar.emojier[id].x, y: delar.emojier[id].y }]));
    writeFileSync(join(appRot, 'src/lib/emojiNycklar.generated.ts'), [
        '// GENERERAD av scripts/baka-brickor.mjs - redigera inte för hand.',
        '/** Brickans ruta i px (DPR 2,5) - kroppar och brickor har samma. */',
        `export const BRICK_RUTA = { bredd: ${delar.ruta[0]}, höjd: ${delar.ruta[1]} } as const;`,
        '/** Ändras när någon kropp eller emoji bakats om - appens diskcache byter mapp. */',
        `export const BAKNING = '${hash.digest('hex').slice(0, 10)}';`,
        `export const KROPP_NYCKLAR: readonly string[] = ${JSON.stringify(kroppNamn, null, 4).replace(/"/g, "'")};`,
        '/** Emojins id → tecknet och övre vänstra hörnet i brickans ruta. */',
        `export const EMOJI_LÄGE: Record<string, { e: string; x: number; y: number }> = ${JSON.stringify(lägen, null, 4)};`,
        '',
    ].join('\n'));
    console.log(`${kroppNamn.length} kroppar + ${emojiIds.length} emojier bakade (av ${emojier.size} kända)`);
} finally {
    await browser.close();
}
