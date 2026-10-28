/**
 * Kommer/Intresserad-footern - webbens EventRsvpFooter (ägarbeslut 6/10,
 * spår 3: "kommer och intresserad, de kan vara längst ner som en footer"):
 * fast platta i botten när ett event är valt. SEDAN 7/10 KVÄLL (webbens
 * svarsrad): ordningen Intresserad · Kommer · Bjud med · ANMÄL/BOKA, INGA
 * emojis i knapparna och lite större knappar. Bjud med är bara en
 * person-med-plus-ikon (Josef 7/10: "så fattar man snabbare", tar mindre
 * bredd) - samma som webbens UserPlus. Footern är enda utlänken -
 * kortets stora CTA är riven - och Annons-märkningen för affiliatelänkar
 * bor här (cta.annons).
 *
 *  - BJUD MED sätter Kommer på en själv ("man visar att man kommer när man
 *    delar den") och delar /e/<slug>?inb=1&fran=<uid> (lib/rsvp
 *    inbjudningsUrl) - uid:t är kontots eller en anonym session, så
 *    mottagaren ser vem som bjöd.
 *  - SEDAN 8/10 (Firestore direkt): räknarna i knapparna (eventStats, en
 *    läsning per event; eget tryck räknas om mot baslinjen så siffran aldrig
 *    tappar ens egen etta) och avatarraden över knapparna (eventRsvps, äldst
 *    först, anonyma som grå siluett) - webbens EventRsvpFooter.
 *  - Pinnas mot SKÄRMENS botten av EventKorts footerHållare (arket ritas i
 *    takets höjd och skjuts ner, så arkets egen botten ligger under
 *    skärmkanten på de lägre stoppen - hållaren counter-translaterar) TILLS
 *    man scrollat fram till radens egen plats under beskrivningen - där
 *    släpper den och följer innehållet (webbens sticky bottom-0, Josef 7/10
 *    kväll: "den kan ju vara där nere i footern tills dess att vi kommer
 *    fram till där de syns i eventkortet och lossna ifrån sin stickiness
 *    då"). Scrollar raden sedan ut över överkanten tar RsvpToppRad över -
 *    knapparna syns alltså hela vägen.
 *  - EN RAD, ALLTID (Josef 23/10: "kommer, intresserad, anmäl - den ska
 *    aldrig vara på 2 rader"): alla fyra knapparna står på samma rad i
 *    footern, på radens plats i kortet OCH i toppraden (SvarsRad). Webbens
 *    footer radbryter ANMÄL när siffrorna växer (flex-wrap, 8/10) - här
 *    krymper textknapparna med avklippt text i stället, och textskalningen
 *    är tak-satt (TEXTSKALA), så raden aldrig blir två.
 *  - VÄNKNAPPEN i inbjudningsbannern (sociala lagret, 11/10): mottagaren kan
 *    lägga till inbjudaren som vän direkt ur bannern (webbens
 *    EventRsvpFooter) - utloggade skickas till inloggningen.
 */
