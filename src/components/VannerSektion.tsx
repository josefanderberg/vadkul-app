/**
 * VÄNNER i profilen - port av webbens src/components/v2/FriendsSection.tsx
 * (spår 3, "man kan gå in på sina vänners profiler och se vilka de är
 * intresserade av, kommer på"). Utfällbart kort: ingen Firestore-läsning
 * förrän det fälls ut, och hämtar OM vid varje utfällning (en förfrågan kan
 * ha kommit sedan sist) - reads-budgeten. Innehåll: förfrågningar
 * (acceptera/avböj), vänlistan där varje vän fälls ut till sin "profil"
 * (kommande event hen svarat Kommer/Intresserad på), skickade förfrågningar
 * med ångra, och integritetsreglaget "Visa vad jag kommer på för mina
 * vänner" (users.rsvpVisibleToFriends - grinden läses i hämtaVänprofil/
 * lib/vanEvent).
 *
 * Vännens event slås upp i den delade användarevent-listan först och
 * därefter via /api/event?id= (samma ~1 kB-uppslag som djuplänken) - ALDRIG
 * Firestore per event.
 *
 * BLOCKERING (App Store-regel 1.2, data/moderering): "Blockera" i den
 * utfällda vänprofilen och långtryck på en förfrågan. Att blockera tar bort
 * vänskapen/förfrågan och döljer personens chattmeddelanden; de blockerade
 * listas sist med "Häv". Blockeringslistan hämtas först när mappen fälls ut.
 */
import { useMemo, useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, Switch, Text, View } from 'react-native';
import { Image } from 'expo-image';
import type { AppFeedEvent } from '@vadkul/kontrakt';
import { fetchEventSomFlöde } from '@/api/eventDetalj';
import { hittaAnvändarEvent } from '@/api/useEvent';
import { formatEventTid } from '@/lib/eventTid';
import { kategoriFor } from '@/lib/kategorier';
import { bucketFriendRows, type FriendRow } from '@/lib/vanStatus';
import { genitiv, sorteraBlockerade, type BlockRad } from '@/lib/moderering';
import { friendRsvpVisible, upcomingFriendEvents, type FriendUpcomingEvent } from '@/lib/vanEvent';
import { läsFält, sättFält } from '@/data/anvandare';
import {
    accepteraVänförfrågan,
    hämtaMinaVänner,
    hämtaVänprofil,
    räknaInbjudanDelad,
    taBortVän,
} from '@/data/vanner';
import { avblockera, blockera, useModerering } from '@/data/moderering';
import { VÄN_INBJUDAN_TEXT, vänInbjudningsUrl } from '@/lib/vanInbjudan';

interface VänDetalj {
    state: 'laddar' | 'klar' | 'dold';
    events: FriendUpcomingEvent[];
}

function VänAvatar({ row }: { row: { name: string | null; photoURL?: string | null } }) {
    return row.photoURL ? (
        <Image source={{ uri: row.photoURL }} style={styles.avatarBild} contentFit="cover" />
    ) : (
        <View style={styles.avatarInitialYta}>
            <Text style={styles.avatarInitial}>{row.name ? row.name.trim().charAt(0).toUpperCase() : '?'}</Text>
        </View>
    );
}

