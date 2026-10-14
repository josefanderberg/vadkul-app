import { describe, expect, it } from 'vitest';
import type { AppFeedEvent, AppFeedPayload } from '@vadkul/kontrakt';
import {
    KONTROLL_INTERVALL_MS,
    SPARAT_VERSION,
    attRadera,
    användbartSparat,
    behöverKontroll,
    sparadText,
    tolkaSvar,
    utanPasserade,
    ärFlöde,
    type SparatFlöde,
} from './flodesCache';

/** Lokal tid (som appen räknar dagar) - 14 okt 2026 kl 12. */
const lokal = (dag: number, timme = 12, minut = 0) => new Date(2026, 9, dag, timme, minut).getTime();
const iso = (ms: number) => new Date(ms).toISOString();

const ev = (id: string, startMs: number): AppFeedEvent => ({
    id,
    title: id,
    time: iso(startMs),
    hasSpecificTime: true,
    lat: 59.3,
    lng: 18.0,
    category: 'music',
});

const paket = (byggdMs: number, events: AppFeedEvent[] = [], days = 14): AppFeedPayload => ({
    updatedAt: iso(byggdMs),
    region: 'stockholm',
    days,
    events,
});

const sparat = (p: AppFeedPayload, etag: string | null = '"app-stockholm:x"'): SparatFlöde => ({
    v: SPARAT_VERSION,
    region: 'stockholm',
    etag,
    payload: p,
});

describe('sparadText', () => {
    it('blir en fil som läses tillbaka till samma paket och ETag', () => {
        const p = paket(lokal(14, 6), [ev('a', lokal(14, 19))]);
        const text = sparadText('stockholm', '"app-stockholm:2026"', JSON.stringify(p));
        expect(JSON.parse(text)).toEqual(sparat(p, '"app-stockholm:2026"'));
    });

    it('klarar ett svar utan ETag', () => {
        const p = paket(lokal(14, 6));
        expect(JSON.parse(sparadText('stockholm', null, JSON.stringify(p))).etag).toBeNull();
    });

    it('går igenom användbartSparat samma dag', () => {
        const p = paket(lokal(14, 6), [ev('a', lokal(14, 19))]);
        const x = JSON.parse(sparadText('stockholm', '"e"', JSON.stringify(p)));
        expect(användbartSparat(x, 'stockholm', lokal(14, 13))).not.toBeNull();
    });
});

describe('ärFlöde', () => {
    it('kräver updatedAt och en events-lista', () => {
        expect(ärFlöde(paket(lokal(14)))).toBe(true);
        expect(ärFlöde({ updatedAt: 'x' })).toBe(false);
        expect(ärFlöde({ events: [] })).toBe(false);
        expect(ärFlöde(null)).toBe(false);
        expect(ärFlöde('{"events":[]}')).toBe(false);
    });
});

describe('användbartSparat', () => {
    const nu = lokal(14, 13);

    it('godtar ett paket från i dag', () => {
        const s = sparat(paket(lokal(14, 6)));
        expect(användbartSparat(s, 'stockholm', nu)).toBe(s);
    });

    it('godtar ett paket från i går - utanPasserade tar hand om gårdagens event', () => {
        expect(användbartSparat(sparat(paket(lokal(13, 6))), 'stockholm', nu)).not.toBeNull();
    });

    it('underkänner fel region (filen hör till ett annat län)', () => {
        expect(användbartSparat(sparat(paket(lokal(14, 6))), 'skane', nu)).toBeNull();
    });

    it('underkänner gammalt filformat', () => {
        expect(användbartSparat({ ...sparat(paket(lokal(14, 6))), v: 0 }, 'stockholm', nu)).toBeNull();
    });

    it('underkänner trasigt innehåll', () => {
        expect(användbartSparat(null, 'stockholm', nu)).toBeNull();
        expect(användbartSparat('text', 'stockholm', nu)).toBeNull();
        expect(användbartSparat({ v: SPARAT_VERSION, region: 'stockholm', etag: null }, 'stockholm', nu)).toBeNull();
        expect(användbartSparat({ ...sparat(paket(lokal(14, 6))), etag: 5 }, 'stockholm', nu)).toBeNull();
        expect(användbartSparat(sparat({ ...paket(lokal(14, 6)), updatedAt: 'inte ett datum' }), 'stockholm', nu)).toBeNull();
    });

    it('underkänner ett paket vars hela horisont passerat', () => {
        // Byggt 1 okt med 14 dagars horisont = t.o.m. 14 okt; 15 okt finns inget kvar.
        const s = sparat(paket(lokal(1, 6)));
        expect(användbartSparat(s, 'stockholm', lokal(14, 23, 59))).not.toBeNull();
        expect(användbartSparat(s, 'stockholm', lokal(15, 0, 1))).toBeNull();
    });

    it('följer paketets egen horisont', () => {
        const s = sparat(paket(lokal(10, 6), [], 3));
        expect(användbartSparat(s, 'stockholm', lokal(12, 20))).not.toBeNull();
        expect(användbartSparat(s, 'stockholm', lokal(13, 1))).toBeNull();
    });
});

