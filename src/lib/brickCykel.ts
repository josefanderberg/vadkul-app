/**
 * Brickorna som BLÄDDRAR - webbens rytm och övertoning, UTAN att kartan
 * ritar om (Josef 5/11 2026: "skippa dubbletterna ... bläddra så att alla
 * hamnar överst"; 6/11: "inte så smooth som på webben. De går för snabbt",
 * och sedan "vid varje byte blinkar ALLA eventbrickor till").
 *
 * VARFÖR DET SER UT SÅ HÄR: varje gång en GeoJSON-källa får ny data lägger
 * appens MapLibre ut alla dess symboler på nytt och tonar in dem - alla
 * brickor blinkar. Bläddringen får därför ALDRIG skicka om brickkällan.
 * I stället ligger de bilder som kan visas som färdiga kopior i ett eget,
 * stillastående tonlager - ett kartlager per kopia - och ett byte är bara
 * att ett lagers opacitet tonas (lagernivåns iconOpacity med
 * iconOpacityTransition): ingen omritning, och MapLibre sköter toningen.
 *
 *  1. EMOJIVÄXLINGEN (webbens cycleRotations, CYCLE_STEP_MS 500 / FADE_MS
 *     200): EN bricka i taget byter ram var halvsekund, i tur och ordning.
 *     Ram 0 är brickan själv i huvudlagret; ram 1.. är "ram"-kopior ovanpå.
 *  2. Z-VÄXLINGEN (webbens overlapCycle, Z_CYCLE_STEP_MS 1600 / Z_FADE_MS
 *     220): EN hög i taget får en ny överst. "fram"-kopiorna ligger över
 *     alla ram-kopior; den som har turen visar sin aktuella ram där.
 *     Boostade/stjärnmärkta och den valda är inte med - de ligger alltid
 *     överst (Josef 4/11).
 *
 * Bytet sker i TVÅ STEG så grundbilden aldrig skymtar mitt i tonen: den nya
 * kopian tonas in medan den gamla HÅLLS kvar, sedan släpps den gamla. Ligger
 * den nya under den gamla (ett varv runt) syns i stället den gamlas uttoning.
 *
 * Ramarna byggs i lib/kartlager (BrickProps.ramar): en per SYNLIG BILD,
 * dubbletterna hoppas över. Ren modul, testad. Skärmavståndet räknas utan
 * kartan: Web Mercator-pt vid kartans zoom (världen 512·2^zoom pt).
 */
import type { BrickProps, BrickRam } from './kartlager';

/** Webbens CYCLE_STEP_MS: en bricka byter ram var halvsekund, i tur och ordning. */
export const CYKEL_STEG_MS = 500;
/** Varje ram står kvar minst så här länge. På webben byter en bricka var
 *  halvsekund i tur och ordning bland de växlande brickorna i bild, så varje
 *  bricka byter var 0,5 s × antalet - med 6-16 i bild 3-8 s (Josef 6/11:
 *  "på webben är det kanske 3-8 sekunder ... gör i samma takt på apparna").
 *  Med få växlande brickor i bild hade appen annars bytt mycket oftare. */
export const RAM_MINST_MS = 4000;
/** Webbens FADE_MS: den gamla ramen tonas bort så nästa syns bakom. */
export const CYKEL_TON_MS = 200;
/** Webbens Z_CYCLE_STEP_MS: en hög byter överst var 1,6 s - ett större hopp. */
export const Z_STEG_MS = 1600;
/** Webbens Z_FADE_MS. */
export const Z_TON_MS = 220;
/** Ankarpunkter närmare än så (pt) räknas som på varandra - webbens
 *  OVERLAP_RADIUS_PX, ungefär en brickbredd (40 pt) med lite marginal inåt. */
export const ÖVERLAPP_RADIE_PT = 30;

type Brickor = GeoJSON.FeatureCollection<GeoJSON.Point, BrickProps>;

/** Punkt i Web Mercator-pt vid zoom (MapLibre: världen är 512·2^zoom pt bred). */
export function mercatorPt(lng: number, lat: number, zoom: number): { x: number; y: number } {
    const värld = 512 * Math.pow(2, zoom);
    const φ = (Math.max(-85.0511, Math.min(85.0511, lat)) * Math.PI) / 180;
    return {
        x: ((lng + 180) / 360) * värld,
        y: ((1 - Math.log(Math.tan(Math.PI / 4 + φ / 2)) / Math.PI) / 2) * värld,
    };
}

export type ÖverlappsPunkt = { key: string; x: number; y: number; sortKey: number };
/** En hög: members i stapelordning (naturliga toppen först), id av de sorterade nycklarna. */
export type ÖverlappsHög = { id: string; members: string[]; topKey: string };

