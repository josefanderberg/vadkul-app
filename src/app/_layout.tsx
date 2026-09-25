import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// En klient för hela appen — flödet cacheas per region (se src/api/appFeed).
const queryClient = new QueryClient();

export default function RootLayout() {
    return (
        <QueryClientProvider client={queryClient}>
            <Stack screenOptions={{ headerShown: false }} />
        </QueryClientProvider>
    );
}
