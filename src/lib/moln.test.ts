import { describe, expect, it } from 'vitest';
import {
    CLOUD_GONE_ZOOM,
    CLOUD_SHADOW_OPACITY,
    cloudApproachFor,
    cloudOpacityForZoom,
    cloudScaleFor,
} from '@vadkul/kontrakt';
import {
    avprojicera,
    behållareFör,
    bildruta,
    BRICK_TUNNING_MAX,
    brickTunning,
    byggOm,
    fördela,
    läggIVyer,
    MOLN_BILDANTAL,
    nyaPlatser,
    nyVärld,
    platsBehov,
    projicera,
    sammaPlan,
    SATS_TON_MS,
    tommaVyer,
    vyMedMarginal,
    type MolnKamera,
    type MolnRam,
    type MolnStämpel,
    type RamIndata,
} from './moln';
import { MOLN_BILD, MOLN_FORMER } from './molnFormer.generated';

// Öppet hav väster om Norge: inga event, så rutorna är så molniga de kan bli.
const HAV: MolnKamera = { lng: 2, lat: 62, zoom: 6, bäring: 0, lutning: 0, bredd: 390, höjd: 844 };
const ind = (över: Partial<RamIndata> = {}): RamIndata => ({
    punkter: [],
    knuffare: [],
    fria: [],
    dtMs: 16,
    nuMs: 0,
    stilla: true,
    ...över,
});
const tomRam = (): MolnRam => ({ skuggor: [], moln: [] });

/** Kör bildrutor tills uppsättningen tonat in helt. */
function intonad(kamera: MolnKamera, över: Partial<RamIndata> = {}) {
    const värld = nyVärld();
    const ram = tomRam();
    for (let i = 0; i < 40; i++) bildruta(värld, kamera, ind(över), ram);
    return { värld, ram };
}

describe('projektionen', () => {
    it('kartans mitt hamnar mitt på skärmen', () => {
        const p = projicera(HAV, HAV.lng, HAV.lat);
        expect(p?.x).toBeCloseTo(195, 6);
        expect(p?.y).toBeCloseTo(422, 6);
        expect(p?.skala).toBe(1);
    });

    it('öster ligger till höger och norr uppåt', () => {
        expect(projicera(HAV, HAV.lng + 1, HAV.lat)!.x).toBeGreaterThan(195);
        expect(projicera(HAV, HAV.lng, HAV.lat + 1)!.y).toBeLessThan(422);
    });

    it('en grad österut är lika många pt som MapLibres värld säger', () => {
        const p = projicera(HAV, HAV.lng + 1, HAV.lat)!;
        expect(p.x - 195).toBeCloseTo((512 * 2 ** 6) / 360, 6);
    });

    it('bäring 90: öster pekar uppåt', () => {
        const p = projicera({ ...HAV, bäring: 90 }, HAV.lng + 1, HAV.lat)!;
        expect(p.x).toBeCloseTo(195, 6);
        expect(p.y).toBeLessThan(422);
    });

    it('avprojicera är projiceras omvändning, även vriden', () => {
        for (const bäring of [0, 37, 180, 290]) {
            const k = { ...HAV, bäring };
            const p = projicera(k, 4.2, 60.9)!;
            const tillbaka = avprojicera(k, p.x, p.y);
            expect(tillbaka.lng).toBeCloseTo(4.2, 8);
            expect(tillbaka.lat).toBeCloseTo(60.9, 8);
        }
    });

    it('lutad karta: det som ligger norrut krymper, det söderut växer', () => {
        const k = { ...HAV, lutning: 45 };
        expect(projicera(k, HAV.lng, HAV.lat)!.skala).toBeCloseTo(1, 6);
        expect(projicera(k, HAV.lng, HAV.lat + 1)!.skala).toBeLessThan(1);
        expect(projicera(k, HAV.lng, HAV.lat - 1)!.skala).toBeGreaterThan(1);
    });

    it('vyn med marginal ramar in skärmens hörn', () => {
        const vy = vyMedMarginal(HAV, 0);
        const nv = avprojicera(HAV, 0, 0);
        const so = avprojicera(HAV, HAV.bredd, HAV.höjd);
        expect(vy.west).toBeCloseTo(nv.lng, 8);
        expect(vy.north).toBeCloseTo(nv.lat, 8);
        expect(vy.east).toBeCloseTo(so.lng, 8);
        expect(vy.south).toBeCloseTo(so.lat, 8);
        const större = vyMedMarginal(HAV);
        expect(större.west).toBeLessThan(vy.west);
        expect(större.north).toBeGreaterThan(vy.north);
    });

    it('vriden karta får en ram som rymmer alla fyra hörnen', () => {
        const k = { ...HAV, bäring: 45 };
        const vy = vyMedMarginal(k, 0);
        for (const [x, y] of [[0, 0], [k.bredd, 0], [k.bredd, k.höjd], [0, k.höjd]]) {
            const p = avprojicera(k, x, y);
            expect(p.lng).toBeGreaterThanOrEqual(vy.west - 1e-9);
            expect(p.lng).toBeLessThanOrEqual(vy.east + 1e-9);
            expect(p.lat).toBeGreaterThanOrEqual(vy.south - 1e-9);
            expect(p.lat).toBeLessThanOrEqual(vy.north + 1e-9);
        }
    });
});

