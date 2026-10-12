/**
 * Moderering i chatten - anmäl meddelanden och blockera användare (App
 * Store-regel 1.2: användarskapat innehåll kräver anmälan, blockering och en
 * kontaktväg). REN logik: dokumentformerna som Firestore-reglerna låser,
 * filtret som döljer blockerade/anmälda meddelanden och skrivningarna för
 * blockeringen. Rören bor i data/blockering och data/anmalan.
 *
 * ANMÄLAN går till reports/{auto-id} (firestore.rules §6, admin läser) i
 * stället för bara ett mejl: mailto kräver en konfigurerad mejlapp och att
 * användaren faktiskt trycker Skicka - avbryter hen finns ingen anmälan alls.
 * Dokumentet sparar en ögonblicksbild av meddelandet (text, avsändare) så
 * granskningen inte hänger på att originalet finns kvar. Mejlet
 * (chattAnmälanMailto, samma mottagare som lib/rapportera) är reserven när
 * skrivningen inte går fram.
 *
 * BLOCKERING bor i en EGEN lista users/{uid}/blocked/{blockeradUid} - inte i
 * vänrelationen (lib/vanStatus). Vändokumenten läses och raderas av BÅDA
 * parter (reglerna), så en 'blocked'-status där hade både avslöjat
 * blockeringen och låtit den blockerade häva den själv. Listan läses bara av
 * ägaren. Att blockera tar samtidigt bort en ev. vänskap (båda raderna, i
 * samma batch) - annars hade den blockerade fortsatt se ens svar via
 * vänprofilen. Meddelandena göms på klienten för den som blockerat, i både
 * publik och privat chatt; reglerna stänger dessutom ens EGEN privata tråd
 * och vänförfrågningar för den blockerade.
 */
import { RAPPORT_MOTTAGARE } from '@/lib/rapportera';
import { friendRemoveWrites, type FriendWrite } from '@/lib/vanStatus';

export const CHATT_ANMÄLAN_SKÄL = [
    'Stötande eller kränkande',
    'Hot eller trakasserier',
    'Spam eller bedrägeri',
    'Något annat',
] as const;

export type ChattAnmälanSkäl = (typeof CHATT_ANMÄLAN_SKÄL)[number];

export type ChattTyp = 'publik' | 'privat';

/** Fältens tak - SAMMA siffror som reports-regeln i firestore.rules. */
export const ANMÄLAN_TAK = {
    eventId: 1400,
    eventTitle: 200,
    id: 128,
    senderName: 80,
    text: 500,
    reason: 80,
} as const;

/** Det som syns i en chattbubbla - ChatMessage ur kontraktet, defensivt. */
export interface ChattMeddelandeLite {
    id?: string;
    senderId?: string;
    senderName?: string;
    text?: string;
}

export interface ChattAnmälanUnderlag {
    chatt: ChattTyp;
    eventId: string;
    eventTitle: string;
    /** Privata trådens id (= inbjudarens uid). null i publika chatten. */
    trådId: string | null;
    meddelande: ChattMeddelandeLite;
    skäl: ChattAnmälanSkäl;
    /** Den som anmäler. */
    anmälare: string;
}

/** reports-dokumentet (createdAt läggs på som serverTimestamp i data/anmalan). */
export interface ChattAnmälanDoc {
    type: 'chatMessage';
    chat: 'public' | 'private';
    eventId: string;
    eventTitle: string;
    threadId?: string;
    messageId: string;
    senderId: string;
    senderName?: string;
    text: string;
    reason: ChattAnmälanSkäl;
    reporterUid: string;
}

const ren = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** Går meddelandet att anmäla/blockera? Bara ANDRAS meddelanden med en
 *  avsändare - sina egna modererar man inte. */
export function kanModereras(msg: ChattMeddelandeLite, myUid: string | null): boolean {
    const avsändare = ren(msg.senderId);
    return !!myUid && avsändare.length > 0 && avsändare !== myUid;
}

/**
 * Bygg reports-dokumentet. null = går inte att anmäla (eget meddelande,
 * saknat id/avsändare/event) - då ska UI:t inte ens ha erbjudit det.
 * Allt klipps till reglernas tak så skrivningen aldrig nekas på längd.
 */
export function chattAnmälanDoc(u: ChattAnmälanUnderlag): ChattAnmälanDoc | null {
    const messageId = ren(u.meddelande.id);
    const senderId = ren(u.meddelande.senderId);
    const eventId = u.eventId.slice(0, ANMÄLAN_TAK.eventId);
    const reporterUid = ren(u.anmälare);
    if (!messageId || messageId.length > ANMÄLAN_TAK.id) return null;
    if (!senderId || senderId.length > ANMÄLAN_TAK.id) return null;
    if (!eventId || !reporterUid || senderId === reporterUid) return null;
    const trådId = u.chatt === 'privat' ? ren(u.trådId) : '';
    if (u.chatt === 'privat' && (!trådId || trådId.length > ANMÄLAN_TAK.id)) return null;
    const senderName = ren(u.meddelande.senderName).slice(0, ANMÄLAN_TAK.senderName);
    return {
        type: 'chatMessage',
        chat: u.chatt === 'privat' ? 'private' : 'public',
        eventId,
        eventTitle: ren(u.eventTitle).slice(0, ANMÄLAN_TAK.eventTitle),
        ...(trådId ? { threadId: trådId } : {}),
        messageId,
        senderId,
        ...(senderName ? { senderName } : {}),
        text: (typeof u.meddelande.text === 'string' ? u.meddelande.text : '').slice(0, ANMÄLAN_TAK.text),
        reason: u.skäl,
        reporterUid,
    };
}

