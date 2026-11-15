/**
 * Molnlagrets rörelse i appen (josefanderberg/VADKUL#233, Josef 14/11: "ta hela
 * moln designen. alltså den för webb. alltså exakt så likt som möjligt. det
 * måste finnas på apparna också") - webbens ritlager
 * apps/web/src/components/v2/v2MapClouds.ts utan canvas: samma uppsättningar,
 * samma toningar, samma knuff, drift och markskugga, bildruta för bildruta.
 * Ändras webbens ritlager ska den här filen följa.
 *
 * VAR molnen står och hur de beter sig räknas av SAMMA kod som webben
 * (@vadkul/kontrakt eventClouds). Här finns det som webben gör mot canvasen
 * och kartan:
 *  - kartans projektion (webben frågar map.project; appens karta svarar bara
 *    asynkront, så läget räknas ur kamerans mitt, zoom, bäring och lutning),
 *  - uppsättningarna och ombygget (webbens rebuild),
 *  - en bildruta (webbens draw): i stället för att rita ger den STÄMPLAR -
 *    vilken molnbild, var, hur stor och hur tät - som components/KartMoln
 *    lägger ut som bilder,
 *  - platserna (fördela): varje stämpel får en av lagrets färdiga bildvyer,
 *  - behållaren (behållareFör, läggIVyer): när kartan panoreras eller zoomas
 *    flyttas och skalas HELA lagret som en enda vy; de enskilda bildvyerna
 *    rörs bara när molnet självt ändras (drift, knuff, toning). Annars hade
 *    varje bildruta av en panorering fått flytta hundratals vyer var för sig.
 *
 * EN SKILLNAD MOT WEBBEN, och den är påtvingad: på webben ligger molnen
 * MELLAN kartan och brickorna (brickorna är DOM-element ovanpå). I appen är
 * brickorna kartans egna symboler, så ett lager ovanpå kartan hamnar även
 * ovanpå dem. Därför tunnas ett moln ut där en tänd bricka står under det
 * (`fria`, brickTunning) - brickan syns som på webben, fast genom en glugg i
 * stället för ovanpå molnet. Prickar och etiketter ligger under molnen på
 * båda.
 *
 * Ren modul: inga kart- eller React Native-API:er, så allt går att testa.
 */
import {
    buildClouds,
    cloudApproachFor,
    cloudLevelFor,
    cloudOpacityForZoom,
    cloudScaleFor,
    cloudShadow,
    cloudViewOf,
    glideStep,
    pushOffset,
    type Cloud,
    type CloudPoint,
    type CloudView,
} from '@vadkul/kontrakt';
import { MOLN_BILD, MOLN_FORMER } from './molnFormer.generated';

/** Webbens PUSH_TAU_MS: tidskonstant för uttunningen intill en knuffare. */
export const KNUFF_TAU_MS = 420;
/** Webbens SET_FADE_MS: två uppsättningar tonar över i varandra vid ett zoomsteg. */
export const SATS_TON_MS = 420;
/** Webbens IDLE_FRAME_MS: vilotakten, driften är så långsam att tätare ritning inte syns. */
export const VILO_RAM_MS = 80;
/** Webbens CULL_MARGIN_PX: molnen lever i vyn plus den här marginalen. */
export const GALLRA_PT = 220;
/** Webbens MOVE_REBUILD_MS: så ofta byggs molnen om under en kartrörelse. */
export const BYGG_OM_MS = 200;

/** Antal molnbilder: varje form finns även spegelvänd (webbens `sprites`). */
export const MOLN_BILDANTAL = MOLN_FORMER.length * 2;
const BILD_KVOT = MOLN_BILD.höjd / MOLN_BILD.bredd;
/** Stämplar helt utanför skärmen (plus den här kanten) får ingen bildvy. */
const SKÄRM_KANT_PT = 8;
/**
 * Kanten lagret lägger ut bildvyer inom (RamIndata.rand): molnen strax utanför
 * skärmen finns redan när behållaren panoreras, tills nästa bildruta lägger
 * ut på nytt.
 */
export const VY_RAND_PT = 48;

// ── Brickgluggen (bara appen, se huvudkommentaren) ──────────────────────────
/** Så mycket tunnas ett moln som mest ut över en tänd bricka. */
export const BRICK_TUNNING_MAX = 0.85;
/** Brickans mitt ligger så här långt ovanför spetsen (koordinaten), i pt. */
const BRICK_MITT_DY = -30;
/** Brickans halva bredd och höjd i pt, med lite luft. */
const BRICK_HALV_B = 22;
const BRICK_HALV_H = 30;

/**
 * Hur mycket ett moln tunnas ut av en tänd bricka: fullt när brickan står i
 * molnets täta mitt, ingenting när den bara nuddar den tunna kanten. `dx`/`dy`
 * är från molnbildens mitt till brickans mitt, `r` molnets halva bredd.
 */