/**
 * Högarna: sammanhängande komponenter där ankarpunkterna ligger inom
 * radien (kedjor räknas ihop). Port av webbens utils/overlapCycle
 * overlapClusters - samma union-find, stapelordning och id.
 */
export function överlappsHögar(punkter: readonly ÖverlappsPunkt[], radie: number): ÖverlappsHög[] {
    const n = punkter.length;
    if (n < 2) return [];
    const r2 = radie * radie;
    const parent = Array.from({ length: n }, (_, i) => i);
    const find = (i: number): number => {
        let root = i;
        while (parent[root] !== root) root = parent[root];
        while (parent[i] !== root) {
            const nästa = parent[i];
            parent[i] = root;
            i = nästa;
        }
        return root;
    };
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const dx = punkter[i].x - punkter[j].x;
            const dy = punkter[i].y - punkter[j].y;
            if (dx * dx + dy * dy <= r2) parent[find(j)] = find(i);
        }
    }
    const perRot = new Map<number, ÖverlappsPunkt[]>();
    for (let i = 0; i < n; i++) {
        const rot = find(i);
        const hink = perRot.get(rot);
        if (hink) hink.push(punkter[i]);
        else perRot.set(rot, [punkter[i]]);
    }
    const högar: ÖverlappsHög[] = [];
    for (const grupp of perRot.values()) {
        if (grupp.length < 2) continue;
        grupp.sort((a, b) => b.sortKey - a.sortKey || (a.key < b.key ? -1 : 1));
        const members = grupp.map(p => p.key);
        högar.push({ id: [...members].sort().join('|'), members, topKey: members[0] });
    }
    högar.sort((a, b) => (a.id < b.id ? -1 : 1));
    return högar;
}

/**
 * Vems tur det är att ligga överst (webbens nextFront): rotationen går i
 * stapelordning och varvar runt genom ALLA, även den naturliga toppen (det
 * steget = ingen kopia överst). Okänd front (ny hög) = toppen syns, turen till nummer två.
 */
export function nästaFront(hög: ÖverlappsHög, nuvarande: string | null | undefined): string {
    const i = nuvarande != null ? hög.members.indexOf(nuvarande) : -1;
    if (i < 0) return hög.members[1 % hög.members.length];
    return hög.members[(i + 1) % hög.members.length];
}

/** Round-robin (webbens cycleLastKeyRef/zLastClusterRef): nästa efter den
 *  som bytte förra gången; försvunnen eller ingen = listans första. */
export function nästaIRunda(nycklar: readonly string[], senast: string | null): string | null {
    if (nycklar.length === 0) return null;
    return nycklar[(nycklar.indexOf(senast ?? '') + 1) % nycklar.length];
}

/** Brickorna som får vara med i z-växlingen: inte vald, inte passerad, inte boostad. */
function iZVäxlingen(p: BrickProps): boolean {
    return !p.vald && !p.past && p.sort < 3;
}

/** Högarna för brickorna vid en zoom - räknas om bara när brickorna eller zoomen ändras. */
export function brickHögar(fc: Brickor, zoom: number): ÖverlappsHög[] {
    const punkter: ÖverlappsPunkt[] = [];
    for (const f of fc.features) {
        if (!iZVäxlingen(f.properties)) continue;
        const [lng, lat] = f.geometry.coordinates;
        const { x, y } = mercatorPt(lng, lat, zoom);
        punkter.push({ key: f.properties.id, x, y, sortKey: f.properties.sort });
    }
    return överlappsHögar(punkter, ÖVERLAPP_RADIE_PT);
}

/** De växlande brickornas id:n, i källans ordning (turordningen). */
export function växlande(fc: Brickor): string[] {
    return fc.features.filter(f => (f.properties.ramar?.length ?? 0) > 1).map(f => f.properties.id);
}

/** Ramens bild: den sammansatta (eventets egen emoji) när den är inläst,
 *  annars kategorins förbakade bricka. */
function ramBild(r: BrickRam, klara: ReadonlySet<string>): string {
    return r.emojiBild && klara.has(r.emojiBild) ? r.emojiBild : r.ikon;
}

/** Ramen en växlande bricka står på. */
function aktuellRam(p: BrickProps, ramIndex: ReadonlyMap<string, number>): BrickRam | null {
    if (!p.ramar || p.ramar.length < 2) return null;
    return p.ramar[(ramIndex.get(p.id) ?? 0) % p.ramar.length];
}

