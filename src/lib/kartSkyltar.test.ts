import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
    BAD_SIGN_LAYER_ID, BAD_SIGN_SOURCE_ID, pickPoiSignHit, POI_SIGN_CLOSE_LAYER_ID, POI_SIGN_CLOSE_MIN_ZOOM, POI_SIGN_HIT, POI_SIGN_KEYS, POI_SIGN_LAYER_ID,
    POI_SIGN_LAYER_IDS, POI_SIGN_MIN_ZOOM, POI_SIGN_NAME_ZOOM, POI_SIGN_NEAR_LAYER_ID, POI_SIGN_NEAR_MIN_ZOOM,
} from '@vadkul/kontrakt';
import {
    BADPLATS_URL, harSkyltar, läggTillSkyltar, SKYLT_MIN_ZOOM, SKYLT_NAMN_ZOOM, SKYLT_NÄRA_ZOOM, SKYLT_NÄRMAST_ZOOM, SKYLT_SKALA,
    skyltFrågeruta, skyltKandidater,
} from './kartSkyltar';
import { BAKADE_SKYLTAR, SKYLT_BILD } from './skyltMatt.generated';
import type { StyleJson, StyleLayerJson } from './themeParkStyle';

const FONT = ['Montserrat SemiBold', 'Open Sans Bold'];
function voyagerLik(): StyleJson {
    return {
        version: 8,
        sources: { protomaps: { type: 'vector', tiles: ['https://example.invalid/{z}/{x}/{y}.mvt'] } },
        layers: [
            { id: 'background', type: 'background' },
            { id: 'water', type: 'fill', source: 'protomaps', 'source-layer': 'water' },
            { id: 'place_town', type: 'symbol', source: 'protomaps', 'source-layer': 'places', layout: { 'text-font': FONT } },
            { id: 'poi_park', type: 'symbol', source: 'protomaps', 'source-layer': 'pois', layout: { 'text-font': FONT } },
        ],
    };
}
const lager = (s: StyleJson, id: string) => s.layers!.find(l => l.id === id) as StyleLayerJson;
const punkt = (kind: unknown, name: unknown, lng = 14.8, lat = 56.88): GeoJSON.Feature => ({
    type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] }, properties: { kind, name },
});

describe('skyltbilderna', () => {
    // Faller när kontraktet fått en ny skylt som inte bakats:
    // kör `node scripts/baka-skyltar.mjs`.
    it('varje skylt i kontraktet är bakad, i kontraktets ordning', () => {
        expect(BAKADE_SKYLTAR).toEqual(POI_SIGN_KEYS);
        for (const nyckel of POI_SIGN_KEYS) {
            const fil = fileURLToPath(new URL(`../../assets/skyltar/${nyckel}.png`, import.meta.url));
            expect(existsSync(fil), `${nyckel}.png saknas`).toBe(true);
        }
    });

    it('lagret skalar ner bilden lika mycket som den är bakad tätare', () => {
        expect(SKYLT_SKALA * SKYLT_BILD.täthet).toBe(1);
        expect(SKYLT_BILD.täthet).toBeGreaterThanOrEqual(2);
    });
});