export function brickTunning(dx: number, dy: number, r: number): number {
    const e = Math.hypot(dx / (0.8 * r + BRICK_HALV_B), dy / (0.5 * r + BRICK_HALV_H));
    if (e >= 1) return 0;
    const t = Math.min(1, (1 - e) / 0.5);
    return BRICK_TUNNING_MAX * t * t * (3 - 2 * t);
}

// ── Projektionen ────────────────────────────────────────────────────────────

/** Kartans kamera och vyns storlek i pt. */
export interface MolnKamera {
    lng: number;
    lat: number;
    zoom: number;
    /** Grader medurs (MapLibres bearing). */
    bäring: number;
    /** Grader (MapLibres pitch). */
    lutning: number;
    bredd: number;
    höjd: number;
    /**
     * Var på skärmen kamerans mitt ligger, i pt. Utelämnad = vyns mitt. Den
     * native kartan kan lägga mitten vid sidan av vyns mitt (iOS räknar bort
     * statusraden och hemstrecket), så kartskärmen mäter upp den.
     */
    mittX?: number;
    mittY?: number;
}

/** MapLibres synfält (radianer) - avgör perspektivet när kartan lutas. */
const SYNFÄLT = 0.6435011087932844;

export function mercatorX(lng: number): number {
    return (lng + 180) / 360;
}

export function mercatorY(lat: number): number {
    const s = Math.sin((Math.min(85, Math.max(-85, lat)) * Math.PI) / 180);
    return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
}

function latFrånMercatorY(y: number): number {
    return ((2 * Math.atan(Math.exp((0.5 - y) * 2 * Math.PI)) - Math.PI / 2) * 180) / Math.PI;
}

/** Kameran färdigräknad för en bildruta - projicerar utan trigonometri per moln. */
export interface Projektion {
    /** Världens bredd i pt vid kamerans zoom (512·2^zoom, som MapLibre). */
    värld: number;
    mx: number;
    my: number;
    cos: number;
    sin: number;
    cosLut: number;
    sinLut: number;
    /** Kamerans avstånd till kartans mitt i pt. */
    avstånd: number;
    cx: number;
    cy: number;
}

export function projektionFör(k: MolnKamera): Projektion {
    const b = (k.bäring * Math.PI) / 180;
    const l = (Math.min(80, Math.max(0, k.lutning)) * Math.PI) / 180;
    return {
        värld: 512 * Math.pow(2, k.zoom),
        mx: mercatorX(k.lng),
        my: mercatorY(k.lat),
        cos: Math.cos(b),
        sin: Math.sin(b),
        cosLut: Math.cos(l),
        sinLut: Math.sin(l),
        avstånd: (0.5 * k.höjd) / Math.tan(SYNFÄLT / 2),
        cx: k.mittX ?? k.bredd / 2,
        cy: k.mittY ?? k.höjd / 2,
    };
}

export interface SkärmPunkt {
    x: number;
    y: number;
    /** Perspektivets förstoring (1 utan lutning). */
    skala: number;
}

/**
 * Skärmläget för en mercatorpunkt (0-1). Skriver i `ut` och svarar false när
 * punkten ligger bakom horisonten på en lutad karta.
 */
export function projiceraMerc(p: Projektion, mx: number, my: number, ut: SkärmPunkt): boolean {
    const dx = (mx - p.mx) * p.värld;
    const dy = (my - p.my) * p.värld;
    // Kartan vriden `bäring` grader: norr pekar åt bäringens håll.
    const rx = dx * p.cos + dy * p.sin;
    const ry = -dx * p.sin + dy * p.cos;
    if (p.sinLut === 0) {
        ut.x = p.cx + rx;
        ut.y = p.cy + ry;
        ut.skala = 1;
        return true;
    }
    // Lutad: det som ligger ovanför mitten är längre bort.
    const djup = p.avstånd - ry * p.sinLut;
    if (djup <= p.avstånd * 0.1) return false;
    const s = p.avstånd / djup;
    ut.x = p.cx + rx * s;
    ut.y = p.cy + ry * p.cosLut * s;
    ut.skala = s;
    return true;
}

/** Skärmläget för en plats, eller null bakom horisonten. */
export function projicera(k: MolnKamera, lng: number, lat: number): SkärmPunkt | null {
    const ut: SkärmPunkt = { x: 0, y: 0, skala: 1 };
    return projiceraMerc(projektionFör(k), mercatorX(lng), mercatorY(lat), ut) ? ut : null;
}

/**
 * Platsen under en skärmpunkt (kartans unproject): projiceraMerc baklänges,
 * även på en vriden och lutad karta. En punkt ovanför horisonten har ingen
 * plats på kartan - då är svaret NaN.
 */
export function avprojicera(k: MolnKamera, x: number, y: number): CloudPoint {
    const p = projektionFör(k);
    let rx = x - p.cx;
    let ry = y - p.cy;
    if (p.sinLut !== 0) {
        // Lutad: räkna tillbaka perspektivet.
        const nämnare = p.cosLut * p.avstånd + ry * p.sinLut;
        if (nämnare <= 0) return { lng: NaN, lat: NaN };
        ry = (ry * p.avstånd) / nämnare;
        rx = (rx * (p.avstånd - ry * p.sinLut)) / p.avstånd;
    }
    const dx = rx * p.cos - ry * p.sin;
    const dy = rx * p.sin + ry * p.cos;
    return {
        lng: (p.mx + dx / p.värld) * 360 - 180,
        lat: latFrånMercatorY(p.my + dy / p.värld),
    };
}

