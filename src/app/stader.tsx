/**
 * Städer (modal från stadsplattan) - listan in till stadssidorna
 * (/stad/<slug>), appens motsvarighet till webbens /evenemang med
 * STADSTOPPLISTAN (CityLeaderboard): varje rad visar idag (i helgen i
 * helgsorteringen), i veckan och totalt, och valen sorterar på samma
 * kolumner. A-Ö byter platssiffran mot bokstavsavdelare. Inga
 * besökssiffror (ägarbeslut 29/8). Logiken bor i lib/stadsTopplista,
 * siffrorna räknas ur länsflödena i api/stadsAntal - hämtas först här.
 *
 * Manuellt kartval görs på stadssidan ("Se alla event på kartan") och vinner
 * över GPS tills det nollställs (RegionProvider). Stadslistan är kontraktets
 * CITIES - samma lista som regionvalet och scraperns flödesbygge.
 */
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { CITIES, type City } from '@vadkul/kontrakt';
import { useStadsAntal } from '@/api/stadsAntal';
import { useRegionVal } from '@/lib/regionContext';
import { useModalTopp } from '@/lib/useModalTopp';
import {
    bokstavsAvdelare,
    topplistRader,
    TOPPLIST_SORTERINGAR,
    type TopplistSortering,
} from '@/lib/stadsTopplista';

const BLÅ = '#006AA7';

export default function StaderScreen() {
    const { city, manuell, fromGps, valdStartstad, tillGpsStad } = useRegionVal();
    const [filter, setFilter] = useState('');
    const [sortering, setSortering] = useState<TopplistSortering>('totalt');
    const { antal } = useStadsAntal();
    const modalTopp = useModalTopp();

    const rader = useMemo(() => topplistRader(CITIES, antal, sortering), [antal, sortering]);
    const q = filter.toLowerCase().trim();
    // Platssiffran är placeringen i HELA listan, även när namnfiltret är på.
    const synliga = useMemo(
        () => rader.map((r, i) => ({ r, i })).filter(({ r }) => !q || r.stad.name.toLowerCase().includes(q)),
        [rader, q],
    );
    // A-Ö-avdelarna räknas på det som SYNS, annars tappar en filtrerad lista sina bokstäver.
    const synligaRader = useMemo(() => synliga.map(x => x.r), [synliga]);

    const välj = (c: City) => {
        router.push(`/stad/${c.slug}`);
    };

    return (
        <View style={[styles.root, { paddingTop: modalTopp }]}>
            <View style={styles.huvud}>
                <View style={styles.huvudText}>
                    <Text style={styles.rubrik}>Städer</Text>
                    <Text style={styles.underRubrik}>
                        Kartans stad: {city.name}{fromGps ? ' (via din plats)' : ''}
                    </Text>
                </View>
                <Pressable onPress={() => router.back()} hitSlop={12} style={styles.stangKnapp} accessibilityLabel="Stäng">
                    <Text style={styles.stangText}>✕</Text>
                </Pressable>
            </View>
            <TextInput
                style={styles.falt}
                placeholder="Filtrera städer …"
                placeholderTextColor="#94a3b8"
                value={filter}
                onChangeText={setFilter}
                autoCorrect={false}
                clearButtonMode="while-editing"
            />
            {manuell || (valdStartstad !== null && !fromGps) ? (
                <Pressable style={({ pressed }) => [styles.gpsKnapp, pressed && styles.tryckt]} onPress={tillGpsStad}>
                    <Text style={styles.gpsText}>📡 Återgå till min plats</Text>
                </Pressable>
            ) : null}
            <View>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={styles.sortRad}
                >
                    {TOPPLIST_SORTERINGAR.map(s => {
                        const vald = s.key === sortering;
                        return (
                            <Pressable
                                key={s.key}
                                onPress={() => setSortering(s.key)}
                                accessibilityRole="button"
                                accessibilityState={{ selected: vald }}
                                style={({ pressed }) => [styles.sortChip, vald && styles.sortChipVald, pressed && styles.tryckt]}
                            >
                                <Text style={[styles.sortText, vald && styles.sortTextVald]}>{s.label}</Text>
                            </Pressable>
                        );
                    })}
                </ScrollView>
            </View>
            <FlatList
                data={synliga}
                keyExtractor={({ r }) => r.stad.slug}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                contentContainerStyle={styles.lista}
                renderItem={({ item: { r, i }, index }) => {
                    const vald = r.stad.slug === city.slug;
                    const plats = sortering === 'namn' ? bokstavsAvdelare(synligaRader, index) : String(i + 1);
                    return (
                        <Pressable
                            style={({ pressed }) => [styles.rad, pressed && styles.tryckt]}
                            onPress={() => välj(r.stad)}
                        >
                            <Text style={[styles.plats, (sortering === 'namn' || i < 3) && styles.platsTopp]}>{plats}</Text>
                            <Text style={[styles.radNamn, vald && styles.radNamnVald]} numberOfLines={1}>
                                {r.stad.name}{vald ? ' ✓' : ''}
                            </Text>
                            {sortering === 'helgen'
                                ? <Siffra värde={r.helgen} etikett="i helgen" aktiv />
                                : <Siffra värde={r.idag} etikett="idag" aktiv={sortering === 'idag'} />}
                            <Siffra värde={r.veckan} etikett="i veckan" aktiv={sortering === 'veckan'} />
                            <Siffra värde={r.totalt} etikett="totalt" aktiv={sortering === 'totalt'} />
                        </Pressable>
                    );
                }}
            />
        </View>
    );
}

