/**
 * Den klistriga dagrubriken i kortets listor (Josef 13/10: "när man scrollar
 * nedåt ... den ska ju vara sticky i toppen så man ser vilken dag man är
 * på. både på eventkortet och multieventkortet"). Webben gör det med CSS
 * position: sticky på dagrubrikerna. RN:s stickyHeaderIndices tar bara
 * scrollvyns DIREKTA barn och dagarna ligger djupt i listorna, så varje
 * dagsektion anmäler sin plats i scrollinnehållet och EventKort lägger en
 * kopia av rubriken överst i scrollytan. Ren logik så den kan testas.
 */

/** En dagsektion (rubrik + rader) i scrollinnehållets koordinater. */
export type DagPlats = { y: number; höjd: number; offset: number };

/**
 * Rubriken som ska stå klistrad överst, med samma regel som CSS sticky inom
 * sin sektion: sektionen vars topp passerat scrollytans överkant men inte
 * dess botten. `skjut` (≤ 0) trycker upp rubriken när sektionens slut når
 * den, så nästa dags rubrik skjuter undan den i stället för att lägga sig
 * över. null = ingen (rubriken syns på sin egen plats i listan).
 */
export function klistradDag(
    platser: readonly DagPlats[],
    scrollY: number,
    rubrikHöjd: number,
): { offset: number; skjut: number } | null {
    let aktuell: DagPlats | null = null;
    for (const p of platser) {
        if (p.y < scrollY && scrollY < p.y + p.höjd && (!aktuell || p.y > aktuell.y)) aktuell = p;
    }
    if (!aktuell) return null;
    const skjut = Math.min(0, Math.round(aktuell.y + aktuell.höjd - rubrikHöjd - scrollY));
    return { offset: aktuell.offset, skjut };
}
