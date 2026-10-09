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
- **Eventflödet läses ALDRIG ur Firestore.** Event kommer via CDN-flödet
  (`https://vadkul.se/api/events/app-<region>`) och `/api/event?id=` - samma
  egress-regel som huvudrepots CLAUDE.md. Läs aldrig hela kollektioner.
- **Användardata går via Firestore direkt** (ägarbeslut 8/10 2026, ersätter
  den gamla "allt via /v1-API:t"-regeln): `@react-native-firebase/firestore`,
  `/storage` och `/messaging` mot SAMMA dokument och rules som webben - konton,
  skapa/önska event, gilla, RSVP, vänner, chatt, push-tokens. Porta webbens
  `apps/web/src/services/*` och ange webbfilen i huvudkommentaren; ändras
  webbens dataform ska appen följa (EAS Update når gamla installationer).
  Aldrig firebase-js-SDK:t - bara RN Firebase (native). /v1-API:t
  (src/api/konto.ts) finns kvar men är inte längre vägen framåt.
  Firebase-apparna för `se.vadkul.app` är registrerade;
  GoogleService-Info.plist/google-services.json är publika värden och
  committas.
- **App Store först vid paritet med webben** (ägarbeslut 8/10 2026): appen
  går till TestFlight nu men skickas inte till granskning förrän konton,
  skapa event, push och det sociala lagret är med. Gaplistan bor i
  huvudrepots `docs/app-plattform-plan.md` §10.
- **KONTON_PÅ** i `src/lib/funktioner.ts` styr intro-sidan om konto,
  profilens kontosektion och /konto. Den slås på när profilen sparas via
  Firestore (8/10-beslutet) i stället för /v1/me. Riv inte koden.
- **Rapportvägen måste finnas** (App Store 1.2, appen visar användarskapade
  event): `components/Rapportera` under beskrivningen i eventkortet, mejl till
  hej@vadkul.se via `lib/rapportera`. Tas den bort faller granskningen.
- När kontot är på igen gäller: det är FRIVILLIGT (ägarbeslut 29/9), introt erbjuder det men
  "Fortsätt utan konto" finns alltid - Apples regel 5.1.1. Inloggning: e-post
  + Google överallt, Sign in with Apple bara på iOS (regel 4.8). Kontot
  raderas inifrån appen (Profil → Radera konto → DELETE /v1/me).
- **@vadkul/kontrakt är sanningen** för typer, stadslistan (regionvalet!),
  kategori-nycklarna och eventShareSlug. Definiera aldrig egna kopior.
  **Sedan 7/10 2026 ligger kontraktet INBAKAT i `kontrakt/`** i stället för att
  installeras från npm: 0.2.0 (konto.ts + organizer.ts) är aldrig publicerat,
  och EAS-molnbyggen kör `npm install` på Expos servrar där varken registryt
  eller en workspace-länk utanför projektet finns. Importerna ser likadana ut
  (`@vadkul/kontrakt` → tsconfig paths + vitest-alias), så ingen appkod ändras.
  **Redigera ALDRIG `kontrakt/` här.** Ändra i huvudrepots `packages/kontrakt`
  och kör `npm run kontrakt:sync`; `npm run kontrakt:check` faller om kopian
  glidit isär. Publiceras 0.2.0 på npm någon gång kan mappen och aliaset tas
  bort och beroendet läggas tillbaka.
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
