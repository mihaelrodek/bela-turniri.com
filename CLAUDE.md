# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

bela-turniri.com — Croatian web app for organising Belot (bela) card tournaments: tournament listing/calendar/map, pair registration, round drawing, match scores, drink bills, push notifications, public player profiles. UI text, routes and domain names are Croatian (`turniri`, `cjenik` = price list, `repassage` = re-entry purchase, `par` = pair).

Monorepo: `backend/` (Quarkus 3.15, Java 21, Maven) + `frontend/` (React 19, Vite 7, TypeScript, Chakra UI v3) + root infra (docker-compose, Caddy, deploy docs).

## Commands

### Local infra (Postgres + MinIO)
```bash
cp .env.example .env          # fill POSTGRES_* / MINIO_* values
docker compose up -d          # Postgres on 5485, MinIO S3 on 9085, MinIO console on 9185
```
Port scheme: project "85" — backend 8085, Vite 5185, Postgres 5485, MinIO 9085/9185. Keep them in sync across `application.properties`, `docker-compose.yaml`, `vite.config.ts` and `StartupSanityCheck.java` when changing.

### Backend
```bash
cd backend
./mvnw quarkus:dev                                   # dev mode, hot reload, http://localhost:8085/api, Swagger at /api/q/swagger-ui
./mvnw test                                          # all tests
./mvnw test -Dtest=BelaTurniriApplicationTests       # single test class
./mvnw test -Dtest='SomeTest#method'                 # single method (only the smoke test exists today)
./mvnw -DskipTests package                           # fast-jar in target/quarkus-app
```
Dev profile has fallback credentials (`mrodek`/`1234`, `minio`/`minio12345`) so `quarkus:dev` starts without env vars. Prod has no defaults and fails on missing `POSTGRES_USER`, `POSTGRES_PASSWORD`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`. `@QuarkusTest` boots against the real datasource (devservices disabled; `%dev,test` fallbacks in properties), so docker-compose must be up for tests.

### Frontend
```bash
cd frontend
npm ci
npm run dev        # http://localhost:5185, /api proxied to backend 8085
npm run lint       # eslint 9 flat config
npm run build      # tsc -b && vite build — type errors fail the build
```
No test runner configured. No Prettier; 4-space indent, no semicolons, double quotes (match surrounding code).

### Ops
```bash
cd scripts && npm install && node set-admin.mjs <email> [--remove]   # grant/revoke Firebase `role: admin` claim; needs scripts/service-account.json
./ops/deploy.sh        # prod: maintenance flag on → git pull → compose build/up → flag off (see DEPLOY.md)
./ops/up.sh [service]  # prod: maintenance-guarded compose up without pull
./ops/backup-db.sh     # pg_dump to backups/, keeps 14
```
CI: `.github/workflows/ci.yml` builds backend + frontend; lint is non-blocking until the remaining errors are fixed.

## Architecture

### Request flow
Browser → Caddy (prod) or Vite proxy (dev) → Quarkus at `/api/*`. Caddy also 301s legacy English routes to Croatian ones and rewrites bot User-Agents (Googlebot, WhatsApp, etc.) to `/api/preview/*` server-rendered HTML for SEO/link previews (`HomePreviewController`, `TournamentPreviewController`, `ProfilePreviewController`, `SitemapController`). Regular browsers get the SPA. The same legacy redirects exist in `App.tsx` for client-side navigation — keep both in sync when adding routes.

### Auth
Firebase Auth on the frontend (email/password + Google). Backend verifies Firebase ID tokens via `quarkus-oidc` against `securetoken.google.com/<FIREBASE_PROJECT_ID>`; principal is the `email` claim, roles come from a `role` custom claim (set only via `scripts/set-admin.mjs`). No backend user table for auth — `UserProfile` is a side table keyed by Firebase UID, created lazily by `SlugService.ensureProfile` / `POST /user/me/sync`.

Auth is lazy (`quarkus.http.auth.proactive=false`): endpoints are anonymous unless annotated `@Authenticated` (any signed-in user) or `@RolesAllowed("admin")`. Reads are generally public; writes require auth. Controllers get the UID from `JsonWebToken`/`SecurityIdentity` and check ownership manually (tournament creator, pair submitter or share-link co-owner) — there is no central ownership layer.

Frontend: `AuthContext.tsx` exposes `user`, `isAdmin`, `mySlug`. `api/http.ts` is the single axios instance: attaches the Firebase bearer token, and auto-toasts — success on POST/PUT/PATCH/DELETE, error on any failure — unless the call passes `silent`, `successMessage`, `errorMessage` or `silentErrorStatuses`. All API modules in `frontend/src/api/` go through it.

### Backend layering
`controller/` (JAX-RS, one per resource; pattern is load/assert access → delegate → map) → `services/` (`TournamentLifecycleService`, `TournamentPairService`, `SelfRegistrationService`, `RoundService`, `RepassageService`, slugs, storage, geocoding, push) → `repository/` (one Panache repository per entity, all implementing `AppRepository`, a `PanacheRepositoryBase` extension with Spring-Data-style `save`/`saveAll` shims) → `model/` (Hibernate entities, table-named plural: `Tournaments`, `Pairs`, `Rounds`, `Matches`, `Standings`). MapStruct mappers in `mappers/` produce DTOs in `dtos/`; Lombok on entities. `@Transactional` stays on the controller methods: the access bean loads the managed entity and services mutate that same instance.

Access control: `services/CurrentUser` (`@RequestScoped`: `uid()`, `requireUid()` → 401 envelope, `isAdmin()`, `displayName()`) and `services/TournamentAccess` (`load`, `canManage` = admin or creator, `assertCanEdit` → 403, `assertCanEditOrHide` → 404 for endpoints that must not leak existence, `loadForEdit`). Do not compare `jwt.getSubject()` by hand in controllers. Share tokens come from `services/ClaimTokens`. Bare-string 409/400 codes the SPA keys on (`UNPAID_REQUIRED` etc.) are emitted only through `errors/ApiCodes`.

Exception → HTTP mapping (`errors/`): `IllegalArgumentException`/`BadRequestException` → 400, `IllegalStateException` → 409, `NotFoundException`/`NoSuchElementException` → 404, bean validation → 400 (`@Valid` is on every body param), Quarkus `UnauthorizedException`/`ForbiddenException` → 401/403 via `SecurityAuditMappers`. All produce the `ApiError` envelope; 401/403 log an `AUTHZ` WARN line. Every request gets an `X-Request-Id` (`filters/RequestIdFilter`, also in the log format as `[requestId]`); prod writes an access log.

`Tournaments` uses `@Where(is_deleted = false)` soft delete. Tournaments and profiles have URL slugs (`TournamentSlugService`, `SlugService`; Croatian diacritics stripped, collisions get `-2`, `-3`); `TournamentSlugBackfill` fills missing ones at startup. Tournament endpoints accept either UUID or slug in the path (`TournamentsRepository.findByUuidOrSlug`).

### Tournament lifecycle
`TournamentStatus` DRAFT → STARTED → FINISHED. `RoundService.drawNextRound` does backtracking pairing avoiding repeat opponents, BYE for odd counts, `drawManualRound` for organiser-chosen pairings; both push "Runda X" notifications. Match completion updates `Standings`, pushes bill total to the losing pair (`MatchBillService`, `cjenik` drink prices). `RepassageService.buyExtraLife` handles paid re-entries for eliminated pairs. Podium (2nd/3rd) is stored on the tournament at finish.

### Realtime and offline

`realtime/LiveSocket.java` is a `@WebSocket` at `/live/{tournamentUuid}`; because `quarkus.http.root-path=/api` the backend actually serves `/api/live/{uuid}`, and the public `/ws/live/{uuid}` is rewritten by Caddy in prod and by the Vite proxy in dev. `LiveBroadcaster.notifyTournament(uuid, scope)` sends a data-free ping (`{type, tournamentUuid, scope}`) **after commit** via an interposed JTA `Synchronization`, mirroring `PushService`; the client then refetches over REST, so the socket never has to know a DTO shape. Scopes are `match`, `round`, `pairs`, `tournament`. Every mutating service method broadcasts; pure reads do not. Polling (`hooks/usePolling.ts`) stays as the fallback and stretches to 120 s while the socket is connected.

Score, drink and pair-paid mutations go through an offline queue (`hooks/useOfflineQueue.ts`, `bela:opq:v1`): ordered, retried, with `crypto.randomUUID()` op ids sent as `X-Client-Op-Id`. The backend deduplicates in `services/IdempotencyService.java` (claim-then-run via `INSERT … ON CONFLICT DO NOTHING`, response body stored and replayed verbatim), so a retry can never double-apply. Structural operations — round draw, round finish, tournament start/finish/reset, pair replace — are deliberately **not** queued; they refuse offline via `requireOnlineFor`. Rows with a queued op carry `_pending` (a sibling of `_dirty`/`_editing`) and survive every poll and socket refresh until their op confirms.

### Internationalisation

Croatian (default) and Slovenian. Frontend engine is `src/i18n/index.ts` — no library: a module-level locale readable from non-React code, `useTranslation()` on `useSyncExternalStore`, `{placeholder}` interpolation, keys `"namespace.key"` split at the first dot, dictionaries one level deep in `src/i18n/{hr,sl}/{common,tournament,profile,pages,forms,admin}.ts`. `hr` is the source of truth (`type Dictionary = typeof hr`) and each `sl` namespace is typed against its hr counterpart, so a missing Slovenian key is a compile error. **Counts must go through `usePlural()` / `tPlural()`** with `.one`/`.two`/`.few`/`.other` leaves: Croatian has three CLDR categories, Slovenian four because it kept the dual. `utils/format.ts` follows the active locale for dates and currency.

Backend mirrors it: `filters/LocaleRequestFilter` reads `X-Locale`, `services/MessageService` serves `resources/i18n/messages_{hr,sl}.properties` (identical key sets, UTF-8 via an explicit reader). Use `messages.t(key)` for the caller, but **`messages.t(locale, key)` with the recipient's stored `UserProfile.locale` for anything composed for someone else** — push notifications resolve the locale on the request thread and carry the finished payload into the background sender. Bare machine codes the SPA switches on (`UNPAID_REQUIRED`, `ALREADY_FINISHED`, …) are never translated. SEO preview controllers stay Croatian-only on purpose.

### Sharing

`services/QrCodeRenderer` (zxing, error-correction level H, logo capped at 22% of the edge — verified by decoding the render back) serves `GET /tournaments/{idOrSlug}/qr.png`. `services/ShareImageRenderer` + `controller/ShareImageController` render a 1200×630 Open Graph card per tournament, which `TournamentPreviewController` points `og:image` at; the URL is stable and only the bytes behind it change. Both are Caffeine-cached, ETag'd, and rate-limited by the Caddy `render` zone. `controller/CalendarFeedController` serves an RFC 5545 subscription feed at `/api/calendar/tournaments.ics` (CRLF, 75-octet folding, UID `<uuid>@bela-turniri.com` — keep it identical to `utils/ics.ts` or clients duplicate events).

### Storage, geocoding, push
`StorageService` uploads posters/avatars to MinIO: magic bytes decide the type (client extension ignored), header-only dimension guard (max 5000 px edge / 25 MP), Thumbnailator downscale (1600 px posters, 512 px avatars); public URLs built from `MINIO_PUBLIC_BASE_URL`. `/resources/{id}/image` serves `ETag` + 304. `GeocodeService` calls OpenStreetMap Nominatim lazily (1 req/s policy — never bulk geocode); `geocodeOne` commits per tournament and `geocodedAt` is stamped only on success. `PushService.sendToUser` reads subscriptions on the caller thread and sends after commit on a daemon pool (8 s timeout); with a rolled-back transaction nothing is sent. `PushEndpointValidator` allowlists push-service hosts (FCM, Mozilla, Apple, Windows) — a new browser vendor needs a list entry.

### Caching
`filters/PublicReadCacheFilter` stamps `Cache-Control: public, max-age=20, s-maxage=60` + `Vary: Authorization` on anonymous public list GETs (tournaments, count, cjenik) — never add caller-dependent endpoints. Preview HTML and the sitemap are memoised in Caffeine via `services/PreviewRenderService` (`quarkus.cache.caffeine.*` in properties; 404s are never cached). Caddy adds static-asset tiers, blocks `/api/q/*` publicly, and rate-limits `/api/*`.

### Database migrations
Liquibase runs at startup from `backend/src/main/resources/db/changelog/changelog-master.xml`. Adding a migration = new XML file in that directory **plus** an `<include>` line at the end of the master (order matters). Changeset ids follow `YYYY-MM-DD-<topic>`, author `mrodek`. Never edit an applied changeset. No `spring.jpa.ddl-auto` equivalent — entity changes without a changeset break at runtime.

### Frontend structure
Providers in `main.tsx`: Chakra (`system.ts`, semantic tokens with `_light`/`_dark` twins and a `brand` palette — use tokens like `bg.panel`, `fg.muted`, `border.subtle`, never raw `gray.*` fills) → color mode (`color-mode.tsx`, synced to profile via `ThemeSync`) → TanStack Query `PersistQueryClientProvider` (`queryClient.ts`: `qk` key registry, 30 s staleTime, localStorage persistence of public queries only, bump `CACHE_BUSTER` when a cached DTO shape changes) → `AuthProvider` → router, all inside `ErrorBoundary`. Data fetching: `api/*.ts` stay plain async functions; pages use `useQuery(qk.x)`; own profile comes from `hooks/useMyProfile.ts` (invalidate `qk.profile` after profile mutations). TournamentsPage prefetches details on card hover/pointerdown. Heavy pages are `React.lazy` via `lazyWithReload` in `App.tsx`; `vite.config.ts` splits `vendor`, `vendor-map` (leaflet), `vendor-firebase` — react-leaflet must stay in `vendor` (init-order crash). `public/sw.js` is network-first for navigations and public `/api` GETs (never authenticated ones). `TournamentDetailsPage` polls rounds/pairs via `hooks/usePolling.ts` while STARTED. Use `components/ConfirmDialog.tsx` instead of `confirm()`, toaster instead of `alert()`. **No user-facing string is hard-coded** — everything goes through the dictionaries, so a new label means a new key in both `hr` and `sl`. Shared helpers: `utils/format.ts`, `utils/phone.ts`, `utils/ics.ts`, `components/EmptyState.tsx`, `SectionCard.tsx`, `SuffixInput.tsx`. Routes in `App.tsx`; `RequireAuth` guards protected pages. `toaster.ts` is the single shared toaster. `hooks/useDocumentHead.ts` sets per-page title/meta for SEO. PWA install prompt and push subscription live in `components/FirstRunInstallPrompt.tsx`, `InstallAppButton.tsx`, `PushBootstrap.tsx`, `hooks/usePushSubscription.ts`. `PageTour.tsx` + `tourSteps.ts` drive react-joyride onboarding.

## Gotchas
- Adding a UI string means adding it to **both** `hr` and `sl`; a missing Slovenian key fails `tsc` by design.
- Counts need a plural family, never a ternary — Slovenian's dual makes "2 turnirja" a different form from "3 turnirji".
- Drink preset labels are **persisted** into price lists, so they stay Croatian; only their category headings are translated.
- The websocket path differs from its public URL (`/api/live/{uuid}` vs `/ws/live/{uuid}`) because of `quarkus.http.root-path`.
- `changelog-master.xml` includes are append-only: never delete the include of a changeset that already ran somewhere.
- `StartupSanityCheck` warns (does not fail) in prod when `CORS_ORIGINS`, `FIREBASE_PROJECT_ID`, `APP_PUBLIC_BASE_URL`, `MINIO_ENDPOINT` are missing or still dev defaults.
- OpenAPI/Swagger disabled in prod profile on purpose.
- Root `import_*.sql` files are one-off data imports, not migrations.
