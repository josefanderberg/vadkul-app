/**
 * Dag/vecka-kontrollen fast i botten - webbens mörka platta med BÅDA raderna
 * och antal i kartans ruta (vald rad = vit pill, allt rounded-full). Pilarna
 * stegar EN dag i båda lägena. "Tryck för att växla" är ENGÅNGS-onboarding:
 * första trycket på någon av väljarens knappar släcker den för gott på
 * enheten (kart-ui 1/9).
 *
 * KALENDERN (webbens 2b, kart-ui 31/8): på IDAG står kalenderknappen där
 * bakåtpilen annars står och öppnar månadskalendern - trycket växlar också
 * till dagläge, och ett valt datum blir den dagen (passerade dygn går inte
 * att välja; kalendern slutar där appflödet slutar - flödets `days`, se
 * maxOffset). Har man
 * bytt dag är knappen i stället ↺ rakt ovanför bakåtpilen, som tar en till
 * HEMMADAGEN (Imorgon om idag är slut i rutan, annars Idag) och göms när
 * man redan står där (24/9). Vill man till ett annat datum nollställer man
 * först - kalendern finns på idag-läget.
 */
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { dagStart, offsetFörDatum, periodLabel } from '@/lib/dagar';
import { NYCKEL, useLagrad } from '@/lib/lagring';

