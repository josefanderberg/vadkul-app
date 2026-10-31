/**
 * Toppluften i modalskärmarna (sök, Städer, profil, skapa, konto) - PR #1:s
 * useModalTopp, portad 31/10. På iOS är `presentation: 'modal'` ett kortark
 * som börjar under statusraden, där räcker 24 pt (skärmarnas gamla
 * paddingTop). På Android är modalen helskärm bakom en genomskinlig
 * statusrad (edge-to-edge), så rubriken och ✕ hamnade under klockan -
 * där läggs statusradens höjd till.
 */

/** Luften ovanför rubriken på iOS (kortarket) - samma som förut. */
export const MODAL_TOPP_IOS = 24;
/** Luften under statusraden på Android. */
export const MODAL_TOPP_UNDER_STATUSRAD = 16;

export function modalTopp(plattform: string, statusRad: number): number {
    return plattform === 'android' ? Math.max(0, statusRad) + MODAL_TOPP_UNDER_STATUSRAD : MODAL_TOPP_IOS;
}
