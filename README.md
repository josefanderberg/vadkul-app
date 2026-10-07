# vadkul-app

VADKUL som app: eventkartan för Sverige i fickformat, för iOS och Android. Byggd med Expo
(SDK 57), Expo Router och MapLibre React Native. Bundle-id `se.vadkul.app`, URL-schema
`vadkulapp://`.

Huvudrepot [josefanderberg/VADKUL](https://github.com/josefanderberg/VADKUL) äger
pipelinen, webben och /v1-API:t. Det här repot äger bara appen. Planen bor i huvudrepots
`docs/app-plattform-plan.md`, reglerna för kodarbetet i [CLAUDE.md](CLAUDE.md).

## Vad appen gör

- **Kartan** (`src/app/index.tsx`) med samma brickor, filter och dagväljare som webben.
- **Städer** (`src/app/stader.tsx`, `src/app/stad/[slug].tsx`) och **sök** (`src/app/sok.tsx`).
- **Eventkortet** med Kommer/Intresserad, Bjud med och fler event från samma arrangör.
- **Intro och frivilligt konto** (`intro.tsx`, `konto.tsx`, `profil.tsx`): e-post och
  Google överallt, Sign in with Apple på iOS. Kontot raderas inifrån appen.

Eventdata kommer från CDN-flödet `https://vadkul.se/api/events/app-<region>`
(`src/api/appFeed.ts`). Allt som kräver inloggning går via /v1-API:t (`src/api/konto.ts`).
Appen säljer ingenting; betalningar sker på webben.

## Kom igång

```sh
npm install
npx expo start          # kräver en EAS dev build på telefonen, inte Expo Go
```

Kartan och push är native-moduler, så Expo Go räcker inte. Bygg en dev build en gång och
installera den på telefonen:

```sh
npx eas-cli@latest build --profile development --platform ios      # eller android
```

Profilerna står i `eas.json`: `development` (dev-klient, intern distribution),
`preview` (intern distribution) och `production` (versionsnumret räknas upp av EAS).

## Kontroller före "klart"

```sh
npx tsc --noEmit
npm test               # vitest, ren logik i src/lib och src/api, inget nät
npx expo lint
```

UI verifieras i dev builden på en riktig telefon.

## Kontraktet

Typer, stadslistan, kategori-nycklarna och `eventShareSlug` kommer från
[`@vadkul/kontrakt`](https://www.npmjs.com/package/@vadkul/kontrakt) på npm. Paketet ändras i
huvudrepots `packages/kontrakt`, versionsbumpas och publiceras där (kräver 2FA-koden), och
bumpas sedan i `package.json` här. Gör aldrig egna kopior av det som finns i kontraktet.

## Brickorna

Kartans brickor bakas med webbens egen ritkod så att de blir pixelidentiska:

```sh
node scripts/baka-brickor.mjs
```

Skriptet skriver `assets/brickor/` och `src/lib/brick*.generated.ts`. Kör det när webbens
ritkod eller kategorifärgerna ändrats, och redigera aldrig de genererade filerna för hand.

## Webbparitet

Logik som speglar webben bor i `src/lib/` med webbfilen angiven i huvudkommentaren:
`kartFilter`, `harVarit`, `vy` och `sok`. Ändras webben ska kopian följa med.
