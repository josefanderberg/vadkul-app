/**
 * Molnlagret på kartan (josefanderberg/VADKUL#233, Josef 14/11: "ta hela moln
 * designen. alltså den för webb. alltså exakt så likt som möjligt. det måste
 * finnas på apparna också") - webbens apps/web/src/components/v2/v2MapClouds.ts
 * i appen: vita moln över det som är GLEST, klart väder där eventen finns.
 *
 *  - VAR molnen står, zoomkurvan, knuffen och skuggan: @vadkul/kontrakt
 *    (eventClouds) - samma kod som webben.
 *  - Bildrutan och takten: lib/moln + lib/molnMotor (webbens draw och slinga).
 *  - Molnbilderna: bakade med webbens ritkod (scripts/baka-moln.mjs).
 *
 * Webben ritar på en canvas. Här är lagret ett fast antal bildvyer i EN
 * behållare ovanpå kartan. När kartan panoreras eller zoomas flyttas och
 * skalas bara behållaren (en vy per bildruta); en enskild bildvy ritas om
 * först när molnet självt ändrats (drift, knuff, toning) - motorn lämnar
 * oförändrade vyer med samma objekt, så memo släpper dem. Allt går i samma
 * React-uppdatering, så behållaren och vyerna aldrig hamnar i otakt.
 * Skuggorna ligger i ett eget lager under molnen, så en skugga aldrig hamnar
 * över ett annat moln.
 *
 * INTE Animated med native-drivare per bildvy (prövat 14/11 och rivet före
 * första bygget): varje setValue blir ett eget varv på huvudtråden som går
 * igenom alla animerade noder, och med ett par hundra vyer tar en enda
 * panoreringsbildruta då längre än bildrutan själv.
 *
 * Lagret tar aldrig emot tryck (pointerEvents none) - kartans gester och
 * brickornas tryck går rakt igenom.
 */
import { memo, useEffect, useImperativeHandle, useRef, useState, useSyncExternalStore, type Ref } from 'react';
import { AccessibilityInfo, AppState, Image, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useIsFocused } from 'expo-router';
import type { CloudPoint } from '@vadkul/kontrakt';
import { platsBehov, type VyData } from '@/lib/moln';
import { MOLN_BILDER, SKUGG_BILDER } from '@/lib/molnBilder.generated';
import { MOLN_BILD } from '@/lib/molnFormer.generated';
import { MolnMotor, tomBild, type MolnBild, type MolnVy } from '@/lib/molnMotor';

export interface KartMolnRef {
    /** Kartan rör sig (Map onRegionIsChanging). */
    rörelse(vy: MolnVy): void;
    /** Kartan har stannat (Map onRegionDidChange) - och första vyn vid start. */
    stannat(vy: MolnVy): void;
    /** Ett tryck på kartan: molnen skingras där. */
    tryck(punkt: CloudPoint): void;
    /** Var på skärmen kamerans mitt ligger, uppmätt med kartans projektion. */
    mitt(x: number, y: number): void;
}

/**
 * En bildvy. `d.bild` = form·2 + spegelvänd (webbens `sprites`-index): formen
 * väljer bilden, spegelvändningen är en vändning efter skalan.
 */
const Bildvy = memo(function Bildvy({ d, skugga }: { d: VyData; skugga: boolean }) {
    return (
        <Image
            source={(skugga ? SKUGG_BILDER : MOLN_BILDER)[d.bild >> 1]}
            fadeDuration={0}
            style={[
                styles.bildvy,
                {
                    opacity: d.a,
                    transform: [
                        { translateX: d.x },
                        { translateY: d.y },
                        { scale: d.s },
                        { scaleX: d.bild % 2 === 1 ? -1 : 1 },
                    ],
                },
            ]}
        />
    );
});

/** Ett lager bildvyer. Ritas om bara när listan bytts - inte när behållaren flyttas. */
const Vyer = memo(function Vyer({ vyer, skugga }: { vyer: readonly VyData[]; skugga: boolean }) {
    return (
        <View style={StyleSheet.absoluteFill}>
            {vyer.map((d, i) => <Bildvy key={i} d={d} skugga={skugga} />)}
        </View>
    );
});

