/**
 * Moderering i chatten - Firestore-rören för anmälan och blockering (App
 * Store-regel 1.2). Dokumentformerna och filtret är REN logik i
 * lib/moderering (testad); här bor bara skrivningarna och en liten delad
 * butik så att chatten i eventkortet och Vänner i profilen ser samma
 * blockeringslista utan att läsa den två gånger.
 *
 * Webben har ingen motsvarighet än (varken anmälan eller blockering i
 * EventChatPanel/FriendsSection) - när den får det ska den skriva samma
 * dokument: reports/{auto-id} och users/{uid}/blocked/{blockeradUid}.
 *
 * REGLERNA: reports-create släpps redan igenom (§6, öppen för inloggade sedan
 * länge - den skärpta, formlåsta varianten ligger i firestore.rules och
 * väntar på deploy). users/{uid}/blocked är NY i reglerna: tills den är
 * deployad nekas både läsning och blockering, och UI:t säger "kunde inte
 * blockera" i stället för att låtsas.
 *
 * Läsningar: blockeringslistan hämtas EN gång per inloggat konto och
 * appsession (getDocs, ingen stående lyssnare - reads-budgeten), först när
 * en chatt eller Vänner-mappen faktiskt visas.
 */
import { useEffect, useSyncExternalStore } from 'react';
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDocs,
    getFirestore,
    limit,
    query,
    serverTimestamp,
    writeBatch,
} from '@react-native-firebase/firestore';
import {
    avblockeraSkrivning,
    blockeraSkrivningar,
    läggTillDolt,
    parseBlockRad,
    type BlockRad,
    type ChattAnmälanDoc,
} from '@/lib/moderering';
import { läs, NYCKEL, skriv } from '@/lib/lagring';

interface Läge {
    /** Kontot listan gäller - byts kontot börjar butiken om. */
    uid: string | null;
    rader: BlockRad[];
    blockerade: ReadonlySet<string>;
    /** Meddelanden JAG anmält - dolda för mig, sparade på enheten. */
    dolda: ReadonlySet<string>;
    laddad: boolean;
}

const TOM_MÄNGD: ReadonlySet<string> = new Set();
let läge: Läge = { uid: null, rader: [], blockerade: TOM_MÄNGD, dolda: TOM_MÄNGD, laddad: false };
const lyssnare = new Set<() => void>();

function sätt(nytt: Partial<Läge>) {
    läge = { ...läge, ...nytt };
    if (nytt.rader) läge.blockerade = new Set(nytt.rader.map(r => r.uid));
    lyssnare.forEach(l => l());
}

function prenumerera(l: () => void) {
    lyssnare.add(l);
    return () => { lyssnare.delete(l); };
}

// ── DÖLJLISTAN (anmälda meddelanden) ──────────────────────────────────────

let doldaLista: string[] = [];
let doldaLaddade: Promise<void> | null = null;

function laddaDolda(): Promise<void> {
    if (!doldaLaddade) {
        doldaLaddade = läs<string[]>(NYCKEL.doldaMeddelanden, []).then(lista => {
            // Hann man anmäla något innan lagringen svarade vinner båda.
            const sparade = Array.isArray(lista) ? lista.filter(x => typeof x === 'string') : [];
            doldaLista = doldaLista.reduce((acc, id) => läggTillDolt(acc, id), sparade);
            sätt({ dolda: new Set(doldaLista) });
        });
    }
    return doldaLaddade;
}

/** Göm ett meddelande för mig (efter anmälan) - direkt och på enheten. */
export function döljMeddelande(id: string) {
    doldaLista = läggTillDolt(doldaLista, id);
    sätt({ dolda: new Set(doldaLista) });
    void skriv(NYCKEL.doldaMeddelanden, doldaLista);
}

// ── BLOCKERINGSLISTAN ─────────────────────────────────────────────────────

const blockedCol = (uid: string) => collection(getFirestore(), 'users', uid, 'blocked');

