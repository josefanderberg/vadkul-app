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
  (`https://vadkul.se/api/events/app-<region>`) och senare /v1-API:t.
  Auth/push (fas 3) via @react-native-firebase.
- **@vadkul/kontrakt är sanningen** för typer, stadslistan (regionvalet!),
  kategori-nycklarna och eventShareSlug. Definiera aldrig egna kopior.
  OBS: installeras som `file:../packages/kontrakt` tills publiceringsbeslutet
  (huvudrepots plan §9.1) — EAS-byggen kräver att det avgörs först.
- **Kartbesluten ärvs från huvudrepots `.claude/skills/kart-ui/`** — borttagna
  features återuppstår inte i appen. Kartan är MapLibre RN (aldrig Mapbox).
- **EAS dev build, aldrig Expo Go** — kartan/push är native-moduler.
- Inga tokens i AsyncStorage — expo-secure-store när auth kommer.

## Test & verifiering

- `npx tsc --noEmit` + `npm test` (vitest, ren logik — inget nät i tester)
  före varje "klart". Ny ren logik (lib/, api/-hjälpare) får tester direkt.
- UI verifieras i EAS dev build på riktig enhet — inte i Expo Go, inte i tro.
