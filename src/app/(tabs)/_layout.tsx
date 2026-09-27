/**
 * Flikraden: Karta (hem), Sök, Städer, Profil. Emoji som ikoner - inga
 * ikonpaket behövs och de matchar appens formspråk (brickorna är emojis).
 */
import { Tabs } from 'expo-router';
import { Text } from 'react-native';

function ikon(emoji: string) {
    return function TabIkon({ focused }: { focused: boolean }) {
        return <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.45 }}>{emoji}</Text>;
    };
}

export default function TabsLayout() {
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: '#0f172a',
                tabBarInactiveTintColor: '#94a3b8',
                tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
            }}
        >
            <Tabs.Screen name="index" options={{ title: 'Karta', tabBarIcon: ikon('🗺️') }} />
            <Tabs.Screen name="sok" options={{ title: 'Sök', tabBarIcon: ikon('🔍') }} />
            <Tabs.Screen name="stader" options={{ title: 'Städer', tabBarIcon: ikon('📍') }} />
            <Tabs.Screen name="profil" options={{ title: 'Profil', tabBarIcon: ikon('👤') }} />
        </Tabs>
    );
}
