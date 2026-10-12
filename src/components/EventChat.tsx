/**
 * Eventets chattar - port av webbens src/components/v2/EventChatPanel.tsx
 * (spår 3, sociala lagret). Bor i eventkortets scrollinnehåll DIREKT under
 * beskrivningen (webbens ordning: eventinfo → svarsrad → chatt → arrangörsrad
 * → listan; appens svarsrad är den fasta RsvpFooter-plattan, så chatten
 * börjar direkt under beskrivningen). TVÅ BLOCK under varandra:
 *
 * PUBLIK CHATT - KRÄVER KONTO FÖR ATT ENS LÄSAS (Josef 31/8): utloggade (och
 * anonyma sessioner) möts av en låst rad som öppnar inloggningen, och ingen
 * prenumeration startas (noll Firestore-läsningar). INFÄLLD tills någon
 * skrivit något (Josef 30/8): utan meddelanden bara en rad man kan fälla upp.
 *
 * PRIVAT CHATT - syns för ALLA inloggade. Utan medlemskap: "Bjud in"
 * (delningsarket) och "Kopiera länk". Båda startar ens egen tråd i bakgrunden
 * (säkerställPrivatTråd - INTE awaitad: delning/urklipp ska ske i samma
 * tryck) och delar inbjudningslänken /e/<slug>?inb=1&fran=<trådens ägare>.
 * Mottagaren får svarsbannern (svara utan konto) och här en gå-med-väg; som
 * medlem kan man bjuda in fler till SAMMA tråd (länken bär trådägarens uid,
 * privateInviteThreadId). Tråden bor i eventChats/{nyckel}/privat/{ägarUid}
 * (lib/privatChat + data/privatChatt). Nekar reglerna (gammal klient, tråd
 * saknas) visar blocket en lugn "inte aktiverad än"-rad i stället.
 *
 * Lyssnarna lever BARA medan blocket är monterat (kortets eventläge) och rivs
 * vid unmount/eventbyte - egress-disciplinen i CLAUDE.md.
 */
