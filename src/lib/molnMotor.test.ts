import { describe, expect, it } from 'vitest';
import { CLOUD_GONE_ZOOM } from '@vadkul/kontrakt';
import { avprojicera, VILO_RAM_MS, type MolnKamera } from './moln';
import { MOLN_BILD } from './molnFormer.generated';
import { MolnMotor, tomBild, type MolnBild, type MotorKlocka, type MolnVy } from './molnMotor';

/** En klocka som testet vrider själv: bildrutor var 16:e ms, timrar i tidsordning. */
function testKlocka() {
    let nu = 1000;
    let id = 0;
    const bildrutor = new Map<number, (nu: number) => void>();
    const timrar = new Map<number, { vid: number; fn: () => void }>();
    const klocka: MotorKlocka = {
        nu: () => nu,
        nästaBildruta: fn => { bildrutor.set(++id, fn); return id; },
        avbrytBildruta: h => { bildrutor.delete(h as number); },
        senare: (fn, ms) => { timrar.set(++id, { vid: nu + ms, fn }); return id; },
        avbrytSenare: h => { timrar.delete(h as number); },
    };
    /** Kör tiden framåt i 16 ms-steg. */
    const gå = (ms: number) => {
        const slut = nu + ms;
        while (nu < slut) {
            nu += 16;
            for (const [k, t] of [...timrar]) {
                if (t.vid <= nu) { timrar.delete(k); t.fn(); }
            }
            for (const [k, fn] of [...bildrutor]) { bildrutor.delete(k); fn(nu); }
        }
    };
    return { klocka, gå, väntar: () => bildrutor.size + timrar.size, flytta: (ms: number) => { nu += ms; } };
}

// Öppet hav: molnigt överallt.
const HAV: MolnVy = { center: [2, 62], zoom: 6, bearing: 0, pitch: 0 };
const HAV_KAMERA: MolnKamera = { lng: 2, lat: 62, zoom: 6, bäring: 0, lutning: 0, bredd: 390, höjd: 844 };
const BEHOV = { moln: 150, skuggor: 70 };
const synliga = (b: MolnBild) => b.moln.filter(d => d.a > 0).length;

function uppställning() {
    const k = testKlocka();
    const bilder: MolnBild[] = [];
    const motor = new MolnMotor({ visa: b => { bilder.push(b); } }, BEHOV, k.klocka);
    const senast = () => bilder[bilder.length - 1] ?? tomBild(BEHOV);
    /** Molnen står stilla (minskad rörelse) och har tonat in. */
    const stillaIHavet = () => {
        motor.sättStilla(true);
        motor.sättStorlek(390, 844);
        motor.stannat(HAV);
        k.gå(800);
    };
    return { ...k, motor, bilder, senast, stillaIHavet };
}

