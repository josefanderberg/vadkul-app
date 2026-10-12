/**
 * Meddelandemenyn i chatten - öppnas med långtryck på någon annans bubbla i
 * EventChat (publik och privat). Anmäl meddelandet eller blockera avsändaren:
 * App Store-regel 1.2 kräver båda för användarskapat innehåll. Logiken
 * (dokumentformer, filtret) bor i lib/moderering, Firestore-rören i
 * data/moderering.
 *
 * ETT Modal-ark vars innehåll stegar (val → skäl → tack, val → blockera →
 * klart) i stället för en kedja av Alert-rutor: Android visar högst tre
 * knappar i en Alert (skälen är fyra + avbryt), och på iOS tappas en Alert
 * som öppnas medan ett Modal stängs. Ren JS (RN-kärnans Modal) - kräver
 * inget nytt dev-bygge.
 */
import { useState, type ReactNode } from 'react';
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ChatMessage } from '@vadkul/kontrakt';
import {
    avsändarNamn,
    CHATT_ANMÄLAN_SKÄL,
    chattAnmälanDoc,
    chattAnmälanMailto,
    genitiv,
    type ChattAnmälanDoc,
    type ChattAnmälanSkäl,
    type ChattTyp,
} from '@/lib/moderering';
import { RAPPORT_MOTTAGARE } from '@/lib/rapportera';
import { anmälChattMeddelande, blockera } from '@/data/moderering';

export interface ChattMenyMål {
    meddelande: ChatMessage;
    chatt: ChattTyp;
    /** Privata trådens id (= inbjudarens uid), null i publika chatten. */
    trådId: string | null;
}

type Steg =
    | 'val'
    | 'skäl'
    | 'skickar'
    | 'tack'
    | 'anmälFel'
    | 'blockera'
    | 'blockerar'
    | 'blockerad'
    | 'blockFel';

/** Monteras bara medan menyn är öppen (EventChat renderar den villkorat), så
 *  varje öppning börjar på första steget utan återställnings-effekt. */
export function ChattMeny({ mål, eventId, eventTitle, myUid, onStäng }: {
    mål: ChattMenyMål;
    eventId: string;
    eventTitle: string;
    myUid: string;
    onStäng: () => void;
}) {
    const insets = useSafeAreaInsets();
    const [steg, setSteg] = useState<Steg>('val');
    // Anmälan som inte gick fram - mejlreserven behöver samma innehåll.
    const [felDoc, setFelDoc] = useState<ChattAnmälanDoc | null>(null);
    const [mejlFel, setMejlFel] = useState(false);
    // Blockerade man redan från tack-steget visas inte knappen igen.
    const [blockerad, setBlockerad] = useState(false);

    const namn = avsändarNamn(mål.meddelande);
    const upptagen = steg === 'skickar' || steg === 'blockerar';
    const stäng = () => { if (!upptagen) onStäng(); };

    const skickaAnmälan = async (skäl: ChattAnmälanSkäl) => {
        const d = chattAnmälanDoc({
            chatt: mål.chatt,
            eventId,
            eventTitle,
            trådId: mål.trådId,
            meddelande: mål.meddelande,
            skäl,
            anmälare: myUid,
        });
        if (!d) { setSteg('anmälFel'); return; }
        setSteg('skickar');
        try {
            await anmälChattMeddelande(d);
            setSteg('tack');
        } catch (e) {
            console.warn('Kunde inte skicka anmälan:', e);
            setFelDoc(d);
            setSteg('anmälFel');
        }
    };

    const mejla = () => {
        if (!felDoc) { setMejlFel(true); return; }
        Linking.openURL(chattAnmälanMailto(felDoc)).catch(() => setMejlFel(true));
    };

    const körBlockera = async () => {
        setSteg('blockerar');
        try {
            await blockera(myUid, { uid: mål.meddelande.senderId, name: mål.meddelande.senderName });
            setBlockerad(true);
            setSteg('blockerad');
        } catch (e) {
            console.warn('Kunde inte blockera:', e);
            setSteg('blockFel');
        }
    };

    let innehåll: ReactNode;
    switch (steg) {
        case 'val':
            innehåll = (
                <>
                    <Text style={styles.rubrik}>Meddelande från {namn}</Text>
                    <Text style={styles.citat} numberOfLines={3}>{mål.meddelande.text}</Text>
                    <Knapp text="⚑ Anmäl meddelandet" onPress={() => setSteg('skäl')} />
                    <Knapp text={`Blockera ${namn}`} typ="fara" onPress={() => setSteg('blockera')} />
                    <Knapp text="Avbryt" typ="avbryt" onPress={stäng} />
                </>
            );
            break;
        case 'skäl':
        case 'skickar':
            innehåll = (
                <>
                    <Text style={styles.rubrik}>{steg === 'skickar' ? 'Skickar anmälan …' : 'Vad är det som är fel?'}</Text>
                    <Text style={styles.brödtext}>Anmälan går till VADKUL, inte till {namn}.</Text>
                    {CHATT_ANMÄLAN_SKÄL.map(skäl => (
                        <Knapp key={skäl} text={skäl} disabled={upptagen} onPress={() => void skickaAnmälan(skäl)} />
                    ))}
                    <Knapp text="Tillbaka" typ="avbryt" disabled={upptagen} onPress={() => setSteg('val')} />
                </>
            );
            break;
        case 'tack':
            innehåll = (
                <>
                    <Text style={styles.rubrik}>Tack för din anmälan</Text>
                    <Text style={styles.brödtext}>
                        Vi går igenom den och tar bort innehåll som bryter mot våra regler. Meddelandet är dolt för dig.
                    </Text>
                    {!blockerad ? (
                        <Knapp text={`Blockera ${namn} också`} typ="fara" onPress={() => setSteg('blockera')} />
                    ) : null}
                    <Knapp text="Klar" typ="primär" onPress={stäng} />
                </>
            );
            break;
        case 'anmälFel':
            innehåll = (
                <>
                    <Text style={styles.rubrik}>Anmälan gick inte fram</Text>
                    <Text style={styles.brödtext}>
                        {mejlFel
                            ? `Mejla oss på ${RAPPORT_MOTTAGARE} och berätta vilket meddelande det gäller, så tar vi hand om det.`
                            : 'Mejla den till oss i stället, så tar vi hand om det.'}
                    </Text>
                    {!mejlFel ? <Knapp text="Mejla anmälan" typ="primär" onPress={mejla} /> : null}
                    <Knapp text="Försök igen" onPress={() => setSteg('skäl')} />
                    <Knapp text="Stäng" typ="avbryt" onPress={stäng} />
                </>
            );
            break;
        case 'blockera':
        case 'blockerar':
            innehåll = (
                <>
                    <Text style={styles.rubrik}>{steg === 'blockerar' ? 'Blockerar …' : `Blockera ${namn}?`}</Text>
                    <Text style={styles.brödtext}>
                        Du ser inte längre {genitiv(namn)} meddelanden i någon chatt, och är ni vänner tas vänskapen bort.
                        {' '}{namn} får inget besked om det. Du kan häva blockeringen under Vänner i profilen.
                    </Text>
                    <Knapp text="Blockera" typ="fara" disabled={upptagen} onPress={() => void körBlockera()} />
                    <Knapp text="Avbryt" typ="avbryt" disabled={upptagen} onPress={stäng} />
                </>
            );
            break;
        case 'blockerad':
            innehåll = (
                <>
                    <Text style={styles.rubrik}>{namn} är blockerad</Text>
                    <Text style={styles.brödtext}>
                        {genitiv(namn)} meddelanden är dolda för dig. Du hittar blockeringen under Vänner i profilen.
                    </Text>
                    <Knapp text="Klar" typ="primär" onPress={stäng} />
                </>
            );
            break;
        case 'blockFel':
            innehåll = (
                <>
                    <Text style={styles.rubrik}>Kunde inte blockera</Text>
                    <Text style={styles.brödtext}>Försök igen om en stund.</Text>
                    <Knapp text="Försök igen" onPress={() => setSteg('blockera')} />
                    <Knapp text="Stäng" typ="avbryt" onPress={stäng} />
                </>
            );
            break;
    }

    return (
        <Modal visible transparent animationType="fade" onRequestClose={stäng}>
            <Pressable style={styles.bakgrund} onPress={stäng} accessibilityLabel="Stäng menyn">
                {/* Arket sväljer sina egna tryck - bara utanför stänger. */}
                <Pressable style={[styles.ark, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]} onPress={() => {}}>
                    {innehåll}
                </Pressable>
            </Pressable>
        </Modal>
    );
}

