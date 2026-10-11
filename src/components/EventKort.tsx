/**
 * Eventkortet - dragbart LJUST bottenark med webbens formspråk och beteende
 * (LinkEventCard + EventCard). Sedan 10/10 ser kortet ut som webbens bg-card:
 * vit yta, två dragstreck, härkomst-badges, knappraden (sök + filter +
 * hjärta), svart fet titel med stor emoji, tid/plats-raderna och VÄRD/PRIS-
 * raden med favicon och avdelare - chipraden är riven (webben har ingen).
 *
 *  - TRE STOPP (lib/sheetSnap, ägarbeslut 2/9): default = kortets huvud +
 *    110 pt bildremsa (webbens 335 px), tapp-höjden ~halva skärmen, taket.
 *    Ett stopp per gest; nedåt från default stänger. Dragytan är handtaget +
 *    huvudet; innehållet skrollar för sig.
 *  - VÄLJARLISTAN: trycker man en bricka med flera event är kortets innehåll
 *    listan över platsen tills man valt (ägarbeslut 31/8).
 *  - NAVRADEN LIGGER OVANPÅ ARKET sedan 10/10 (webbens navrad ovanför
 *    kortet, "nästa knappen ska vara ovanpå eventkortet"): Bakåt som
 *    glascirkel med föregående events emoji, ← ☰ (tillbaka till listan),
 *    1/2-pagern och den flaggblå NÄSTA-kapseln med nästa events emoji +
 *    antal - gul ram + 📅 vid dagbyte (webbens ring-[#FECC02]). Raden
 *    följer arkets drag (samma translate) och kameran rör sig aldrig
 *    (kart-ui 2/9).
 *  - Hjärtat sparar på enheten (lib/sparadeContext), ANMÄL öppnar källan -
 *    BOKA i guld för Ticketmaster (ägarbeslut 1/9) med webbens
 *    "Annons"-märkning under. DELA-KNAPPEN ÄR RIVEN (webben 7/10) - Bjud med
 *    i footern delar.
 *  - KOMMER/INTRESSERAD-FOOTERN (6/10, spår 3): fast platta i botten när ett
 *    event är valt (components/RsvpFooter) - göms i väljarlistan. Footern
 *    ligger i arket men counter-translaterar mot skärmens botten (arket ritas
 *    i takets höjd och skjuts ner).
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
 *    kartans ruta från visad dag och framåt (Josef 23-24/9).
 *
 * HÅRD REGEL (CLAUDE.md): appen säljer ingenting - ingen boost, inga priser.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { eventShareSlug, type AppFeedEvent } from '@vadkul/kontrakt';
import type { AppEvent } from '@/lib/appEvent';
import { seriensRytm } from '@/lib/anvandarEvent';
import { useEventDetalj } from '@/api/eventDetalj';
import { hämtaEngagemang } from '@/data/eventStats';
import { hämtaStjärnorKvar, prenumereraStjärnmärkta, sättStjärna } from '@/data/stjarnor';
import { kanSättaStjärna } from '@/lib/stjarnor';
import { useKonto } from '@/lib/kontoContext';
import { EventChat } from '@/components/EventChat';
import { EventRad } from '@/components/EventRad';
import { FlerFran } from '@/components/FlerFran';
import { Rapportera } from '@/components/Rapportera';
import { HelskarmsBild } from '@/components/HelskarmsBild';
import { KategoriRad } from '@/components/KategoriRad';
import { ListRad } from '@/components/ListRad';
import { RsvpFooter } from '@/components/RsvpFooter';
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
import { useRegionVal } from '@/lib/regionContext';
import { distanceKm, nearestCity } from '@/lib/regionVal';
import { höjdEfterHuvudbyte, landning, sheetStops } from '@/lib/sheetSnap';
import { useSparade } from '@/lib/sparadeContext';
import { AFFILIATE_DISCLOSURE, isAffiliateUrl, isTicketmasterEvent } from '@/lib/ticketmaster';
import { eventDagar } from '@/lib/vy';

export function eventUrl(e: AppFeedEvent): string {
    return `https://vadkul.se/e/${eventShareSlug(e.id)}`;
}

/** Bildremsan under huvudet i default-läget (webbens 110 px). */
const BILDREMSA = 110;
/** Rader per sida i listorna - "Visa fler" laddar nästa sida. */
const SIDA = 30;

