import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RegionProvider } from '@/lib/regionContext';

// En klient för hela appen - flödet cacheas per region (se src/api/appFeed).
const queryClient = new QueryClient();

export default function RootLayout() {
    return (
        <QueryClientProvider client={queryClient}>
            <RegionProvider>
                <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="index" />
                    <Stack.Screen name="sok" options={{ presentation: 'modal' }} />
                    <Stack.Screen name="stader" options={{ presentation: 'modal' }} />
                    <Stack.Screen name="profil" options={{ presentation: 'modal' }} />
                    <Stack.Screen name="stad/[slug]" />
                </Stack>
            </RegionProvider>
        </QueryClientProvider>
    );
}
