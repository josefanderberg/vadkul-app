/**
 * Eventkortet - dragbart MÖRKT bottenark med webbens formspråk och beteende
 * (LinkEventCard + EventCard):
 *
 *  - TRE STOPP (lib/sheetSnap, ägarbeslut 2/9): default = kortets huvud +
 *    110 pt bildremsa (webbens 335 px), tapp-höjden ~halva skärmen, taket.
 *    Ett stopp per gest; nedåt från default stänger. Dragytan är handtaget +
 *    huvudet; innehållet skrollar för sig.
 *  - VÄLJARLISTAN: trycker man en bricka med flera event är kortets innehåll
 *    listan över platsen tills man valt (ägarbeslut 31/8), och en tillbakapil
 *    tar en dit igen så länge man står kvar i gruppen.
 *  - NAVRADEN: Bakåt · "1/3 →" (samma plats) · NÄSTA (event i bild, sedan
 *    nästa dag - kameran rör sig aldrig, kart-ui 2/9).
 *  - Hjärtat sparar på enheten (lib/sparadeContext), ANMÄL öppnar källan -
 *    BOKA i guld för Ticketmaster (ägarbeslut 1/9) med webbens
 *    "Annons"-märkning under. DELA-KNAPPEN ÄR RIVEN (webben 7/10) - Bjud med
 *    i footern delar.
 *  - KOMMER/INTRESSERAD-FOOTERN (6/10, spår 3): fast platta i botten när ett
 *    event är valt (components/RsvpFooter) - göms i väljarlistan. Footern
 *    ligger i arket men counter-translaterar mot skärmens botten (arket ritas
 *    i takets höjd och skjuts ner).
 *  - KORTSÖKET bakom sök/filter-ikonen längst till vänster i knappraden
 *    (6/10 + 7/10 ihopfällningen): fält + kategorichipsen (samma KategoriRad
 *    som sökpanelen - ett val smalnar listan OCH kartan bakom via det delade
 *    filtret). Första tecknet visar listan direkt (bild/beskrivning göms),
 *    termen lever kvar vid eventbyte och nollas när kortet stängs.
 *  - Bildtryck = helskärm (ägarbeslut 14/9).
 *  - Under beskrivningen: FLER FRÅN SAMMA ARRANGÖR + stadssidelänken
 *    (components/FlerFran, 6/10) och Månaden · 🔥 Populärt, dag för dag i
 *    kartans ruta från visad dag och framåt (Josef 23-24/9).
 *
 * HÅRD REGEL (CLAUDE.md): appen säljer ingenting - ingen boost, inga priser.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Animated,
    BackHandler,
    PanResponder,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    useWindowDimensions,
    View,
} from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { eventShareSlug, type AppFeedEvent } from '@vadkul/kontrakt';
import { useEventDetalj } from '@/api/eventDetalj';
import { EventRad } from '@/components/EventRad';
import { FlerFran } from '@/components/FlerFran';
import { HelskarmsBild } from '@/components/HelskarmsBild';
import { KategoriRad } from '@/components/KategoriRad';
import { RsvpFooter } from '@/components/RsvpFooter';
import { arrangörsRad } from '@/lib/arrangorsRad';
import { periodLabel } from '@/lib/dagar';
import { descriptionText, eventOutlink, hostLabelFor } from '@/lib/eventDetalj';
import { formatTidSpann } from '@/lib/eventTid';
import { useFilter } from '@/lib/filterContext';
import { formatKm } from '@/lib/flerEvent';
import { isEventPast } from '@/lib/harVarit';
import { kategoriFor } from '@/lib/kategorier';
import { matcharKortSök } from '@/lib/kortSok';
import { useRegionVal } from '@/lib/regionContext';
import { distanceKm } from '@/lib/regionVal';
import { landning, sheetStops } from '@/lib/sheetSnap';
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
    onNästa: () => void;
    /** null = ingen historik. */
    onBakåt: (() => void) | null;
}