export function VannerSektion({ uid, onVälj }: {
    uid: string;
    /** Öppna ett av vännens event i eventkortet (profilens valt-state). */
    onVälj: (e: AppFeedEvent) => void;
}) {
    const [utfälld, setUtfälld] = useState(false);
    // null = inte hämtat än (visar "Hämtar …" i stället för att ljuga "0 vänner").
    const [rader, setRader] = useState<FriendRow[] | null>(null);
    const [upptagenUid, setUpptagenUid] = useState<string | null>(null);
    const [öppenVänUid, setÖppenVänUid] = useState<string | null>(null);
    const [detaljer, setDetaljer] = useState<Record<string, VänDetalj>>({});
    // Integritetsgrinden - null tills users-dokumentet lästs.
    const [rsvpSynlig, setRsvpSynlig] = useState<boolean | null>(null);
    const [synligUpptagen, setSynligUpptagen] = useState(false);
    // Blockeringslistan - hämtas först när mappen fälls ut (reads-budgeten).
    const { rader: blockRader, blockerade } = useModerering(utfälld ? uid : null);
    const blockLista = useMemo(() => sorteraBlockerade(blockRader), [blockRader]);

    const laddaVänner = async () => {
        const [vänner, mitt] = await Promise.all([
            hämtaMinaVänner(uid),
            läsFält(uid).catch(() => null),
        ]);
        setRader(vänner);
        setRsvpSynlig(friendRsvpVisible(mitt));
    };

    const växlaUtfälld = () => {
        const nästa = !utfälld;
        setUtfälld(nästa);
        if (nästa) void laddaVänner();
        else { setÖppenVänUid(null); }
    };

    // Blockerade försvinner ur vänlistan även om en gammal rad skulle finnas kvar.
    const hinkar = useMemo(
        () => bucketFriendRows((rader ?? []).filter(r => !blockerade.has(r.uid))),
        [rader, blockerade],
    );

    const acceptera = async (row: FriendRow) => {
        setUpptagenUid(row.uid);
        try {
            await accepteraVänförfrågan(uid, row.uid, row.status);
            setRader(prev => prev?.map(r => r.uid === row.uid ? { ...r, status: 'accepted' } : r) ?? prev);
        } catch {
            Alert.alert('Kunde inte acceptera', 'Försök igen om en stund.');
        } finally {
            setUpptagenUid(null);
        }
    };

    const taBort = async (row: FriendRow) => {
        setUpptagenUid(row.uid);
        try {
            await taBortVän(uid, row.uid);
            setRader(prev => prev?.filter(r => r.uid !== row.uid) ?? prev);
            setÖppenVänUid(cur => cur === row.uid ? null : cur);
        } catch {
            Alert.alert('Kunde inte ta bort', 'Försök igen om en stund.');
        } finally {
            setUpptagenUid(null);
        }
    };

    /** Ta bort vän med bekräftelse (avböj/ångra på förfrågningar frågar inte -
     *  webbens beteende, fast med appens Alert i stället för dubbeltryck). */
    const taBortMedFråga = (row: FriendRow) => {
        Alert.alert('Ta bort vän?', `${row.name ?? 'Vännen'} försvinner ur din lista - och du ur hens.`, [
            { text: 'Avbryt', style: 'cancel' },
            { text: 'Ta bort', style: 'destructive', onPress: () => void taBort(row) },
        ]);
    };

    /** Blockera med bekräftelse - vänskapen/förfrågan rivs i samma batch. */
    const blockeraMedFråga = (row: FriendRow) => {
        const namn = row.name ?? 'personen';
        const relation = row.status === 'accepted' ? 'Ni är inte vänner längre' : 'Förfrågan tas bort';
        Alert.alert(`Blockera ${namn}?`, `${relation} och du ser inte ${genitiv(namn)} meddelanden i chattarna. ${namn} får inget besked om det.`, [
            { text: 'Avbryt', style: 'cancel' },
            {
                text: 'Blockera',
                style: 'destructive',
                onPress: () => {
                    setUpptagenUid(row.uid);
                    blockera(uid, { uid: row.uid, name: row.name })
                        .then(() => {
                            setRader(prev => prev?.filter(r => r.uid !== row.uid) ?? prev);
                            setÖppenVänUid(cur => cur === row.uid ? null : cur);
                        })
                        .catch(() => Alert.alert('Kunde inte blockera', 'Försök igen om en stund.'))
                        .finally(() => setUpptagenUid(null));
                },
            },
        ]);
    };

    const hävBlockering = (rad: BlockRad) => {
        const namn = rad.name ?? 'personen';
        Alert.alert(`Häv blockeringen av ${namn}?`, `Du ser ${genitiv(namn)} meddelanden igen. Ni blir inte vänner igen av det.`, [
            { text: 'Avbryt', style: 'cancel' },
            {
                text: 'Häv',
                onPress: () => {
                    setUpptagenUid(rad.uid);
                    avblockera(uid, rad.uid)
                        .catch(() => Alert.alert('Kunde inte häva blockeringen', 'Försök igen om en stund.'))
                        .finally(() => setUpptagenUid(null));
                },
            },
        ]);
    };

    // Vännens "profil": users-läsning (namn + listorna) och eventuppslag.
    const öppnaVän = async (row: FriendRow) => {
        if (öppenVänUid === row.uid) { setÖppenVänUid(null); return; }
        setÖppenVänUid(row.uid);
        const känd = detaljer[row.uid]?.state;
        if (känd === 'klar' || känd === 'dold') return;
        setDetaljer(prev => ({ ...prev, [row.uid]: { state: 'laddar', events: [] } }));
        const profil = await hämtaVänprofil(row.uid);
        if (!profil.visible) {
            setDetaljer(prev => ({ ...prev, [row.uid]: { state: 'dold', events: [] } }));
            return;
        }
        // Slå upp eventen: den delade användarevent-listan först (egna
        // skapade event, serie-id:n), /api/event som reserv.
        const resolved = new Map<string, AppFeedEvent>();
        await Promise.all(profil.picks.map(async p => {
            const hit = hittaAnvändarEvent(p.id) ?? await fetchEventSomFlöde(p.id).catch(() => null);
            if (hit) resolved.set(p.id, hit);
        }));
        setDetaljer(prev => ({
            ...prev,
            [row.uid]: { state: 'klar', events: upcomingFriendEvents(profil.picks, resolved, Date.now()) },
        }));
    };

    const växlaSynlig = () => {
        if (rsvpSynlig === null || synligUpptagen) return;
        const nästa = !rsvpSynlig;
        setSynligUpptagen(true);
        setRsvpSynlig(nästa);
        sättFält(uid, { rsvpVisibleToFriends: nästa })
            .catch(() => {
                setRsvpSynlig(!nästa);
                Alert.alert('Kunde inte spara', 'Försök igen om en stund.');
            })
            .finally(() => setSynligUpptagen(false));
    };

    const förfrågningsBadge = rader !== null && hinkar.incoming.length > 0;

    // BJUD IN EN VÄN (Josef 13/10): länken vadkul.se/?van=<uid> - den som
    // går med via den blir din vän direkt, och nya konton ger en stjärna var
    // (du högst 5 gånger; acceptFriendInvite i functions). Webbens knapp i
    // FriendsSection gör samma sak. Fullföljda delningar räknas i
    // friendInviteStats (18/10) - iOS ger dismissedAction när arket stängs
    // utan val, så bara sharedAction räknas (Android svarar alltid så).
    const bjudIn = async () => {
        const url = vänInbjudningsUrl(uid);
        try {
            const res = await Share.share({ title: 'VADKUL', message: `${VÄN_INBJUDAN_TEXT} ${url}`, url });
            if (res.action === Share.sharedAction) räknaInbjudanDelad(uid);
        } catch {
            /* avbruten/misslyckad delning - inget att räkna */
        }
    };

    return (
        <View style={styles.kort}>
            <Pressable onPress={växlaUtfälld} style={({ pressed }) => [styles.huvudRad, pressed && styles.tryckt]}>
                <Text style={styles.huvudText}>👥 Vänner och förfrågningar</Text>
                {förfrågningsBadge ? (
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>{hinkar.incoming.length}</Text>
                    </View>
                ) : null}
                <Text style={styles.chevron}>{utfälld ? '⌄' : '›'}</Text>
            </Pressable>

            {utfälld ? (
                rader === null ? (
                    <Text style={styles.hjälp}>Hämtar …</Text>
                ) : (
                    <View style={styles.innehåll}>
                        <Pressable
                            onPress={() => void bjudIn()}
                            style={({ pressed }) => [styles.bjudInKnapp, pressed && styles.tryckt]}
                            accessibilityRole="button"
                        >
                            <Text style={styles.bjudInText}>👋 Bjud in en vän</Text>
                        </Pressable>
                        <Text style={styles.bjudInHjälp}>
                            Ni får en stjärna var ⭐ när en vän skapar konto via länken (upp till 5).
                        </Text>
                        {/* Förfrågningar TILL mig - överst, de kräver svar. */}
                        {hinkar.incoming.map(row => (
                            <Pressable
                                key={row.uid}
                                onLongPress={() => blockeraMedFråga(row)}
                                accessibilityHint="Håll inne för att blockera"
                                style={styles.vänRad}
                            >
                                <VänAvatar row={row} />
                                <View style={styles.vänText}>
                                    <Text style={styles.vänNamn} numberOfLines={1}>{row.name ?? 'En VADKUL-användare'}</Text>
                                    <Text style={styles.vänUnder}>vill bli din vän</Text>
                                </View>
                                <Pressable
                                    onPress={() => void acceptera(row)}
                                    disabled={upptagenUid === row.uid}
                                    style={({ pressed }) => [styles.accepteraKnapp, pressed && styles.tryckt]}
                                >
                                    <Text style={styles.accepteraText}>Acceptera</Text>
                                </Pressable>
                                <Pressable
                                    onPress={() => void taBort(row)}
                                    disabled={upptagenUid === row.uid}
                                    hitSlop={8}
                                    accessibilityLabel="Avböj vänförfrågan"
                                >
                                    <Text style={styles.kryss}>✕</Text>
                                </Pressable>
                            </Pressable>
                        ))}

                        {/* Vännerna - varje rad fälls ut till vännens kommande svar. */}
                        {hinkar.accepted.length === 0 && hinkar.incoming.length === 0 ? (
                            <Text style={styles.hjälpUtanLuft}>
                                Inga vänner än - bjud in någon med knappen ovan, eller bjud med någon på ett event.
                            </Text>
                        ) : null}
                        {hinkar.accepted.map(row => {
                            const öppen = öppenVänUid === row.uid;
                            const detalj = detaljer[row.uid];
                            return (
                                <View key={row.uid}>
                                    <Pressable onPress={() => void öppnaVän(row)} style={({ pressed }) => [styles.vänRad, pressed && styles.tryckt]}>
                                        <VänAvatar row={row} />
                                        <View style={styles.vänText}>
                                            <Text style={styles.vänNamn} numberOfLines={1}>{row.name ?? 'En VADKUL-användare'}</Text>
                                        </View>
                                        <Text style={styles.chevron}>{öppen ? '⌄' : '›'}</Text>
                                    </Pressable>
                                    {öppen ? (
                                        <View style={styles.detalj}>
                                            {detalj?.state === 'laddar' || !detalj ? (
                                                <Text style={styles.detaljHjälp}>Hämtar …</Text>
                                            ) : detalj.state === 'dold' ? (
                                                <Text style={styles.detaljHjälp}>{row.name ?? 'Hen'} delar inte sina event.</Text>
                                            ) : detalj.events.length === 0 ? (
                                                <Text style={styles.detaljHjälp}>Inga kommande svar än.</Text>
                                            ) : (
                                                detalj.events.map(({ evt, status }) => (
                                                    <Pressable
                                                        key={evt.id}
                                                        onPress={() => onVälj(evt)}
                                                        style={({ pressed }) => [styles.eventRad, pressed && styles.tryckt]}
                                                    >
                                                        <Text style={styles.eventEmoji}>{evt.emoji || kategoriFor(String(evt.category)).emoji}</Text>
                                                        <View style={styles.vänText}>
                                                            <Text style={styles.eventTitel} numberOfLines={1}>{evt.title}</Text>
                                                            <Text style={styles.vänUnder}>
                                                                {formatEventTid(evt.time, evt.hasSpecificTime)} · {status === 'going' ? 'Kommer' : 'Intresserad'}
                                                            </Text>
                                                        </View>
                                                    </Pressable>
                                                ))
                                            )}
                                            <View style={styles.länkRad}>
                                                <Pressable
                                                    onPress={() => taBortMedFråga(row)}
                                                    disabled={upptagenUid === row.uid}
                                                    hitSlop={6}
                                                >
                                                    <Text style={styles.taBortLänk}>Ta bort vän</Text>
                                                </Pressable>
                                                <Pressable
                                                    onPress={() => blockeraMedFråga(row)}
                                                    disabled={upptagenUid === row.uid}
                                                    hitSlop={6}
                                                    accessibilityLabel={`Blockera ${row.name ?? 'vännen'}`}
                                                >
                                                    <Text style={styles.blockeraLänk}>Blockera</Text>
                                                </Pressable>
                                            </View>
                                        </View>
                                    ) : null}
                                </View>
                            );
                        })}

                        {/* Skickade, obesvarade förfrågningar - dämpade, med ångra. */}
                        {hinkar.outgoing.map(row => (
                            <View key={row.uid} style={[styles.vänRad, styles.dämpad]}>
                                <VänAvatar row={row} />
                                <View style={styles.vänText}>
                                    <Text style={styles.vänNamn} numberOfLines={1}>{row.name ?? 'En VADKUL-användare'}</Text>
                                    <Text style={styles.vänUnder}>Förfrågan skickad</Text>
                                </View>
                                <Pressable
                                    onPress={() => void taBort(row)}
                                    disabled={upptagenUid === row.uid}
                                    hitSlop={8}
                                    accessibilityLabel="Ångra vänförfrågan"
                                >
                                    <Text style={styles.kryss}>✕</Text>
                                </Pressable>
                            </View>
                        ))}

                        {/* Blockerade - dämpade, med häv. */}
                        {blockLista.length > 0 ? (
                            <Text style={styles.underRubrik}>Blockerade</Text>
                        ) : null}
                        {blockLista.map(rad => (
                            <View key={rad.uid} style={[styles.vänRad, styles.dämpad]}>
                                <VänAvatar row={rad} />
                                <View style={styles.vänText}>
                                    <Text style={styles.vänNamn} numberOfLines={1}>{rad.name ?? 'En VADKUL-användare'}</Text>
                                    <Text style={styles.vänUnder}>Blockerad</Text>
                                </View>
                                <Pressable
                                    onPress={() => hävBlockering(rad)}
                                    disabled={upptagenUid === rad.uid}
                                    hitSlop={8}
                                    accessibilityLabel={`Häv blockeringen av ${rad.name ?? 'användaren'}`}
                                >
                                    <Text style={styles.hävText}>Häv</Text>
                                </Pressable>
                            </View>
                        ))}

                        {/* Integritetsgrinden - vad VÄNNERNA ser på min profil. */}
                        <View style={styles.synligRad}>
                            <Text style={styles.synligText}>Visa vad jag kommer på för mina vänner</Text>
                            <Switch
                                value={rsvpSynlig === true}
                                onValueChange={växlaSynlig}
                                disabled={rsvpSynlig === null || synligUpptagen}
                            />
                        </View>
                    </View>
                )
            ) : null}
        </View>
    );
}

