/** vadkul.se/evenemang i appen = städerna (universell länk). */
import { Redirect } from 'expo-router';

export default function EvenemangIndex() {
    return <Redirect href="/stader" />;
}