/**
 * Vyn plus marginalen i grader (webbens viewWithMargin): området molnen
 * byggs för - skärmens fyra hörn plus marginalen, som platser på kartan
 * (kontraktets cloudViewOf, samma som webben). På en kraftigt lutad karta
 * ligger de övre hörnen mycket långt bort eller ovanför horisonten: då blir
 * området för stort och inga moln byggs, precis som på webben.
 */
export function vyMedMarginal(k: MolnKamera, marginal = GALLRA_PT): CloudView {
    const m = marginal;
    const hörn = [[-m, -m], [k.bredd + m, -m], [k.bredd + m, k.höjd + m], [-m, k.höjd + m]]
        .map(([x, y]) => avprojicera(k, x, y));
    if (hörn.some(h => !Number.isFinite(h.lng) || !Number.isFinite(h.lat))) {
        return { west: -Infinity, south: -Infinity, east: Infinity, north: Infinity };
    }
    return cloudViewOf(hörn);
}

// ── Uppsättningarna ─────────────────────────────────────────────────────────

/** Ett moln i en uppsättning (webbens CloudState). */
export interface MolnLäge {
    moln: Cloud;
    /** Molnets plats i mercator (0-1), räknad en gång vid bygget. */
    mx: number;
    my: number;
    /** Stämplarnas nycklar: molnet, skuggan och de extra puffarna. */
    nyckel: string;
    skuggNyckel: string;
    extraNycklar: readonly string[];
    /** Knuffen: förskjutning i pt PÅ MOLNETS NIVÅ och fart i skärm-pt/s. */
    ox: number;
    oy: number;
    vx: number;
    vy: number;
    /** Uttunningen intill en knuffare (0-1), webbens `fade`. */
    ton: number;
    /** Uttunningen över en tänd bricka (0-1) - bara appen. */
    fri: number;
    /** Molnets egen in-/uttoning (0-1), webbens `vis`. */
    syn: number;
    /** Finns i senaste bygget - annars tonar molnet ut och släpps. */
    kvar: boolean;
}

export interface MolnSats {
    nivå: number;
    lägen: MolnLäge[];
    /** 0-1: uppsättningens egen in-/uttoning. */
    alfa: number;
    /** Tonar ut (ersatt av en ny indelning). */
    lämnar: boolean;
}

export interface MolnVärld {
    satser: MolnSats[];
    nivå: number | null;
    /** Molnen är borta ur bild (inzoomat) och allt är nollställt. */
    rensad: boolean;
}

export function nyVärld(): MolnVärld {
    return { satser: [], nivå: null, rensad: false };
}

function nyttLäge(moln: Cloud, syn: number): MolnLäge {
    const extraNycklar: string[] = [];
    for (let i = 0; i < moln.extra; i++) extraNycklar.push(`${moln.id}+${i}`);
    return {
        moln,
        mx: mercatorX(moln.lng),
        my: mercatorY(moln.lat),
        nyckel: moln.id,
        skuggNyckel: `${moln.id}~`,
        extraNycklar,
        ox: 0,
        oy: 0,
        vx: 0,
        vy: 0,
        ton: 0,
        fri: 0,
        syn,
        kvar: true,
    };
}

/**
 * Bygg (om) den aktiva uppsättningen (webbens rebuild). Samma nivå = byt på
 * plats, behåll molnens rörelse och tona de moln som kommer till eller
 * försvinner; ny nivå = tona över hela uppsättningen.
 */
export function byggOm(värld: MolnVärld, punkter: readonly CloudPoint[], kamera: MolnKamera): void {
    const nästaNivå = cloudLevelFor(kamera.zoom, värld.nivå ?? undefined);
    const aktiv = värld.satser.find(s => !s.lämnar) ?? null;
    const byggda = buildClouds(punkter, nästaNivå, vyMedMarginal(kamera));
    if (aktiv && aktiv.nivå === nästaNivå) {
        const gamla = new Map(aktiv.lägen.map(l => [l.moln.id, l]));
        const nästa: MolnLäge[] = [];
        for (const moln of byggda) {
            const förra = gamla.get(moln.id);
            if (förra) {
                förra.moln = moln;
                förra.kvar = true;
                nästa.push(förra);
            } else {
                nästa.push(nyttLäge(moln, 0));
            }
            gamla.delete(moln.id);
        }
        for (const l of gamla.values()) {
            if (l.syn > 0.01) {
                l.kvar = false;
                nästa.push(l);
            }
        }
        nästa.sort((a, b) => a.moln.alpha - b.moln.alpha);
        aktiv.lägen = nästa;
    } else {
        for (const s of värld.satser) s.lämnar = true;
        värld.satser.push({
            nivå: nästaNivå,
            // Hela uppsättningen tonar in via alfa - molnen själva står fullt.
            lägen: byggda.map(moln => nyttLäge(moln, 1)),
            // Allra första uppsättningen tonar också in - inget poppar.
            alfa: 0,
            lämnar: false,
        });
    }
    värld.nivå = nästaNivå;
}

