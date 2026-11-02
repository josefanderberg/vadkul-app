/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { EVENT_CATEGORY_KEYS } from '@vadkul/kontrakt';
import { BRICKA_NYCKLAR } from './brickNycklar.generated';
import { brickaIkon } from './brickor';
import {
    avkodaPng,
    emojiBild,
    emojiBildDelar,
    emojiBildFil,
    emojiId,
    kodaPng,
    läggPå,
    medEmojiBilder,
    type Rgba,
} from './emojiBricka';
import { BRICK_RUTA, EMOJI_LÄGE, KROPP_NYCKLAR } from './emojiNycklar.generated';
import { kategoriFor } from './kategorier';

const png = (namn: string) => avkodaPng(new Uint8Array(readFileSync(fileURLToPath(new URL(`../../assets/brickor/${namn}.png`, import.meta.url)))));

describe('emojiId', () => {
    it('hex-kodpunkter utan VS16, så 🍽 och 🍽️ blir samma', () => {
        expect(emojiId('🤿')).toBe('1f93f');
        expect(emojiId('🍽️')).toBe(emojiId('🍽'));
        expect(emojiId('🧑‍🤝‍🧑')).toBe('1f9d1-200d-1f91d-200d-1f9d1');
        expect(emojiId('')).toBe('');
    });
    it('varje bakad emoji ligger under sitt eget id', () => {
        for (const [id, { e }] of Object.entries(EMOJI_LÄGE)) expect(emojiId(e)).toBe(id);
    });
});

describe('emojiBild', () => {
    it('dykmasken på en sportbricka blir en egen bild (Josefs ⚽/🤿 1/11)', () => {
        expect(emojiBild('bricka-sport', '🤿', '⚽')).toBe('bricka-sport~1f93f');
        expect(emojiBild('bricka-sport-vald', '🤿', '⚽')).toBe('bricka-sport-vald~1f93f');
    });
    it('ingen egen bild när brickan redan bär emojin', () => {
        expect(emojiBild('bricka-sport', '⚽', '⚽')).toBe('');
        expect(emojiBild('bricka-food', '🍽', '🍽️')).toBe('');
    });
    it('ingen egen bild för en emoji som inte är bakad - kategorins bricka står kvar', () => {
        expect(emojiBild('bricka-sport', 'x', '⚽')).toBe('');
    });
    it('delarna och filnamnet går att läsa ur nyckeln', () => {
        expect(emojiBildDelar('bricka-sport-guld-vald~1f93f')).toEqual({ kropp: 'kropp-sport-guld-vald', id: '1f93f' });
        expect(emojiBildDelar('bricka-sport')).toBeNull();
        expect(emojiBildFil('bricka-sport~1f93f')).toBe('bricka-sport_1f93f.png');
    });
    it('varje bricka har en kropp att sätta ihop på', () => {
        const kroppar = new Set(KROPP_NYCKLAR);
        for (const n of BRICKA_NYCKLAR.filter(x => x.startsWith('bricka-'))) {
            expect(kroppar.has(n.replace(/^bricka-/, 'kropp-'))).toBe(true);
        }
        for (const cat of EVENT_CATEGORY_KEYS) {
            const ikon = brickaIkon({ category: cat, guld: true, vald: true });
            expect(emojiBildDelar(`${ikon}~1f93f`)!.kropp).toBe(`kropp-${cat}-guld-vald`);
        }
    });
});

describe('medEmojiBilder', () => {
    const fc = {
        type: 'FeatureCollection' as const,
        features: [
            { type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [0, 0] }, properties: { ikon: 'bricka-sport', emojiBild: 'bricka-sport~1f93f' } },
            { type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [1, 1] }, properties: { ikon: 'bricka-art', emojiBild: 'bricka-art~1f3b8' } },
            { type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [2, 2] }, properties: { ikon: 'bricka-music', emojiBild: '' } },
        ],
    };
    it('byter bara till bilder som är klara', () => {
        const ut = medEmojiBilder(fc, new Set(['bricka-sport~1f93f']));
        expect(ut.features.map(f => f.properties.ikon)).toEqual(['bricka-sport~1f93f', 'bricka-art', 'bricka-music']);
    });
    it('rör inget när inget är klart', () => {
        expect(medEmojiBilder(fc, new Set())).toBe(fc);
    });
});

