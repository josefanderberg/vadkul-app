# vadkul-app

React Native/Expo-appen för VADKUL — eventkartan för Sverige i fickformat.
Huvudrepot (github.com/josefanderberg/VADKUL) äger pipelinen, webben och
API:t; det här repot äger BARA appen. Plattformsplanen bor i huvudrepots
`docs/app-plattform-plan.md`, bootstrap-receptet i `docs/app-repo-bootstrap.md`.

@AGENTS.md

## Hårda regler

- **APPEN SÄLJER INGENTING.** Ingen boost-knapp, inga priser, ingen länk till
  köp — ordet "boost" förekommer inte i UI:t. Betalningar sker på webben
  (Apples IAP-regler; hela resonemanget i plattformsplanen).
- **Ingen Firestore-/firebase-js-SDK.** Eventdata via CDN-flödet
  (`https://vadkul.se/api/events/app-<region>`), allt autentiserat via
  /v1-API:t (huvudrepots `apps/functions/src/api`, src/api/konto.ts här).
  Auth via @react-native-firebase/auth (sessionen i nyckelringen), push (FCM)
  kommer samma väg. Firebase-apparna för `se.vadkul.app` är registrerade;
  GoogleService-Info.plist/google-services.json är publika värden och
  committas.
- **Kontot är FRIVILLIGT** (ägarbeslut 29/9): introt erbjuder det men
  "Fortsätt utan konto" finns alltid - Apples regel 5.1.1. Inloggning: e-post
  + Google överallt, Sign in with Apple bara på iOS (regel 4.8). Kontot
  raderas inifrån appen (Profil → Radera konto → DELETE /v1/me).
- **@vadkul/kontrakt är sanningen** för typer, stadslistan (regionvalet!),
  kategori-nycklarna och eventShareSlug. Definiera aldrig egna kopior.
  Publicerat på npmjs sedan 25/9 (som TS-källa, plan §9.1) och installeras
  som `^0.1.0` från registryt — kravet för EAS-molnbyggen. Kontraktsändring
  görs i huvudrepots `packages/kontrakt`, versionsbumpas, `npm publish`as
  (kräver 2FA-koden) och bumpas sedan här.
- **Kartbesluten ärvs från huvudrepots `.claude/skills/kart-ui/`** — borttagna
  features återuppstår inte i appen. Kartan är MapLibre RN (aldrig Mapbox).
  Webbparitetens regler bor i lib/ med webbfilen angiven i huvudkommentaren
  (kartFilter ← matchesFilterFor/sources, harVarit ← isEventPast/autoDayBump,
  vy ← viewportTour/popularList, sok ← eventSearch) - ändras webben ska
  kopian följa.
- **Brickorna bakas med WEBBENS ritkod**: `node scripts/baka-brickor.mjs`
  (headless Chrome ur huvudrepots node_modules) skriver assets/brickor/ +
  src/lib/brick*.generated.ts. Redigera aldrig de genererade filerna.
- **EAS dev build, aldrig Expo Go** — kartan/push är native-moduler.
- Inga tokens i AsyncStorage (lib/lagring är bara för inställningar) — RN
  Firebase håller sessionen i nyckelringen/Keystore själv.

## Test & verifiering

- `npx tsc --noEmit` + `npm test` (vitest, ren logik — inget nät i tester)
  före varje "klart". Ny ren logik (lib/, api/-hjälpare) får tester direkt.
- UI verifieras i EAS dev build på riktig enhet — inte i Expo Go, inte i tro.