describe('ombygget', () => {
    it('första bygget ger en uppsättning som tonar in från noll', () => {
        const värld = nyVärld();
        byggOm(värld, [], HAV);
        expect(värld.satser).toHaveLength(1);
        expect(värld.satser[0].alfa).toBe(0);
        expect(värld.satser[0].lägen.length).toBeGreaterThan(10);
        expect(värld.satser[0].lägen.every(l => l.syn === 1 && l.kvar)).toBe(true);
    });

    it('samma nivå: molnen behåller sin knuff, nya tonar in och försvunna tonar ut', () => {
        const värld = nyVärld();
        byggOm(värld, [], HAV);
        const sats = värld.satser[0];
        const knuffat = sats.lägen[0];
        knuffat.ox = 12;
        knuffat.oy = -7;
        // En bit österut: några rutor lämnar vyn, några kommer till.
        byggOm(värld, [], { ...HAV, lng: HAV.lng + 3 });
        expect(värld.satser).toHaveLength(1);
        const kvar = sats.lägen.find(l => l.moln.id === knuffat.moln.id);
        if (kvar?.kvar) expect([kvar.ox, kvar.oy]).toEqual([12, -7]);
        expect(sats.lägen.some(l => l.kvar && l.syn === 0)).toBe(true);
        expect(sats.lägen.some(l => !l.kvar && l.syn === 1)).toBe(true);
    });

    it('ny nivå: den gamla uppsättningen lämnar och en ny tonar in', () => {
        const värld = nyVärld();
        byggOm(värld, [], HAV);
        byggOm(värld, [], { ...HAV, zoom: 7.4 });
        expect(värld.satser).toHaveLength(2);
        expect(värld.satser[0].lämnar).toBe(true);
        expect(värld.satser[1].lämnar).toBe(false);
        expect(värld.satser[1].nivå).toBe(7);
    });
});

