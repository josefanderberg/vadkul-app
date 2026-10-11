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
 *    skärmkanten på de lägre stoppen - hållaren counter-translaterar).
 */
import { useEffect, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import type { AppFeedEvent } from '@vadkul/kontrakt';
import { useRsvp } from '@/lib/rsvpContext';
import { useKonto } from '@/lib/kontoContext';
import { inbjudningsUrl, rsvpShareId, type RsvpStatus } from '@/lib/rsvp';
import { hämtaEngagemang, räknaKlick, type Engagemang } from '@/data/eventStats';
import { hämtaAnsikten, type RsvpAnsikte } from '@/data/rsvp';
import { läsFält } from '@/data/anvandare';

/** Räknaren efter eget tryck: baslinjen från läsningen, justerad för hur
 *  ens eget svar ändrats sedan dess (webbens countsMemo). */
function räknat(bas: number, varPå: boolean, ärPå: boolean): number {
    return Math.max(0, bas - (varPå ? 1 : 0) + (ärPå ? 1 : 0));
}

export function RsvpFooter({
    event,
    /** ANMÄL/BOKA-pillret - null när eventet saknar utlänk. */
    cta,
    inbjudan = null,
}: {
    event: AppFeedEvent & { userCreated?: boolean; hostName?: string };
    cta: { url: string; label: string; guld: boolean; annons?: string | null } | null;
    /** Bjud med-länken (?inb=1&fran=<uid>): bannern ovanför knapparna. */
    inbjudan?: { fran: string | null; onStäng: () => void } | null;
}) {
    const { minRsvp, svara } = useRsvp();
    const { säkerställIdentitet } = useKonto();
    const insets = useSafeAreaInsets();
    const mitt = minRsvp(event.id);

    // Räknarna + baslinjen (ens eget svar NÄR siffrorna lästes).
    const [bas, setBas] = useState<{ e: Engagemang; mitt: RsvpStatus | null } | null>(null);
    const [ansikten, setAnsikten] = useState<RsvpAnsikte[]>([]);
    useEffect(() => {
        let aktiv = true;
        setBas(null);
        setAnsikten([]);
        const vidLäsning = mitt;
        void hämtaEngagemang(rsvpShareId(event.id, event.userCreated)).then(e => {
            if (aktiv && e) setBas({ e, mitt: vidLäsning });
        });
        void hämtaAnsikten(event.id, event.userCreated).then(a => { if (aktiv) setAnsikten(a); });
        return () => { aktiv = false; };
        // Läses en gång per event - eget tryck räknas om lokalt (räknat ovan).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [event.id, event.userCreated]);
    // Inbjudarens namn (users/{uid} är publikt läsbart, som på webben).
    const [inbjudare, setInbjudare] = useState<string | null>(null);
    useEffect(() => {
        setInbjudare(null);
        if (!inbjudan?.fran) return;
        let aktiv = true;
        void läsFält(inbjudan.fran)
            .then(d => { if (aktiv && typeof d?.displayName === 'string' && d.displayName) setInbjudare(d.displayName); })
            .catch(() => {});
        return () => { aktiv = false; };
    }, [inbjudan?.fran]);

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

    const Svar = ({ status, text }: { status: RsvpStatus; text: string }) => {
        const på = mitt === status;
        const n = antal(status);
        return (
            <Pressable
                onPress={() => svara(event, status)}
                accessibilityRole="button"
                accessibilityState={{ selected: på }}
                style={({ pressed }) => [styles.knapp, styles.svarKnapp, på && styles.knappPå, pressed && styles.tryckt]}
            >
                <Text style={[styles.knappText, på && styles.knappTextPå]}>{text}</Text>
                {n > 0 ? <Text style={[styles.antal, på && styles.antalPå]}>{n}</Text> : null}
            </Pressable>
        );
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
        <View style={styles.platta}>
            {/* Intresserad FÖRE Kommer, och REN TEXT i alla fyra knapparna
                (Josef 7/10: "ta även bort emojina i intreserad, kommer, bjud
                in och anmäl") - även ✓:et är borta. */}
            <Svar status="interested" text="Intresserad" />
            <Svar status="going" text="Kommer" />
            <Pressable
                onPress={() => void bjudMed()}
                accessibilityRole="button"
                accessibilityLabel="Bjud med någon - dela eventet"
                style={({ pressed }) => [styles.knapp, styles.ikonKnapp, pressed && styles.tryckt]}
            >
                <PersonPlus />
            </Pressable>
            <View style={styles.fyll} />
            {cta ? (
                <Pressable
                    onPress={() => {
                        räknaKlick({ id: event.id, url: cta.url, title: event.title, hostName: event.hostName });
                        void WebBrowser.openBrowserAsync(cta.url);
                    }}
                    style={({ pressed }) => [styles.cta, cta.guld ? styles.ctaGuld : styles.ctaBlå, pressed && styles.tryckt]}
                >
                    <Text style={[styles.ctaText, cta.guld ? styles.ctaTextGuld : styles.ctaTextBlå]}>{cta.label} →</Text>
                </Pressable>
            ) : null}
        </View>
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
    platta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 12,
        paddingTop: 10,
    },
    knapp: {
        borderRadius: 999,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        paddingHorizontal: 14,
        paddingVertical: 9,
    },
    /** Ikonknappen: smalare sidoluft, höjden följer textknapparna. */
    ikonKnapp: { paddingHorizontal: 11, minHeight: 36, justifyContent: 'center' },
    /** Textknapparna: texten + räknaren på samma rad. */
    svarKnapp: { flexDirection: 'row', alignItems: 'center', gap: 5 },
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
    inbjudan: {
        flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 12, marginTop: 10,
        paddingHorizontal: 12, paddingVertical: 9, borderRadius: 14, backgroundColor: '#006AA7',
    },
    inbjudanText: { flex: 1 },
    inbjudanRubrik: { fontSize: 13, fontWeight: '800', color: '#ffffff' },
    inbjudanHjälp: { marginTop: 1, fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.78)' },
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
    cta: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
    ctaBlå: { backgroundColor: '#0077BC' },
    ctaGuld: { backgroundColor: '#f0b429' },
    ctaText: { fontSize: 13, fontWeight: '900', letterSpacing: 0.5 },
    ctaTextBlå: { color: '#ffffff' },
    ctaTextGuld: { color: '#451a03' },
    tryckt: { opacity: 0.85 },
});
