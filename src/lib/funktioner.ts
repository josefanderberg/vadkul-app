/**
 * Funktionsflaggor för vad som är PÅ i appen.
 *
 * KONTON_PÅ: avstängd 7/10 2026 (v1 skulle upp som ren karta medan /v1/me låg
 * odeployat). PÅSLAGEN 8/10 2026: profilen sparas nu direkt i users/{uid} i
 * Firestore (ägarbeslutet "Firestore direkt", data/anvandare) och appen går
 * inte till App Store förrän den är ikapp webben - så kontot ska med.
 */
export const KONTON_PÅ: boolean = true;
