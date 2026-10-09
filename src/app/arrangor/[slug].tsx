/**
 * Arrangörssidan - appens motsvarighet till webbens /arrangor/<slug>
 * (ägarbeslut 29/9): arrangörens kommande event i HELA landet, dag för dag,
 * med hemorterna och webbplatsen överst. Datat kommer från webbens
 * /api/arrangor (samma urval som sidan - appflödet är per län och saknar
 * värdnamn). Nås via universella länkar, "Alla event från {namn}" i
 * eventkortet och notislänkar.
 */
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { CITIES, type AppFeedEvent } from '@vadkul/kontrakt';
import { useArrangör } from '@/api/djuplank';
import { EventKort } from '@/components/EventKort';
import { EventRad } from '@/components/EventRad';
import { isEventPast } from '@/lib/harVarit';
import { useRegionVal } from '@/lib/regionContext';
import { grupperaPerDag } from '@/lib/stadsUtbud';

/** Hur många dagar framåt listan visar - arrangörer har ofta glesa program. */
const DAGAR = 60;

export default function ArrangörScreen() {
    const { slug } = useLocalSearchParams<{ slug: string }>();
    const q = useArrangör(slug);
    const { väljStad } = useRegionVal();
    const [valt, setValt] = useState<AppFeedEvent | null>(null);

    const kommande = useMemo(() => {
        const nu = Date.now();
        return (q.data?.events ?? []).filter(e => !isEventPast(e, nu));
    }, [q.data]);
    const sektioner = useMemo(() => grupperaPerDag(kommande, new Date(), DAGAR), [kommande]);

    const a = q.data;
    const hemstad = a?.cities[0] ? CITIES.find(c => c.slug === a.cities[0].slug) ?? null : null;
    const visaPåKartan = () => {
        if (hemstad) väljStad(hemstad);
        router.dismissTo('/');
    };

    return (
        <View style={styles.root}>
            <View style={styles.huvud}>
                <View style={styles.huvudText}>
                    <Text style={styles.etikett}>ARRANGÖR</Text>
                    <Text style={styles.rubrik}>{a?.name ?? (q.isLoading ? ' ' : 'Okänd arrangör')}</Text>
                    {a ? (
                        <Text style={styles.underRubrik}>
                            {kommande.length === 1 ? '1 kommande event' : `${kommande.length} kommande event`}
                            {a.cities.length ? ` · ${a.cities.map(c => c.name).join(', ')}` : ''}
                        </Text>
                    ) : null}
                </View>
                <Pressable onPress={() => router.back()} hitSlop={12} style={styles.stang} accessibilityLabel="Tillbaka">
                    <Text style={styles.stangText}>✕</Text>
                </Pressable>
            </View>
            {a ? (
                <View style={styles.knappRad}>
                    {hemstad ? (
                        <Pressable style={({ pressed }) => [styles.kartKnapp, pressed && styles.tryckt]} onPress={visaPåKartan}>
                            <Text style={styles.kartKnappText}>🗺️ Visa {hemstad.name} på kartan</Text>
                        </Pressable>
                    ) : null}
                    {a.domains[0] ? (
                        <Pressable
                            style={({ pressed }) => [styles.webbKnapp, pressed && styles.tryckt]}
                            onPress={() => WebBrowser.openBrowserAsync(`https://${a.domains[0]}`)}
                        >
                            <Text style={styles.webbText}>Webbplats</Text>
                        </Pressable>
                    ) : null}
                </View>
            ) : null}
            {q.isLoading ? (
                <ActivityIndicator style={styles.laddar} color="#006AA7" />
            ) : (
                <SectionList
                    sections={sektioner}
                    keyExtractor={e => e.id}
                    stickySectionHeadersEnabled
                    ListEmptyComponent={
                        <Text style={styles.tomt}>
                            {q.isError
                                ? 'Kunde inte hämta arrangören - kolla nätet och försök igen.'
                                : a ? `${a.name} har inga kommande event just nu.` : 'Arrangören har inga kommande event på VADKUL.'}
                        </Text>
                    }
                    renderSectionHeader={({ section }) => <Text style={styles.dagRubrik}>{section.label}</Text>}
                    renderItem={({ item }) => <EventRad event={item} onPress={() => setValt(item)} />}
                    contentContainerStyle={styles.lista}
                />
            )}
            {/* flöde = arrangörens event - kortets arrangörsrad byter event på
                plats (samma mönster som stadssidan). */}
            {valt ? (
                <EventKort
                    event={valt}
                    grupp={[valt]}
                    flöde={kommande}
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
    etikett: { fontSize: 11, fontWeight: '900', color: '#64748b', letterSpacing: 1 },
    rubrik: { marginTop: 2, fontSize: 24, fontWeight: '800', color: '#0f172a' },
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
    webbKnapp: { borderRadius: 999, backgroundColor: '#e2e8f0', paddingVertical: 11, paddingHorizontal: 16, alignItems: 'center' },
    webbText: { color: '#0f172a', fontSize: 14, fontWeight: '700' },
    tryckt: { opacity: 0.75 },
    laddar: { marginTop: 40 },
    lista: { paddingBottom: 48 },
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
});
