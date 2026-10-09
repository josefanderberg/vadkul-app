/**
 * Sparade event (webbens hjärta, "gilla"). Eventet sparas som ögonblicksbild
 * PÅ ENHETEN, så listan i profilen funkar offline och för event i andra län
 * än kartans - appens mervärde enligt planen (§6: "favoriter cacheas lokalt").
 *
 * INLOGGAD (sedan 8/10 2026, Firestore direkt): varje tryck speglas också på
 * kontot - users.savedEventIds (ett id i taget, webbens addSavedEventId) och
 * gilla-räknaren eventStats.likes. Kontots lista är den påminnelsejobbet
 * (functions/reminders, "1 h före") frågar på. Vid inloggning hämtas event som
 * sparats på andra enheter via /api/event. Utloggad = bara på enheten, som
 * förut (webben kräver konto för hjärtat; appen sparar lokalt ändå).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import type { AppFeedEvent } from '@vadkul/kontrakt';
import { NYCKEL, useLagrad } from './lagring';
import { rensaSparade, slåIhopSparade, växlaSparad } from './sparade';
import { useKonto } from './kontoContext';
import { läsIdLista, sättSparad } from '@/data/anvandare';
import { räknaGilla } from '@/data/eventStats';
import { fetchEventSomFlöde } from '@/api/eventDetalj';

export interface SparadeState {
    sparade: readonly AppFeedEvent[];
    ärSparad: (id: string) => boolean;
    växla: (e: AppFeedEvent) => void;
}

const SparadeContext = createContext<SparadeState | null>(null);

export function SparadeProvider({ children }: { children: ReactNode }) {
    const [lista, setLista, laddad] = useLagrad<AppFeedEvent[]>(NYCKEL.sparade, []);
    const { användare } = useKonto();
    const listaRef = useRef(lista);
    listaRef.current = lista;
    const uidRef = useRef<string | null>(null);
    uidRef.current = användare?.uid ?? null;

    // Inloggning: enhetens hjärtan upp till kontot, kontots ner till enheten.
    useEffect(() => {
        if (!användare || !laddad) return;
        let aktiv = true;
        (async () => {
            try {
                const remote = await läsIdLista(användare.uid, 'savedEventIds');
                const lokala = new Set(listaRef.current.map(e => e.id));
                for (const id of lokala) if (!remote.includes(id)) void sättSparad(användare.uid, id, true).catch(() => {});
                const saknas = remote.filter(id => !lokala.has(id)).slice(-40);
                const hämtade = (await Promise.all(saknas.map(id => fetchEventSomFlöde(id).catch(() => null))))
                    .filter((e): e is AppFeedEvent => !!e);
                if (aktiv && hämtade.length) setLista(prev => slåIhopSparade(prev, hämtade));
            } catch { /* offline - synkas vid nästa inloggning */ }
        })();
        return () => { aktiv = false; };
    }, [användare, laddad, setLista]);

    const växla = useCallback((e: AppFeedEvent) => {
        const på = !listaRef.current.some(x => x.id === e.id);
        setLista(prev => växlaSparad(prev, e));
        const uid = uidRef.current;
        if (uid) {
            void sättSparad(uid, e.id, på).catch(() => {});
            räknaGilla(e.id, på ? 1 : -1);
        }
    }, [setLista]);

    const sparade = useMemo(() => (laddad ? rensaSparade(lista, Date.now()) : lista), [lista, laddad]);
    const ids = useMemo(() => new Set(sparade.map(e => e.id)), [sparade]);
    const ärSparad = useCallback((id: string) => ids.has(id), [ids]);

    const value = useMemo(() => ({ sparade, ärSparad, växla }), [sparade, ärSparad, växla]);
    return <SparadeContext.Provider value={value}>{children}</SparadeContext.Provider>;
}

export function useSparade(): SparadeState {
    const ctx = useContext(SparadeContext);
    if (!ctx) throw new Error('useSparade kräver SparadeProvider (rotlayouten).');
    return ctx;
}