let pågående: { uid: string; p: Promise<void> } | null = null;

function laddaBlockerade(uid: string): Promise<void> {
    if (läge.uid === uid && läge.laddad) return Promise.resolve();
    if (pågående?.uid === uid) return pågående.p;
    if (läge.uid !== uid) sätt({ uid, rader: [], laddad: false });
    const p = getDocs(query(blockedCol(uid), limit(500)))
        .then(snap => snap.docs
            .map(d => parseBlockRad(d.id, d.data()))
            .filter((r): r is BlockRad => r !== null))
        // Nekat (reglerna ej deployade) eller nätfel: tom lista - chatten
        // visas som vanligt, och blockera säger själv till om den nekas.
        .catch(() => [] as BlockRad[])
        .then(laddade => {
            if (läge.uid !== uid) return;
            // Blockerade man någon medan listan hämtades ska raden inte tappas.
            const kända = new Set(laddade.map(r => r.uid));
            sätt({ rader: [...laddade, ...läge.rader.filter(r => !kända.has(r.uid))], laddad: true });
        })
        .finally(() => { if (pågående?.uid === uid) pågående = null; });
    pågående = { uid, p };
    return p;
}

export interface ModereringsVy {
    rader: BlockRad[];
    blockerade: ReadonlySet<string>;
    dolda: ReadonlySet<string>;
    laddad: boolean;
}

/**
 * Blockeringslistan + döljlistan för det inloggade kontot. uid null =
 * inget hämtas (utloggad, eller Vänner-mappen hopfälld) - dolda gäller ändå.
 */
export function useModerering(uid: string | null): ModereringsVy {
    const s = useSyncExternalStore(prenumerera, () => läge);
    useEffect(() => {
        void laddaDolda();
        if (uid) void laddaBlockerade(uid);
    }, [uid]);
    if (!uid || s.uid !== uid) {
        return { rader: [], blockerade: TOM_MÄNGD, dolda: s.dolda, laddad: false };
    }
    return s;
}

/** Blockera: min blocked-rad + båda vänraderna raderade i EN batch (en halv
 *  blockering där vänskapen överlevde vore värre än ingen). Kastar vid fel. */
export async function blockera(myUid: string, other: { uid: string; name?: string | null }): Promise<void> {
    const s = blockeraSkrivningar(myUid, other);
    if (!s) throw new Error('Ogiltig blockering');
    const db = getFirestore();
    const batch = writeBatch(db);
    batch.set(doc(db, 'users', s.block.owner, 'blocked', s.block.blocked), {
        ...s.block.data,
        createdAt: serverTimestamp(),
    });
    for (const w of s.vänner) batch.delete(doc(db, 'users', w.owner, 'friends', w.friend));
    await batch.commit();
    if (läge.uid === myUid) {
        const rad: BlockRad = { uid: other.uid, name: s.block.data?.name ?? null };
        sätt({ rader: [...läge.rader.filter(r => r.uid !== other.uid), rad] });
    }
}

/** Häv blockering - bara min rad; vänskapen kommer inte tillbaka. */
export async function avblockera(myUid: string, otherUid: string): Promise<void> {
    const w = avblockeraSkrivning(myUid, otherUid);
    if (!w) throw new Error('Ogiltig avblockering');
    await deleteDoc(doc(getFirestore(), 'users', w.owner, 'blocked', w.blocked));
    if (läge.uid === myUid) sätt({ rader: läge.rader.filter(r => r.uid !== otherUid) });
}

// ── ANMÄLAN ───────────────────────────────────────────────────────────────

/** Skicka anmälan till reports och göm meddelandet för mig. Kastar vid fel -
 *  anroparen erbjuder mejlet (chattAnmälanMailto) som reserv. */
export async function anmälChattMeddelande(d: ChattAnmälanDoc): Promise<void> {
    await addDoc(collection(getFirestore(), 'reports'), { ...d, createdAt: serverTimestamp() });
    döljMeddelande(d.messageId);
}
