/**
 * Kommer/Intresserad-footern - webbens EventRsvpFooter (ägarbeslut 6/10,
 * spår 3: "kommer och intresserad, de kan vara längst ner som en footer"):
 * fast platta i botten när ett event är valt, med Kommer/Intresserad
 * (ömsesidigt uteslutande, lib/rsvp), Bjud med och ANMÄL/BOKA-pillret
 * (flyttat hit 7/10 - guld för Ticketmaster; stora CTA:n i kortet står kvar).
 *
 *  - BJUD MED sätter Kommer på en själv ("man visar att man kommer när man
 *    delar den") och delar /e/<slug>?inb=1 - mottagaren svarar på WEBBEN
 *    (bannern "undrar om du följer med"); appen tar inte emot /e/-länkar än
 *    (AASA/assetlinks är kvar i fas 2). &fran= utelämnas tills kontona är
 *    kopplade - utan uid finns ingen avsändare att slå upp.
 *  - Webbens avatarrad och räknare kräver Firestore/API och utelämnas
 *    (se lib/rsvp) - knapparna visar bara det egna svaret.
 *  - Pinnas mot SKÄRMENS botten av EventKorts footerHållare (arket ritas i
 *    takets höjd och skjuts ner, så arkets egen botten ligger under
 *    skärmkanten på de lägre stoppen - hållaren counter-translaterar).
 */
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import type { AppFeedEvent } from '@vadkul/kontrakt';
import { useRsvp } from '@/lib/rsvpContext';
import type { RsvpStatus } from '@/lib/rsvp';

export function RsvpFooter({
    event,
    delningsUrl,
    /** ANMÄL/BOKA-pillret - null när eventet saknar utlänk. */
    cta,
}: {
    event: AppFeedEvent;
    /** https://vadkul.se/e/<slug> (EventKort.eventUrl). */
    delningsUrl: string;
    cta: { url: string; label: string; guld: boolean } | null;
}) {
    const { minRsvp, svara } = useRsvp();
    const insets = useSafeAreaInsets();
    const mitt = minRsvp(event.id);

    const bjudMed = () => {
        if (mitt !== 'going') svara(event.id, 'going');
        const url = `${delningsUrl}?inb=1`;
        void Share.share({ title: event.title, message: `${event.title} - ${url}`, url });
    };

    const Svar = ({ status, text }: { status: RsvpStatus; text: string }) => {
        const på = mitt === status;
        return (
            <Pressable
                onPress={() => svara(event.id, status)}
                accessibilityRole="button"
                accessibilityState={{ selected: på }}
                style={({ pressed }) => [styles.knapp, på && styles.knappPå, pressed && styles.tryckt]}
            >
                <Text style={[styles.knappText, på && styles.knappTextPå]}>{text}</Text>
            </Pressable>
        );
    };

    return (
        <View style={[styles.platta, { paddingBottom: Math.max(10, insets.bottom) }]}>
            <Svar status="going" text="✓ Kommer" />
            <Svar status="interested" text="🤔 Intresserad" />
            <Pressable
                onPress={bjudMed}
                accessibilityLabel="Bjud med någon - dela eventet"
                style={({ pressed }) => [styles.knapp, pressed && styles.tryckt]}
            >
                <Text style={styles.knappText}>👥＋</Text>
            </Pressable>
            <View style={styles.fyll} />
            {cta ? (
                <Pressable
                    onPress={() => WebBrowser.openBrowserAsync(cta.url)}
                    style={({ pressed }) => [styles.cta, cta.guld ? styles.ctaGuld : styles.ctaBlå, pressed && styles.tryckt]}
                >
                    <Text style={[styles.ctaText, cta.guld ? styles.ctaTextGuld : styles.ctaTextBlå]}>{cta.label} →</Text>
                </Pressable>
            ) : null}
        </View>
    );
}

/** Webbens BTN_ON-blå (#006AA7) på kortets mörka yta (EventKort.MÖRK_*). */
const styles = StyleSheet.create({
    /** Positioneras av EventKorts footerHållare (counter-translaten). */
    platta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 12,
        paddingTop: 10,
        backgroundColor: '#17191f',
        borderTopWidth: 1,
        borderTopColor: '#2a2e37',
    },
    knapp: {
        borderRadius: 999,
        backgroundColor: '#22252d',
        borderWidth: 1,
        borderColor: '#3f4650',
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    knappPå: { backgroundColor: '#006AA7', borderColor: '#005590' },
    knappText: { fontSize: 13, fontWeight: '800', color: '#e2e8f0' },
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