export function EventKort({
    event,
    grupp = [],
    onVäljIGrupp,
    onTillbakaTillLista,
    lista = [],
    listaFrånOffset = 0,
    flöde = [],
    stad = null,
    onVälj,
    nav,
    onClose,
}: {
    /** Valt event; null = väljarlistan över `grupp`. */
    event: AppFeedEvent | null;
    /** Eventen på samma plats (väljarlistan + pagern). */
    grupp?: AppFeedEvent[];
    onVäljIGrupp?: (e: AppFeedEvent) => void;
    /** Satt när man valt ur väljarlistan och står kvar i gruppen. */
    onTillbakaTillLista?: (() => void) | null;
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
    onClose: () => void;
}) {
    const { height: fönsterHöjd } = useWindowDimensions();
    const tak = Math.round(fönsterHöjd * 0.88);
    const [huvudHöjd, setHuvudHöjd] = useState(230);
    const stopp = useMemo(
        () => sheetStops([Math.min(tak, huvudHöjd + BILDREMSA), Math.round(fönsterHöjd * 0.55), tak]),
        [huvudHöjd, fönsterHöjd, tak],
    );

    // Arket ritas i takets höjd och skjuts ner: translateY = tak - synlig höjd.
    const höjdRef = useRef(stopp[0]);
    const translate = useRef(new Animated.Value(tak - stopp[0])).current;
    const stäng = useRef(onClose);
    stäng.current = onClose;
    const scrollRef = useRef<ScrollView>(null);

    // Androids bakåtknapp stänger kortet i stället för appen. Bara medan
    // skärmen under har fokus - ett kort på kartan bakom en öppen modal ska
    // inte äta modalens bakåttryck.
    useFocusEffect(useCallback(() => {
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            stäng.current();
            return true;
        });
        return () => sub.remove();
    }, []));

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
            else setTimeout(() => sökFältRef.current?.focus(), 80);
            return nästa;
        });
    };

    const gåTill = (h: number) => {
        höjdRef.current = h;
        Animated.spring(translate, { toValue: tak - h, bounciness: 3, useNativeDriver: true }).start();
    };

    // Nytt event eller ny grupp → default-höjd, innehållet överst.
    const nyckel = event?.id ?? `grupp:${grupp[0]?.id ?? ''}`;
    useEffect(() => {
        scrollRef.current?.scrollTo({ y: 0, animated: false });
        gåTill(stopp[0]);
        // gåTill är stabil nog - stoppen räknas om av layouten
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nyckel, stopp[0]]);

    const stoppRef = useRef(stopp);
    stoppRef.current = stopp;
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
            gåTill(mål);
        },
        onPanResponderTerminate: () => gåTill(höjdRef.current),
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [tak, translate]);

    return (
        <Animated.View style={[styles.ark, { height: tak, transform: [{ translateY: translate }] }]}>
            {event ? (
                <EventInnehåll
                    event={event}
                    grupp={grupp}
                    onVäljIGrupp={onVäljIGrupp}
                    onTillbakaTillLista={onTillbakaTillLista ?? null}
                    lista={lista}
                    listaFrånOffset={listaFrånOffset}
                    flöde={flöde}
                    stad={stad}
                    sök={sök}
                    sökÖppen={sökÖppen}
                    onSök={handleSök}
                    onVäxlaSök={växlaSök}
                    sökFältRef={sökFältRef}
                    footerSkjut={translate}
                    onVälj={onVälj}
                    nav={nav}
                    onClose={onClose}
                    panHandlers={pan.panHandlers}
                    onHuvudHöjd={setHuvudHöjd}
                    scrollRef={scrollRef}
                />
            ) : (
                <Väljarlista
                    grupp={grupp}
                    onVälj={e => onVäljIGrupp?.(e)}
                    onClose={onClose}
                    panHandlers={pan.panHandlers}
                    onHuvudHöjd={setHuvudHöjd}
                    scrollRef={scrollRef}
                />
            )}
        </Animated.View>
    );
}

