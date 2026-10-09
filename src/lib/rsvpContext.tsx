/**
 * Kommer/Intresserad-svaret som delat state - port av webbens handleSetRsvp
 * ((v2)/page.tsx). OPTIMISTISKT: enhetens lista (lib/rsvp, NYCKEL.rsvp)
 * styr knapparna direkt; i bakgrunden skrivs sedan 8/10 2026
 *  - svarsdokumentet eventRsvps/{slug}/svar/{uid} (data/rsvp) med en anonym
 *    session om man saknar konto ("okända från typ facebook ska räknas med"),
 *  - räknardeltan i eventStats på SERIENS id (data/eventStats),
 *  - kontots spegel users.goingEventIds/interestedEventIds när man är inloggad
 *    (ett id i taget, arrayUnion/arrayRemove - andra enheters svar skrivs aldrig över).
 * Vid inloggning slås kontots listor ihop med enhetens (Kommer vinner vid krock).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { minRsvp as läsRsvp, nextRsvp, rsvpDeltan, rsvpShareId, TOM_RSVP, växlaRsvp, type RsvpLista, type RsvpStatus } from './rsvp';
import { NYCKEL, useLagrad } from './lagring';
import { useKonto } from './kontoContext';
import { sparaRsvp } from '@/data/rsvp';
import { räknaRsvp } from '@/data/eventStats';
import { läsIdLista, sättRsvpId } from '@/data/anvandare';

/** Det som behövs av ett event för att svara på det. */
export interface RsvpEvent { id: string; userCreated?: boolean }

export interface RsvpState {
    /** Mitt svar på eventet, eller null. */
    minRsvp: (id: string) => RsvpStatus | null;
    /** Ett tryck på knappen `tryckt` - togglar av/byter (webbens nextRsvp). */
    svara: (e: RsvpEvent, tryckt: RsvpStatus) => void;
}

const RsvpContext = createContext<RsvpState | null>(null);

export function RsvpProvider({ children }: { children: ReactNode }) {
    const [lista, setLista, laddad] = useLagrad<RsvpLista>(NYCKEL.rsvp, TOM_RSVP);
    const { användare, säkerställIdentitet } = useKonto();
    const listaRef = useRef(lista);
    listaRef.current = lista;
    const användareRef = useRef(användare);
    användareRef.current = användare;

    // Inloggning: hämta kontots svar och slå ihop med enhetens.
    useEffect(() => {
        if (!användare || !laddad) return;
        let aktiv = true;
        (async () => {
            try {
                const [going, interested] = await Promise.all([
                    läsIdLista(användare.uid, 'goingEventIds'),
                    läsIdLista(användare.uid, 'interestedEventIds'),
                ]);
                if (!aktiv) return;
                setLista(prev => {
                    const g = new Set([...prev.going, ...going]);
                    const i = [...new Set([...prev.interested, ...interested])].filter(id => !g.has(id));
                    return { going: [...g], interested: i };
                });
            } catch { /* offline - enhetens lista gäller tills nästa inloggning */ }
        })();
        return () => { aktiv = false; };
    }, [användare, laddad, setLista]);

    const minRsvp = useCallback((id: string) => läsRsvp(lista, id), [lista]);

    const svara = useCallback((e: RsvpEvent, tryckt: RsvpStatus) => {
        const prev = läsRsvp(listaRef.current, e.id);
        const nästa = nextRsvp(prev, tryckt);
        setLista(l => växlaRsvp(l, e.id, tryckt));
        räknaRsvp(rsvpShareId(e.id, e.userCreated), rsvpDeltan(prev, nästa));
        const inloggad = användareRef.current;
        void (async () => {
            try {
                const uid = await säkerställIdentitet();
                await sparaRsvp(e.id, e.userCreated, uid, nästa, { name: inloggad?.displayName ?? null });
                if (inloggad) await sättRsvpId(inloggad.uid, e.id, nästa);
            } catch {
                // Offline/regler - eget läge står kvar på enheten.
            }
        })();
    }, [setLista, säkerställIdentitet]);

    const value = useMemo(() => ({ minRsvp, svara }), [minRsvp, svara]);
    return <RsvpContext.Provider value={value}>{children}</RsvpContext.Provider>;
}

export function useRsvp(): RsvpState {
    const ctx = useContext(RsvpContext);
    if (!ctx) throw new Error('useRsvp kräver RsvpProvider (rotlayouten).');
    return ctx;
}