describe('bildrutan', () => {
    it('tonar in uppsättningen över SATS_TON_MS', () => {
        const värld = nyVärld();
        const ram = tomRam();
        expect(bildruta(värld, HAV, ind({ dtMs: SATS_TON_MS / 2 }), ram)).toBe(true);
        expect(värld.satser[0].alfa).toBeCloseTo(0.5, 6);
        bildruta(värld, HAV, ind({ dtMs: SATS_TON_MS / 2 }), ram);
        expect(värld.satser[0].alfa).toBe(1);
        expect(bildruta(värld, HAV, ind(), ram)).toBe(false);
    });

    it('ger moln över öppet hav, med webbens täthet för zoomen', () => {
        const { värld, ram } = intonad(HAV);
        expect(ram.moln.length).toBeGreaterThan(10);
        const zoomTäthet = cloudOpacityForZoom(HAV.zoom);
        for (const s of ram.moln) {
            expect(s.a).toBeGreaterThan(0.004);
            expect(s.a).toBeLessThanOrEqual(zoomTäthet + 1e-9);
            expect(s.bild).toBeGreaterThanOrEqual(0);
            expect(s.bild).toBeLessThan(MOLN_BILDANTAL);
        }
        // Huvudmolnets stämpel: webbens radie, skala och ankare.
        const läge = värld.satser[0].lägen.find(l => ram.moln.some(s => s.nyckel === l.nyckel))!;
        const stämpel = ram.moln.find(s => s.nyckel === läge.nyckel)!;
        const form = MOLN_FORMER[stämpel.bild >> 1];
        const r = läge.moln.radius * cloudScaleFor(HAV.zoom, 6) * (form.uppifrån ? cloudApproachFor(HAV.zoom, 6) : 1);
        expect(stämpel.skala).toBeCloseTo((2 * r) / MOLN_BILD.bredd, 9);
        // Driften står på sin fas även när tiden står still (webbens t = 0).
        const fas = läge.moln.seed * Math.PI * 2;
        const amp = 4 + r * 0.07;
        const p = projicera(HAV, läge.moln.lng, läge.moln.lat)!;
        expect(stämpel.cx).toBeCloseTo(p.x + Math.sin(fas) * amp, 6);
        const h = 2 * r * (MOLN_BILD.höjd / MOLN_BILD.bredd);
        expect(stämpel.cy).toBeCloseTo(p.y + Math.cos(fas * 1.7) * amp * 0.45 + h * (0.5 - form.ankareY), 6);
        expect(stämpel.a).toBeCloseTo(läge.moln.alpha * zoomTäthet, 9);
    });

    it('bilden väljs som på webben: fröet ger form och spegling', () => {
        const { värld, ram } = intonad(HAV);
        for (const l of värld.satser[0].lägen) {
            const s = ram.moln.find(x => x.nyckel === l.nyckel);
            if (s) expect(s.bild).toBe(Math.floor(l.moln.seed * MOLN_BILDANTAL) % MOLN_BILDANTAL);
        }
    });

    it('skuggorna har molnets bild, webbens täthet och faller bort från mitten', () => {
        const { ram } = intonad(HAV);
        expect(ram.skuggor.length).toBeGreaterThan(3);
        for (const sk of ram.skuggor) {
            const moln = ram.moln.find(m => m.nyckel === sk.nyckel.slice(0, -1));
            if (!moln) continue; // molnet självt kan ligga precis utanför skärmen
            expect(sk.bild).toBe(moln.bild);
            expect(sk.skala).toBe(moln.skala);
            expect(sk.a).toBeCloseTo(moln.a * CLOUD_SHADOW_OPACITY, 9);
            // Solen står mitt i bilden: skuggan ligger längre från mitten än molnet.
            const dMoln = Math.hypot(moln.cx - 195, moln.cy - 422);
            const dSkugga = Math.hypot(sk.cx - 195, sk.cy - 422);
            if (dMoln > 60) expect(dSkugga).toBeGreaterThan(dMoln);
        }
    });

    it('där eventen ligger tätt är det klart väder', () => {
        const punkter = Array.from({ length: 4000 }, (_, i) => ({
            lng: HAV.lng + ((i % 80) - 40) * 0.12,
            lat: HAV.lat + (Math.floor(i / 80) - 25) * 0.12,
        }));
        const { ram } = intonad(HAV, { punkter });
        const nära = ram.moln.filter(s => Math.hypot(s.cx - 195, s.cy - 422) < 120);
        expect(nära).toHaveLength(0);
    });

    it('en knuffare får molnen intill att glida undan och stanna där', () => {
        const värld = nyVärld();
        const ram = tomRam();
        for (let i = 0; i < 40; i++) bildruta(värld, HAV, ind(), ram);
        const offer = värld.satser[0].lägen.find(l => ram.moln.some(s => s.nyckel === l.nyckel))!;
        const knuffare = [{ lng: offer.moln.lng + 0.05, lat: offer.moln.lat }];
        let rör = false;
        for (let i = 0; i < 20; i++) rör = bildruta(värld, HAV, ind({ knuffare }), ram);
        expect(rör).toBe(true);
        // Knuffaren står öster om molnet: det glider västerut.
        expect(offer.ox).toBeLessThan(-1);
        expect(offer.ton).toBeGreaterThan(0);
        // Utan knuffare bromsar det in och blir stående förskjutet.
        for (let i = 0; i < 400; i++) rör = bildruta(värld, HAV, ind(), ram);
        expect(rör).toBe(false);
        expect(offer.vx).toBe(0);
        expect(offer.ox).toBeLessThan(-1);
        expect(offer.ton).toBeLessThan(0.01);
    });

    it('en tänd bricka under molnet tunnar ut det, och det kommer tillbaka', () => {
        const { värld, ram } = intonad(HAV);
        const läge = värld.satser[0].lägen.find(l => ram.moln.some(s => s.nyckel === l.nyckel))!;
        const före = ram.moln.find(s => s.nyckel === läge.nyckel)!;
        // Brickans mitt (30 pt ovanför spetsen) mitt i molnbilden.
        const spets = avprojicera(HAV, före.cx, före.cy + 30);
        const fria = [spets];
        for (let i = 0; i < 300; i++) bildruta(värld, HAV, ind({ fria }), ram);
        const under = ram.moln.find(s => s.nyckel === läge.nyckel)!;
        expect(under.a).toBeCloseTo(före.a * (1 - BRICK_TUNNING_MAX), 3);
        for (let i = 0; i < 300; i++) bildruta(värld, HAV, ind(), ram);
        expect(ram.moln.find(s => s.nyckel === läge.nyckel)!.a).toBeCloseTo(före.a, 3);
    });

    it('inzoomat förbi molnens gräns: inga stämplar och knuffen nollställs', () => {
        const { värld, ram } = intonad(HAV);
        const läge = värld.satser[0].lägen[0];
        läge.ox = 40;
        läge.vx = 10;
        const rör = bildruta(värld, { ...HAV, zoom: CLOUD_GONE_ZOOM + 0.5 }, ind(), ram);
        expect(rör).toBe(false);
        expect(ram.moln).toHaveLength(0);
        expect(ram.skuggor).toHaveLength(0);
        expect(värld.rensad).toBe(true);
        expect(värld.satser.every(s => s.lägen.every(l => l.ox === 0 && l.vx === 0))).toBe(true);
        bildruta(värld, HAV, ind(), ram);
        expect(värld.rensad).toBe(false);
    });

    it('driften står still med minskad rörelse och rör sig några pt annars', () => {
        const stilla = intonad(HAV);
        const s1 = stilla.ram.moln.map(s => [s.cx, s.cy]);
        bildruta(stilla.värld, HAV, ind({ nuMs: 5000 }), stilla.ram);
        expect(stilla.ram.moln.map(s => [s.cx, s.cy])).toEqual(s1);

        const fri = intonad(HAV, { stilla: false });
        const före = new Map(fri.ram.moln.map(s => [s.nyckel, s]));
        bildruta(fri.värld, HAV, ind({ stilla: false, nuMs: 5000 }), fri.ram);
        let flyttat = 0;
        for (const s of fri.ram.moln) {
            const f = före.get(s.nyckel);
            if (!f) continue;
            const d = Math.hypot(s.cx - f.cx, s.cy - f.cy);
            expect(d).toBeLessThan(25);
            if (d > 0.5) flyttat++;
        }
        expect(flyttat).toBeGreaterThan(5);
    });

    it('stämplar helt utanför skärmen lämnas, fast molnen lever i marginalen', () => {
        const { värld, ram } = intonad(HAV);
        const levande = värld.satser[0].lägen.length;
        expect(ram.moln.filter(s => !s.nyckel.includes('+')).length).toBeLessThan(levande);
        for (const s of ram.moln) {
            const b = s.skala * MOLN_BILD.bredd;
            expect(s.cx + b / 2).toBeGreaterThanOrEqual(-8);
            expect(s.cx - b / 2).toBeLessThanOrEqual(HAV.bredd + 8);
        }
    });
});

