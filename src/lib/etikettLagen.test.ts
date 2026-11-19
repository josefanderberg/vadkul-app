import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
    ETIKETT_LÄGEN,
    ETIKETT_LUFT,
    ETIKETT_TEXTSTORLEK,
    etikettRuta,
    HINDER_BADGE,
    HINDER_BILDER,
    HINDER_HÖGER,
    HINDER_VÄNSTER,
    hinderIkon,
    hinderRuta,
    KATEGORI_LÄGE,
    KROPP_MITT_OVAN,
    KROPP_RUTA,
    SPRINGA_HALV,
    SPÄRR_RUTA,
    titelLagerId,
    överlappar,
    type Ruta,
} from './etikettLagen';

const STORLEKAR = ETIKETT_TEXTSTORLEK.map(([, pt]) => pt);
const BREDDER = [12, 40, 90, 160];
const halvor = [hinderRuta(HINDER_VÄNSTER), hinderRuta(HINDER_HÖGER)];
const badge = hinderRuta(HINDER_BADGE);

describe('lägena (webbens LABEL_TITLE_PLACEMENTS)', () => {
    it('samma åtta lägen i samma ordning som webben, under först', () => {
        expect(ETIKETT_LÄGEN.map(([a]) => a)).toEqual([
            'top', 'left', 'right', 'bottom', 'top-left', 'top-right', 'bottom-left', 'bottom-right',
        ]);
        expect(ETIKETT_LÄGEN[0]).toEqual(['top', [0, 0.35]]);
        expect(KATEGORI_LÄGE).toEqual(['top', [0, 0.35]]);
    });

    it('under, höger, vänster och över krockar aldrig med den egna kroppen', () => {
        for (const [ankare, förskj] of ETIKETT_LÄGEN.slice(0, 4)) {
            for (const pt of STORLEKAR) {
                for (const b of BREDDER) {
                    const r = etikettRuta(ankare, förskj, pt, b);
                    for (const h of halvor) expect(överlappar(r, h), `${ankare} ${pt}pt ${b}pt`).toBe(false);
                }
            }
        }
    });

    it('vid sidan står titeln i höjd med kroppen, över står den ovanför brickan', () => {
        const pt = 12;
        const höger = etikettRuta('left', [2.4, -2.5], pt, 60);
        expect(höger.x0).toBeGreaterThan(KROPP_RUTA.x1);
        expect(höger.y0).toBeLessThan(-KROPP_MITT_OVAN + 10);
        const över = etikettRuta('bottom', [0, -5.3], pt, 60);
        expect(över.y1).toBeLessThan(KROPP_RUTA.y0);
    });

    it('snett ovanför åt vänster går fri från +N-pillen', () => {
        for (const pt of STORLEKAR) {
            expect(överlappar(etikettRuta('bottom-right', [0.25, -5.3], pt, 90), badge)).toBe(false);
        }
    });
});

describe('krockytorna (webbens #204)', () => {
    it('halvorna täcker hela kroppen utom springan', () => {
        expect(halvor[0].x0).toBeLessThanOrEqual(KROPP_RUTA.x0);
        expect(halvor[1].x1).toBeGreaterThanOrEqual(KROPP_RUTA.x1);
        expect(halvor[0].x1).toBe(-SPRINGA_HALV);
        expect(halvor[1].x0).toBe(SPRINGA_HALV);
        expect(halvor[0].y0).toBe(KROPP_RUTA.y0);
        // Avrundningen uppåt får aldrig nå ner till spetsen.
        expect(halvor[0].y1).toBeLessThan(0);
    });

    it('bilderna har krockytornas mått, halvorna delar bild', () => {
        expect(HINDER_BILDER['hinder-halva']).toEqual({ width: hinderIkon(HINDER_HÖGER).width, height: hinderIkon(HINDER_HÖGER).height });
        expect(hinderIkon(HINDER_VÄNSTER).width).toBe(hinderIkon(HINDER_HÖGER).width);
        expect(HINDER_BILDER['hinder-badge']).toEqual({ width: 20, height: 20 });
    });

    it('PNG:erna i assets/hinder har exakt de måtten (och är genomskinliga RGBA)', () => {
        for (const [namn, mått] of Object.entries(HINDER_BILDER)) {
            const png = readFileSync(new URL(`../../assets/hinder/${namn}.png`, import.meta.url));
            expect(png.readUInt32BE(16), namn).toBe(mått.width);
            expect(png.readUInt32BE(20), namn).toBe(mått.height);
            expect(png[25], `${namn} färgtyp`).toBe(6);
        }
    });
});

describe('spärren', () => {
    it('står i springan mitt i kroppen och rör ingen halva', () => {
        for (const h of halvor) expect(överlappar(SPÄRR_RUTA, h)).toBe(false);
        expect(SPÄRR_RUTA.y0).toBeGreaterThan(KROPP_RUTA.y0);
        expect(SPÄRR_RUTA.y1).toBeLessThan(KROPP_RUTA.y1);
    });

    it('ingen titel kan ta spärrens plats utan att krocka med en halva', () => {
        // Den smalaste tänkbara titeln: ett tecken vid minsta storleken.
        const minsta = 6 + 2 * ETIKETT_LUFT;
        expect(minsta).toBeGreaterThan(2 * SPRINGA_HALV);
        // Svep en sådan ruta över hela området kring kroppen.
        for (let x = -40; x <= 40; x += 0.5) {
            for (let y = -70; y <= 5; y += 0.5) {
                const r: Ruta = { x0: x, x1: x + minsta, y0: y, y1: y + 14 };
                if (överlappar(r, SPÄRR_RUTA)) {
                    expect(halvor.some(h => överlappar(r, h)), `${x},${y}`).toBe(true);
                }
            }
        }
    });

    it('titeln under spetsen rör inte spärren', () => {
        for (const pt of STORLEKAR) expect(överlappar(etikettRuta('top', [0, 0.35], pt, 90), SPÄRR_RUTA)).toBe(false);
    });
});

describe('titelLagerId', () => {
    it('ett id per läge och källa, 1-baserat', () => {
        expect(titelLagerId('etikett', 0)).toBe('etikett-titel-1');
        expect(titelLagerId('hal', 7)).toBe('hal-titel-8');
    });
});