describe('PNG och sammansättning', () => {
    it('kodar och avkodar samma pixlar', () => {
        const bild: Rgba = { bredd: 3, höjd: 2, data: new Uint8Array([255, 0, 0, 255, 0, 255, 0, 128, 0, 0, 255, 0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]) };
        expect(avkodaPng(kodaPng(bild))).toEqual(bild);
        // En riktig kropp: jämför byte för byte utan att skriva ut 148 000 tal vid fel.
        const kropp = png('kropp-sport');
        const tillbaka = avkodaPng(kodaPng(kropp));
        expect([tillbaka.bredd, tillbaka.höjd]).toEqual([kropp.bredd, kropp.höjd]);
        expect(tillbaka.data.every((v, i) => v === kropp.data[i])).toBe(true);
    }, 30_000);
    it('source-over: täckande emoji ersätter, halvgenomskinlig blandas, genomskinlig lämnar', () => {
        const kropp: Rgba = { bredd: 3, höjd: 1, data: new Uint8Array([100, 100, 100, 255, 100, 100, 100, 255, 0, 0, 0, 0]) };
        const emoji: Rgba = { bredd: 3, höjd: 1, data: new Uint8Array([200, 0, 0, 255, 200, 0, 0, 0, 200, 0, 0, 128]) };
        expect(Array.from(läggPå(kropp, emoji, 0, 0).data)).toEqual([200, 0, 0, 255, 100, 100, 100, 255, 200, 0, 0, 128]);
        // Utanför rutan klipps: bara emojins första pixel hamnar i kroppen.
        expect(Array.from(läggPå(kropp, emoji, 2, 0).data)).toEqual([100, 100, 100, 255, 100, 100, 100, 255, 200, 0, 0, 255]);
        expect(kropp.data[0]).toBe(100);
    });

    // GULDTESTET för hela kedjan: kropp + kategorins emoji på webbens plats
    // ska bli den förbakade brickan (webbens egen bild). Bryts det har
    // bakningen, avkodningen, sammansättningen eller appens kategori-emojier
    // glidit isär från webbens.
    it('kropp + kategorins emoji = den förbakade brickan, i alla varianter', () => {
        let värst = 0;
        for (const cat of EVENT_CATEGORY_KEYS) {
            const id = emojiId(kategoriFor(cat).emoji);
            const läge = EMOJI_LÄGE[id];
            expect(läge).toBeDefined();
            const emoji = png(`emoji/${id}`);
            for (const variant of ['', '-pop', '-vald', '-sparad', '-guld-vald', '-gron']) {
                const kropp = png(`kropp-${cat}${variant}`);
                expect([kropp.bredd, kropp.höjd]).toEqual([BRICK_RUTA.bredd, BRICK_RUTA.höjd]);
                const ihop = läggPå(kropp, emoji, läge.x, läge.y).data;
                const facit = png(`bricka-${cat}${variant}`).data;
                // Förmultiplicerat (färg × alfa) - det som syns. I nästan
                // genomskinliga kantpixlar är 8-bitarsfärgen grov i sig.
                for (let i = 0; i < facit.length; i += 4) {
                    const a = ihop[i + 3] / 255;
                    const b = facit[i + 3] / 255;
                    for (let k = 0; k < 3; k++) värst = Math.max(värst, Math.abs(ihop[i + k] * a - facit[i + k] * b));
                    värst = Math.max(värst, Math.abs(ihop[i + 3] - facit[i + 3]));
                }
            }
        }
        expect(värst).toBeLessThanOrEqual(3);
    }, 30_000);
});
