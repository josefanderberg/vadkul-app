/**
 * Skapa/redigera event - port av webbens skapa-modal i app/(v2)/page.tsx
 * (formuläret, handleCreateEvent och handleEditOwnEvent). Samma dokument och
 * rules som webben via data/egnaEvent; all ren formlogik bor i lib/skapaEvent.
 *
 * ÄGARBESLUT 22/9 (skapa-modalen): INGA emojis i skapa-läget, inga
 * steg-wizards, ark med fälten två och två (När|Kategori, Pris|Bild), plats
 * på hela bredden, rubrik och knappar fast - bara fälten rullar. Flikarna
 * Jag arrangerar/Jag tipsar bara är understrukna flikar (grön/gul). FÖRVALD
 * flik är tips - de flesta som öppnar tipsar, och tips kräver inget konto.
 *
 * APP-ANPASSNINGAR mot webben:
 *  - Platsen: webben placerar nålen på kartan FÖRE formuläret (placing-varvet).
 *    Här öppnas formuläret direkt på kartans mitt (lat/lng i params) och
 *    "Ändra plats på kartan" visar en helskärmskarta med fast mittnål -
 *    samma recept som webbens repicking, utan läge över två skärmar.
 *  - Tid: native datetime-väljare i stället för <input type=datetime-local>.
 *  - Inget utkast-minne (webbens createDraft) - arket lever tills det stängs.
 *  - Önska-läget är inte med - det är ett eget spår (plattformsplanen §10).
 *
 * Redigering (?redigera=<tillfälle-id>): samma formulär förifyllt, Spara går
 * till uppdateraEgetEvent. Serielogiken (dagsserien visas från dag 1,
 * veckoantalet räknas om från tillfället) bor i lib/skapaEvent.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useQueryClient } from '@tanstack/react-query';
import { Camera, Map } from '@maplibre/maplibre-react-native';
import type { MapRef, StyleSpecification } from '@maplibre/maplibre-react-native';
import { EVENT_CATEGORY_KEYS, type EventCategoryType } from '@vadkul/kontrakt';
import { glömAnvändarEvent, hittaAnvändarEvent } from '@/api/useEvent';
import { tolkaTid, MAX_REPEAT_DAYS } from '@/lib/anvandarEvent';
import type { AppEvent } from '@/lib/appEvent';
import { KATEGORIER } from '@/lib/kategorier';
import { useKonto } from '@/lib/kontoContext';
import {
    DAGAR_VAL,
    GÅNGER_VAL,
    normaliseraPris,
    normaliseraTipsLänk,
    nästaHelaTimmen,
    redigeringsStart,
    serieFält,
    serieRadEtikett,
    sistaGångenEtikett,
    sistaTillfället,
    skapaFelKod,
    skapaFelText,
    veckorFörTillfällen,
    type Rytm,
} from '@/lib/skapaEvent';
import { BOOTSTRAP_STYLE, fetchThemeParkStyle, STREETS_STYLE_URL, type StyleJson } from '@/lib/themeParkStyle';
import { useModalTopp } from '@/lib/useModalTopp';
import { laddaUppEventBild, skapaEgetEvent, uppdateraEgetEvent } from '@/data/egnaEvent';
import { markeraÖnskanUppfylld, skapaÖnskan } from '@/data/onskningar';

/** "tors 15 okt. kl 19:00" - När?-radens text (Android; iOS visar systemväljaren). */
const tidEtikett = (d: Date): string =>
    `${sistaGångenEtikett(d)} kl ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

interface Bildval {
    uri: string;
    width?: number;
    height?: number;
}

export default function SkapaScreen() {
    const params = useLocalSearchParams<{
        lat?: string; lng?: string; zoom?: string; redigera?: string;
        /** Önska-läget (webbens wish-gren i skapa-flödet): roll=wish öppnar
         *  önske-fliken; titel/kategori förifylls från en önskebricka och
         *  onskanId markerar önskan uppfylld när eventet skapats. */
        roll?: string; titel?: string; kategori?: string; onskanId?: string;
    }>();
    const { användare, säkerställIdentitet } = useKonto();
    const qc = useQueryClient();
    const modalTopp = useModalTopp();

    // ── Redigeringsläget: eventet ur den delade listan, förifyllnaden ur
    // lib/skapaEvent (webbens handleEditOwnEvent). Hittas det inte (kallstart
    // på en död länk) öppnas ett tomt formulär - Spara skapar då inget fel,
    // för redigerar är null.
    const original = useMemo<AppEvent | null>(
        () => (params.redigera ? hittaAnvändarEvent(params.redigera) : null),
        [params.redigera],
    );
    const redigerar = original ? (original.docId ?? original.id.split('__')[0]) : null;
    const start = useMemo(() => {
        if (!original) return null;
        const time = tolkaTid(original.time);
        if (!time) return null;
        return redigeringsStart({
            time,
            isTip: original.isTip,
            url: original.url,
            repeatWeekly: original.repeatWeekly,
            repeatWeeks: original.repeatWeeks,
            repeatIntervalWeeks: original.repeatIntervalWeeks,
            repeatDays: original.repeatDays,
            seriesEndsAt: tolkaTid(original.seriesEndsAt) ?? undefined,
        });
        // params är stabila under skärmens liv.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Formulärets fält (webbens newEvent*-state) ────────────────────────
    const [roll, setRoll] = useState<'host' | 'tip' | 'wish'>(
        start?.roll ?? (params.roll === 'wish' ? 'wish' : 'tip'),
    );
    const [titel, setTitel] = useState(original?.title ?? (typeof params.titel === 'string' ? params.titel : ''));
    const [tid, setTid] = useState<Date>(() => start?.tid ?? nästaHelaTimmen());
    const [kategori, setKategori] = useState<EventCategoryType>(() => {
        const förifylld = original?.category ?? params.kategori;
        return förifylld && (EVENT_CATEGORY_KEYS as readonly string[]).includes(förifylld)
            ? (förifylld as EventCategoryType)
            : 'other';
    });
    const [kategoriÖppen, setKategoriÖppen] = useState(false);
    const [plats, setPlats] = useState(original?.locationName ?? '');
    const [pris, setPris] = useState(original?.price != null ? String(original.price) : '');
    const [beskrivning, setBeskrivning] = useState(original?.description ?? '');
    const [länk, setLänk] = useState(original?.url ?? '');
    const [arrangör, setArrangör] = useState(
        original && (original.isTip || original.url) ? original.hostName ?? '' : '',
    );
    // Bild: ny fil vinner; annars behålls originalets så länge förhands-
    // visningen står kvar; tömd förhandsvisning = ta bort bilden vid Spara.
    const [bild, setBild] = useState<Bildval | null>(null);
    const [bildPreview, setBildPreview] = useState(original?.img ?? '');
    const [seriePå, setSeriePå] = useState(start?.serie ?? false);
    const [rytm, setRytm] = useState<Rytm>(start?.rytm ?? 1);
    const [gånger, setGånger] = useState<number | null>(start?.gånger ?? null);
    const [visaFler, setVisaFler] = useState(false);
    const [sparar, setSparar] = useState(false);

    // Platsen: formuläret öppnas på kartans mitt; nålen flyttas i väljaren.
    const [position, setPosition] = useState(() => ({
        lat: original?.lat ?? (Number(params.lat) || 59.33),
        lng: original?.lng ?? (Number(params.lng) || 18.07),
    }));
    const [väljerPlats, setVäljerPlats] = useState(false);

    // ── Platsväljarens karta (samma stilkedja som index) ──────────────────
    const mapRef = useRef<MapRef>(null);
    const [mapStyle, setMapStyle] = useState<StyleJson | string>(BOOTSTRAP_STYLE);
    useEffect(() => {
        let aktiv = true;
        fetchThemeParkStyle()
            .then(s => { if (aktiv) setMapStyle(s); })
            .catch(() => { if (aktiv) setMapStyle(STREETS_STYLE_URL); });
        return () => { aktiv = false; };
    }, []);
    const väljPlatsHär = useCallback(async () => {
        try {
            const v = await mapRef.current?.getViewState();
            if (v) setPosition({ lat: (v.bounds[1] + v.bounds[3]) / 2, lng: (v.bounds[0] + v.bounds[2]) / 2 });
        } catch { /* kartan inte klar - behåll förra positionen */ }
        setVäljerPlats(false);
    }, []);

    // ── Fält-logik portad från webben ─────────────────────────────────────
    const ärTips = roll === 'tip';
    /** Önska-läget: bara titel, kategori, plats och beskrivning - önskan är
     *  ingen tidssatt sak, den är "någon borde ordna det här". */
    const ärÖnskan = roll === 'wish';
    const tipsLänk = normaliseraTipsLänk(länk);
    const länkTrasig = ärTips && !!länk.trim() && !tipsLänk;

    // "Fler detaljer" fälls ihop BARA i tips-läget; arrangera/önska/redigera
    // visar allt, och ifyllda fält fälls aldrig ihop över innehållet.
    const visaDetaljer = roll !== 'tip' || !!redigerar || visaFler
        || !!(länk.trim() || arrangör.trim() || beskrivning.trim());

    // Rytm-byte (webbens select-onChange): dagar har alltid ett antal och ett
    // lågt tak; från dagar till veckor börjar om på tills vidare; 52 gånger
    // ryms inte varannan vecka (reglernas tak är 52 VECKOR) - klipp till 26.
    const bytRytm = (nästa: Rytm) => {
        const förra = rytm;
        setRytm(nästa);
        setGånger(förr => {
            if (nästa === 'daglig') return förr && förr >= 2 && förr <= MAX_REPEAT_DAYS ? förr : 2;
            if (förra === 'daglig') return null;
            return förr && veckorFörTillfällen(förr, nästa) > 52 ? 26 : förr;
        });
    };

    // "sista gången tors 15 okt." - förhandsraden under antalsvalet.
    const serieSlutText = seriePå && gånger
        ? sistaGångenEtikett(sistaTillfället(tid, gånger, rytm))
        : null;

    const väljTidAndroid = () => {
        DateTimePickerAndroid.open({
            value: tid,
            mode: 'date',
            onChange: (ev, datum) => {
                if (ev.type !== 'set' || !datum) return;
                DateTimePickerAndroid.open({
                    value: datum,
                    mode: 'time',
                    is24Hour: true,
                    onChange: (ev2, dt) => { if (ev2.type === 'set' && dt) setTid(dt); },
                });
            },
        });
    };

    const väljBild = async () => {
        const svar = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
        if (svar.canceled || !svar.assets[0]) return;
        const a = svar.assets[0];
        setBild({ uri: a.uri, width: a.width, height: a.height });
        setBildPreview(a.uri);
    };

    // ── Spara (webbens handleCreateEvent, inklusive önske-grenen) ─────────
    const spara = async () => {
        if (!titel.trim() || sparar) return;
        // ÖNSKA: egen gren mot eventWishes (webbens createWish) - kräver
        // inloggning, reglerna verifierar uid == auth.uid.
        if (ärÖnskan) {
            if (!användare) {
                router.push('/konto?lage=logga-in');
                return;
            }
            setSparar(true);
            try {
                await skapaÖnskan({
                    title: titel,
                    category: kategori,
                    description: beskrivning,
                    lat: position.lat,
                    lng: position.lng,
                    uid: användare.uid,
                    hostName: användare.displayName || 'VADKUL-användare',
                });
                await qc.invalidateQueries({ queryKey: ['onskningar'] });
                router.dismissTo('/');
                Alert.alert('Önskan ligger på kartan ✨', 'Den syns som en drömsk bricka i 7 dagar - kanske nappar någon.');
            } catch (fel) {
                console.warn('[önskan] sparandet stoppades:', skapaFelKod(fel));
                Alert.alert('Kunde inte skapa önskan', skapaFelText(skapaFelKod(fel)));
            } finally {
                setSparar(false);
            }
            return;
        }
        if (länkTrasig) {
            Alert.alert('Länken går inte att tolka', 'Ta bort den eller skriv hela adressen.');
            return;
        }
        // KONTO krävs för att ARRANGERA (man visas upp som värd). Tips går utan.
        if (!ärTips && !användare) {
            router.push('/konto?lage=logga-in');
            return;
        }
        setSparar(true);
        try {
            // Tips utan konto → anonymt uid (reglerna kräver ändå hostUid == auth.uid).
            const uid = ärTips ? await säkerställIdentitet() : användare!.uid;
            const ärAnonymtTips = ärTips && !användare;
            // Tips: värden är arrangören man tipsar om - ALDRIG tipsarens namn.
            const hostName = ärTips
                ? (arrangör.trim()
                    || (tipsLänk ? new URL(tipsLänk).hostname.replace(/^www\./, '') : 'Okänd arrangör'))
                : (användare!.displayName || användare!.email || 'VADKUL-användare');
            // Ladda upp ev. eventbild först så URL:en kan sparas på eventet.
            // Misslyckas den skapas eventet utan bild (webbens avvägning).
            let coverImage = '';
            if (bild) {
                try {
                    coverImage = await laddaUppEventBild(uid, bild);
                } catch (e) {
                    console.warn('Kunde inte ladda upp eventbilden - sparar utan bild:', e);
                }
            }
            const prisEtikett = normaliseraPris(pris) ?? undefined;
            const serie = serieFält(seriePå, rytm, gånger);
            const gemensamt = {
                title: titel,
                time: tid,
                lat: position.lat,
                lng: position.lng,
                locationName: plats,
                description: beskrivning,
                price: prisEtikett,
                category: kategori,
                url: tipsLänk ?? '',
                isTip: ärTips,
                ...serie,
            };

            let docId: string;
            if (redigerar) {
                // Bild: ny fil vinner; kvar förhandsvisning = behåll originalets;
                // tömd = ta bort. Värd: tips ändrar via fältet, eget event
                // behåller originalets - den ska inte räknas om.
                let redigeradBild = bildPreview ? (original?.img ?? '') : '';
                if (coverImage) redigeradBild = coverImage;
                await uppdateraEgetEvent(redigerar, {
                    ...gemensamt,
                    hostName: ärTips ? hostName : (original?.hostName || hostName),
                    coverImage: redigeradBild,
                });
                docId = redigerar;
            } else {
                docId = await skapaEgetEvent({
                    ...gemensamt,
                    hostName,
                    hostUid: uid,
                    coverImage,
                    anonTip: ärAnonymtTips,
                });
            }

            // Skapades eventet ur en önskebricka: markera önskan uppfylld
            // (webbens markFulfilled - reglerna tillåter bara den flippen).
            if (!redigerar && typeof params.onskanId === 'string' && params.onskanId) {
                await markeraÖnskanUppfylld(params.onskanId);
                void qc.invalidateQueries({ queryKey: ['onskningar'] });
            }

            // Glöm pollens lista och hämta om nu - redigeringar ändrar inte
            // antalet, så utan det hade ändringen dröjt till säkerhetsnätet.
            glömAnvändarEvent();
            await qc.invalidateQueries({ queryKey: ['anvandar-event'] });
            // Tillbaka till kartan med eventet öppet - samma väg som
            // djuplänken ?event= (kameran flyger dit, dagen byts).
            router.dismissTo({ pathname: '/', params: { event: docId } });
        } catch (fel) {
            const kod = skapaFelKod(fel);
            console.warn('[event] sparandet stoppades:', kod);
            Alert.alert(redigerar ? 'Kunde inte spara ändringarna' : 'Kunde inte skapa eventet', skapaFelText(kod));
        } finally {
            setSparar(false);
        }
    };

    const sparaInaktiv = !titel.trim() || länkTrasig || sparar;
    const sparaText = sparar
        ? (redigerar ? 'Sparar…' : ärÖnskan ? 'Önskar…' : 'Skapar…')
        : redigerar
        ? 'Spara ändringar'
        : ärÖnskan
        ? (användare ? 'Önska' : 'Logga in & önska')
        : ärTips
        ? 'Tipsa'
        : användare
        ? 'Skapa'
        : 'Logga in & skapa';

    // ── Platsväljaren: helskärmskarta med fast mittnål ────────────────────
    if (väljerPlats) {
        return (
            <View style={styles.root}>
                <Map
                    ref={mapRef}
                    style={styles.karta}
                    mapStyle={mapStyle as StyleSpecification | string}
                >
                    <Camera
                        initialViewState={{
                            center: [position.lng, position.lat],
                            zoom: Math.min(16, Math.max(8, Number(params.zoom) || 13)),
                        }}
                    />
                </Map>
                {/* Nålen står still i mitten - kartan panoreras under den.
                    Spetsen (pinnens nederkant) pekar på skärmens mitt. */}
                <View pointerEvents="none" style={styles.nålYta}>
                    <View style={styles.nålKnopp} />
                    <View style={styles.nålPinne} />
                </View>
                <View style={styles.väljRad}>
                    <Pressable style={styles.väljAvbryt} onPress={() => setVäljerPlats(false)} accessibilityLabel="Avbryt platsval">
                        <Text style={styles.väljAvbrytText}>Avbryt</Text>
                    </Pressable>
                    <Pressable style={styles.väljKnapp} onPress={väljPlatsHär} accessibilityLabel="Välj denna plats">
                        <Text style={styles.väljKnappText}>Välj denna plats</Text>
                    </Pressable>
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.root, { paddingTop: modalTopp }]}>
            <View style={styles.huvud}>
                <Text style={styles.rubrik}>{redigerar ? 'Ändra event' : ärÖnskan ? 'Önska ett event' : 'Skapa event'}</Text>
                <Pressable onPress={() => router.back()} hitSlop={12} style={styles.stängKnapp} accessibilityLabel="Stäng">
                    <Text style={styles.stängText}>✕</Text>
                </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.innehåll} keyboardShouldPersistTaps="handled">
                {/* Arrangerar du själv, eller tipsar du? Understrukna flikar
                    (grön/gul), inte ett pill-reglage - ägarbeslut 22/9. */}
                <View style={styles.flikRad} accessibilityRole="tablist">
                    <Pressable style={styles.flik} onPress={() => setRoll('host')} accessibilityRole="tab">
                        <Text style={[styles.flikText, roll === 'host' && styles.flikTextVald]}>Jag arrangerar</Text>
                        <View style={[styles.flikStreck, roll === 'host' && styles.flikStreckHost]} />
                    </Pressable>
                    <Pressable style={styles.flik} onPress={() => setRoll('tip')} accessibilityRole="tab">
                        <Text style={[styles.flikText, roll === 'tip' && styles.flikTextVald]}>Jag tipsar bara</Text>
                        <View style={[styles.flikStreck, roll === 'tip' && styles.flikStreckTips]} />
                    </Pressable>
                    {/* Önska (webbens wish-gren i skapa-flödet) - inte vid
                        redigering, en önskan redigeras aldrig. */}
                    {!redigerar ? (
                        <Pressable style={styles.flik} onPress={() => setRoll('wish')} accessibilityRole="tab">
                            <Text style={[styles.flikText, roll === 'wish' && styles.flikTextVald]}>Jag önskar</Text>
                            <View style={[styles.flikStreck, roll === 'wish' && styles.flikStreckÖnska]} />
                        </Pressable>
                    ) : null}
                </View>
                <Text style={styles.hjälp}>
                    {roll === 'host'
                        ? 'Ditt event får en egen bricka på kartan och syns direkt för alla som tittar här - gratis synlighet för det du ordnar, med dig som arrangör.'
                        : roll === 'tip'
                        ? 'Tipsa om ett event som redan finns - du står inte som arrangör. Kräver inget konto, och länk behövs bara om det finns en sida att peka på.'
                        : 'Önska att någon ordnar något här. Önskan syns som en drömsk bricka på kartan i 7 dagar - kanske nappar en arrangör eller förening.'}
                </Text>

                {/* Platsen är redan vald (kartans mitt) - vill man flytta görs
                    ett nytt placerings-varv, precis som på webben. */}
                <Pressable onPress={() => setVäljerPlats(true)} hitSlop={6}>
                    <Text style={styles.platsLänk}>Ändra plats på kartan</Text>
                </Pressable>

                <TextInput
                    style={styles.fält}
                    value={titel}
                    onChangeText={setTitel}
                    placeholder="Namn på event"
                    placeholderTextColor="#94a3b8"
                    maxLength={120}
                    accessibilityLabel="Namn på event"
                />

                {/* När + Kategori två och två. Önskningar har ingen tid -
                    kategorin tar hela bredden i önske-läget. */}
                <View style={styles.parRad}>
                    {!ärÖnskan ? (
                    <View style={styles.halv}>
                        <Text style={styles.etikett}>När?</Text>
                        {Platform.OS === 'ios' ? (
                            <View style={styles.tidIos}>
                                <DateTimePicker
                                    value={tid}
                                    mode="datetime"
                                    display="compact"
                                    locale="sv-SE"
                                    onChange={(_ev, d) => { if (d) setTid(d); }}
                                />
                            </View>
                        ) : (
                            <Pressable style={styles.fält} onPress={väljTidAndroid} accessibilityLabel="Välj datum och tid">
                                <Text style={styles.fältText}>{tidEtikett(tid)}</Text>
                            </Pressable>
                        )}
                    </View>
                    ) : null}
                    <View style={styles.halv}>
                        <Text style={styles.etikett}>Kategori</Text>
                        <Pressable
                            style={styles.fält}
                            onPress={() => setKategoriÖppen(ö => !ö)}
                            accessibilityLabel="Välj kategori"
                        >
                            <Text style={styles.fältText}>{KATEGORIER[kategori].label}</Text>
                        </Pressable>
                    </View>
                </View>
                {kategoriÖppen ? (
                    <View style={styles.kategoriLista}>
                        {EVENT_CATEGORY_KEYS.map(nyckel => (
                            <Pressable
                                key={nyckel}
                                style={[styles.kategoriVal, nyckel === kategori && styles.kategoriValt]}
                                onPress={() => { setKategori(nyckel); setKategoriÖppen(false); }}
                            >
                                <View style={[styles.kategoriPrick, { backgroundColor: KATEGORIER[nyckel].hex }]} />
                                <Text style={[styles.kategoriText, nyckel === kategori && styles.kategoriTextValt]}>
                                    {KATEGORIER[nyckel].label}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                ) : null}

                {/* Serie: flera dagar i rad eller varje/varannan vecka. Klockslag
                    och veckodag ärvs från När?. Inte för önskningar. */}
                {!ärÖnskan ? (
                <View style={styles.serieKort}>
                    <View style={styles.serieRad}>
                        <View style={styles.serieTextKolumn}>
                            <Text style={styles.serieTitel}>Flera dagar eller återkommande</Text>
                            <Text style={styles.hjälpTät}>
                                {!seriePå
                                    ? 'T.ex. en konstrunda över helgen eller en pubquiz varje vecka.'
                                    : rytm === 'daglig'
                                    ? `${serieRadEtikett(tid, 'daglig')}. Det blir ett event som syns på kartan alla dagarna.`
                                    : `${serieRadEtikett(tid, rytm)}. Ändrar du tiden senare gäller det alla kommande gånger.`}
                            </Text>
                        </View>
                        <Switch value={seriePå} onValueChange={setSeriePå} />
                    </View>
                    {seriePå ? (
                        <>
                            <View style={styles.chipRad}>
                                {([['daglig', 'Varje dag'], [1, 'Varje vecka'], [2, 'Varannan vecka']] as const).map(([v, text]) => (
                                    <Pressable
                                        key={String(v)}
                                        style={[styles.chip, rytm === v && styles.chipValt]}
                                        onPress={() => bytRytm(v)}
                                    >
                                        <Text style={[styles.chipText, rytm === v && styles.chipTextValt]}>{text}</Text>
                                    </Pressable>
                                ))}
                            </View>
                            <Text style={styles.etikettLuft}>
                                {rytm === 'daglig' ? 'Hur många dagar?' : 'Hur många gånger?'}
                            </Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRull}>
                                {rytm === 'daglig'
                                    ? DAGAR_VAL.map(n => (
                                        <Pressable key={n} style={[styles.chip, gånger === n && styles.chipValt]} onPress={() => setGånger(n)}>
                                            <Text style={[styles.chipText, gånger === n && styles.chipTextValt]}>{n} dagar</Text>
                                        </Pressable>
                                    ))
                                    : (
                                        <>
                                            <Pressable style={[styles.chip, gånger === null && styles.chipValt]} onPress={() => setGånger(null)}>
                                                <Text style={[styles.chipText, gånger === null && styles.chipTextValt]}>Tills vidare</Text>
                                            </Pressable>
                                            {GÅNGER_VAL.filter(n => veckorFörTillfällen(n, rytm) <= 52).map(n => (
                                                <Pressable key={n} style={[styles.chip, gånger === n && styles.chipValt]} onPress={() => setGånger(n)}>
                                                    <Text style={[styles.chipText, gånger === n && styles.chipTextValt]}>{n} gånger</Text>
                                                </Pressable>
                                            ))}
                                        </>
                                    )}
                            </ScrollView>
                            {serieSlutText ? (
                                <Text style={styles.hjälpTät}>
                                    {rytm === 'daglig' ? 'sista dagen' : 'sista gången'} {serieSlutText}
                                </Text>
                            ) : null}
                        </>
                    ) : null}
                </View>
                ) : null}

                {/* Önskningar bär ingen platstext - läget är nålen på kartan. */}
                {!ärÖnskan ? (
                <TextInput
                    style={styles.fält}
                    value={plats}
                    onChangeText={setPlats}
                    placeholder="Plats, t.ex. Vasaparken (valfritt)"
                    placeholderTextColor="#94a3b8"
                    maxLength={120}
                    accessibilityLabel="Plats (valfritt)"
                />
                ) : null}

                {/* Pris + Bild två och två. Tomt pris = inget pris-chip alls -
                    vet inte är inte samma sak som gratis. Önskningar har
                    varken pris eller bild. */}
                {!ärÖnskan ? (
                <View style={styles.parRad}>
                    <TextInput
                        style={[styles.fält, styles.halv]}
                        value={pris}
                        onChangeText={setPris}
                        placeholder="Pris, t.ex. 120 kr"
                        placeholderTextColor="#94a3b8"
                        maxLength={40}
                        accessibilityLabel="Pris (valfritt)"
                    />
                    <View style={[styles.fält, styles.halv, styles.bildFält]}>
                        <Pressable style={styles.bildVäljare} onPress={väljBild} accessibilityLabel={bildPreview ? 'Byt bild' : 'Lägg till bild'}>
                            {bildPreview ? (
                                <Image source={{ uri: bildPreview }} style={styles.bildMini} contentFit="cover" />
                            ) : null}
                            <Text style={[styles.fältText, !bildPreview && styles.platshållare]} numberOfLines={1}>
                                {bildPreview ? 'Byt bild' : 'Lägg till bild'}
                            </Text>
                        </Pressable>
                        {bildPreview ? (
                            <Pressable
                                onPress={() => { setBild(null); setBildPreview(''); }}
                                hitSlop={8}
                                accessibilityLabel="Ta bort bild"
                            >
                                <Text style={styles.bildKryss}>✕</Text>
                            </Pressable>
                        ) : null}
                    </View>
                </View>
                ) : null}

                {/* FLER DETALJER: när man TIPSAR fälls länk, arrangör och
                    beskrivning ihop - ett snabbt tips är några få fält. */}
                {visaDetaljer ? (
                    <>
                        {ärTips ? (
                            <View style={styles.parRad}>
                                <TextInput
                                    style={[styles.fält, styles.halv, länkTrasig && styles.fältVarning]}
                                    value={länk}
                                    onChangeText={setLänk}
                                    placeholder="Länk till eventet"
                                    placeholderTextColor="#94a3b8"
                                    maxLength={500}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    keyboardType="url"
                                    accessibilityLabel="Länk till eventet (valfritt)"
                                />
                                <TextInput
                                    style={[styles.fält, styles.halv]}
                                    value={arrangör}
                                    onChangeText={setArrangör}
                                    placeholder="Arrangör, t.ex. Borås Stad"
                                    placeholderTextColor="#94a3b8"
                                    maxLength={80}
                                    accessibilityLabel="Arrangör (valfritt)"
                                />
                            </View>
                        ) : null}
                        <TextInput
                            style={[styles.fält, styles.beskrivning]}
                            value={beskrivning}
                            onChangeText={setBeskrivning}
                            placeholder="Beskrivning - vad händer? (valfritt)"
                            placeholderTextColor="#94a3b8"
                            maxLength={1000}
                            multiline
                            textAlignVertical="top"
                            accessibilityLabel="Beskrivning (valfritt)"
                        />
                    </>
                ) : (
                    <Pressable style={styles.flerKnapp} onPress={() => setVisaFler(true)}>
                        <Text style={styles.flerTitel}>Fler detaljer</Text>
                        <Text style={styles.hjälpTät}>Länk, arrangör och beskrivning</Text>
                    </Pressable>
                )}

                {!användare && ärTips ? (
                    <Text style={styles.tipsInfo}>Du behöver inget konto för att tipsa.</Text>
                ) : null}
                {!användare && ärÖnskan ? (
                    <Text style={styles.tipsInfo}>Önskningar kräver ett konto - det skapas på en minut.</Text>
                ) : null}
            </ScrollView>

            {/* Knapparna ligger fast i botten - bara fälten rullar. */}
            <View style={styles.fot}>
                <Pressable style={styles.avbryt} onPress={() => router.back()}>
                    <Text style={styles.avbrytText}>Avbryt</Text>
                </Pressable>
                <Pressable
                    style={[styles.skapa, sparaInaktiv && styles.skapaInaktiv]}
                    onPress={spara}
                    disabled={sparaInaktiv}
                >
                    {sparar ? <ActivityIndicator size="small" color="#ffffff" /> : null}
                    <Text style={styles.skapaText}>{sparaText}</Text>
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#f8fafc', paddingTop: 24 },
    huvud: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 },
    rubrik: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
    stängKnapp: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#e2e8f0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    stängText: { fontSize: 13, fontWeight: '700', color: '#475569' },
    innehåll: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },

    flikRad: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
    flik: { flex: 1, alignItems: 'center', paddingTop: 4, paddingBottom: 0 },
    flikText: { fontSize: 14, fontWeight: '800', color: '#94a3b8', paddingBottom: 8 },
    flikTextVald: { color: '#0f172a' },
    flikStreck: { alignSelf: 'stretch', height: 3, borderRadius: 2, backgroundColor: 'transparent' },
    flikStreckHost: { backgroundColor: '#16a34a' },
    flikStreckTips: { backgroundColor: '#f59e0b' },
    /** Önska: drömskt lila, som önskebrickornas ton på webben. */
    flikStreckÖnska: { backgroundColor: '#8b5cf6' },
    hjälp: { fontSize: 12, color: '#64748b', lineHeight: 17 },
    hjälpTät: { marginTop: 4, fontSize: 12, color: '#64748b', lineHeight: 16 },
    platsLänk: { fontSize: 13, fontWeight: '700', color: '#006aa7' },

    fält: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        color: '#0f172a',
        justifyContent: 'center',
    },
    fältText: { fontSize: 15, color: '#0f172a' },
    fältVarning: { borderColor: '#f59e0b' },
    platshållare: { color: '#94a3b8' },
    parRad: { flexDirection: 'row', gap: 12 },
    halv: { flex: 1, minWidth: 0 },
    etikett: { fontSize: 12, fontWeight: '700', color: '#64748b', marginBottom: 4 },
    etikettLuft: { fontSize: 12, fontWeight: '700', color: '#64748b', marginTop: 10 },
    /** iOS-väljaren är sin egen knapp - vänsterställd, utan fältram. */
    tidIos: { alignItems: 'flex-start', paddingVertical: 4 },

    kategoriLista: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        padding: 10,
    },
    kategoriVal: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        width: '47%',
        paddingHorizontal: 10,
        paddingVertical: 9,
        borderRadius: 10,
    },
    kategoriValt: { backgroundColor: '#f1f5f9' },
    kategoriPrick: { width: 10, height: 10, borderRadius: 5 },
    kategoriText: { fontSize: 14, fontWeight: '600', color: '#334155' },
    kategoriTextValt: { fontWeight: '800', color: '#0f172a' },

    serieKort: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        padding: 12,
    },
    serieRad: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    serieTextKolumn: { flex: 1, minWidth: 0 },
    serieTitel: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
    chipRad: { flexDirection: 'row', gap: 8, marginTop: 10 },
    chipRull: { gap: 8, paddingTop: 6, paddingBottom: 2 },
    chip: {
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        backgroundColor: '#ffffff',
        paddingHorizontal: 12,
        paddingVertical: 7,
    },
    chipValt: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
    chipText: { fontSize: 12, fontWeight: '700', color: '#475569' },
    chipTextValt: { color: '#ffffff' },

    bildFält: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9 },
    bildVäljare: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
    bildMini: { width: 32, height: 24, borderRadius: 4 },
    bildKryss: { fontSize: 14, fontWeight: '700', color: '#94a3b8', paddingHorizontal: 4 },

    beskrivning: { minHeight: 120 },
    flerKnapp: {
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: '#cbd5e1',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    flerTitel: { fontSize: 14, fontWeight: '800', color: '#334155' },
    tipsInfo: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748b',
        backgroundColor: '#f1f5f9',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },

    fot: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 10,
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 28,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        backgroundColor: '#f8fafc',
    },
    avbryt: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999 },
    avbrytText: { fontSize: 15, fontWeight: '700', color: '#475569' },
    skapa: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#16a34a',
        borderRadius: 999,
        paddingVertical: 12,
    },
    skapaInaktiv: { opacity: 0.4 },
    skapaText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },

    karta: { flex: 1 },
    nålYta: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },
    /** Knopp + pinne: spetsen (pinnens nederkant) står på skärmens mitt,
     *  så hela nålen lyfts halva sin höjd (knopp 22 + pinne 12 = 34). */
    nålKnopp: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: '#006AA7',
        borderWidth: 3,
        borderColor: '#f0b429',
        marginTop: -34,
    },
    nålPinne: { width: 3, height: 12, backgroundColor: '#006AA7' },
    väljRad: {
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: 40,
        flexDirection: 'row',
        gap: 10,
    },
    väljAvbryt: {
        paddingHorizontal: 18,
        justifyContent: 'center',
        borderRadius: 999,
        backgroundColor: 'rgba(36,42,51,0.92)',
    },
    väljAvbrytText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
    väljKnapp: {
        flex: 1,
        alignItems: 'center',
        backgroundColor: '#16a34a',
        borderRadius: 999,
        paddingVertical: 14,
    },
    väljKnappText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
});
