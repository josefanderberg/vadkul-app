/**
 * Jämför appens molnlager med webbens, bild för bild (josefanderberg/VADKUL#233,
 * Josef 15/11: "molnen ska ut på apparna och se och fungera likadant").
 * Appen verifieras utan simulator, så det här är sättet att SE att molnen är
 * webbens: kör det när lib/moln, lib/molnMotor, components/KartMoln eller
 * webbens v2MapClouds/eventClouds ändrats.
 *
 *  - Webben: den riktiga attachEventClouds (huvudrepots apps/web v2MapClouds)
 *    på en riktig MapLibre GL-karta med tom stil, i headless Chrome.
 *  - Appen: den riktiga MolnMotor (src/lib/molnMotor + moln) matad med samma
 *    kamerahändelser, utlagd som DOM med exakt de stilar KartMoln ger sina
 *    vyer (CSS-transformer har samma ordning och ursprung som React Natives)
 *    och de bakade PNG:erna ur assets/moln.
 *
 * Båda går på samma låtsasklocka, så varje bildruta är samma ögonblick. Skriptet
 * spelar upp start, tryck, valt event, zoom över nivåbyten, panorering, vriden
 * och lutad karta, och mäter per bild hur många bildpunkter som skiljer. Det
 * mäter också ritningstakten (vilotakten ska vara ~12 per sekund på båda), hur
 * många bildvyer appen behöver och att appens egen projektion ger samma
 * skärmlägen som MapLibres.
 *
 * Det som INTE mäts här: hur fort telefonen hinner lägga ut vyerna, och hur
 * långt molnen släpar efter kartan (kartan -> JS -> vyerna är minst en bildruta).
 *
 * Kör från vadkul-app/:
 *   node scripts/jamfor-moln.mjs [mapp för bilderna]
 * Varje jämförelse sparas som webb | app | skillnad. Slutar med felkod om
 * någon bild skiljer mer än gränserna nedan. Kräver huvudrepots node_modules
 * (esbuild, puppeteer, sharp, maplibre-gl), som baka-moln. Lägg aldrig till ett
 * npm-script för det: `scripts` i package.json ingår i OTA-avtrycket.
 */
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { Buffer } from 'node:buffer';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const här = dirname(fileURLToPath(import.meta.url));
const appRot = resolve(här, '..');
const huvudRot = resolve(appRot, '..');
const utMapp = resolve(process.argv[2] ?? join(tmpdir(), 'vadkul-moln-jamforelse'));
mkdirSync(utMapp, { recursive: true });
const req = createRequire(join(huvudRot, 'package.json'));
const esbuild = req('esbuild');
const puppeteer = req('puppeteer');
const sharp = req('sharp');

const B = 390;
const H = 844;
const DPR = 2;
const BAKGRUND = '#86b38f';
/** Så mycket får en bild skilja: andel bildpunkter (%) där någon färgkanal
 *  skiljer mer än 8 respektive 24 av 255. Skarpa kanter som ligger en kvarts
 *  pt olika ger några tiondels procent; ett moln för mycket eller för lite
 *  ger flera procent. */
const GRÄNS_ÖVER_8 = 2;
const GRÄNS_ÖVER_24 = 0.5;

const bunta = async (contents, resolveDir, alias) => (await esbuild.build({
    stdin: { contents, resolveDir, loader: 'ts' },
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    alias,
    loader: { '.png': 'empty', '.svg': 'empty', '.jpg': 'empty' },
    nodePaths: [join(huvudRot, 'node_modules')],
})).outputFiles[0].text;

const webbBunt = await bunta(
    `import { attachEventClouds } from './components/v2/v2MapClouds';
     window.__webb = { attachEventClouds };`,
    join(huvudRot, 'apps/web/src'),
    { '@': join(huvudRot, 'apps/web/src'), '@vadkul/kontrakt': join(huvudRot, 'packages/kontrakt/src/index.ts') },
);
const appBunt = await bunta(
    `import { MolnMotor, tomBild } from './lib/molnMotor';
     import { platsBehov, projicera, avprojicera } from './lib/moln';
     window.__app = { MolnMotor, tomBild, platsBehov, projicera, avprojicera };`,
    join(appRot, 'src'),
    { '@': join(appRot, 'src'), '@vadkul/kontrakt': join(appRot, 'kontrakt/index.ts') },
);