export function DagValjare({
    offset,
    längd,
    antalDag,
    antalVecka,
    hemmadag,
    onOffset,
    onLängd,
    onSkapa,
    maxOffset,
}: {
    offset: number;
    längd: 1 | 7;
    /** null = rutan inte känd än ("…"). */
    antalDag: number | null;
    antalVecka: number | null;
    hemmadag: number;
    onOffset: (o: number) => void;
    onLängd: (l: 1 | 7) => void;
    /** Skapa-knappen (+) bor vid väljaren sedan 7/10 kväll - spegelbilden av ↺. */
    onSkapa: () => void;
    /** Sista dagen väljaren når - flödets horisont (lib/dagar horisontOffset). */
    maxOffset: number;
}) {
    const [hintKlar, setHintKlar, hintLaddad] = useLagrad(NYCKEL.växlaHintKlar, false);
    const kvittera = () => { if (!hintKlar) setHintKlar(true); };

    // Kalendern: iOS får månadsvyn (inline) i en ruta över kartan, Android
    // sin egen datumdialog. Pickern står på den visade dagen.
    const [kalenderÖppen, setKalenderÖppen] = useState(false);
    const väljDatum = (d: Date) => {
        const o = offsetFörDatum(d, maxOffset);
        if (o === null) return; // passerat eller bortom horisonten - välj om
        setKalenderÖppen(false);
        onLängd(1);
        onOffset(o);
    };
    const öppnaKalender = () => {
        kvittera();
        // Kalenderklicket ger dagläget direkt (webben: "hoppar samtidigt hem
        // till idag" - knappen finns bara på idag, så dagen står redan rätt).
        if (längd !== 1) onLängd(1);
        const nu = new Date();
        if (Platform.OS === 'android') {
            DateTimePickerAndroid.open({
                value: dagStart(nu, offset),
                mode: 'date',
                minimumDate: dagStart(nu, 0),
                maximumDate: dagStart(nu, maxOffset),
                onChange: (ev, d) => { if (ev.type === 'set' && d) väljDatum(d); },
            });
            return;
        }
        setKalenderÖppen(true);
    };

    return (
        <View style={styles.yta} pointerEvents="box-none">
            {hintLaddad && !hintKlar ? (
                <View style={styles.växlaPill}>
                    <Text style={styles.växlaText}>TRYCK FÖR ATT VÄXLA</Text>
                </View>
            ) : null}
            <View style={styles.rad}>
                {offset > 0 && offset !== hemmadag ? (
                    <Pressable
                        style={styles.nollKnapp}
                        onPress={() => { kvittera(); onOffset(hemmadag); }}
                        accessibilityLabel={hemmadag === 0 ? 'Till idag' : 'Till imorgon'}
                    >
                        <Text style={styles.nollText}>↺</Text>
                    </Pressable>
                ) : null}
                {/* + på motsvarande sida som ↺ (ägarbeslut 7/10 kväll:
                    "ovanför åt höger om dagsväljaren"). Blå med gul kant,
                    still - skapa-knappen pulserar inte (29/9). */}
                <Pressable style={styles.skapaKnapp} onPress={onSkapa} accessibilityLabel="Skapa event">
                    <Text style={styles.skapaText}>＋</Text>
                </Pressable>
                <View style={styles.platta}>
                    {offset === 0 ? (
                        <Pressable
                            onPress={öppnaKalender}
                            hitSlop={8}
                            style={[styles.pil, styles.kalender, kalenderÖppen && styles.kalenderÖppen]}
                            accessibilityLabel="Välj datum i kalendern"
                        >
                            <KalenderIkon färg={kalenderÖppen ? '#0f172a' : '#ffffff'} />
                        </Pressable>
                    ) : (
                        <Pressable
                            onPress={() => { kvittera(); onOffset(Math.max(0, offset - 1)); }}
                            hitSlop={8}
                            style={styles.pil}
                            accessibilityLabel="Föregående dag"
                        >
                            <Text style={styles.pilText}>‹</Text>
                        </Pressable>
                    )}
                    <Pressable style={styles.radKolumn} onPress={() => { kvittera(); onLängd(längd === 1 ? 7 : 1); }}>
                        {([1, 7] as const).map(l => {
                            const vald = längd === l;
                            const antal = l === 1 ? antalDag : antalVecka;
                            return (
                                <View key={l} style={[styles.periodRad, vald && styles.periodRadVald]}>
                                    <Text style={[styles.radText, vald && styles.radTextVald]}>
                                        {periodLabel(offset, l).toUpperCase()}
                                    </Text>
                                    <Text style={[styles.radAntal, vald && styles.radTextVald]}>{antal ?? '…'}</Text>
                                </View>
                            );
                        })}
                    </Pressable>
                    <Pressable
                        onPress={() => { kvittera(); onOffset(Math.min(maxOffset, offset + 1)); }}
                        disabled={offset >= maxOffset}
                        hitSlop={8}
                        style={[styles.pil, offset >= maxOffset && styles.pilDimmad]}
                        accessibilityLabel="Nästa dag"
                    >
                        <Text style={styles.pilText}>›</Text>
                    </Pressable>
                </View>
            </View>
            {Platform.OS === 'ios' ? (
                <Modal visible={kalenderÖppen} transparent animationType="fade" onRequestClose={() => setKalenderÖppen(false)}>
                    <Pressable style={styles.kalenderBakgrund} onPress={() => setKalenderÖppen(false)} accessibilityLabel="Stäng kalendern">
                        {/* Rutan sväljer sina egna tryck - bara utanför stänger. */}
                        <Pressable style={styles.kalenderRuta} onPress={() => {}}>
                            <Text style={styles.kalenderRubrik}>Välj dag</Text>
                            <DateTimePicker
                                value={dagStart(new Date(), offset)}
                                mode="date"
                                display="inline"
                                locale="sv-SE"
                                minimumDate={dagStart(new Date(), 0)}
                                maximumDate={dagStart(new Date(), maxOffset)}
                                themeVariant="light"
                                accentColor="#006AA7"
                                onChange={(ev, d) => { if (ev.type === 'set' && d) väljDatum(d); }}
                            />
                            <Pressable style={styles.kalenderStäng} onPress={() => setKalenderÖppen(false)}>
                                <Text style={styles.kalenderStängText}>Stäng</Text>
                            </Pressable>
                        </Pressable>
                    </Pressable>
                </Modal>
            ) : null}
        </View>
    );
}

/**
 * Lucides CalendarDays ritad med vyer (som PersonPlus i RsvpFooter - appen
 * har inget ikonbibliotek): ram, två upphängningar, skiljelinje, dagprickar.
 */
function KalenderIkon({ färg }: { färg: string }) {
    return (
        <View style={ikon.ram} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <View style={[ikon.kropp, { borderColor: färg }]} />
            <View style={[ikon.ögla, { left: 4, backgroundColor: färg }]} />
            <View style={[ikon.ögla, { right: 4, backgroundColor: färg }]} />
            <View style={[ikon.linje, { backgroundColor: färg }]} />
            {[0, 1, 2].map(k => [0, 1].map(r => (
                <View key={`${k}${r}`} style={[ikon.prick, { left: 4.5 + k * 4, top: 10.5 + r * 3.5, backgroundColor: färg }]} />
            )))}
        </View>
    );
}

const ikon = StyleSheet.create({
    // Ritad i 20 pt, skalad till den större cirkeln (56 pt sedan 29/10).
    ram: { width: 20, height: 20, transform: [{ scale: 1.25 }] },
    kropp: { position: 'absolute', left: 1, top: 3, width: 18, height: 16, borderRadius: 3.5, borderWidth: 2 },
    ögla: { position: 'absolute', top: 0.5, width: 2, height: 5, borderRadius: 1 },
    linje: { position: 'absolute', left: 1, top: 7.5, width: 18, height: 2 },
    prick: { position: 'absolute', width: 2.5, height: 2.5, borderRadius: 1.25 },
});