import { useEffect, useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { getAuth } from '@react-native-firebase/auth';
import type { AppFeedEvent } from '@vadkul/kontrakt';
import { useRsvp } from '@/lib/rsvpContext';
import { useKonto } from '@/lib/kontoContext';
import { inbjudningsUrl, rsvpShareId, type RsvpStatus } from '@/lib/rsvp';
import { hämtaEngagemang, räknaKlick, type Engagemang } from '@/data/eventStats';
import { hämtaAnsikten, type RsvpAnsikte } from '@/data/rsvp';
import { accepteraVänförfrågan, hämtaAnvändareLite, hämtaMinVänrelation, skickaVänförfrågan } from '@/data/vanner';

/** Räknaren efter eget tryck: baslinjen från läsningen, justerad för hur
 *  ens eget svar ändrats sedan dess (webbens countsMemo). */
function räknat(bas: number, varPå: boolean, ärPå: boolean): number {
    return Math.max(0, bas - (varPå ? 1 : 0) + (ärPå ? 1 : 0));
}

export type RsvpCta = { url: string; label: string; guld: boolean; annons?: string | null };

/** Tak för systemets textskalning i raden - större text än så skulle
 *  tränga ut ANMÄL, och raden får aldrig bli två (23/10). */
const TEXTSKALA = 1.2;

/** Svarsläget, räknarna och Bjud med - delas av footern och toppraden
 *  (webbens useRsvpCounts). eventStats-läsningen är sessionscachad per
 *  event, så båda raderna kan vara monterade utan extra läsningar. */
function useSvar(event: AppFeedEvent & { userCreated?: boolean }) {
    const { minRsvp, svara } = useRsvp();
    const { säkerställIdentitet } = useKonto();
    const mitt = minRsvp(event.id);

    // Räknarna + baslinjen (ens eget svar NÄR siffrorna lästes).
    const [bas, setBas] = useState<{ e: Engagemang; mitt: RsvpStatus | null } | null>(null);
    useEffect(() => {
        let aktiv = true;
        setBas(null);
        const vidLäsning = mitt;
        void hämtaEngagemang(rsvpShareId(event.id, event.userCreated)).then(e => {
            if (aktiv && e) setBas({ e, mitt: vidLäsning });
        });
        return () => { aktiv = false; };
        // Läses en gång per event - eget tryck räknas om lokalt (räknat ovan).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [event.id, event.userCreated]);

    const antal = (status: RsvpStatus) =>
        bas ? räknat(bas.e[status], bas.mitt === status, mitt === status) : 0;

    const bjudMed = async () => {
        if (mitt !== 'going') svara(event, 'going');
        let uid: string | null = null;
        try { uid = await säkerställIdentitet(); } catch { /* offline - länken funkar utan avsändare */ }
        const url = inbjudningsUrl(event.id, event.userCreated, uid);
        const text = `Följer du med på ${event.title}?`;
        void Share.share({ title: event.title, message: `${text} ${url}`, url });
    };

    return { mitt, välj: (status: RsvpStatus) => svara(event, status), antal, bjudMed };
}

type Svarsläge = ReturnType<typeof useSvar>;

function SvarKnapp({ svar, status, text }: { svar: Svarsläge; status: RsvpStatus; text: string }) {
    const på = svar.mitt === status;
    const n = svar.antal(status);
    return (
        <Pressable
            onPress={() => svar.välj(status)}
            accessibilityRole="button"
            accessibilityState={{ selected: på }}
            style={({ pressed }) => [styles.knapp, styles.svarKnapp, på && styles.knappPå, pressed && styles.tryckt]}
        >
            <Text style={[styles.knappText, på && styles.knappTextPå]} numberOfLines={1} maxFontSizeMultiplier={TEXTSKALA}>{text}</Text>
            {n > 0 ? <Text style={[styles.antal, på && styles.antalPå]} maxFontSizeMultiplier={TEXTSKALA}>{n}</Text> : null}
        </Pressable>
    );
}

/** Intresserad · Kommer · Bjud med - samma knappar i footern och toppraden.
 *  Intresserad FÖRE Kommer och REN TEXT (Josef 7/10: "ta även bort emojina
 *  i intreserad, kommer, bjud in och anmäl") - även ✓:et är borta. */
function SvarsKnappar({ svar }: { svar: Svarsläge }) {
    return (
        <>
            <SvarKnapp svar={svar} status="interested" text="Intresserad" />
            <SvarKnapp svar={svar} status="going" text="Kommer" />
            <Pressable
                onPress={() => void svar.bjudMed()}
                accessibilityRole="button"
                accessibilityLabel="Bjud med någon - dela eventet"
                style={({ pressed }) => [styles.knapp, styles.ikonKnapp, pressed && styles.tryckt]}
            >
                <PersonPlus />
            </Pressable>
        </>
    );
}

/** ANMÄL/BOKA-pillret - guld för Ticketmaster (1/9), klicket räknas. */
function CtaKnapp({ event, cta }: { event: AppFeedEvent & { hostName?: string }; cta: RsvpCta }) {
    return (
        <Pressable
            onPress={() => {
                räknaKlick({ id: event.id, url: cta.url, title: event.title, hostName: event.hostName });
                void WebBrowser.openBrowserAsync(cta.url);
            }}
            style={({ pressed }) => [styles.cta, cta.guld ? styles.ctaGuld : styles.ctaBlå, pressed && styles.tryckt]}
        >
            <Text style={[styles.ctaText, cta.guld ? styles.ctaTextGuld : styles.ctaTextBlå]} numberOfLines={1} maxFontSizeMultiplier={TEXTSKALA}>{cta.label} →</Text>
        </Pressable>
    );
}

/**
 * HELA RADEN PÅ EN RAD: Intresserad · Kommer · Bjud med · ANMÄL/BOKA (Josef
 * 23/10: "kommer, intresserad, anmäl - den ska aldrig vara på 2 rader").
 * Samma rad i footern, på radens plats i kortet och i toppraden - ANMÄL
 * stod förut på toppradens titelrad med de andra under, det var "2 rader".
 * Textknapparna får krympa (flexShrink, avklippt text) innan något bryts;
 * ikonknappen och ANMÄL håller sin bredd.
 */
function SvarsRad({ svar, event, cta }: {
    svar: Svarsläge;
    event: AppFeedEvent & { hostName?: string };
    cta: RsvpCta | null;
}) {
    return (
        <View style={styles.platta}>
            <SvarsKnappar svar={svar} />
            <View style={styles.fyll} />
            {cta ? <CtaKnapp event={event} cta={cta} /> : null}
        </View>
    );
}

/**
 * TOPPRADEN NÄR MAN SCROLLAT FÖRBI - webbens EventRsvpTopBar (ägarbeslut
 * 7/10 kväll, Josef: "längst uppe om man scrollat förbi ett eventkort. då
 * ska fortfarande intresserad, kommer, .... Alla de ska synas, samt emojin
 * och titeln ska vara kvar"): emoji + titel på titelraden och under den
 * SAMMA rad som i footern - Intresserad · Kommer · Bjud med · ANMÄL/BOKA
 * på EN rad (23/10; webben har ANMÄL på titelraden, men Josef: "den ska
 * aldrig vara på 2 rader"). EventKort visar den klistrad överst i
 * scrollytan när svarsraden i kortet scrollat ut över överkanten och låter
 * den stå kvar genom chatt, arrangörsrad och listan - det är raden som
 * följt med i botten som stannar i toppen. Ingen avatarrad och ingen
 * inbjudningsbanner - de bor kvar i raden i kortet.
 *
 * SEDAN 28/10 UTAN TITELRAD: emoji + titel står kvar i kortets huvud, som
 * inte längre göms när toppraden tänds (huvudet krympte och hela innehållet
 * ryckte upp - Josef 28/10: "för mycket som rör på sig"). Titeln en gång,
 * i huvudet, och här bara knapparna.
 */
export function RsvpToppRad({ event, cta }: {
    event: AppFeedEvent & { userCreated?: boolean; hostName?: string };
    cta: RsvpCta | null;
}) {
    const svar = useSvar(event);
    return (
        <View style={styles.topp}>
            {/* Annons-märkningen följer provisionslänken även här - den
                långa texten bor i raden i kortet. */}
            {cta?.annons ? <Text style={styles.toppAnnons}>ANNONS</Text> : null}
            <SvarsRad svar={svar} event={event} cta={cta} />
        </View>
    );
}

export function RsvpFooter({
    event,
    /** ANMÄL/BOKA-pillret - null när eventet saknar utlänk. */
    cta,
    inbjudan = null,
}: {
    event: AppFeedEvent & { userCreated?: boolean; hostName?: string };
    cta: RsvpCta | null;
    /** Bjud med-länken (?inb=1&fran=<uid>): bannern ovanför knapparna. */
    inbjudan?: { fran: string | null; onStäng: () => void } | null;
}) {
    const { användare } = useKonto();
    const insets = useSafeAreaInsets();
    const svar = useSvar(event);

    // Avatarraden - hämtas per event, sessionscachad (data/rsvp).
    const [ansikten, setAnsikten] = useState<RsvpAnsikte[]>([]);
    useEffect(() => {
        let aktiv = true;
        setAnsikten([]);
        void hämtaAnsikten(event.id, event.userCreated).then(a => { if (aktiv) setAnsikten(a); });
        return () => { aktiv = false; };
    }, [event.id, event.userCreated]);
    // Inbjudarens namn (users/{uid} är publikt läsbart, som på webben) -
    // samma sessionscachade läsning som vänförfrågan (data/vanner).
    const [inbjudare, setInbjudare] = useState<string | null>(null);
    useEffect(() => {
        setInbjudare(null);
        if (!inbjudan?.fran) return;
        let aktiv = true;
        void hämtaAnvändareLite(inbjudan.fran).then(lite => { if (aktiv) setInbjudare(lite.name); });
        return () => { aktiv = false; };
    }, [inbjudan?.fran]);

    // VÄNKNAPPEN i bannern (sociala lagret - webbens EventRsvpFooter:
    // "mottagaren kan lägga till inbjudaren"). Läget hämtas först när bannern
    // faktiskt visas för en inloggad - en läsning av ens EGEN friends-rad.
    // 'idle' = inget att visa (utredning pågår, eller inbjudaren är man själv).
    const fran = inbjudan?.fran ?? null;
    const [vänLäge, setVänLäge] = useState<'idle' | 'none' | 'outgoing' | 'incoming' | 'accepted' | 'busy'>('idle');
    useEffect(() => {
        setVänLäge('idle');
        if (!fran || fran === användare?.uid) return;
        // Utloggad/anonym: knappen visas men öppnar inloggningen (reglerna
        // kräver riktigt konto för vänförfrågningar).
        if (!användare) { setVänLäge('none'); return; }
        let aktiv = true;
        void hämtaMinVänrelation(användare.uid, fran).then(rad => {
            if (aktiv) setVänLäge(rad?.status ?? 'none');
        });
        return () => { aktiv = false; };
    }, [fran, användare]);

    const vänKnapp = async () => {
        if (!fran) return;
        if (!användare) { router.push('/konto?lage=logga-in'); return; }
        if (vänLäge !== 'none' && vänLäge !== 'incoming') return;
        const accepterar = vänLäge === 'incoming';
        setVänLäge('busy');
        try {
            if (accepterar) {
                await accepteraVänförfrågan(användare.uid, fran, 'incoming');
                setVänLäge('accepted');
            } else {
                await skickaVänförfrågan({
                    uid: användare.uid,
                    name: användare.displayName,
                    photoURL: getAuth().currentUser?.photoURL ?? null,
                }, fran);
                setVänLäge('outgoing');
            }
        } catch {
            setVänLäge(accepterar ? 'incoming' : 'none');
            Alert.alert('Det gick inte just nu', 'Försök igen om en stund.');
        }
    };

    return (
        <View style={[styles.hållare, { paddingBottom: Math.max(10, insets.bottom) }]}>
        {inbjudan ? (
            <View style={styles.inbjudan}>
                <View style={styles.inbjudanText}>
                    <Text style={styles.inbjudanRubrik}>
                        {inbjudare ? `${inbjudare} undrar om du följer med` : 'Du är bjuden - följer du med?'}
                    </Text>
                    <Text style={styles.inbjudanHjälp}>Svara här nedanför - inget konto behövs.</Text>
                    {/* Vänvägen (sociala lagret): lägg till inbjudaren direkt ur
                        bannern. 'idle' = man själv/okänt läge → ingen rad alls. */}
                    {vänLäge === 'accepted' ? (
                        <Text style={styles.vänStatus}>✓ Ni är vänner</Text>
                    ) : vänLäge === 'outgoing' ? (
                        <Text style={styles.vänStatus}>Vänförfrågan skickad ✓</Text>
                    ) : vänLäge !== 'idle' ? (
                        <Pressable
                            onPress={() => void vänKnapp()}
                            disabled={vänLäge === 'busy'}
                            style={({ pressed }) => [styles.vänKnapp, vänLäge === 'busy' && styles.vänKnappUpptagen, pressed && styles.tryckt]}
                        >
                            <Text style={styles.vänKnappText}>
                                {vänLäge === 'incoming'
                                    ? `Acceptera vänförfrågan${inbjudare ? ` från ${inbjudare}` : ''}`
                                    : `+ Lägg till ${inbjudare ?? 'inbjudaren'} som vän`}
                            </Text>
                        </Pressable>
                    ) : null}
                </View>
                <Pressable onPress={inbjudan.onStäng} hitSlop={10} accessibilityLabel="Stäng inbjudan">
                    <Text style={styles.inbjudanStäng}>✕</Text>
                </Pressable>
            </View>
        ) : null}
        {ansikten.length > 0 ? (
            <View style={styles.ansiktsRad} accessibilityLabel={`${ansikten.length} personer har svarat`}>
                {ansikten.slice(0, 5).map((a, i) => (
                    <View key={a.uid} style={[styles.ansikte, i > 0 && styles.ansikteÖverlapp]}>
                        {a.photoURL ? (
                            <Image source={{ uri: a.photoURL }} style={styles.ansiktsBild} contentFit="cover" />
                        ) : (
                            <Text style={styles.initial}>{a.name ? a.name.trim().charAt(0).toUpperCase() : ''}</Text>
                        )}
                    </View>
                ))}
                {ansikten.length > 5 ? <Text style={styles.fler}>+{ansikten.length - 5}</Text> : null}
                <Text style={styles.ansiktsText}>
                    {ansikten.length === 1 ? '1 har svarat' : `${ansikten.length} har svarat`}
                </Text>
            </View>
        ) : null}
        <SvarsRad svar={svar} event={event} cta={cta} />
        {/* Annons-märkningen för affiliatelänkar bor i footern (7/10 kväll). */}
        {cta?.annons ? <Text style={styles.annons}>{cta.annons}</Text> : null}
        </View>
    );
}

/**
 * Person med plus - lucides UserPlus (webbens Bjud med) ritad med vyer, så
 * appen slipper ett ikonbibliotek (react-native-svg är native och kräver nytt
 * bygge). Huvudring, axelbåge och ett plus till höger.
 */
function PersonPlus() {
    return (
        <View style={ikon.ram} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <View style={ikon.huvud} />
            <View style={ikon.kropp} />
            <View style={ikon.plusLodrät} />
            <View style={ikon.plusVågrät} />
        </View>
    );
}

const IKON_FÄRG = '#334155';
const STRECK = 2;
const ikon = StyleSheet.create({
    ram: { width: 20, height: 16 },
    huvud: {
        position: 'absolute', left: 3, top: 0, width: 7, height: 7,
        borderRadius: 3.5, borderWidth: STRECK, borderColor: IKON_FÄRG,
    },
    kropp: {
        position: 'absolute', left: 0, top: 9, width: 13, height: 7,
        borderTopLeftRadius: 5, borderTopRightRadius: 5,
        borderWidth: STRECK, borderBottomWidth: 0, borderColor: IKON_FÄRG,
    },
    plusLodrät: {
        position: 'absolute', left: 15, top: 3, width: STRECK, height: 8,
        borderRadius: 1, backgroundColor: IKON_FÄRG,
    },
    plusVågrät: {
        position: 'absolute', left: 12, top: 6, width: 8, height: STRECK,
        borderRadius: 1, backgroundColor: IKON_FÄRG,
    },
});

/** Webbens ljusa footer (bg-card + BTN_OFF/BTN_ON): vita knappar med
 *  slate-kant, blå när valet är på - på kortets vita yta (EventKort 10/10). */
const styles = StyleSheet.create({
    /** Positioneras av EventKorts footerHållare (counter-translaten). */
    hållare: {
        backgroundColor: '#ffffff',
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
    },
    annons: { paddingHorizontal: 12, paddingBottom: 2, fontSize: 11, color: '#94a3b8' },
    /** EN rad (23/10): luft och sidopaddning så alla fyra knapparna får
     *  plats med siffror på 375 pt (Intresserad 12 · Kommer 3 · ikon ·
     *  ANMÄL →). RN radbryter aldrig en rad - det som inte får plats
     *  krymper (svarKnapp) i stället för att skjutas utanför kanten. */
    platta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingTop: 10,
    },
    knapp: {
        borderRadius: 999,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        paddingHorizontal: 12,
        paddingVertical: 9,
    },
    /** Ikonknappen: smalare sidoluft, höjden följer textknapparna. Krymper
     *  aldrig - ikonen ritas i fasta mått. */
    ikonKnapp: { paddingHorizontal: 11, minHeight: 36, justifyContent: 'center', flexShrink: 0 },
    /** Textknapparna: texten + räknaren på samma rad. Får krympa när raden
     *  är trång (texten klipps, numberOfLines 1) så ANMÄL alltid står kvar. */
    svarKnapp: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1, minWidth: 0 },
    knappPå: {
        backgroundColor: '#006AA7',
        borderColor: '#005590',
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
    },
    antal: { fontSize: 13, fontWeight: '800', color: '#94a3b8', fontVariant: ['tabular-nums'] },
    antalPå: { color: 'rgba(255,255,255,0.75)' },
    /** Toppraden: vit platta med kantlinje + skugga nedåt (webbens bg-card
     *  border-b shadow-md). Ligger ÖVERST i kortets scrollyta. Sidoluften
     *  bor i plattan (SvarsRad), inte här. */
    topp: {
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        paddingBottom: 10,
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
        elevation: 4,
    },
    toppAnnons: { alignSelf: 'flex-end', paddingHorizontal: 12, paddingTop: 6, fontSize: 9, fontWeight: '900', letterSpacing: 1, color: '#94a3b8' },
    inbjudan: {
        flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 12, marginTop: 10,
        paddingHorizontal: 12, paddingVertical: 9, borderRadius: 14, backgroundColor: '#006AA7',
    },
    inbjudanText: { flex: 1 },
    inbjudanRubrik: { fontSize: 13, fontWeight: '800', color: '#ffffff' },
    inbjudanHjälp: { marginTop: 1, fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.78)' },
    vänStatus: { marginTop: 4, fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.85)' },
    vänKnapp: {
        alignSelf: 'flex-start',
        marginTop: 5,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.15)',
        paddingHorizontal: 9,
        paddingVertical: 4,
    },
    vänKnappUpptagen: { opacity: 0.6 },
    vänKnappText: { fontSize: 11, fontWeight: '900', color: '#ffffff' },
    inbjudanStäng: { fontSize: 14, fontWeight: '900', color: '#ffffff' },
    ansiktsRad: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 8 },
    ansikte: {
        width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#ffffff',
        backgroundColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    },
    ansikteÖverlapp: { marginLeft: -8 },
    ansiktsBild: { width: '100%', height: '100%' },
    initial: { fontSize: 11, fontWeight: '900', color: '#475569' },
    fler: { marginLeft: 4, fontSize: 11, fontWeight: '800', color: '#64748b' },
    ansiktsText: { marginLeft: 8, fontSize: 12, fontWeight: '700', color: '#64748b' },
    knappText: { fontSize: 13, fontWeight: '800', color: '#334155' },
    knappTextPå: { color: '#ffffff' },
    fyll: { flex: 1 },
    /** ANMÄL/BOKA krymper aldrig - det är textknapparna som ger vika. */
    cta: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, flexShrink: 0 },
    ctaBlå: { backgroundColor: '#0077BC' },
    ctaGuld: { backgroundColor: '#f0b429' },
    ctaText: { fontSize: 13, fontWeight: '900', letterSpacing: 0.5 },
    ctaTextBlå: { color: '#ffffff' },
    ctaTextGuld: { color: '#451a03' },
    tryckt: { opacity: 0.85 },
});