const png = n => `data:image/png;base64,${readFileSync(join(appRot, 'assets/moln', n)).toString('base64')}`;
const molnBilder = Array.from({ length: 8 }, (_, i) => png(`moln-${i}.png`));
const skuggBilder = Array.from({ length: 8 }, (_, i) => png(`skugga-${i}.png`));

const mlMapp = join(huvudRot, 'apps/web/node_modules/maplibre-gl/dist');
const SIDA = `<!doctype html><meta charset="utf-8">
        <body style="margin:0;background:#222">
        <div id="web" style="position:absolute;left:0;top:0;width:${B}px;height:${H}px;background:${BAKGRUND};overflow:hidden"></div>
        <div id="app" style="position:absolute;left:${B + 10}px;top:0;width:${B}px;height:${H}px;background:${BAKGRUND};overflow:hidden">
          <div id="beh" style="position:absolute;left:0;top:0;right:0;bottom:0">
            <div id="skuggor" style="position:absolute;left:0;top:0;right:0;bottom:0"></div>
            <div id="moln" style="position:absolute;left:0;top:0;right:0;bottom:0"></div>
          </div>
        </div></body>`;
const server = createServer((fråga, svar) => {
    if (fråga.url === '/') {
        svar.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        svar.end(SIDA);
        return;
    }
    const m = /^\/ml\/([\w.-]+)$/.exec(fråga.url ?? '');
    try {
        if (!m) throw new Error('okänd');
        const data = readFileSync(join(mlMapp, m[1]));
        svar.writeHead(200, { 'content-type': m[1].endsWith('.css') ? 'text/css' : 'text/javascript' });
        svar.end(data);
    } catch {
        svar.writeHead(404);
        svar.end();
    }
});
await new Promise(klar => server.listen(0, '127.0.0.1', klar));
const port = server.address().port;