type PanHandlers = ReturnType<typeof PanResponder.create>['panHandlers'];

function Väljarlista({
    grupp,
    onVälj,
    onClose,
    panHandlers,
    onHuvudHöjd,
    scrollRef,
}: {
    grupp: AppFeedEvent[];
    onVälj: (e: AppFeedEvent) => void;
    onClose: () => void;
    panHandlers: PanHandlers;
    onHuvudHöjd: (h: number) => void;
    scrollRef: React.RefObject<ScrollView | null>;
}) {
    const plats = grupp[0]?.locationName;
    const nu = Date.now();
    return (
        <>
            <View {...panHandlers} onLayout={ev => onHuvudHöjd(ev.nativeEvent.layout.height + 120)}>
                <View style={styles.handtag} />
                <View style={styles.rad}>
                    <View style={styles.textkol}>
                        <Text style={styles.titel} numberOfLines={2}>{grupp.length} event här</Text>
                        {plats ? <Text style={styles.meta} numberOfLines={1}>📍 {plats}</Text> : null}
                    </View>
                    <Pressable onPress={onClose} hitSlop={12} style={styles.stang} accessibilityLabel="Stäng">
                        <Text style={styles.stangText}>✕</Text>
                    </Pressable>
                </View>
                <View style={styles.väljarPill}>
                    <Text style={styles.väljarPillText}>Välj ett event</Text>
                </View>
            </View>
            <ScrollView ref={scrollRef} style={styles.innehåll} contentContainerStyle={styles.innehållInre}>
                {grupp.map(e => (
                    <EventRad key={e.id} event={e} tema="mörk" dimmad={isEventPast(e, nu)} onPress={() => onVälj(e)} />
                ))}
            </ScrollView>
        </>
    );
}

