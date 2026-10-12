import { describe, expect, it } from 'vitest';
import { RAPPORT_MOTTAGARE } from './rapportera';
import {
    ANMÄLAN_TAK,
    avblockeraSkrivning,
    avsändarNamn,
    blockeraSkrivningar,
    genitiv,
    chattAnmälanDoc,
    chattAnmälanMailto,
    kanModereras,
    läggTillDolt,
    parseBlockRad,
    sorteraBlockerade,
    synligaMeddelanden,
    type ChattAnmälanUnderlag,
} from './moderering';

const underlag = (extra: Partial<ChattAnmälanUnderlag> = {}): ChattAnmälanUnderlag => ({
    chatt: 'publik',
    eventId: 'https://exempel.se/event/1',
    eventTitle: 'Loppis i Hudiksvall',
    trådId: null,
    meddelande: { id: 'm1', senderId: 'anna', senderName: 'Anna', text: 'Dumt skrivet' },
    skäl: 'Stötande eller kränkande',
    anmälare: 'jag',
    ...extra,
});

/** Nycklarna reports-regeln i firestore.rules släpper igenom (utom createdAt
 *  som data/anmalan lägger på). */
const TILLÅTNA = ['type', 'chat', 'eventId', 'eventTitle', 'threadId', 'messageId', 'senderId', 'senderName', 'text', 'reason', 'reporterUid'];

describe('kanModereras', () => {
    it('andras meddelanden går att anmäla', () => {
        expect(kanModereras({ senderId: 'anna' }, 'jag')).toBe(true);
    });

    it('egna, avsändarlösa och utloggat går inte', () => {
        expect(kanModereras({ senderId: 'jag' }, 'jag')).toBe(false);
        expect(kanModereras({ senderId: '' }, 'jag')).toBe(false);
        expect(kanModereras({}, 'jag')).toBe(false);
        expect(kanModereras({ senderId: 'anna' }, null)).toBe(false);
    });
});

describe('chattAnmälanDoc', () => {
    it('bygger ett publikt anmälningsdokument med ögonblicksbilden', () => {
        expect(chattAnmälanDoc(underlag())).toEqual({
            type: 'chatMessage',
            chat: 'public',
            eventId: 'https://exempel.se/event/1',
            eventTitle: 'Loppis i Hudiksvall',
            messageId: 'm1',
            senderId: 'anna',
            senderName: 'Anna',
            text: 'Dumt skrivet',
            reason: 'Stötande eller kränkande',
            reporterUid: 'jag',
        });
    });

    it('privat chatt bär trådens id', () => {
        const d = chattAnmälanDoc(underlag({ chatt: 'privat', trådId: 'inbjudaren' }));
        expect(d?.chat).toBe('private');
        expect(d?.threadId).toBe('inbjudaren');
    });

    it('privat chatt utan tråd-id är ogiltig', () => {
        expect(chattAnmälanDoc(underlag({ chatt: 'privat', trådId: null }))).toBeNull();
    });

    it('publik chatt tar aldrig med tråd-id', () => {
        expect(chattAnmälanDoc(underlag({ trådId: 'x' }))).not.toHaveProperty('threadId');
    });

    it('vägrar eget meddelande, saknat id/avsändare och tomt event', () => {
        expect(chattAnmälanDoc(underlag({ anmälare: 'anna' }))).toBeNull();
        expect(chattAnmälanDoc(underlag({ meddelande: { senderId: 'anna', text: 'x' } }))).toBeNull();
        expect(chattAnmälanDoc(underlag({ meddelande: { id: 'm1', text: 'x' } }))).toBeNull();
        expect(chattAnmälanDoc(underlag({ eventId: '' }))).toBeNull();
        expect(chattAnmälanDoc(underlag({ anmälare: '' }))).toBeNull();
    });

    it('utelämnar tomt avsändarnamn i stället för att skicka en tom sträng', () => {
        const d = chattAnmälanDoc(underlag({ meddelande: { id: 'm1', senderId: 'anna', senderName: '  ', text: 'x' } }));
        expect(d).not.toHaveProperty('senderName');
    });

    it('håller sig inom reglernas nycklar och tak', () => {
        const lång = 'x'.repeat(5000);
        const d = chattAnmälanDoc(underlag({
            chatt: 'privat',
            trådId: 'tråd',
            eventId: lång,
            eventTitle: lång,
            meddelande: { id: 'm1', senderId: 'anna', senderName: lång, text: lång },
        }))!;
        expect(Object.keys(d).every(k => TILLÅTNA.includes(k))).toBe(true);
        expect(d.eventId.length).toBe(ANMÄLAN_TAK.eventId);
        expect(d.eventTitle.length).toBe(ANMÄLAN_TAK.eventTitle);
        expect(d.senderName!.length).toBe(ANMÄLAN_TAK.senderName);
        expect(d.text.length).toBe(ANMÄLAN_TAK.text);
    });

    it('vägrar id:n längre än reglernas tak hellre än att klippa dem (de ska gå att slå upp)', () => {
        const långtId = 'a'.repeat(ANMÄLAN_TAK.id + 1);
        expect(chattAnmälanDoc(underlag({ meddelande: { id: långtId, senderId: 'anna', text: 'x' } }))).toBeNull();
        expect(chattAnmälanDoc(underlag({ meddelande: { id: 'm1', senderId: långtId, text: 'x' } }))).toBeNull();
    });
});