// ── Bildrutan ───────────────────────────────────────────────────────────────

/** En molnbild att lägga ut: vilken bild, var dess MITT står, hur stor, hur tät. */
export interface MolnStämpel {
    nyckel: string;
    /** Form·2 + spegelvänd (0/1) - index i webbens `sprites`. */
    bild: number;
    cx: number;
    cy: number;
    /** Bildens skala mot sin egen storlek (MOLN_BILD). */
    skala: number;
    a: number;
}

export interface MolnRam {
    /** Skuggorna ritas först, molnen ovanpå - en skugga hamnar aldrig över ett moln. */
    skuggor: MolnStämpel[];
    moln: MolnStämpel[];
}

export interface RamIndata {
    /** Eventens platser (dagens/veckans filtrerade urval). */
    punkter: readonly CloudPoint[];
    /** Det som knuffar molnen: det valda eventet och trycket (om det är väckt). */
    knuffare: readonly CloudPoint[];
    /** De tända brickornas platser - molnen tunnas ut över dem. */
    fria: readonly CloudPoint[];
    /** Tid sedan förra bildrutan (ms). */
    dtMs: number;
    nuMs: number;
    /** Minskad rörelse i systemet: ingen drift. */
    stilla: boolean;
    /** Stämplar inom så här många pt utanför skärmen kommer med (förval 8). */
    rand?: number;
}

const stämpelSynlig = (cx: number, cy: number, b: number, h: number, k: MolnKamera, rand: number) =>
    cx + b / 2 >= -rand && cx - b / 2 <= k.bredd + rand
    && cy + h / 2 >= -rand && cy - h / 2 <= k.höjd + rand;

/**
 * En bildruta (webbens draw): för uppsättningarnas toning, knuffen och
 * driften ett steg framåt och fyller `ut` med stämplarna som ska synas.
 * Svarar true medan något fortfarande rör sig (knuff eller övertoning) - då
 * vill lagret ha nästa bildruta direkt, annars räcker vilotakten.
 */
