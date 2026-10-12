/** vadkul.se/evenemang/<stad> i appen = stadssidan (universell länk och
 *  helgtipsets notislänk). ?q= (webbens kortsök) följer med till sökfältet. */
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function EvenemangStad() {
    const { stad, q } = useLocalSearchParams<{ stad: string; q?: string }>();
    return <Redirect href={{ pathname: '/stad/[slug]', params: { slug: stad, ...(typeof q === 'string' && q ? { q } : {}) } }} />;
}
