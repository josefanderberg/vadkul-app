/** vadkul.se/evenemang/<stad> i appen = stadssidan (universell länk och
 *  helgtipsets notislänk). */
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function EvenemangStad() {
    const { stad } = useLocalSearchParams<{ stad: string }>();
    return <Redirect href={{ pathname: '/stad/[slug]', params: { slug: stad } }} />;
}