describe('chattAnmälanMailto', () => {
    const d = chattAnmälanDoc(underlag({ chatt: 'privat', trådId: 'inbjudaren' }))!;

    it('adresserar supportbrevlådan', () => {
        expect(chattAnmälanMailto(d).startsWith(`mailto:${RAPPORT_MOTTAGARE}?subject=`)).toBe(true);
    });

    it('bär event-id, meddelande-id, avsändarens uid, texten och skälet', () => {
        const body = decodeURIComponent(chattAnmälanMailto(d).split('&body=')[1]);
        expect(body).toContain('Event-id: https://exempel.se/event/1');
        expect(body).toContain('Meddelande-id: m1');
        expect(body).toContain('uid anna');
        expect(body).toContain('Dumt skrivet');
        expect(body).toContain('Skäl: Stötande eller kränkande');
        expect(body).toContain('Tråd: inbjudaren');
    });

    it('url-kodar så mellanslag och å ä ö överlever', () => {
        expect(chattAnmälanMailto(d)).not.toMatch(/subject=[^&]* /);
    });
});

describe('synligaMeddelanden', () => {
    const msgs = [
        { id: 'a1', senderId: 'anna', text: 'hej' },
        { id: 'b1', senderId: 'bertil', text: 'tja' },
        { id: 'j1', senderId: 'jag', text: 'mitt' },
        { id: 'b2', senderId: 'bertil', text: 'igen' },
    ];

    it('döljer blockerade avsändare', () => {
        expect(synligaMeddelanden(msgs, 'jag', new Set(['bertil']), new Set()).map(m => m.id)).toEqual(['a1', 'j1']);
    });

    it('döljer meddelanden jag anmält', () => {
        expect(synligaMeddelanden(msgs, 'jag', new Set(), new Set(['a1'])).map(m => m.id)).toEqual(['b1', 'j1', 'b2']);
    });

    it('mina egna syns alltid', () => {
        expect(synligaMeddelanden(msgs, 'jag', new Set(['jag']), new Set(['j1'])).map(m => m.id)).toContain('j1');
    });

    it('samma array tillbaka när inget ska döljas (inga onödiga omritningar)', () => {
        expect(synligaMeddelanden(msgs, 'jag', new Set(), new Set())).toBe(msgs);
    });

    it('muterar inte indata', () => {
        synligaMeddelanden(msgs, 'jag', new Set(['anna']), new Set());
        expect(msgs).toHaveLength(4);
    });
});