/** Sifferrutan: aktiv sorteringskolumn i blått, annars syns inte vilket tal listan följer. */
function Siffra({ värde, etikett, aktiv }: { värde: number | null; etikett: string; aktiv: boolean }) {
    return (
        <View style={styles.siffra}>
            <Text style={[styles.siffraVärde, !värde && styles.siffraNoll, aktiv && styles.aktiv]}>
                {värde === null ? '-' : värde}
            </Text>
            <Text style={[styles.siffraEtikett, aktiv && styles.aktivEtikett]}>{etikett.toUpperCase()}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#f8fafc', paddingTop: 24 },
    huvud: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16 },
    huvudText: { flex: 1 },
    stangKnapp: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#e2e8f0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    stangText: { fontSize: 13, fontWeight: '700', color: '#475569' },
    rubrik: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
    underRubrik: { marginTop: 4, fontSize: 13, color: '#475569' },
    falt: {
        margin: 16,
        marginBottom: 8,
        backgroundColor: '#ffffff',
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        color: '#0f172a',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    gpsKnapp: {
        marginHorizontal: 16,
        marginBottom: 8,
        backgroundColor: '#e0f2fe',
        borderRadius: 14,
        paddingVertical: 10,
        alignItems: 'center',
    },
    gpsText: { fontSize: 14, fontWeight: '700', color: '#0369a1' },
    sortRad: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
    sortChip: {
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        backgroundColor: '#ffffff',
        paddingHorizontal: 13,
        paddingVertical: 7,
    },
    sortChipVald: { backgroundColor: BLÅ, borderColor: BLÅ },
    sortText: { fontSize: 12, fontWeight: '900', color: '#475569' },
    sortTextVald: { color: '#ffffff' },
    lista: { paddingBottom: 32 },
    rad: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#ffffff',
        marginHorizontal: 16,
        marginVertical: 3,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    tryckt: { opacity: 0.7 },
    plats: { width: 24, textAlign: 'right', fontSize: 15, fontWeight: '900', color: '#cbd5e1' },
    platsTopp: { color: BLÅ },
    radNamn: { flex: 1, fontSize: 15, fontWeight: '700', color: '#0f172a' },
    radNamnVald: { fontWeight: '900', color: '#059669' },
    siffra: { width: 50, alignItems: 'flex-end' },
    siffraVärde: { fontSize: 14, fontWeight: '900', color: '#0f172a', fontVariant: ['tabular-nums'] },
    siffraNoll: { color: '#cbd5e1' },
    siffraEtikett: { fontSize: 8, fontWeight: '700', letterSpacing: 0.4, color: '#94a3b8' },
    aktiv: { color: BLÅ },
    aktivEtikett: { color: 'rgba(0,106,167,0.7)' },
});
