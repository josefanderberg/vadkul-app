/**
 * Eventkortet - dragbart LJUST bottenark med webbens formspråk och beteende
 * (LinkEventCard + EventCard). Sedan 10/10 ser kortet ut som webbens bg-card:
 * vit yta, två dragstreck, härkomst-badges, knappraden (sök + filter +
 * hjärta), svart fet titel med stor emoji, tid/plats-raderna och VÄRD/PRIS-
 * raden med favicon och avdelare - chipraden är riven (webben har ingen).
 *
 *  - TRE STOPP (lib/sheetSnap, ägarbeslut 2/9): default = kortets huvud +
 *    110 pt bildremsa (webbens 335 px), tapp-höjden ~halva skärmen, taket.
 *    Minst ett stopp per gest, ett långt eller snabbt drag hoppar vidare och
 *    ett långt neddrag uppifrån stänger direkt (11/10); nedåt från default
 *    stänger. Dragytan är handtaget + huvudet; innehållet skrollar för sig.
 *    Ett tryck på TOM karta stänger kortet helt (13/10, som webben) - inget
 *    mini-läge, dagväljaren ska synas.
 *  - VÄLJARLISTAN: trycker man en bricka med flera event är kortets innehåll
 *    listan över platsen tills man valt (ägarbeslut 31/8).
 *  - NAVRADEN LIGGER OVANPÅ ARKET sedan 10/10 (webbens navrad ovanför
 *    kortet, "nästa knappen ska vara ovanpå eventkortet"): Bakåt som
 *    glascirkel med föregående events emoji, ← ☰ (tillbaka till listan),
 *    1/2-pagern och den flaggblå NÄSTA-kapseln med nästa events emoji +
 *    antal - gul ram + 📅 vid dagbyte (webbens ring-[#FECC02]). Raden
 *    följer arkets drag (samma translate) och kameran rör sig aldrig
 *    (kart-ui 2/9). Bakåt/Nästa står där även när kortet visar
 *    VÄLJARLISTAN (23/10) - Nästa går då vidare från högens plats.
 *  - Hjärtat sparar på enheten (lib/sparadeContext), ANMÄL öppnar källan -
 *    på egna VADKUL-event anmäler den i appen i stället (29/10,
 *    lib/useAnmalan, med "N anmälda" under raden) -
 *    BOKA i guld för Ticketmaster (ägarbeslut 1/9) med webbens
 *    "Annons"-märkning under. DELA-KNAPPEN ÄR RIVEN (webben 7/10) - Bjud med
 *    i footern delar.
 *  - KOMMER/INTRESSERAD-FOOTERN (6/10, spår 3): fast platta i botten när ett
 *    event är valt (components/RsvpFooter) - göms i väljarlistan. Footern
 *    ligger i arket men counter-translaterar mot skärmens botten (arket ritas
 *    i takets höjd och skjuts ner). SEDAN 18/10 släpper den som på webben
 *    (sticky bottom-0): raden bor egentligen mellan beskrivningen och
 *    chatten, och när man scrollat fram till dess plats lossnar den och
 *    följer innehållet. Scrollar den ut över överkanten tar RsvpToppRad
 *    över, klistrad överst i scrollytan (webbens EventRsvpTopBar) - bara
 *    knapparna, titeln står kvar i huvudet. Huvudet krymper INTE när
 *    toppraden tänds (28/10: då ryckte hela innehållet upp).
 *  - KORTSÖKET som riktigt fält i knappraden (6/10 + 7/10): fält +
 *    kategorichipsen (samma KategoriRad som sökpanelen - ett val smalnar
 *    listan OCH kartan bakom via det delade filtret). Första tecknet visar
 *    listan direkt (eventet göms), termen lever kvar vid eventbyte och
 *    nollas när kortet stängs. Sökläget har MELLANHÖJDEN som golv (11/10):
 *    fokus lyfter dit, krympande huvud drar aldrig ner arket under
 *    tangentbordet, och högre (taket) står kvar medan man skriver.
 *  - Bildtryck = helskärm (ägarbeslut 14/9), med webbens "Tryck för hela
 *    bilden"-chip på bilden.
 *  - CHATTEN (sociala lagret, 11/10): publik + privat chatt som två block
 *    direkt under beskrivningen (components/EventChat) - låsta rader för
 *    utloggade, Bjud in/Kopiera länk i privata blocket.
 *  - Under chatten: FLER FRÅN SAMMA ARRANGÖR + stadssidelänken
 *    (components/FlerFran, 6/10) och Månaden · 🔥 Populärt, dag för dag i
 *    kartans ruta från visad dag och framåt (Josef 23-24/9). Flikraden
 *    klistras överst när man scrollat förbi den (webbens sticky flikrad)
 *    och dagrubrikerna fäster under den. LISTANS BOTTEN ZOOMAR UT kartan
 *    (webbens ägarbeslut 8/10, lib/listZoom): det man sett står kvar överst
 *    och eventen som kom in runtomkring läggs under en "Zoomade ut"-
 *    avdelare - kartskärmen skickar zoomUt, utan den slutar listan som förr.
 *
 * HÅRD REGEL (CLAUDE.md): appen säljer ingenting - ingen boost, inga priser.
 */