/** Reserven när reports-skrivningen inte går fram: samma innehåll som mejl
 *  till hej@vadkul.se (lib/rapporteras mottagare och mailto-form). */
export function chattAnmälanMailto(d: ChattAnmälanDoc): string {
    const ämne = `Anmält chattmeddelande: ${d.eventTitle || d.eventId}`;
    const rader = [
        `Skäl: ${d.reason}`,
        '',
        `Chatt: ${d.chat === 'private' ? 'privat' : 'publik'}`,
        `Event: ${d.eventTitle}`,
        `Event-id: ${d.eventId}`,
    ];
    if (d.threadId) rader.push(`Tråd: ${d.threadId}`);
    rader.push(
        `Meddelande-id: ${d.messageId}`,
        `Avsändare: ${d.senderName ?? '(namnlös)'} (uid ${d.senderId})`,
        `Anmält av: ${d.reporterUid}`,
        '',
        'Meddelandet:',
        d.text,
        '',
        'Beskriv gärna vad som hänt:',
        '',
    );
    return `mailto:${RAPPORT_MOTTAGARE}?subject=${encodeURIComponent(ämne)}&body=${encodeURIComponent(rader.join('\n'))}`;
}

/**
 * Det som visas i en chatt: blockerade avsändares meddelanden och de
 * meddelanden JAG anmält göms. Mina egna visas alltid (även om någon skulle
 * ha lyckats blockera sig själv). Muterar inte indata.
 */
export function synligaMeddelanden<T extends ChattMeddelandeLite>(
    messages: T[],
    myUid: string | null,
    blockerade: ReadonlySet<string>,
    dolda: ReadonlySet<string>,
): T[] {
    if (blockerade.size === 0 && dolda.size === 0) return messages;
    return messages.filter(m => {
        const avsändare = ren(m.senderId);
        if (myUid && avsändare === myUid) return true;
        if (avsändare && blockerade.has(avsändare)) return false;
        if (m.id && dolda.has(m.id)) return false;
        return true;
    });
}

/** Namnet som visas i menyn - avsändarnamnet eller "användaren". */
export function avsändarNamn(msg: ChattMeddelandeLite): string {
    return ren(msg.senderName) || 'användaren';
}

/** Svensk genitiv: "Annas", men "Lars" och "Max" utan extra s. */
export function genitiv(namn: string): string {
    return /[sxz]$/i.test(namn) ? namn : `${namn}s`;
}

/** Lägg ett anmält meddelande-id i den lokala döljlistan - nyast sist,
 *  äldsta faller bort över taket (listan sparas på enheten). */
export function läggTillDolt(dolda: readonly string[], id: string, tak = 200): string[] {
    if (!id) return [...dolda];
    const utan = dolda.filter(d => d !== id);
    return [...utan, id].slice(-tak);
}

// ── BLOCKERINGSLISTAN ─────────────────────────────────────────────────────

/** En rad i MIN blocked-undersamling - uid är den blockerades. */
export interface BlockRad {
    uid: string;
    name: string | null;
}

/** Tolka ett blocked-dokument defensivt (som parseFriendRow). */
export function parseBlockRad(id: string, data: unknown): BlockRad | null {
    if (!id || !data || typeof data !== 'object') return null;
    const d = data as Record<string, unknown>;
    const name = ren(d.name);
    return { uid: id, name: name || null };
}

/** Skrivningen för blocked-dokumentet. data null = radera (häv). */
export interface BlockWrite {
    owner: string;
    blocked: string;
    data: { name?: string } | null;
}

export interface BlockeraSkrivningar {
    block: BlockWrite;
    /** Vänskapen rivs i samma batch (båda raderna, lib/vanStatus). */
    vänner: FriendWrite[];
}

/** Blockera: min blocked-rad (med namnet denormaliserat för listan i
 *  profilen) + radering av båda vänraderna. null = ogiltigt (sig själv). */
export function blockeraSkrivningar(
    myUid: string,
    other: { uid: string; name?: string | null },
): BlockeraSkrivningar | null {
    if (!myUid || !other.uid || myUid === other.uid) return null;
    const name = ren(other.name).slice(0, 80);
    return {
        block: { owner: myUid, blocked: other.uid, data: name ? { name } : {} },
        vänner: friendRemoveWrites(myUid, other.uid),
    };
}

/** Häv blockering: bara min rad raderas - vänskapen kommer inte tillbaka. */
export function avblockeraSkrivning(myUid: string, otherUid: string): BlockWrite | null {
    if (!myUid || !otherUid || myUid === otherUid) return null;
    return { owner: myUid, blocked: otherUid, data: null };
}

/** Listan i profilen: namnordning (sv), namnlösa sist. Muterar inte indata. */
export function sorteraBlockerade(rader: readonly BlockRad[]): BlockRad[] {
    return [...rader].sort((a, b) => {
        if (a.name === null && b.name === null) return a.uid < b.uid ? -1 : 1;
        if (a.name === null) return 1;
        if (b.name === null) return -1;
        return a.name.localeCompare(b.name, 'sv');
    });
}