const BLÅ = '#006AA7';

const styles = StyleSheet.create({
    /** Samma kortyta som profilens övriga sektioner. */
    kort: { backgroundColor: '#ffffff', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 6, marginHorizontal: 16, marginTop: 4 },
    huvudRad: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
    huvudText: { flex: 1, fontSize: 15, fontWeight: '600', color: '#0f172a' },
    badge: {
        minWidth: 20,
        height: 20,
        borderRadius: 10,
        paddingHorizontal: 5,
        backgroundColor: BLÅ,
        alignItems: 'center',
        justifyContent: 'center',
    },
    badgeText: { fontSize: 10, fontWeight: '900', color: '#ffffff', fontVariant: ['tabular-nums'] },
    chevron: { fontSize: 15, fontWeight: '800', color: '#94a3b8' },
    innehåll: { paddingBottom: 8 },
    hjälp: { paddingBottom: 12, fontSize: 13, color: '#475569' },
    hjälpUtanLuft: { paddingVertical: 4, fontSize: 13, color: '#475569' },
    vänRad: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
    dämpad: { opacity: 0.65 },
    avatarBild: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#e2e8f0' },
    avatarInitialYta: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: BLÅ,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarInitial: { fontSize: 13, fontWeight: '900', color: '#ffffff' },
    vänText: { flex: 1, minWidth: 0 },
    vänNamn: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
    vänUnder: { fontSize: 11, fontWeight: '600', color: '#94a3b8', marginTop: 1 },
    accepteraKnapp: { borderRadius: 999, backgroundColor: BLÅ, paddingHorizontal: 11, paddingVertical: 7 },
    bjudInKnapp: { borderRadius: 999, backgroundColor: BLÅ, paddingVertical: 10, alignItems: 'center', marginTop: 4 },
    bjudInText: { fontSize: 13, fontWeight: '900', color: '#ffffff' },
    bjudInHjälp: { fontSize: 11, fontWeight: '600', color: '#94a3b8', textAlign: 'center', paddingTop: 6, paddingBottom: 8 },
    accepteraText: { fontSize: 11, fontWeight: '900', color: '#ffffff' },
    kryss: { fontSize: 14, fontWeight: '800', color: '#94a3b8', paddingHorizontal: 4 },
    detalj: { paddingLeft: 42, paddingBottom: 6 },
    detaljHjälp: { fontSize: 12, fontWeight: '600', color: '#94a3b8', paddingVertical: 2 },
    eventRad: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
    eventEmoji: { fontSize: 15 },
    eventTitel: { fontSize: 12, fontWeight: '700', color: '#0f172a' },
    länkRad: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 6 },
    taBortLänk: { fontSize: 11, fontWeight: '700', color: '#94a3b8' },
    blockeraLänk: { fontSize: 11, fontWeight: '700', color: '#dc2626' },
    underRubrik: { marginTop: 8, fontSize: 10, fontWeight: '900', letterSpacing: 1.2, color: '#94a3b8', textTransform: 'uppercase' },
    hävText: { fontSize: 12, fontWeight: '800', color: BLÅ, paddingHorizontal: 4 },
    synligRad: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        marginTop: 6,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    synligText: { flex: 1, fontSize: 13, fontWeight: '700', color: '#0f172a' },
    tryckt: { opacity: 0.85 },
});