import { createContext, Fragment, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import {
    Alert,
    Animated,
    PanResponder,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    useWindowDimensions,
    View,
    type GestureResponderEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { eventShareSlug, type AppFeedEvent } from '@vadkul/kontrakt';
import type { AppEvent } from '@/lib/appEvent';
import { seriensRytm } from '@/lib/anvandarEvent';
import { useEventDetalj } from '@/api/eventDetalj';
import { hämtaEngagemang } from '@/data/eventStats';
import { hämtaStjärnorKvar, prenumereraStjärnmärkta, sättStjärna } from '@/data/stjarnor';
import { normaliseraPris } from '@/lib/skapaEvent';
import { kanSättaStjärna } from '@/lib/stjarnor';
import { useKonto } from '@/lib/kontoContext';
import { EventChat } from '@/components/EventChat';
import { EventRad } from '@/components/EventRad';
import { FlerFran } from '@/components/FlerFran';
import { Rapportera } from '@/components/Rapportera';
import { HelskarmsBild } from '@/components/HelskarmsBild';
import { Ikon } from '@/components/Ikon';
import { KategoriRad } from '@/components/KategoriRad';
import { ListRad } from '@/components/ListRad';
import { RsvpFooter, RsvpToppRad, type RsvpCta } from '@/components/RsvpFooter';
import { arrangörsRad, källDomän } from '@/lib/arrangorsRad';
import { periodLabel } from '@/lib/dagar';
import { matcharFilter } from '@/lib/kartFilter';
import { ärDubbeltapp, ärTapp, type Tapp } from '@/lib/dubbeltapp';
import { descriptionText, eventOutlink, hostFaviconUrl, hostLabelFor } from '@/lib/eventDetalj';
import { formatTidSpann } from '@/lib/eventTid';
import { useFilter } from '@/lib/filterContext';
import { formatKm } from '@/lib/flerEvent';
import { isEventPast } from '@/lib/harVarit';
import { kategoriFor } from '@/lib/kategorier';
import { matcharKortSök } from '@/lib/kortSok';
import { NYCKEL, useLagrad } from '@/lib/lagring';
import { bildflöde, delaVäljarlista, väljarRäknare } from '@/lib/listRad';
import { delaIRingar } from '@/lib/listZoom';
import { useRegionVal } from '@/lib/regionContext';
import { distanceKm, nearestCity } from '@/lib/regionVal';
import { klistradDag, type DagPlats } from '@/lib/klistradDag';
import { höjdEfterHuvudbyte, landning, sheetStops } from '@/lib/sheetSnap';
import { useSparade } from '@/lib/sparadeContext';
import { anmäldaRad } from '@/lib/anmalan';
import { useAnmälan } from '@/lib/useAnmalan';
import { AFFILIATE_DISCLOSURE, isAffiliateUrl, isTicketmasterEvent } from '@/lib/ticketmaster';
import { eventDagar } from '@/lib/vy';

export function eventUrl(e: AppFeedEvent): string {
    return `https://vadkul.se/e/${eventShareSlug(e.id)}`;
}

/** Bildremsan under huvudet i default-läget (webbens 110 px). */
const BILDREMSA = 110;
/** Rader per sida i listorna - "Visa fler" laddar nästa sida. */
const SIDA = 30;
/** Så länge efter ett tryck i navraden ett eventbyte räknas som dess steg. */
const NAV_STEG_MS = 1000;
/** Inom så många punkter från taket räknas arket som PÅ taket - där och
 *  bara där scrollar innehållet (sheetSnaps tolerans). */
const TAK_MARGINAL = 8;

type ListFlik = 'månaden' | 'populärt';

/** Listans botten zoomar ut (lib/listZoom): kartskärmen äger kameran, så
 *  kortet får steget härifrån. `kan` = kartan står över zoomgolvet. */
export interface KortZoomUt {
    kan: boolean;
    utför: (populärFlik: boolean) => void;
}

export interface KortNav {
    /** "NÄSTA", en dag ("IMORGON") när eventen i bild är genomgångna, null = släckt. */
    nästaEtikett: string | null;
    /** Nästa event i bild - förhandsvisningen i kapseln (emoji + antal), som
     *  webbens Nästa-knapp. null vid dagbyte (📅 visas) eller släckt. */
    nästaEvent: AppFeedEvent | null;
    /** Antal event på nästa events plats - siffran på emojin. */
    nästaAntal: number;
    onNästa: () => void;
    /** null = ingen historik. */
    onBakåt: (() => void) | null;
    /** Föregående event - emojin i bakåtknappen (webbens förhandsvisning). */
    bakåtEvent: AppFeedEvent | null;
    bakåtAntal: number;
}

function navEmoji(e: AppFeedEvent): string {
    return e.emoji || kategoriFor(String(e.category)).emoji;
}

export function EventKort({
    event,
    grupp = [],
    onVäljIGrupp,
    onTillbakaTillLista,
    tillbakaEtikett = 'Tillbaka till listan',
    lista = [],
    listaFrånOffset = 0,
    flöde = [],
    stad = null,
    onVälj,
    nav,
    stängNonce = 0,
    inbjudan = null,
    zoomUt = null,
    onClose,
}: {
    /** Valt event; null = väljarlistan över `grupp`. */
    event: AppEvent | null;
    /** Eventen på samma plats (väljarlistan + pagern). */
    grupp?: AppFeedEvent[];
    onVäljIGrupp?: (e: AppFeedEvent) => void;
    /** Satt när man valt ur väljarlistan och står kvar i gruppen. */
    onTillbakaTillLista?: (() => void) | null;
    /** ← ☰-pilens etikett - "Tillbaka till sökningen" när kortet kom från
     *  söket (webbens searchReturn), annars multievent-listan. */
    tillbakaEtikett?: string;
    /** Underlaget för Månaden/Populärt (kartans filter + ruta). */
    lista?: AppFeedEvent[];
    /** Visad dag - listorna börjar här. */
    listaFrånOffset?: number;
    /** HELA det filtrerade flödet (alla dagar) - arrangörsradens underlag,
     *  som webbens cardOrganizerRow räknar över alla laddade dagar. */
    flöde?: readonly AppFeedEvent[];
    /** Stadssidelänken under arrangörsraden - utelämnas på stadsskärmen. */
    stad?: { slug: string; name: string } | null;
    onVälj?: (e: AppFeedEvent) => void;
    nav?: KortNav;
    /** Bumpas av kartskärmen vid tryck på tom karta (13/10): arket glider
     *  ut och kortet stängs, så dagväljaren syns igen. */
    stängNonce?: number;
    /** Kom man via en Bjud med-länk (?inb=1&fran=) - bannern i svarsraden. */
    inbjudan?: { fran: string | null; onStäng: () => void } | null;
    /** Listans botten zoomar ut kartan (lib/listZoom) - utelämnad på skärmar
     *  utan karta, där slutar listan som förut. */
    zoomUt?: KortZoomUt | null;
    onClose: () => void;
}) {
    const { height: fönsterHöjd } = useWindowDimensions();
    const tak = Math.round(fönsterHöjd * 0.88);
    const [huvudHöjd, setHuvudHöjd] = useState(230);
    /** Mellanhöjden (~halva skärmen) - filterknappens lyft och kortsökets
     *  golv. Fast värde: stopp[1] kan vara taket när sheetStops slagit ihop
     *  default med mellanstoppet. */
    const mellan = Math.round(fönsterHöjd * 0.55);
    const stopp = useMemo(
        () => sheetStops([Math.min(tak, huvudHöjd + BILDREMSA), mellan, tak]),
        [huvudHöjd, mellan, tak],
    );

    // Arket ritas i takets höjd och skjuts ner: translateY = tak - synlig höjd.
    const höjdRef = useRef(stopp[0]);
    const translate = useRef(new Animated.Value(tak - stopp[0])).current;
    const stäng = useRef(onClose);
    stäng.current = onClose;
    const scrollRef = useRef<ScrollView>(null);
    /** Innehållets scrollläge - neddrag på taket tar arket först i toppen. */
    const scrollYRef = useRef(0);
    /** Innehållet scrollar FÖRST på taket (webbens regel, kart-ui): under
     *  det drar varje lodrätt svep i kortet arket (Josef 13/10: "jag vil att
     *  hela fönstrat ska vara grab så man kan slida ner det längre ner på
     *  eventkortet"). */
    const [påTaket, setPåTaket] = useState(false);

    // Kortsöket (6/10 + 7/10): termen lever kvar vid eventbyte och nollas
    // när kortet stängs (EventKort avmonteras). Första tecknet lägger
    // scrollen i topp så träffarna syns direkt (webbens listvy-växling).
    const [sökÖppen, setSökÖppen] = useState(false);
    const [sök, setSök] = useState('');
    const sökFältRef = useRef<TextInput>(null);
    const handleSök = (v: string) => {
        if (v.trim() && !sök.trim()) scrollRef.current?.scrollTo({ y: 0, animated: false });
        setSök(v);
    };
    const växlaSök = () => {
        setSökÖppen(ö => {
            const nästa = !ö;
            if (!nästa) setSök('');
            return nästa;
        });
    };

    /** Arkets höjd vid senaste stoppet - svarsradens fäst-räkning (nedan)
     *  behöver den som state. Under ett pågående drag står den kvar på
     *  förra stoppet, vilket räcker: innehållet scrollar ändå bara på taket. */
    const [arkHöjd, setArkHöjd] = useState(stopp[0]);
    const gåTill = (h: number) => {
        höjdRef.current = h;
        setPåTaket(h >= tak - TAK_MARGINAL);
        setArkHöjd(h);
        Animated.spring(translate, { toValue: tak - h, bounciness: 3, useNativeDriver: true }).start();
    };

    // Filterknappen (11/10, Josef: "det räcker att den går upp till halvvägs,
    // inte hela vägen till toppen"): fäll ut chipsen UTAN att fokusera fältet
    // (inget tangentbord - webbens filtersymbol gör likadant, 7/10-beslutet)
    // och lyft arket till MELLANHÖJDEN om det står lägre. Aldrig till taket.
    const växlaFilter = () => {
        const öppnar = !sökÖppen;
        växlaSök();
        if (öppnar && höjdRef.current < mellan) gåTill(mellan);
    };

    // Sökfältet får fokus (11/10, Josef: "om fönstret är uppe och man skriver
    // så ska den inte hoppa ner längst ner, för då hamnar den under
    // tangentbordet ... är den längst upp så kan den fortsatt vara där"):
    // tangentbordet täcker nedre ~40 % av skärmen, så arket lyfts till
    // MELLANHÖJDEN om det står lägre. Högre står still.
    const sökFokus = () => {
        if (!sökÖppen) setSökÖppen(true);
        if (höjdRef.current < mellan) gåTill(mellan);
    };

    // Dubbeltapp på listan fäller ihop arket till default-stoppet (11/10,
    // Josef: "funkar inte att dubbelklicka på listan, den åker inte ner").
    // Egna touch-handlers i stället för en gest-recognizer: radernas
    // enkeltryck ska vara orörda - tolkningen (lib/dubbeltapp, testad)
    // räknar bara två snabba stillastående tapp nära varandra.
    const tappRef = useRef<{ start: Tapp | null; förra: Tapp | null }>({ start: null, förra: null });
    const dubbeltapp = {
        onTouchStart: (ev: GestureResponderEvent) => {
            if (ev.nativeEvent.touches.length !== 1) { tappRef.current.start = null; return; }
            const { pageX, pageY, timestamp } = ev.nativeEvent;
            tappRef.current.start = { t: timestamp, x: pageX, y: pageY };
        },
        onTouchEnd: (ev: GestureResponderEvent) => {
            const s = tappRef.current.start;
            tappRef.current.start = null;
            if (!s) return;
            const { pageX, pageY, timestamp } = ev.nativeEvent;
            const slut: Tapp = { t: timestamp, x: pageX, y: pageY };
            if (!ärTapp(s, slut)) {
                tappRef.current.förra = null;
                return;
            }
            if (ärDubbeltapp(tappRef.current.förra, slut)) {
                tappRef.current.förra = null;
                if (höjdRef.current > stoppRef.current[0]) gåTill(stoppRef.current[0]);
            } else {
                tappRef.current.förra = slut;
            }
        },
    };

    const stoppRef = useRef(stopp);
    stoppRef.current = stopp;

    // Navraden (Nästa, Föregående, pagern) STEGAR mellan event och arket står
    // kvar på höjden man valt (Josef 13/10: "om den är på halvhöjd med
    // eventkortet och klickar nästa ... ska det inte hoppa ner", samma som
    // webbens EventCard). Trycket stämplas här och eventbytet strax efter
    // läser stämpeln - ett tryck som inte bytte event blir inaktuellt.
    const navTryckRef = useRef(0);
    const stega = (gör: () => void) => {
        navTryckRef.current = Date.now();
        gör();
    };

    // Nytt event eller ny grupp → default-höjd, innehållet överst. Ett steg
    // i navraden behåller höjden; står arket på default följer det ändå
    // nya huvudets default-stopp (effekten nedan).
    const nyckel = event?.id ?? `grupp:${grupp[0]?.id ?? ''}`;
    useEffect(() => {
        const viaNav = Date.now() - navTryckRef.current < NAV_STEG_MS;
        navTryckRef.current = 0;
        scrollRef.current?.scrollTo({ y: 0, animated: false });
        scrollYRef.current = 0;
        if (!viaNav) gåTill(stoppRef.current[0]);
        // gåTill är stabil nog
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nyckel]);
    // Default-stoppet följer huvudets höjd (chipsen fälls ut/in, sökning
    // gömmer eventet) - men bara under mellanhöjden, och i sökläget är
    // mellanhöjden golvet så fältet inte hamnar under tangentbordet
    // (lib/sheetSnap höjdEfterHuvudbyte, 11/10).
    useEffect(() => {
        const mål = höjdEfterHuvudbyte({
            höjd: höjdRef.current,
            nyttDefault: stopp[0],
            mellan,
            sökläge: sökÖppen || sök.trim().length > 0,
        });
        if (mål !== null) gåTill(mål);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stopp[0]]);

    // Arket glider ut under skärmkanten och kortet stängs - neddraget förbi
    // default och karttrycket delar samma utgång.
    const glidUt = () => {
        Animated.timing(translate, { toValue: tak, duration: 160, useNativeDriver: true })
            .start(() => stäng.current());
    };
    // Karttrycket (13/10): kortet stänger helt så dagväljaren syns. Noncen
    // jämförs mot den kortet monterades med - annars stänger ett tidigare
    // tryck på tom karta nästa kort i samma stund som det öppnas.
    const sedd = useRef(stängNonce);
    useEffect(() => {
        if (stängNonce === sedd.current) return;
        sedd.current = stängNonce;
        glidUt();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stängNonce]);
    // TVÅ dragytor med samma drag (Josef 13/10, "hela fönstret ska vara
    // grab"): huvudet och footern drar arket i alla lägen, innehållet
    // (CAPTURE - knappar, rader och bilden släpper ett lodrätt svep till
    // arket) gör det under taket och på taket bara för neddrag med listan i
    // toppen. Webbens touchstart-regel i EventCard, samma uppdelning.
    const { pan, innehållsPan } = useMemo(() => {
        const lodrätt = (g: { dx: number; dy: number }) => Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx);
        const drag = {
            onPanResponderMove: (_e: GestureResponderEvent, g: { dy: number }) => {
                const h = Math.min(tak, höjdRef.current - g.dy);
                translate.setValue(tak - Math.max(0, h));
            },
            onPanResponderRelease: (_e: GestureResponderEvent, g: { dy: number; vy: number }) => {
                const mål = landning(stoppRef.current, höjdRef.current, g.dy, g.vy);
                if (mål === null) {
                    glidUt();
                    return;
                }
                gåTill(mål);
            },
            onPanResponderTerminate: () => gåTill(höjdRef.current),
            // Ett pågående arkdrag lämnas aldrig bort - en rad som börjar
            // rulla i sidled får inte släppa kortet mitt i luften.
            onPanResponderTerminationRequest: () => false,
        };
        return {
            pan: PanResponder.create({ onMoveShouldSetPanResponder: (_e, g) => lodrätt(g), ...drag }),
            innehållsPan: PanResponder.create({
                onMoveShouldSetPanResponderCapture: (_e, g) => lodrätt(g)
                    && (höjdRef.current < tak - TAK_MARGINAL || (g.dy > 0 && scrollYRef.current <= 0)),
                ...drag,
            }),
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tak, translate]);
    const grepp: ArkGrepp = {
        innehållsPan: innehållsPan.panHandlers,
        påTaket,
        scrollYRef,
        scrollRef,
        dubbeltapp,
    };

    // Multievent-pagern "1/3 →" - bor i navraden ovanför arket (webben 16/9:
    // den trängde undan tid/plats på kortets platsrad).
    const gruppIndex = event ? grupp.findIndex(e => e.id === event.id) : -1;
    const pager = event && grupp.length > 1 && gruppIndex >= 0
        ? { text: `${gruppIndex + 1}/${grupp.length}`, nästa: grupp[(gruppIndex + 1) % grupp.length] }
        : null;
    const tryckNästa = () => { if (nav) stega(nav.onNästa); };

    return (
        <>
            {/* NAVRADEN OVANPÅ ARKET (webbens navrad med mb-4 ovanför kortet):
                bottom = arkets oförskjutna topp, samma translate som arket -
                raden rider på kortets överkant genom alla stopp och drag.
                box-none: tomrummet mellan knapparna släpper igenom kartan.
                ÄVEN ÖVER VÄLJARLISTAN (Josef 23/10, "klickar jag på ett
                multievent ... ska jag se den nästa knappen uppe åt höger"):
                Bakåt och Nästa står kvar när kortet visar högen, som på
                webben - bara pagern och ← ☰ hör till ett valt event. */}
            {nav || (event && (pager || onTillbakaTillLista)) ? (
                <Animated.View
                    style={[styles.navHållare, { bottom: tak, transform: [{ translateY: translate }] }]}
                    pointerEvents="box-none"
                >
                    <View style={styles.navRad} pointerEvents="box-none">
                        {/* Föregående: ALLTID synlig som motpol till Nästa
                            (webben) - emoji + liten ←-badge när historik
                            finns, dämpad pil annars. */}
                        {nav ? (
                            <Pressable
                                onPress={nav.onBakåt ? () => stega(nav.onBakåt!) : undefined}
                                disabled={!nav.onBakåt}
                                hitSlop={6}
                                accessibilityLabel={nav.bakåtEvent ? `Tillbaka till ${nav.bakåtEvent.title}` : 'Inget föregående event än'}
                                style={({ pressed }) => [styles.glasKnapp, !nav.onBakåt && styles.släckt, pressed && styles.tryckt]}
                            >
                                {nav.onBakåt && nav.bakåtEvent ? (
                                    <View style={styles.navEmojiYta}>
                                        <Text style={styles.navEmojiText}>{navEmoji(nav.bakåtEvent)}</Text>
                                        <View style={[styles.pilBadge, styles.pilBadgeVänster]}>
                                            <Text style={styles.pilBadgeText}>←</Text>
                                        </View>
                                        {nav.bakåtAntal > 1 ? (
                                            <View style={[styles.antalBadge, styles.antalBadgeHöger]}>
                                                <Text style={styles.antalBadgeText}>{nav.bakåtAntal}</Text>
                                            </View>
                                        ) : null}
                                    </View>
                                ) : (
                                    <Text style={styles.glasPil}>←</Text>
                                )}
                            </Pressable>
                        ) : null}
                        <View style={styles.navFyll} pointerEvents="none" />
                        {/* Pilen tillbaka till multievent-listan sitter DIREKT
                            till vänster om 1/2-pagern (ägarbeslut 7/10 kväll). */}
                        {onTillbakaTillLista ? (
                            <Pressable
                                onPress={onTillbakaTillLista}
                                hitSlop={8}
                                accessibilityLabel={tillbakaEtikett}
                                style={({ pressed }) => [styles.glasPill, pressed && styles.tryckt]}
                            >
                                <Text style={styles.glasPillText}>← ☰</Text>
                            </Pressable>
                        ) : null}
                        {pager ? (
                            <Pressable
                                onPress={() => stega(() => onVäljIGrupp?.(pager.nästa))}
                                hitSlop={6}
                                accessibilityLabel="Nästa event på samma plats"
                                style={({ pressed }) => [styles.glasPill, pressed && styles.tryckt]}
                            >
                                <Text style={styles.glasPillText}>{pager.text} →</Text>
                            </Pressable>
                        ) : null}
                        {/* Nästa - solid flaggblå kapsel med nästa events
                            emoji som förhandsvisning (webben). Dagbyte = GUL
                            RAM + 📅 (Josef 2/9: "lägg en gul ram i stället"). */}
                        {nav ? (() => {
                            const släckt = nav.nästaEtikett === null;
                            const dagByte = !släckt && nav.nästaEtikett !== 'NÄSTA';
                            return (
                                <Pressable
                                    onPress={tryckNästa}
                                    disabled={släckt}
                                    hitSlop={6}
                                    accessibilityLabel={nav.nästaEvent ? `Nästa: ${nav.nästaEvent.title}` : nav.nästaEtikett ?? 'Inget mer i bild'}
                                    style={({ pressed }) => [
                                        styles.nästaKapsel,
                                        dagByte && styles.nästaDagRam,
                                        släckt && styles.släckt,
                                        pressed && styles.tryckt,
                                    ]}
                                >
                                    <Text style={styles.nästaText}>{nav.nästaEtikett ?? 'NÄSTA'}</Text>
                                    {nav.nästaEvent ? (
                                        <View style={styles.navEmojiYta}>
                                            <Text style={styles.navEmojiText}>{navEmoji(nav.nästaEvent)}</Text>
                                            <View style={[styles.pilBadge, styles.pilBadgeHöger]}>
                                                <Text style={styles.pilBadgeText}>→</Text>
                                            </View>
                                            {nav.nästaAntal > 1 ? (
                                                <View style={[styles.antalBadge, styles.antalBadgeVänster]}>
                                                    <Text style={styles.antalBadgeText}>{nav.nästaAntal}</Text>
                                                </View>
                                            ) : null}
                                        </View>
                                    ) : (
                                        <Text style={styles.nästaSymbol}>{dagByte ? '📅' : '→'}</Text>
                                    )}
                                </Pressable>
                            );
                        })() : null}
                    </View>
                </Animated.View>
            ) : null}
            <Animated.View style={[styles.ark, { height: tak, transform: [{ translateY: translate }] }]}>
                {event ? (
                    <EventInnehåll
                        event={event}
                        grupp={grupp}
                        onVäljIGrupp={onVäljIGrupp}
                        lista={lista}
                        listaFrånOffset={listaFrånOffset}
                        flöde={flöde}
                        stad={stad}
                        sök={sök}
                        sökÖppen={sökÖppen}
                        onSök={handleSök}
                        onSökFokus={sökFokus}
                        onVäxlaFilter={växlaFilter}
                        sökFältRef={sökFältRef}
                        footerSkjut={translate}
                        arkHöjd={arkHöjd}
                        onVälj={onVälj}
                        inbjudan={inbjudan}
                        zoomUt={zoomUt}
                        onClose={onClose}
                        panHandlers={pan.panHandlers}
                        grepp={grepp}
                        onHuvudHöjd={setHuvudHöjd}
                    />
                ) : (
                    <Väljarlista
                        grupp={grupp}
                        onVälj={e => onVäljIGrupp?.(e)}
                        lista={lista}
                        listaFrånOffset={listaFrånOffset}
                        flöde={flöde}
                        stad={stad}
                        onVäljUrLista={onVälj ?? null}
                        zoomUt={zoomUt}
                        onClose={onClose}
                        panHandlers={pan.panHandlers}
                        grepp={grepp}
                        onHuvudHöjd={setHuvudHöjd}
                    />
                )}
            </Animated.View>
        </>
    );
}

type PanHandlers = ReturnType<typeof PanResponder.create>['panHandlers'];
type Dubbeltapp = {
    onTouchStart: (ev: GestureResponderEvent) => void;
    onTouchEnd: (ev: GestureResponderEvent) => void;
};
/** Det arkets scrollyta behöver av EventKort: innehållsdraget, om arket
 *  står på taket (då och bara då scrollar innehållet) och scrolläget. */
type ArkGrepp = {
    innehållsPan: PanHandlers;
    påTaket: boolean;
    scrollYRef: React.RefObject<number>;
    scrollRef: React.RefObject<ScrollView | null>;
    dubbeltapp: Dubbeltapp;
};

/** Dagsektionerna anmäler sig hit så scrollytan kan lägga den aktuella
 *  dagens rubrik klistrad överst (lib/klistradDag). Flikraden (Månaden ·
 *  Populärt) anmäler sig på samma väg: sin plats för klistringen, en levande
 *  KOPIA av raden (knapparna ska funka klistrade) och sin botten-lyssnare
 *  (listans utzoomning). */
type DagRegister = {
    anmäl: (nyckel: string, vy: View | null, offset: number) => void;
    mät: () => void;
    anmälFlikrad: (vy: View | null) => void;
    flikradKopia: (nod: ReactNode | null) => void;
    anmälBotten: (fn: ((scrollY: number) => void) | null) => void;
};
const DagRegisterCtx = createContext<DagRegister | null>(null);

/** En dag i kortets listor: rubriken + raderna. `rubrik` false = ingen
 *  rubrik (väljarlistan med en enda dag) och då heller ingen klistrad. */
function DagSektion({ offset, rubrik = true, children }: { offset: number; rubrik?: boolean; children: React.ReactNode }) {
    const register = useContext(DagRegisterCtx);
    const vy = useRef<View>(null);
    const nyckel = useId();
    useEffect(() => {
        if (!register || !rubrik) return;
        register.anmäl(nyckel, vy.current, offset);
        return () => register.anmäl(nyckel, null, offset);
    }, [register, rubrik, nyckel, offset]);
    return (
        <View ref={vy} onLayout={() => register?.mät()}>
            {rubrik ? <DagRubrik offset={offset} /> : null}
            {children}
        </View>
    );
}

/**
 * Arkets scrollyta - delas av eventkortet och väljarlistan.
 *  - Under taket scrollar den inte: innehållsdraget (capture) tar varje
 *    lodrätt svep till arket. På taket scrollar den, och ett neddrag med
 *    innehållet i toppen tar arket ner (bounces av, annars studsade
 *    innehållet samtidigt som arket drogs).
 *  - Dagrubriken klistras överst när man scrollat förbi den (Josef 13/10).
 *    Sektionerna mäts om när de själva eller innehållets höjd ändras.
 *  - KLISTERSTAPELN (18/10, webbens sticky-ordning): `topp` (svarsradens
 *    topprad, z högst) ligger alltid överst när den finns; flikraden
 *    (Månaden · Populärt) klistras under den när dess plats scrollat förbi;
 *    dagrubriken fäster under båda. Webbens EventCard gör samma sak med
 *    --card-sticky-top + flikradens höjd i dagrubrikernas sticky top.
 *  - `onScrollY` låter EventInnehåll räkna om svarsradens fäste, och
 *    botten-lyssnaren (registret) får scrolläget nära innehållets slut -
 *    listans utzoomning (lib/listZoom).
 */
function ArkScroll({
    grepp,
    contentContainerStyle,
    tangentbordsInsets = false,
    topp = null,
    onScrollY,
    children,
}: {
    grepp: ArkGrepp;
    contentContainerStyle: object;
    tangentbordsInsets?: boolean;
    /** Klistrad rad ovanför allt annat (RsvpToppRad). */
    topp?: ReactNode;
    /** Kallas vid varje scrolläge - svarsradens fäst-räkning. */
    onScrollY?: (y: number) => void;
    children: React.ReactNode;
}) {
    const { innehållsPan, påTaket, scrollYRef, scrollRef, dubbeltapp } = grepp;
    const inreRef = useRef<View>(null);
    const sektioner = useRef(new Map<string, { vy: View; offset: number }>());
    const platser = useRef<DagPlats[]>([]);
    const rubrikHöjd = useRef(40);
    const mätRaf = useRef<number | null>(null);
    const [klistrad, setKlistrad] = useState<{ offset: number; skjut: number } | null>(null);

    // Flikradens klistring: platsen mäts som dagsektionerna, kopian kommer
    // från FlerEvent (den ska vara tryckbar, så den bär flikens state).
    const flikradVy = useRef<View | null>(null);
    const flikradPlats = useRef<{ y: number; höjd: number } | null>(null);
    const [flikradNod, setFlikradNod] = useState<ReactNode | null>(null);
    const [flikradFast, setFlikradFast] = useState<{ höjd: number } | null>(null);
    const bottenFn = useRef<((scrollY: number) => void) | null>(null);
    const innehållH = useRef(0);
    const vyH = useRef(0);
    // Toppradens höjd skjuter flikrad + dagrubrik nedåt; som ref i
    // uppdatera-closuren och som state för utritningen.
    const [toppH, setToppH] = useState(0);
    const toppHRef = useRef(0);
    const toppPåRef = useRef(false);
    toppPåRef.current = !!topp;

    const uppdatera = () => {
        const y = scrollYRef.current;
        const toppSkjut = toppPåRef.current ? toppHRef.current : 0;
        const fp = flikradPlats.current;
        const fast = !!fp && y + toppSkjut > fp.y;
        setFlikradFast(f => (!!f === fast && f?.höjd === fp?.höjd ? f : fast && fp ? { höjd: fp.höjd } : null));
        const skjut = toppSkjut + (fast && fp ? fp.höjd : 0);
        const nästa = klistradDag(platser.current, y + skjut, rubrikHöjd.current);
        setKlistrad(f => (f?.offset === nästa?.offset && f?.skjut === nästa?.skjut ? f : nästa));
    };
    const register = useMemo<DagRegister>(() => {
        const mät = () => {
            if (mätRaf.current !== null) return;
            mätRaf.current = requestAnimationFrame(() => {
                mätRaf.current = null;
                const inre = inreRef.current;
                if (!inre) return;
                const fv = flikradVy.current;
                if (fv) {
                    fv.measureLayout(inre, (_x, y, _b, h) => {
                        flikradPlats.current = { y, höjd: h };
                        uppdatera();
                    }, () => {});
                } else {
                    flikradPlats.current = null;
                }
                const poster = [...sektioner.current.values()];
                if (poster.length === 0) {
                    platser.current = [];
                    uppdatera();
                    return;
                }
                const nya: DagPlats[] = [];
                let kvar = poster.length;
                const klar = () => {
                    if (--kvar > 0) return;
                    platser.current = nya;
                    uppdatera();
                };
                for (const p of poster) {
                    p.vy.measureLayout(inre, (_x, y, _b, h) => {
                        nya.push({ y, höjd: h, offset: p.offset });
                        klar();
                    }, klar);
                }
            });
        };
        return {
            anmäl: (nyckel, vy, offset) => {
                if (vy) sektioner.current.set(nyckel, { vy, offset });
                else sektioner.current.delete(nyckel);
                mät();
            },
            mät,
            anmälFlikrad: vy => {
                flikradVy.current = vy;
                mät();
            },
            flikradKopia: setFlikradNod,
            anmälBotten: fn => { bottenFn.current = fn; },
        };
        // Refs och setState - registret byggs en gång per scrollyta.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    useEffect(() => () => {
        if (mätRaf.current !== null) cancelAnimationFrame(mätRaf.current);
    }, []);
    // Toppraden tänds/släcks eller byter höjd → klistringarna flyttar sig.
    useEffect(uppdatera, [topp, toppH]); // eslint-disable-line react-hooks/exhaustive-deps

    const toppSkjut = topp ? toppH : 0;
    const dagTopp = toppSkjut + (flikradFast?.höjd ?? 0);
    return (
        <View style={styles.scrollYta} {...innehållsPan}>
            <DagRegisterCtx.Provider value={register}>
                <ScrollView
                    ref={scrollRef}
                    // RN:s typ kräver en icke-null-ref; den är satt när mätningen körs.
                    innerViewRef={inreRef as React.RefObject<View>}
                    {...dubbeltapp}
                    style={styles.innehåll}
                    contentContainerStyle={contentContainerStyle}
                    scrollEnabled={påTaket}
                    bounces={false}
                    scrollEventThrottle={16}
                    onLayout={ev => { vyH.current = ev.nativeEvent.layout.height; }}
                    onScroll={ev => {
                        scrollYRef.current = ev.nativeEvent.contentOffset.y;
                        uppdatera();
                        onScrollY?.(scrollYRef.current);
                        // Nära botten (webbens rootMargin 120px): listans
                        // utzoomningssteg, gaten bor hos lyssnaren.
                        if (innehållH.current - (scrollYRef.current + vyH.current) < 140) {
                            bottenFn.current?.(scrollYRef.current);
                        }
                    }}
                    onContentSizeChange={(_w, h) => {
                        innehållH.current = h;
                        register.mät();
                    }}
                    automaticallyAdjustKeyboardInsets={tangentbordsInsets}
                >
                    {children}
                </ScrollView>
            </DagRegisterCtx.Provider>
            {klistrad ? (
                <View
                    style={[styles.klistradDag, { top: dagTopp, transform: [{ translateY: klistrad.skjut }] }]}
                    pointerEvents="none"
                    onLayout={ev => { rubrikHöjd.current = ev.nativeEvent.layout.height; }}
                >
                    <DagRubrik offset={klistrad.offset} />
                </View>
            ) : null}
            {flikradFast && flikradNod ? (
                <View style={[styles.klistradFlikrad, { top: toppSkjut }]}>{flikradNod}</View>
            ) : null}
            {topp ? (
                <View
                    style={styles.klistradTopp}
                    onLayout={ev => {
                        const h = ev.nativeEvent.layout.height;
                        if (h !== toppHRef.current) {
                            toppHRef.current = h;
                            setToppH(h);
                        }
                    }}
                >
                    {topp}
                </View>
            ) : null}
        </View>
    );
}

/** Två dragstreck - webbens grip-indikator ("dra upp/ner"-affordance). */
function Handtag() {
    return (
        <View style={styles.handtag}>
            <View style={styles.handtagStreck} />
            <View style={styles.handtagStreck} />
        </View>
    );
}

/** Månaden-flikens tal: samma eventDagar-underlag som listan under kortet.
 *  `utesluten` är det valda eventet (räknas som passerat, som i fliken).
 *  Stadsknappen visas bara i infovyn, där listan är BILDFLÖDET - talet
 *  räknar då bildraderna, exakt som fliken (webbens cityCount =
 *  tabDays.all.count). */
function månadsTal(lista: AppFeedEvent[], frånOffset: number, utesluten: string): number | null {
    if (lista.length === 0) return null;
    const nu = new Date();
    const nuMs = nu.getTime();
    const dagar = eventDagar(bildflöde(lista), frånOffset, nu, e => isEventPast(e, nuMs) || e.id === utesluten);
    return dagar.reduce((n, d) => n + d.events.length, 0);
}

/** Dagrubriken i kortets listor - webbens blå streck + dagen i fetstil. */
function DagRubrik({ offset }: { offset: number }) {
    const text = periodLabel(offset, 1);
    return (
        <View style={styles.dagRubrik}>
            <View style={styles.dagStreck} />
            <Text style={styles.dagRubrikText}>{text.charAt(0).toUpperCase() + text.slice(1)}</Text>
        </View>
    );
}

/** Väljarlistans rubrik: lokalen när HELA högen delar namn, annars orten
 *  (webbens placeName - event geokodade till ortens mitt hamnar i samma hög). */
function platsNamn(grupp: AppFeedEvent[]): string | null {
    const först = grupp[0];
    if (!först) return null;
    const namn = först.locationName?.trim() ?? '';
    if (namn && grupp.every(e => (e.locationName?.trim() ?? '') === namn)) return namn;
    return Number.isFinite(först.lat) && Number.isFinite(först.lng) ? nearestCity(först.lat, först.lng).name : null;
}

function Väljarlista({
    grupp,
    onVälj,
    lista,
    listaFrånOffset,
    flöde,
    stad,
    onVäljUrLista,
    zoomUt = null,
    onClose,
    panHandlers,
    grepp,
    onHuvudHöjd,
}: {
    grupp: AppFeedEvent[];
    onVälj: (e: AppFeedEvent) => void;
    lista: AppFeedEvent[];
    listaFrånOffset: number;
    flöde: readonly AppFeedEvent[];
    stad: { slug: string; name: string } | null;
    /** null på skärmar utan den gemensamma listan (stadsskärmen). */
    onVäljUrLista: ((e: AppFeedEvent) => void) | null;
    zoomUt?: KortZoomUt | null;
    onClose: () => void;
    panHandlers: PanHandlers;
    grepp: ArkGrepp;
    onHuvudHöjd: (h: number) => void;
}) {
    const plats = platsNamn(grupp);
    // Kommande dag för dag, passerade HOPFÄLLDA längst ner (webbens
    // EventCardGroupList: "Passerade event ligger hopfällda tills man ber om
    // dem"). Dagrubrikerna bara när högen spänner över flera dagar.
    const { dagar, passerade } = useMemo(() => delaVäljarlista(grupp, new Date()), [grupp]);
    // Utfällningen gäller bara den hög den gjordes i (ny bricka = hopfällt).
    const högNyckel = `${grupp[0]?.id ?? ''}:${grupp.length}`;
    const [utfälldHög, setUtfälldHög] = useState<string | null>(null);
    const visaPasserade = utfälldHög === högNyckel;
    /** Arrangörsraden bara när HELA högen delar källdomän (webbens
     *  chooserOrganizerRow, som matchar värdnamn - flödet har bara domänen). */
    const gruppRad = useMemo(() => {
        const först = grupp[0];
        if (!först) return null;
        const domän = källDomän(först.id);
        if (!domän || !grupp.every(e => källDomän(e.id) === domän)) return null;
        return arrangörsRad(först, null, flöde, Date.now());
    }, [grupp, flöde]);
    return (
        <>
            <View {...panHandlers} onLayout={ev => onHuvudHöjd(ev.nativeEvent.layout.height + 120)}>
                <Handtag />
                <View style={styles.rad}>
                    <View style={styles.textkol}>
                        {plats ? (
                            <View style={styles.väljarPlats}>
                                <Ikon namn="plats" storlek={17} färg="#0f172a" />
                                <Text style={styles.titel} numberOfLines={2}>{plats}</Text>
                            </View>
                        ) : (
                            <Text style={styles.titel} numberOfLines={2}>{`${grupp.length} event här`}</Text>
                        )}
                        <Text style={styles.väljarRäknare} numberOfLines={1}>
                            {väljarRäknare(grupp.length, dagar.length, passerade.length).toUpperCase()}
                        </Text>
                    </View>
                    <Pressable onPress={onClose} hitSlop={12} style={styles.stang} accessibilityLabel="Stäng">
                        <Text style={styles.stangText}>✕</Text>
                    </Pressable>
                </View>
                <View style={styles.väljarPill}>
                    <Text style={styles.väljarPillText}>Välj ett event</Text>
                </View>
            </View>
            {/* Högen först, sedan SAMMA block som när man valt ett event
                (ägarbeslut 7/10 kväll: "listan går att fortsätta bläddra i,
                utan att välja dem i början"). Delar hela högen arrangör visas
                arrangörsraden + stadsknappen mellan högen och listan.
                Platsrubriken är redan "sticky": den ligger utanför den här
                scrollvyn och följer alltså aldrig med upp. */}
            <ArkScroll grepp={grepp} contentContainerStyle={styles.innehållInre}>
                {dagar.map(d => (
                    <DagSektion key={d.offset} offset={d.offset} rubrik={dagar.length > 1}>
                        {d.events.map(e => (
                            <EventRad key={e.id} event={e} tema="ljus" onPress={() => onVälj(e)} />
                        ))}
                    </DagSektion>
                ))}
                {/* Historiken: det som redan varit ligger hopfällt längst ner -
                    passerade rader går fortfarande att trycka (webben, medvetet). */}
                {passerade.length > 0 ? (
                    <>
                        <Pressable
                            onPress={() => setUtfälldHög(visaPasserade ? null : högNyckel)}
                            style={styles.passeradeKnapp}
                            accessibilityRole="button"
                            accessibilityState={{ expanded: visaPasserade }}
                        >
                            <Ikon namn="tid" storlek={11} färg="#94a3b8" />
                            <Text style={styles.passeradeText}>
                                {passerade.length} har redan varit · {visaPasserade ? 'Dölj' : 'Visa'}
                            </Text>
                        </Pressable>
                        {visaPasserade
                            ? passerade.map(e => (
                                <EventRad key={e.id} event={e} tema="ljus" dimmad harVarit onPress={() => onVälj(e)} />
                            ))
                            : null}
                    </>
                ) : null}
                {onVäljUrLista ? (
                    <>
                        <FlerFran
                            rad={gruppRad}
                            stad={stad}
                            stadAntal={stad ? månadsTal(lista, listaFrånOffset, '') : null}
                            onVälj={onVäljUrLista}
                        />
                        {lista.length > 0 ? (
                            <FlerEvent lista={lista} valtId="" frånOffset={listaFrånOffset} bildflödesLäge onVälj={onVäljUrLista} zoomUt={zoomUt} />
                        ) : null}
                    </>
                ) : null}
            </ArkScroll>
        </>
    );
}

function EventInnehåll({
    event,
    grupp,
    onVäljIGrupp,
    lista,
    listaFrånOffset,
    flöde,
    stad,
    sök,
    sökÖppen,
    onSök,
    onSökFokus,
    onVäxlaFilter,
    sökFältRef,
    footerSkjut,
    arkHöjd,
    onVälj,
    inbjudan,
    zoomUt,
    onClose,
    panHandlers,
    grepp,
    onHuvudHöjd,
}: {
    event: AppEvent;
    grupp: AppFeedEvent[];
    onVäljIGrupp?: (e: AppFeedEvent) => void;
    lista: AppFeedEvent[];
    listaFrånOffset: number;
    flöde: readonly AppFeedEvent[];
    stad: { slug: string; name: string } | null;
    sök: string;
    sökÖppen: boolean;
    onSök: (v: string) => void;
    /** Fältet fick fokus: chipsen fram + arket upp till mellanhöjden. */
    onSökFokus: () => void;
    /** Filtersymbolen: chips utan tangentbord + lyft till mellanstoppet. */
    onVäxlaFilter: () => void;
    sökFältRef: React.RefObject<TextInput | null>;
    /** Arkets translateY - footern counter-translaterar mot skärmens botten. */
    footerSkjut: Animated.Value;
    /** Arkets höjd vid senaste stoppet - fäst-räkningen för svarsraden. */
    arkHöjd: number;
    onVälj?: (e: AppFeedEvent) => void;
    inbjudan: { fran: string | null; onStäng: () => void } | null;
    zoomUt?: KortZoomUt | null;
    onClose: () => void;
    panHandlers: PanHandlers;
    grepp: ArkGrepp;
    onHuvudHöjd: (h: number) => void;
}) {
    const { minPos } = useRegionVal();
    const { ärSparad, växla } = useSparade();
    const filter = useFilter();
    // Användarskapade event bär beskrivning/värd själva - id:t är ett
    // dokument-id, ingen URL att slå upp i aggregaten.
    const detalj = useEventDetalj(event.userCreated ? null : event.id);
    const [helskärm, setHelskärm] = useState<string | null>(null);

    const kat = kategoriFor(String(event.category));
    const emoji = event.emoji || kat.emoji;
    const tm = isTicketmasterEvent(event);
    const sparad = ärSparad(event.id);
    const nu = Date.now();
    const harVarit = isEventPast(event, nu);
    /** VADKUL-värdat (eget event, inte tips) - webbens isVadkulHostedEvent:
     *  platsen är enda vägen dit och får en egen radbruten rad nedan. */
    const vadkulVärdat = !!event.userCreated && !event.isTip;

    // Gilla-siffran vid hjärtat (webbens likeCache + displayedLikeCount):
    // samma sessionscachade eventStats-läsning som svarsraden, fördröjd
    // 400 ms så snabb Nästa-bläddring inte eldar en läsning per steg. Eget
    // tryck justeras ±1 mot baslinjen (sparad-läget NÄR siffran lästes).
    const [gillaBas, setGillaBas] = useState<{ n: number; sparadDå: boolean } | null>(null);
    useEffect(() => {
        let aktiv = true;
        setGillaBas(null);
        const sparadVid = sparad;
        const timer = setTimeout(() => {
            void hämtaEngagemang(event.id).then(e => {
                if (aktiv && e) setGillaBas({ n: e.likes, sparadDå: sparadVid });
            });
        }, 400);
        return () => { aktiv = false; clearTimeout(timer); };
        // Bara per event - egna tryck räknas om lokalt nedan.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [event.id]);
    const gillaAntal = gillaBas
        ? Math.max(0, gillaBas.n - (gillaBas.sparadDå ? 1 : 0) + (sparad ? 1 : 0))
        : 0;

    // Stjärngåvan ⭐ (webbens LinkEventCard): prenumerationen på eventStars
    // delas med kartan (EN Firestore-lyssnare i data/stjarnor), kvar-siffran
    // läses en gång per konto och session. Knappen visas bara när man har en
    // oanvänd stjärna och eventet inte varit; annars ren guld-indikator.
    const { användare } = useKonto();
    const [stjärnmärkta, setStjärnmärkta] = useState<ReadonlySet<string>>(new Set());
    useEffect(() => prenumereraStjärnmärkta(setStjärnmärkta), []);
    const [stjärnorKvar, setStjärnorKvar] = useState(0);
    useEffect(() => {
        if (!användare) { setStjärnorKvar(0); return; }
        let aktiv = true;
        void hämtaStjärnorKvar(användare.uid).then(n => { if (aktiv) setStjärnorKvar(n); });
        return () => { aktiv = false; };
    }, [användare]);
    const harStjärna = stjärnmärkta.has(event.id);
    const visaStjärnknapp = kanSättaStjärna(!!användare, stjärnorKvar, harVarit);
    const sättStjärnan = () => {
        // Placeringen är ENGÅNGS (webben: kan aldrig ångras eller flyttas)
        // → alltid bekräftelse innan Cloud-funktionen kallas.
        Alert.alert(
            'Sätt din stjärna här?',
            `Stjärnan sätts på "${event.title}" och lyser för alla tills eventet varit. Det går inte att ångra.`,
            [
                { text: 'Avbryt', style: 'cancel' },
                {
                    text: 'Sätt stjärnan',
                    onPress: async () => {
                        const svar = await sättStjärna(event.id);
                        if (svar.success) {
                            setStjärnorKvar(k => (typeof svar.starsLeft === 'number' ? Math.max(0, svar.starsLeft) : Math.max(0, k - 1)));
                        } else {
                            Alert.alert('Det gick inte', svar.message);
                        }
                    },
                },
            ],
        );
    };

    const tid = formatTidSpann(event.time, event.hasSpecificTime, event.endDate);
    const km = minPos ? distanceKm(minPos.lat, minPos.lng, event.lat, event.lng) : null;
    const plats = [km != null ? `${formatKm(km)} bort` : null, event.locationName].filter(Boolean).join(' · ');
    const värd = event.userCreated
        ? (event.hostName || 'VADKUL-användare')
        : hostLabelFor(detalj.data?.hostName, detalj.data?.url ?? event.url ?? event.id);
    const beskrivning = event.userCreated
        ? descriptionText(event.description, false)
        : descriptionText(detalj.data?.description, detalj.isLoading);
    // Härkomst-badgen (webbens LinkEventCard): grönt "Skapat på VADKUL" eller
    // dämpad tips-bricka, med seriens rytm + slut längst till höger (16/9).
    const härkomst = event.userCreated
        ? (event.isTip ? '💡 TIPSAT AV EN VADKUL-ANVÄNDARE' : '✨ SKAPAT PÅ VADKUL')
        : null;
    const rytm = event.userCreated ? seriensRytm(event) : null;
    // Webbens normalizePriceLabel: "160:-" → "160 kr", "fri entré" → "Gratis"
    // (skrapade event bär källans råtext i flödet sedan 29/10).
    const pris = normaliseraPris(event.price);
    const utlänk = eventOutlink(event.id, detalj.data?.url ?? event.url);
    const annons = isAffiliateUrl(utlänk);
    // Värd-radens favicon (webbens hostFaviconUrl) - grön initial-avatar för
    // VADKUL-värdade event som på webben (de saknar extern sajt). Laddfel →
    // initialen i stället (Androids bilddekoder är kinkigare med .ico), och
    // felet nollas per event så det inte fastnar.
    const favicon = event.userCreated ? null : hostFaviconUrl(utlänk);
    const [faviconFel, setFaviconFel] = useState(false);
    useEffect(() => setFaviconFel(false), [event.id]);

    const söker = sök.trim().length > 0;
    // Kategorichipsen i knappraden: väljer man ett filter som det ÖPPNA
    // eventet inte matchar visas LISTAN direkt (11/10, Josef: "då ska vi ju
    // komma till listan ... som faktiskt har det man söker på") - eventets
    // bricka är ju också borta från kartan bakom. Släpps filtret kommer
    // eventet tillbaka.
    const filtreradBort = !matcharFilter(event, filter);
    const listLäge = söker || filtreradBort;
    useEffect(() => {
        if (filtreradBort) grepp.scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, [filtreradBort, grepp.scrollRef]);
    /** Stadsknappens tal = Månaden-flikens: samma eventDagar-underlag, utan
     *  kortsökets smalning (headern är ändå gömd medan man söker). */
    const månadsAntal = useMemo(
        () => (stad ? månadsTal(lista, listaFrånOffset, event.id) : null),
        [stad, lista, listaFrånOffset, event.id],
    );
    // "Fler från samma arrangör" (6/10) - värdnamnet kommer med detaljsvaret,
    // raden räknas om när det landat (namn + sidlänk).
    const flerFrån = useMemo(
        () => arrangörsRad(event, detalj.data?.hostName ?? null, flöde, nu),
        // nu tickar per render - raden ändras bara med event/detalj/flöde
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [event, detalj.data?.hostName, flöde],
    );

    // Footern/toppraden delar samma CTA (enda utlänken sedan 7/10).
    const cta: RsvpCta | null = utlänk
        ? { url: utlänk, label: tm ? 'BOKA' : 'ANMÄL', guld: tm, annons: annons ? AFFILIATE_DISCLOSURE : null }
        : null;
    // Egna VADKUL-event har ingen utlänk - där anmäler ANMÄL i appen (29/10,
    // webbens "ANMÄL DIG" i LinkEventCard). En instans för radens tre kopior.
    const anmälan = useAnmälan(event);

    // SVARSRADENS FÄSTE (webbens sticky bottom-0, Josef 7/10 kväll: "den kan
    // ju vara där nere i footern tills dess att vi kommer fram till där de
    // syns i eventkortet och lossna ifrån sin stickiness då"): raden bor
    // mellan beskrivningen och chatten, och visas där av scrollflödet. Så
    // länge dess plats ligger under skärmkanten pinnas en KOPIA i botten
    // (footerHållaren) - båda är monterade (läsningarna är sessionscachade)
    // så släppet är sömlöst: i släppögonblicket står de pixellika. Scrollar
    // raden sedan ut över överkanten tänds toppraden (RsvpToppRad).
    //  - synligt innehåll = arkets höjd minus huvudet; arkets botten är
    //    skärmens botten, så platsen "syns" när slotbotten kommit ovanför.
    //  - setState bara vid flippar (samma värde = ingen omritning).
    //  - kopian i kortet har mindre luft under knapparna än den pinnade
    //    (ingen hemindikator under den, Josef 29/10), så släppet mäts mot
    //    den PINNADE kopians höjd: då står knapparna pixellika i
    //    släppögonblicket och bara den vita luften under dem skiljer.
    const [fäst, setFäst] = useState(true);
    const [toppRad, setToppRad] = useState(false);
    const slotRef = useRef<{ y: number; h: number } | null>(null);
    const fotHRef = useRef<number | null>(null);
    const huvudHRef = useRef(230);
    const arkHöjdRef = useRef(arkHöjd);
    arkHöjdRef.current = arkHöjd;
    const listLägeRef = useRef(listLäge);
    listLägeRef.current = listLäge;
    const räknaFäste = () => {
        const slot = slotRef.current;
        if (listLägeRef.current || !slot) {
            // Sökläget gömmer eventet - raden står pinnad som förut.
            setFäst(true);
            setToppRad(false);
            return;
        }
        const synligt = Math.max(0, arkHöjdRef.current - huvudHRef.current);
        const y = grepp.scrollYRef.current;
        setFäst(slot.y + (fotHRef.current ?? slot.h) > y + synligt + 1);
        setToppRad(y > slot.y);
    };
    // Nytt stopp, nytt event eller vyväxling flyttar fästet utan scroll.
    useEffect(räknaFäste, [arkHöjd, listLäge, event.id]); // eslint-disable-line react-hooks/exhaustive-deps

    // Bara sökläget gömmer huvudets eventdel (härkomst, titel, tid/plats,
    // VÄRD/PRIS). 18-28/10 gömdes den också när toppraden tändes (titeln
    // stod dubbelt, Josef 18/10) - men då krympte huvudet mitt i scrollen och
    // hela innehållet ryckte upp lika mycket (Josef 28/10: "innehållet på
    // eventkortet hoppar också upp. så det blir för mycket som rör på sig").
    // Nu står huvudet still och toppraden bär bara knapparna - titeln står
    // ändå en gång, i huvudet.
    const huvudGömt = listLäge;

    return (
        <>
            <View
                {...panHandlers}
                onLayout={ev => {
                    huvudHRef.current = ev.nativeEvent.layout.height;
                    onHuvudHöjd(ev.nativeEvent.layout.height);
                    räknaFäste();
                }}
            >
                <Handtag />
                {/* Webbens headerordning: härkomst-badgen → knappraden → titel
                    → tid/plats → VÄRD/PRIS. Söker man göms eventet (ägarbeslut
                    7/10 kväll, huvudGömt ovan) - kvar är bara knappraden med
                    fältet och chipsen. Det gömda ligger i TVÅ stabila slottar runt
                    knappraden, så dess plats i trädet står still och
                    TextInputen aldrig remountas (tangentbordet får inte
                    stängas av vyskiftet). */}
                {!huvudGömt && härkomst ? (
                    <View style={styles.härkomstRad}>
                        <View style={[styles.härkomstBadge, event.isTip ? styles.tipsBadge : styles.egetBadge]}>
                            <Text style={[styles.härkomstText, event.isTip ? styles.tipsText : styles.egetText]} numberOfLines={1}>
                                {härkomst}
                            </Text>
                        </View>
                        {rytm ? <Text style={styles.rytm} numberOfLines={1}>{rytm}</Text> : null}
                    </View>
                ) : null}
                {/* Knappraden (webbens toolbar ovanför titeln): kortsöket är
                    ett RIKTIGT FÄLT med filtersymbolen bredvid (7/10 kväll),
                    hjärtat till höger - och appens ✕ ytterst (webben stänger
                    bara med drag, arket behöver en tydlig väg ut). Den stora
                    ANMÄL/BOKA-knappen är RIVEN - footern är enda utlänken.
                    Dela-knappen är riven sedan tidigare - Bjud med delar. */}
                <View style={styles.knappRad}>
                    {lista.length > 0 ? (
                        <>
                            <TextInput
                                ref={sökFältRef}
                                value={sök}
                                onChangeText={onSök}
                                placeholder="Sök event eller plats …"
                                placeholderTextColor="#94a3b8"
                                autoCorrect={false}
                                returnKeyType="search"
                                onFocus={onSökFokus}
                                // iOS-fältet vägrar annars lämna ifrån sig
                                // gesten - svepet i sökrutan ska dra arket
                                // som resten av huvudet (Josef 13/10).
                                rejectResponderTermination={false}
                                style={styles.sökFält}
                            />
                            <Pressable
                                style={({ pressed }) => [styles.knapp, styles.filterKnapp, (sökÖppen || filter.aktivt) && styles.filterKnappPå, pressed && styles.knappTryckt]}
                                onPress={onVäxlaFilter}
                                accessibilityLabel="Visa kategorier"
                            >
                                <Text style={[styles.filterIkon, (sökÖppen || filter.aktivt) && styles.filterIkonPå]}>☰</Text>
                            </Pressable>
                        </>
                    ) : (
                        <View style={styles.knappFyll} />
                    )}
                    {/* Stjärngåvan ⭐ bredvid hjärtat (webbens ordning):
                        klickbar när man har en oanvänd stjärna, annars ren
                        guld-indikator på event som redan HAR en stjärna. */}
                    {visaStjärnknapp ? (
                        <Pressable
                            style={({ pressed }) => [styles.knapp, styles.stjärnKnapp, pressed && styles.knappTryckt]}
                            onPress={sättStjärnan}
                            accessibilityLabel="Sätt din stjärna på eventet"
                        >
                            <Text style={styles.stjärnText}>{harStjärna ? '★' : '☆'}</Text>
                        </Pressable>
                    ) : harStjärna ? (
                        <View
                            style={[styles.knapp, styles.stjärnKnapp, styles.stjärnHar]}
                            accessibilityLabel="Det här eventet har fått en stjärna"
                        >
                            <Text style={styles.stjärnText}>★</Text>
                        </View>
                    ) : null}
                    <Pressable
                        style={({ pressed }) => [styles.knapp, styles.hjärtKnapp, gillaAntal > 0 && styles.hjärtKnappBred, sparad && styles.hjärtSparad, pressed && styles.knappTryckt]}
                        onPress={() => växla(event)}
                        accessibilityLabel={sparad ? 'Ta bort din gillning' : 'Gilla eventet'}
                    >
                        <Text style={[styles.hjärtText, sparad && styles.hjärtTextSparad]}>{sparad ? '♥' : '♡'}</Text>
                        {/* Gilla-siffran (webben 27/9: "vid varje like-knapp ska
                            man se hur många som klickat") - göms på 0. */}
                        {gillaAntal > 0 ? (
                            <Text style={[styles.hjärtAntal, sparad && styles.hjärtAntalSparad]}>{gillaAntal}</Text>
                        ) : null}
                    </Pressable>
                    <Pressable onPress={onClose} hitSlop={12} style={styles.stang} accessibilityLabel="Stäng">
                        <Text style={styles.stangText}>✕</Text>
                    </Pressable>
                </View>
                {/* Kategorichipsen direkt under knappraden - samma rad som
                    sökpanelen, delat filter: ett val smalnar listan i kortet
                    OCH kartan bakom. */}
                {sökÖppen ? <KategoriRad events={lista} /> : null}
                {!huvudGömt ? (
                <>
                {/* Titelraden - stor emoji + svart fet titel på egen rad, med
                    FAST tvåradshöjd som webben (h-[2.8rem]): enradstitlar
                    centreras så huvudets höjd inte hoppar mellan event. */}
                <View style={[styles.rad, styles.titelYta]}>
                    <Text style={[styles.titel, harVarit && styles.titelVarit]} numberOfLines={2}>
                        <Text style={styles.titelEmoji}>{emoji}</Text>  {event.title}
                    </Text>
                </View>
                {/* Tid + avstånd/plats på EN sidledsrullande rad (webbens
                    HScrollRow) - inget trunkeras (ägarbeslut 16/9). UNDANTAG
                    som webben: VADKUL-värdade event länkar inte ut någonstans,
                    platsen är enda vägen dit och får en egen rad som radbryts
                    fritt i stället. */}
                <View style={styles.metaYta}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.metaRad}>
                        <View style={styles.metaPost}>
                            <Ikon namn="tid" />
                            <Text style={styles.meta}>{tid}{harVarit ? ' · har varit' : ''}</Text>
                        </View>
                        {!vadkulVärdat && plats ? (
                            <View style={styles.metaPost}>
                                <Ikon namn="plats" />
                                <Text style={styles.meta}>{plats}</Text>
                            </View>
                        ) : null}
                    </ScrollView>
                    {vadkulVärdat && plats ? (
                        <View style={[styles.metaPost, styles.metaBruten]}>
                            <Ikon namn="plats" />
                            <Text style={[styles.meta, styles.metaBrutenText]}>{plats}</Text>
                        </View>
                    ) : null}
                </View>
                {/* VÄRD/PRIS-raden med avdelare (webbens kortfot i headern):
                    favicon-avatar + värdnamn till vänster, priset till höger.
                    Ersätter chipraden - webbens kort har inga chips. */}
                <View style={styles.värdRad}>
                    <View style={styles.värdKol}>
                        <Text style={styles.kolRubrik}>VÄRD</Text>
                        <View style={styles.värdNamnRad}>
                            <View style={[styles.värdAvatar, event.userCreated && styles.värdAvatarEget]}>
                                {favicon && !faviconFel ? (
                                    // recyclingKey: nollställ bilden vid eventbyte så
                                    // förra värdens favicon aldrig står kvar medan den
                                    // nya laddar (samma grepp som EventRad).
                                    <Image
                                        source={{ uri: favicon }}
                                        style={styles.värdFavicon}
                                        contentFit="contain"
                                        recyclingKey={event.id}
                                        onError={() => setFaviconFel(true)}
                                    />
                                ) : (
                                    <Text style={[styles.värdInitial, event.userCreated && styles.värdInitialEget]}>
                                        {värd.charAt(0).toUpperCase()}
                                    </Text>
                                )}
                            </View>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.värdNamnScroll}>
                                {/* Värdnamnet är en EGEN väg till arrangörssidan när
                                    sluggen finns (webbens understrukna värdnamn). */}
                                {flerFrån?.slug ? (
                                    <Pressable
                                        onPress={() => router.push({ pathname: '/arrangor/[slug]', params: { slug: flerFrån.slug!, namn: flerFrån.namn, doman: flerFrån.domän } })}
                                        hitSlop={8}
                                        accessibilityLabel={`Visa alla event från ${värd}`}
                                    >
                                        <Text style={[styles.värdNamn, styles.värdNamnLänk]}>{värd}</Text>
                                    </Pressable>
                                ) : (
                                    <Text style={styles.värdNamn}>{värd}</Text>
                                )}
                            </ScrollView>
                        </View>
                    </View>
                    {pris ? (
                        <View style={styles.prisKol}>
                            <Text style={styles.kolRubrik}>PRIS</Text>
                            <Text style={styles.prisText} numberOfLines={1}>🎟 {pris}</Text>
                        </View>
                    ) : null}
                </View>
                </>
                ) : null}
            </View>
            {/* automaticallyAdjustKeyboardInsets (iOS): chattens skrivfält bor
                mitt i arket - utan insetsen täcker tangentbordet fältet. */}
            <ArkScroll
                grepp={grepp}
                contentContainerStyle={styles.innehållMedFooter}
                tangentbordsInsets
                topp={toppRad && !listLäge ? <RsvpToppRad event={event} cta={cta} anmälan={anmälan} /> : null}
                onScrollY={räknaFäste}
            >
                {/* Under sökning - och när filtret valt bort eventet - visas
                    listan direkt (webbens listvy-växling). */}
                {!listLäge ? (
                    <>
                        {event.img ? (
                            <Pressable onPress={() => setHelskärm(event.img ?? null)} accessibilityLabel="Visa bilden i helskärm">
                                <Image source={{ uri: event.img }} style={styles.bild} contentFit="cover" transition={150} />
                                {/* Webbens chip på bilden: berättar att den går att trycka. */}
                                <View style={styles.bildChip} pointerEvents="none">
                                    <Text style={styles.bildChipText}>Tryck för hela bilden</Text>
                                </View>
                            </Pressable>
                        ) : null}
                        <Text style={styles.beskrivning}>{beskrivning}</Text>
                        {/* SVARSRADENS EGEN PLATS (webbens ordning: eventinfo →
                            svarsrad → chatt → arrangörsrad → listan): hit
                            scrollar man fram till raden och här släpper den
                            pinnade kopian i botten (räknaFäste ovan). */}
                        <View
                            onLayout={ev => {
                                slotRef.current = { y: ev.nativeEvent.layout.y, h: ev.nativeEvent.layout.height };
                                räknaFäste();
                            }}
                        >
                            <RsvpFooter event={event} inbjudan={inbjudan} cta={cta} anmälan={anmälan} iKortet />
                        </View>
                        {/* Vilka som anmält sig (webbens "N anmälda") - bara
                            i kortet, inte i den pinnade kopian eller toppen. */}
                        {anmälan ? <Text style={styles.anmälda}>{anmäldaRad(anmälan.lista)}</Text> : null}
                        <EventChat event={event} fran={inbjudan?.fran ?? null} />
                        <FlerFran
                            rad={flerFrån}
                            stad={stad}
                            stadAntal={månadsAntal}
                            onVälj={e => (onVälj ?? onVäljIGrupp)?.(e)}
                        />
                        <Rapportera event={event} />
                    </>
                ) : null}
                {onVälj && lista.length > 0 ? (
                    <FlerEvent
                        lista={lista}
                        valtId={event.id}
                        frånOffset={listaFrånOffset}
                        sök={sök}
                        pill={!filtreradBort}
                        bildflödesLäge={!listLäge}
                        onVälj={onVälj}
                        zoomUt={zoomUt}
                    />
                ) : null}
            </ArkScroll>
            {/* Footerns PINNADE kopia mot skärmens botten: arket är tak-högt
                och nedskjutet, så arkets botten ligger under skärmkanten -
                footern skjuts lika långt åt andra hållet. Den drar arket som
                huvudet (13/10, hela kortet är greppbart). Göms när raden i
                innehållet nått sin plats (fäst=false) - opacity i stället
                för avmontering så flippen aldrig blinkar om läsningarna. */}
            <Animated.View
                {...panHandlers}
                style={[styles.footerHållare, { transform: [{ translateY: Animated.multiply(footerSkjut, -1) }] }, !fäst && styles.footerSläppt]}
                pointerEvents={fäst ? 'box-none' : 'none'}
                onLayout={ev => {
                    fotHRef.current = ev.nativeEvent.layout.height;
                    räknaFäste();
                }}
            >
                <RsvpFooter event={event} inbjudan={inbjudan} cta={cta} anmälan={anmälan} />
            </Animated.View>
            <HelskarmsBild uri={helskärm} onClose={() => setHelskärm(null)} />
        </>
    );
}

/** Månaden · 🔥 Populärt - dag för dag i kartans ruta (webbens popularList).
 *  `sök` = kortsökets term (6/10): smalnar båda flikarna (lib/kortSok).
 *
 *  BILDFLÖDET (webben 26/8, `bildflödesLäge`): i kortets infovy och i
 *  väljarlistan är listan bara event MED bild, bilderna på och ingen
 *  bildknapp. I listvyn (kortsöket, eller filtret har valt bort eventet)
 *  visas ALLA rader och "Visa bilder"/"Dölj bilder" längst till höger i
 *  flikraden styr layouten - AV som default, valet sparas på enheten
 *  (webbens vadkul_narhetslista_bilder). Flikarnas tal räknar det som visas.
 *
 *  LISTANS BOTTEN ZOOMAR UT (webbens ägarbeslut 8/10, Josef: "när man
 *  scrollat ner i listan för man redan sett allt denna månaden på
 *  eventkorten. Då ska ju kartan zooma ut"): när botten glider in i bild
 *  (och man scrollat vidare sedan förra steget) zoomar kartan ut via
 *  `zoomUt` och listan FORTSÄTTER - det man sett fryses som en RING
 *  (lib/listZoom) och det nya läggs under en "Zoomade ut"-avdelare, dag för
 *  dag från den visade dagen igen. Knappen är reserv, och vägen vidare när
 *  ett steg inte gav något nytt. Ringarna nollas med eventet. */
function FlerEvent({
    lista,
    valtId,
    frånOffset,
    sök = '',
    pill = true,
    bildflödesLäge = false,
    onVälj,
    zoomUt = null,
}: {
    lista: AppFeedEvent[];
    valtId: string;
    frånOffset: number;
    sök?: string;
    /** false när listan redan ÄR innehållet (filtret valde bort eventet). */
    pill?: boolean;
    bildflödesLäge?: boolean;
    onVälj: (e: AppFeedEvent) => void;
    zoomUt?: KortZoomUt | null;
}) {
    const { minPos } = useRegionVal();
    const register = useContext(DagRegisterCtx);
    const [flik, setFlik] = useState<ListFlik>('månaden');
    const [antal, setAntal] = useState(SIDA);
    const [visaBilder, setVisaBilder] = useLagrad(NYCKEL.listBilder, false);
    useEffect(() => setAntal(SIDA), [flik, frånOffset, sök, bildflödesLäge]);

    // Zoomringarna: frysta id-mängder, en per utzoomning från botten.
    // Delas av flikarna (ringen fryser HELA rutans id:n) och nollas med
    // eventet/dagen - nästa kort börjar om på kartans nya zoomsteg.
    const [ringar, setRingar] = useState<readonly ReadonlySet<string>[]>([]);
    const [zoomar, setZoomar] = useState(false);
    /** Scrolläget vid senaste steget: auto-steget kräver att man scrollat
     *  VIDARE sedan dess (webbens listZoomScrollRef + 40). */
    const sistaStegY = useRef(0);
    const senasteY = useRef(0);
    useEffect(() => {
        setRingar([]);
        setZoomar(false);
        sistaStegY.current = 0;
    }, [valtId, frånOffset]);
    // Kartan zoomar ~0,9 s + rutan lugnar sig - sedan står den nya ringen
    // (eller inget nytt än) i listan.
    useEffect(() => {
        if (!zoomar) return;
        const t = setTimeout(() => setZoomar(false), 2200);
        return () => clearTimeout(t);
    }, [zoomar]);

    const söker = sök.trim().length > 0;
    const underlag = useMemo(() => {
        const träffar = söker ? lista.filter(e => matcharKortSök(e, sök)) : lista;
        return bildflödesLäge ? bildflöde(träffar) : träffar;
    }, [lista, sök, söker, bildflödesLäge]);

    const nu = new Date();
    const nuMs = nu.getTime();
    const harVarit = (e: AppFeedEvent) => isEventPast(e, nuMs) || e.id === valtId;
    const alla = useMemo(() => eventDagar(underlag, frånOffset, nu, harVarit),
        // nu/harVarit räknas om med listan
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [underlag, frånOffset, valtId]);
    const populära = useMemo(() => eventDagar(underlag, frånOffset, nu, harVarit, e => e.pop === true),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [underlag, frånOffset, valtId]);
    const flikDagar = flik === 'månaden' ? alla : populära;
    const totalt = (d: typeof alla) => d.reduce((n, x) => n + x.events.length, 0);
    // Ring 0 först, sedan varje utzoomning från första dagen igen.
    const dagar = useMemo(() => delaIRingar(flikDagar, ringar), [flikDagar, ringar]);
    const ringAntal = useMemo(() => {
        const m = new Map<number, number>();
        for (const d of dagar) m.set(d.ring, (m.get(d.ring) ?? 0) + d.events.length);
        return m;
    }, [dagar]);

    // Kapa till `antal` rader, dag för dag (ringordningen behålls).
    let kvar = antal;
    const visade: { offset: number; ring: number; events: AppFeedEvent[] }[] = [];
    for (const d of dagar) {
        if (kvar <= 0) break;
        const rader = d.events.slice(0, kvar);
        visade.push({ offset: d.offset, ring: d.ring, events: rader });
        kvar -= rader.length;
    }
    const finnsFler = totalt(flikDagar) > antal;

    // Utzoomningssteget: frys det listan känner och be kartskärmen zooma ut.
    const steg = () => {
        if (!zoomUt?.kan || zoomar) return;
        setRingar(r => [...r, new Set(lista.map(e => e.id))]);
        setZoomar(true);
        sistaStegY.current = senasteY.current;
        zoomUt.utför(flik === 'populärt');
    };
    /** Gav senaste steget inget nytt? Då bara knappen - inget auto-steg. */
    const ingetNytt = ringar.length > 0 && (ringAntal.get(ringar.length) ?? 0) === 0;
    const stegRef = useRef<() => void>(() => {});
    stegRef.current = () => {
        if (finnsFler || zoomar || söker || ingetNytt || !zoomUt?.kan) return;
        if (senasteY.current <= sistaStegY.current + 40) return;
        steg();
    };
    useEffect(() => {
        register?.anmälBotten(y => {
            senasteY.current = y;
            stegRef.current();
        });
        return () => register?.anmälBotten(null);
    }, [register]);

    // Flikraden: flikarna i webbens grå kapsel (aktiv flik = vit pill,
    // Populärt i eldfärg) rullar i sidled när det blir trångt; bildknappen
    // står kvar längst till höger. BYGGS SOM VÄRDE: samma rad ritas på sin
    // plats i listan OCH som klistrad kopia överst i scrollytan när man
    // scrollat förbi den (webbens sticky flikrad) - kopian går via
    // registret så knapparna lever även klistrade.
    const flikrad = (
        <View style={styles.flerChipYta}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.flerChipScroll}>
                <View style={styles.flerChipRad}>
                    <Pressable onPress={() => setFlik('månaden')} style={[styles.flerChip, flik === 'månaden' && styles.flerChipVald]}>
                        <Text style={[styles.flerChipText, flik === 'månaden' && styles.flerChipTextVald]}>
                            MÅNADEN · {totalt(alla)}
                        </Text>
                    </Pressable>
                    <Pressable onPress={() => setFlik('populärt')} style={[styles.flerChip, flik === 'populärt' && styles.flerChipVald]}>
                        <Text style={[styles.flerChipText, flik === 'populärt' && styles.flerChipTextEld]}>
                            🔥 POPULÄRT · {totalt(populära)}
                        </Text>
                    </Pressable>
                </View>
            </ScrollView>
            {!bildflödesLäge ? (
                <Pressable
                    onPress={() => setVisaBilder(v => !v)}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityState={{ selected: visaBilder }}
                    accessibilityLabel={visaBilder ? 'Dölj bilderna - kompakt lista' : 'Visa bilderna'}
                    style={({ pressed }) => [styles.bildKnapp, visaBilder && styles.bildKnappPå, pressed && styles.knappTryckt]}
                >
                    <Text style={[styles.bildKnappText, visaBilder && styles.bildKnappTextPå]}>
                        {visaBilder ? '🖼 DÖLJ BILDER' : '🖼 VISA BILDER'}
                    </Text>
                </Pressable>
            ) : null}
        </View>
    );
    // Kopian uppdateras varje render (flik/tal/bildval ska synas klistrat);
    // platsen anmäls en gång och mäts med dagsektionerna.
    const flikradVy = useRef<View>(null);
    useEffect(() => {
        register?.anmälFlikrad(flikradVy.current);
        return () => register?.anmälFlikrad(null);
    }, [register]);
    useEffect(() => { register?.flikradKopia(flikrad); });
    useEffect(() => () => register?.flikradKopia(null), [register]);

    const slutText = dagar.length === 0
        ? söker
            ? `Inget här matchar "${sök.trim()}".`
            : flik === 'populärt' ? 'Inga populära event här just nu.' : 'Inga fler event här just nu.'
        : 'Det var de närmaste två veckorna.';
    const slutEtikett = slutText.replace(/\.$/, '').toUpperCase();
    return (
        <>
            {!söker && pill ? (
                <View style={styles.scrollaPill}>
                    <Text style={styles.scrollaText}>Fler event nedanför ⌄</Text>
                </View>
            ) : null}
            <View style={styles.listYta}>
            <View ref={flikradVy} onLayout={() => register?.mät()}>{flikrad}</View>
            {visade.map((d, i) => (
                <Fragment key={`${d.ring}:${d.offset}`}>
                    {/* Avdelaren där nästa zoomrings dagar börjar (webbens
                        ZoomRingDivider): listan börjar om från den visade
                        dagen med eventen som kom in runtomkring. */}
                    {d.ring > 0 && (i === 0 || visade[i - 1].ring !== d.ring) ? (
                        <ZoomRingRubrik offset={d.offset} antal={ringAntal.get(d.ring) ?? 0} />
                    ) : null}
                    <DagSektion offset={d.offset}>
                        {d.events.map(e => (
                            <ListRad
                                key={e.id}
                                event={e}
                                km={minPos ? distanceKm(minPos.lat, minPos.lng, e.lat, e.lng) : null}
                                nuMs={nuMs}
                                visaBild={bildflödesLäge || visaBilder}
                                baraMedBild={bildflödesLäge}
                                onPress={() => onVälj(e)}
                            />
                        ))}
                    </DagSektion>
                </Fragment>
            ))}
            {finnsFler ? (
                <Pressable style={styles.visaFler} onPress={() => setAntal(a => a + SIDA)}>
                    <Text style={styles.visaFlerText}>Visa fler</Text>
                </Pressable>
            ) : zoomar ? (
                <View style={styles.slutYta}>
                    <Text style={styles.slutText}>ZOOMAR UT …</Text>
                </View>
            ) : zoomUt?.kan && !söker ? (
                // Listans botten zoomar ut i stället för att ta slut (8/10):
                // auto-steget bor i botten-lyssnaren, knappen är reserv.
                <View style={styles.slutYta}>
                    <Text style={styles.slutText}>
                        {ingetNytt ? 'INGET NYTT RUNTOMKRING ÄN' : slutEtikett}
                    </Text>
                    <Pressable style={({ pressed }) => [styles.zoomaUtKnapp, pressed && styles.knappTryckt]} onPress={steg}>
                        <Text style={styles.zoomaUtText}>
                            {ingetNytt ? 'ZOOMA UT MER' : 'ZOOMA UT · FLER RUNTOMKRING'}
                        </Text>
                    </Pressable>
                </View>
            ) : (
                <Text style={styles.flerTomt}>{slutText}</Text>
            )}
            </View>
        </>
    );
}

/** Avdelaren där listans nästa zoomring börjar (webbens ZoomRingDivider):
 *  vågräta streck och "Zoomade ut · {DAG} IGEN · N FLER" - listan börjar om
 *  från den visade dagen med eventen som kom in runtomkring. */
function ZoomRingRubrik({ offset, antal }: { offset: number; antal: number }) {
    const dag = periodLabel(offset, 1).toUpperCase();
    return (
        <View
            style={styles.ringRad}
            accessibilityLabel={`Kartan zoomade ut - ${antal} fler event runtomkring, från ${periodLabel(offset, 1).toLowerCase()} igen`}
        >
            <View style={styles.ringLinje} />
            <View style={styles.ringPill}>
                <Text style={styles.ringPillText}>ZOOMADE UT</Text>
                <Text style={styles.ringPillDag}>{dag} IGEN · {antal} FLER</Text>
            </View>
            <View style={styles.ringLinje} />
        </View>
    );
}

/** Webbens ljusa kortpalett: bg-card, border-border, slate-skalan. */
const YTA = '#ffffff';
const RAD_YTA = '#f1f5f9';
const KANT = '#e2e8f0';
const BLÅ = '#006AA7';
const FLAGGBLÅ = '#0077BC';
/** Glas-looken i navraden (webbens bg-white/30 + backdrop-blur - RN saknar
 *  blur, en tätare vit yta läser likadant över kartan). */
const GLAS = 'rgba(255,255,255,0.78)';
const GLAS_KANT = 'rgba(255,255,255,0.6)';

const styles = StyleSheet.create({
    ark: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: YTA,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: -6 },
        elevation: 14,
    },
    /** Navraden ovanpå arket: bottom sätts till `tak` per instans. */
    navHållare: { position: 'absolute', left: 0, right: 0 },
    navRad: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
        paddingBottom: 12,
    },
    navFyll: { flex: 1 },
    glasKnapp: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: GLAS,
        borderWidth: 1,
        borderColor: GLAS_KANT,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 6,
    },
    glasPil: { fontSize: 16, fontWeight: '800', color: BLÅ },
    glasPill: {
        height: 38,
        borderRadius: 19,
        backgroundColor: GLAS,
        borderWidth: 1,
        borderColor: GLAS_KANT,
        paddingHorizontal: 12,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 6,
    },
    glasPillText: { fontSize: 13, fontWeight: '900', color: BLÅ, fontVariant: ['tabular-nums'] },
    nästaKapsel: {
        height: 38,
        borderRadius: 19,
        backgroundColor: FLAGGBLÅ,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.25)',
        paddingLeft: 16,
        paddingRight: 6,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        shadowColor: '#0c4a6e',
        shadowOpacity: 0.35,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 6,
    },
    /** Dagbytes-läget: samma blå kapsel med GUL RAM (webben 2/9). */
    nästaDagRam: { borderWidth: 2, borderColor: '#FECC02', paddingLeft: 15, paddingRight: 5 },
    nästaText: { fontSize: 12, fontWeight: '900', color: '#ffffff', letterSpacing: 1.2 },
    nästaSymbol: { width: 28, textAlign: 'center', fontSize: 16, color: '#ffffff' },
    navEmojiYta: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
    navEmojiText: { fontSize: 18 },
    pilBadge: {
        position: 'absolute',
        bottom: -3,
        width: 15,
        height: 15,
        borderRadius: 8,
        backgroundColor: BLÅ,
        borderWidth: 1,
        borderColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    pilBadgeVänster: { left: -4 },
    pilBadgeHöger: { right: -4 },
    pilBadgeText: { fontSize: 8, fontWeight: '900', color: '#ffffff', lineHeight: 11 },
    antalBadge: {
        position: 'absolute',
        top: -4,
        minWidth: 15,
        height: 15,
        borderRadius: 8,
        paddingHorizontal: 3,
        backgroundColor: '#1e293b',
        borderWidth: 1,
        borderColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    antalBadgeVänster: { left: -4 },
    antalBadgeHöger: { right: -4 },
    antalBadgeText: { fontSize: 8, fontWeight: '900', color: '#ffffff', lineHeight: 11 },
    släckt: { opacity: 0.4 },
    tryckt: { opacity: 0.85 },
    /** Två dragstreck - webbens grip. */
    handtag: { alignSelf: 'center', gap: 3, marginTop: 8, marginBottom: 6 },
    handtagStreck: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(148,163,184,0.9)' },
    rad: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16 },
    textkol: { flex: 1, paddingRight: 8 },
    titel: { flexShrink: 1, fontSize: 19, lineHeight: 26, fontWeight: '900', color: '#0f172a' },
    titelEmoji: { fontSize: 24 },
    titelVarit: { color: '#94a3b8' },
    titelYta: { minHeight: 54, alignItems: 'center' },
    metaYta: { paddingTop: 6, gap: 4 },
    metaRad: { flexDirection: 'row', gap: 14, paddingHorizontal: 16 },
    meta: { fontSize: 13, fontWeight: '700', color: '#475569' },
    /** Symbol + text (components/Ikon - inga emojier för tid/plats, 28/10). */
    metaPost: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    metaBruten: { paddingHorizontal: 16 },
    metaBrutenText: { flexShrink: 1 },
    väljarPlats: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    väljarRäknare: { marginTop: 5, fontSize: 10, fontWeight: '900', color: '#94a3b8', letterSpacing: 1.2 },
    stang: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: RAD_YTA,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stangText: { fontSize: 15, fontWeight: '700', color: '#64748b' },
    härkomstRad: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 2, paddingBottom: 6 },
    härkomstBadge: { flexShrink: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
    egetBadge: { backgroundColor: '#10b981' },
    tipsBadge: { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a' },
    härkomstText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },
    egetText: { color: '#ffffff' },
    tipsText: { color: '#b45309' },
    rytm: { marginLeft: 'auto', flexShrink: 1, fontSize: 12, fontWeight: '700', color: '#64748b' },
    /** VÄRD/PRIS-raden: webbens kortfot med avdelare. */
    värdRad: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 16,
        marginTop: 10,
        marginHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 12,
        borderTopWidth: 1,
        borderTopColor: KANT,
    },
    värdKol: { flex: 1, minWidth: 0, gap: 4 },
    kolRubrik: { fontSize: 10, fontWeight: '900', color: '#94a3b8', letterSpacing: 1.5 },
    värdNamnRad: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    värdAvatar: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: KANT,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    värdAvatarEget: { backgroundColor: '#10b981', borderColor: '#34d399' },
    värdFavicon: { width: 16, height: 16 },
    värdInitial: { fontSize: 10, fontWeight: '800', color: '#475569' },
    värdInitialEget: { color: '#ffffff' },
    värdNamnScroll: { flex: 1 },
    värdNamn: { fontSize: 13, fontWeight: '900', color: '#0f172a' },
    /** Understruket som webbens länkade värdnamn (decoration-slate-300;
     *  färgen på strecket är iOS-bara - Android stryker i textfärgen). */
    värdNamnLänk: { textDecorationLine: 'underline', textDecorationColor: '#cbd5e1' },
    prisKol: { alignItems: 'flex-end', gap: 4 },
    prisText: { fontSize: 14, fontWeight: '900', color: '#0f172a' },
    knappRad: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 2, paddingBottom: 10, alignItems: 'center' },
    knappFyll: { flex: 1 },
    knapp: { borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
    knappTryckt: { opacity: 0.85 },
    filterKnapp: { width: 36, height: 36, backgroundColor: '#ffffff', borderWidth: 1, borderColor: KANT },
    filterKnappPå: { backgroundColor: BLÅ, borderColor: BLÅ },
    filterIkon: { fontSize: 15, color: '#64748b' },
    filterIkonPå: { color: '#ffffff' },
    /** Stjärnan: amber som webbens (bg-amber-50/100, border amber-300). */
    stjärnKnapp: { width: 36, height: 36, backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fcd34d' },
    stjärnHar: { backgroundColor: '#fef3c7' },
    stjärnText: { fontSize: 17, color: '#f59e0b', marginTop: -1 },
    // minWidth, inte width: `width: undefined` i Bred-stilen släppte INTE
    // den fasta bredden, så hjärtat + siffran trängdes in i 36 pt och
    // hjärtat klipptes på sidan (Josef 29/10).
    hjärtKnapp: { minWidth: 36, height: 36, backgroundColor: '#ffffff', borderWidth: 1, borderColor: KANT },
    /** Med gilla-siffra: växer med innehållet (webbens px-2.5 + gap-1). */
    hjärtKnappBred: { flexDirection: 'row', gap: 4, paddingHorizontal: 10 },
    hjärtSparad: { backgroundColor: '#fff1f2', borderColor: '#fecdd3' },
    hjärtText: { fontSize: 18, color: '#94a3b8', marginTop: -2 },
    hjärtTextSparad: { color: '#f43f5e' },
    hjärtAntal: { fontSize: 12, fontWeight: '900', color: '#94a3b8', fontVariant: ['tabular-nums'] },
    hjärtAntalSparad: { color: '#f43f5e' },
    /** Fältet ligger I knappraden (7/10 kväll) - flex-1 så det tar bredden
     *  som blir över bredvid filtersymbolen och hjärtat. */
    sökFält: {
        flex: 1,
        height: 36,
        borderRadius: 999,
        backgroundColor: RAD_YTA,
        borderWidth: 1,
        borderColor: KANT,
        paddingHorizontal: 14,
        paddingVertical: 0,
        fontSize: 14,
        fontWeight: '600',
        color: '#0f172a',
        // Android: enradsinput centreras inte alltid i fast höjd av sig själv.
        textAlignVertical: 'center',
    },
    footerHållare: { position: 'absolute', left: 0, right: 0, bottom: 0 },
    /** Raden har nått sin plats i innehållet - kopian i botten göms men står
     *  monterad (ingen blink vid flippen). */
    footerSläppt: { opacity: 0 },
    /** Arkets scrollyta: ramen för den klistrade dagrubriken, som klipps
     *  när nästa dag trycker upp den. */
    scrollYta: { flex: 1, overflow: 'hidden' },
    klistradDag: { position: 'absolute', top: 0, left: 0, right: 0 },
    /** Flikradens klistrade kopia: egen botten (raden ritas annars på
     *  listYtans) och lätt skugga så den läses som lagd ovanpå listan. */
    klistradFlikrad: {
        position: 'absolute',
        left: 0,
        right: 0,
        backgroundColor: '#f8fafc',
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 3,
    },
    /** Svarsradens topprad - alltid överst i klisterstapeln. */
    klistradTopp: { position: 'absolute', top: 0, left: 0, right: 0 },
    väljarPill: {
        alignSelf: 'flex-start',
        marginHorizontal: 16,
        marginTop: 10,
        marginBottom: 8,
        borderRadius: 999,
        backgroundColor: RAD_YTA,
        paddingHorizontal: 12,
        paddingVertical: 5,
    },
    väljarPillText: { fontSize: 12, fontWeight: '800', color: '#475569', letterSpacing: 0.6 },
    innehåll: { flex: 1 },
    innehållInre: { paddingBottom: 48 },
    /** Infovyn: luft så footern inte täcker sista raden på takhöjden. */
    innehållMedFooter: { paddingBottom: 132 },
    bild: { width: '100%', height: 224, backgroundColor: RAD_YTA },
    bildChip: {
        position: 'absolute',
        bottom: 8,
        alignSelf: 'center',
        borderRadius: 999,
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    bildChipText: { fontSize: 10, fontWeight: '700', color: '#ffffff' },
    /** Luft under texten innan svarsradens kantlinje (Josef 29/10: "mer
     *  padding under beskrivningen") - förr stod texten mot linjen. */
    beskrivning: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 18, fontSize: 14, lineHeight: 21, color: '#334155' },
    anmälda: { paddingHorizontal: 16, paddingTop: 4, fontSize: 12, fontWeight: '800', color: '#64748b' },
    scrollaPill: {
        alignSelf: 'center',
        marginTop: 16,
        borderRadius: 999,
        borderWidth: 1.5,
        borderColor: '#FECC02',
        paddingHorizontal: 18,
        paddingVertical: 8,
    },
    scrollaText: { color: '#0f172a', fontSize: 13, fontWeight: '700' },
    /** Flikarna i webbens grå kapsel (bg-slate-200/70, aktiv = vit pill). */
    /** Listans yta: webbens bg-slate-50 med kantlinje överst. */
    listYta: { marginTop: 16, backgroundColor: '#f8fafc', borderTopWidth: 1, borderTopColor: KANT },
    /** Flikraden (webbens h-11): flikarna rullar, bildknappen står. */
    flerChipYta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        height: 44,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: KANT,
    },
    flerChipScroll: { flexShrink: 1 },
    flerChipRad: {
        flexDirection: 'row',
        gap: 2,
        borderRadius: 999,
        backgroundColor: 'rgba(226,232,240,0.7)',
        padding: 2,
    },
    flerChip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
    flerChipVald: {
        backgroundColor: '#ffffff',
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 2,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
    },
    flerChipText: { fontSize: 12, fontWeight: '900', color: '#64748b', letterSpacing: 0.8 },
    flerChipTextVald: { color: '#1e293b' },
    flerChipTextEld: { color: '#c2410c' },
    /** Dagrubriken: webbens blå streck i vänstermarginalen + dagen i fetstil. */
    dagRubrik: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingLeft: 4,
        paddingRight: 16,
        paddingTop: 12,
        paddingBottom: 8,
        backgroundColor: '#f8fafc',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: KANT,
    },
    dagStreck: { width: 4, height: 16, borderRadius: 2, backgroundColor: BLÅ },
    dagRubrikText: { fontSize: 14, fontWeight: '900', color: '#0f172a' },
    /** "Visa bilder" (webbens pill: blå när bilderna är på). */
    bildKnapp: { borderRadius: 999, backgroundColor: KANT, paddingHorizontal: 10, paddingVertical: 5 },
    bildKnappPå: { backgroundColor: BLÅ },
    bildKnappText: { fontSize: 10, fontWeight: '900', color: '#64748b', letterSpacing: 1 },
    bildKnappTextPå: { color: '#ffffff' },
    /** Väljarlistans hopfällda historik (webbens "🕐 N har redan varit · Visa" - klockan är en symbol här). */
    passeradeKnapp: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginTop: 6,
        marginHorizontal: 16,
        paddingVertical: 10,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: KANT,
    },
    passeradeText: { fontSize: 12, fontWeight: '900', color: '#94a3b8' },
    visaFler: {
        alignSelf: 'center',
        marginTop: 14,
        borderRadius: 999,
        backgroundColor: RAD_YTA,
        borderWidth: 1,
        borderColor: KANT,
        paddingHorizontal: 18,
        paddingVertical: 9,
    },
    visaFlerText: { color: '#334155', fontSize: 13, fontWeight: '700' },
    flerTomt: { textAlign: 'center', color: '#64748b', marginTop: 16, fontSize: 13 },
    /** Listans botten (webbens ListEndZoom): etikett + blå zooma ut-knapp. */
    slutYta: { alignItems: 'center', gap: 8, paddingVertical: 16, borderTopWidth: 1, borderTopColor: KANT, marginTop: 16 },
    slutText: { fontSize: 10, fontWeight: '900', letterSpacing: 1.4, color: '#94a3b8' },
    zoomaUtKnapp: { borderRadius: 999, backgroundColor: BLÅ, paddingHorizontal: 16, paddingVertical: 9 },
    zoomaUtText: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2, color: '#ffffff' },
    /** Zoomringens avdelare (webbens ZoomRingDivider): streck + mörk pill. */
    ringRad: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingTop: 20,
        paddingBottom: 12,
        borderTopWidth: 1,
        borderTopColor: KANT,
    },
    ringLinje: { flex: 1, height: 3, borderRadius: 2, backgroundColor: BLÅ },
    ringPill: {
        alignItems: 'center',
        gap: 4,
        borderRadius: 16,
        backgroundColor: '#0f172a',
        paddingHorizontal: 16,
        paddingVertical: 8,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
        elevation: 4,
    },
    ringPillText: { fontSize: 11, fontWeight: '900', letterSpacing: 1.4, color: '#ffffff' },
    ringPillDag: { fontSize: 12, fontWeight: '900', letterSpacing: 0.8, color: '#FECC02' },
});