// Appens läge som extern källa: ingen lucka mellan första ritningen och
// lyssnaren där ett byte till förgrunden kan tappas.
const prenumereraAppläge = (ändrat: () => void) => {
    const sub = AppState.addEventListener('change', ändrat);
    return () => sub.remove();
};
const appenFramme = () => AppState.currentState === 'active';

export function KartMoln({
    punkter,
    fokus,
    fria,
    ref,
}: {
    /** Eventens platser (dagens/veckans filtrerade urval) - molnen ligger där de INTE är. */
    punkter: readonly CloudPoint[];
    /** Det valda eventets plats - molnen håller sig undan därifrån. */
    fokus: CloudPoint | null;
    /** De tända brickornas platser - molnen tunnas ut över dem (lib/moln). */
    fria: readonly CloudPoint[];
    ref?: Ref<KartMolnRef>;
}) {
    const fönster = useWindowDimensions();
    // Antalet bildvyer bestäms en gång, av skärmen appen startade på.
    const [behov] = useState(() => platsBehov(fönster.width, fönster.height));
    const [bild, setBild] = useState<MolnBild>(() => tomBild(behov));

    const motorRef = useRef<MolnMotor | null>(null);
    const storlekRef = useRef<{ bredd: number; höjd: number } | null>(null);

    // Motorn: skapas en gång och lever med lagret.
    useEffect(() => {
        const motor = new MolnMotor({ visa: setBild }, behov);
        motorRef.current = motor;
        const s = storlekRef.current;
        if (s) motor.sättStorlek(s.bredd, s.höjd);
        return () => {
            motor.stäng();
            motorRef.current = null;
        };
    }, [behov]);

    useEffect(() => { motorRef.current?.sättPunkter(punkter); }, [punkter]);
    useEffect(() => { motorRef.current?.sättFokus(fokus); }, [fokus]);
    useEffect(() => { motorRef.current?.sättFria(fria); }, [fria]);

    // Slingan går bara när kartan visas och appen är framme.
    const synlig = useIsFocused();
    const framme = useSyncExternalStore(prenumereraAppläge, appenFramme);
    useEffect(() => { motorRef.current?.sättAktiv(synlig && framme); }, [synlig, framme]);

    // Minskad rörelse i systemet: ingen drift.
    useEffect(() => {
        let aktiv = true;
        AccessibilityInfo.isReduceMotionEnabled()
            .then(på => { if (aktiv) motorRef.current?.sättStilla(på); })
            .catch(() => { /* okänt = full rörelse */ });
        const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', på => motorRef.current?.sättStilla(på));
        return () => {
            aktiv = false;
            sub.remove();
        };
    }, []);

    useImperativeHandle(ref, () => ({
        rörelse: vy => motorRef.current?.rörelse(vy),
        stannat: vy => motorRef.current?.stannat(vy),
        tryck: punkt => motorRef.current?.tryck(punkt),
        mitt: (x, y) => motorRef.current?.sättMitt(x, y),
    }), []);

    return (
        <View
            style={styles.lager}
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            onLayout={e => {
                const { width, height } = e.nativeEvent.layout;
                storlekRef.current = { bredd: width, höjd: height };
                motorRef.current?.sättStorlek(width, height);
            }}
        >
            {/* Behållaren: följer kartan. Skalas kring sin mitt (lib/moln behållareFör). */}
            <View
                collapsable={false}
                style={[
                    StyleSheet.absoluteFill,
                    { transform: [{ translateX: bild.tx }, { translateY: bild.ty }, { scale: bild.skala }] },
                ]}
            >
                <Vyer vyer={bild.skuggor} skugga />
                <Vyer vyer={bild.moln} skugga={false} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    lager: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, overflow: 'hidden' },
    bildvy: { position: 'absolute', left: 0, top: 0, width: MOLN_BILD.bredd, height: MOLN_BILD.höjd },
});
