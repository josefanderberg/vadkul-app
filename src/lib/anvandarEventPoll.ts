/**
 * När de användarskapade eventen behöver hämtas på nytt - port av webbens
 * utils/userEventPoll.ts (decideUserEventPoll) och pollen i
 * services/linkEventService.ts (pollUserEvents). Ändras webben ska kopian följa.
 *
 * BAKGRUND (webben 20/9): att hämta ALLA userCreated-dokument var 30:e
 * sekund kostar ett read per dokument och var ~90 % av kontots ~400 000
 * reads/dygn. I stället pollas en count()-aggregering (ETT read oavsett
 * antal) och hela listan hämtas bara när ANTALET ändrats - någon har skapat
 * eller tagit bort ett event. Redigeringar ändrar inte antalet; de fångas av
 * säkerhetsnätet, en full hämtning med jämna mellanrum.
 *
 * Ordningen är fail-safe: varje läge där vi inte SÄKERT vet att datan är
 * oförändrad ger 'hämta'. Gamla event på kartan är ett värre fel än ett
 * extra hämtvarv.
 */

/** Pollens takt (webbens setInterval). Bara när appen är aktiv - webbens
 *  visibility-vakt motsvaras av AppState 'active', och en återkomst till
 *  förgrunden pollar direkt. */
export const POLL_INTERVALL_MS = 30_000;

/**
 * Full hämtning minst så här ofta även om antalet står stilla - taket för
 * hur länge en redigering kan vara osynlig. Sänk den inte till sekundnivå:
 * nätet kostar (antal event / 15) reads per minut och enhet.
 */
export const SÄKERHETSNÄT_MS = 15 * 60 * 1000;

/** 'hämta' = hämta hela listan. 'hoppa' = inget har ändrats, gör inget. */
export type PollBeslut = 'hämta' | 'hoppa';

export interface PollLäge {
    /** Klockan nu (Date.now()). */
    nuMs: number;
    /** När den senaste FULLA hämtningen gjordes, null om ingen gjorts än. */
    senasteHämtningMs: number | null;
    /** Antalet dokument den senaste fulla hämtningen såg (dess `total`), eller null. */
    senasteAntal: number | null;
    /** Antalet count() nyss gav - **null när proben misslyckades**. Null betyder "vet inte", aldrig "noll event". */
    probatAntal: number | null;
    /** Överstyr säkerhetsnätet (tester). */
    nätMs?: number;
}

export function avgörAnvändarEventPoll(l: PollLäge): PollBeslut {
    const nätMs = l.nätMs ?? SÄKERHETSNÄT_MS;

    // Inget hämtat än → första hämtningen.
    if (l.senasteHämtningMs === null || l.senasteAntal === null) return 'hämta';

    // Proben misslyckades: hellre en dyr runda än en karta som tyst fryser.
    if (l.probatAntal === null) return 'hämta';

    // Antalet ändrat = event skapat eller borttaget → måste synas nu.
    if (l.probatAntal !== l.senasteAntal) return 'hämta';

    // Antalet står stilla, men redigeringar syns inte i det. Nätet
    // (>= så att exakt utlupen tid räknas som utlupen).
    if (l.nuMs - l.senasteHämtningMs >= nätMs) return 'hämta';

    return 'hoppa';
}