export function bildruta(värld: MolnVärld, kamera: MolnKamera, ind: RamIndata, ut: MolnRam): boolean {
    ut.skuggor.length = 0;
    ut.moln.length = 0;
    const dt = ind.dtMs;
    const rand = ind.rand ?? SKÄRM_KANT_PT;
    const zoom = kamera.zoom;
    if (värld.nivå == null || cloudLevelFor(zoom, värld.nivå) !== värld.nivå) byggOm(värld, ind.punkter, kamera);
    const zoomTäthet = cloudOpacityForZoom(zoom);

    // Uppsättningarnas övertoning.
    let rör = false;
    const steg = dt / SATS_TON_MS;
    for (const s of värld.satser) {
        const mål = s.lämnar ? 0 : 1;
        if (s.alfa !== mål) {
            s.alfa = s.lämnar ? Math.max(0, s.alfa - steg) : Math.min(1, s.alfa + steg);
            rör = true;
        }
    }
    värld.satser = värld.satser.filter(s => !(s.lämnar && s.alfa <= 0));

    if (zoomTäthet <= 0.002) {
        // Borta ur bild: nollställ övertoningen så nästa utzoomning börjar rent,
        // och ställ tillbaka varje knuffat moln på sin plats (Josef 13/11:
        // "zoomar man in och sen ut så återställs deras defaultplatser").
        for (const s of värld.satser) {
            s.alfa = s.lämnar ? 0 : 1;
            for (const l of s.lägen) {
                l.ox = 0;
                l.oy = 0;
                l.vx = 0;
                l.vy = 0;
                l.ton = 0;
                l.fri = 0;
            }
        }
        värld.satser = värld.satser.filter(s => !s.lämnar);
        värld.rensad = true;
        return false;
    }
    värld.rensad = false;

    const proj = projektionFör(kamera);
    const pt: SkärmPunkt = { x: 0, y: 0, skala: 1 };
    const knuffare: { x: number; y: number }[] = [];
    for (const k of ind.knuffare) {
        if (projiceraMerc(proj, mercatorX(k.lng), mercatorY(k.lat), pt)) knuffare.push({ x: pt.x, y: pt.y });
    }
    const fria: { x: number; y: number }[] = [];
    for (const f of ind.fria) {
        if (!projiceraMerc(proj, mercatorX(f.lng), mercatorY(f.lat), pt)) continue;
        const y = pt.y + BRICK_MITT_DY;
        if (pt.x < -GALLRA_PT || pt.x > kamera.bredd + GALLRA_PT || y < -GALLRA_PT || y > kamera.höjd + GALLRA_PT) continue;
        fria.push({ x: pt.x, y });
    }
    const mjukt = 1 - Math.exp(-dt / KNUFF_TAU_MS);
    const t = ind.stilla ? 0 : ind.nuMs / 1000;
    // SOLEN STÅR MITT I BILDEN (#218): markskuggorna faller utåt från skärmens mitt.
    const solX = kamera.bredd / 2;
    const solY = kamera.höjd / 2;
    const frånSol = { x: 0, y: 0 };

    for (const sats of värld.satser) {
        const skala = cloudScaleFor(zoom, sats.nivå);
        const närmande = cloudApproachFor(zoom, sats.nivå);
        // Moln som kommit till eller försvunnit tonar i sin egen takt. Om
        // toningen kräver en ny bildruta avgörs nedan, per moln: bara det som
        // syns räknas (se `egenRör`).
        let borta = false;
        for (const l of sats.lägen) {
            const mål = l.kvar ? 1 : 0;
            if (l.syn !== mål) {
                l.syn = l.kvar ? Math.min(1, l.syn + steg) : Math.max(0, l.syn - steg);
                if (!l.kvar && l.syn <= 0) borta = true;
            }
        }
        if (borta) sats.lägen = sats.lägen.filter(l => l.kvar || l.syn > 0);

        for (const l of sats.lägen) {
            const c = l.moln;
            if (!projiceraMerc(proj, l.mx, l.my, pt)) {
                l.vx = 0;
                l.vy = 0;
                l.ton = 0;
                continue;
            }
            const bildIndex = Math.floor(c.seed * MOLN_BILDANTAL) % MOLN_BILDANTAL;
            const form = MOLN_FORMER[bildIndex >> 1];
            // Bara molnen SEDDA UPPIFRÅN växer fortare än kartan (#219) -
            // sidomolnen följer kartan som förut. Platsen följer alltid kartan.
            // På en lutad karta följer bara PLATSEN perspektivet: webben ritar
            // alla moln lika stora hur långt bort de än ligger, och det gör
            // appen också (uppmätt mot webben 15/11, VADKUL#233).
            const r = c.radius * skala * (form.uppifrån ? närmande : 1);
            const lägesSkala = skala;
            // Knuffen följer molnet: ett undanknuffat moln ligger kvar
            // förskjutet även när det panoreras ut och in i bild.
            const px = pt.x + l.ox * lägesSkala;
            const py = pt.y + l.oy * lägesSkala;
            if (px < -GALLRA_PT - r || px > kamera.bredd + GALLRA_PT + r
                || py < -GALLRA_PT - r || py > kamera.höjd + GALLRA_PT + r) {
                l.vx = 0;
                l.vy = 0;
                l.ton = 0;
                continue;
            }
            // Rör sig just det här molnet? Det räknas bara om molnet syns: ett
            // moln som tonar in eller glider utanför skärmen (molnen lever i
            // en bred marginal runt den) ska inte hålla hela lagret i full
            // takt - det förs framåt ändå, i den takt bildrutorna kommer.
            let egenRör = l.syn !== (l.kvar ? 1 : 0);
            // Glidningen: trycket och det valda eventet knuffar molnet undan,
            // det bromsar in och STANNAR där det hamnar.
            if (knuffare.length > 0 || l.vx !== 0 || l.vy !== 0) {
                const g = glideStep(l, px, py, knuffare, r, lägesSkala, dt);
                l.ox = g.ox;
                l.oy = g.oy;
                l.vx = g.vx;
                l.vy = g.vy;
                // Som webben: en glidning med fart är rörelse. Den stannar
                // själv även när knuffaren står kvar (glideStep, VADKUL#238).
                if (g.vx !== 0 || g.vy !== 0) egenRör = true;
            }
            // Tätt intill en knuffare tunnas molnet ut (tillfälligt).
            let tf = 0;
            for (const q of knuffare) tf = Math.max(tf, pushOffset(px, py, q.x, q.y, r).fade);
            l.ton += (tf - l.ton) * mjukt;
            if (Math.abs(tf - l.ton) > 0.01) egenRör = true;

            // Driften: en långsam, egen bana per moln.
            const fas = c.seed * Math.PI * 2;
            const amp = 4 + r * 0.07;
            const dx = Math.sin((t / (17 + c.seed * 14)) * Math.PI * 2 + fas) * amp;
            const dy = Math.cos((t / (23 + c.seed * 11)) * Math.PI * 2 + fas * 1.7) * amp * 0.45;

            const x0 = pt.x + l.ox * lägesSkala;
            const y0 = pt.y + l.oy * lägesSkala;
            const x = x0 + dx;
            const y = y0 + dy;
            const b = r * 2;
            const h = b * BILD_KVOT;
            const lyft = h * (0.5 - form.ankareY);
            const cy = y + lyft;

            // Brickgluggen (bara appen): en tänd bricka under molnet tunnar ut
            // det. Räknas på molnets plats UTAN driften - annars ändras gluggen
            // lite i varje bildruta och lagret kommer aldrig ner i vilotakt.
            let ff = 0;
            const räckvidd = 0.8 * r + BRICK_HALV_B;
            for (const f of fria) {
                const fdx = f.x - x0;
                if (fdx > räckvidd || fdx < -räckvidd) continue;
                const v = brickTunning(fdx, f.y - (y0 + lyft), r);
                if (v > ff) ff = v;
            }
            l.fri += (ff - l.fri) * mjukt;
            if (Math.abs(ff - l.fri) > 0.01) egenRör = true;
            // Dubbla rutan: rymmer även skuggan och de extra puffarna.
            if (egenRör && stämpelSynlig(x, cy, b * 2, h * 2, kamera, rand)) rör = true;

            const alfa = c.alpha * zoomTäthet * sats.alfa * l.syn * (1 - l.ton) * (1 - l.fri);
            if (alfa <= 0.004) continue;

            if (stämpelSynlig(x, cy, b, h, kamera, rand)) {
                ut.moln.push({ nyckel: l.nyckel, bild: bildIndex, cx: x, cy, skala: b / MOLN_BILD.bredd, a: alfa });
            }
            // Markskuggan (#215): följer molnets toning, knuff och drift.
            frånSol.x = x - solX;
            frånSol.y = y - solY;
            const skugga = cloudShadow(c.seed, r, frånSol);
            if (skugga && stämpelSynlig(x + skugga.dx, cy + skugga.dy, b, h, kamera, rand)) {
                ut.skuggor.push({
                    nyckel: l.skuggNyckel,
                    bild: bildIndex,
                    cx: x + skugga.dx,
                    cy: cy + skugga.dy,
                    skala: b / MOLN_BILD.bredd,
                    a: alfa * skugga.opacity,
                });
            }
            // De tommaste trakterna får fler puffar runt sig - molnet blir en bank.
            for (let i = 0; i < c.extra; i++) {
                const a = fas + i * 2.4;
                const eb = b * (0.72 - i * 0.08);
                const eh = eb * BILD_KVOT;
                const ex = x + Math.cos(a) * r * 0.55 - dx * 0.5;
                const ey = y + Math.sin(a) * r * 0.3 - dy * 0.5;
                const annan = (bildIndex + i + 1) % MOLN_BILDANTAL;
                const ecy = ey + eh * (0.5 - MOLN_FORMER[annan >> 1].ankareY);
                if (!stämpelSynlig(ex, ecy, eb, eh, kamera, rand)) continue;
                ut.moln.push({
                    nyckel: l.extraNycklar[i] ?? `${l.nyckel}+${i}`,
                    bild: annan,
                    cx: ex,
                    cy: ecy,
                    skala: eb / MOLN_BILD.bredd,
                    a: alfa * 0.8,
                });
            }
        }
    }
    return rör;
}

