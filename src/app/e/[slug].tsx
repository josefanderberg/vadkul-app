/**
 * vadkul.se/e/<slug> i appen - delade event, Bjud med-inbjudningar
 * (?inb=1&fran=<uid>) och påminnelsernas notislänk. Sluggen slås upp
 * (api/djuplank) och kartan tar över med eventet öppet - webbens MapRedirect,
 * fast inbjudningens parametrar följer med till kortets banner.
 * Okänd slug = webbens "Eventet har flugit vidare".
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { slåUppSlug } from '@/api/djuplank';

export default function Delningslänk() {
    const { slug, inb, fran } = useLocalSearchParams<{ slug: string; inb?: string; fran?: string }>();
    const [borta, setBorta] = useState(false);

    useEffect(() => {
        let aktiv = true;
        slåUppSlug(slug)
            .then(id => {
                if (!aktiv) return;
                if (!id) { setBorta(true); return; }
                router.replace({ pathname: '/', params: { event: id, ...(inb ? { inb } : {}), ...(fran ? { fran } : {}) } });
            })
            .catch(() => { if (aktiv) setBorta(true); });
        return () => { aktiv = false; };
    }, [slug, inb, fran]);

    return (
        <View style={styles.root}>
            {borta ? (
                <>
                    <Text style={styles.moln}>☁️</Text>
                    <Text style={styles.rubrik}>Eventet har flugit vidare</Text>
                    <Text style={styles.text}>
                        Länken pekar på ett event som inte längre finns kvar - men kartan är full av annat kul.
                    </Text>
                    <Pressable style={({ pressed }) => [styles.knapp, pressed && styles.tryckt]} onPress={() => router.replace('/')}>
                        <Text style={styles.knappText}>Se vad som händer nära dig</Text>
                    </Pressable>
                </>
            ) : (
                <ActivityIndicator color="#006AA7" />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center', padding: 24 },
    moln: { fontSize: 48 },
    rubrik: { marginTop: 14, fontSize: 20, fontWeight: '900', color: '#006AA7', textAlign: 'center' },
    text: { marginTop: 8, fontSize: 14, fontWeight: '500', color: '#475569', textAlign: 'center' },
    knapp: { marginTop: 20, borderRadius: 16, backgroundColor: '#006AA7', paddingHorizontal: 22, paddingVertical: 13 },
    knappText: { color: '#ffffff', fontSize: 14, fontWeight: '900' },
    tryckt: { opacity: 0.85 },
});
