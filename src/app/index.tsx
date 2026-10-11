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
 *    kortet. Passerade brickor dimmas.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Camera, GeoJSONSource, Images, Layer, Map } from '@maplibre/maplibre-react-native';
import type { CameraRef, Expression, FilterSpecification, MapRef, StyleSpecification } from '@maplibre/maplibre-react-native';
import type { AppFeedEvent } from '@vadkul/kontrakt';
import { hittaAnvändarEvent, useEvent } from '@/api/useEvent';
import { fetchEventSomFlöde } from '@/api/eventDetalj';
import { DagValjare } from '@/components/DagValjare';
import { EventKort, type KortNav } from '@/components/EventKort';
import { FilterBricka } from '@/components/FilterBricka';
import { BRICKA_IMAGES } from '@/lib/brickBilder.generated';
import { BRICKA_ICON_SIZE } from '@/lib/brickor';
import { eventIPeriod, periodLabel } from '@/lib/dagar';
import { useFilter } from '@/lib/filterContext';
import { isEventPast, shouldAutoBumpDay } from '@/lib/harVarit';
import { byggBrickor } from '@/lib/kartlager';
import { KÄLLOR, matcharFilter } from '@/lib/kartFilter';
import { kartBanner, zoomInMitt, ZOOM_IN_MÅL, type KartBanner } from '@/lib/kartBanner';
import { kartPrompt, type PromptÅtgärd } from '@/lib/kartPrompt';
import { kategoriFor } from '@/lib/kategorier';
import { useRegionVal } from '@/lib/regionContext';
import { distanceKm } from '@/lib/regionVal';
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
}

interface HistorikPost {
    kort: Kort;
    offset: number;
}

/** "+N"-badgens mitt relativt spetsen (webbens COUNT_BADGE_CORNER_X/Y vid icon-size 1). */
const BADGE_X = 20 * Math.SQRT1_2 + 4;
const BADGE_Y = 7 + 20 * Math.SQRT2 + 20 * Math.SQRT1_2 + 5;
const GRUPP_FILTER: FilterSpecification = ['>', ['get', 'antal'], 1];