// ── Platserna ───────────────────────────────────────────────────────────────

/**
 * Lagrets färdiga bildvyer. Webben stämplar bilder på en canvas; appen har ett
 * fast antal bildvyer som flyttas runt. Varje vy visar EN molnbild i taget
 * (`bild`), och en stämpel behåller sin vy så länge den finns - bilden i en vy
 * byts bara när inga lediga vyer med rätt bild finns kvar.
 */
export interface MolnPlatser {
    /** Molnbilden varje vy visar (form·2 + spegelvänd). */
    bild: number[];
    /** Stämpeln som har vyn just nu, eller null. */
    nyckel: (string | null)[];
    avNyckel: Map<string, number>;
}

/** `antal` vyer, från början jämnt fördelade över molnbilderna. */
export function nyaPlatser(antal: number, bilder = MOLN_BILDANTAL): MolnPlatser {
    const bild: number[] = [];
    const nyckel: (string | null)[] = [];
    for (let i = 0; i < antal; i++) {
        bild.push(i % bilder);
        nyckel.push(null);
    }
    return { bild, nyckel, avNyckel: new Map() };
}

/** En stämpel som redan har en vy väger så här mycket tyngre när vyerna är
 *  för få - annars byter två nästan lika synliga plats i varje bildruta. */
const HÅLL_KVAR = 1.5;

/**
 * Ge varje stämpel en vy: `ut[j]` blir vyns index för stämpel j, eller -1 när
 * vyerna är slut. Då blir de som syns minst utan (täthet x yta: tunna och
 * små - vid ett nivåbyte den uppsättning som tonar ut), ÄVEN om de redan hade
 * en vy: annars var det nykomlingarna som föll bort, och de kommer in i
 * skärmens kant under en utzoomning - där syntes luckorna (uppmätt mot webben
 * 15/11, VADKUL#233). Svarar true när någon vy fick byta molnbild.
 */
