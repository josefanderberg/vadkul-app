/** vadkul.se/evenemang/<stad>/<kategori> i appen = stadssidan med kategorin vald. */
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function EvenemangKategori() {
    const { stad, kategori } = useLocalSearchParams<{ stad: string; kategori: string }>();
    return <Redirect href={{ pathname: '/stad/[slug]', params: { slug: stad, kategori } }} />;
}
