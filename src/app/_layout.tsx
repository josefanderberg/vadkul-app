import { Stack } from 'expo-router';
import { AppState } from 'react-native';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FilterProvider } from '@/lib/filterContext';
import { KontoProvider } from '@/lib/kontoContext';
import { RegionProvider } from '@/lib/regionContext';
import { RsvpProvider } from '@/lib/rsvpContext';
import { SparadeProvider } from '@/lib/sparadeContext';

// En klient för hela appen - flödet cacheas per region (se src/api/appFeed).
const queryClient = new QueryClient();

// React Native har inget fönsterfokus: utan det här hämtas flödet aldrig om
// när appen kommer tillbaka från bakgrunden (staleTime gäller då aldrig).
focusManager.setEventListener(setFocused => {
    const sub = AppState.addEventListener('change', s => setFocused(s === 'active'));
    return () => sub.remove();
});

export default function RootLayout() {
    return (
        <QueryClientProvider client={queryClient}>
            <KontoProvider>
                <RegionProvider>
                    <FilterProvider>
                        <SparadeProvider>
                            <RsvpProvider>
                                <Stack screenOptions={{ headerShown: false }}>
                                    <Stack.Screen name="index" />
                                    <Stack.Screen name="sok" options={{ presentation: 'modal' }} />
                                    <Stack.Screen name="stader" options={{ presentation: 'modal' }} />
                                    <Stack.Screen name="profil" options={{ presentation: 'modal' }} />
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
