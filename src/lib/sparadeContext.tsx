/**
 * Sparade event (webbens hjärta, "gilla") - på ENHETEN tills konton finns
 * (plattformsplanens fas 3). Eventet sparas som ögonblicksbild, så listan i
 * profilen funkar offline och för event i andra län än kartans - det är
 * appens mervärde enligt planen (§6: "favoriter cacheas lokalt").
 *
 * Webbens gilla-RÄKNARE (eventStats.likes) och påminnelsen 1 h före kräver
 * konto och API - de kommer med fas 3, inte här.
 */
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import type { AppFeedEvent } from '@vadkul/kontrakt';
import { NYCKEL, useLagrad } from './lagring';
import { rensaSparade, växlaSparad } from './sparade';

export interface SparadeState {
    sparade: readonly AppFeedEvent[];
    ärSparad: (id: string) => boolean;
    växla: (e: AppFeedEvent) => void;
}

const SparadeContext = createContext<SparadeState | null>(null);

export function SparadeProvider({ children }: { children: ReactNode }) {
    const [lista, setLista, laddad] = useLagrad<AppFeedEvent[]>(NYCKEL.sparade, []);

    const växla = useCallback((e: AppFeedEvent) => setLista(prev => växlaSparad(prev, e)), [setLista]);
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