describe('läggTillSkyltar', () => {
    it('lägger kontraktets tre skyltlager under ortsnamnen, i webbens storlek på skärmen', () => {
        const s = voyagerLik();
        expect(harSkyltar(s)).toBe(false);
        expect(läggTillSkyltar(s)).toBe(true);
        expect(harSkyltar(s)).toBe(true);
        // Matställena (#242) underst, sedan det nära lagret, resmålen och
        // badplatserna ur badplatsfilen (VADKUL#279) överst.
        expect(s.layers!.map(l => l.id)).toEqual([
            'background', 'water', POI_SIGN_CLOSE_LAYER_ID, POI_SIGN_NEAR_LAYER_ID, POI_SIGN_LAYER_ID, BAD_SIGN_LAYER_ID,
            'place_town', 'poi_park',
        ]);
        // Webben: 0,8 -> 1 av en bild i 1x. Här samma mått av en bild i 3x.
        expect(lager(s, POI_SIGN_LAYER_ID).layout!['icon-size'])
            .toEqual(['interpolate', ['linear'], ['zoom'], SKYLT_MIN_ZOOM, 0.8 * SKYLT_SKALA, 16, SKYLT_SKALA]);
        expect(lager(s, POI_SIGN_NEAR_LAYER_ID).minzoom).toBe(SKYLT_NÄRA_ZOOM);
        expect(lager(s, POI_SIGN_CLOSE_LAYER_ID).minzoom).toBe(SKYLT_NÄRMAST_ZOOM);
        // Varje lager kartan frågas om vid ett tryck finns i stilen.
        for (const id of POI_SIGN_LAYER_IDS) expect(s.layers!.some(l => l.id === id)).toBe(true);
    });

    // #251, Josef 15/11: "skyltarna hade kunnat visas snäppet tidigare på
    // iphone ... blir bättre så på en mobil".
    it('tänder varje lager ett zoomsteg tidigare än webben: 12, 14 och 15, namn från 13,5', () => {
        expect([SKYLT_MIN_ZOOM, SKYLT_NAMN_ZOOM, SKYLT_NÄRA_ZOOM, SKYLT_NÄRMAST_ZOOM]).toEqual([
            POI_SIGN_MIN_ZOOM - 1, POI_SIGN_NAME_ZOOM - 1, POI_SIGN_NEAR_MIN_ZOOM - 1, POI_SIGN_CLOSE_MIN_ZOOM - 1,
        ]);
        expect([SKYLT_MIN_ZOOM, SKYLT_NAMN_ZOOM, SKYLT_NÄRA_ZOOM, SKYLT_NÄRMAST_ZOOM]).toEqual([12, 13.5, 14, 15]);
        // Ordningen mellan lagren står kvar: resmålen först, matställena sist.
        expect(SKYLT_MIN_ZOOM).toBeLessThan(SKYLT_NÄRA_ZOOM);
        expect(SKYLT_NÄRA_ZOOM).toBeLessThan(SKYLT_NÄRMAST_ZOOM);
    });

    it('ritar ur baskartans egna kakel (inga djupare kakel i appen)', () => {
        const s = voyagerLik();
        läggTillSkyltar(s);
        const far = lager(s, POI_SIGN_LAYER_ID);
        expect(far).toMatchObject({ source: 'protomaps', 'source-layer': 'pois', minzoom: SKYLT_MIN_ZOOM });
        expect((far.layout!['text-field'] as unknown[])[3]).toBe(SKYLT_NAMN_ZOOM);
        expect(far.layout!['text-font']).toEqual(FONT);
        // Voyagers egna parknamn göms - skylten bär namnet.
        expect(lager(s, 'poi_park').layout!.visibility).toBe('none');
    });

    // VADKUL#279, Josef 22/11: "badplatser syns bara när man zoomar in
    // jättemycket. Fixa så det är mycket högre upp synligt."
    it('badplatserna ritas ur webbens badplatsfil från zoom 9, inte ur kaklen', () => {
        const s = voyagerLik();
        läggTillSkyltar(s);
        expect(BADPLATS_URL).toBe('https://vadkul.se/badplatser.json');
        expect((s.sources as Record<string, unknown>)[BAD_SIGN_SOURCE_ID]).toEqual({ type: 'geojson', data: BADPLATS_URL });
        const bad = lager(s, BAD_SIGN_LAYER_ID);
        expect(bad).toMatchObject({ type: 'symbol', source: BAD_SIGN_SOURCE_ID, minzoom: 9 });
        expect(bad['source-layer']).toBeUndefined();
        // Namnet från samma zoom som resmålen i appen.
        expect((bad.layout!['text-field'] as unknown[])[3]).toBe(SKYLT_NAMN_ZOOM);
        const kindsIn = (id: string) => (lager(s, id).filter as unknown[])[2] as string[];
        for (const kind of ['bathing_place', 'beach', 'public_bath']) {
            expect(kindsIn(BAD_SIGN_LAYER_ID)).toContain(kind);
            expect(kindsIn(POI_SIGN_LAYER_ID)).not.toContain(kind);
        }
        // Ett tryck på en badskylt ur filen ger samma ruta som förut.
        expect(skyltKandidater([punkt('bathing_place', 'Evedal')]).map(k => k.info))
            .toEqual([{ key: 'bad', type: 'Badplats', name: 'Evedal' }]);
    });

    it('reservstilen (en adress) har inga skyltar', () => {
        expect(harSkyltar('https://example.invalid/style.json')).toBe(false);
    });
});

describe('tryck på en skylt', () => {
    it('frågerutan täcker var en träffad skylts fot kan stå', () => {
        expect(skyltFrågeruta(100, 200)).toEqual([
            [100 - POI_SIGN_HIT.halfWidth, 200 - POI_SIGN_HIT.below],
            [100 + POI_SIGN_HIT.halfWidth, 200 + POI_SIGN_HIT.above],
        ]);
    });

    it('kandidaterna är punkter med en platstyp som har skylt, med namn när kaklen har ett', () => {
        const kandidater = skyltKandidater([
            punkt('beach', ' Evedal ', 14.85, 56.92),
            punkt('playground', undefined),
            // Barer och pubar har ingen skylt (#242).
            punkt('bar', 'Puben'),
            { type: 'Feature', geometry: { type: 'LineString', coordinates: [[14, 56], [15, 57]] }, properties: { kind: 'park' } },
        ]);
        expect(kandidater).toEqual([
            { info: { key: 'bad', type: 'Badplats', name: 'Evedal' }, lngLat: [14.85, 56.92] },
            { info: { key: 'lekplats', type: 'Lekplats', name: null }, lngLat: [14.8, 56.88] },
        ]);
        expect(skyltKandidater([])).toEqual([]);
        // De nya skyltarna (#231, #242) går också att trycka på.
        expect(skyltKandidater([punkt('cinema', 'Filmstaden'), punkt('fast_food', undefined)]).map(k => k.info)).toEqual([
            { key: 'bio', type: 'Bio', name: 'Filmstaden' },
            { key: 'restaurang', type: 'Restaurang', name: null },
        ]);
    });

    it('trycket prövas mot kandidaternas fötter: en skräpträff långt bort blir ingen ruta', () => {
        // Kartan svarade med en skylt, men dess fot står inte under trycket.
        expect(pickPoiSignHit([{ x: 900, y: 40 }], { x: 104, y: 178 })).toBeNull();
        expect(pickPoiSignHit([{ x: 100, y: 200 }], { x: 104, y: 178 })).toBe(0);
    });
});
