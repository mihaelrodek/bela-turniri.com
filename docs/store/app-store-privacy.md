# App Store Connect — App Privacy (N6.1)

Derived from reading the actual iOS/Android app code (Capacitor shell around the
same `frontend/dist` the website ships — `frontend/capacitor.config.ts`,
`webDir: "dist"`, no `server.url`). Every row cites the file(s) that justify it.
Where the code could not settle a question, it is marked **OPEN** and repeated
in `open-questions.md`.

Privacy policy URL to enter in App Store Connect: `https://bela-turniri.com/privatnost`
(`frontend/src/pages/PrivacyPage.tsx`). It is Croatian-only today — see open questions.

## App Tracking Transparency (ATT) — conclusion: **NOT required, do not show a prompt**

**Tracking = No** for every data type below. Reasoning:

1. The only analytics tag in the codebase is GA4, and its loader is hostname-gated:
   `frontend/index.html` — `if (h !== "bela-turniri.com" && h !== "www.bela-turniri.com") return;`
   before the `gtag.js` script tag is even inserted. The native shell never runs on
   that hostname (`capacitor.config.ts` sets no `server.url`, so WKWebView/Android
   WebView load from `capacitor://localhost` / `https://localhost`), so **GA4 never
   loads inside the iOS or Android app at all** — confirmed by reading the guard
   clause, not inferred.
2. No advertising SDK, ad network, or attribution SDK exists anywhere in
   `frontend/package.json`, the iOS project, or the Android project (grepped for
   Stripe/AdMob/Facebook SDK/AppsFlyer/Adjust-style packages — none found).
   `frontend/android/app/src/main/AndroidManifest.xml` has no
   `com.google.android.gms.permission.AD_ID` permission.
3. No IDFA/IDFV, GAID, or any cross-app/cross-site identifier is read or sent by
   app code. `frontend/ios/App/App/Info.plist` has no `NSUserTrackingUsageDescription`
   key, consistent with never calling the ATT API.
4. Firebase is used only for Auth (`frontend/src/firebase.ts` imports
   `firebase/app` + `firebase/auth`, nothing else) and for FCM push
   (`@capacitor-firebase/messaging` in `frontend/package.json`). No
   `firebase/analytics` import exists.
5. Data does leave the device to first parties that render app functionality
   (Firebase Auth, the backend, MinIO, Nominatim, and — only when a build key is
   set — Google Places; see the Location/Identifiers tables and `open-questions.md`
   about that key). None of it is combined with third-party data for advertising,
   sold, or shared with a data broker.

## Contact Info

| Data type | Collected | Linked to user | Used for tracking | Purposes | Source in code |
|---|---|---|---|---|---|
| Name | Yes | Yes | No | App Functionality (account, public profile attribution "Prijavio: …") | `backend/.../model/UserProfile.java` (`displayName`), `frontend/src/auth/AuthContext.tsx` (`signUp`), `backend/.../controller/UserMeController.java` (`/user/me/sync`) |
| Email Address | Yes | Yes | No | App Functionality (Firebase Auth login); Customer Support (contact form reply-to) | `frontend/src/firebase.ts` (Firebase Auth email/password + Google); `backend/.../model/ContactMessage.java` (`email`, required field of `/kontakt` form); `backend/.../services/EmailService.java` (sends the reply) |
| Phone Number | Yes (optional) | Yes | No | App Functionality (organiser reaching an anonymously-registered pair; a signed-in user may optionally publish it on their own public profile) | `backend/.../model/UserProfile.java` (`phone`, `phoneCountry`); `backend/.../model/Pairs.java` (`contactPhone`, organiser-only — see `PairMapper.java` gating comment); `backend/.../dtos/PublicProfileDto.java` (shown to any signed-in viewer if the profile owner set one; redacted to anonymous viewers) |
| Physical Address | No (see note) | — | — | — | The organiser types a **tournament venue address**, not the account holder's own address — this is tournament content, listed under User Content below, not personal Contact Info of the account. `backend/.../services/GeocodeService.java` |

## Location

| Data type | Collected | Linked to user | Used for tracking | Purposes | Source in code |
|---|---|---|---|---|---|
| Precise Location | **No** | — | No | — | `frontend/src/hooks/useUserLocation.ts` calls `navigator.geolocation.getCurrentPosition` with `enableHighAccuracy: false` and keeps the result **only in React state**. It is used exclusively to sort/filter the already-public tournament list client-side and to draw a marker on the Leaflet map (`frontend/src/pages/TournamentsPage.tsx`, `MapPage.tsx`, `CalendarPage.tsx`). No `fetch`/`axios` call in any of those files sends `userPos` anywhere; only a "hidden" boolean preference is written to `localStorage`. Apple's App Privacy asks about data your app *collects* (i.e., transmits off-device); this position is never transmitted, so the correct answer is "Data Not Collected." |
| Coarse Location | **No** | — | No | — | Same code path as above. |

Note the distinction from a **tournament's** venue coordinates: those are organiser-entered
text geocoded server-side via OpenStreetMap Nominatim (`backend/.../services/GeocodeService.java`)
and are public tournament metadata, not the account holder's personal location — see User Content.

Android declares both `ACCESS_COARSE_LOCATION` and `ACCESS_FINE_LOCATION`
(`frontend/android/app/src/main/AndroidManifest.xml`) even though the JS call only ever
requests low accuracy. This is a manifest/behavior mismatch worth resolving before
submission — see `open-questions.md`.

## User Content