import { useEffect, useRef, useState } from 'react';
import {
    Alert,
    Pressable,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { getAuth } from '@react-native-firebase/auth';
import type { ChatMessage } from '@vadkul/kontrakt';
import type { AppEvent } from '@/lib/appEvent';
import { useKonto } from '@/lib/kontoContext';
import {
    isThreadMember,
    meddelandeTid,
    pickPrivateThread,
    privateInviteThreadId,
    threadOthersLabel,
    type PrivateThreadLite,
} from '@/lib/privatChat';
import { inbjudningsUrl } from '@/lib/rsvp';
import { lyssnaPåChatt, skickaChattMeddelande } from '@/data/eventChatt';
import {
    gåMedIPrivatTråd,
    lyssnaPåMinaPrivatTrådar,
    lyssnaPåPrivatMeddelanden,
    skickaPrivatMeddelande,
    säkerställPrivatTråd,
} from '@/data/privatChatt';

/** Meddelandelistan + skrivfältet - samma för publik och privat chatt. */
function ChatTråd({ messages, myUid, tomText, platshållare, onSänd }: {
    messages: ChatMessage[];
    myUid: string;
    tomText: string;
    platshållare: string;
    onSänd: (text: string) => Promise<void>;
}) {
    const [text, setText] = useState('');
    const [skickar, setSkickar] = useState(false);
    // Scrolla ENBART chattens egen lista till botten när nya meddelanden
    // landar (webbens listRef.scrollTop) - aldrig kortets yttre scroll.
    const listRef = useRef<ScrollView>(null);
    useEffect(() => {
        if (messages.length > 0) listRef.current?.scrollToEnd({ animated: false });
    }, [messages]);

    const sänd = async () => {
        const t = text.trim();
        if (!t || skickar) return;
        setSkickar(true);
        try {
            await onSänd(t);
            setText('');
        } catch (e) {
            console.warn('Kunde inte skicka chattmeddelandet:', e);
            Alert.alert('Kunde inte skicka', 'Försök igen om en stund.');
        } finally {
            setSkickar(false);
        }
    };

    return (
        <>
            <ScrollView ref={listRef} style={styles.lista} contentContainerStyle={styles.listaInre} nestedScrollEnabled>
                {messages.length === 0 ? (
                    <Text style={styles.tomText}>{tomText}</Text>
                ) : null}
                {messages.map(msg => {
                    const mitt = msg.senderId === myUid;
                    const tid = meddelandeTid(msg.createdAt);
                    return (
                        <View key={msg.id} style={[styles.bubbelRad, mitt ? styles.bubbelRadMitt : null]}>
                            <View style={[styles.bubbla, mitt ? styles.bubblaMitt : styles.bubblaAnnan]}>
                                {/* Användarnamnet syns på ALLA kommentarer - även ens
                                    egna, så man ser hur man framstår för andra. */}
                                <Text style={[styles.bubbelNamn, mitt ? styles.bubbelNamnMitt : null]}>
                                    {mitt ? `${msg.senderName || 'Du'} (du)` : (msg.senderName || 'Deltagare')}
                                </Text>
                                <Text style={[styles.bubbelText, mitt ? styles.bubbelTextMitt : null]}>{msg.text}</Text>
                                {tid ? (
                                    <Text style={[styles.bubbelTid, mitt ? styles.bubbelTidMitt : null]}>{tid}</Text>
                                ) : null}
                            </View>
                        </View>
                    );
                })}
            </ScrollView>
            <View style={styles.skrivRad}>
                <TextInput
                    value={text}
                    onChangeText={setText}
                    placeholder={platshållare}
                    placeholderTextColor="#94a3b8"
                    maxLength={500}
                    returnKeyType="send"
                    onSubmitEditing={() => void sänd()}
                    accessibilityLabel="Skriv ett chattmeddelande"
                    style={styles.skrivFält}
                />
                <Pressable
                    onPress={() => void sänd()}
                    disabled={!text.trim() || skickar}
                    accessibilityLabel="Skicka"
                    style={({ pressed }) => [styles.sändKnapp, (!text.trim() || skickar) && styles.sändKnappAv, pressed && styles.tryckt]}
                >
                    <Text style={styles.sändPil}>↑</Text>
                </Pressable>
            </View>
        </>
    );
}

export function EventChat({ event, fran }: {
    event: AppEvent;
    /** Kortet öppnades via en inbjudningslänk (?inb=1&fran=<uid>): fran är
     *  inbjudarens uid = den privata trådens id, så blocket kan visa en
     *  gå-med-väg. */
    fran: string | null;
}) {
    const { användare } = useKonto();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    // Manuellt uppfälld trots tom chatt (för att bli först att skriva).
    const [uppfälld, setUppfälld] = useState(false);
    // Privata tråden.
    const [trådar, setTrådar] = useState<PrivateThreadLite[]>([]);
    const [privMessages, setPrivMessages] = useState<ChatMessage[]>([]);
    const [privOtillgänglig, setPrivOtillgänglig] = useState(false);
    const [gårMed, setGårMed] = useState(false);
    // "Kopierad ✓" på knappen en stund efter kopieringen.
    const [kopierad, setKopierad] = useState(false);

    // uid (inte användare-objektet) som effekt-nyckel: kontexten byter
    // referens vid token-refresh och skulle annars riva upp lyssnaren i onödan.
    const uid = användare?.uid ?? null;
    const eventId = event.id;
    const userCreated = event.userCreated;
    useEffect(() => {
        // Eventbyte återanvänder komponenten - börja om hopfällt och utan
        // förra eventets meddelanden.
        setUppfälld(false);
        setMessages([]);
        setTrådar([]);
        setPrivMessages([]);
        setPrivOtillgänglig(false);
        setKopierad(false);
        // Utloggad/anonym = ingen lyssnare alls: chatten är låst och en
        // prenumeration hade bara bränt läsningar. Loggar man in monteras
        // lyssnaren direkt (uid byter värde).
        if (!uid) return;
        const sluta = lyssnaPåChatt(eventId, setMessages);
        return () => sluta();
    }, [eventId, uid]);

    // Trådarna JAG är med i (0-1 i praktiken) - queryn filtrerar på den egna
    // members-nyckeln, så den är billig och tillåten i reglerna.
    useEffect(() => {
        if (!uid) return;
        const sluta = lyssnaPåMinaPrivatTrådar(eventId, userCreated, uid, setTrådar, () => setPrivOtillgänglig(true));
        return () => sluta();
    }, [eventId, userCreated, uid]);

    const aktivTråd = pickPrivateThread(trådar, uid, fran);
    const ärMedlem = aktivTråd !== null && isThreadMember(aktivTråd, uid);

    // Meddelandelyssnaren för privata tråden - bara som medlem.
    const aktivTrådId = ärMedlem ? aktivTråd.id : null;
    useEffect(() => {
        setPrivMessages([]);
        if (!uid || !aktivTrådId) return;
        const sluta = lyssnaPåPrivatMeddelanden(eventId, userCreated, aktivTrådId, setPrivMessages, () => setPrivOtillgänglig(true));
        return () => sluta();
    }, [eventId, userCreated, uid, aktivTrådId]);

    useEffect(() => {
        if (!kopierad) return;
        const t = setTimeout(() => setKopierad(false), 2500);
        return () => clearTimeout(t);
    }, [kopierad]);

    // UTLOGGAD: båda chattarna är låsta (Josef 31/8) - rader med hänglås som
    // öppnar inloggningen. Gäller även den som kom via en inbjudningslänk:
    // chattarna kräver konto, svaret i svarsraden gör det inte.
    if (!användare) {
        const tillInloggning = () => router.push('/konto?lage=logga-in');
        return (
            <View style={styles.ytterst}>
                <Pressable onPress={tillInloggning} style={({ pressed }) => [styles.rad, pressed && styles.tryckt]}>
                    <Text style={styles.radIkon}>💬</Text>
                    <Text style={styles.radEtikett}>CHATT</Text>
                    <Text style={styles.radLåstText} numberOfLines={1}>Logga in för att se chatten</Text>
                    <Text style={styles.radLås}>🔒</Text>
                </Pressable>
                <Pressable onPress={tillInloggning} style={({ pressed }) => [styles.rad, pressed && styles.tryckt]}>
                    <Text style={styles.radIkon}>👥</Text>
                    <Text style={styles.radEtikett}>PRIVAT CHATT</Text>
                    <Text style={styles.radLåstText} numberOfLines={1}>
                        {fran ? 'Logga in för att gå med' : 'Logga in för att bjuda in'}
                    </Text>
                    <Text style={styles.radLås}>🔒</Text>
                </Pressable>
            </View>
        );
    }

    const handleGåMed = async () => {
        if (!fran || gårMed) return;
        setGårMed(true);
        try {
            await gåMedIPrivatTråd(eventId, userCreated, fran, användare.uid);
            // Tråd-lyssnaren plockar upp medlemskapet och blocket fylls på.
        } catch {
            // Antingen nekar reglerna, eller så har inbjudaren inte startat
            // tråden (äldre klient) - samma lugna inforad i båda fallen.
            setPrivOtillgänglig(true);
        } finally {
            setGårMed(false);
        }
    };

    // Inbjudningslänken till den privata chatten. Synkron med flit: trådens
    // dokument skapas i bakgrunden (fire-and-forget), länken beror inte på
    // det - och delning/urklipp ska ske i samma tryck.
    const privatInbjudningsLänk = (): string => {
        if (!ärMedlem) {
            void säkerställPrivatTråd(eventId, userCreated, { uid: användare.uid, name: användare.displayName });
        }
        const trådId = privateInviteThreadId(aktivTråd, användare.uid);
        return inbjudningsUrl(eventId, userCreated, trådId);
    };

    const handleBjudIn = () => {
        const url = privatInbjudningsLänk();
        const text = `Följer du med på ${event.title}? Vi snackar ihop oss i en privat chatt på VADKUL.`;
        void Share.share({ title: event.title, message: `${text} ${url}`, url });
    };

    const handleKopiera = () => {
        const url = privatInbjudningsLänk();
        void Clipboard.setStringAsync(url);
        setKopierad(true);
    };

    const sändPublik = async (text: string) => {
        await skickaChattMeddelande(eventId, {
            senderId: användare.uid,
            senderName: användare.displayName || användare.email || 'Anonym',
            senderImage: getAuth().currentUser?.photoURL ?? null,
            text,
        }, event.title);
    };

    const sändPrivat = async (text: string) => {
        if (!aktivTrådId) return;
        await skickaPrivatMeddelande(eventId, userCreated, aktivTrådId, {
            senderId: användare.uid,
            senderName: användare.displayName || användare.email || 'Anonym',
            senderImage: getAuth().currentUser?.photoURL ?? null,
            text,
        });
    };

    // ── PUBLIK ─────────────────────────────────────────────────────────────
    // Hopfällt läge: inga meddelanden och inte manuellt uppfälld - bara en
    // rad som visar att chatten finns. Tryck fäller upp hela blocket.
    const publikBlock = messages.length === 0 && !uppfälld ? (
        <Pressable onPress={() => setUppfälld(true)} style={({ pressed }) => [styles.rad, pressed && styles.tryckt]}>
            <Text style={styles.radIkon}>💬</Text>
            <Text style={styles.radEtikett}>CHATT</Text>
            <Text style={styles.radLåstText} numberOfLines={1}>Inga meddelanden än - bli först att säga hej! 👋</Text>
            <Text style={styles.radChevron}>⌄</Text>
        </Pressable>
    ) : (
        <View style={styles.panel}>
            <View style={styles.panelHuvud}>
                <Text style={styles.radIkon}>💬</Text>
                <Text style={styles.radEtikett}>
                    CHATT{messages.length > 0 ? ` · ${messages.length}` : ''}
                </Text>
            </View>
            <ChatTråd
                messages={messages}
                myUid={användare.uid}
                tomText="Inga meddelanden än - bli först att säga hej! 👋"
                platshållare="Skriv något …"
                onSänd={sändPublik}
            />
        </View>
    );

    // ── PRIVAT ─────────────────────────────────────────────────────────────
    const bjudInKnappar = (
        <View style={styles.knappRad}>
            <Pressable
                onPress={handleBjudIn}
                accessibilityLabel="Bjud in till den privata chatten"
                style={({ pressed }) => [styles.bjudInKnapp, pressed && styles.tryckt]}
            >
                <Text style={styles.bjudInText}>Bjud in</Text>
            </Pressable>
            <Pressable
                onPress={handleKopiera}
                accessibilityLabel="Kopiera länken till den privata chatten"
                style={({ pressed }) => [styles.kopieraKnapp, pressed && styles.tryckt]}
            >
                <Text style={styles.kopieraText}>{kopierad ? 'Kopierad ✓' : 'Kopiera länk'}</Text>
            </Pressable>
        </View>
    );

    // Privata blockets rubrikrad ("PRIVAT CHATT · Josef").
    const privEtikett = aktivTråd ? threadOthersLabel(aktivTråd, uid) : null;
    const privatHuvud = (
        <View style={styles.privatHuvudVänster}>
            <Text style={styles.radIkon}>👥</Text>
            <Text style={styles.radEtikett} numberOfLines={1}>
                PRIVAT CHATT{ärMedlem && privEtikett ? ` · ${privEtikett.toUpperCase()}` : ''}
            </Text>
        </View>
    );

    const privatBlock = ärMedlem && !privOtillgänglig ? (
        // MEDLEM: hela tråden + bjud in fler (samma tråd) i rubriken.
        <View style={styles.panel}>
            <View style={styles.panelHuvud}>
                {privatHuvud}
                <View style={styles.huvudFyll} />
                <Pressable onPress={handleBjudIn} hitSlop={6} accessibilityLabel="Bjud in fler till den privata chatten">
                    <Text style={styles.huvudKnappText}>+ Bjud in</Text>
                </Pressable>
                <Pressable onPress={handleKopiera} hitSlop={6} accessibilityLabel="Kopiera länken till den privata chatten">
                    <Text style={styles.huvudKnappText}>{kopierad ? 'Kopierad ✓' : 'Länk'}</Text>
                </Pressable>
            </View>
            <ChatTråd
                messages={privMessages}
                myUid={användare.uid}
                tomText="Inga meddelanden än - säg hej till ditt sällskap! 👋"
                platshållare="Skriv till ditt sällskap …"
                onSänd={sändPrivat}
            />
        </View>
    ) : (
        // INTE MEDLEM (än): gå-med-vägen för inbjudna, annars bjud in-
        // knapparna. Nekade regler → lugn inforad i stället.
        <View style={[styles.panel, styles.privatBox]}>
            <View style={styles.panelHuvudUtanKant}>{privatHuvud}</View>
            {privOtillgänglig ? (
                <Text style={styles.privatHjälp}>
                    Den privata chatten är inte aktiverad än - kom tillbaka lite senare.
                </Text>
            ) : fran ? (
                <>
                    <Text style={styles.privatHjälp}>
                        Du är bjuden hit - häng med i den privata chatten för er som går ihop.
                    </Text>
                    <View style={styles.knappRad}>
                        <Pressable
                            onPress={() => void handleGåMed()}
                            disabled={gårMed}
                            style={({ pressed }) => [styles.bjudInKnapp, gårMed && styles.sändKnappAv, pressed && styles.tryckt]}
                        >
                            <Text style={styles.bjudInText}>{gårMed ? 'Går med …' : 'Gå med i privata chatten'}</Text>
                        </Pressable>
                    </View>
                </>
            ) : (
                <>
                    <Text style={styles.privatHjälp}>
                        Bjud in dem du vill ha med - bara ni som är med ser chatten, och de kan svara om de kommer direkt.
                    </Text>
                    {bjudInKnappar}
                </>
            )}
        </View>
    );

    return (
        <View style={styles.ytterst}>
            {publikBlock}
            {privatBlock}
        </View>
    );
}

/** Webbens chattblock: slate-50-yta med border, blå accenter (#006AA7). */
const BLÅ = '#006AA7';
const KANT = '#e2e8f0';

const styles = StyleSheet.create({
    ytterst: { marginHorizontal: 12, marginBottom: 12, gap: 8 },
    /** Hopfälld/låst rad - webbens ROW. */
    rad: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: KANT,
        backgroundColor: '#f8fafc',
        paddingHorizontal: 12,
        paddingVertical: 11,
    },
    radIkon: { fontSize: 13 },
    radEtikett: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2, color: '#64748b' },
    radLåstText: { flex: 1, fontSize: 12, fontWeight: '600', color: BLÅ },
    radLås: { fontSize: 12, opacity: 0.6 },
    radChevron: { fontSize: 13, fontWeight: '800', color: '#94a3b8' },
    /** Uppfällt block - webbens BOX. */
    panel: {
        borderRadius: 12,
        borderWidth: 1,
        borderColor: KANT,
        backgroundColor: '#f8fafc',
        overflow: 'hidden',
    },
    panelHuvud: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: KANT,
        backgroundColor: 'rgba(255,255,255,0.7)',
    },
    panelHuvudUtanKant: { flexDirection: 'row', alignItems: 'center' },
    privatHuvudVänster: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
    huvudFyll: { flex: 1 },
    huvudKnappText: { fontSize: 11, fontWeight: '900', color: BLÅ, paddingHorizontal: 4 },
    /** Meddelandelistan: webbens max-h-56 - skrollar för sig inne i kortet. */
    lista: { maxHeight: 224 },
    listaInre: { padding: 10, gap: 6 },
    tomText: { textAlign: 'center', fontSize: 12, fontWeight: '600', color: '#94a3b8', paddingVertical: 10 },
    bubbelRad: { flexDirection: 'row', justifyContent: 'flex-start' },
    bubbelRadMitt: { justifyContent: 'flex-end' },
    bubbla: {
        maxWidth: '85%',
        borderRadius: 16,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    bubblaAnnan: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: KANT,
        borderBottomLeftRadius: 4,
    },
    bubblaMitt: {
        backgroundColor: BLÅ,
        borderBottomRightRadius: 4,
    },
    bubbelNamn: { fontSize: 10, fontWeight: '900', color: BLÅ, marginBottom: 1 },
    bubbelNamnMitt: { color: 'rgba(255,255,255,0.85)' },
    bubbelText: { fontSize: 14, color: '#1e293b' },
    bubbelTextMitt: { color: '#ffffff' },
    bubbelTid: { fontSize: 9, color: '#94a3b8', textAlign: 'right', marginTop: 2 },
    bubbelTidMitt: { color: 'rgba(255,255,255,0.7)' },
    skrivRad: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 8,
        borderTopWidth: 1,
        borderTopColor: KANT,
        backgroundColor: 'rgba(255,255,255,0.7)',
    },
    skrivFält: {
        flex: 1,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: KANT,
        backgroundColor: '#ffffff',
        paddingHorizontal: 12,
        paddingVertical: 8,
        fontSize: 14,
        color: '#1e293b',
    },
    sändKnapp: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: BLÅ,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sändKnappAv: { opacity: 0.4 },
    sändPil: { fontSize: 17, fontWeight: '900', color: '#ffffff', marginTop: -1 },
    privatBox: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
    privatHjälp: { fontSize: 12, fontWeight: '600', color: '#64748b', lineHeight: 17 },
    knappRad: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    bjudInKnapp: {
        borderRadius: 999,
        backgroundColor: BLÅ,
        paddingHorizontal: 14,
        paddingVertical: 9,
    },
    bjudInText: { fontSize: 12, fontWeight: '900', color: '#ffffff' },
    kopieraKnapp: {
        borderRadius: 999,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: KANT,
        paddingHorizontal: 14,
        paddingVertical: 9,
    },
    kopieraText: { fontSize: 12, fontWeight: '900', color: '#334155' },
    tryckt: { opacity: 0.85 },
});