describe('brickgluggen', () => {
    it('är full mitt i molnet och noll utanför', () => {
        expect(brickTunning(0, 0, 60)).toBeCloseTo(BRICK_TUNNING_MAX, 9);
        expect(brickTunning(200, 0, 60)).toBe(0);
        expect(brickTunning(0, 200, 60)).toBe(0);
        const kant = brickTunning(55, 0, 60);
        expect(kant).toBeGreaterThan(0);
        expect(kant).toBeLessThan(BRICK_TUNNING_MAX);
    });
});

describe('platserna', () => {
    const st = (nyckel: string, bild: number, a = 0.5): MolnStämpel => ({ nyckel, bild, cx: 0, cy: 0, skala: 1, a });

    it('en stämpel behåller sin vy mellan bildrutor', () => {
        const platser = nyaPlatser(32);
        const ut: number[] = [];
        fördela(platser, [st('a', 3), st('b', 5)], ut);
        const [a, b] = ut;
        expect(a).not.toBe(b);
        expect(platser.bild[a]).toBe(3);
        fördela(platser, [st('b', 5), st('c', 3), st('a', 3)], ut);
        expect(ut[0]).toBe(b);
        expect(ut[2]).toBe(a);
        expect(ut[1]).not.toBe(a);
    });

    it('lediga vyer med rätt bild används utan att någon bild byts', () => {
        const platser = nyaPlatser(32);
        const ut: number[] = [];
        expect(fördela(platser, [st('a', 3), st('b', 3)], ut)).toBe(false);
        expect(ut.map(i => platser.bild[i])).toEqual([3, 3]);
    });

    it('tar slut på rätt bild: en ledig vy byter bild och det rapporteras', () => {
        const platser = nyaPlatser(16);
        const ut: number[] = [];
        expect(fördela(platser, [st('a', 3), st('b', 3)], ut)).toBe(true);
        expect(ut.every(i => i >= 0)).toBe(true);
        expect(ut.map(i => platser.bild[i])).toEqual([3, 3]);
        // Nästa bildruta: ingen ny ändring.
        expect(fördela(platser, [st('a', 3), st('b', 3)], ut)).toBe(false);
    });

    it('för få vyer: de tunnaste stämplarna blir utan', () => {
        const platser = nyaPlatser(2);
        const ut: number[] = [];
        fördela(platser, [st('tunn', 0, 0.1), st('tät', 0, 0.9), st('mellan', 1, 0.5)], ut);
        expect(ut[0]).toBe(-1);
        expect(ut[1]).toBeGreaterThanOrEqual(0);
        expect(ut[2]).toBeGreaterThanOrEqual(0);
    });

    it('för få vyer: ett litet moln långt bort faller före ett stort lika tätt', () => {
        const platser = nyaPlatser(1);
        const ut: number[] = [];
        fördela(platser, [{ ...st('litet', 0, 0.5), skala: 0.2 }, { ...st('stort', 0, 0.5), skala: 1 }], ut);
        expect(ut).toEqual([-1, 0]);
    });

    it('en vy som släppts kan tas av en ny stämpel', () => {
        const platser = nyaPlatser(16);
        const ut: number[] = [];
        fördela(platser, [st('a', 3)], ut);
        const plats = ut[0];
        fördela(platser, [], ut);
        expect(platser.nyckel[plats]).toBeNull();
        fördela(platser, [st('b', 3)], ut);
        expect(ut[0]).toBe(plats);
    });

    it('en hel skärm öppet hav ryms i lagrets vyer, med lagrets kant', () => {
        const behov = platsBehov(HAV.bredd, HAV.höjd);
        // Sämsta läget: precis före nivåbytet, där rutorna är som minst.
        const { ram } = intonad({ ...HAV, zoom: 5.42 }, { rand: 48 });
        expect(ram.moln.length).toBeLessThanOrEqual(behov.moln);
        expect(ram.skuggor.length).toBeLessThanOrEqual(behov.skuggor);
    });
});