/** Passerade grupper får ingen text (en etikett över en släckt bricka svävar). */
const ETIKETT_FILTER: FilterSpecification = ['all', ['!', ['get', 'past']], ['!', ['get', 'vald']]];
const VALD_FILTER: FilterSpecification = ['==', ['get', 'vald'], true];
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
    const { city, region, fromGps, manuell, klar, introKlar } = useRegionVal();
    const feed = useEvent(region);
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
    useEffect(() => {
        if (!klar) return;
        if (förstaRef.current) {
            förstaRef.current = false;
            return;
        }
        landningRef.current = city.slug;
        cameraRef.current?.flyTo({ center: [city.lng, city.lat], zoom: 11, duration: 1500 });
    }, [klar, city.slug, city.lng, city.lat, fromGps, manuell]);

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

    // Kartans onPress eldar OCKSÅ när trycket träffade en bricka (källans
    // onPress är en separat callback) - stämpeln låter karttrycket skilja
    // "tom karta" från "bricka", oavsett i vilken ordning de två eldar.
    const brickTryckRef = useRef(0);
    const trycktBricka = (id: string | undefined) => {
        brickTryckRef.current = Date.now();
        const e = id ? iPeriod.find(x => x.id === id) : undefined;
        if (e) öppna(e, iPeriod);
    };

    // Tryck på TOM karta MINIMERAR kortet till filterraden (Josef 11/10:
    // "om man klickar på kartan så ska eventkortet åka ner ... men lämna så
    // man ser översta filterraden") - kortet stängs bara med ✕ eller
    // neddrag. Fördröjningen släpper fram brickans callback först så ett
    // brickbyte aldrig minimeras i förbifarten.
    const [minimeraNonce, setMinimeraNonce] = useState(0);
    const karttryck = () => {
        if (banner) stängBanner();
        const vid = Date.now();
        setTimeout(() => {
            if (brickTryckRef.current > vid - 400) return;
            setMinimeraNonce(n => n + 1);
        }, 120);
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
            setOffset(Math.max(0, Math.min(13, dagOffset(e.time))));
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

    // Nästa: närmaste obesökta i bild (ovanför kortet, inte passerat), sedan
    // nästa dag med event i bild - inget nytt varv, kameran står still.
    const poolIBild = useMemo(
        () => (ruta ? iPeriod.filter(e => iBild(e.lat, e.lng, ruta, KORT_TÄCKER) && !isEventPast(e, nuMs)) : []),
        [iPeriod, ruta, nuMs],
    );
    const aktuellt = kort?.event ?? null;
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
                const steg = nästaIBild(ankareRef.current ?? aktuellt, aktuellt, poolIBild, besökta);
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
        if (kort?.event && !eventIPeriod(kort.event.time, offset, längd)) stängKort();
        // bara vid periodbyte
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [offset, längd]);

    // ── Brickorna ─────────────────────────────────────────────────────────
    const valtId = kort ? kort.event?.id ?? kort.grupp[0]?.id ?? null : null;
    const brickor = useMemo(
        () => byggBrickor(iPeriod, { nowMs: nuMs, valtId, ärSparad }),
        [iPeriod, nuMs, valtId, ärSparad],
    );

    // ── Prompten ovanför väljaren ─────────────────────────────────────────
    const iPeriodIRutan = längd === 1 ? räkna(offset, 1) : räkna(offset, 7);
    const filterNamn = filter.källa
        ? KÄLLOR.find(k => k.key === filter.källa)?.label ?? null
        : filter.kategori ? kategoriFor(filter.kategori).label : filter.populärt ? 'Populära' : null;
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

    const skapa = () =>
        WebBrowser.openBrowserAsync(`https://vadkul.se/?plats=${city.lat},${city.lng},13&skapa=1`);

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
                    }}
                    onPress={karttryck}
                >
                    <Camera ref={cameraRef} initialViewState={{ center: [city.lng, city.lat], zoom: 11 }} />
                    <Images images={BRICKA_IMAGES} />
                    <GeoJSONSource
                        id="events"
                        data={brickor}
                        onPress={ev => trycktBricka(ev.nativeEvent.features[0]?.properties?.id as string | undefined)}
                    >
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
                            gallrar, appflödet är ändå bara ett län. */}
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
                        <Text style={styles.rundIkon}>👤</Text>
                    </Pressable>
                </View>
                <View style={styles.mittKolumn} pointerEvents="box-none">
                    <Pressable style={styles.periodPlatta} onPress={() => router.push(`/stad/${city.slug}`)}>
                        <View style={styles.stadRad}>
                            <Text style={styles.stadText} numberOfLines={1}>{city.name}</Text>
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
                        till webbens sökark (sökfält + kategorichips, inga
                        event förrän man sökt). Blå när kartfiltret är på. */}
                    <Pressable
                        style={[styles.rundKnapp, filter.aktivt && styles.rundKnappPå]}
                        onPress={() => router.push('/sok')}
                        accessibilityLabel="Sök och filtrera"
                    >
                        <Text style={[styles.rundIkon, filter.aktivt && styles.rundIkonPå]}>☰</Text>
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
                                    : `🔍 Zooma in över ${city.name} →`}
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
            />

            {kort ? (
                <EventKort
                    event={kort.event}
                    grupp={kort.grupp}
                    onVäljIGrupp={väljIGrupp}
                    onTillbakaTillLista={kort.frånLista && kort.grupp.length > 1
                        ? () => setKort({ event: null, grupp: kort.grupp, frånLista: false })
                        : null}
                    lista={iRutan}
                    listaFrånOffset={offset}
                    flöde={filtrerade}
                    stad={{ slug: city.slug, name: city.name }}
                    onVälj={väljUrLista}
                    nav={nav}
                    minimeraNonce={minimeraNonce}
                    inbjudan={inbjudan && kort.event?.id === inbjudan.eventId
                        ? { fran: inbjudan.fran, onStäng: () => setInbjudan(null) }
                        : null}
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
    rundIkon: { fontSize: 19, color: '#0f172a' },
    rundKnappPå: { backgroundColor: '#006AA7' },
    rundIkonPå: { color: '#ffffff' },
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
    promptYta: { position: 'absolute', left: 16, right: 16, bottom: 196, alignItems: 'center' },
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
