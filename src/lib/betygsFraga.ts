/**
 * Systemets betygsruta (josefanderberg/VADKUL#194): räknarna på enheten och
 * själva frågan. Reglerna för NÄR bor i lib/betyg (ren logik, testad).
 *
 * expo-store-review är en NATIVE modul som kom med bygget efter 1.1.1. Den
 * laddas därför först när den behövs och inom try/catch: en OTA-uppdatering
 * som når ett äldre bygge utan modulen hoppar bara över frågan i stället för
 * att krascha. Byt inte till en vanlig import överst i filen.
 *
 * Rutan syns inte i TestFlight (Apple stänger av den där) och varken Apple
 * eller Google berättar om den faktiskt visades. Frågan räknas därför som
 * ställd så fort systemet har fått den.
 */
import Constants from 'expo-constants';
import {
    dagNyckel,
    läsBetygsLäge,
    markeraFrågad,
    noteraDag,
    noteraKommer,
    skaFrågaOmBetyg,
    type BetygsLäge,
} from './betyg';
import { NYCKEL, läs, skriv } from './lagring';

/** Låt knappen hinna tändas och räknaren ticka upp innan rutan lägger sig över. */
const VÄNTA_MS = 1200;

const version = () => Constants.expoConfig?.version ?? '0';

async function hämta(): Promise<BetygsLäge> {
    return läsBetygsLäge(await läs<unknown>(NYCKEL.betyg, null));
}

/** Appen öppnades eller kom fram igen: räkna dagen. Frågar aldrig. */
export async function noteraAppDag(nu: Date = new Date()): Promise<void> {
    const före = await hämta();
    const efter = noteraDag(före, dagNyckel(nu));
    if (efter !== före) await skriv(NYCKEL.betyg, efter);
}

/** Ett eget tryck satte Kommer: räkna det och be om betyg om grinden släpper. */
export async function efterKommerSvar(): Promise<void> {
    const läge = noteraKommer(await hämta());
    const v = version();
    if (!skaFrågaOmBetyg(läge, v)) {
        await skriv(NYCKEL.betyg, läge);
        return;
    }
    let markerad = false;
    try {
        const StoreReview = await import('expo-store-review');
        if (!(await StoreReview.isAvailableAsync())) {
            // TestFlight eller en enhet utan butik: försök igen vid nästa Kommer.
            await skriv(NYCKEL.betyg, läge);
            return;
        }
        // Markera FÖRE frågan, så ett fel i rutan aldrig ger en fråga till.
        await skriv(NYCKEL.betyg, markeraFrågad(läge, v));
        markerad = true;
        await new Promise(klar => setTimeout(klar, VÄNTA_MS));
        await StoreReview.requestReview();
    } catch {
        // Äldre bygge utan modulen (försök igen senare), eller så svarade inte
        // butiken efter att frågan gått iväg (låt markeringen stå).
        if (!markerad) await skriv(NYCKEL.betyg, läge);
    }
}