describe('vilotakten', () => {
    it('en tänd bricka i molnets kant håller inte bildrutetakten uppe när molnen driver', () => {
        const värld = nyVärld();
        const ram = tomRam();
        for (let i = 0; i < 40; i++) bildruta(värld, HAV, ind({ stilla: false, nuMs: i * 16 }), ram);
        // Brickor i kanten på varje synligt moln: gluggen är varken noll eller full.
        const fria = ram.moln
            .filter(s => !s.nyckel.includes('+'))
            .map(s => avprojicera(HAV, s.cx + s.skala * 256 * 0.35, s.cy + 30));
        let rör = true;
        for (let i = 40; i < 400; i++) rör = bildruta(värld, HAV, ind({ stilla: false, nuMs: i * 16, fria }), ram);
        expect(rör).toBe(false);
    });

    it('ett moln som tonar in utanför skärmen kräver ingen ny bildruta', () => {
        const värld = nyVärld();
        const ram = tomRam();
        for (let i = 0; i < 40; i++) bildruta(värld, HAV, ind(), ram);
        // Flytta vyn en halv marginal: nya moln föds långt utanför skärmen.
        const nära = { ...HAV, lng: HAV.lng + 0.25 };
        byggOm(värld, [], nära);
        const nya = värld.satser[0].lägen.filter(l => l.kvar && l.syn === 0);
        expect(nya.length).toBeGreaterThan(0);
        // Alla ligger ute i marginalen, minst 100 pt från skärmen.
        for (const l of nya) {
            const p = projicera(nära, l.moln.lng, l.moln.lat)!;
            expect(p.x < -100 || p.x > nära.bredd + 100 || p.y < -100 || p.y > nära.höjd + 100).toBe(true);
        }
        expect(bildruta(värld, nära, ind(), ram)).toBe(false);
        // De förs framåt ändå.
        expect(nya.every(l => l.syn > 0)).toBe(true);
    });
});

