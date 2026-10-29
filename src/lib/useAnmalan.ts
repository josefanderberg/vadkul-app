/**
 * Anmälningsläget för eventet i kortet (webbens LinkEventCard:
 * subscribeAttendees + handleRsvpToggle). null = inte ett VADKUL-värdat
 * event - då är ANMÄL en utlänk (RsvpCta) eller saknas. EventKort håller EN
 * instans och skickar den till svarsradens tre kopior (botten, kortet,
 * toppen), så de visar samma läge på en prenumeration.
 *
 * Anmälan kräver konto, som på webben ("Logga in för att anmäla dig") -
 * utloggad skickas till inloggningen. Anonyma sessioner räknas inte.
 */
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { getAuth } from '@react-native-firebase/auth';
import { anmäl, avanmäl, lyssnaPåAnmälda } from '@/data/anmalan';
import { anmälanVem, type Anmäld } from '@/lib/anmalan';
import { ärEgetVadkulEvent, type AppEvent } from '@/lib/appEvent';
import { useKonto } from '@/lib/kontoContext';

export interface Anmälan {
    anmäld: boolean;
    lista: Anmäld[];
    upptagen: boolean;
    växla: () => void;
}

export function useAnmälan(event: AppEvent): Anmälan | null {
    const hostat = ärEgetVadkulEvent(event);
    const { användare, profil } = useKonto();
    // Listan nycklas på eventet - ett byte visar tom lista direkt i stället
    // för förra eventets anmälda tills snapshoten landat.
    const [läge, setLäge] = useState<{ id: string; lista: Anmäld[] }>({ id: '', lista: [] });
    const [upptagen, setUpptagen] = useState(false);

    useEffect(() => {
        if (!hostat) return;
        const id = event.id;
        return lyssnaPåAnmälda(id, lista => setLäge({ id, lista }));
    }, [event.id, hostat]);

    if (!hostat) return null;
    const lista = läge.id === event.id ? läge.lista : [];
    const anmäld = !!användare && lista.some(a => a.uid === användare.uid);

    const växla = () => {
        if (!användare) {
            router.push('/konto?lage=logga-in');
            return;
        }
        if (upptagen) return;
        setUpptagen(true);
        const vem = anmälanVem(profil?.displayName, användare, getAuth().currentUser?.photoURL);
        const skriv = anmäld ? avanmäl(event.id, användare.uid) : anmäl(event.id, { uid: användare.uid, ...vem });
        skriv
            .catch(() => Alert.alert('Kunde inte uppdatera anmälan', 'Kolla nätet och försök igen.'))
            .finally(() => setUpptagen(false));
    };

    return { anmäld, lista, upptagen, växla };
}