describe('molnmotorn', () => {
    it('gör ingenting förrän den har både vy och storlek', () => {
        const u = uppställning();
        u.motor.sättPunkter([]);
        u.gå(200);
        expect(u.bilder).toHaveLength(0);
        expect(u.väntar()).toBe(0);
        u.motor.sättStorlek(390, 844);
        u.gå(200);
        expect(u.bilder).toHaveLength(0);
        u.motor.stannat(HAV);
        u.gå(32);
        expect(u.bilder.length).toBeGreaterThan(0);
    });

    it('tonar in molnen och går sedan ner i vilotakt', () => {
        const u = uppställning();
        u.motor.sättStorlek(390, 844);
        u.motor.stannat(HAV);
        u.gå(600);
        const efterToning = u.bilder.length;
        // Toningen (420 ms) ritas i varje bildruta.
        expect(efterToning).toBeGreaterThan(20);
        expect(synliga(u.senast())).toBeGreaterThan(10);
        // Vila: driften läggs ut glest, högst en gång per VILO_RAM_MS.
        u.gå(1600);
        const vila = u.bilder.length - efterToning;
        expect(vila).toBeGreaterThan(3);
        expect(vila).toBeLessThanOrEqual(Math.ceil(1600 / VILO_RAM_MS) + 1);
    });

    it('minskad rörelse: efter toningen står slingan helt still', () => {
        const u = uppställning();
        u.stillaIHavet();
        const n = u.bilder.length;
        u.gå(2000);
        expect(u.bilder.length).toBe(n);
        expect(u.väntar()).toBe(0);
    });

    it('utan rörelse står lagret orört: ingen flytt, ingen skalning', () => {
        const u = uppställning();
        u.stillaIHavet();
        const b = u.senast();
        expect([b.tx, b.ty, b.skala]).toEqual([0, 0, 1]);
        // Vyerna ligger i skärmens koordinater: bildens mitt inom skärmen plus kanten.
        for (const d of b.moln) {
            if (d.a <= 0) continue;
            const bredd = d.s * MOLN_BILD.bredd;
            expect(d.x + MOLN_BILD.bredd / 2 + bredd / 2).toBeGreaterThanOrEqual(-48);
            expect(d.x + MOLN_BILD.bredd / 2 - bredd / 2).toBeLessThanOrEqual(390 + 48);
        }
    });

    it('en panorering flyttar hela lagret som kartan, utan att lägga ut molnen i varje bildruta', () => {
        const u = uppställning();
        u.stillaIHavet();
        const start = u.senast();
        const n = u.bilder.length;
        // 20 händelser, 16 ms isär, en kvarts pt österut per händelse (kartan
        // går åt vänster) - så lite att inga nya moln kommer in i bild.
        const ptPerGrad = (512 * 2 ** 6) / 360;
        for (let i = 1; i <= 20; i++) {
            u.flytta(16);
            u.motor.rörelse({ ...HAV, center: [2 + (i * 0.25) / ptPerGrad, 62] });
            const b = u.senast();
            expect(b.tx).toBeCloseTo(-i * 0.25, 6);
            expect(b.ty).toBeCloseTo(0, 6);
            expect(b.skala).toBe(1);
        }
        // Varje händelse flyttade lagret...
        expect(u.bilder.length - n).toBe(20);
        // ...men molnen lades bara ut på nytt i vilotakt (320 ms = högst en handfull gånger).
        let utlägg = 0;
        let förra = start;
        for (const b of u.bilder.slice(n)) {
            if (b.moln !== förra.moln || b.skuggor !== förra.skuggor) utlägg++;
            förra = b;
        }
        expect(utlägg).toBeLessThanOrEqual(6);
    });

    it('ett moln som inte ändrats behåller sitt objekt när molnen läggs ut på nytt', () => {
        const u = uppställning();
        u.stillaIHavet();
        const före = u.senast();
        const ptPerGrad = (512 * 2 ** 6) / 360;
        // En liten panorering och stopp: ankaret står kvar, så molnen mitt i bild är orörda.
        u.flytta(16);
        u.motor.rörelse({ ...HAV, center: [2 + 10 / ptPerGrad, 62] });
        u.motor.stannat({ ...HAV, center: [2 + 10 / ptPerGrad, 62] });
        u.gå(200);
        const efter = u.senast();
        const orörda = efter.moln.filter((d, i) => d.a > 0 && d === före.moln[i]).length;
        expect(orörda).toBeGreaterThan(synliga(efter) / 2);
    });

    it('en zoomning skalar lagret kring kartans mitt', () => {
        const u = uppställning();
        u.stillaIHavet();
        u.flytta(16);
        u.motor.rörelse({ ...HAV, zoom: 6.25 });
        const b = u.senast();
        expect(b.skala).toBeCloseTo(2 ** 0.25, 9);
        expect(b.tx).toBeCloseTo(0, 6);
        expect(b.ty).toBeCloseTo(0, 6);
    });

    it('kartan flyttas förbi lagrets kant: molnen läggs ut på nytt direkt', () => {
        const u = uppställning();
        u.stillaIHavet();
        const före = u.senast();
        const ptPerGrad = (512 * 2 ** 6) / 360;
        u.flytta(16);
        u.motor.rörelse({ ...HAV, center: [2 + 120 / ptPerGrad, 62] });
        const efter = u.senast();
        expect(efter.moln).not.toBe(före.moln);
        expect(efter.tx).toBeCloseTo(-120, 6);
    });

    it('vriden karta: lagret läggs ut på nytt i stället för att vridas', () => {
        const u = uppställning();
        u.stillaIHavet();
        u.flytta(16);
        u.motor.rörelse({ ...HAV, bearing: 20 });
        const b = u.senast();
        // Nytt ankare: lagret står orört och vyerna har nya lägen.
        expect([b.tx, b.ty, b.skala]).toEqual([0, 0, 1]);
        expect(synliga(b)).toBeGreaterThan(10);
    });

    it('inzoomat förbi molnens gräns: bilden töms en gång och motorn somnar', () => {
        const u = uppställning();
        u.motor.sättStorlek(390, 844);
        u.motor.stannat(HAV);
        u.gå(800);
        u.motor.stannat({ ...HAV, zoom: CLOUD_GONE_ZOOM + 1 });
        u.gå(64);
        expect(synliga(u.senast())).toBe(0);
        expect(u.senast().skuggor.every(d => d.a === 0)).toBe(true);
        const n = u.bilder.length;
        u.gå(2000);
        expect(u.bilder.length).toBe(n);
        expect(u.väntar()).toBe(0);
        // Rörelser där inne ritar ingenting.
        u.flytta(16);
        u.motor.rörelse({ ...HAV, zoom: CLOUD_GONE_ZOOM + 1, center: [2.1, 62] });
        expect(u.bilder.length).toBe(n);
        // Ut igen: molnen kommer tillbaka.
        u.motor.stannat(HAV);
        u.gå(800);
        expect(synliga(u.senast())).toBeGreaterThan(10);
    });

    it('ett tryck skingrar molnen där, och en zoomning avväpnar trycket', () => {
        const u = uppställning();
        u.stillaIHavet();
        const före = u.senast();
        const i = före.moln.findIndex(d => d.a > 0);
        const offer = före.moln[i];
        // Tryck strax öster om molnets mitt: molnen intill glider undan och blir stående.
        const tryck = avprojicera(HAV_KAMERA, offer.x + MOLN_BILD.bredd / 2 + 25, offer.y + MOLN_BILD.höjd / 2);
        u.motor.tryck(tryck);
        // Glidningen bromsar in mjukt (650 ms tidskonstant) - det tar några sekunder.
        u.gå(8000);
        const efter = u.senast();
        const flyttade = efter.moln.filter((d, j) => {
            const f = före.moln[j];
            return d.a > 0 && f.a > 0 && d.bild === f.bild && Math.hypot(d.x - f.x, d.y - f.y) > 3;
        });
        expect(flyttade.length).toBeGreaterThan(0);
        // Slingan somnar när glidningen bromsat in.
        expect(u.väntar()).toBe(0);

        // Zooma lite: trycket är avväpnat, ingenting glider vidare.
        u.motor.stannat({ ...HAV, zoom: 6.05 });
        u.gå(800);
        const n = u.bilder.length;
        u.gå(1000);
        expect(u.bilder.length).toBe(n);
    });

    it('ny eventlista bygger om molnen: tätt med event ger klart väder', () => {
        const u = uppställning();
        u.stillaIHavet();
        const molnigt = synliga(u.senast());
        const punkter = Array.from({ length: 6000 }, (_, i) => ({
            lng: 2 + ((i % 100) - 50) * 0.12,
            lat: 62 + (Math.floor(i / 100) - 30) * 0.12,
        }));
        u.motor.sättPunkter(punkter);
        u.gå(1200);
        expect(synliga(u.senast())).toBeLessThan(molnigt / 4);
    });

    it('pausad (skärmen visas inte) ritar ingenting, och fortsätter när den väcks', () => {
        const u = uppställning();
        u.motor.sättStorlek(390, 844);
        u.motor.stannat(HAV);
        u.gå(800);
        u.motor.sättAktiv(false);
        expect(u.väntar()).toBe(0);
        const n = u.bilder.length;
        u.gå(1000);
        u.flytta(16);
        u.motor.rörelse({ ...HAV, center: [2.05, 62] });
        expect(u.bilder.length).toBe(n);
        u.motor.sättAktiv(true);
        u.gå(200);
        expect(u.bilder.length).toBeGreaterThan(n);
    });

    it('stängd motor lämnar inga timrar efter sig', () => {
        const u = uppställning();
        u.motor.sättStorlek(390, 844);
        u.motor.stannat(HAV);
        u.gå(100);
        u.motor.stäng();
        expect(u.väntar()).toBe(0);
        u.motor.sättPunkter([]);
        u.motor.stannat(HAV);
        expect(u.väntar()).toBe(0);
    });

    it('en händelse utan kamera kastar inte', () => {
        const u = uppställning();
        u.motor.sättStorlek(390, 844);
        expect(() => u.motor.rörelse({} as MolnVy)).not.toThrow();
        expect(() => u.motor.stannat({} as MolnVy)).not.toThrow();
        expect(u.bilder).toHaveLength(0);
    });

    it('en uppmätt kameramitt flyttar molnen, en mätning under rörelse släpps', () => {
        const u = uppställning();
        u.stillaIHavet();
        const före = u.senast();
        // iOS: mitten ligger 12 pt under vyns mitt (statusraden är högre än hemstrecket).
        u.motor.sättMitt(195, 434);
        u.gå(800);
        const efter = u.senast();
        expect([efter.tx, efter.ty, efter.skala]).toEqual([0, 0, 1]);
        let jämförda = 0;
        efter.moln.forEach((d, i) => {
            const f = före.moln[i];
            if (d.a <= 0 || f.a <= 0 || d.bild !== f.bild || d.s !== f.s) return;
            expect(d.y - f.y).toBeCloseTo(12, 0);
            expect(d.x).toBeCloseTo(f.x, 0);
            jämförda++;
        });
        expect(jämförda).toBeGreaterThan(10);
        // I sidled eller långt bort: kartan rörde sig under mätningen.
        const n = u.bilder.length;
        u.motor.sättMitt(240, 434);
        u.motor.sättMitt(195, 700);
        u.gå(200);
        expect(u.bilder.length).toBe(n);
    });
});
