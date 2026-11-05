/**
 * Listskärmarnas halva av tillbakavägen från kartan (lib/listRetur): håller
 * reda på scrolläget medan man läser, och när skärmen öppnas som retur rullar
 * den tillbaka dit man var.
 *
 * Huvudet (hero, spotlight, önskningar) kan växa en stund efter öppningen när
 * cachen svarar - därför rullas det om vid varje storleksändring de första
 * sekunderna, tills man själv börjar dra i listan.
 */
import { useCallback, useEffect, useRef } from 'react';
import type { ListLäge } from './listRetur';

/** Det listans ref ger (SectionList/Animated.SectionList). */
interface Rullbar {
    getScrollResponder?: () => { scrollTo?: (o: { x?: number; y?: number; animated?: boolean }) => void } | null | undefined;
}

const OMRULLNING_MS = 2500;

export function useListRetur(listRef: { current: Rullbar | null }, läge: ListLäge | null) {
    const yRef = useRef(0);
    // Tidpunkten skärmen monterades - sätts i en effekt (inte under renderingen).
    const start = useRef(0);
    const släppt = useRef(läge === null);
    useEffect(() => { start.current = Date.now(); }, []);

    /** Anropas med listans contentOffset.y vid scroll. */
    const följY = useCallback((y: number) => { yRef.current = y; }, []);

    /** Läget just nu - följer med returlänken när ett event öppnas. */
    const nuvarandeLäge = useCallback((id: string | null): ListLäge => ({ y: yRef.current, id }), []);

    /** onContentSizeChange: rulla till returläget när innehållet räcker dit. */
    const vidStorlek = useCallback((_b: number, höjd: number) => {
        if (släppt.current || !läge) return;
        if (Date.now() - start.current > OMRULLNING_MS) {
            släppt.current = true;
            return;
        }
        if (höjd < läge.y) return;
        listRef.current?.getScrollResponder?.()?.scrollTo?.({ y: läge.y, animated: false });
    }, [läge, listRef]);

    /** onScrollBeginDrag: man rullar själv - returläget släpps. */
    const vidDrag = useCallback(() => { släppt.current = true; }, []);

    return { följY, nuvarandeLäge, vidStorlek, vidDrag };
}