const MÖRK = 'rgba(36,42,51,0.92)';
/** Sidoknapparna = webbens h-14 w-14-cirklar (56 px). Josef 29/10: "den ska
 *  vara mer rund på sidorna ... sidoknapparna ska vara lite större som på
 *  webben", och + och ↺ "följdaktligen lika stora". */
const KNAPP = 56;
/** Plattans insats runt pilarna. Plattan är KNAPP + 2 * INSATS hög och helt
 *  rund, så pilcirklarna blir koncentriska med plattans ändar. */
const INSATS = 4;
/** Luft mellan + / ↺ och plattan under. */
const KNAPP_LUFT = 10;

const styles = StyleSheet.create({
    yta: { position: 'absolute', left: 0, right: 0, bottom: 72, alignItems: 'center', gap: 6 },
    växlaPill: { backgroundColor: MÖRK, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
    växlaText: { fontSize: 10, fontWeight: '700', color: '#e2e8f0', letterSpacing: 1.2 },
    rad: { flexDirection: 'row', alignItems: 'center' },
    nollKnapp: {
        position: 'absolute',
        left: INSATS,
        top: -(KNAPP + KNAPP_LUFT),
        width: KNAPP,
        height: KNAPP,
        borderRadius: KNAPP / 2,
        backgroundColor: MÖRK,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 5,
    },
    nollText: { fontSize: 24, color: '#ffffff', fontWeight: '700' },
    skapaKnapp: {
        position: 'absolute',
        right: INSATS,
        top: -(KNAPP + KNAPP_LUFT),
        width: KNAPP,
        height: KNAPP,
        borderRadius: KNAPP / 2,
        backgroundColor: '#0077BC',
        borderWidth: 2,
        borderColor: '#f0b429',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 5,
    },
    skapaText: { fontSize: 28, fontWeight: '700', color: '#ffffff', marginTop: -2 },
    platta: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: MÖRK,
        borderRadius: 999,
        padding: INSATS,
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 6,
    },
    /** Pilarna är ÄKTA CIRKLAR med synlig platta - webbens dagpilar
     *  (bg-white/10, kart-ui 1/9: "lika hög som bred"), så rundningen syns. */
    pil: {
        width: KNAPP,
        height: KNAPP,
        borderRadius: KNAPP / 2,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    pilDimmad: { opacity: 0.35 },
    /** Webbens kalenderknapp: bg-white/15, VIT när kalendern är öppen. */
    kalender: { backgroundColor: 'rgba(255,255,255,0.15)' },
    kalenderÖppen: { backgroundColor: '#ffffff' },
    kalenderBakgrund: {
        flex: 1,
        backgroundColor: 'rgba(15,23,42,0.45)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
    },
    kalenderRuta: {
        width: '100%',
        maxWidth: 380,
        backgroundColor: '#ffffff',
        borderRadius: 24,
        paddingHorizontal: 12,
        paddingTop: 16,
        paddingBottom: 12,
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
        elevation: 12,
    },
    kalenderRubrik: { fontSize: 16, fontWeight: '900', color: '#0f172a', paddingHorizontal: 8, marginBottom: 4 },
    kalenderStäng: { alignSelf: 'center', marginTop: 4, paddingHorizontal: 20, paddingVertical: 10 },
    kalenderStängText: { fontSize: 15, fontWeight: '800', color: '#006AA7' },
    pilText: { fontSize: 30, fontWeight: '700', color: '#ffffff', marginTop: -3 },
    radKolumn: { minWidth: 210, gap: 2 },
    periodRad: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: 999,
        paddingHorizontal: 14,
        // 4 (inte 5): de två raderna ska rymmas i pilcirkelns höjd, annars
        // blir plattan högre än KNAPP + 2 * INSATS och ändarna ovala.
        paddingVertical: 4,
    },
    periodRadVald: { backgroundColor: '#ffffff' },
    radText: { fontSize: 13, fontWeight: '800', color: 'rgba(255,255,255,0.85)', letterSpacing: 1 },
    radTextVald: { color: '#0f172a' },
    radAntal: { fontSize: 15, fontWeight: '800', color: 'rgba(255,255,255,0.85)', marginLeft: 12 },
});
