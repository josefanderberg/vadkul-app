import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FilterProvider } from '@/lib/filterContext';
import { KontoProvider } from '@/lib/kontoContext';
import { RegionProvider } from '@/lib/regionContext';
import { SparadeProvider } from '@/lib/sparadeContext';

// En klient för hela appen - flödet cacheas per region (se src/api/appFeed).
const queryClient = new QueryClient();

export default function RootLayout() {
    return (
        <QueryClientProvider client={queryClient}>
            <KontoProvider>
                <RegionProvider>
                    <FilterProvider>
                        <SparadeProvider>
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
                        </SparadeProvider>
                    </FilterProvider>
                </RegionProvider>
            </KontoProvider>
        </QueryClientProvider>
    );
}