export function fördela(platser: MolnPlatser, stämplar: readonly MolnStämpel[], ut: number[]): boolean {
    const antal = platser.bild.length;
    const tagen: boolean[] = new Array(antal).fill(false);
    const nya = new Map<string, number>();
    ut.length = stämplar.length;
    const vikt = (j: number) => stämplar[j].a * stämplar[j].skala * stämplar[j].skala;
    // Fler stämplar än vyer: bara de `antal` som syns mest får vara med.
    let med: Uint8Array | null = null;
    if (stämplar.length > antal) {
        const rang = stämplar.map((s, j) => vikt(j) * (platser.avNyckel.has(s.nyckel) ? HÅLL_KVAR : 1));
        const ordning = stämplar.map((_, j) => j).sort((a, b) => rang[b] - rang[a]);
        med = new Uint8Array(stämplar.length);
        for (let i = 0; i < antal; i++) med[ordning[i]] = 1;
    }
    const utan: number[] = [];
    for (let j = 0; j < stämplar.length; j++) {
        const s = stämplar[j];
        if (med && med[j] === 0) {
            ut[j] = -1;
            continue;
        }
        const plats = platser.avNyckel.get(s.nyckel);
        if (plats != null && !tagen[plats] && platser.bild[plats] === s.bild) {
            tagen[plats] = true;
            nya.set(s.nyckel, plats);
            ut[j] = plats;
        } else {
            ut[j] = -1;
            utan.push(j);
        }
    }
    let ändrad = false;
    if (utan.length > 0) {
        const lediga = new Map<number, number[]>();
        let ledigaTotalt = 0;
        for (let i = antal - 1; i >= 0; i--) {
            if (tagen[i]) continue;
            const lista = lediga.get(platser.bild[i]);
            if (lista) lista.push(i);
            else lediga.set(platser.bild[i], [i]);
            ledigaTotalt++;
        }
        // De som syns mest först.
        utan.sort((a, b) => vikt(b) - vikt(a));
        // Först de som hittar en ledig vy med rätt bild...
        const byter: number[] = [];
        for (const j of utan) {
            const s = stämplar[j];
            const plats = lediga.get(s.bild)?.pop();
            if (plats == null) {
                byter.push(j);
                continue;
            }
            ledigaTotalt--;
            tagen[plats] = true;
            nya.set(s.nyckel, plats);
            ut[j] = plats;
        }
        // ...sedan får resten ta en vy från den bild som har flest lediga.
        for (const j of byter) {
            if (ledigaTotalt <= 0) break;
            let bäst: number[] | null = null;
            for (const lista of lediga.values()) {
                if (lista.length > (bäst?.length ?? 0)) bäst = lista;
            }
            const plats = bäst?.pop();
            if (plats == null) break;
            ledigaTotalt--;
            const s = stämplar[j];
            platser.bild[plats] = s.bild;
            ändrad = true;
            tagen[plats] = true;
            nya.set(s.nyckel, plats);
            ut[j] = plats;
        }
    }
    for (let i = 0; i < antal; i++) platser.nyckel[i] = null;
    for (const [nyckel, plats] of nya) platser.nyckel[plats] = nyckel;
    platser.avNyckel = nya;
    return ändrad;
}

/**
 * Hur många bildvyer lagret behöver för en skärm. Måttet är det molnigaste
 * läget: öppet hav precis vid ett nivåbyte under en utzoomning, där den gamla
 * uppsättningens rutor är som minst på skärmen OCH nästa uppsättning redan
 * tonar in. Uppmätt mot webben 15/11 (VADKUL#233): en snabb utzoomning över
 * Sverige behövde 225 molnvyer och 93 skuggor på en skärm om 390 x 844 pt -
 * de 144 och 67 som fanns räckte inte, och småmoln föll bort i skärmens kant.
 * Räcker vyerna ändå inte (surfplatta, tre uppsättningar på en gång) faller
 * de som syns minst bort (fördela).
 */
export function platsBehov(bredd: number, höjd: number): { moln: number; skuggor: number } {
    // Rutans sida vid uppsättningens minsta skala (88 pt · 2^-0,62).
    const ruta = 57;
    const kant = 40 + VY_RAND_PT;
    const rutor = ((bredd + 2 * kant) * (höjd + 2 * kant)) / (ruta * ruta);
    // 62 % av de tomma rutorna har ett moln, i snitt 0,6 extra puffar per moln;
    // 60 % av molnen har skugga. Nästa uppsättning (en fjärdedel så många
    // rutor) tonar in samtidigt, och så lite luft ovanpå.
    const moln = Math.ceil(rutor * 0.62 * 1.6 * 1.25 * 1.2);
    const skuggor = Math.ceil(rutor * 0.62 * 0.6 * 1.25 * 1.3);
    return {
        moln: Math.min(400, Math.max(140, moln)),
        skuggor: Math.min(170, Math.max(60, skuggor)),
    };
}

// ── Behållaren ──────────────────────────────────────────────────────────────

/**
 * Hur hela lagret ska flyttas och skalas (kring sin mitt) för att det som
 * lades ut för en kamera ska stå rätt för en annan. En panorering eller
 * zoomning flyttar alla platser på kartan lika - och molnen följer kartan i
 * både läge och storlek - så EN vy räcker.
 */
export interface Behållare {
    tx: number;
    ty: number;
    skala: number;
}