type ListFlik = 'månaden' | 'populärt';

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
    minimeraNonce = 0,
    inbjudan = null,
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
    /** Bumpas av kartskärmen vid tryck på tom karta (11/10): arket glider
     *  ner till MINI-läget där bara filterraden syns. */
    minimeraNonce?: number;
    /** Kom man via en Bjud med-länk (?inb=1&fran=) - bannern i svarsraden. */
    inbjudan?: { fran: string | null; onStäng: () => void } | null;
    onClose: () => void;
}) {
    const { height: fönsterHöjd } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const tak = Math.round(fönsterHöjd * 0.88);
    const [huvudHöjd, setHuvudHöjd] = useState(230);
    /** MINI-läget (karttrycket): handtaget + knappraden med sökfält/filter/
     *  hjärta synliga ovanför hemindikatorn - resten under skärmkanten. */
    const miniHöjd = 78 + insets.bottom;
    const [minimerad, setMinimerad] = useState(false);
    const minimeradRef = useRef(false);
    minimeradRef.current = minimerad;
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
        // Sökfältet väcker ur mini-läget (fältet är ju synligt där).
        if (minimeradRef.current) {
            setMinimerad(false);
            gåTill(stoppRef.current[0]);
        }
    };

    const gåTill = (h: number) => {
        höjdRef.current = h;
        Animated.spring(translate, { toValue: tak - h, bounciness: 3, useNativeDriver: true }).start();
    };

    // Filterknappen (11/10, Josef: "det räcker att den går upp till halvvägs,
    // inte hela vägen till toppen"): fäll ut chipsen UTAN att fokusera fältet
    // (inget tangentbord - webbens filtersymbol gör likadant, 7/10-beslutet)
    // och lyft arket till MELLANHÖJDEN om det står lägre. Aldrig till taket.
    const växlaFilter = () => {
        const öppnar = !sökÖppen;
        const varMinimerad = minimeradRef.current;
        växlaSök();
        if ((öppnar || varMinimerad) && höjdRef.current < mellan) gåTill(mellan);
    };

    // Sökfältet får fokus (11/10, Josef: "om fönstret är uppe och man skriver
    // så ska den inte hoppa ner längst ner, för då hamnar den under
    // tangentbordet ... är den längst upp så kan den fortsatt vara där"):
    // tangentbordet täcker nedre ~40 % av skärmen, så arket lyfts till
    // MELLANHÖJDEN om det står lägre - också ur mini-läget. Högre står still.
    const sökFokus = () => {
        if (!sökÖppen) setSökÖppen(true);
        setMinimerad(false);
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

    // Nytt event eller ny grupp → default-höjd, innehållet överst.
    const nyckel = event?.id ?? `grupp:${grupp[0]?.id ?? ''}`;
    useEffect(() => {
        scrollRef.current?.scrollTo({ y: 0, animated: false });
        setMinimerad(false);
        gåTill(stoppRef.current[0]);
        // gåTill är stabil nog
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nyckel]);
    // Default-stoppet följer huvudets höjd (chipsen fälls ut/in, sökning
    // gömmer eventet) - men bara under mellanhöjden och aldrig i mini-läget,
    // och i sökläget är mellanhöjden golvet så fältet inte hamnar under
    // tangentbordet (lib/sheetSnap höjdEfterHuvudbyte, 11/10).
    useEffect(() => {
        const mål = höjdEfterHuvudbyte({
            höjd: höjdRef.current,
            nyttDefault: stopp[0],
            mellan,
            minimerad: minimeradRef.current,
            sökläge: sökÖppen || sök.trim().length > 0,
        });
        if (mål !== null) gåTill(mål);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stopp[0]]);
    // Karttrycket (11/10): glid ner till MINI-läget. Väcks av drag uppåt,
    // sökfältet/filterknappen eller ett eventbyte.
    useEffect(() => {
        if (minimeraNonce > 0) {
            setMinimerad(true);
            gåTill(Math.min(miniHöjd, tak));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [minimeraNonce]);
    const pan = useMemo(() => PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_e, g) => {
            const h = Math.min(tak, höjdRef.current - g.dy);
            translate.setValue(tak - Math.max(0, h));
        },
        onPanResponderRelease: (_e, g) => {
            const mål = landning(stoppRef.current, höjdRef.current, g.dy, g.vy);
            if (mål === null) {
                Animated.timing(translate, { toValue: tak, duration: 160, useNativeDriver: true })
                    .start(() => stäng.current());
                return;
            }
            // Ett drag upp till ett riktigt stopp väcker ur mini-läget.
            if (mål >= stoppRef.current[0]) setMinimerad(false);
            gåTill(mål);
        },
        onPanResponderTerminate: () => gåTill(höjdRef.current),
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [tak, translate]);

    // Multievent-pagern "1/3 →" - bor i navraden ovanför arket (webben 16/9:
    // den trängde undan tid/plats på kortets platsrad).
    const gruppIndex = event ? grupp.findIndex(e => e.id === event.id) : -1;
    const pager = event && grupp.length > 1 && gruppIndex >= 0
        ? { text: `${gruppIndex + 1}/${grupp.length}`, nästa: grupp[(gruppIndex + 1) % grupp.length] }
        : null;

    return (
        <>
            {/* NAVRADEN OVANPÅ ARKET (webbens navrad med mb-4 ovanför kortet):
                bottom = arkets oförskjutna topp, samma translate som arket -
                raden rider på kortets överkant genom alla stopp och drag.
                box-none: tomrummet mellan knapparna släpper igenom kartan. */}
            {event && (nav || pager || onTillbakaTillLista) ? (
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
                                onPress={nav.onBakåt ?? undefined}
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
                                onPress={() => onVäljIGrupp?.(pager.nästa)}
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
                                    onPress={nav.onNästa}
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
                        minimerad={minimerad}
                        onVälj={onVälj}
                        inbjudan={inbjudan}
                        onClose={onClose}
                        panHandlers={pan.panHandlers}
                        dubbeltapp={dubbeltapp}
                        onHuvudHöjd={setHuvudHöjd}
                        scrollRef={scrollRef}
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
                        onClose={onClose}
                        panHandlers={pan.panHandlers}
                        dubbeltapp={dubbeltapp}
                        onHuvudHöjd={setHuvudHöjd}
                        scrollRef={scrollRef}
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
    onClose,
    panHandlers,
    dubbeltapp,
    onHuvudHöjd,
    scrollRef,
}: {
    grupp: AppFeedEvent[];
    onVälj: (e: AppFeedEvent) => void;
    lista: AppFeedEvent[];
    listaFrånOffset: number;
    flöde: readonly AppFeedEvent[];
    stad: { slug: string; name: string } | null;
    /** null på skärmar utan den gemensamma listan (stadsskärmen). */
    onVäljUrLista: ((e: AppFeedEvent) => void) | null;
    onClose: () => void;
    panHandlers: PanHandlers;
    dubbeltapp: Dubbeltapp;
    onHuvudHöjd: (h: number) => void;
    scrollRef: React.RefObject<ScrollView | null>;
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
                        <Text style={styles.titel} numberOfLines={2}>{plats ? `📍 ${plats}` : `${grupp.length} event här`}</Text>
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
            <ScrollView ref={scrollRef} {...dubbeltapp} style={styles.innehåll} contentContainerStyle={styles.innehållInre}>
                {dagar.map(d => (
                    <View key={d.offset}>
                        {dagar.length > 1 ? <DagRubrik offset={d.offset} /> : null}
                        {d.events.map(e => (
                            <EventRad key={e.id} event={e} tema="ljus" onPress={() => onVälj(e)} />
                        ))}
                    </View>
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
                            <Text style={styles.passeradeText}>
                                🕐 {passerade.length} har redan varit · {visaPasserade ? 'Dölj' : 'Visa'}
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
                            <FlerEvent lista={lista} valtId="" frånOffset={listaFrånOffset} bildflödesLäge onVälj={onVäljUrLista} />
                        ) : null}
                    </>
                ) : null}
            </ScrollView>
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
    minimerad,
    onVälj,
    inbjudan,
    onClose,
    panHandlers,
    dubbeltapp,
    onHuvudHöjd,
    scrollRef,
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
    /** Mini-läget (karttrycket): footern göms så filterraden inte täcks. */
    minimerad: boolean;
    onVälj?: (e: AppFeedEvent) => void;
    inbjudan: { fran: string | null; onStäng: () => void } | null;
    onClose: () => void;
    panHandlers: PanHandlers;
    dubbeltapp: Dubbeltapp;
    onHuvudHöjd: (h: number) => void;
    scrollRef: React.RefObject<ScrollView | null>;
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
    const pris = event.price != null && String(event.price).trim() ? String(event.price).trim() : null;
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
        if (filtreradBort) scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, [filtreradBort, scrollRef]);
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

    return (
        <>
            <View {...panHandlers} onLayout={ev => onHuvudHöjd(ev.nativeEvent.layout.height)}>
                <Handtag />
                {/* Webbens headerordning: härkomst-badgen → knappraden → titel
                    → tid/plats → VÄRD/PRIS. Söker man göms eventet (ägarbeslut
                    7/10 kväll) - kvar är bara knappraden med fältet och
                    chipsen. Det gömda ligger i TVÅ stabila slottar runt
                    knappraden, så dess plats i trädet står still och
                    TextInputen aldrig remountas (tangentbordet får inte
                    stängas av vyskiftet). */}
                {!listLäge && härkomst ? (
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
                {!listLäge ? (
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
                        <Text style={styles.meta}>🕐 {tid}{harVarit ? ' · har varit' : ''}</Text>
                        {!vadkulVärdat && plats ? <Text style={styles.meta}>📍 {plats}</Text> : null}
                    </ScrollView>
                    {vadkulVärdat && plats ? (
                        <Text style={[styles.meta, styles.metaBruten]}>📍 {plats}</Text>
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
                                        onPress={() => router.push({ pathname: '/arrangor/[slug]', params: { slug: flerFrån.slug! } })}
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
            <ScrollView
                ref={scrollRef}
                {...dubbeltapp}
                style={styles.innehåll}
                contentContainerStyle={styles.innehållMedFooter}
                automaticallyAdjustKeyboardInsets
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
                        {/* Chatten DIREKT efter beskrivningen (webbens ordning:
                            eventinfo → svarsrad → chatt → arrangörsrad → listan;
                            svarsraden här är den fasta RsvpFooter-plattan).
                            Avmonteras i listläget → lyssnarna rivs (egress). */}
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
                    />
                ) : null}
            </ScrollView>
            {/* Footern pinnas mot skärmens botten: arket är tak-högt och
                nedskjutet, så arkets botten ligger under skärmkanten - footern
                skjuts lika långt åt andra hållet. GÖMS i mini-läget, annars
                täcker den precis filterraden som ska synas (11/10). */}
            {minimerad ? null : (
            <Animated.View
                style={[styles.footerHållare, { transform: [{ translateY: Animated.multiply(footerSkjut, -1) }] }]}
                pointerEvents="box-none"
            >
                <RsvpFooter
                    event={event}
                    inbjudan={inbjudan}
                    cta={utlänk ? { url: utlänk, label: tm ? 'BOKA' : 'ANMÄL', guld: tm, annons: annons ? AFFILIATE_DISCLOSURE : null } : null}
                />
            </Animated.View>
            )}
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
 *  (webbens vadkul_narhetslista_bilder). Flikarnas tal räknar det som visas. */
function FlerEvent({
    lista,
    valtId,
    frånOffset,
    sök = '',
    pill = true,
    bildflödesLäge = false,
    onVälj,
}: {
    lista: AppFeedEvent[];
    valtId: string;
    frånOffset: number;
    sök?: string;
    /** false när listan redan ÄR innehållet (filtret valde bort eventet). */
    pill?: boolean;
    bildflödesLäge?: boolean;
    onVälj: (e: AppFeedEvent) => void;
}) {
    const { minPos } = useRegionVal();
    const [flik, setFlik] = useState<ListFlik>('månaden');
    const [antal, setAntal] = useState(SIDA);
    const [visaBilder, setVisaBilder] = useLagrad(NYCKEL.listBilder, false);
    useEffect(() => setAntal(SIDA), [flik, frånOffset, sök, bildflödesLäge]);

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
    const dagar = flik === 'månaden' ? alla : populära;
    const totalt = (d: typeof alla) => d.reduce((n, x) => n + x.events.length, 0);

    // Kapa till `antal` rader, dag för dag.
    let kvar = antal;
    const visade: { offset: number; events: AppFeedEvent[] }[] = [];
    for (const d of dagar) {
        if (kvar <= 0) break;
        const rader = d.events.slice(0, kvar);
        visade.push({ offset: d.offset, events: rader });
        kvar -= rader.length;
    }
    const finnsFler = totalt(dagar) > antal;

    return (
        <>
            {!söker && pill ? (
                <View style={styles.scrollaPill}>
                    <Text style={styles.scrollaText}>Fler event nedanför ⌄</Text>
                </View>
            ) : null}
            <View style={styles.listYta}>
            {/* Flikraden: flikarna i webbens grå kapsel (aktiv flik = vit
                pill, Populärt i eldfärg) rullar i sidled när det blir trångt;
                bildknappen står kvar längst till höger. */}
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
            {visade.map(d => (
                <View key={d.offset}>
                    <DagRubrik offset={d.offset} />
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
                </View>
            ))}
            {finnsFler ? (
                <Pressable style={styles.visaFler} onPress={() => setAntal(a => a + SIDA)}>
                    <Text style={styles.visaFlerText}>Visa fler</Text>
                </Pressable>
            ) : (
                <Text style={styles.flerTomt}>
                    {dagar.length === 0
                        ? söker
                            ? `Inget här matchar "${sök.trim()}".`
                            : flik === 'populärt' ? 'Inga populära event här just nu.' : 'Inga fler event här just nu.'
                        : 'Det var de närmaste två veckorna.'}
                </Text>
            )}
            </View>
        </>
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
    metaBruten: { paddingHorizontal: 16 },
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
    hjärtKnapp: { width: 36, height: 36, backgroundColor: '#ffffff', borderWidth: 1, borderColor: KANT },
    /** Med gilla-siffra: släpp fasta bredden (webbens px-2.5 + gap-1). */
    hjärtKnappBred: { width: undefined, flexDirection: 'row', gap: 4, paddingHorizontal: 10 },
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
    beskrivning: { paddingHorizontal: 16, paddingTop: 12, fontSize: 14, lineHeight: 21, color: '#334155' },
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
    /** Väljarlistans hopfällda historik (webbens "🕐 N har redan varit · Visa"). */
    passeradeKnapp: {
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
});