describe('avsändarNamn + genitiv', () => {
    it('avsändarnamnet, annars "användaren"', () => {
        expect(avsändarNamn({ senderName: ' Anna ' })).toBe('Anna');
        expect(avsändarNamn({ senderName: '' })).toBe('användaren');
        expect(avsändarNamn({})).toBe('användaren');
    });

    it('lägger på s utom efter s, x och z', () => {
        expect(genitiv('Anna')).toBe('Annas');
        expect(genitiv('Lars')).toBe('Lars');
        expect(genitiv('Max')).toBe('Max');
        expect(genitiv('användaren')).toBe('användarens');
    });
});

describe('läggTillDolt', () => {
    it('lägger till nyast sist utan dubbletter', () => {
        expect(läggTillDolt(['a', 'b'], 'a')).toEqual(['b', 'a']);
        expect(läggTillDolt(['a'], 'b')).toEqual(['a', 'b']);
    });

    it('äldsta faller bort över taket', () => {
        expect(läggTillDolt(['a', 'b', 'c'], 'd', 3)).toEqual(['b', 'c', 'd']);
    });

    it('tomt id ändrar ingenting', () => {
        expect(läggTillDolt(['a'], '')).toEqual(['a']);
    });
});

describe('parseBlockRad', () => {
    it('tolkar en rad med och utan namn', () => {
        expect(parseBlockRad('anna', { name: ' Anna ' })).toEqual({ uid: 'anna', name: 'Anna' });
        expect(parseBlockRad('anna', {})).toEqual({ uid: 'anna', name: null });
    });

    it('avvisar skräp och tomt id', () => {
        expect(parseBlockRad('', { name: 'x' })).toBeNull();
        expect(parseBlockRad('anna', null)).toBeNull();
        expect(parseBlockRad('anna', 'sträng')).toBeNull();
    });
});

describe('blockeraSkrivningar', () => {
    it('skriver min blocked-rad och river vänskapen åt båda håll', () => {
        expect(blockeraSkrivningar('jag', { uid: 'anna', name: 'Anna' })).toEqual({
            block: { owner: 'jag', blocked: 'anna', data: { name: 'Anna' } },
            vänner: [
                { owner: 'jag', friend: 'anna', data: null },
                { owner: 'anna', friend: 'jag', data: null },
            ],
        });
    });

    it('namnet klipps till reglernas 80 tecken och utelämnas när det saknas', () => {
        expect(blockeraSkrivningar('jag', { uid: 'anna', name: 'x'.repeat(200) })!.block.data!.name).toHaveLength(80);
        expect(blockeraSkrivningar('jag', { uid: 'anna', name: null })!.block.data).toEqual({});
    });

    it('man kan inte blockera sig själv', () => {
        expect(blockeraSkrivningar('jag', { uid: 'jag' })).toBeNull();
        expect(blockeraSkrivningar('', { uid: 'anna' })).toBeNull();
    });
});

describe('avblockeraSkrivning', () => {
    it('raderar bara min rad', () => {
        expect(avblockeraSkrivning('jag', 'anna')).toEqual({ owner: 'jag', blocked: 'anna', data: null });
    });

    it('ogiltigt mot sig själv', () => {
        expect(avblockeraSkrivning('jag', 'jag')).toBeNull();
    });
});

describe('sorteraBlockerade', () => {
    it('namnordning på svenska, namnlösa sist', () => {
        const rader = [
            { uid: '3', name: null },
            { uid: '1', name: 'Örjan' },
            { uid: '2', name: 'Åsa' },
            { uid: '4', name: 'Anna' },
        ];
        expect(sorteraBlockerade(rader).map(r => r.uid)).toEqual(['4', '2', '1', '3']);
        expect(rader[0].uid).toBe('3');
    });
});
