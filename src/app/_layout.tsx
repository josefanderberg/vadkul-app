import { useEffect } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { rapporteraFel, startaKraschrapportering, sättKraschAnvändare } from '@/data/krasch';
import { FilterProvider } from '@/lib/filterContext';
import { KontoProvider, useKonto } from '@/lib/kontoContext';
import { RegionProvider } from '@/lib/regionContext';
import { RsvpProvider } from '@/lib/rsvpContext';
import { SparadeProvider } from '@/lib/sparadeContext';

// Först av allt: Crashlytics installerar sin globala JS-felhanterare när
// modulen skapas (data/krasch), så fel under första renderingen fångas också.
startaKraschrapportering();

// En klient för hela appen - flödet cacheas per region (se src/api/appFeed).
const queryClient = new QueryClient();

// React Query vet inte om appen ligger i bakgrunden i React Native: koppla
// fokus mot AppState, så pollar (de användarskapade eventen, api/useEvent)
// står still i bakgrunden och kör direkt när appen kommer tillbaka.
focusManager.setEventListener(onFocus => {
    const sub = AppState.addEventListener('change', s => onFocus(s === 'active'));
    return () => sub.remove();
});

/** Håller Crashlytics-id:t i takt med kontot: uid inloggad, tomt annars. */
function KraschKonto() {
    const { användare } = useKonto();
    const svarat = användare !== undefined; // undefined = Firebase har inte svarat än
    const uid = användare?.uid ?? null;
    useEffect(() => {
        if (svarat) sättKraschAnvändare(uid);
    }, [svarat, uid]);
    return null;
}

/**
 * Rotens felgräns (Expo Router lindar layouten i den). Renderfel når aldrig
 * Crashlytics globala hanterare, så de rapporteras härifrån. Ritas UTANFÖR
 * providers - får inte använda kontexterna ovan.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
    useEffect(() => {
        rapporteraFel(error, 'felgränsen');
    }, [error]);
    return (
        <View style={styles.fel}>
            <Text style={styles.felRubrik}>Något gick fel</Text>
            <Text style={styles.felText}>
                Felet är rapporterat. Försök igen, och hjälper inte det kan du starta om appen.
            </Text>
            <Pressable style={styles.felKnapp} onPress={() => void retry()} accessibilityRole="button">
                <Text style={styles.felKnappText}>Försök igen</Text>
            </Pressable>
        </View>
    );
}

export default function RootLayout() {
    return (
        <QueryClientProvider client={queryClient}>
            <KontoProvider>
                <KraschKonto />
                <RegionProvider>
                    <FilterProvider>
                        <SparadeProvider>
                            <RsvpProvider>
                                <Stack screenOptions={{ headerShown: false }}>
                                    <Stack.Screen name="index" />
                                    <Stack.Screen name="sok" options={{ presentation: 'modal' }} />
                                    <Stack.Screen name="stader" options={{ presentation: 'modal' }} />
                                    <Stack.Screen name="profil" options={{ presentation: 'modal' }} />
                                    <Stack.Screen name="skapa" options={{ presentation: 'modal' }} />
                                    <Stack.Screen name="konto" options={{ presentation: 'modal' }} />
                                    <Stack.Screen name="stad/[slug]" />
                                    <Stack.Screen
                                        name="intro"
                                        options={{ presentation: 'fullScreenModal', gestureEnabled: false, animation: 'fade' }}
                                    />
                                </Stack>
                            </RsvpProvider>
                        </SparadeProvider>
                    </FilterProvider>
                </RegionProvider>
            </KontoProvider>
        </QueryClientProvider>
    );
}

const BLÅ = '#006aa7';

const styles = StyleSheet.create({
    fel: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, backgroundColor: BLÅ },
    felRubrik: { color: '#ffffff', fontSize: 28, fontWeight: '900', textAlign: 'center' },
    felText: { marginTop: 14, color: 'rgba(255,255,255,0.9)', fontSize: 16, lineHeight: 24, textAlign: 'center' },
    felKnapp: {
        marginTop: 26,
        alignSelf: 'stretch',
        backgroundColor: '#ffffff',
        borderRadius: 999,
        paddingVertical: 15,
        alignItems: 'center',
    },
    felKnappText: { color: BLÅ, fontSize: 17, fontWeight: '900' },
});