describe('behållaren', () => {
    const KAMEROR: [MolnKamera, MolnKamera][] = [
        [HAV, { ...HAV, lng: 2.4, lat: 61.8 }],
        [HAV, { ...HAV, zoom: 6.7 }],
        [HAV, { ...HAV, lng: 1.7, lat: 62.3, zoom: 5.4 }],
        [{ ...HAV, bäring: 30 }, { ...HAV, bäring: 30, lng: 2.6, zoom: 6.3 }],
        [{ ...HAV, mittY: 434 }, { ...HAV, mittY: 434, lng: 2.2, lat: 62.1, zoom: 6.5 }],
    ];

    it('samma kamera: lagret står orört', () => {
        expect(behållareFör(HAV, HAV)).toEqual({ tx: 0, ty: 0, skala: 1 });
    });

    it('flytt + skalning kring lagrets mitt ger samma läge som kartans projektion', () => {
        for (const [ankare, kamera] of KAMEROR) {
            expect(sammaPlan(ankare, kamera)).toBe(true);
            const b = behållareFör(ankare, kamera);
            for (const [lng, lat] of [[2, 62], [3.1, 61.2], [0.4, 63.5], [2.9, 62.9]]) {
                const iAnkaret = projicera(ankare, lng, lat)!;
                const rätt = projicera(kamera, lng, lat)!;
                // En vy som skalas kring lagrets mitt och sedan flyttas.
                const x = kamera.bredd / 2 + b.skala * (iAnkaret.x - kamera.bredd / 2) + b.tx;
                const y = kamera.höjd / 2 + b.skala * (iAnkaret.y - kamera.höjd / 2) + b.ty;
                expect(x).toBeCloseTo(rätt.x, 6);
                expect(y).toBeCloseTo(rätt.y, 6);
            }
        }
    });

    it('vriden, lutad eller långt bort: lagret måste läggas ut på nytt', () => {
        expect(sammaPlan(HAV, { ...HAV, bäring: 5 })).toBe(false);
        expect(sammaPlan(HAV, { ...HAV, lutning: 20 })).toBe(false);
        expect(sammaPlan({ ...HAV, lutning: 20 }, { ...HAV, lutning: 20 })).toBe(false);
        expect(sammaPlan(HAV, { ...HAV, zoom: 7.5 })).toBe(false);
        expect(sammaPlan(HAV, { ...HAV, lng: 30 })).toBe(false);
        expect(sammaPlan(HAV, { ...HAV, bredd: 844, höjd: 390 })).toBe(false);
        expect(sammaPlan(HAV, { ...HAV, mittY: 434 })).toBe(false);
    });
});