/** Bilden brickan visar just nu - tonlagrets kopia ska vara exakt den. */
export function visadBild(p: BrickProps, ramIndex: ReadonlyMap<string, number>, klara: ReadonlySet<string>): string {
    const r = aktuellRam(p, ramIndex);
    if (r) return ramBild(r, klara);
    return p.emojiBild && klara.has(p.emojiBild) ? p.emojiBild : p.ikon;
}

/** Huvudlagrets brickor: ram 0 (representanten) med emojibilden när den är
 *  inläst. Ändras bara med brickorna själva - aldrig av bläddringen.
 *  `ramar` skickas inte till kartan. */
export function basBrickor(
    fc: Brickor,
    klara: ReadonlySet<string>,
): GeoJSON.FeatureCollection<GeoJSON.Point, Omit<BrickProps, 'ramar'>> {
    return {
        type: 'FeatureCollection',
        features: fc.features.map(f => {
            const { ramar: _ramar, ...p } = f.properties;
            const ram0 = f.properties.ramar?.[0];
            return { ...f, properties: { ...p, ikon: ram0 ? ramBild(ram0, klara) : visadBild(f.properties, new Map(), klara) } };
        }),
    };
}

/** Ett lager i tonlagret: kopian av brickan `id` i ram `j`. */
export interface TonPost {
    /** Lagrets och kopians nyckel. */
    k: string;
    grupp: 'ram' | 'fram';
    id: string;
    j: number;
}

/**
 * Tonlagrets kopior och lager, i ritordning (nedifrån). RAM-kopior för de
 * växlande brickornas ram 1.. och FRAM-kopior av alla ramar för brickorna i
 * högarna - fram-gruppen ligger överst. Byggs om bara när brickorna, högarna
 * eller de inlästa bilderna ändras.
 */
export function byggTonlager(
    fc: Brickor,
    högar: readonly ÖverlappsHög[],
    klara: ReadonlySet<string>,
): { data: GeoJSON.FeatureCollection<GeoJSON.Point, { k: string; ikon: string }>; poster: TonPost[] } {
    const iHög = new Set(högar.flatMap(h => h.members));
    const ram: { post: TonPost; f: GeoJSON.Feature<GeoJSON.Point, { k: string; ikon: string }> }[] = [];
    const fram: typeof ram = [];
    for (const f of fc.features) {
        const p = f.properties;
        const bilder = p.ramar && p.ramar.length > 1
            ? p.ramar.map(r => ramBild(r, klara))
            : [visadBild(p, new Map(), klara)];
        const lägg = (grupp: TonPost['grupp'], j: number, ut: typeof ram) => {
            const k = `${grupp}|${p.id}|${j}`;
            ut.push({ post: { k, grupp, id: p.id, j }, f: { type: 'Feature', geometry: f.geometry, properties: { k, ikon: bilder[j] } } });
        };
        for (let j = 1; j < bilder.length; j++) lägg('ram', j, ram);
        if (iHög.has(p.id)) for (let j = 0; j < bilder.length; j++) lägg('fram', j, fram);
    }
    const alla = [...ram, ...fram];
    return { data: { type: 'FeatureCollection', features: alla.map(x => x.f) }, poster: alla.map(x => x.post) };
}

/** Bläddringens läge: vilken ram varje bricka står på (och vilken som hålls
 *  kvar under tonen), vem som ligger överst i varje hög och vilka förra
 *  fronter som hålls kvar under sin uttoning. */
export interface BläddrLäge {
    ramIndex: ReadonlyMap<string, number>;
    ramHåll: ReadonlyMap<string, number>;
    fronter: ReadonlyMap<string, string>;
    frontHåll: ReadonlySet<string>;
}

export const TOMT_LÄGE: BläddrLäge = { ramIndex: new Map(), ramHåll: new Map(), fronter: new Map(), frontHåll: new Set() };

/** Opaciteten (0/1) för ett lager i tonlagret - MapLibre tonar mellan dem. */
export function tonOpacitet(post: TonPost, läge: BläddrLäge, antalRamar: number): 0 | 1 {
    const n = Math.max(1, antalRamar);
    const nu = (läge.ramIndex.get(post.id) ?? 0) % n;
    const håll = läge.ramHåll.get(post.id);
    const visar = post.j === nu || (håll != null && post.j === håll % n);
    if (post.grupp === 'ram') return visar ? 1 : 0;
    const överst = [...läge.fronter.values()].includes(post.id) || läge.frontHåll.has(post.id);
    return överst && visar ? 1 : 0;
}

/** Finns det något att bläddra? Annars behöver kartan inte ticka alls. */
export function harRörelse(fc: Brickor, högar: readonly ÖverlappsHög[]): boolean {
    return högar.length > 0 || växlande(fc).length > 0;
}