| Data type | Collected | Linked to user | Used for tracking | Purposes | Source in code |
|---|---|---|---|---|---|
| Photos or Videos | Yes | Yes | No | App Functionality (tournament posters, profile avatars) | `backend/.../services/StorageService.java` (magic-byte validated, resized, stored in MinIO); `UserMeController.uploadAvatar`; tournament poster upload in `TournamentController` |
| Other User Content | Yes | Yes | No | App Functionality (tournament names, pair/team names, in-game display name, guest name, contact-form message text) | `backend/.../model/Tournaments.java`, `Pairs.java` (`name`), `backend/.../services/GameNameService.java` (in-game name, max 16 chars), `frontend/src/game/hooks/guestIdentity.ts` (guest name), `backend/.../model/ContactMessage.java` (`message`, up to 4000 chars) |

No free-text chat exists in the shipped app: `frontend/src/game/chatEnabled.ts` sets
`CHAT_ENABLED = false` — the wire protocol and server (`game/packages/server/src/chat.ts`)
still technically accept `chat.send`, but the client renders no entry point to it.
Table "reactions" are a fixed set of 6 emoji (`frontend/src/game/util/reactions.ts`:
😏 👏 🍀 🤦 ⏳ 🤝), not free text.

## Identifiers

| Data type | Collected | Linked to user | Used for tracking | Purposes | Source in code |
|---|---|---|---|---|---|
| User ID | Yes | Yes | No | App Functionality (Firebase UID is the primary key for the profile, pairs, push devices and game stats) | `backend/.../model/UserProfile.java` (`userUid`), used throughout |
| Device ID | Yes | Yes | No | App Functionality (native push delivery via FCM) | `backend/.../model/PushDevice` / `services/PushDeviceService.java` — one row per FCM registration token, reassigned (not duplicated) when a token resurfaces under a different account |
| Other ID (pseudonymous guest ID) | Yes | Yes, but only to a device-local secret, never to a real identity | No | App Functionality (online-game stats for players who skip sign-in) | `frontend/src/game/hooks/guestIdentity.ts` — random 32-byte secret generated on-device, mirrored to `@capacitor/preferences` and (iOS only) Keychain (`frontend/ios/App/App/GuestKeychainPlugin.swift`) so it survives reinstall; the game server derives `guest:<sha256(secret)>` and that string, never the raw secret, is what reaches the backend (`backend/.../dtos/GameResultReportRequest.java`) |

## Usage Data

| Data type | Collected | Linked to user | Used for tracking | Purposes | Source in code |
|---|---|---|---|---|---|
| Product Interaction | **No** (in the native app) | — | No | — | GA4 is the only interaction-analytics code in the repo and it is hostname-gated out of the native shell (see ATT section above). |

## Diagnostics

| Data type | Collected | Linked to user | Used for tracking | Purposes | Source in code |
|---|---|---|---|---|---|
| Crash Data / Performance Data | **No** (by app code) | — | — | — | No Crashlytics, Sentry, Bugsnag or similar SDK is a dependency anywhere (`frontend/package.json`, native project files grepped, none found). Apple's own platform-level crash collection (Xcode Organizer) is outside the app's own data collection and is not something this app requests — flagged as an open question only for the owner to confirm no such SDK is added later without updating this doc. |

## Not collected (confirmed by absence in code)

| Data type | Why not collected |
|---|---|
| Financial Info / Purchases | No payment SDK anywhere (Stripe/PayPal/Braintree/StoreKit/Play Billing all absent). `entry_price` / `repassage_price` on `Tournaments.java` and the `paid` boolean on `Pairs.java` are informational values the organiser types in and manually toggles — a record of cash collected at the venue, never processed in-app. See `review-notes.md` for the gambling-guideline argument. |
| Health & Fitness | No HealthKit/Google Fit code or entitlement. |
| Sensitive Info (race, religion, sexual orientation, etc.) | No fields of this kind exist in any DTO or entity. |
| Contacts | No contacts-permission code (`NSContactsUsageDescription` absent from `Info.plist`; no `READ_CONTACTS` in `AndroidManifest.xml`). |
| Browsing History | Not applicable — no in-app web browser/WebView-of-external-sites exists (see `age-rating.md`). |
| Search History | The `/turniri?q=` tournament search box (`TournamentController.java`) filters a live DB query server-side; no search-term log or history table exists. |

## Third parties data can reach (for the "third-party partner" App Privacy question)

| Third party | What leaves the device | Source |
|---|---|---|
| Firebase (Google) — Auth | Email, password (via SDK, not plaintext to app code), Firebase UID, ID token | `frontend/src/firebase.ts` |
| Firebase Cloud Messaging (Google) | FCM registration token, notification payload | `@capacitor-firebase/messaging`, `backend/.../services/FcmSender.java` |
| MinIO (self-hosted, the operator's own infrastructure) | Poster/avatar image bytes | `backend/.../services/StorageService.java` |
| OpenStreetMap Nominatim | Free-text tournament address the organiser types (autocomplete fallback + backend geocode); reverse-geocode of a map tap | `frontend/src/utils/places.ts`, `backend/.../services/GeocodeService.java` |
| Google Places API (New) | Free-text address search input, typed by the organiser while creating/editing a tournament — **only when a build has `VITE_GOOGLE_MAPS_API_KEY` set**. Confirmed set (a real key) in `frontend/.env.native`, so this is active in the shipped native app | `frontend/src/utils/places.ts` |
| CARTO / OpenFreeMap | Map tile x/y/z requests for whichever area of the map is on screen | `frontend/src/utils/mapTiles.ts` |
| Resend (transactional email) | Recipient address, subject, body of the app's own outgoing notification/contact-reply mail — not a data sale, this is the operator's own mail delivery | `backend/.../services/EmailService.java` |

Every network call above runs over HTTPS/WSS (Caddy terminates TLS in prod; all listed
third-party endpoints are `https://`), so nothing here is unencrypted in transit.
