/**
 * Kartan - appens hem, med webbens kromlayout, filter och kortnavigering:
 * profil + skapa (mörkblå med guldring) uppe till vänster, mörka dag/stads-
 * plattan i mitten (länken till stadssidan, med filterbrickorna under), sök
 * uppe till höger, dag/vecka-kontrollen fast i botten.
 *
 * Kart-ui-arv från huvudrepot som gäller HÄR:
 *  - ingen intro-kamera: kartan öppnar i startstaden och står still; stadsbyte
 *    gör ETT hopp. Kameran rör sig ALDRIG av kortnavigering (Nästa/Bakåt/lista).
 *  - allt som räknas "här" mäter KARTANS RUTA: plattans siffror, tom-prompten,
 *    auto-hoppet till Imorgon och ↺-hemmadagen (lib/vy, lib/harVarit).
 *  - kyrkan/PRO/Korpen göms tills de väljs (lib/kartFilter).
 *  - en bricka per plats med antal; tryck på en grupp öppnar väljarlistan i
 *    kortet.
 *  - hela Sverige laddas (api/useEvent); bara ~50 platser kring kartans mitt
 *    är brickor, resten prickar - urvalet följer med när man panorerar
 *    (lib/kartUrval, webbens reveal). Passerade platser är dämpade prickar.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, GeoJSONSource, Images, Layer, Map } from '@maplibre/maplibre-react-native';
import type { CameraRef, Expression, FilterSpecification, LngLat, MapRef, StyleSpecification } from '@maplibre/maplibre-react-native';
import type { AppFeedEvent } from '@vadkul/kontrakt';
import { hittaAnvändarEvent, useEvent } from '@/api/useEvent';
import { fetchEventSomFlöde } from '@/api/eventDetalj';
import { DagValjare } from '@/components/DagValjare';
import { EventKort, type KortNav } from '@/components/EventKort';
import { FilterBricka } from '@/components/FilterBricka';
import { FilterIkon } from '@/components/FilterIkon';
import { Ikon } from '@/components/Ikon';
import { hämtaÖnskningar, taBortÖnskan } from '@/data/onskningar';
import { prenumereraStjärnmärkta } from '@/data/stjarnor';
import { BRICKA_IMAGES } from '@/lib/brickBilder.generated';
import { BADGE_X, BADGE_Y, BRICKA_ICON_SIZE } from '@/lib/brickor';
import { eventIPeriod, horisontOffset, periodLabel } from '@/lib/dagar';
import { useFilter } from '@/lib/filterContext';
import { isEventPast, shouldAutoBumpDay } from '@/lib/harVarit';
import { byggBrickor, byggÖnskningar } from '@/lib/kartlager';
import { byggPrickar, prickFilter, prickNyckel, väljBrickor } from '@/lib/kartUrval';
import { useKonto } from '@/lib/kontoContext';
import { KÄLLOR, matcharFilter } from '@/lib/kartFilter';
import { kartBanner, zoomInMitt, ZOOM_IN_MÅL, type KartBanner } from '@/lib/kartBanner';
import { hoppDag, hoppPanorering, hoppStad, prenumereraKartHopp, taKartHopp, type HoppRetur, type KartHopp } from '@/lib/kartHopp';
import { kartPrompt, type PromptÅtgärd } from '@/lib/kartPrompt';
import { kategoriFor } from '@/lib/kategorier';
import { närmastUtanför, utzoomning, ZOOM_UT_GOLV } from '@/lib/listZoom';
import { useRegionVal } from '@/lib/regionContext';
import { kartansOrt, rutansMitt } from '@/lib/kartOrt';
import { avståndPt, FÖRFILTER_PT, PRICK_RADIE, träffadBricka, träffadPrick, type Kandidat } from '@/lib/kartTryck';
import { nearestCityPoint } from '@/lib/orter';
import { distanceKm, nearestCity } from '@/lib/regionVal';
import { useSparade } from '@/lib/sparadeContext';
import { useNu } from '@/lib/useNu';
import { BOOTSTRAP_STYLE, fetchThemeParkStyle, STREETS_STYLE_URL, type StyleJson } from '@/lib/themeParkStyle';
import { dagOffset, iBild, KORT_TÄCKER, nästaIBild, nästaPeriodMedEvent, sammaPlats, type Ruta } from '@/lib/vy';

/** Kortets tillstånd: valt event, eller väljarlistan (event null) över gruppen. */
interface Kort {
    event: AppFeedEvent | null;
    grupp: AppFeedEvent[];
    /** Valt ur väljarlistan - tillbakapilen finns så länge man står kvar i gruppen. */
    frånLista: boolean;
    /** Kom kortet via ett hopp från söket/stadssidan: ← ☰ tillbaka dit, så
     *  länge man står kvar på just det eventet (webbens searchReturn). */
    retur?: (HoppRetur & { eventId: string }) | null;
}

interface HistorikPost {
    kort: Kort;
    offset: number;
}

const GRUPP_FILTER: FilterSpecification = ['>', ['get', 'antal'], 1];

/** Passerade grupper får ingen text (en etikett över en släckt bricka svävar). */
const ETIKETT_FILTER: FilterSpecification = ['all', ['!', ['get', 'past']], ['!', ['get', 'vald']]];
const VALD_FILTER: FilterSpecification = ['==', ['get', 'vald'], true];
/** Prickens radie (webbens DOT_RADIUS_EXPR): lite större ju närmare man är. */
const PRICK_RADIE_UTTRYCK = ['interpolate', ['linear'], ['zoom'], 4, 2.5, 10, 3.5, 14, 4.5] as unknown as Expression;
const ETIKETT_STIL = {
    textFont: ['Montserrat Medium', 'Open Sans Bold'],
    textSize: ['interpolate', ['linear'], ['zoom'], 9, 11, 13, 12.5, 16, 13.5] as unknown as Expression,
    // Spetsen står på koordinaten → texten börjar strax under den.
    textAnchor: 'top' as const,
    textOffset: [0, 0.35],
    textMaxWidth: 12,
    // Lägst placeras först och vinner kollisionen.
    symbolSortKey: ['get', 'etikettPrio'] as unknown as Expression,
    textColor: '#ffffff',
    textHaloColor: 'rgba(51,65,85,0.8)',
    textHaloWidth: 2,
};

