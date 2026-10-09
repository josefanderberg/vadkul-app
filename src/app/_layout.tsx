import { AppState } from 'react-native';
import { Stack } from 'expo-router';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FilterProvider } from '@/lib/filterContext';
import { KontoProvider } from '@/lib/kontoContext';
import { RegionProvider } from '@/lib/regionContext';
import { RsvpProvider } from '@/lib/rsvpContext';
import { SparadeProvider } from '@/lib/sparadeContext';

// En klient för hela appen - flödet cacheas per region (se src/api/appFeed).
const queryClient = new QueryClient();

// React Query vet inte om appen ligger i bakgrunden i React Native: koppla
// fokus mot AppState, så pollar (de användarskapade eventen, api/useEvent)
// står still i bakgrunden och kör direkt när appen kommer tillbaka.
focusManager.setEventListener(onFocus => {
    const sub = AppState.addEventListener('change', s => onFocus(s === 'active'));
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