describe('utläggningen', () => {
    const ORÖRD = { tx: 0, ty: 0, skala: 1 };
    const st = (nyckel: string, bild: number, cx: number, cy: number, skala = 0.5, a = 0.4): MolnStämpel => ({ nyckel, bild, cx, cy, skala, a });

    it('lägger bildens mitt på stämpelns mitt', () => {
        const vyer = läggIVyer(tommaVyer(4), [st('a', 3, 200, 300)], [2], ORÖRD, 390, 844);
        expect(vyer[2]).toEqual({ bild: 3, x: 200 - 128, y: 300 - 84, s: 0.5, a: 0.4 });
        expect(vyer[0].a).toBe(0);
    });

    it('oförändrat: samma lista och samma objekt', () => {
        const stämplar = [st('a', 3, 200, 300), st('b', 5, 90, 610)];
        const första = läggIVyer(tommaVyer(4), stämplar, [2, 0], ORÖRD, 390, 844);
        const andra = läggIVyer(första, stämplar, [2, 0], ORÖRD, 390, 844);
        expect(andra).toBe(första);
        // Bara den som ändrats byter objekt.
        const tredje = läggIVyer(första, [stämplar[0], st('b', 5, 95, 610)], [2, 0], ORÖRD, 390, 844);
        expect(tredje).not.toBe(första);
        expect(tredje[2]).toBe(första[2]);
        expect(tredje[0]).not.toBe(första[0]);
        expect(tredje[0].x).toBe(95 - 128);
    });

    it('en rörelse mindre än en kvarts pt byter inget', () => {
        const första = läggIVyer(tommaVyer(2), [st('a', 3, 200, 300)], [0], ORÖRD, 390, 844);
        expect(läggIVyer(första, [st('a', 3, 200.05, 300.05)], [0], ORÖRD, 390, 844)).toBe(första);
    });

    it('en vy utan stämpel döljs, och en stämpel utan vy hoppas över', () => {
        const första = läggIVyer(tommaVyer(2), [st('a', 3, 200, 300)], [0], ORÖRD, 390, 844);
        const andra = läggIVyer(första, [st('b', 4, 10, 10)], [-1], ORÖRD, 390, 844);
        expect(andra[0].a).toBe(0);
        expect(andra[0].bild).toBe(3);
        expect(läggIVyer(andra, [], [], ORÖRD, 390, 844)).toBe(andra);
    });

    it('lagret flyttat och skalat: vyn läggs i lagrets egna koordinater', () => {
        // Lagret är förstorat 2x och flyttat 10 pt åt höger.
        const b = { tx: 10, ty: 0, skala: 2 };
        const [vy] = läggIVyer(tommaVyer(1), [st('a', 3, 205, 422, 1)], [0], b, 390, 844);
        expect(vy.s).toBe(0.5);
        // Tillbaka genom lagrets flytt och skala hamnar bildens mitt på stämpeln.
        expect(195 + 2 * (vy.x + 128 - 195) + 10).toBeCloseTo(205, 6);
        expect(422 + 2 * (vy.y + 84 - 422)).toBeCloseTo(422, 6);
    });
});
