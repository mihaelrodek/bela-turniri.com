# App Review / Play Review notes (N6.1)

For App Store Connect "App Review Information → Notes" and Play Console's
equivalent reviewer-notes field. Written in English per store convention.

## What this app is

Bela Turniri is a companion app for organising and playing **Belot ("bela")**,
a traditional Croatian trick-taking card game, in an offline/in-person
tournament format — think a scoring and bracket-management tool for a card
tournament run at a bar or club, plus an online multiplayer version of the
same card game. It is not a casino app and involves no real-money wagering.

Core features a reviewer can exercise:

1. **Tournament organising** — create a tournament (name, date, venue address,
   poster image), collect pair (team) registrations, draw rounds, record match
   scores, track a per-table drink tally ("cjenik"), publish standings.
2. **Blok** — a standalone digital scoreboard for a single game of belot,
   usable without creating a tournament and **without an account**, and works
   fully **offline** (see "Offline capability" below).
3. **Online bela ("Igraj")** — real-time multiplayer belot against other
   people or bots, playable signed-in or as a guest (pick a name, no account
   required).

## Why this is not a gambling app (Apple 5.3 / Play Gambling policy)

- **No stakes.** No feature lets a user wager money, virtual currency, or
  anything of value on the outcome of a hand, a match, or a tournament.
- **No in-app purchase of any kind.** Grepped the entire frontend and backend
  for Stripe/PayPal/Braintree/StoreKit/Play Billing — none exist. There is no
  purchasable item, boost, or currency anywhere in the app.
- **"Repasaž" (re-entry) is not a paid unlock inside the app.** `entry_price`
  and `repassage_price` on a tournament (`backend/.../model/Tournaments.java`)
  are numbers the *organiser* types in as informational reference — what they
  plan to charge in person at the venue. `RepassageService.buyExtraLife`
  flips a boolean flag on the pair; no money moves through the app.
- **The drink price list ("cjenik") and per-pair "paid" checkbox are a
  scorekeeping record, not a payment.** `TournamentDrinkPrice.java` holds
  organiser-entered drink names and prices; `MatchDrink.java` records which
  drinks a table consumed during a match, snapshotted so a later price edit
  doesn't rewrite history; `Pairs.paid` is a boolean an organiser manually
  ticks after collecting cash. None of this touches a payment processor —
  it is the digital equivalent of a bar tab tally a tournament runner would
  otherwise keep on paper.
- **The card game itself has no betting mechanic.** Belot is scored on
  points to a target (501/701/1001 — `GameResultReportRequest.java`); the
  "stakes" some tournaments' entry fee implies happen off-platform, in cash,
  at the venue, exactly like an entry fee for a chess or bowling tournament.

## Offline capability (evidence against nothing being demoable without a live account)

The Blok scorepad is designed to work fully offline in an installed native app:

- `public/sw.js` precaches the app shell plus the `/blok` route chunk from a
  build-time manifest (`vite.config.ts`'s `bela-precache-manifest` plugin), so
  an installed app opened with no network still loads to a usable scorepad.
- Score/drink/pair-paid mutations queue through an offline-first queue
  (`hooks/useOfflineQueue.ts`) with idempotent client-generated op ids, so
  entries made offline are not lost and are never double-applied once
  connectivity returns (`services/IdempotencyService.java` on the backend).
- A reviewer can turn off Wi-Fi/cellular after opening `/blok` once and still
  score a full game.

## How a reviewer reaches each feature

| Feature | Path in the app | Notes |
|---|---|---|
| Browse public tournaments | Home / "Turniri" tab | Fully public, no sign-in needed |
| Blok scorepad | "Blok" tab | No account required; works offline (see above) |
| Create an account | Sign-up screen | Email/password or Google sign-in (Firebase Auth) |
| Create a tournament | "Kreiraj turnir" (requires sign-in) | Name, date, venue address (typed, autocompletes via Google Places/Nominatim), optional poster photo |
| Register a pair | A tournament's page → "Prijavi par" | Works signed-in or fully anonymously (name + phone number, pending organiser approval) |
| Online multiplayer bela | "Igraj" tab → lobby → create/join a room | Playable signed in or as a guest (pick a name, no account) |
| Public player profile | `/profil/{slug}` | Shows pair history, optional phone/avatar the user chose to add |

**Demo account**: `<TO BE FILLED IN BY THE OWNER — create a Firebase
email/password account, e.g. reviewer@bela-turniri.com, that already owns at
least one STARTED tournament with a few pairs and a finished online game, so
the reviewer sees populated screens rather than empty states>`. Reviewer
instructions should state: "The online game (Igraj tab) can also be tried
without any account by tapping 'Play as guest' and picking a name."

**Note on the `/igra?mock=1` developer shortcut**: this in-browser fake game
server exists purely for local development (`frontend/src/game/mock/mockGameServer.ts`)
and is gated by `import.meta.env.DEV` in both `GameLobbyPage.tsx` and
`GameRoomPage.tsx`. Native release builds are produced via `npm run build:native`
in Vite's non-dev `native` mode, so **`DEV` is `false` and this shortcut is not
reachable in the shipped app** — do not tell reviewers to use it; they need the
real "Igraj" flow (live server or a guest room) to see the game.

## Native platform features used (evidence against 4.2 "minimum functionality")

- **Push notifications** (FCM on both platforms) — round-draw ("Runda X")
  alerts, match-bill totals pushed to the losing pair
  (`backend/.../services/PushService.java`, `FcmSender.java`,
  `AndroidManifest.xml`'s `bela` notification channel,
  `Info.plist`'s `UIBackgroundModes: remote-notification`).
- **iOS Live Activities** for an in-progress online game — lock-screen live
  score while the app is backgrounded (`Info.plist`'s
  `NSSupportsLiveActivities` / `NSSupportsLiveActivitiesFrequentUpdates`,
  `game/packages/server/src/liveActivity.ts`, relayed through the backend's
  `/internal/live-activity`).
- **Haptics** during play (`frontend/src/game/util/haptics.ts`,
  `@capacitor/haptics`).
- **Native share sheet** for sharing a tournament link/QR, a Blok score
  summary, and calendar `.ics` events (`@capacitor/share`,
  `frontend/src/utils/ics.ts`, `frontend/src/api/blokShare.ts`).
- **Camera / photo library access** for tournament posters and profile
  avatars (`NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription` in
  `Info.plist`; `CAMERA` permission in `AndroidManifest.xml`).
- **Universal Links / App Links** — tapping a `bela-turniri.com/turniri/...`,
  `/blok/...`, `/igra/...` or `/profil/...` link opens the app directly
  (`NativeShell.tsx`'s `appUrlOpen` handling; `AndroidManifest.xml`'s
  `autoVerify` intent filter).
- **Foldable-device awareness** on Android (Jetpack WindowManager hinge
  state feeding CSS variables — `NativeShell.tsx`'s `Foldable` listener).
- **iOS Keychain** for a durable guest-play identity that survives an
  uninstall/reinstall (`GuestKeychainPlugin.swift`).

## Sensitive-data handling reviewers may ask about

- Anonymous pair registration collects a contact phone number that is
  **visible only to the tournament organiser**, never in the public pair
  list (`PairMapper.java`'s `toDtoEnriched(..., includeContactPhone)`,
  gated on `TournamentAccess.canManage`).
- A user's own phone number is optional and, if set, is shown on that
  user's own public profile to any other signed-in visitor (not to
  anonymous ones) — this is the user's own choice to publish it, not a
  default.
