# Age rating questionnaire (N6.1)

Answers justified from the code, for Apple's age-rating questionnaire and
Google Play's IARC questionnaire. Where the code cannot answer a subjective
"how frequent/intense" judgment, that is flagged as **OPEN** — the owner
should confirm rather than accept the code's best-guess default.

## Simulated gambling

**None.** Belot ("bela") is a trick-taking card game scored on points to a
target (501/701/1001 — `backend/.../dtos/GameResultReportRequest.java`), not
a game of chance played for stakes. No slot machine, roulette, dice-for-money,
or loot-box-style random-reward mechanic exists anywhere in the code (grepped
for "gamble", "wager", "loot", "slot" — no hits). No in-app purchase exists at
all (see `review-notes.md`). Answer: **No simulated gambling.**

## Alcohol, Tobacco, or Drug Use or References

**Infrequent/Mild reference — text only, no depiction, no promotion.** The
tournament drink price list ("cjenik") organisers fill in has category
headings that include alcoholic categories:
`frontend/src/i18n/hr/common.ts` — `drinkCategory.beer` ("Pivo"),
`drinkCategory.spritzer` ("Gemišt"), `drinkCategory.wine` ("Vino"),
`drinkCategory.spirits` ("Žestoko piće"), alongside non-alcoholic
`drinkCategory.juice` ("Sok") and `drinkCategory.water` ("Voda"). This is a
text label on a scorekeeping feature (tallying what a table already drank at
a card-tournament venue), not alcohol imagery, sale, or promotion in-app —
per CLAUDE.md, these labels are literal Croatian drink names, persisted
verbatim into price lists. **OPEN**: the owner should pick the specific
Apple/Google severity bucket ("Infrequent/Mild" is the recommendation here,
not a definitive platform answer).

## User-generated content

**Yes.** Any signed-in user can:
- Name a tournament and upload a poster photo (`TournamentController.java`,
  `StorageService.java`).
- Name a pair/team (`Pairs.name`, `backend/.../dtos/PairDto.java`).
- Set a public display name, upload an avatar photo, and set a public phone
  number on their own profile (`UserProfile.java`, `UserMeController.java`).
- Pick an in-game name (max 16 chars — `GameNameService.MAX_NAME_LENGTH`) or,
  as a guest, any name at sign-in (`guestIdentity.ts`).
- Write a message via the public contact form (`ContactMessage.java`, up to
  4000 characters), delivered to the operator, not to other end users.

There is **no free-text chat between end users** — `frontend/src/game/chatEnabled.ts`
sets `CHAT_ENABLED = false`, and in-game "reactions" are a fixed set of 6 emoji
(`frontend/src/game/util/reactions.ts`), not free text. There is also
**no report/block/moderation mechanism** in the code (grepped for
report-content, block-user, moderation flows — none found) — flagged as an
open question in `open-questions.md` since Apple guideline 1.2 typically
expects one for apps with public UGC.

## Unrestricted web access

**No.** The native shell never loads an arbitrary external URL inside a
WebView. `frontend/src/platform/NativeShell.tsx`'s deep-link handler
(`appUrlOpen`) only ever calls the SPA router (`navigate(pathname + search +
hash)`) and explicitly rejects any URL whose hostname is not
`bela-turniri.com`/`www.bela-turniri.com`. There is no in-app browser
component, no `window.open` to an arbitrary site, and no `InAppBrowser`
plugin dependency anywhere in `frontend/package.json`. All outbound calls to
third parties (Firebase, Nominatim, Google Places, CARTO/OpenFreeMap tiles,
Resend) are `fetch`/`axios` data calls, never page navigations. Answer:
**no unrestricted web access.**

## Violence, profanity, horror, mature/suggestive themes, contests

None of these apply — the app has no depicted violence, no profanity filter
needed because there is no free-text UGC exposed between strangers beyond a
short pair/tournament/player name (length-capped, no content filter found —
see open questions), no horror content, and no user-run sweepstakes/contests
feature. Answer for all: **None.**

## Minimum age suggested by the app's own Terms of Service

`frontend/src/i18n/hr/legal.ts` (line ~98) states: *"Usluga nije namijenjena
osobama mlađima od 16 godina. Ako ste mlađi od 16 godina, stranicu smijete
koristiti isključivo uz privolu i nadzor roditelja ili skrbnika."* ("The
service is not intended for people under 16. If you are under 16, you may
only use it with parental/guardian consent and supervision.") — this is a
ToS statement, not a technical age gate: **no age-verification step exists
at sign-up** (`AuthContext.tsx`'s `signUp` takes only email/password/display
name). Flagged in `open-questions.md`, since a stated minimum age of 16 in
the ToS should be reflected consistently in the store age-rating answer
(commonly 12+/Teen given the alcohol references above, but the owner should
reconcile the ToS's 16 with whatever bucket is finally chosen).
