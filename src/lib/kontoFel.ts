/**
 * Inloggningens felmeddelanden på svenska - Firebase Auth-koderna och API:ts
 * svar blir en rad användaren förstår. Ren funktion, testad. Okända fel får
 * en generisk rad (den tekniska koden hör hemma i loggen, inte i UI:t).
 */
const TEXTER: Record<string, string> = {
    'auth/email-already-in-use': 'Det finns redan ett konto med den e-postadressen - logga in i stället.',
    'auth/invalid-email': 'E-postadressen ser inte rätt ut.',
    'auth/weak-password': 'Lösenordet måste vara minst 6 tecken.',
    'auth/missing-password': 'Skriv ett lösenord.',
    'auth/invalid-credential': 'Fel e-post eller lösenord.',
    'auth/wrong-password': 'Fel e-post eller lösenord.',
    'auth/user-not-found': 'Fel e-post eller lösenord.',
    'auth/user-disabled': 'Kontot är avstängt. Hör av dig till oss om du tror att det är fel.',
    'auth/too-many-requests': 'För många försök - vänta en stund och prova igen.',
    'auth/network-request-failed': 'Ingen anslutning - kolla nätet och försök igen.',
    'auth/requires-recent-login': 'Av säkerhetsskäl: logga ut, logga in igen och gör det direkt efteråt.',
    'auth/account-exists-with-different-credential':
        'Det finns redan ett konto med den e-postadressen, skapat på ett annat sätt. Logga in som du gjorde första gången.',
};

export function felText(err: unknown): string {
    const code = typeof err === 'object' && err !== null && 'code' in err ? String((err as { code: unknown }).code) : '';
    if (TEXTER[code]) return TEXTER[code];
    if (err instanceof ApiFel) return err.message;
    return 'Något gick fel - försök igen.';
}

/** Fel från vårt eget API - meddelandet är redan en svensk rad från servern. */
export class ApiFel extends Error {
    constructor(message: string, readonly status: number) {
        super(message);
        this.name = 'ApiFel';
    }
}

/** true = användaren avbröt själv (stängde Google-/Apple-rutan) - visa inget fel. */
export function ärAvbrutet(err: unknown): boolean {
    const code = typeof err === 'object' && err !== null && 'code' in err ? String((err as { code: unknown }).code) : '';
    return code === 'ERR_REQUEST_CANCELED' || code === 'SIGN_IN_CANCELLED' || code === '-5' || code === '12501';
}