export default function KartScreen() {
    const { city, region, fromGps, manuell, klar, introKlar, väljStad } = useRegionVal();
    const feed = useEvent(region);
    const maxOffset = horisontOffset(feed.horisontDagar);
    const filter = useFilter();
    const { ärSparad } = useSparade();
    const nuMs = useNu();

    const [offset, setOffset] = useState(0);
    const [längd, setLängd] = useState<1 | 7>(1);
    const [ruta, setRuta] = useState<Ruta | null>(null);

    // Första starten: introt ovanpå den stilla kartan (en gång per enhet).
    useEffect(() => {
        if (introKlar === false) router.push('/intro');
    }, [introKlar]);

    // ── Underlaget: filter → period → ruta ────────────────────────────────
    const filtrerade = useMemo(
        () => (feed.data ?? []).filter(e => matcharFilter(e, filter)),
        [feed.data, filter],
    );
    const iPeriod = useMemo(
        () => filtrerade.filter(e => eventIPeriod(e.time, offset, längd)),
        [filtrerade, offset, längd],
    );
    const iRutan = useMemo(
        () => (ruta ? filtrerade.filter(e => iBild(e.lat, e.lng, ruta)) : []),
        [filtrerade, ruta],
    );
    const räkna = (o: number, l: number) => iRutan.filter(e => eventIPeriod(e.time, o, l));
    const antalDag = ruta && feed.data ? räkna(offset, 1).length : null;
    const antalVecka = ruta && feed.data ? räkna(offset, 7).length : null;
    const idagIRutan = useMemo(() => iRutan.filter(e => eventIPeriod(e.time, 0, 1)), [iRutan]);
    const imorgonIRutan = useMemo(() => iRutan.filter(e => eventIPeriod(e.time, 1, 1)), [iRutan]);
    const hemmadag = shouldAutoBumpDay(idagIRutan, imorgonIRutan, nuMs) ? 1 : 0;

    // ── Stilen: bootstrap-plattan tills nöjesfältet hämtats, Voyager vid fel.
    const [mapStyle, setMapStyle] = useState<StyleJson | string>(BOOTSTRAP_STYLE);
    useEffect(() => {
        let aktiv = true;
        fetchThemeParkStyle()
            .then(s => { if (aktiv) setMapStyle(s); })
            .catch(() => { if (aktiv) setMapStyle(STREETS_STYLE_URL); });
        return () => { aktiv = false; };
    }, []);

    // ── Kameran: stadsbytet gör ETT hopp, via ref (kontrollerade Camera-props
    // hade slagits med användarens panorering). Startstaden ligger redan i
    // initialViewState.
    const mapRef = useRef<MapRef>(null);
    const cameraRef = useRef<CameraRef>(null);
    const förstaRef = useRef(true);
    const landningRef = useRef<string | null>(city.slug);
    /** Satt när ett hopp (lib/kartHopp) bytte stad: kameran flyger till
     *  EVENTET i stället för stadens mitt. */
    const stadsHoppRef = useRef<AppFeedEvent | null>(null);
    /** Mitt i ett stadshopp är MÅLET sanningen för plattans ortsnamn
     *  (webbens liveCityName) - kartans mitt beskriver ännu förra stället.
     *  Släpps när kartan stannat. */
    const [hoppNamn, setHoppNamn] = useState<string | null>(null);
    useEffect(() => {
        if (!klar) return;
        if (förstaRef.current) {
            förstaRef.current = false;
            return;
        }
        const hopp = stadsHoppRef.current;
        if (hopp) {
            // Dagen är eventets - inget auto-hopp till Imorgon vid landningen.
            stadsHoppRef.current = null;
            landningRef.current = null;
            setHoppNamn(nearestCityPoint(hopp.lat, hopp.lng).name);
            cameraRef.current?.flyTo({ center: [hopp.lng, hopp.lat], zoom: 11, duration: 1500 });
            return;
        }
        landningRef.current = city.slug;
        setHoppNamn(city.name);
        cameraRef.current?.flyTo({ center: [city.lng, city.lat], zoom: 11, duration: 1500 });
    }, [klar, city.slug, city.name, city.lng, city.lat, fromGps, manuell]);

    // Auto-hoppet till Imorgon: en gång per landning, när rutan står över
    // staden och flödet finns (webbens utils/autoDayBump - kartans ruta).
    useEffect(() => {
        if (landningRef.current !== city.slug || !ruta || !feed.data) return;
        if (!iBild(city.lat, city.lng, ruta)) return;
        landningRef.current = null;
        if (offset === 0 && hemmadag === 1) setOffset(1);
    }, [city.slug, city.lat, city.lng, ruta, feed.data, offset, hemmadag]);

    const [zoom, setZoom] = useState<number | null>(null);
    const läsRuta = useCallback(() => {
        mapRef.current?.getViewState()
            .then(v => { setRuta(v.bounds); setZoom(v.zoom); })
            .catch(() => { /* kartan inte klar */ });
    }, []);

    // ── Kortet: val, väljarlista, Nästa/Bakåt ─────────────────────────────
    const [kort, setKort] = useState<Kort | null>(null);
    const ankareRef = useRef<AppFeedEvent | null>(null);
    const [besökta, setBesökta] = useState<Set<string>>(new Set());
    const [historik, setHistorik] = useState<HistorikPost[]>([]);

    const öppna = (e: AppFeedEvent, underlag: readonly AppFeedEvent[]) => {
        const grupp = sammaPlats(underlag, e);
        ankareRef.current = grupp.length > 1 ? null : e;
        setBesökta(new Set());
        setHistorik([]);
        setKort(grupp.length > 1 ? { event: null, grupp, frånLista: false } : { event: e, grupp, frånLista: false });
    };

    const trycktBricka = (id: string) => {
        const e = iPeriod.find(x => x.id === id);
        if (e) öppna(e, iPeriod);
    };


    const väljIGrupp = (e: AppFeedEvent) => {
        if (!ankareRef.current) ankareRef.current = e;
        setKort(k => ({ event: e, grupp: k?.grupp ?? [e], frånLista: k ? k.event === null || k.frånLista : false }));
    };

    const stängKort = () => {
        setKort(null);
        setHistorik([]);
        ankareRef.current = null;
    };

    // ── Djuplänken ?event= (webbens djuplänk; universella länkar /e/<slug>
    // och notiserna landar här via src/app/e). Eventet öppnas DIREKT, på sin
    // dag, och kameran flyger dit - valet är redan gjort. Finns det inte i det
    // laddade flödet (annat län, användarskapat) hämtas det via /api/event.
    // ?inb=1&fran=<uid> = Bjud med-inbjudan: bannern i svarsraden tills man
    // stänger den eller väljer ett annat event.
    const länk = useLocalSearchParams<{ event?: string; inb?: string; fran?: string }>();
    const [inbjudan, setInbjudan] = useState<{ eventId: string; fran: string | null } | null>(null);
    useEffect(() => {
        const id = länk.event;
        if (!id) return;
        let aktiv = true;
        (async () => {
            const e = (feed.data ?? []).find(x => x.id === id)
                ?? hittaAnvändarEvent(id)
                ?? await fetchEventSomFlöde(id).catch(() => null);
            if (!aktiv) return;
            router.setParams({ event: undefined, inb: undefined, fran: undefined });
            if (!e) return;
            setLängd(1);
            setOffset(Math.max(0, Math.min(maxOffset, dagOffset(e.time))));
            cameraRef.current?.flyTo({ center: [e.lng, e.lat], zoom: 14, duration: 900 });
            ankareRef.current = e;
            setBesökta(new Set());
            setHistorik([]);
            setKort({ event: e, grupp: [e], frånLista: false });
            setInbjudan(länk.inb ? { eventId: e.id, fran: länk.fran ?? null } : null);
        })();
        return () => { aktiv = false; };
        // Bara när länken byts - flödet läses i stunden.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [länk.event]);
    useEffect(() => {
        if (inbjudan && kort?.event?.id !== inbjudan.eventId) setInbjudan(null);
    }, [kort, inbjudan]);

    // ── Hoppet från söket, profilen och stadssidan (lib/kartHopp, webbens
    // jumpToEvent): skärmen stänger sig och eventet väljs HÄR, på sin dag,
    // som vid ett kartklick - kortet får Nästa och listan under kortet.
    // Kameran står still om brickan syns ovanför kortet, annars panorerar den
    // dit på samma zoom (webbens recenterOnSelected). Kom hoppet från en
    // stadssida (eller sökets ort), eller ligger eventet i ett annat län,
    // byter kartan stad och flyger till eventet.
    /** Hoppet lade kortet på en dag där eventet inte finns (passerat event ur
     *  profilens historik) - periodbytet får inte stänga det kortet. */
    const hoppPeriodRef = useRef(false);
    const utförHopp = (h: KartHopp) => {
        const e = h.event;
        const iFlödet = (feed.data ?? []).some(x => x.id === e.id);
        const målStad = hoppStad(e, { iFlödet, stad: city, stadSlug: h.stadSlug });
        const d = hoppDag(e, new Date(), maxOffset);
        hoppPeriodRef.current = (d !== offset || längd !== 1) && !eventIPeriod(e.time, d, 1);
        setLängd(1);
        setOffset(d);
        // Sökets kategoriord byter kartans filter i samma steg - gruppen
        // räknas med det NYA filtret (staten hinner inte slå igenom här).
        let urval = filtrerade;
        if (h.kategorier) {
            filter.sättUrval(h.kategorier);
            const nytt = { kategorier: h.kategorier, populärt: false, källa: null, optIn: filter.optIn };
            urval = (feed.data ?? []).filter(x => matcharFilter(x, nytt));
        }
        const period = urval.filter(x => eventIPeriod(x.time, d, 1));
        ankareRef.current = e;
        setBesökta(new Set());
        setHistorik([]);
        setKort({
            event: e,
            grupp: iFlödet ? sammaPlats(period, e) : [e],
            frånLista: false,
            retur: h.retur ? { ...h.retur, eventId: e.id } : null,
        });
        if (målStad) {
            stadsHoppRef.current = e;
            väljStad(målStad);
            return;
        }
        const mitt = ruta ? hoppPanorering(e, ruta) : [e.lng, e.lat] as [number, number];
        if (mitt) cameraRef.current?.easeTo({ center: mitt, duration: 500 });
    };
    const utförHoppRef = useRef(utförHopp);
    useEffect(() => { utförHoppRef.current = utförHopp; });
    useEffect(() => {
        if (!klar) return;
        const ta = () => {
            const h = taKartHopp();
            if (h) utförHoppRef.current(h);
        };
        ta();
        return prenumereraKartHopp(ta);
    }, [klar]);

    // Nästa: närmaste obesökta i bild (ovanför kortet, inte passerat), sedan
    // nästa dag med event i bild - inget nytt varv, kameran står still.
    const poolIBild = useMemo(
        () => (ruta ? iPeriod.filter(e => iBild(e.lat, e.lng, ruta, KORT_TÄCKER) && !isEventPast(e, nuMs)) : []),
        [iPeriod, ruta, nuMs],
    );
    // VÄLJARLISTAN RÄKNAS SOM ETT VALT EVENT (Josef 23/10: "om jag klickar
    // på ett multievent så ska den ju öppnas så ska jag ju se den nästa
    // knappen uppe åt höger"): står kortet på högen (event null) utgår Nästa
    // från gruppens första event - hela högen ligger på samma plats, så
    // nästaIBild märker alla dem som besökta och går till närmaste andra
    // bricka. Bakåt tar en tillbaka till listan (historiken sparar kortet).
    const aktuellt = kort ? kort.event ?? kort.grupp[0] ?? null : null;
    const nästaHär = aktuellt && ruta
        ? nästaIBild(ankareRef.current ?? aktuellt, aktuellt, poolIBild, besökta).nästa
        : null;
    const nästaDag = useMemo(() => {
        if (!ruta) return null;
        const dagar = filtrerade
            .filter(e => iBild(e.lat, e.lng, ruta, KORT_TÄCKER) && !isEventPast(e, nuMs))
            .map(e => dagOffset(e.time));
        return nästaPeriodMedEvent(dagar, offset, längd);
    }, [filtrerade, ruta, nuMs, offset, längd]);

    const push = () => { if (kort) setHistorik(h => [...h, { kort, offset }]); };

    // Förhandsvisningarna i navraden (webbens Nästa/Föregående-knappar visar
    // vart man går): föregående = historikens topp, antal = gruppens längd.
    const bakåtKort = historik.length > 0 ? historik[historik.length - 1].kort : null;
    const nav: KortNav | undefined = aktuellt
        ? {
            nästaEtikett: nästaHär ? 'NÄSTA' : nästaDag !== null ? periodLabel(nästaDag, längd).toUpperCase() : null,
            nästaEvent: nästaHär,
            nästaAntal: nästaHär ? sammaPlats(iPeriod, nästaHär).length : 0,
            bakåtEvent: bakåtKort ? bakåtKort.event ?? bakåtKort.grupp[0] ?? null : null,
            bakåtAntal: bakåtKort?.grupp.length ?? 0,
            onNästa: () => {
                if (!aktuellt || !ruta) return;
                // Från väljarlistan finns inget ankare än (det sätts när man
                // väljer ur högen) - högens plats blir ankaret, som ett
                // kartklick på en enkel bricka.
                if (!ankareRef.current) ankareRef.current = aktuellt;
                const steg = nästaIBild(ankareRef.current, aktuellt, poolIBild, besökta);
                push();
                if (steg.nästa) {
                    setBesökta(steg.besökta);
                    setKort({ event: steg.nästa, grupp: sammaPlats(iPeriod, steg.nästa), frånLista: false });
                    return;
                }
                if (nästaDag === null) return;
                // Dagbytets nyval: närmast kartans mitt bland eventen i bild.
                const period = filtrerade.filter(e => eventIPeriod(e.time, nästaDag, längd));
                const kandidater = period.filter(e => iBild(e.lat, e.lng, ruta, KORT_TÄCKER) && !isEventPast(e, nuMs));
                const mitt = { lat: (ruta[1] + ruta[3]) / 2, lng: (ruta[0] + ruta[2]) / 2 };
                const val = kandidater.reduce<AppFeedEvent | null>((bäst, e) =>
                    !bäst || distanceKm(mitt.lat, mitt.lng, e.lat, e.lng) < distanceKm(mitt.lat, mitt.lng, bäst.lat, bäst.lng)
                        ? e : bäst, null);
                if (!val) return;
                setOffset(nästaDag);
                ankareRef.current = val;
                setBesökta(new Set());
                setKort({ event: val, grupp: sammaPlats(period, val), frånLista: false });
            },
            onBakåt: historik.length > 0
                ? () => {
                    const sista = historik[historik.length - 1];
                    setHistorik(h => h.slice(0, -1));
                    setOffset(sista.offset);
                    setKort(sista.kort);
                }
                : null,
        }
        : undefined;

    // Rad i kortets lista: byt event (och dag, om det ligger utanför perioden).
    const väljUrLista = (e: AppFeedEvent) => {
        push();
        const d = dagOffset(e.time);
        const nyOffset = eventIPeriod(e.time, offset, längd) ? offset : Math.max(0, d);
        if (nyOffset !== offset) setOffset(nyOffset);
        const period = filtrerade.filter(x => eventIPeriod(x.time, nyOffset, längd));
        ankareRef.current = e;
        setBesökta(new Set());
        setKort({ event: e, grupp: sammaPlats(period, e), frånLista: false });
    };

    // Dagbyte från väljaren stänger kortet om det valda inte längre syns.
    useEffect(() => {
        if (hoppPeriodRef.current) {
            hoppPeriodRef.current = false;
            return;
        }
        if (kort?.event && !eventIPeriod(kort.event.time, offset, längd)) stängKort();
        // bara vid periodbyte
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [offset, längd]);

    // ── Brickorna ─────────────────────────────────────────────────────────
    // Stjärnmärkta event (eventStars): guldbricka + representantlyft - delar
    // prenumeration med eventkortet (EN Firestore-lyssnare i data/stjarnor).
    const [stjärnmärkta, setStjärnmärkta] = useState<ReadonlySet<string>>(new Set());
    useEffect(() => prenumereraStjärnmärkta(setStjärnmärkta), []);
    const valtId = kort ? kort.event?.id ?? kort.grupp[0]?.id ?? null : null;
    const platser = useMemo(
        () => byggBrickor(iPeriod, { nowMs: nuMs, valtId, ärSparad, stjärnor: stjärnmärkta }),
        [iPeriod, nuMs, valtId, ärSparad, stjärnmärkta],
    );
    // BRICKOR KRING MITTEN, PRICKAR ANNARS (Josef 19/10, lib/kartUrval -
    // webbens reveal-urval): de ~50 platserna närmast kartans mitt är
    // brickor, resten av landet billiga prickar. Brickorna räknas om när
    // kartan stannat (onRegionDidChange sätter ruta/zoom), så urvalet följer
    // med när man panorerar. Prick-källan beror bara på platserna och skickas
    // inte om vid panorering - de som är brickor döljs med filtret.
    const urvalsMitt = useMemo(() => (ruta ? rutansMitt(ruta) : null), [ruta]);
    const brickor = useMemo(
        () => väljBrickor(platser, urvalsMitt, zoom ?? 11),
        [platser, urvalsMitt, zoom],
    );
    // Platserna byggs om varje minut (nuMs) - prickarna bara när något
    // synligt ändrats (lib/kartUrval.prickNyckel).
    const prickNyckeln = useMemo(() => prickNyckel(platser), [platser]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const prickar = useMemo(() => byggPrickar(platser), [prickNyckeln]);
    const brickIds = useMemo(() => new Set(brickor.features.map(f => f.properties.id)), [brickor]);
    const dolda = useMemo(() => prickFilter([...brickIds]) as unknown as FilterSpecification, [brickIds]);

    // ── Önskningarna (webbens drömska wish-brickor) ───────────────────────
    // Egen liten collection, hämtas per kartbesök och efter egna ändringar
    // (skapa-arket invaliderar nyckeln). Visas halvt genomskinliga.
    const { användare } = useKonto();
    const qc = useQueryClient();
    const önskningar = useQuery({ queryKey: ['onskningar'], queryFn: hämtaÖnskningar, staleTime: 10 * 60_000 });
    const önskeBrickor = useMemo(() => byggÖnskningar(önskningar.data ?? []), [önskningar.data]);

    // EGEN TRÄFF på brickorna (Josef 13/10: "när jag klickar på
    // eventmarkören så markerar den inte den. men om jag klickar lite ner åt
    // vänster då markeras den"): källornas onPress (MapLibres features)
    // missade den synliga brickan, så kartans tryck räknar själv - spetsarna
    // nära trycket projiceras till skärmen och trycket prövas mot brickans
    // synliga kropp (lib/kartTryck, webbens pickHoverKey-princip). Önskningarna
    // ritas ovanpå event-brickorna och prövas först.
    // Tryck på TOM karta STÄNGER kortet helt (Josef 13/10: "när jag klicka
    // på kartan ska eventKORTET försvinna helt. annars döljs ju datumväljaren
    // hela tiden" - ersätter 11/10:s mini-läge som lämnade filterraden kvar).
    // Samma som webbens handleSelectEventFromMap(null). Kortet glider ut som
    // vid neddrag.
    const [stängNonce, setStängNonce] = useState(0);
    const karttryck = (ev: { nativeEvent: { lngLat: LngLat; point: [number, number] } }) => {
        if (banner) stängBanner();
        const [lng, lat] = ev.nativeEvent.lngLat;
        const [tx, ty] = ev.nativeEvent.point;
        void träffPåKartan({ lng, lat }, tx, ty);
    };
    const träffPåKartan = async (tryck: { lng: number; lat: number }, tx: number, ty: number) => {
        const karta = mapRef.current;
        const z = zoom ?? 11;
        const kandidater = async (
            fs: readonly GeoJSON.Feature<GeoJSON.Point, { id: string; sort?: number; antal?: number }>[],
            förfilter = FÖRFILTER_PT,
        ): Promise<Kandidat[]> => {
            if (!karta) return [];
            const nära = fs.filter(f => {
                const [flng, flat] = f.geometry.coordinates;
                return avståndPt({ lng: flng, lat: flat }, tryck, z) <= förfilter;
            });
            const projicerade = await Promise.all(nära.map(async f => {
                try {
                    const [x, y] = await karta.project(f.geometry.coordinates as LngLat);
                    return { id: f.properties.id, sort: f.properties.sort ?? 0, grupp: (f.properties.antal ?? 1) > 1, x, y };
                } catch {
                    return null;
                }
            }));
            return projicerade.filter((k): k is Kandidat => k !== null);
        };
        const önskan = träffadBricka(await kandidater(önskeBrickor.features), tx, ty);
        if (önskan) {
            trycktÖnskan(önskan);
            return;
        }
        // Prickarna efter brickorna (en bricka ovanpå en prick vinner). Ett
        // tryck på en prick öppnar platsen - den blir vald och därmed bricka.
        // Förfiltret med marginal för lutad karta, som brickornas.
        const id = träffadBricka(await kandidater(brickor.features), tx, ty)
            ?? träffadPrick(await kandidater(prickar.features.filter(f => !brickIds.has(f.properties.id)), PRICK_RADIE * 2), tx, ty);
        if (id) trycktBricka(id);
        else setStängNonce(n => n + 1);
    };
    const trycktÖnskan = (id: string) => {
        const w = (önskningar.data ?? []).find(x => x.id === id);
        if (!w) return;
        const tOm = new Date(w.expiresAt).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
        const knappar = [
            {
                text: 'Arrangera det här',
                onPress: () => router.push({
                    pathname: '/skapa',
                    params: {
                        lat: String(w.lat), lng: String(w.lng), zoom: String(zoom ?? 13),
                        titel: w.title, kategori: w.category, onskanId: w.id,
                    },
                }),
            },
            ...(användare && w.uid === användare.uid
                ? [{
                    text: 'Ta bort min önskan',
                    style: 'destructive' as const,
                    onPress: async () => {
                        try {
                            await taBortÖnskan(w.id);
                            await qc.invalidateQueries({ queryKey: ['onskningar'] });
                        } catch {
                            Alert.alert('Kunde inte ta bort önskan', 'Försök igen om en stund.');
                        }
                    },
                }]
                : []),
            { text: 'Stäng', style: 'cancel' as const },
        ];
        Alert.alert(`✨ ${w.title}`, `Önskat av ${w.hostName} · ligger på kartan t.o.m. ${tOm}.`, knappar);
    };

    // ── Prompten ovanför väljaren ─────────────────────────────────────────
    const iPeriodIRutan = längd === 1 ? räkna(offset, 1) : räkna(offset, 7);
    const filterNamn = filter.källa
        ? KÄLLOR.find(k => k.key === filter.källa)?.label ?? null
        : filter.kategorier.size > 0
            ? [...filter.kategorier].map(k => kategoriFor(k).label).join(' eller ')
            : filter.populärt ? 'Populära' : null;
    const prompt = !kort && feed.data
        ? kartPrompt({
            antal: ruta ? iPeriodIRutan.length : null,
            levande: iPeriodIRutan.filter(e => !isEventPast(e, nuMs)).length,
            filterNamn,
            längd,
            offset,
            periodText: periodLabel(offset, längd).toLowerCase(),
        })
        : null;
    const promptÅtgärd = (å: PromptÅtgärd) => {
        if (å === 'visaAlla') filter.rensa();
        else if (å === 'vecka') setLängd(7);
        else setOffset(1);
    };

    // ── Bannrarna (Veckans populära / Zooma in) - samma slot, efter prompten.
    // Stängs per STAD med ✕ eller ett tryck på kartan.
    const [stängdaBanners, setStängdaBanners] = useState<ReadonlySet<string>>(new Set());
    // N = veckoradens tal EFTER trycket (🔥 släpper även igenom användarskapade
    // och veckans passerade); grinden räknar bara kommande populära.
    const veckaMedPopulärt = useMemo(
        () => iRutan.filter(e => eventIPeriod(e.time, offset, 7) && matcharFilter(e, { ...filter, populärt: true })),
        [iRutan, offset, filter],
    );
    const banner = !kort && !prompt && feed.data
        ? kartBanner({
            populäraKommande: veckaMedPopulärt.filter(e => e.pop === true && !isEventPast(e, nuMs)).length,
            populäraIVeckan: veckaMedPopulärt.length,
            populärtPå: filter.populärt,
            annatFilter: filter.källa !== null,
            zoom,
            stängd: stängdaBanners.has(city.slug),
        })
        : null;
    const stängBanner = () => setStängdaBanners(s => new Set(s).add(city.slug));

    // PLATTANS ORT FÖLJER KARTAN (Josef 13/10: "när jag tar mig över kartan
    // så står det fortfarande kvar växjö även om jag är över göteborg") -
    // webbens liveCityName: närmaste ort till kartans mitt, "Sverige"
    // utzoomat (lib/kartOrt). Innan kartan rapporterat sin vy står
    // startstaden. Trycket går till stadssidan för den visade orten
    // (närmaste stad i kontraktets lista), i Sverige-läget till startstadens.
    const kartMitt = ruta ? rutansMitt(ruta) : null;
    const kartOrt = kartMitt && zoom !== null ? kartansOrt(kartMitt, zoom) : null;
    const plattNamn = hoppNamn ?? (kartMitt && zoom !== null ? kartOrt?.name ?? 'Sverige' : city.name);
    const plattStad = !hoppNamn && kartOrt && kartMitt ? nearestCity(kartMitt.lat, kartMitt.lng).slug : city.slug;
    const bannerTryck = (b: KartBanner) => {
        if (b.typ === 'populärVecka') {
            setLängd(7);
            if (!filter.populärt) filter.växlaPopulärt();
            return;
        }
        const kommande = iPeriod.filter(e => !isEventPast(e, nuMs));
        const mitt = zoomInMitt(kommande.length > 0 ? kommande : iPeriod, city);
        cameraRef.current?.flyTo({ center: [mitt.lng, mitt.lat], zoom: ZOOM_IN_MÅL, duration: 1200 });
    };

    // LISTANS BOTTEN ZOOMAR UT (webbens ägarbeslut 8/10, lib/listZoom):
    // kortets lista har nått botten - zooma ut kring SAMMA mitt (ingen
    // panorering, kart-ui 2/9) minst ett steg och så långt att närmaste
    // event utanför rutan syns (samma filter + tidsfönster som listan,
    // Populärt smalnar). Kortet fryser det den redan visat och lägger de
    // nya under en avdelare. Dagen byts inte.
    const zoomaUtFrånListan = (populärt: boolean) => {
        if (!ruta || zoom === null) return;
        const mitt = rutansMitt(ruta);
        const nu = new Date();
        const mål = närmastUtanför(filtrerade, ruta, mitt, e =>
            !isEventPast(e, nuMs) && dagOffset(e.time, nu) >= offset && (!populärt || e.pop === true));
        const ny = utzoomning(ruta, zoom, mål ? { lat: mål.lat, lng: mål.lng } : null);
        if (ny === null) return;
        cameraRef.current?.easeTo({ center: [mitt.lng, mitt.lat], zoom: ny, duration: 900 });
    };

    // Skapa event-arket (native sedan 11/10 - förr öppnades webben). Formuläret
    // öppnas på KARTANS MITT, precis som webbens placerings-varv landar där.
    const skapa = () => {
        const mitt = ruta
            ? { lat: (ruta[1] + ruta[3]) / 2, lng: (ruta[0] + ruta[2]) / 2 }
            : { lat: city.lat, lng: city.lng };
        router.push({
            pathname: '/skapa',
            params: { lat: String(mitt.lat), lng: String(mitt.lng), zoom: String(zoom ?? 13) },
        });
    };

    return (
        <View style={styles.root}>
            {klar ? (
                <Map
                    ref={mapRef}
                    style={styles.map}
                    mapStyle={mapStyle as StyleSpecification | string}
                    onDidFinishLoadingMap={läsRuta}
                    onRegionDidChange={ev => {
                        setRuta(ev.nativeEvent.bounds);
                        setZoom(ev.nativeEvent.zoom);
                        setHoppNamn(null);
                    }}
                    onPress={karttryck}
                >
                    <Camera ref={cameraRef} initialViewState={{ center: [city.lng, city.lat], zoom: 11 }} />
                    <Images images={BRICKA_IMAGES} />
                    {/* PRICKARNA (Josef 19/10, lib/kartUrval): allt utanför
                        urvalet kring mitten - webbens nål-prickar i
                        kategorins färg med vit ring, passerade dämpade till
                        hälften. Monteras FÖRE brickornas källa så lagret
                        ligger under brickor och etiketter. */}
                    <GeoJSONSource id="prickar" data={prickar}>
                        <Layer
                            type="circle"
                            id="event-prickar"
                            filter={dolda}
                            style={{
                                circleRadius: PRICK_RADIE_UTTRYCK,
                                circleColor: ['get', 'farg'] as unknown as Expression,
                                circleStrokeColor: '#ffffff',
                                circleStrokeWidth: 1.5,
                                circleOpacity: ['case', ['get', 'past'], 0.5, 1] as unknown as Expression,
                                circleStrokeOpacity: ['case', ['get', 'past'], 0.45, 0.9] as unknown as Expression,
                            }}
                        />
                    </GeoJSONSource>
                    <GeoJSONSource id="events" data={brickor}>
                        {/* Etiketterna (webbens LABEL_LAYER_IDS): TITEL FÖRE
                            KATEGORI NÄR DEN FÅR PLATS, annars kategorin, annars
                            inget. Båda ligger UNDER brickorna (en etikett får
                            aldrig skymma en bricka). MapLibre placerar
                            uppifrån och ner - titellagret tar plats först, och
                            kategorin för SAMMA bricka krockar med sin egen
                            titel och syns bara när titeln inte fick plats.
                            Inom lagret går de populäraste först (etikettPrio).
                            INGEN zoomgräns, till skillnad från webbens
                            LABEL_CAT_MIN_ZOOM 9 (Josef 9/10: "så man alltid
                            ser något på avstånd iallafall") - kollisionen
                            gallrar, och bara urvalet kring mitten är brickor
                            (resten är prickar utan etikett). */}
                        <Layer
                            type="symbol"
                            id="etikett-kategori"
                            filter={ETIKETT_FILTER}
                            style={{ ...ETIKETT_STIL, textField: ['get', 'label'] as unknown as Expression }}
                        />
                        <Layer
                            type="symbol"
                            id="etikett-titel"
                            filter={ETIKETT_FILTER}
                            style={{ ...ETIKETT_STIL, textField: ['get', 'titel'] as unknown as Expression }}
                        />
                        <Layer
                            type="symbol"
                            id="event-brickor"
                            style={{
                                iconImage: ['get', 'ikon'] as unknown as Expression,
                                iconSize: BRICKA_ICON_SIZE,
                                iconAnchor: 'bottom',
                                iconAllowOverlap: true,
                                iconIgnorePlacement: true,
                                iconOpacity: ['case', ['get', 'past'], 0.45, 1] as unknown as Expression,
                                symbolSortKey: ['get', 'sort'] as unknown as Expression,
                            }}
                        />
                        {/* "+N" på grupper: vit pill + siffra som EN bakad bild
                            (antal-N), så en grannbadges siffra aldrig ritas
                            ovanpå en annan badges cirkel. Det gamla cirkel- +
                            textlagret ritade alla siffror sist, i hög. */}
                        <Layer
                            type="symbol"
                            id="event-antal"
                            filter={GRUPP_FILTER}
                            style={{
                                iconImage: ['get', 'antalIkon'] as unknown as Expression,
                                iconSize: BRICKA_ICON_SIZE,
                                iconTranslate: [BADGE_X, -BADGE_Y],
                                iconAllowOverlap: true,
                                iconIgnorePlacement: true,
                                iconOpacity: ['case', ['get', 'past'], 0.6, 1] as unknown as Expression,
                                symbolSortKey: ['get', 'sort'] as unknown as Expression,
                            }}
                        />
                        {/* Den valda brickans titel - överst och alltid synlig. */}
                        <Layer
                            type="symbol"
                            id="etikett-vald"
                            filter={VALD_FILTER}
                            style={{
                                ...ETIKETT_STIL,
                                textField: ['get', 'titel'] as unknown as Expression,
                                textAllowOverlap: true,
                            }}
                        />
                    </GeoJSONSource>
                    {/* Önskningarna som eget drömskt lager (webbens wish-
                        brickor): kategoribrickan halvt genomskinlig med
                        "Önskas · {titel}" under. Egen källa - aldrig i
                        event-strömmen eller Nästa-poolen. */}
                    {önskeBrickor.features.length > 0 ? (
                        <GeoJSONSource id="onskningar" data={önskeBrickor}>
                            <Layer
                                type="symbol"
                                id="onske-etikett"
                                style={{
                                    ...ETIKETT_STIL,
                                    textField: ['get', 'etikett'] as unknown as Expression,
                                    textOpacity: 0.85,
                                }}
                            />
                            <Layer
                                type="symbol"
                                id="onske-brickor"
                                style={{
                                    iconImage: ['get', 'ikon'] as unknown as Expression,
                                    iconSize: BRICKA_ICON_SIZE,
                                    iconAnchor: 'bottom',
                                    iconOpacity: 0.55,
                                    iconAllowOverlap: true,
                                    iconIgnorePlacement: true,
                                }}
                            />
                        </GeoJSONSource>
                    ) : null}
                </Map>
            ) : (
                <View style={styles.bootstrap} />
            )}

            {/* Toppkromet (ägarbeslut 7/10 kväll): profil till vänster,
                dagplattan i mitten, FILTERKNAPPEN till höger. Sökknappen och
                skapa-knappen som stod här är flyttade - + bor vid dagväljaren
                och filtersymbolen äger hörnet.

                Plattan är EN KAPSEL: staden stort överst och dagen i ett
                ljusare chip längst ner, med rundade hörn bara nedtill (raka
                mot staden). Fasta fillets och den mätande varianten är
                PRÖVADE OCH RIVNA på webben - bygg inte om dem. */}
            <View style={styles.topKrom} pointerEvents="box-none">
                <View style={styles.topKolumn}>
                    <Pressable style={styles.rundKnapp} onPress={() => router.push('/profil')} accessibilityLabel="Profil">
                        <Ikon namn="profil" storlek={20} färg="#0f172a" />
                    </Pressable>
                </View>
                <View style={styles.mittKolumn} pointerEvents="box-none">
                    <Pressable style={styles.periodPlatta} onPress={() => router.push(`/stad/${plattStad}`)}>
                        <View style={styles.stadRad}>
                            <Text style={styles.stadText} numberOfLines={1}>{plattNamn}</Text>
                        </View>
                        <View style={styles.dagChip}>
                            <Text style={styles.dagText}>{periodLabel(offset, längd).toUpperCase()}</Text>
                        </View>
                    </Pressable>
                    <FilterBricka />
                    {feed.isLoading ? (
                        <View style={styles.laddPill}>
                            <ActivityIndicator size="small" color="#ffffff" />
                            <Text style={styles.laddText}>Hämtar event …</Text>
                        </View>
                    ) : feed.isError ? (
                        <Pressable style={styles.laddPill} onPress={() => feed.refetch()}>
                            <Text style={styles.laddText}>Kunde inte hämta event - tryck för att försöka igen</Text>
                        </Pressable>
                    ) : null}
                </View>
                <View style={styles.topKolumn}>
                    {/* Filtersymbolen öppnar sökskärmen - appens motsvarighet
                        till webbens sökark (sökfält + kategorichips; filter på
                        visar träffarna direkt). Blå när kartfiltret är på.
                        ?dag= = kartans dag, där filterlistan börjar. */}
                    <Pressable
                        style={[styles.rundKnapp, filter.aktivt && styles.rundKnappPå]}
                        onPress={() => router.push({ pathname: '/sok', params: { dag: String(offset) } })}
                        accessibilityLabel="Sök och filtrera"
                    >
                        <FilterIkon färg={filter.aktivt ? '#ffffff' : '#0f172a'} />
                    </Pressable>
                </View>
            </View>

            {prompt ? (
                <View style={styles.promptYta} pointerEvents="box-none">
                    <View style={styles.prompt}>
                        <Text style={styles.promptText}>{prompt.text}</Text>
                        {prompt.knapp ? (
                            <Pressable style={styles.promptKnapp} onPress={() => promptÅtgärd(prompt.knapp!.åtgärd)}>
                                <Text style={styles.promptKnappText}>{prompt.knapp.text}</Text>
                            </Pressable>
                        ) : null}
                    </View>
                </View>
            ) : banner ? (
                <View style={styles.promptYta} pointerEvents="box-none">
                    <View style={styles.banner}>
                        <Pressable style={styles.bannerTryck} onPress={() => bannerTryck(banner)}>
                            <Text
                                style={[styles.bannerText, banner.typ === 'populärVecka' ? styles.bannerEld : styles.bannerBlå]}
                                numberOfLines={1}
                            >
                                {banner.typ === 'populärVecka'
                                    ? `🔥 Visa alla ${banner.antal} populära event i veckan →`
                                    : `🔍 Zooma in över ${kartOrt?.name ?? city.name} →`}
                            </Text>
                        </Pressable>
                        <Pressable style={styles.bannerStäng} onPress={stängBanner} hitSlop={8} accessibilityLabel="Stäng">
                            <Text style={styles.bannerStängText}>✕</Text>
                        </Pressable>
                    </View>
                </View>
            ) : null}

            <DagValjare
                offset={offset}
                längd={längd}
                antalDag={antalDag}
                antalVecka={antalVecka}
                hemmadag={hemmadag}
                onOffset={setOffset}
                onLängd={setLängd}
                onSkapa={skapa}
                maxOffset={maxOffset}
            />

            {kort ? (
                <EventKort
                    event={kort.event}
                    grupp={kort.grupp}
                    onVäljIGrupp={väljIGrupp}
                    onTillbakaTillLista={kort.frånLista && kort.grupp.length > 1
                        ? () => setKort({ event: null, grupp: kort.grupp, frånLista: false })
                        : kort.retur && kort.event?.id === kort.retur.eventId
                            ? () => router.push(kort.retur!.href)
                            : null}
                    tillbakaEtikett={kort.frånLista && kort.grupp.length > 1 ? undefined : kort.retur?.etikett}
                    lista={iRutan}
                    listaFrånOffset={offset}
                    flöde={filtrerade}
                    stad={{ slug: city.slug, name: city.name }}
                    onVälj={väljUrLista}
                    nav={nav}
                    stängNonce={stängNonce}
                    inbjudan={inbjudan && kort.event?.id === inbjudan.eventId
                        ? { fran: inbjudan.fran, onStäng: () => setInbjudan(null) }
                        : null}
                    zoomUt={{ kan: zoom !== null && zoom > ZOOM_UT_GOLV, utför: zoomaUtFrånListan }}
                    onClose={stängKort}
                />
            ) : null}
        </View>
    );
}

const KNAPP = 46;
const MÖRK = 'rgba(36,42,51,0.92)';

const styles = StyleSheet.create({
    root: { flex: 1 },
    map: { flex: 1 },
    bootstrap: { flex: 1, backgroundColor: '#dfe9d4' },
    topKrom: {
        position: 'absolute',
        top: 58,
        left: 12,
        right: 12,
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
    },
    topKolumn: { width: KNAPP, gap: 10 },
    mittKolumn: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
    rundKnapp: {
        width: KNAPP,
        height: KNAPP,
        borderRadius: KNAPP / 2,
        backgroundColor: 'rgba(255,255,255,0.95)',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 4,
    },
    rundKnappPå: { backgroundColor: '#006AA7' },
    /** EN kapsel: stadsraden överst, dagchipet inuti längst ner. Insatsen
     *  (6) är skillnaden mellan kapselns radie (22) och chipets (16), så
     *  hörnen blir koncentriska oavsett textlängd - ingen mätning. */
    periodPlatta: {
        backgroundColor: MÖRK,
        borderRadius: 22,
        paddingHorizontal: 6,
        paddingBottom: 6,
        alignItems: 'stretch',
        minWidth: 150,
        maxWidth: 260,
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 6,
    },
    /** Stadsraden är 44 px - i lod med profilknappen. */
    stadRad: { height: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 14 },
    stadText: { fontSize: 22, fontWeight: '800', color: '#ffffff' },
    /** Dagchipet: ljusare yta, rundat BARA nedtill (22 - insatsen 6 = 16). */
    dagChip: {
        alignSelf: 'stretch',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16,
        paddingVertical: 4,
        alignItems: 'center',
    },
    dagText: { fontSize: 12, fontWeight: '800', color: '#e2e8f0', letterSpacing: 1.4 },
    laddPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 8,
        backgroundColor: MÖRK,
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    laddText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
    // Ovanför dagväljarens + och ↺ (56 pt sedan 29/10, toppen ~202 från botten).
    promptYta: { position: 'absolute', left: 16, right: 16, bottom: 208, alignItems: 'center' },
    prompt: {
        backgroundColor: '#ffffff',
        borderRadius: 18,
        paddingHorizontal: 16,
        paddingVertical: 12,
        alignItems: 'center',
        gap: 8,
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 6,
    },
    promptText: { fontSize: 14, fontWeight: '700', color: '#0f172a', textAlign: 'center' },
    promptKnapp: { backgroundColor: '#0f172a', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
    promptKnappText: { color: '#ffffff', fontSize: 13, fontWeight: '800' },
    /** Bannrarna: vit pill i prompt-slotten. Webbens vandrande gradient blir
     *  här ren eldfärg resp. kartans blå. */
    banner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderRadius: 999,
        paddingLeft: 16,
        paddingRight: 6,
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 6,
    },
    bannerTryck: { flexShrink: 1, paddingVertical: 11 },
    bannerText: { fontSize: 14, fontWeight: '800' },
    bannerEld: { color: '#ea580c' },
    bannerBlå: { color: '#006AA7' },
    bannerStäng: { marginLeft: 6, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    bannerStängText: { fontSize: 13, color: '#94a3b8', fontWeight: '700' },
});