describe('behöverKontroll', () => {
    const nu = lokal(14, 13);

    it('kontrollerar när det aldrig kontrollerats', () => {
        expect(behöverKontroll(nu, null)).toBe(true);
        expect(behöverKontroll(nu, undefined)).toBe(true);
        expect(behöverKontroll(nu, Number.NaN)).toBe(true);
    });

    it('låter bli inom intervallet (kallstart strax efter förra kontrollen)', () => {
        expect(behöverKontroll(nu, nu - 5 * 60_000)).toBe(false);
        expect(behöverKontroll(nu, nu - KONTROLL_INTERVALL_MS + 1)).toBe(false);
    });

    it('kontrollerar när intervallet gått', () => {
        expect(behöverKontroll(nu, nu - KONTROLL_INTERVALL_MS)).toBe(true);
        expect(behöverKontroll(nu, nu - 24 * KONTROLL_INTERVALL_MS)).toBe(true);
    });

    it('kontrollerar om klockan gått bakåt', () => {
        expect(behöverKontroll(nu, nu + 60_000)).toBe(true);
    });
});

describe('tolkaSvar', () => {
    const s = sparat(paket(lokal(14, 6)), '"v1"');

    it('304 = det sparade gäller', () => {
        expect(tolkaSvar(304, '"v1"', s)).toBe('oförändrat');
    });

    it('304 utan något sparat går inte att använda', () => {
        expect(tolkaSvar(304, '"v1"', null)).toBe('fel');
    });

    it('200 med samma ETag (iOS egen URL-cache) = oförändrat', () => {
        expect(tolkaSvar(200, '"v1"', s)).toBe('oförändrat');
    });

    it('200 med ny ETag eller utan sparat = nytt', () => {
        expect(tolkaSvar(200, '"v2"', s)).toBe('nytt');
        expect(tolkaSvar(200, '"v1"', null)).toBe('nytt');
        expect(tolkaSvar(200, null, s)).toBe('nytt');
    });

    it('200 när det sparade saknar ETag = nytt', () => {
        expect(tolkaSvar(200, null, sparat(paket(lokal(14, 6)), null))).toBe('nytt');
    });

    it('fel och 503 (blobben inte byggd) = fel', () => {
        expect(tolkaSvar(503, null, s)).toBe('fel');
        expect(tolkaSvar(404, null, null)).toBe('fel');
        expect(tolkaSvar(500, '"v1"', s)).toBe('fel');
    });
});

describe('utanPasserade', () => {
    it('tar bort event som startade före i dag', () => {
        const p = paket(lokal(12, 6), [
            ev('förrgår', lokal(12, 19)),
            ev('igår-kväll', lokal(13, 23, 30)),
            ev('idag-morgon', lokal(14, 0, 0)),
            ev('idag', lokal(14, 19)),
            ev('imorgon', lokal(15, 10)),
        ]);
        const ut = utanPasserade(p, lokal(14, 13));
        expect(ut.events.map(e => e.id)).toEqual(['idag-morgon', 'idag', 'imorgon']);
        expect(ut.updatedAt).toBe(p.updatedAt);
        expect(ut.region).toBe(p.region);
    });

    it('behåller det som varit tidigare i dag (kartan tonar dem som har varit)', () => {
        const p = paket(lokal(14, 6), [ev('idag-tidigt', lokal(14, 8))]);
        expect(utanPasserade(p, lokal(14, 22)).events).toHaveLength(1);
    });

    it('ger samma objekt när inget föll bort', () => {
        const p = paket(lokal(14, 6), [ev('idag', lokal(14, 19)), ev('imorgon', lokal(15, 10))]);
        expect(utanPasserade(p, lokal(14, 13))).toBe(p);
    });

    it('rör inte det inkomna paketet', () => {
        const p = paket(lokal(13, 6), [ev('igår', lokal(13, 19)), ev('idag', lokal(14, 19))]);
        utanPasserade(p, lokal(14, 13));
        expect(p.events).toHaveLength(2);
    });

    it('släpper event med trasig tid (pipelinen släpper dem också)', () => {
        const p = paket(lokal(14, 6), [{ ...ev('trasig', lokal(14, 19)), time: 'inte en tid' }, ev('idag', lokal(14, 19))]);
        expect(utanPasserade(p, lokal(14, 13)).events.map(e => e.id)).toEqual(['idag']);
    });
});

describe('attRadera', () => {
    const f = (namn: string, ändradMs: number | null) => ({ namn, ändradMs });

    it('rör inget inom taket', () => {
        expect(attRadera([f('a', 1), f('b', 2)], 3)).toEqual([]);
        expect(attRadera([f('a', 1), f('b', 2), f('c', 3)], 3)).toEqual([]);
    });

    it('tar bort de äldst skrivna utöver taket', () => {
        expect(attRadera([f('a', 1), f('d', 4), f('b', 2), f('c', 3)], 3)).toEqual(['a']);
        expect(attRadera([f('a', 1), f('d', 4), f('b', 2), f('c', 3), f('e', 5)], 2).sort()).toEqual(['a', 'b', 'c']);
    });

    it('räknar en fil utan ändringstid som äldst', () => {
        expect(attRadera([f('okänd', null), f('a', 1), f('b', 2), f('c', 3)], 3)).toEqual(['okänd']);
    });
});