function EventInnehåll({
    event,
    grupp,
    onVäljIGrupp,
    onTillbakaTillLista,
    lista,
    listaFrånOffset,
    flöde,
    stad,
    sök,
    sökÖppen,
    onSök,
    onVäxlaSök,
    sökFältRef,
    footerSkjut,
    onVälj,
    nav,
    onClose,
    panHandlers,
    onHuvudHöjd,
    scrollRef,
}: {
    event: AppFeedEvent;
    grupp: AppFeedEvent[];
    onVäljIGrupp?: (e: AppFeedEvent) => void;
    onTillbakaTillLista: (() => void) | null;
    lista: AppFeedEvent[];
    listaFrånOffset: number;
    flöde: readonly AppFeedEvent[];
    stad: { slug: string; name: string } | null;
    sök: string;
    sökÖppen: boolean;
    onSök: (v: string) => void;
    onVäxlaSök: () => void;
    sökFältRef: React.RefObject<TextInput | null>;
    /** Arkets translateY - footern counter-translaterar mot skärmens botten. */
    footerSkjut: Animated.Value;
    onVälj?: (e: AppFeedEvent) => void;
    nav?: KortNav;
    onClose: () => void;
    panHandlers: PanHandlers;
    onHuvudHöjd: (h: number) => void;
    scrollRef: React.RefObject<ScrollView | null>;
}) {
    const { minPos } = useRegionVal();
    const { ärSparad, växla } = useSparade();
    const filter = useFilter();
    const detalj = useEventDetalj(event.id);
    const [helskärm, setHelskärm] = useState<string | null>(null);

    const kat = kategoriFor(String(event.category));
    const emoji = event.emoji || kat.emoji;
    const tm = isTicketmasterEvent(event);
    const sparad = ärSparad(event.id);
    const nu = Date.now();
    const harVarit = isEventPast(event, nu);

    const tid = formatTidSpann(event.time, event.hasSpecificTime, event.endDate);
    const km = minPos ? distanceKm(minPos.lat, minPos.lng, event.lat, event.lng) : null;
    const plats = [km != null ? `${formatKm(km)} bort` : null, event.locationName].filter(Boolean).join(' · ');
    const värd = hostLabelFor(detalj.data?.hostName, detalj.data?.url ?? event.url ?? event.id);
    const beskrivning = descriptionText(detalj.data?.description, detalj.isLoading);
    const utlänk = eventOutlink(event.id, detalj.data?.url ?? event.url);
    const annons = isAffiliateUrl(utlänk);

    const gruppIndex = grupp.findIndex(e => e.id === event.id);
    const pager = grupp.length > 1 && gruppIndex >= 0
        ? { text: `${gruppIndex + 1}/${grupp.length}`, nästa: grupp[(gruppIndex + 1) % grupp.length] }
        : null;

    const söker = sök.trim().length > 0;
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
                <View style={styles.handtag} />
                <View style={styles.rad}>
                    {onTillbakaTillLista ? (
                        <Pressable onPress={onTillbakaTillLista} hitSlop={10} style={styles.tillbaka} accessibilityLabel="Tillbaka till listan">
                            <Text style={styles.stangText}>‹</Text>
                        </Pressable>
                    ) : null}
                    <View style={styles.textkol}>
                        <Text style={[styles.titel, harVarit && styles.titelVarit]} numberOfLines={2}>{emoji} {event.title}</Text>
                        {/* Tid/plats-raderna rullar i sidled - inget trunkeras (ägarbeslut 16/9). */}
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <Text style={styles.meta}>🕐 {tid}{harVarit ? ' · har varit' : ''}</Text>
                        </ScrollView>
                        {plats ? (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                <Text style={styles.meta}>📍 {plats}</Text>
                            </ScrollView>
                        ) : null}
                    </View>
                    <Pressable onPress={onClose} hitSlop={12} style={styles.stang} accessibilityLabel="Stäng">
                        <Text style={styles.stangText}>✕</Text>
                    </Pressable>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRad}>
                    <View style={[styles.chip, { backgroundColor: `${kat.hex}33` }]}>
                        <Text style={[styles.chipText, { color: kat.hex }]}>{kat.emoji} {kat.label}</Text>
                    </View>
                    {event.pop ? (
                        <View style={[styles.chip, styles.popChip]}>
                            <Text style={[styles.chipText, styles.popChipText]}>🔥 Populär</Text>
                        </View>
                    ) : null}
                    <View style={[styles.chip, styles.värdChip]}>
                        <Text style={[styles.chipText, styles.värdText]}>{värd}</Text>
                    </View>
                </ScrollView>
                {nav || pager ? (
                    <View style={styles.navRad}>
                        {nav?.onBakåt ? (
                            <Pressable onPress={nav.onBakåt} hitSlop={6} style={styles.navKnapp}>
                                <Text style={styles.navText}>‹ BAKÅT</Text>
                            </Pressable>
                        ) : null}
                        <View style={styles.navFyll} />
                        {pager ? (
                            <Pressable onPress={() => onVäljIGrupp?.(pager.nästa)} hitSlop={6} style={styles.navKnapp}
                                accessibilityLabel="Nästa event på samma plats">
                                <Text style={styles.navText}>{pager.text} →</Text>
                            </Pressable>
                        ) : null}
                        {nav ? (
                            <Pressable
                                onPress={nav.onNästa}
                                disabled={nav.nästaEtikett === null}
                                hitSlop={6}
                                style={[styles.navKnapp, styles.nästaKnapp, nav.nästaEtikett === null && styles.släckt]}
                            >
                                <Text style={styles.nästaText}>{nav.nästaEtikett ?? 'NÄSTA'} ›</Text>
                            </Pressable>
                        ) : null}
                    </View>
                ) : null}
                <View style={styles.knappRad}>
                    {/* Sök/filter-ikonen längst till vänster (7/10) - blå när
                        blocket är öppet eller kartfiltret är på. Dela-knappen
                        som stod här är RIVEN (Bjud med i footern delar). */}
                    {lista.length > 0 ? (
                        <Pressable
                            style={({ pressed }) => [styles.knapp, styles.sökKnapp, (sökÖppen || filter.aktivt) && styles.sökKnappPå, pressed && styles.knappTryckt]}
                            onPress={onVäxlaSök}
                            accessibilityLabel="Sök och filtrera i listan"
                        >
                            <Text style={styles.sökIkon}>🔍</Text>
                        </Pressable>
                    ) : null}
                    <Pressable
                        style={({ pressed }) => [styles.knapp, styles.hjärtKnapp, sparad && styles.hjärtSparad, pressed && styles.knappTryckt]}
                        onPress={() => växla(event)}
                        accessibilityLabel={sparad ? 'Ta bort från sparade' : 'Spara'}
                    >
                        <Text style={[styles.hjärtText, sparad && styles.hjärtTextSparad]}>{sparad ? '♥' : '♡'}</Text>
                    </Pressable>
                    {utlänk ? (
                        <Pressable
                            style={({ pressed }) => [styles.knapp, tm ? styles.bokaKnapp : styles.anmälKnapp, pressed && styles.knappTryckt]}
                            onPress={() => WebBrowser.openBrowserAsync(utlänk)}
                        >
                            <Text style={tm ? styles.bokaText : styles.anmälText}>{tm ? 'BOKA →' : 'ANMÄL →'}</Text>
                        </Pressable>
                    ) : null}
                </View>
                {annons ? <Text style={styles.annons}>{AFFILIATE_DISCLOSURE}</Text> : null}
                {sökÖppen ? (
                    <View style={styles.sökBlock}>
                        <TextInput
                            ref={sökFältRef}
                            value={sök}
                            onChangeText={onSök}
                            placeholder="Sök event eller plats …"
                            placeholderTextColor="#64748b"
                            autoCorrect={false}
                            returnKeyType="search"
                            style={styles.sökFält}
                        />
                        {/* Kategorichipsen direkt under sökfältet (6/10) -
                            samma rad som sökpanelen, delat filter: ett val
                            smalnar listan i kortet OCH kartan bakom. */}
                        <KategoriRad events={lista} />
                    </View>
                ) : null}
            </View>
            <ScrollView ref={scrollRef} style={styles.innehåll} contentContainerStyle={styles.innehållMedFooter}>
                {/* Under sökning visas listan direkt (webbens listvy-växling). */}
                {!söker ? (
                    <>
                        {event.img ? (
                            <Pressable onPress={() => setHelskärm(event.img ?? null)} accessibilityLabel="Visa bilden i helskärm">
                                <Image source={{ uri: event.img }} style={styles.bild} contentFit="cover" transition={150} />
                            </Pressable>
                        ) : null}
                        <Text style={styles.beskrivning}>{beskrivning}</Text>
                        <FlerFran
                            rad={flerFrån}
                            stad={stad}
                            onVälj={e => (onVälj ?? onVäljIGrupp)?.(e)}
                        />
                    </>
                ) : null}
                {onVälj && lista.length > 0 ? (
                    <FlerEvent lista={lista} valtId={event.id} frånOffset={listaFrånOffset} sök={sök} onVälj={onVälj} />
                ) : null}
            </ScrollView>
            {/* Footern pinnas mot skärmens botten: arket är tak-högt och
                nedskjutet, så arkets botten ligger under skärmkanten - footern
                skjuts lika långt åt andra hållet. */}
            <Animated.View
                style={[styles.footerHållare, { transform: [{ translateY: Animated.multiply(footerSkjut, -1) }] }]}
                pointerEvents="box-none"
            >
                <RsvpFooter
                    event={event}
                    delningsUrl={eventUrl(event)}
                    cta={utlänk ? { url: utlänk, label: tm ? 'BOKA' : 'ANMÄL', guld: tm } : null}
                />
            </Animated.View>
            <HelskarmsBild uri={helskärm} onClose={() => setHelskärm(null)} />
        </>
    );
}

