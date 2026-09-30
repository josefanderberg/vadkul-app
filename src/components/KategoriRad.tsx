/**
 * Kategoriraden - webbens CategoryChipRow (sökpanelen sedan 16/9): 🔥 Populära
 * FÖRST (ägarbeslut 24/9, ersatte hörnknappen), sedan kategorierna med event
 * (flest först, Övrigt sist, den valda även på noll) och FLER längst till
 * höger som fäller ut Svenska kyrkan/PRO/Korpen. Raden rullar i sidled.
 * Siffrorna = "vad visas om jag trycker här" (lib/kartFilter).
 */
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { EVENT_CATEGORY_KEYS, type AppFeedEvent, type EventCategoryType } from '@vadkul/kontrakt';
import {
    planeraKategoriChips,
    räknaKategorier,
    räknaKällor,
    räknaPopulära,
    synligaKällor,
} from '@/lib/kartFilter';
import { useFilter } from '@/lib/filterContext';
import { kategoriFor } from '@/lib/kategorier';

export function KategoriRad({ events }: { events: readonly AppFeedEvent[] }) {
    const f = useFilter();
    const [flerÖppen, setFlerÖppen] = useState(f.källa !== null);

    const chips = planeraKategoriChips(EVENT_CATEGORY_KEYS, räknaKategorier(events, f), f.kategori);
    const antalPop = räknaPopulära(events, f);
    const källAntal = räknaKällor(events);
    const källor = synligaKällor(källAntal, f.källa);

    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.rad}
        >
            <Chip vald={f.populärt} onPress={f.växlaPopulärt} text={`🔥 Populära · ${antalPop}`} />
            {chips.map(c => {
                const k = kategoriFor(c.key);
                return (
                    <Chip
                        key={c.key}
                        vald={f.kategori === c.key}
                        onPress={() => f.växlaKategori(c.key as EventCategoryType)}
                        text={`${k.emoji} ${k.label} · ${c.count}`}
                    />
                );
            })}
            {källor.length > 0 ? (
                <Chip vald={flerÖppen || f.källa !== null} onPress={() => setFlerÖppen(o => !o)} text={flerÖppen ? 'FLER ‹' : 'FLER ›'} />
            ) : null}
            {flerÖppen
                ? källor.map(k => (
                    <Chip
                        key={k.key}
                        vald={f.källa === k.key}
                        onPress={() => f.växlaKälla(k.key)}
                        text={`${k.emoji} ${k.label} · ${källAntal.get(k.key) ?? 0}`}
                    />
                ))
                : null}
        </ScrollView>
    );
}

function Chip({ text, vald, onPress }: { text: string; vald: boolean; onPress: () => void }) {
    return (
        <Pressable onPress={onPress} style={({ pressed }) => [styles.chip, vald && styles.chipVald, pressed && styles.tryckt]}>
            <Text style={[styles.chipText, vald && styles.chipTextVald]}>{text}</Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    rad: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
    chip: {
        borderRadius: 999,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        paddingHorizontal: 12,
        paddingVertical: 7,
    },
    chipVald: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
    tryckt: { opacity: 0.75 },
    chipText: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
    chipTextVald: { color: '#ffffff' },
});