/** Så långt (pt) får lagret flyttas från ankaret innan det läggs ut på nytt. */
const ANKARE_MAX_PT = 1500;
/** Inom de här skalorna håller ankaret - utanför läggs lagret ut på nytt. */
const ANKARE_MIN_SKALA = 0.5;
const ANKARE_MAX_SKALA = 2;

/**
 * Kan `kamera` nås från `ankare` med bara en flytt och en skalning av lagret?
 * Inte om kartan vridits (molnbilderna ska stå upprätt), lutats (perspektiv),
 * bytt storlek eller hamnat för långt från ankaret.
 */
export function sammaPlan(ankare: MolnKamera, kamera: MolnKamera): boolean {
    if (ankare.lutning > 0.01 || kamera.lutning > 0.01) return false;
    if (Math.abs(ankare.bäring - kamera.bäring) > 0.01) return false;
    if (ankare.bredd !== kamera.bredd || ankare.höjd !== kamera.höjd) return false;
    if (ankare.mittX !== kamera.mittX || ankare.mittY !== kamera.mittY) return false;
    const b = behållareFör(ankare, kamera);
    return b.skala >= ANKARE_MIN_SKALA && b.skala <= ANKARE_MAX_SKALA
        && Math.abs(b.tx) <= ANKARE_MAX_PT && Math.abs(b.ty) <= ANKARE_MAX_PT;
}

/** Lagrets flytt och skala för `kamera` när bildvyerna ligger utlagda för `ankare`. */
export function behållareFör(ankare: MolnKamera, kamera: MolnKamera): Behållare {
    const p = projektionFör(kamera);
    const k = Math.pow(2, kamera.zoom - ankare.zoom);
    const pt: SkärmPunkt = { x: p.cx, y: p.cy, skala: 1 };
    projiceraMerc({ ...p, sinLut: 0 }, mercatorX(ankare.lng), mercatorY(ankare.lat), pt);
    // Vyn skalas kring sin egen mitt, kartan kring kamerans mitt på skärmen.
    return {
        tx: pt.x - p.cx + (p.cx - kamera.bredd / 2) * (1 - k),
        ty: pt.y - p.cy + (p.cy - kamera.höjd / 2) * (1 - k),
        skala: k,
    };
}

/** En bildvys läge i lagret: bild, övre vänstra hörnets flytt, skala och täthet. */
export interface VyData {
    /** Form·2 + spegelvänd. */
    bild: number;
    x: number;
    y: number;
    s: number;
    a: number;
}

/** `antal` dolda vyer, jämnt fördelade över molnbilderna (som nyaPlatser). */
export function tommaVyer(antal: number, bilder = MOLN_BILDANTAL): VyData[] {
    return Array.from({ length: antal }, (_, i) => ({ bild: i % bilder, x: 0, y: 0, s: 1, a: 0 }));
}

const HALV_B = MOLN_BILD.bredd / 2;
const HALV_H = MOLN_BILD.höjd / 2;
const avrunda = (v: number, steg: number) => Math.round(v * steg) / steg;

/**
 * Lägg stämplarna i sina bildvyer. Stämplarna står i skärmens koordinater för
 * kameran de räknades för; `b` är lagrets flytt och skala för samma kamera,
 * så vyerna läggs i lagrets EGNA koordinater (ankarets). En vy som inte
 * ändrats behåller sitt objekt och listan sin identitet, så React bara ritar
 * om de vyer som faktiskt rört sig. Värdena rundas (en kvarts pt, en halv
 * procent täthet) - finare än så syns inte på en mjuk molnkant.
 */
export function läggIVyer(
    förra: readonly VyData[],
    stämplar: readonly MolnStämpel[],
    plats: readonly number[],
    b: Behållare,
    bredd: number,
    höjd: number,
): readonly VyData[] {
    const mx = bredd / 2;
    const my = höjd / 2;
    let nästa: VyData[] | null = null;
    const använd = new Uint8Array(förra.length);
    const sätt = (i: number, d: VyData) => {
        if (!nästa) nästa = förra.slice();
        nästa[i] = d;
    };
    for (let j = 0; j < stämplar.length; j++) {
        const i = plats[j];
        if (i == null || i < 0 || i >= förra.length) continue;
        const st = stämplar[j];
        använd[i] = 1;
        const a = avrunda(st.a, 200);
        const f = förra[i];
        if (a <= 0) {
            if (f.a !== 0) sätt(i, { ...f, a: 0 });
            continue;
        }
        const x = avrunda(mx + (st.cx - mx - b.tx) / b.skala - HALV_B, 4);
        const y = avrunda(my + (st.cy - my - b.ty) / b.skala - HALV_H, 4);
        const s = avrunda(st.skala / b.skala, 1024);
        if (f.bild !== st.bild || f.x !== x || f.y !== y || f.s !== s || f.a !== a) sätt(i, { bild: st.bild, x, y, s, a });
    }
    for (let i = 0; i < förra.length; i++) {
        if (använd[i] === 0 && förra[i].a !== 0) sätt(i, { ...förra[i], a: 0 });
    }
    return nästa ?? förra;
}