/** Månaden · 🔥 Populärt - dag för dag i kartans ruta (webbens popularList).
 *  `sök` = kortsökets term (6/10): smalnar båda flikarna (lib/kortSok). */
function FlerEvent({
    lista,
    valtId,
    frånOffset,
    sök = '',
    onVälj,
}: {
    lista: AppFeedEvent[];
    valtId: string;
    frånOffset: number;
    sök?: string;
    onVälj: (e: AppFeedEvent) => void;
}) {
    const { minPos } = useRegionVal();
    const [flik, setFlik] = useState<ListFlik>('månaden');
    const [antal, setAntal] = useState(SIDA);
    useEffect(() => setAntal(SIDA), [flik, frånOffset, sök]);

    const söker = sök.trim().length > 0;
    const underlag = useMemo(
        () => (söker ? lista.filter(e => matcharKortSök(e, sök)) : lista),
        [lista, sök, söker],
    );

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
            {!söker ? (
                <View style={styles.scrollaPill}>
                    <Text style={styles.scrollaText}>Fler event nedanför ⌄</Text>
                </View>
            ) : null}
            <View style={styles.flerChipRad}>
                <Pressable onPress={() => setFlik('månaden')} style={[styles.flerChip, flik === 'månaden' && styles.flerChipVald]}>
                    <Text style={[styles.flerChipText, flik === 'månaden' && styles.flerChipTextVald]}>
                        MÅNADEN · {totalt(alla)}
                    </Text>
                </Pressable>
                <Pressable onPress={() => setFlik('populärt')} style={[styles.flerChip, flik === 'populärt' && styles.flerChipVald]}>
                    <Text style={[styles.flerChipText, flik === 'populärt' && styles.flerChipTextVald]}>
                        🔥 POPULÄRT · {totalt(populära)}
                    </Text>
                </Pressable>
            </View>
            {visade.map(d => (
                <View key={d.offset}>
                    <Text style={styles.dagRubrik}>{periodLabel(d.offset, 1).toUpperCase()}</Text>
                    {d.events.map(e => (
                        <EventRad
                            key={e.id}
                            event={e}
                            tema="mörk"
                            km={minPos ? distanceKm(minPos.lat, minPos.lng, e.lat, e.lng) : null}
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
        </>
    );
}

const MÖRK_YTA = '#17191f';
const MÖRK_RAD = '#22252d';
const GULD = '#f0b429';

const styles = StyleSheet.create({
    ark: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: MÖRK_YTA,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOpacity: 0.35,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: -4 },
        elevation: 14,
    },
    handtag: {
        alignSelf: 'center',
        width: 44,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#3f4650',
        marginTop: 10,
        marginBottom: 8,
    },
    rad: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16 },
    textkol: { flex: 1, paddingRight: 8 },
    titel: { fontSize: 18, fontWeight: '800', color: '#5aa2ff' },
    titelVarit: { color: '#94a3b8' },
    meta: { marginTop: 5, fontSize: 13, fontWeight: '600', color: '#cbd5e1' },
    tillbaka: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: MÖRK_RAD,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
    },
    stang: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: MÖRK_RAD,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stangText: { fontSize: 15, fontWeight: '700', color: '#cbd5e1' },
    chipRad: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingTop: 10 },
    chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
    chipText: { fontSize: 12, fontWeight: '700' },
    popChip: { backgroundColor: 'rgba(249,115,22,0.25)' },
    popChipText: { color: '#fb923c' },
    värdChip: { backgroundColor: MÖRK_RAD },
    värdText: { color: '#cbd5e1' },
    navRad: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 10 },
    navFyll: { flex: 1 },
    navKnapp: { borderRadius: 999, backgroundColor: MÖRK_RAD, paddingHorizontal: 12, paddingVertical: 7 },
    navText: { fontSize: 12, fontWeight: '800', color: '#e2e8f0', letterSpacing: 0.8 },
    nästaKnapp: { backgroundColor: '#ffffff' },
    nästaText: { fontSize: 12, fontWeight: '900', color: '#0f172a', letterSpacing: 0.8 },
    släckt: { opacity: 0.35 },
    knappRad: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
    knapp: { borderRadius: 999, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
    knappTryckt: { opacity: 0.85 },
    sökKnapp: { width: 48, backgroundColor: MÖRK_RAD },
    sökKnappPå: { backgroundColor: '#006AA7' },
    sökIkon: { fontSize: 17 },
    hjärtKnapp: { width: 48, backgroundColor: MÖRK_RAD },
    hjärtSparad: { backgroundColor: '#ffffff' },
    hjärtText: { fontSize: 20, color: '#e2e8f0', marginTop: -2 },
    hjärtTextSparad: { color: '#e11d48' },
    anmälKnapp: { flex: 1, backgroundColor: '#2563eb' },
    anmälText: { color: '#ffffff', fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
    bokaKnapp: { flex: 1, backgroundColor: GULD },
    bokaText: { color: '#451a03', fontSize: 15, fontWeight: '900', letterSpacing: 0.5 },
    annons: { marginTop: -6, marginBottom: 8, textAlign: 'center', fontSize: 10, fontWeight: '600', color: '#64748b' },
    sökBlock: { paddingBottom: 10 },
    sökFält: {
        marginHorizontal: 16,
        marginBottom: 2,
        borderRadius: 12,
        backgroundColor: MÖRK_RAD,
        borderWidth: 1,
        borderColor: '#3f4650',
        paddingHorizontal: 14,
        paddingVertical: 10,
        fontSize: 14,
        fontWeight: '600',
        color: '#e2e8f0',
    },
    footerHållare: { position: 'absolute', left: 0, right: 0, bottom: 0 },
    väljarPill: {
        alignSelf: 'flex-start',
        marginHorizontal: 16,
        marginTop: 10,
        marginBottom: 8,
        borderRadius: 999,
        backgroundColor: MÖRK_RAD,
        paddingHorizontal: 12,
        paddingVertical: 5,
    },
    väljarPillText: { fontSize: 12, fontWeight: '800', color: '#cbd5e1', letterSpacing: 0.6 },
    innehåll: { flex: 1 },
    innehållInre: { paddingBottom: 48 },
    /** Infovyn: luft så footern inte täcker sista raden på takhöjden. */
    innehållMedFooter: { paddingBottom: 132 },
    bild: { width: '100%', height: 200 },
    beskrivning: { paddingHorizontal: 16, paddingTop: 12, fontSize: 14, lineHeight: 21, color: '#e2e8f0' },
    scrollaPill: {
        alignSelf: 'center',
        marginTop: 16,
        borderRadius: 999,
        borderWidth: 1.5,
        borderColor: '#FECC02',
        paddingHorizontal: 18,
        paddingVertical: 8,
    },
    scrollaText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
    flerChipRad: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6 },
    flerChip: { borderRadius: 999, backgroundColor: MÖRK_RAD, paddingHorizontal: 12, paddingVertical: 6 },
    flerChipVald: { backgroundColor: '#ffffff' },
    flerChipText: { fontSize: 12, fontWeight: '800', color: '#cbd5e1', letterSpacing: 0.8 },
    flerChipTextVald: { color: '#0f172a' },
    dagRubrik: {
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 4,
        fontSize: 12,
        fontWeight: '800',
        color: '#94a3b8',
        letterSpacing: 1,
    },
    visaFler: {
        alignSelf: 'center',
        marginTop: 14,
        borderRadius: 999,
        backgroundColor: MÖRK_RAD,
        paddingHorizontal: 18,
        paddingVertical: 9,
    },
    visaFlerText: { color: '#e2e8f0', fontSize: 13, fontWeight: '700' },
    flerTomt: { textAlign: 'center', color: '#94a3b8', marginTop: 16, fontSize: 13 },
});
