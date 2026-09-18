# Google Play Console — Data Safety form (N6.1)

Same investigation as `app-store-privacy.md`, mapped onto Google Play's data
categories. Privacy policy URL: `https://bela-turniri.com/privatnost`
(Croatian only today — see `open-questions.md`).

All app-to-backend traffic is HTTPS/WSS in production (Caddy terminates TLS;
`backend` is reached only through it). All third-party calls listed below are
`https://`. **Encrypted in transit: Yes, for every row.**

**Account deletion: there is currently no in-app or web account-deletion path.**
See `open-questions.md` — this blocks the "Data deletion" declaration and is
also an Apple 5.1.1(v) blocker, so it needs fixing regardless of platform.

## Personal info

| Data type | Collected | Shared | Optional/Required | Purpose | Source |
|---|---|---|---|---|---|
| Name | Yes | No | Required (account) | App functionality | `UserProfile.java` `displayName`, `AuthContext.tsx` |
| Email address | Yes | No | Required (login); required for the `/kontakt` form | App functionality; account management | `firebase.ts` (Firebase Auth); `ContactMessage.java` |
| Phone number | Yes | No | Optional | App functionality (reachability for the organiser; user may choose to show it on their own public profile) | `UserProfile.java` `phone`/`phoneCountry`; `Pairs.java` `contactPhone` |
| Address | No | — | — | — | Only a **tournament venue address** is stored, entered by the organiser as tournament content — not the account holder's personal address. `GeocodeService.java` |
| User IDs | Yes | No | Required | App functionality | Firebase UID (`UserProfile.userUid`), used as the primary key throughout the backend |

## Location

| Data type | Collected | Shared | Optional/Required | Purpose | Source |
|---|---|---|---|---|---|
| Approximate location | **No — see reasoning** | No | — | — | `useUserLocation.ts` calls `getCurrentPosition({ enableHighAccuracy: false, ... })` and keeps the coordinate only in React state, used purely to sort/filter the already-fetched public tournament list and place a marker on the client-side map. No network call in `TournamentsPage.tsx` / `MapPage.tsx` / `CalendarPage.tsx` sends it to the backend or to any third party. |
| Precise location | **No** | No | — | — | Same. |

**Manifest/behavior mismatch to resolve before submission**: `AndroidManifest.xml`
declares both `ACCESS_COARSE_LOCATION` and `ACCESS_FINE_LOCATION`, but the JS code
only ever requests `enableHighAccuracy: false`. Play's reviewers compare the declared
permissions against the Data Safety form; either drop the unused `ACCESS_FINE_LOCATION`
permission or, if Android's WebView geolocation bridge can still hand back GPS-grade
precision under fine permission regardless of the JS flag, disclose "Precise location"
conservatively. Flagged in `open-questions.md`.

## Photos and videos

| Data type | Collected | Shared | Optional/Required | Purpose | Source |
|---|---|---|---|---|---|
| Photos | Yes | No | Optional (avatar); required to add a poster | App functionality | `StorageService.java`, `UserMeController.uploadAvatar`, tournament poster upload in `TournamentController.java` — stored in the operator's own self-hosted MinIO, not shared with a third-party ad/analytics network |

## App activity

| Data type | Collected | Shared | Optional/Required | Purpose | Source |
|---|---|---|---|---|---|
| App interactions | **No** (native app) | — | — | — | GA4 is the only interaction-analytics code and it never loads inside the native shell — its loader in `index.html` is gated to `location.hostname === "bela-turniri.com" \| "www.bela-turniri.com"`, which the Capacitor WebView never is (`capacitor.config.ts` has no `server.url`, so it serves from `capacitor://localhost` / `https://localhost`). |
| In-app search history | No | — | — | — | Search text filters a live DB query (`TournamentController.java` `/turniri?q=`) and is not persisted. |
| Other user-generated content | Yes | No | Required to use the corresponding feature | App functionality | Tournament names, pair/team names, in-game name (`GameNameService.java`, 16-char cap), guest name (`guestIdentity.ts`), contact-form message (`ContactMessage.java`) |

## Web browsing

Not applicable — the native shell never loads an external site inside a WebView;
`NativeShell.tsx`'s deep-link handler only ever calls the SPA router with an
in-app path, and rejects anything not matching `bela-turniri.com`/`www.bela-turniri.com`.
See `age-rating.md` for the "unrestricted web access" answer.

## App info and performance

| Data type | Collected | Shared | Optional/Required | Purpose | Source |
|---|---|---|---|---|---|
| Crash logs / diagnostics | **No** (by app code) | — | — | — | No Crashlytics/Sentry/Bugsnag dependency exists in `frontend/package.json` or the native projects. |

## Device or other IDs

| Data type | Collected | Shared | Optional/Required | Purpose | Source |
|---|---|---|---|---|---|
| Device or other identifiers | Yes | No | Required for push | App functionality (FCM registration token, tied to the signed-in user's UID and reassigned rather than duplicated when a token resurfaces under a different account) | `PushDeviceService.java`, `PushDevice` model |
| Guest pseudonymous ID | Yes | No | Optional (only players who skip sign-in) | App functionality (online-game stats) | `guestIdentity.ts` — random on-device secret, only `guest:<sha256(secret)>` ever reaches the server |

## Financial info, Health and fitness, Contacts, Files and docs, Calendar, Messages

Not collected — no code path exists for any of these. Rationale:

- **Financial info / purchases**: no payment SDK anywhere (grepped for Stripe/PayPal/Braintree/Play Billing — none). Drink prices (`TournamentDrinkPrice.java`) and the `paid` flag on `Pairs.java` are organiser-entered records of what was collected in cash at the venue, never processed by the app. See `review-notes.md`.
- **Health and fitness**: no HealthKit/Google Fit integration.
- **Contacts**: no `READ_CONTACTS` permission declared, no contacts-picker code.
- **Files and docs / Calendar**: the `.ics` calendar feed (`CalendarFeedController.java`, `utils/ics.ts`) is a public read-only subscription URL the app *serves*, not a calendar the app reads from the device.
- **Messages**: no SMS/MMS access; the contact form is a plain HTTP POST, not device messaging.

## Third parties data is shared with

| Third party | Data | Purpose | Source |
|---|---|---|---|
| Firebase (Google) — Auth + Cloud Messaging | Email, Firebase UID, ID token, FCM token | Account auth, push delivery | `firebase.ts`, `FcmSender.java` |
| OpenStreetMap Nominatim | Organiser-typed venue address text; reverse-geocode of a map tap | Turning a typed address into map coordinates | `places.ts`, `GeocodeService.java` |
| Google Places API (New) | Organiser-typed venue address text | Address autocomplete — active in the shipped app because a real key is set in `frontend/.env.native` | `places.ts` |
| CARTO / OpenFreeMap | Map tile coordinates for the visible viewport | Rendering the map | `mapTiles.ts` |
| Resend | Recipient email, subject, body of the app's own transactional mail | Delivering contact-form replies / notifications the operator sends | `EmailService.java` |
| MinIO | Poster/avatar image bytes | Storage — self-hosted by the operator, not a third-party data processor in the advertising sense | `StorageService.java` |

None of the above is used for advertising, and none combines this app's data with
data from other apps/sites for a purpose unrelated to running this app.
