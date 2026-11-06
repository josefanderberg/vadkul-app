/**
 * Brickorna som BLÄDDRAR - webbens rytm och övertoning (Josef 5/11 2026:
 * "om det är multieventmarkör på kartan så ska de bytas ... skippa
 * dubbletterna ... bläddra så att alla hamnar överst"; 6/11: "inte så smooth
 * på apparna som på webben. De går för snabbt ... webben har mycket bättre
 * övergång"). Två rörelser, båda med webbens takt (V2Map):
 *
 *  1. EMOJIVÄXLINGEN (webbens cycleRotations, CYCLE_STEP_MS 500 / FADE_MS
 *     200): EN bricka i taget byter ram, i tur och ordning bland de växlande
 *     brickorna - aldrig flera samtidigt - och den gamla bilden tonas bort
 *     ovanpå den nya. Ramarna byggs i lib/kartlager (BrickProps.ramar): en per
 *     SYNLIG BILD, dubbletterna hoppas över. Passerade, stjärnmärkta/boostade
 *     och den valda står still.
 *  2. Z-VÄXLINGEN (webbens utils/overlapCycle, Z_CYCLE_STEP_MS 1600 /
 *     Z_FADE_MS 220): EN hög i taget får en ny bricka överst, och den tonas
 *     in. Appen lyfter brickans `sort` (lagrets symbolSortKey) när tonen är
 *     klar. Boostade/stjärnmärkta (sort 3) och den valda (4) är inte med och
 *     ligger alltid överst (Josef 4/11); lyftet (2.5) går aldrig förbi dem.
 *
 * Tonerna ritas av components/KartBrickor i ett eget tunt lager (en kopia av
 * brickan med sjunkande/stigande opacitet) - MapLibre i appen kan inte blanda
 * bildpunkter i en bild som webbens updateImage. Här bor den rena delen:
 * turordningen, högarna och hur brickorna ser ut just nu. Testad.
 *
 * Skärmavståndet räknas utan kartan: Web Mercator-pt vid kartans zoom
 * (MapLibres världsbredd 512·2^zoom pt).
 */
import type { BrickProps, BrickRam } from './kartlager';

/** Webbens CYCLE_STEP_MS: en bricka byter ram var halvsekund, i tur och ordning. */
export const CYKEL_STEG_MS = 500;
/** Webbens FADE_MS: den gamla ramen tonas bort så nästa syns bakom. */
export const CYKEL_TON_MS = 200;
/** Webbens Z_CYCLE_STEP_MS: en hög byter överst var 1,6 s - ett större hopp. */
export const Z_STEG_MS = 1600;
/** Webbens Z_FADE_MS. */
export const Z_TON_MS = 220;
/** Ankarpunkter närmare än så (pt) räknas som på varandra - webbens
 *  OVERLAP_RADIUS_PX, ungefär en brickbredd (40 pt) med lite marginal inåt. */
export const ÖVERLAPP_RADIE_PT = 30;
/** Sort för den framroterade - över guld/grön/pop (2), under boostade (3). */
export const FRAM_SORT = 2.5;

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
 * steget = inget lyft). Okänd front (ny hög) = toppen syns, turen till nummer två.
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

/** Brickorna som syns överst i sina högar just nu (lyft eller naturlig topp). */
export function överstIHögarna(högar: readonly ÖverlappsHög[], fronter: ReadonlyMap<string, string>): Set<string> {
    return new Set(högar.map(h => fronter.get(h.id) ?? h.topKey));
}

/**
 * Brickorna som de ska se ut nu: växlande brickor visar sin ram (bild,
 * titel och kategori byter i samma takt som på webben), och de lyfta ligger
 * överst i sin hög. Ensamma brickor får sin emojibild när den är klar (som
 * lib/emojiBricka medEmojiBilder). `ramar` skickas inte vidare till kartan.
 */
export function medCykel(
    fc: Brickor,
    ramIndex: ReadonlyMap<string, number>,
    lyfta: ReadonlySet<string>,
    klara: ReadonlySet<string>,
): GeoJSON.FeatureCollection<GeoJSON.Point, Omit<BrickProps, 'ramar'>> {
    return {
        type: 'FeatureCollection',
        features: fc.features.map(f => {
            const { ramar: _ramar, ...p } = f.properties;
            const r = aktuellRam(f.properties, ramIndex);
            const ut = {
                ...p,
                ikon: visadBild(f.properties, ramIndex, klara),
                ...(r ? { titel: r.titel, label: r.label } : {}),
                ...(lyfta.has(p.id) ? { sort: FRAM_SORT } : {}),
            };
            return { ...f, properties: ut };
        }),
    };
}

/** Finns det något att bläddra? Annars behöver kartan inte ticka alls. */
export function harRörelse(fc: Brickor, högar: readonly ÖverlappsHög[]): boolean {
    return högar.length > 0 || växlande(fc).length > 0;
}
