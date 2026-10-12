/**
 * Det blå "arrangera själv"-blocket - webbens CityCreatePitch
 * (app/(v1)/evenemang/). Används TVÅ gånger på stadssidan, som webben
 * (Josef 4/9: "i Stockholm tar det aslång tid att scrolla ner"):
 *  - Överst HOPFÄLLT till en smal rad som fälls ut på tryck, med
 *    SNABBÖNSKAN under (22/9): skriv vad du saknar och tryck Önska, så
 *    öppnas önska-läget med texten ifylld.
 *  - Längst ner alltid utfällt - slutet av listan är en inbjudan, inte en
 *    återvändsgränd.
 *
 * Trappan har BARA nivå 1 och 2 i appen: webbens nivå 3 är boost med pris,
 * och appen säljer ingenting och nämner inte boost (CLAUDE.md, Apples
 * IAP-regler). Exemplen är riktiga event man ordnar för andra (Josef 22/9).
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

const BLÅ = '#006AA7';
const MÖRKBLÅ = '#052846';
const GULD = '#FECC02';

/** Trappan i miniatyr: tre stigande staplar (dämpad, blå, guld) - webbens StairMark. */
function Trappmärke() {
    return (
        <View style={styles.trappa}>
            <View style={[styles.stapel, { height: 8, backgroundColor: 'rgba(255,255,255,0.35)' }]} />
            <View style={[styles.stapel, { height: 14, backgroundColor: '#bae6fd' }]} />
            <View style={[styles.stapel, { height: 20, backgroundColor: GULD }]} />
        </View>
    );
}

/** Snabbönskan: minst 3 tecken, som reglernas titelkrav. */
function Snabbönska({ stadsnamn, onÖnska }: { stadsnamn: string; onÖnska: (titel: string) => void }) {
    const [titel, setTitel] = useState('');
    const ok = titel.trim().length >= 3;
    const skicka = () => {
        if (!ok) return;
        onÖnska(titel.trim().slice(0, 120));
        setTitel('');
    };
    return (
        <View style={styles.önska}>
            <TextInput
                value={titel}
                onChangeText={setTitel}
                placeholder={`Vad saknas i ${stadsnamn}? Önska ett event…`}
                placeholderTextColor="#94a3b8"
                maxLength={120}
                returnKeyType="send"
                onSubmitEditing={skicka}
                accessibilityLabel={`Önska ett event i ${stadsnamn}`}
                style={styles.önskaFält}
            />
            <Pressable
                onPress={skicka}
                disabled={!ok}
                style={({ pressed }) => [styles.önskaKnapp, !ok && styles.av, pressed && styles.tryckt]}
            >
                <Text style={styles.önskaKnappText}>Önska</Text>
            </Pressable>
        </View>
    );
}

export function StadsPitch({
    stadsnamn,
    hopfällbar = false,
    onSkapa,
    onÖnska,
}: {
    stadsnamn: string;
    /** Översta varianten: hopfälld rad + snabbönskan. */
    hopfällbar?: boolean;
    onSkapa: () => void;
    /** Finns den står snabbönskan under rutan. */
    onÖnska?: (titel: string) => void;
}) {
    const [öppen, setÖppen] = useState(!hopfällbar);
    const önska = onÖnska ? <Snabbönska stadsnamn={stadsnamn} onÖnska={onÖnska} /> : null;

    if (hopfällbar && !öppen) {
        return (
            <View>
                <Pressable onPress={() => setÖppen(true)} style={({ pressed }) => [styles.rad, pressed && styles.tryckt]}>
                    <Trappmärke />
                    <View style={styles.radText}>
                        <Text style={styles.radRubrik}>Så syns ditt event i {stadsnamn}</Text>
                        <Text style={styles.radUnder} numberOfLines={1}>Skapa gratis och hamna överst.</Text>
                    </View>
                    <View style={styles.rund}><Text style={styles.rundText}>⌄</Text></View>
                </Pressable>
                {önska}
            </View>
        );
    }

    return (
        <View>
            <View style={[styles.block, hopfällbar ? styles.blockTopp : styles.blockBotten]}>
                <View style={styles.blockHuvud}>
                    <Text style={styles.blockRubrik}>
                        {hopfällbar ? `Så syns ditt event i ${stadsnamn}` : 'Slut på listan? Skapa det som saknas.'}
                    </Text>
                    {hopfällbar ? (
                        <Pressable onPress={() => setÖppen(false)} hitSlop={8} accessibilityLabel="Fäll ihop" style={styles.rund}>
                            <Text style={styles.rundText}>⌃</Text>
                        </Pressable>
                    ) : null}
                </View>
                <Text style={styles.brödtext}>
                    Ett event på VADKUL behöver inte vara en stor konsert. Det kan vara en quizkväll på puben, en
                    loppis, en prova-på-kurs, en spelturnering eller en klubbkväll. Det du skapar visas överst på den
                    här sidan och lyfts på kartan.
                </Text>
                {/* Trappan: stigande bredd uppåt (webbens mobilvariant), högerställd. */}
                <View style={[styles.nivå, styles.nivå1]}>
                    <Text style={styles.nivåEtikett1}>NIVÅ 1</Text>
                    <Text style={styles.nivåRubrik1}>Syns bra</Text>
                    <Text style={styles.nivåText1}>Externa event - vi hittar dem åt dig inför varje morgon och visar dem som prickar på kartan.</Text>
                </View>
                <View style={[styles.nivå, styles.nivå2]}>
                    <Text style={styles.nivåEtikett2}>NIVÅ 2 · SKAPA GRATIS</Text>
                    <Text style={styles.nivåRubrik2}>📌 Syns mer</Text>
                    <Text style={styles.nivåText2}>Skapat på VADKUL - egen eventbricka som ligger UPPE på kartan hela tiden, och överst på den här sidan.</Text>
                </View>
                <Pressable onPress={onSkapa} style={({ pressed }) => [styles.skapa, pressed && styles.tryckt]}>
                    <Text style={styles.skapaText}>Skapa ett event i {stadsnamn} </Text>
                    <Text style={styles.skapaPil}>→</Text>
                </Pressable>
                <Text style={styles.nuFokus}>
                    VADKUL fokuserar på det som händer nu - idag först, sedan veckan. Event längre fram fylls på när de närmar sig.
                </Text>
            </View>
            {hopfällbar ? önska : null}
        </View>
    );
}

