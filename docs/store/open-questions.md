# Open questions / submission blockers (N6.1)

Ordered by how likely each is to cause an App Review rejection or a policy
strike. The first three are near-certain blockers for iOS specifically and
should be resolved before any submission attempt.

## 1. BLOCKER — No in-app account deletion path (Apple 5.1.1(v))

Grepped the entire backend and frontend for any delete-account flow
(`deleteAccount`, `account.?delet`, `deleteUser`, "obriši račun", etc.) — **no
hits anywhere.** `backend/.../controller/UserMeController.java` has `DELETE`
endpoints only for a push-device token and for an avatar image; there is no
`DELETE /user/me` or equivalent that removes the Firebase account and its
`UserProfile`/`Pairs`/`PushDevice`/`GameResultPlayer` rows.
`frontend/src/pages/ProfilePage.tsx` is a dead stub file ("Replaced by
PublicProfilePage… nothing imports from here"); no delete-account UI exists
on `PublicProfilePage.tsx` or `EditProfileDialog.tsx` either.

Apple's guideline 5.1.1(v) requires apps that support account creation to
also offer in-app account deletion, not just a web form or an email request.
**This needs a real feature (backend endpoint + confirmation UI + Firebase
user deletion) before iOS submission, not just a documentation fix.**

## 2. BLOCKER — No "Sign in with Apple" alongside Google Sign-In (Apple 4.8)

The app offers Google sign-in via Firebase (`frontend/src/auth/AuthContext.tsx`
`signInWithGoogle` / `signInWithPopup(auth, googleProvider)`). Grepped for any
Sign in with Apple implementation (`SignInWithApple`, `OAuthProvider("apple...")`)
— none found outside an unrelated string inside the bundled Firebase vendor
chunk. Apple guideline 4.8 requires offering "Sign in with Apple" as an
equivalent option whenever a third-party/social login (like Google) is
offered, unless a narrow exemption applies (enterprise-only account systems,
government ID systems, or being a client for a specific pre-existing
account) — **none of which apply to this consumer app.** This is one of the
most common, near-automatic App Review rejections for exactly this
combination (email/password + Google, no Apple) and should be added before
submission.

## 3. Likely rejection risk — No UGC moderation/reporting mechanism (Apple 1.2)

The app has genuine public user-generated content: tournament posters and
names, pair/team names, public profiles with photos and optional phone
numbers, and in-game/guest display names — all visible to other users or
the public without any signed-in relationship. Grepped for any
report-content, block-user, or moderation flow (`report`, `blokiraj`, admin
moderation queue beyond the tournament creator's own content) — **none
found.** Apple 1.2 generally expects, for apps with user-generated content:
(a) a EULA/ToS prohibiting objectionable content, (b) a mechanism to report
objectionable content, (c) a mechanism to block abusive users, (d) published
contact info for reporting concerns. Only (a) and (d) clearly exist today
(`frontend/src/pages/TermsPage.tsx`, `/kontakt`). Recommend adding at least a
lightweight "report this tournament/profile" action wired to the existing
admin surface before submission, or be prepared for a reviewer to ask for it.

## 4. Google Places API key is checked into git and shipped in the native bundle

`frontend/.env.native` (tracked in git — it does not match the `*.env`
`.gitignore` pattern, only exact `.env`/`.env.local`/etc. do) contains a real
`VITE_GOOGLE_MAPS_API_KEY` value, baked into both the iOS and Android release
bundles. The code's own comments (`frontend/src/utils/places.ts`) say this is
by design and the only mitigation is the HTTP-referrer/bundle-ID restriction
set in Google Cloud Console. **Please confirm with the owner** that this
specific key's restrictions in Google Cloud actually include the app's real
bundle IDs (`com.belaturniri.app` for both iOS and Android) and the
`capacitor://localhost` / `https://localhost` origins the comment mentions —
this could not be verified from the repo alone, and an unrestricted key
found in a decompiled APK is both an abuse and a store-policy risk.

## 5. Android manifest requests FINE location the JS code never asks for at that precision

`frontend/android/app/src/main/AndroidManifest.xml` declares
`ACCESS_FINE_LOCATION` in addition to `ACCESS_COARSE_LOCATION`, but every
call site (`frontend/src/hooks/useUserLocation.ts`) passes
`enableHighAccuracy: false`. Play Console cross-checks declared permissions
against the Data Safety form and against actual runtime behavior. Either:
(a) confirm whether Android's WebView geolocation bridge can still surface
GPS-grade precision to a low-accuracy JS request regardless (in which case
disclose "Precise location" conservatively in Play Data Safety), or
(b) drop `ACCESS_FINE_LOCATION` from the manifest if it is unused boilerplate
from the Capacitor template. Could not determine which from static reading
alone — this needs a decision from whoever owns the Android build.

## 6. Privacy policy is Croatian-only

`https://bela-turniri.com/privatnost` (`frontend/src/pages/PrivacyPage.tsx`,
sourced from `frontend/src/i18n/hr/legal.ts`) has no English (or Slovenian —
oddly, given the app itself is bilingual hr/sl) rendering; it is not gated by
the app's own i18n `useTranslation()` the way normal UI copy is (the page
pulls from the `legal` namespace directly, and it was not verified whether
`sl/legal.ts` exists and is wired to this page — worth confirming). Apple and
Google generally accept a policy in the app's primary language, but if the
store listing itself will be presented in English it is worth having at
least an English privacy policy variant. **OPEN**: ask the owner whether an
English version is planned.

## 7. Demo account for reviewers

`review-notes.md` has a placeholder — the owner needs to create a real
Firebase email/password account with at least one populated STARTED
tournament (pairs, a played round, a drink tally) so reviewers see real
screens instead of empty states, and supply those credentials in App Store
Connect / Play Console's reviewer-notes fields (not committed to the repo).

## 8. No technical age gate despite a stated 16+ minimum in the ToS

See `age-rating.md` — `frontend/src/i18n/hr/legal.ts` states the service is
not intended for under-16s without parental consent, but `AuthContext.tsx`'s
sign-up flow collects no birthdate and enforces nothing. This is a policy/ToS
question for the owner, not something this audit can resolve from code: does
the intended store age rating (commonly influenced by the mild alcohol
references — see `age-rating.md`) need to be reconciled with, or does it make
moot, the ToS's stated 16+ line?

## 9. Diagnostics/crash reporting could be added later without updating these docs

Confirmed today: no Crashlytics/Sentry/Bugsnag dependency exists anywhere in
`frontend/package.json` or the native projects, so `app-store-privacy.md` and
`play-data-safety.md` correctly say "not collected." Whoever adds crash
reporting later must re-run this audit's Diagnostics section — flagging this
so it is not silently missed.

## 10. Contact-form IP address retention

`backend/.../model/ContactMessage.java` persists the submitter's IP address
(`ip` column, first hop of `X-Forwarded-For`) indefinitely, for abuse triage
per its own comment. This has no clean Apple/Google App Privacy category
(closest is "Identifiers" or "Diagnostics" depending on interpretation) and
no automatic expiry was found. Not necessarily a blocker, but the owner
should decide (a) which App Privacy bucket to declare it under, matching
what `app-store-privacy.md` currently proposes under Identifiers, and
(b) whether it needs a retention policy for GDPR purposes independent of the
store submission.

## 11. Public profile phone-number exposure to any signed-in user

Confirmed in `backend/.../dtos/PublicProfileDto.java`: if a user sets a phone
number on their own profile, it is shown to **any signed-in visitor**, not
just to a tournament organiser with a legitimate reason to contact them
(anonymous visitors get it redacted server-side). This is presumably an
intentional product decision (the code comment says "profiles are publicly
visible… deliberately exposed"), but it is worth the owner explicitly
re-confirming before the store disclosures go live, since it is broader
sharing than a reviewer might assume from "contact info for the organiser."
