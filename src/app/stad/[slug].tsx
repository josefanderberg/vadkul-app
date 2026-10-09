/**
 * Stadssidan - appens motsvarighet till webbens /evenemang/<stad>: ortens
 * event (<= 10 km, inte länets - ägarbeslutet 7/9) dag för dag i 14 dagar.
 * Samma kategorirad och filter som kartan (kyrkan/PRO/Korpen via FLER), bara
 * event som inte varit (webbens freshDays). "Visa på kartan" lägger staden
 * på kartan; "Saknar du något?" är webbens önska/skapa-pitch.
 */
import { useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { CITIES, type AppFeedEvent } from '@vadkul/kontrakt';
import { useEvent } from '@/api/useEvent';
import { EventKort } from '@/components/EventKort';
import { EventRad } from '@/components/EventRad';
import { KategoriRad } from '@/components/KategoriRad';
import { useFilter } from '@/lib/filterContext';
import { isEventPast } from '@/lib/harVarit';
import { matcharFilter } from '@/lib/kartFilter';
import { useRegionVal } from '@/lib/regionContext';
import { grupperaPerDag, stadensEvent } from '@/lib/stadsUtbud';

export default function StadScreen() {
    const { slug } = useLocalSearchParams<{ slug: string }>();
    const stad = CITIES.find(c => c.slug === slug);
    const { väljStad } = useRegionVal();
    const filter = useFilter();
    const feed = useEvent(stad?.region ?? '');
    const [valt, setValt] = useState<AppFeedEvent | null>(null);

    const iOrten = useMemo(() => {
        if (!stad) return [];
        const nu = Date.now();
        return stadensEvent(feed.data ?? [], stad).filter(e => !isEventPast(e, nu));
    }, [feed.data, stad]);
    const synliga = useMemo(() => iOrten.filter(e => matcharFilter(e, filter)), [iOrten, filter]);
    const sektioner = useMemo(() => grupperaPerDag(synliga), [synliga]);

    if (!stad) {
        return (
            <View style={styles.root}>
                <Text style={styles.rubrik}>Okänd stad</Text>
            </View>
        );
    }

    const visaPåKartan = () => {
        väljStad(stad);
        router.dismissTo('/');
    };
    const pitch = (vad: 'onska' | 'skapa') =>
        WebBrowser.openBrowserAsync(`https://vadkul.se/?plats=${stad.lat},${stad.lng},13&${vad}=1`);

    return (
        <View style={styles.root}>
            <View style={styles.huvud}>
                <View style={styles.huvudText}>
                    <Text style={styles.rubrik}>Evenemang i {stad.name}</Text>
                    <Text style={styles.underRubrik}>
                        {feed.isLoading ? 'Hämtar event …' : `${synliga.length} event i orten · 14 dagar`}
                    </Text>
                </View>
                <Pressable onPress={() => router.back()} hitSlop={12} style={styles.stang} accessibilityLabel="Tillbaka">
                    <Text style={styles.stangText}>✕</Text>
                </Pressable>
            </View>
            <View style={styles.knappRad}>
                <Pressable style={({ pressed }) => [styles.kartKnapp, pressed && styles.tryckt]} onPress={visaPåKartan}>
                    <Text style={styles.kartKnappText}>🗺️ Visa på kartan</Text>
                </Pressable>
                <Pressable style={({ pressed }) => [styles.städerKnapp, pressed && styles.tryckt]} onPress={() => router.push('/stader')}>
                    <Text style={styles.städerText}>Alla städer</Text>
                </Pressable>
            </View>
            <View>
                <KategoriRad events={iOrten} />
            </View>
            <SectionList
                sections={sektioner}
                keyExtractor={e => e.id}
                stickySectionHeadersEnabled
                ListEmptyComponent={
                    feed.isLoading ? null : (
                        <Text style={styles.tomt}>
                            {filter.aktivt
                                ? `Inget med filtret som är på i ${stad.name} de närmaste 14 dagarna.`
                                : `Inga event i ${stad.name} de närmaste 14 dagarna.`}
                        </Text>
                    )
                }
                ListFooterComponent={
                    <View style={styles.pitch}>
                        <Text style={styles.pitchRubrik}>Saknar du något i {stad.name}?</Text>
                        <Text style={styles.pitchText}>Önska ett event - eller skapa det själv.</Text>
                        <View style={styles.pitchKnappar}>
                            <Pressable style={styles.pitchKnapp} onPress={() => pitch('onska')}>
                                <Text style={styles.pitchKnappText}>✨ Önska</Text>
                            </Pressable>
                            <Pressable style={[styles.pitchKnapp, styles.skapaKnapp]} onPress={() => pitch('skapa')}>
                                <Text style={[styles.pitchKnappText, styles.skapaText]}>＋ Skapa event</Text>
                            </Pressable>
                        </View>
                    </View>
                }
                renderSectionHeader={({ section }) => <Text style={styles.dagRubrik}>{section.label}</Text>}
                renderItem={({ item }) => <EventRad event={item} onPress={() => setValt(item)} />}
            />
            {/* flöde = ortens event för arrangörsraden; ingen stad-länk (man
                är redan här) och ingen lista (sidan ÄR listan). Raden byter
                event via onVäljIGrupp - samma kort, nytt val. */}
            {valt ? (
                <EventKort
                    event={valt}
                    grupp={[valt]}
                    flöde={iOrten}
                    onVäljIGrupp={e => setValt(e)}
                    onClose={() => setValt(null)}
                />
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#f8fafc', paddingTop: 64 },
    huvud: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16 },
    huvudText: { flex: 1 },
    rubrik: { fontSize: 24, fontWeight: '800', color: '#0f172a' },
    underRubrik: { marginTop: 2, fontSize: 13, color: '#475569' },
    stang: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#e2e8f0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    stangText: { fontSize: 13, fontWeight: '700', color: '#475569' },
    knappRad: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginTop: 14 },
    kartKnapp: { flex: 1, borderRadius: 999, backgroundColor: '#0f172a', paddingVertical: 11, alignItems: 'center' },
    kartKnappText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
    städerKnapp: { borderRadius: 999, backgroundColor: '#e2e8f0', paddingVertical: 11, paddingHorizontal: 16, alignItems: 'center' },
    städerText: { color: '#0f172a', fontSize: 14, fontWeight: '700' },
    tryckt: { opacity: 0.75 },
    tomt: { textAlign: 'center', color: '#64748b', marginTop: 32, paddingHorizontal: 24, fontSize: 14 },
    dagRubrik: {
        backgroundColor: '#f8fafc',
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 6,
        fontSize: 13,
        fontWeight: '800',
        color: '#334155',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
    pitch: { margin: 16, marginBottom: 48, padding: 16, borderRadius: 18, backgroundColor: '#eef2ff', alignItems: 'center' },
    pitchRubrik: { fontSize: 16, fontWeight: '800', color: '#1e1b4b' },
    pitchText: { marginTop: 4, fontSize: 13, color: '#4338ca' },
    pitchKnappar: { flexDirection: 'row', gap: 8, marginTop: 12 },
    pitchKnapp: { borderRadius: 999, backgroundColor: '#ffffff', paddingHorizontal: 16, paddingVertical: 9 },
    pitchKnappText: { fontSize: 14, fontWeight: '800', color: '#312e81' },
    skapaKnapp: { backgroundColor: '#1d4ed8', borderWidth: 2, borderColor: '#FECC02' },
    skapaText: { color: '#ffffff' },
});