const styles = StyleSheet.create({
    tryckt: { opacity: 0.85 },
    av: { opacity: 0.4 },
    rad: {
        marginTop: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        borderRadius: 16,
        backgroundColor: BLÅ,
        paddingHorizontal: 16,
        paddingVertical: 14,
        shadowColor: BLÅ,
        shadowOpacity: 0.45,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 8 },
        elevation: 4,
    },
    trappa: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.1)',
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: 3,
        paddingBottom: 10,
    },
    stapel: { width: 6, borderRadius: 2 },
    radText: { flex: 1 },
    radRubrik: { fontSize: 14, fontWeight: '900', color: '#ffffff' },
    radUnder: { marginTop: 1, fontSize: 12, fontWeight: '500', color: '#bae6fd' },
    rund: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    rundText: { color: '#ffffff', fontSize: 15, fontWeight: '900' },
    block: { borderRadius: 24, backgroundColor: BLÅ, paddingHorizontal: 20, paddingVertical: 22 },
    blockTopp: { marginTop: 12 },
    blockBotten: { marginTop: 32 },
    blockHuvud: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
    blockRubrik: { flex: 1, fontSize: 20, fontWeight: '900', color: '#ffffff' },
    brödtext: { marginTop: 8, fontSize: 14, lineHeight: 21, fontWeight: '500', color: '#e0f2fe' },
    nivå: { marginTop: 8, alignSelf: 'flex-end', borderRadius: 16 },
    nivå1: {
        width: '86%',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    nivå2: {
        width: '100%',
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderWidth: 1,
        borderColor: 'rgba(125,211,252,0.4)',
        paddingHorizontal: 14,
        paddingVertical: 16,
    },
    nivåEtikett1: { fontSize: 10, fontWeight: '900', letterSpacing: 0.8, color: 'rgba(125,211,252,0.8)' },
    nivåRubrik1: { marginTop: 2, fontSize: 14, fontWeight: '900', color: 'rgba(224,242,254,0.9)' },
    nivåText1: { marginTop: 4, fontSize: 11, lineHeight: 15, fontWeight: '500', color: 'rgba(186,230,253,0.7)' },
    nivåEtikett2: { fontSize: 10, fontWeight: '900', letterSpacing: 0.8, color: '#bae6fd' },
    nivåRubrik2: { marginTop: 2, fontSize: 16, fontWeight: '900', color: '#ffffff' },
    nivåText2: { marginTop: 4, fontSize: 12, lineHeight: 17, fontWeight: '500', color: '#e0f2fe' },
    skapa: {
        marginTop: 20,
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 999,
        backgroundColor: MÖRKBLÅ,
        paddingHorizontal: 22,
        paddingVertical: 12,
    },
    skapaText: { color: '#ffffff', fontSize: 14, fontWeight: '900' },
    skapaPil: { color: GULD, fontSize: 16, fontWeight: '900' },
    nuFokus: { marginTop: 12, fontSize: 11, lineHeight: 15, fontWeight: '500', color: 'rgba(186,230,253,0.9)' },
    önska: {
        marginTop: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        backgroundColor: '#ffffff',
        padding: 6,
        paddingLeft: 14,
    },
    önskaFält: { flex: 1, paddingVertical: 6, fontSize: 14, fontWeight: '500', color: '#0f172a' },
    önskaKnapp: { borderRadius: 12, backgroundColor: BLÅ, paddingHorizontal: 16, paddingVertical: 9 },
    önskaKnappText: { color: '#ffffff', fontSize: 14, fontWeight: '900' },
});
