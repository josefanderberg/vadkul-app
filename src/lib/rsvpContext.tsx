/**
 * Kommer/Intresserad-svaret som delat state - på ENHETEN (lib/rsvp), samma
 * mönster som sparadeContext. Webbens konto-/Firestore-sida (räknare,
 * avatarrad, users.goingEventIds) kopplas på när /v1-API:t är deployat.
 */
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { minRsvp as läsRsvp, TOM_RSVP, växlaRsvp, type RsvpLista, type RsvpStatus } from './rsvp';
import { NYCKEL, useLagrad } from './lagring';

export interface RsvpState {
    /** Mitt svar på eventet, eller null. */
    minRsvp: (id: string) => RsvpStatus | null;
    /** Ett tryck på knappen `tryckt` - togglar av/byter (webbens nextRsvp). */
    svara: (id: string, tryckt: RsvpStatus) => void;
}

const RsvpContext = createContext<RsvpState | null>(null);

export function RsvpProvider({ children }: { children: ReactNode }) {
    const [lista, setLista] = useLagrad<RsvpLista>(NYCKEL.rsvp, TOM_RSVP);

    const minRsvp = useCallback((id: string) => läsRsvp(lista, id), [lista]);
    const svara = useCallback(
        (id: string, tryckt: RsvpStatus) => setLista(prev => växlaRsvp(prev, id, tryckt)),
        [setLista],
    );

    const value = useMemo(() => ({ minRsvp, svara }), [minRsvp, svara]);
    return <RsvpContext.Provider value={value}>{children}</RsvpContext.Provider>;
}

export function useRsvp(): RsvpState {
    const ctx = useContext(RsvpContext);
    if (!ctx) throw new Error('useRsvp kräver RsvpProvider (rotlayouten).');
    return ctx;
}