function Knapp({ text, onPress, typ = 'vanlig', disabled }: {
    text: string;
    onPress: () => void;
    typ?: 'vanlig' | 'fara' | 'primär' | 'avbryt';
    disabled?: boolean;
}) {
    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            accessibilityRole="button"
            style={({ pressed }) => [
                styles.knapp,
                typ === 'primär' && styles.knappPrimär,
                typ === 'avbryt' && styles.knappAvbryt,
                disabled && styles.knappAv,
                pressed && styles.tryckt,
            ]}
        >
            <Text style={[
                styles.knappText,
                typ === 'fara' && styles.knappTextFara,
                typ === 'primär' && styles.knappTextPrimär,
                typ === 'avbryt' && styles.knappTextAvbryt,
            ]}>
                {text}
            </Text>
        </Pressable>
    );
}

const BLÅ = '#006AA7';
const KANT = '#e2e8f0';

const styles = StyleSheet.create({
    bakgrund: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.45)' },
    ark: {
        backgroundColor: '#ffffff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingHorizontal: 16,
        paddingTop: 18,
        gap: 8,
    },
    rubrik: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
    brödtext: { fontSize: 13, fontWeight: '500', color: '#475569', lineHeight: 18, marginBottom: 4 },
    citat: {
        fontSize: 13,
        color: '#334155',
        lineHeight: 18,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: KANT,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginBottom: 4,
    },
    knapp: {
        borderRadius: 12,
        borderWidth: 1,
        borderColor: KANT,
        backgroundColor: '#ffffff',
        paddingVertical: 13,
        alignItems: 'center',
    },
    knappPrimär: { backgroundColor: BLÅ, borderColor: BLÅ },
    knappAvbryt: { backgroundColor: '#f1f5f9', borderColor: '#f1f5f9' },
    knappAv: { opacity: 0.5 },
    knappText: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
    knappTextFara: { color: '#dc2626' },
    knappTextPrimär: { color: '#ffffff' },
    knappTextAvbryt: { color: '#475569' },
    tryckt: { opacity: 0.85 },
});