const browser = await puppeteer.launch({
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
});
const rapport = [];
try {
    const page = await browser.newPage();
    await page.setViewport({ width: B * 2 + 10, height: H, deviceScaleFactor: DPR });
    page.on('console', m => { if (m.type() === 'error') console.log('[sidan]', m.text()); });
    page.on('pageerror', e => console.log('[sidfel]', e.message));
    await page.goto(`http://127.0.0.1:${port}/`);

    // Låtsasklockan: allt i sidan (MapLibre, webbens slinga, appens motor) går på den.
    await page.evaluate(() => {
        window.__T = 500000;
        const kö = new Map();
        let id = 0;
        performance.now = () => window.__T;
        window.requestAnimationFrame = fn => { kö.set(++id, fn); return id; };
        window.cancelAnimationFrame = h => { kö.delete(h); };
        const timrar = new Map();
        let tid = 0;
        window.__klocka = {
            nu: () => window.__T,
            nästaBildruta: fn => window.requestAnimationFrame(fn),
            avbrytBildruta: h => window.cancelAnimationFrame(h),
            senare: (fn, ms) => { timrar.set(++tid, { fn, vid: window.__T + ms }); return tid; },
            avbrytSenare: h => { timrar.delete(h); },
        };
        window.__steg = (ms = 1000 / 60) => {
            window.__T += ms;
            for (const [h, t] of [...timrar]) {
                if (t.vid <= window.__T) { timrar.delete(h); t.fn(); }
            }
            const fns = [...kö.values()];
            kö.clear();
            for (const f of fns) f(window.__T);
        };
        // Räkna webbens ritningar: varje draw börjar med clearRect på molncanvasen.
        window.__webbRitningar = 0;
        const clearRect = CanvasRenderingContext2D.prototype.clearRect;
        CanvasRenderingContext2D.prototype.clearRect = function (...a) {
            if (this.canvas.className === 'vadkul-event-clouds') window.__webbRitningar++;
            return clearRect.apply(this, a);
        };
    });
    await page.addScriptTag({ type: 'module', content: "import * as ml from '/ml/maplibre-gl.mjs'; window.maplibregl = ml; window.__mlKlar = true;" });
    await page.waitForFunction(() => window.__mlKlar === true, { timeout: 20000, polling: 50 });
    await page.addScriptTag({ content: webbBunt });
    await page.addScriptTag({ content: appBunt });

    const start = { center: [14.806, 56.879], zoom: 8.6 };
    // POOL=moln,skuggor provar ett annat antal bildvyer än lib/moln.platsBehov ger.
    const pool = process.env.POOL ? process.env.POOL.split(',').map(Number) : null;
    const ok = await page.evaluate((start, B, H, molnBilder, skuggBilder, pool) => {
        // Event i klungor kring några orter - resten av landet är glest.
        let frö = 12345;
        const slump = () => { frö = (Math.imul(frö, 1664525) + 1013904223) >>> 0; return frö / 4294967296; };
        const orter = [
            [56.879, 14.806, 40], [56.899, 14.556, 5], [56.833, 13.941, 8], [56.552, 14.137, 6],
            [56.663, 16.356, 30], [56.161, 15.586, 20], [57.782, 14.161, 40], [57.186, 14.04, 10],
            [56.744, 15.907, 5], [56.525, 14.979, 3], [55.605, 13.0, 60], [57.708, 11.974, 80],
            [59.329, 18.068, 120], [58.41, 15.621, 30], [56.047, 12.694, 25],
        ];
        const punkter = [];
        for (const [lat, lng, n] of orter) {
            for (let i = 0; i < n; i++) punkter.push({ lat: lat + (slump() - 0.5) * 0.08, lng: lng + (slump() - 0.5) * 0.14 });
        }
        let map;
        try {
            map = new window.maplibregl.Map({
                container: 'web',
                style: { version: 8, sources: {}, layers: [] },
                center: start.center,
                zoom: start.zoom,
                interactive: false,
                attributionControl: false,
                fadeDuration: 0,
            });
        } catch (e) {
            return { fel: String(e) };
        }
        const webb = window.__webb.attachEventClouds(map);
        webb.setPoints(punkter);

        const { MolnMotor, platsBehov } = window.__app;
        const behov = pool ? { moln: pool[0], skuggor: pool[1] } : platsBehov(B, H);
        let bild = null;
        window.__appVisningar = 0;
        window.__appUtläggningar = 0;
        const motor = new MolnMotor({
            visa: b => {
                window.__appVisningar++;
                if (!bild || bild.moln !== b.moln || bild.skuggor !== b.skuggor) window.__appUtläggningar++;
                bild = b;
            },
        }, behov, window.__klocka);
        motor.sättStorlek(B, H);
        motor.sättPunkter(punkter);
        window.__behov = { moln: 0, skuggor: 0 };
        const räkna = vyer => { let n = 0; for (const d of vyer) if (d.a > 0) n++; return n; };
        const sond = new MolnMotor({
            visa: b => {
                window.__behov.moln = Math.max(window.__behov.moln, räkna(b.moln));
                window.__behov.skuggor = Math.max(window.__behov.skuggor, räkna(b.skuggor));
            },
        }, { moln: 1500, skuggor: 1500 }, window.__klocka);
        sond.sättStorlek(B, H);
        sond.sättPunkter(punkter);
        const vy = () => {
            const c = map.getCenter();
            return { center: [c.lng, c.lat], zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() };
        };
        // Appens karta: onRegionIsChanging under rörelse, onRegionDidChange när den stannat.
        map.on('move', () => { motor.rörelse(vy()); sond.rörelse(vy()); });
        map.on('moveend', () => { motor.stannat(vy()); sond.stannat(vy()); });
        motor.stannat(vy());
        sond.stannat(vy());

        const gör = (lager, antal) => {
            const els = [];
            for (let i = 0; i < antal; i++) {
                const el = document.createElement('img');
                el.style.cssText = 'position:absolute;left:0;top:0;width:256px;height:168px;opacity:0';
                lager.appendChild(el);
                els.push(el);
            }
            return els;
        };
        const molnEls = gör(document.getElementById('moln'), behov.moln);
        const skuggEls = gör(document.getElementById('skuggor'), behov.skuggor);
        const beh = document.getElementById('beh');
        window.__ritaApp = async () => {
            if (!bild) return;
            beh.style.transform = `translateX(${bild.tx}px) translateY(${bild.ty}px) scale(${bild.skala})`;
            const väntar = [];
            const lägg = (els, vyer, källor) => {
                for (let i = 0; i < vyer.length; i++) {
                    const d = vyer[i];
                    const el = els[i];
                    if (el.__d === d) continue;
                    el.__d = d;
                    if (el.__form !== d.bild >> 1) {
                        el.__form = d.bild >> 1;
                        el.src = källor[d.bild >> 1];
                        väntar.push(el.decode().catch(() => {}));
                    }
                    el.style.opacity = String(d.a);
                    el.style.transform = `translateX(${d.x}px) translateY(${d.y}px) scale(${d.s}) scaleX(${d.bild % 2 === 1 ? -1 : 1})`;
                }
            };
            lägg(skuggEls, bild.skuggor, skuggBilder);
            lägg(molnEls, bild.moln, molnBilder);
            await Promise.all(väntar);
        };
        window.__s = { map, webb, motor, sond, vy, behov, bildNu: () => bild };
        return { behov, antalPunkter: punkter.length, webgl: true };
    }, start, B, H, molnBilder, skuggBilder, pool);
    if (ok.fel) throw new Error(`Kartan gick inte att skapa: ${ok.fel}`);
    console.log('start', JSON.stringify(ok));

    const steg = (n = 1, ms = 1000 / 60) => page.evaluate((n, ms) => { for (let i = 0; i < n; i++) window.__steg(ms); }, n, ms);

    const jämför = async namn => {
        await page.evaluate(() => window.__ritaApp());
        const skärm = await page.screenshot({ type: 'png' });
        const bw = B * DPR;
        const bh = H * DPR;
        const [a, b] = await Promise.all([
            sharp(skärm).extract({ left: 0, top: 0, width: bw, height: bh }).removeAlpha().raw().toBuffer(),
            sharp(skärm).extract({ left: (B + 10) * DPR, top: 0, width: bw, height: bh }).removeAlpha().raw().toBuffer(),
        ]);
        let summa = 0;
        let max = 0;
        let över8 = 0;
        let över24 = 0;
        const diff = Buffer.alloc(a.length);
        for (let i = 0; i < a.length; i += 3) {
            let d = 0;
            for (let k = 0; k < 3; k++) {
                const dk = Math.abs(a[i + k] - b[i + k]);
                summa += dk;
                if (dk > d) d = dk;
            }
            if (d > max) max = d;
            if (d > 8) över8++;
            if (d > 24) över24++;
            const v = Math.min(255, d * 6);
            diff[i] = v; diff[i + 1] = v; diff[i + 2] = v;
        }
        const px = a.length / 3;
        const rad = {
            namn,
            medel: +(summa / a.length).toFixed(3),
            max,
            'över8%': +((över8 / px) * 100).toFixed(2),
            'över24%': +((över24 / px) * 100).toFixed(2),
        };
        rapport.push(rad);
        console.log(JSON.stringify(rad));
        const diffPng = await sharp(diff, { raw: { width: bw, height: bh, channels: 3 } }).png().toBuffer();
        const bredvid = await sharp({ create: { width: (B * 3 + 20) * DPR, height: bh, channels: 3, background: '#222' } })
            .composite([
                { input: await sharp(skärm).extract({ left: 0, top: 0, width: (B * 2 + 10) * DPR, height: bh }).png().toBuffer(), left: 0, top: 0 },
                { input: diffPng, left: (B * 2 + 20) * DPR, top: 0 },
            ])
            .png()
            .toBuffer();
        writeFileSync(join(utMapp, `${namn}.png`), await sharp(bredvid).resize({ width: 1190 }).png().toBuffer());
        return rad;
    };

    const mätTakt = async (namn, sek) => {
        const före = await page.evaluate(() => ({ w: window.__webbRitningar, v: window.__appVisningar, u: window.__appUtläggningar }));
        await steg(Math.round(sek * 60));
        const efter = await page.evaluate(() => ({ w: window.__webbRitningar, v: window.__appVisningar, u: window.__appUtläggningar }));
        const rad = {
            takt: namn,
            'webb ritningar/s': +((efter.w - före.w) / sek).toFixed(1),
            'app utläggningar/s': +((efter.u - före.u) / sek).toFixed(1),
            'app visningar/s': +((efter.v - före.v) / sek).toFixed(1),
        };
        rapport.push(rad);
        console.log(JSON.stringify(rad));
        return rad;
    };

    const behovHittills = async namn => {
        const b = await page.evaluate(() => { const b = { ...window.__behov }; window.__behov = { moln: 0, skuggor: 0 }; return b; });
        const rad = { behov: namn, ...b };
        rapport.push(rad);
        console.log(JSON.stringify(rad));
    };
    const projektionsfel = async namn => {
        const rad = await page.evaluate((namn, B, H) => {
            const { map } = window.__s;
            const c = map.getCenter();
            const k = { lng: c.lng, lat: c.lat, zoom: map.getZoom(), bäring: map.getBearing(), lutning: map.getPitch(), bredd: B, höjd: H };
            let max = 0;
            let maxBak = 0;
            let n = 0;
            for (let x = 0; x <= B; x += B / 6) {
                for (let y = H * 0.15; y <= H; y += H / 8) {
                    const p = map.unproject([x, y]);
                    const riktig = map.project([p.lng, p.lat]);
                    const egen = window.__app.projicera(k, p.lng, p.lat);
                    if (!egen) continue;
                    max = Math.max(max, Math.hypot(egen.x - riktig.x, egen.y - riktig.y));
                    // Baklänges: hörnen med marginal, som vyn räknas ur.
                    const bak = window.__app.avprojicera(k, x, y);
                    const bakPt = map.project([bak.lng, bak.lat]);
                    maxBak = Math.max(maxBak, Math.hypot(bakPt.x - x, bakPt.y - y));
                    n++;
                }
            }
            return { projektion: namn, punkter: n, 'största fel pt': +max.toFixed(3), 'baklänges fel pt': +maxBak.toFixed(3) };
        }, namn, B, H);
        rapport.push(rad);
        console.log(JSON.stringify(rad));
    };
    const skärmTillPlats = (x, y) => page.evaluate((x, y) => { const p = window.__s.map.unproject([x, y]); return { lng: p.lng, lat: p.lat }; }, x, y);
    const rörTill = async (mål, ms, namn, varje = 12) => {
        await page.evaluate((mål, ms) => window.__s.map.easeTo({ ...mål, duration: ms, easing: t => t }), mål, ms);
        const rutor = Math.ceil(ms / (1000 / 60)) + 2;
        for (let i = 1; i <= rutor; i++) {
            await steg(1);
            if (namn && i % varje === 0 && i < rutor - 2) await jämför(`${namn}-under-${String(i).padStart(3, '0')}`);
        }
    };

    // A. Start: molnen tonar in och driver.
    await steg(150);
    await jämför('a-start');
    await mätTakt('vila utan knuffare', 5);
    await jämför('a-vila-5s');
    await projektionsfel('rak');
    await behovHittills('start och vila');

    // B. Tryck på kartan: molnen skingras där.
    const tryck = await skärmTillPlats(120, 300);
    await page.evaluate(p => { window.__s.webb.setTouchPoint(p); window.__s.motor.tryck(p); window.__s.sond.tryck(p); }, tryck);
    await steg(30); await jämför('b-tryck-0,5s');
    await steg(60); await jämför('b-tryck-1,5s');
    await steg(210); await jämför('b-tryck-5s');
    await mätTakt('efter tryck (5-15 s)', 10);

    // C. Valt event: molnen håller sig undan.
    const fokus = await skärmTillPlats(270, 560);
    await page.evaluate(p => { window.__s.webb.setFocus(p); window.__s.motor.sättFokus(p); window.__s.sond.sättFokus(p); }, fokus);
    await steg(30); await jämför('c-fokus-0,5s');
    await steg(60); await jämför('c-fokus-1,5s');
    await steg(210); await jämför('c-fokus-5s');
    await mätTakt('valt event (5-15 s)', 10);
    await mätTakt('valt event (15-45 s)', 30);
    await jämför('c-fokus-45s');
    await behovHittills('tryck och valt event');

    // D. Zooma in över ett nivåbyte.
    await rörTill({ zoom: 9.8 }, 1200, 'd-zoom-in');
    await jämför('d-zoom-in-stannat');
    await steg(60); await jämför('d-zoom-in-1s');
    await behovHittills('zoom in över nivåbyte');

    // E. Panorera.
    const mål = await skärmTillPlats(B / 2 + 260, H / 2 - 180);
    await rörTill({ center: [mål.lng, mål.lat] }, 800, 'e-panorera');
    await jämför('e-panorera-stannat');
    await steg(60); await jämför('e-panorera-1s');
    await behovHittills('panorering');

    // F. Zooma ut långt (flera nivåbyten).
    await page.evaluate(() => { window.__s.webb.setFocus(null); window.__s.motor.sättFokus(null); window.__s.sond.sättFokus(null); });
    await rörTill({ zoom: 6.4 }, 1500, 'f-zoom-ut', 5);
    await jämför('f-zoom-ut-stannat');
    await steg(90); await jämför('f-zoom-ut-1,5s');
    await mätTakt('vila utzoomat', 5);
    await behovHittills('zoom ut långt');

    // G. In tills molnen är borta och ut igen: allt står på sina platser.
    await rörTill({ zoom: 12.4 }, 1200, null);
    await steg(30);
    await rörTill({ zoom: 8.2 }, 1200, null);
    await steg(90); await jämför('g-in-och-ut');
    await behovHittills('in och ut');

    // H. Vriden och lutad karta.
    await rörTill({ bearing: 35 }, 600, null);
    await steg(90); await jämför('h-vriden-35');
    await projektionsfel('vriden 35');
    await rörTill({ pitch: 45 }, 600, null);
    await steg(90); await jämför('h-vriden-lutad-45');
    await projektionsfel('vriden 35, lutad 45');
    await behovHittills('vriden och lutad');
    await rörTill({ pitch: 60 }, 600, 'h-lutar-till-60', 10);
    await steg(90); await jämför('h-vriden-lutad-60');
    await projektionsfel('vriden 35, lutad 60');
    await rörTill({ bearing: 0, pitch: 0 }, 600, null);
    await steg(90); await jämför('h-tillbaka');
    await behovHittills('lutad 60 och tillbaka');

    // I. Appens startzoom (11) över en stad, och in tills molnen är borta.
    await rörTill({ center: [14.806, 56.879], zoom: 11 }, 1500, 'i-till-zoom-11', 20);
    await steg(90); await jämför('i-zoom-11');
    const tryck2 = await skärmTillPlats(200, 420);
    await page.evaluate(p => { window.__s.webb.setTouchPoint(p); window.__s.motor.tryck(p); window.__s.sond.tryck(p); }, tryck2);
    await steg(180); await jämför('i-zoom-11-tryck-3s');
    await mätTakt('zoom 11 efter tryck', 5);
    await rörTill({ zoom: 12.6 }, 800, null);
    await steg(60); await jämför('i-zoom-12,6-borta');
    await mätTakt('inzoomat förbi molnen', 5);
    await behovHittills('zoom 11 och in');
} finally {
    await browser.close();
    server.close();
}
writeFileSync(join(utMapp, 'rapport.json'), JSON.stringify(rapport, null, 2));

const bilder = rapport.filter(r => r.namn);
const sämst = bilder.filter(r => r['över8%'] > GRÄNS_ÖVER_8 || r['över24%'] > GRÄNS_ÖVER_24);
const projektioner = rapport.filter(r => r.projektion);
const felProjektion = projektioner.filter(r => r['största fel pt'] > 0.5 || r['baklänges fel pt'] > 0.5);
console.log(`\n${bilder.length} bilder jämförda, ${sämst.length} över gränsen. Bilderna ligger i ${utMapp}`);
for (const r of sämst) console.log(`  SKILJER: ${r.namn} (${r['över8%']} % över 8, ${r['över24%']} % över 24)`);
for (const r of felProjektion) console.log(`  PROJEKTIONEN SKILJER: ${r.projektion} (${r['största fel pt']} pt, baklänges ${r['baklänges fel pt']} pt)`);
if (sämst.length > 0 || felProjektion.length > 0) process.exit(1);
