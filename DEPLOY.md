# Deploying bela-turniri.com

Single-server prod deploy on a Hetzner Cloud CX22 (or any VPS with Docker).
Stack: postgres + minio + Quarkus backend + Caddy edge (SPA + reverse proxy + TLS).

## Prerequisites

- A VPS with Docker + Docker Compose v2 installed (see steps 1–6 in the setup
  notes — non-root `deploy` user, UFW open on 22/80/443).
- A domain whose DNS A records point at the VPS (`bela-turniri.com` and
  `www.bela-turniri.com` both pointing at the public IP).
- Cloudflare (optional but recommended) set to **DNS-only** (gray cloud) for
  the first deploy so Caddy can complete the Let's Encrypt HTTP-01 challenge
  on its own. Switch the cloud to orange once HTTPS works.

## First-time deploy

On the VPS, as the `deploy` user:

```bash
# 1. Pull the repo
git clone https://github.com/<you>/bela-turniri.com.git
cd bela-turniri.com

# 2. Create the prod env file
cp .env.prod.example .env.prod
# Edit .env.prod — set strong random passwords (openssl rand -base64 24),
# the right FIREBASE_PROJECT_ID, and the public URLs.
$EDITOR .env.prod

# 3. Build images and start the stack
docker compose -f docker-compose.prod.yaml --env-file .env.prod up -d --build
```

First boot takes a few minutes — Maven downloads dependencies, npm installs,
Caddy fetches Let's Encrypt certs. After that, watch the logs:

```bash
docker compose -f docker-compose.prod.yaml logs -f backend
docker compose -f docker-compose.prod.yaml logs -f edge
```

The backend should log a "Startup sanity check passed" line if the env vars
look right; if anything is wrong, you'll see a loud warning block.

Hit `https://bela-turniri.com` in a browser to confirm.

## Updates

```bash
cd bela-turniri.com
git pull
docker compose -f docker-compose.prod.yaml --env-file .env.prod up -d --build
docker image prune -f       # reclaim disk from old images
```

The backend runs Liquibase migrations at boot, so schema changes apply
automatically as part of the restart.

## Backups

A nightly Postgres dump to local disk plus an off-site copy is the minimum.
On the VPS, as `deploy`:

```bash
# Make a backup directory and a dump script
mkdir -p ~/backups
cat > ~/pg-dump.sh <<'EOF'
#!/bin/bash
set -euo pipefail
TS=$(date +%Y%m%d-%H%M%S)
docker compose -f /home/deploy/bela-turniri.com/docker-compose.prod.yaml \
    --env-file /home/deploy/bela-turniri.com/.env.prod \
    exec -T postgres \
    pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > /home/deploy/backups/pg-$TS.sql.gz
# Keep last 14 days
find /home/deploy/backups -name 'pg-*.sql.gz' -mtime +14 -delete
EOF
chmod +x ~/pg-dump.sh

# Add to cron — nightly at 03:00
( crontab -l 2>/dev/null ; echo "0 3 * * * /home/deploy/pg-dump.sh" ) | crontab -
```

For off-site backups, install `rclone`, configure a remote (Backblaze B2 is
~$6/TB-month, basically free at this scale), and add a second cron line:
`30 3 * * * rclone sync /home/deploy/backups remote:bela-backups`.

The Hetzner volume snapshots (the +20% backup option you ticked at server
creation) are *also* taken weekly — they cover the case where Postgres-level
backups don't help (e.g. you `rm -rf` the whole repo).

## Troubleshooting

**Caddy can't get TLS certs.** Check that DNS actually resolves to the VPS
(`dig bela-turniri.com +short` should return the public IP) and that ports
80 and 443 are open in UFW. If Cloudflare is in proxy mode (orange cloud),
turn it off until certs are issued — Cloudflare's proxy intercepts the HTTP-01
challenge.

**Backend won't start, complains about Postgres.** `docker compose logs
postgres` — usually means the password in `.env.prod` doesn't match what the
volume was first initialized with. To wipe and redo Postgres only:
`docker compose down && docker volume rm bela-turniri_pg_data && docker
compose up -d --build`. (You'll lose data — only do this on first deploy.)

**Liquibase migration errors at boot.** A changeset checksum changed since
the DB last applied it. Don't edit committed changesets in place; add a new
one. If you must, `liquibase clearChecksums` against the running container.

**MinIO gives 403 to the backend.** Wrong `MINIO_ROOT_USER` /
`MINIO_ROOT_PASSWORD` combination, or you changed them between deploys
without wiping the MinIO volume. The bucket is private; no public-read
policy exists by design — all image reads go through the backend.

## Useful commands

```bash
# Status
docker compose -f docker-compose.prod.yaml ps

# Tail logs for one service
docker compose -f docker-compose.prod.yaml logs -f backend

# Shell inside a running container
docker compose -f docker-compose.prod.yaml exec backend sh

# Postgres CLI
docker compose -f docker-compose.prod.yaml exec postgres psql -U "$POSTGRES_USER" "$POSTGRES_DB"

# Stop everything (data volumes preserved)
docker compose -f docker-compose.prod.yaml down

# Stop and DELETE all data (full wipe)
docker compose -f docker-compose.prod.yaml down -v
```

## Game server

The standalone Node.js WebSocket server for live Bela card games runs alongside
the main stack (`bela-game` service). It listens on **port 8285** internally,
reachable from the browser at the public path **/ws/game** (Caddy routes this
via the internal Docker network).

Environment variables (in `.env.prod`):
- `GAME_PORT=8285` — server listen port (must match Dockerfile EXPOSE).
- `FIREBASE_PROJECT_ID` — game server verifies auth tokens against the same
  Firebase project as the backend.
- `GAME_CORS_ORIGINS` — WebSocket CORS whitelist (typically same as
  `CORS_ORIGINS`).
- `GAME_DEV_ALLOW_ANON=1` — dev only: allow anonymous sessions for testing
  (omit in prod).
- `GAME_RESULTS_TOKEN` — shared secret between the game server and the
  backend for `POST /api/internal/game-results` (per-player win/loss stats,
  game/README.md §8). Same value must be set on BOTH the `backend` and
  `game` services. Caddy also 404s this path publicly; the token is the
  second layer. Missing/default in prod only warns at backend startup
  (`StartupSanityCheck`) — it does not fail the boot, but every report is
  refused (401) until it's set.

The `./ops/deploy.sh` script rebuilds the game image alongside the backend and
edge, and includes `bela-game` in the image-rollback logic. The Caddy routing
(see Caddyfile, `/ws/game*` block) strips the `/ws/game` prefix and reverse-proxies
to `game:8285`, allowing the game server to serve WebSockets at the internal path `/`.

Health check: `GET http://localhost:8285/health` (must return 200). If the
server is unhealthy, the edge service refuses to start until it recovers.

### Feature flag ("Igraj" kill switch)

The game ships **off by default** — a fresh box has no
`ops/game-flag/ENABLED` file, so `/game-status.json` answers
`{"enabled":false}`, the "Igraj" nav link stays hidden, and `/igra` bounces
signed-in visitors back to `/`. Same trick as the maintenance flag: it's a
host bind-mount Caddy stat()s per request, so no rebuild/redeploy/reload
is needed to flip it.

```bash
./ops/toggle-game.sh on      # switch it on
./ops/toggle-game.sh off     # switch it off
./ops/toggle-game.sh status  # check current state
```

## Druge domene: bela.games i belot.games

Two more front doors onto the **same stack**: same `edge`/`backend`/`game`
containers, same Postgres, same Firebase project, same lobby, same rooms,
same accounts. `bela.games` and `belot.games` are **equal twins** — both
serve the site themselves, neither redirects to the other — and they show
only the online game (`/igra`) and the scorepad (`/blok`). Everything
tournament-shaped (`/turniri`, `/kalendar`, `/karta`, `/pronadi-para`,
`/preuzmi-par`, `/preuzmi-ime` and their English aliases) 301s to
`bela-turniri.com`, which is itself unchanged. Only the `www.` names
redirect, each to its own apex.

There is **one web build**: `frontend/src/site.ts` picks the product from the
hostname at runtime (`GAMES_DOMAINS`), and the build emits a second HTML
shell (`dist/index.games.html`, from the `bela-games-shell` plugin in
`frontend/vite.config.ts`) with the games title/description/OG/canonical/
JSON-LD and its own manifest link. Caddy serves that shell as `/` on both
games domains. Nothing about the deploy procedure changes — `./ops/deploy.sh`
as always.

**One canonical, on purpose.** Two hostnames serving identical bytes is
duplicate content, so the shell's `<link rel="canonical">` and `og:url` say
`https://bela.games/` on **both** domains, and the sitemap lists only
`bela.games` URLs. `belot.games` stays a fully working front door — it just
hands its ranking signal to the twin chosen as canonical. Crawling is
allowed on both (a crawler has to fetch `belot.games` to *read* that
canonical). If the two ever have to rank separately, that is a different
decision and needs per-host shells, not a tweak here.

### Checklist, in order

1. **DNS first — before the deploy.** Point all four names at the same
   public IP as `bela-turniri.com`: `bela.games`, `www.bela.games`,
   `belot.games`, `www.belot.games` (A, and AAAA if the box has IPv6). Caddy
   requests each certificate lazily, on the first request for that hostname,
   via the HTTP-01 challenge. If DNS is not propagated yet, that first
   request never reaches the server and the site simply does not answer;
   once DNS resolves, the next request triggers issuance and it works with
   no redeploy. Nothing breaks on `bela-turniri.com` in the meantime — a
   site block whose cert cannot be obtained does not take the others down.
   Behind Cloudflare: **DNS-only (grey cloud)** until HTTPS works, same as
   for the first domain. Repeated failed attempts count against Let's
   Encrypt rate limits, so fix DNS rather than retrying in a loop.

2. **`.env.prod` → `CORS_ORIGINS`.** Add all four origins —
   `https://bela.games`, `https://www.bela.games`, `https://belot.games`,
   `https://www.belot.games` — to the existing comma-separated list. The
   same value is handed to the game server as `GAME_CORS_ORIGINS`, which
   checks it against the WebSocket handshake's `Origin` header: miss one and
   the lobby on that domain never connects, while REST calls are blocked by
   the browser's CORS check. Then redeploy (`./ops/deploy.sh`) so backend
   and game pick the value up.

3. **Firebase Console → Authentication → Settings → Authorized domains.**
   Add all four hostnames: `bela.games`, `www.bela.games`, `belot.games`,
   `www.belot.games`. **Without this, Google and Apple sign-in fail on that
   host** (`auth/unauthorized-domain`) — email/password keeps working, which
   makes the breakage easy to miss. Nothing else in Firebase changes: same
   project, same users, same ID tokens the backend already verifies.

4. **Universal / App Links.** `ops/well-known-games/` is bind-mounted at
   `/well-known-games` and served on **both** games domains (see the
   `well_known` snippet in the Caddyfile) — one native games app claims both
   names, so one set of files. Its two files carry placeholders for that
   **second** app: `TEAMID.games.bela.app` in `apple-app-site-association`
   and `REPLACE_WITH_GAMES_RELEASE_SHA256` in `assetlinks.json`. Replace
   them exactly as described under "Universal / App Links" above once the
   app exists, and remember its entitlements must list **both**
   `applinks:bela.games` and `applinks:belot.games`. Until then the files are
   harmless and every link opens in the browser. `ops/well-known/`
   (com.belaturniri.app) is untouched.

5. **Google Search Console.** Add a property for `https://bela.games` **and**
   one for `https://belot.games` (URL-prefix properties; or Domain
   properties if you can add the DNS TXT records). Verifying both is what
   makes the cross-host `Sitemap:` line in `robots.txt` legitimate, and it is
   how you watch the canonical consolidation actually happen. Submit the
   sitemap `https://bela.games/sitemap.xml` under the bela.games property — a
   small static file listing `/`, `/igra`, `/blok`
   (`frontend/public/sitemap.games.xml`), not the backend's dynamic sitemap,
   which lists tournaments and belongs to the bela-turniri.com property. Do
   **not** submit a separate sitemap for belot.games: it has no canonical
   URLs of its own. `robots.txt` on both games domains is
   `frontend/public/robots.games.txt`. Bing Webmaster Tools: same, if you
   keep that property. Expect `belot.games` URLs to be reported as
   "Duplicate, Google chose a different canonical" — that is the design
   working, not an error.

6. **GA4.** There is currently **no analytics on the games domains**: the
   inline GA4 snippet in `frontend/index.html` gates itself on the
   `bela-turniri.com` / `www.bela-turniri.com` hostname, so it never loads
   there, and the derived games shell inherits that. Deliberate — the
   existing property's data stays clean. To measure them, either create a
   second GA4 property and add a hostname branch to that snippet, or add the
   games hostnames as additional data streams on the existing property and
   widen the hostname check (one stream can serve both twins; the hostname
   dimension separates them in reports). The CSP already allows
   googletagmanager.com on every host, so nothing at the edge changes either
   way.

### Verify after the deploy

```bash
# 1. Certificate + the shell, on BOTH twins. HTTP/2 200, and the title must
#    be the games one — NOT "Bela Turniri".
for d in bela.games belot.games; do
  curl -sI "https://$d/" | head -1
  curl -s  "https://$d/" | grep -o '<title>[^<]*</title>'
done
# → <title>bela.games — igraj belu online i vodi zapisnik</title>  (both)

# 2. The canonical is bela.games on BOTH — that is the duplicate-content fix.
for d in bela.games belot.games; do
  curl -s "https://$d/" | grep -E 'rel="canonical"|og:url|rel="manifest"'
done
# → canonical + og:url https://bela.games/ , manifest /manifest.games.webmanifest

# 3. www → its OWN apex (301), and full-site-only paths → bela-turniri.com.
curl -sI https://www.bela.games/igra     | grep -i '^location'   # bela.games
curl -sI https://www.belot.games/igra    | grep -i '^location'   # belot.games
curl -sI https://belot.games/turniri/foo | grep -i '^location'
# → https://bela-turniri.com/turniri/foo

# 4. Same containers behind both names.
for d in bela.games belot.games; do
  curl -s  "https://$d/game-status.json"                 # {"enabled":true|false}
  curl -sI "https://$d/api/tournaments/count" | head -1  # 200
done

# 5. The games robots/sitemap/manifest.
curl -s https://belot.games/robots.txt   | tail -2   # Sitemap: https://bela.games/...
curl -s https://belot.games/sitemap.xml  | grep loc  # only bela.games URLs
curl -s https://belot.games/manifest.webmanifest | head -3   # rewritten copy

# 6. WebSocket path (same public URL everywhere). Expect 101.
for d in bela.games belot.games; do
  curl -sI -o /dev/null -w "$d %{http_code}\n" \
       -H "Connection: Upgrade" -H "Upgrade: websocket" \
       -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: AAAAAAAAAAAAAAAAAAAAAA==" \
       -H "Origin: https://$d" "https://$d/ws/game"
done
# A 403/400 here almost always means that origin is missing from CORS_ORIGINS.

# 7. Nothing regressed on the original domain.
curl -s  https://bela-turniri.com/ | grep -o '<title>[^<]*</title>'
curl -sI https://bela-turniri.com/tournaments | grep -i '^location'
```

Then open both games domains in a browser and sign in on each.

### Two things that surprise people

- **Login state is per-origin.** Same accounts, same profile, same rooms,
  same lobby — but a browser session on `bela.games` is a separate sign-in
  from one on `belot.games` and from one on `bela-turniri.com`. Signing out
  of one does not sign you out of the others; a player who signed in on one
  twin will be asked to sign in again on the other, with the same account.
- **An installed PWA is per-origin too.** Installing from `bela.games` and
  from `belot.games` gives **two** home-screen apps (both named
  "bela.games", both starting at `/igra`), each with its own service-worker
  cache and its own push subscription, alongside any existing "Bela Turniri"
  install. Worth pointing people at one of the two when you promote it.

### Adding another domain later

A **third equal twin** means: add its apex to the `bela.games, belot.games`
site block in the `Caddyfile`, add a `www.<name> { redir … }` block for it,
add it to `GAMES_DOMAINS` in `frontend/src/site.ts`, and add its origins to
`CORS_ORIGINS` and to Firebase's authorized domains. The canonical stays
`bela.games`.

A domain bought only to **funnel traffic** needs much less — one block in the
`Caddyfile` (there is a commented, ready-to-copy example right above the
games site block) plus DNS pointing here *before* the deploy:

```
example.tld, www.example.tld {
    redir https://bela.games{uri} permanent
}
```

Such an alias never reaches the SPA, so it must **not** be added to
`GAMES_DOMAINS` — only hostnames that actually serve the app belong there.
Rebuild the edge (`./ops/up.sh edge`) and Caddy fetches the new certificate
on the first request.

### Rollback

Delete the offending name from the games site block (or the whole block, and
the `www.` blocks) in the `Caddyfile` and redeploy (`./ops/up.sh edge`), or
just point the DNS away — the domain then stops resolving here and nothing
else in the stack is affected. The extra `CORS_ORIGINS` entries and
`ops/well-known-games/` are harmless if left in place. `bela-turniri.com` is
never involved in either direction.

## Maintenance mode, deploy scripts, backups

### `ops/deploy.sh` and `ops/up.sh`

Prefer these over a raw `docker compose ... up -d --build` for any update
that touches production traffic - they show visitors the "Nadogradnja u
tijeku" (upgrade in progress) page for the duration of the rebuild instead
of intermittent 502s / connection resets while containers restart.

```bash
./ops/deploy.sh             # full release: git pull + rebuild + restart + prune
./ops/up.sh                 # guarded rebuild + restart, no git pull, no prune
./ops/up.sh backend         # ...only the backend service
```

Both scripts `touch ops/maintenance/ENABLED` before touching the stack and
`rm` it in an `EXIT` trap, so the flag always clears - even if the build
fails or you Ctrl-C. The flag is a plain file on a host bind-mount
(`./ops/maintenance:/maintenance:ro` on the `edge` service in
`docker-compose.prod.yaml`); Caddy `stat()`s it per request (see the
`@maintenance` matcher at the top of the Caddyfile), so toggling it needs no
image rebuild and no Caddy reload. `ops/maintenance/ENABLED` is gitignored -
never commit it.

To trigger maintenance mode manually (e.g. for a DB migration you want to
babysit without traffic in the way):

```bash
touch ops/maintenance/ENABLED     # ON
# ...do the thing...
rm ops/maintenance/ENABLED        # OFF
```

### Backups

`ops/backup-db.sh` dumps Postgres, gzips it into `./backups/`, and deletes
anything older than 14 days:

```bash
./ops/backup-db.sh
```

Crontab line for a nightly 03:00 backup (as the `deploy` user):

```
0 3 * * * cd /home/deploy/bela-turniri.com && ./ops/backup-db.sh >> /home/deploy/backups/backup.log 2>&1
```

For off-site backups, install `rclone`, configure a remote (Backblaze B2 is
~$6/TB-month, basically free at this scale), and add a second cron line:
`30 3 * * * rclone sync /home/deploy/bela-turniri.com/backups remote:bela-backups`.

The Hetzner volume snapshots (the +20% backup option you ticked at server
creation) are *also* taken weekly - they cover the case where Postgres-level
backups don't help (e.g. you `rm -rf` the whole repo).

### Restoring a backup

`ops/restore-db.sh` reverses `ops/backup-db.sh`: it drops and recreates the
database, then restores from a given dump file. **Destructive** - everything
currently in the database is gone once you confirm.

```bash
./ops/restore-db.sh backups/bela-2026-09-04-0300.sql.gz
```

It prompts for an explicit `yes` (pass `-y` to skip, e.g. for a scripted
disaster-recovery drill), shows the maintenance page for the duration (same
as `ops/deploy.sh` / `ops/up.sh`), stops the backend before touching the
database, and restarts it afterwards. It picks the restore method from the
file extension - `.gz` (what `ops/backup-db.sh` produces) is gunzipped into
`psql`, `.dump`/`.backup` (a custom-format `pg_dump -Fc` archive) goes
through `pg_restore`, anything else is fed to `psql` as plain SQL.

### `/api/q/*` is no longer public

The SmallRye health / OpenAPI namespace (`/api/q/health`, `/api/q/openapi`,
etc.) now 404s at the Caddy edge - it leaked datasource up/down state and
internal route info to anyone who found it. The `backend` service's own
Docker healthcheck (`docker compose ps`) and the `depends_on` startup
ordering still hit it directly on the internal network, so nothing
legitimate is affected. If you need it for local debugging, `docker compose
exec backend curl localhost:8085/api/q/health/ready` from inside the stack,
or `docker compose exec` a shell into `backend`.

### Rate limiting

The Caddy image now bundles the `caddy-ratelimit` module (built via `xcaddy`
in `frontend/Dockerfile`, `caddy-build` stage). Two per-IP zones are active,
keyed on `{remote_host}`:

- `/api/*` (general API traffic): 3000 requests / minute.
- `/api/preview/*` and `/sitemap.xml` (SSR preview renders, sitemap): 120
  requests / minute - these do real DB reads plus HTML rendering per hit, so
  they get a much tighter cap.
- `POST /api/contact`: 5 requests / minute - the contact form sends real
  outbound email per submission, so it's capped far below the general zone.

A client that exceeds its zone's limit gets `429 Too Many Requests` instead
of reaching the backend. If a legitimate integration starts tripping these
(e.g. a monitoring service polling too fast), raise the relevant zone's
`events` in the Caddyfile rather than removing the limit.

## First-screen seed (`GET /api/seed`)

A cold load used to be a strict waterfall: parse `index.html` → download the
JS bundle → boot React → mount `TournamentsPage` → *only then* fire the three
REST calls the first screen is made of. `/api/seed` cuts the tail off it.

**How it works.** `frontend/index.html` carries an inline classic `<script>`
as the very first thing after `<meta charset>`. On `/turniri`, on `/` (which
redirects there) and on `/turniri/<uuid-or-slug>` it fires
`GET /api/seed?path=<location.pathname>` and parks the promise on
`window.__belaSeed`. `src/main.tsx` waits for it — **at most ~400 ms** — and
`src/shell/seed.ts` writes the payload into the react-query cache under the
pages' own `qk` keys before the first render. The same file also paints a
static skeleton (navbar + three listing cards) inside `#root`, so there is
something on screen before any JS exists at all.

**Why JSON and not server-rendered HTML.** The `backend` container has no
copy of the frontend `dist` — Caddy serves the static build and only proxies
`/api/*` here — so a "`/api/shell` returns a filled-in index.html" variant
would need the two images to share a volume and would couple every frontend
deploy to the backend's file layout. The JSON seed needs neither.

**Operationally it is nothing new.** It rides the existing `handle /api/*`
block (no Caddyfile change, no new rate-limit zone — one extra request per
cold load against a 3000/min per-IP budget), the response is
`Cache-Control: public, max-age=20, s-maxage=60`, and
`ShellRenderService` memoises it in-process for the same 20 s. 404s (an
unknown slug) are never cached, in either place.

**It is optional by design.** The promise never rejects, a failure resolves
to `null`, and the 400 ms cap means a cold or slow backend can never hold the
SPA hostage: the app renders and the pages fetch for themselves exactly as
they did before. If you ever need to switch it off, deleting the inline
`<script>` block from `index.html` is the whole rollback — nothing else reads
`window.__belaSeed`.

**One caveat worth knowing.** The seed is the ANONYMOUS variant of the
listing (it never reads `CurrentUser` — that is what makes it publicly
cacheable). For an anonymous visitor it is therefore also the AUTHORITATIVE
variant: it is byte-for-byte the answer the same endpoints would give them.
Only a signed-in caller can see something different — a user who blocked an
organiser is one row too generous for a moment, an organiser is missing their
own-tournament affordances.

So the revalidation is **conditional on the session, not unconditional**:
`applySeed` records the keys it wrote, and `revalidateSeedForUser` — called by
`AuthProvider` at the first `onAuthStateChanged` — invalidates them with
`refetchType: "active"` **only when someone is signed in**. A guest's three
first-screen queries are not refetched at all; the seed stands until the normal
30 s `staleTime`, which removes three requests from every anonymous cold load.
Do not turn that back into an unconditional invalidate, and do not drop the
signed-in half either — that is what keeps a blocked organiser's rows from
lingering. (The `updatedAt: generatedAt` timestamp is separate and load-bearing
for a different reason: it is what makes "whichever is fresher wins" resolve
correctly against the localStorage persister.)

Note the ordering this survives: the seed and the Firebase session resolve
independently. Whichever lands second does the work — a late seed applied after
the session is known is judged on the spot, an early seed waits in
`seededKeys`. See `frontend/src/shell/seed.ts`.

## Email (Resend)

Outgoing mail (today: the `/kontakt` form's notification) goes through the
[Resend](https://resend.com) HTTP API — one authenticated `POST` from
`backend/.../services/EmailService.java`, no SMTP stack in the build. Sends
are fire-and-forget and deferred to after commit, so a dead provider can
never fail a request; **with `RESEND_API_KEY` unset the backend boots
normally and every send is a silent no-op**, which is exactly how local dev
runs. Contact-form submissions are always stored in `contact_messages`
first, so an unconfigured or broken mailbox loses a notification, never a
message.

Setup:

1. Create a Resend account and add **bela-turniri.com** under *Domains*.
2. Add the DNS records Resend shows you at your registrar — an SPF `TXT`
   record and a DKIM `TXT` record (plus the optional DMARC one). Wait for
   the domain to flip to *Verified*; until it does, every send is rejected.
3. Create an API key under *API Keys* with sending permission.
4. Put these in `.env.prod` and redeploy (`./ops/deploy.sh`):

```bash
RESEND_API_KEY=re_...                                  # the key from step 3
MAIL_FROM=Bela turniri <noreply@bela-turniri.com>      # must be on the verified domain
CONTACT_TO=you@your-domain.tld                         # where the form is delivered
```

`Reply-To` on the notification is set to the person who wrote in, so
answering is one tap — the `MAIL_FROM` mailbox itself does not need to
receive.

Verify after deploy: `docker compose -f docker-compose.prod.yaml logs backend
| grep Mail:` should show `Mail: Resend configured, from=…, contactTo=…`. If
either variable is missing you get a `WARN` at boot instead, and failed sends
are logged at `WARN` with the request id.

## Native push (FCM)

Browsers get Web Push (VAPID); the installed iOS/Android apps get Firebase
Cloud Messaging. Both run from the same `PushService.sendToUser` fan-out, so a
user with a browser subscription *and* the app gets both, and neither path can
break the other. Nothing about Web Push changed.

Set **one** of these on the backend:

```
FIREBASE_SERVICE_ACCOUNT_JSON=<the whole service-account JSON on one line>
# or
FIREBASE_SERVICE_ACCOUNT_FILE=/run/secrets/firebase-service-account.json
```

`FIREBASE_SERVICE_ACCOUNT_JSON` wins when both are set. Get the credential from
the Firebase console -> Project settings -> Service accounts -> **Generate new
private key**. It must be the **same Firebase project as `FIREBASE_PROJECT_ID`**
(the project whose ID tokens `quarkus-oidc` verifies) — a key from another
project authenticates fine and then fails to route to any of your tokens.
Treat it like a private key: it is a full admin credential for that project.

Optional: `FCM_ANDROID_CHANNEL_ID` (default `bela`) must match the notification
channel the Android shell creates on first run, or Android 8+ silently drops
every notification.

With neither variable set FCM is **disabled**, not broken: the backend boots,
`PUT /user/me/push/device` still stores device tokens, and those tokens start
being delivered to the moment credentials are deployed — nothing needs
re-registering. `StartupSanityCheck` prints one WARN at boot in prod saying so.

Verify after deploy: `docker compose -f docker-compose.prod.yaml logs backend |
grep 'Push:'` should show `Push: FCM configured, native push enabled.` The
disabled case logs `Push: FCM service account not configured — native push
disabled.`, and a bad key file logs `Push: failed to initialise FCM` at ERROR
(the app still boots).

### Live Activities / Live Updates

The game server pushes lock-screen game state for players whose app is
backgrounded through `POST /api/internal/live-activity` (game/README.md §3.4).
No new environment variables: it reuses `GAME_RESULTS_TOKEN` and
`BACKEND_INTERNAL_URL` on the game server and the FCM service account above on
the backend, and Caddy's existing `/api/internal/*` block already hides it.
Without the token the game server logs `liveActivity.disabled` once; without
FCM the backend answers 202 and sends nothing. Android Live Updates work as
soon as FCM is configured. iOS Live Activities need
`ApnsConfig.Builder#setLiveActivityToken`, which arrived in firebase-admin
9.10.0 — the version `backend/pom.xml` pins since 2026-09-13. They also need
the APNs `.p8` key uploaded in Firebase → Cloud Messaging, and the iOS widget
extension itself (task N4.1). If a future downgrade drops the method, the
backend logs `LiveActivity: firebase-admin on the classpath lacks ...` once and
the iOS branch becomes a no-op; `LiveActivitySenderTest` fails first.

## Google Places / map tiles

Build-time frontend variables (`frontend/.env.example`, mirrored empty in
`frontend/.env.native`). All are optional — with none of them set the app uses
OpenStreetMap Nominatim for address search and CARTO Voyager tiles (keyed, see below).

| Variable | Purpose |
| --- | --- |
| `VITE_GOOGLE_MAPS_API_KEY` | Enables Google Places (New) autocomplete on the create/edit tournament form. Empty = Nominatim fallback. |
| `VITE_CARTO_API_KEY` | Free CARTO basemap key (https://carto.com/basemaps/apikey). Without it tiles carry an "API KEY REQUIRED" watermark. |
| `VITE_MAP_TILE_URL` | Leaflet tile URL template for both maps. Empty = CARTO Voyager. |
| `VITE_MAP_TILE_ATTRIBUTION` | Attribution HTML shown in the map corner. Empty = provider default. |
| `VITE_MAP_PROVIDER` | `carto` (default, raster) or `openfreemap` (MapLibre GL vector tiles, no key). |
| `VITE_OPENFREEMAP_STYLE` | OpenFreeMap light style: `liberty` (default), `bright`, `positron`, `dark`, `fiord`. |
| `VITE_OPENFREEMAP_STYLE_DARK` | Style used while the app is in dark mode. Default `dark`. |

**The Google key ships inside the JS bundle.** That is unavoidable for a
browser-side Places call: the only protection is the restriction configured in
Google Cloud. Restrict the key to `https://bela-turniri.com/*`,
`https://www.bela-turniri.com/*`, `http://localhost:5185/*`,
`capacitor://localhost/*`, `https://localhost/*` (Application restriction →
Websites) **and** to "Places API (New)" only (API restriction). Places API (New)
requires billing to be enabled on the project; Google's free monthly tier covers
roughly 10 000 autocomplete sessions. Autocomplete + the details call on pick
share one session token, so a whole typing interaction bills as one session.

Reverse geocoding (clicking the map picker) stays on Nominatim regardless — it
is a different, pricier Google API and a map click is rare. The backend's lazy
`GeocodeService` is unaffected and also stays on Nominatim.

CARTO gated its public basemaps in 2026: request the free key (no account, 5 M tiles/month non-commercial) at https://carto.com/basemaps/apikey, set `VITE_CARTO_API_KEY`, rebuild. The key ships in the bundle; CARTO keys are referrer-restricted on their side. To leave CARTO altogether set `VITE_MAP_TILE_URL` + `VITE_MAP_TILE_ATTRIBUTION` for MapTiler / Stadia / Thunderforest.

```
VITE_MAP_TILE_URL=https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=YOUR_KEY
VITE_MAP_TILE_ATTRIBUTION=<a href="https://www.maptiler.com/copyright/">MapTiler</a> <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>
```

Stadia, Thunderforest and Mapbox raster tiles work the same way. Leaflet's `{s}`
(subdomain) and `{r}` (retina `@2x`) placeholders are supported.

### OpenFreeMap (keyless alternative)

To stop depending on a CARTO key altogether, switch to OpenFreeMap vector tiles
— **no key, no account, no registration, no request limit, commercial use
allowed**:

```
VITE_MAP_PROVIDER=openfreemap
VITE_OPENFREEMAP_STYLE=liberty        # or bright / positron / dark / fiord
VITE_OPENFREEMAP_STYLE_DARK=dark      # used when the app is in dark mode
```

Rebuild and redeploy; nothing else changes. Both maps (`/karta` and the
create-form picker) stay on Leaflet — markers, popups and controls are
untouched — but the basemap is drawn by MapLibre GL as a Leaflet layer
(`@maplibre/maplibre-gl-leaflet`). Attribution (`OpenFreeMap © OpenMapTiles
Data from OpenStreetMap`) is required and rendered automatically; do not
remove it.

Two things worth knowing:

* The MapLibre renderer (~1 MB, chunk `vendor-maplibre-*.js`) is **lazily
  imported**, so a CARTO deployment never downloads it and it is not in the
  offline precache manifest. Switching to OpenFreeMap costs that download the
  first time a map is opened.
* Dark mode works differently per provider. The raster path fakes a dark map
  with a CSS filter over the tiles (`.dark .bela-basemap-raster
  .leaflet-tile-pane` in `frontend/src/system.ts`); the vector path loads a
  real dark style instead, and that filter is deliberately scoped away from it.

`VITE_MAP_TILE_URL` overrides `VITE_MAP_PROVIDER`: an explicit tile template can
only mean raster tiles.

## Native builds

iOS and Android builds run in `.github/workflows/native.yml` on every PR and push
to `main` when `frontend/` changes. macOS 15 builds the iOS simulator app (debug,
no signing); Ubuntu builds the Android APK (debug). The APK is uploaded as a
7-day artifact. Both jobs run `npm run build:native` (TypeScript + Vite + Capacitor sync)
before invoking the native build tools (`xcodebuild`, `gradlew`). No simulator/emulator
tests — builds only verify the app compiles.

## Universal / App Links

`https://bela-turniri.com/turniri/<slug>`, `/blok/*`, `/igra/*` and
`/profil/<slug>` open the installed app directly (no browser hop, no share
sheet) instead of Safari/Chrome, on both iOS (Universal Links) and Android
(App Links) — `frontend/src/platform/NativeShell.tsx`'s `appUrlOpen` /
`getLaunchUrl()` listener then routes the URL's path into the SPA router.
Both platforms verify ownership of the domain by fetching a JSON file over
HTTPS at boot/install time, so the two files below have to be reachable with
no redirect and the right `Content-Type` — see the Caddyfile's
`/.well-known/*` handlers (placed right after the maintenance block, on
purpose: they must win even when maintenance mode is on) and the
`./ops/well-known:/well-known:ro` mount on the `edge` service in
`docker-compose.prod.yaml`.

**Placeholders to replace before this works — both files live in
`ops/well-known/` and take effect immediately (`docker compose restart edge`
optional, Caddy `stat()`s the mount per request):**

- `ops/well-known/apple-app-site-association` — replace **`TEAMID`** (both
  occurrences: `applinks.details[0].appIDs` and `webcredentials.apps`) with
  the real 10-character Apple Developer Team ID (Apple Developer portal →
  Membership, or `xcodebuild -showBuildSettings` in `ios/App/App` once a
  signing team is set → `DEVELOPMENT_TEAM`).
- `ops/well-known/assetlinks.json` — replace **`REPLACE_WITH_RELEASE_SHA256`**
  with the SHA-256 certificate fingerprint of the key that actually signs
  the APK/AAB users install:
  - Local/debug signing: `cd frontend/android && ./gradlew signingReport` —
    copy the `SHA256` line under the `release` (or `debug`, for a debug-build
    test) variant.
  - Play App Signing (the real production key once published through Play
    Console): Play Console → your app → **Setup → App signing** → copy the
    **SHA-256 certificate fingerprint** under *App signing key certificate*
    — this is the key Google re-signs your upload with, not your local
    upload key, so it's the one that must appear here for a Play Store
    install to verify.
  - `assetlinks.json` accepts multiple fingerprints in the array — list both
    the upload key and the Play App Signing key while testing internal
    builds side by side with a Play Store install.

Until both placeholders are replaced with real values, Apple/Android fail
verification silently and every link opens in the browser as before — safe
to deploy this file as-is ahead of having the values.

**Verifying on a device** (not in CI, not via simulator/emulator commands —
those don't exercise the real OS-level link-verification flow):

```bash
xcrun simctl openurl booted https://bela-turniri.com/turniri/<slug>
```

Run on a physical device or a simulator with the app already installed, once
the AASA file has the real Team ID live in prod — it should open the app
straight to that tournament. Before the Team ID is filled in (or before the
app has been installed at least once so iOS re-fetches the AASA), the same
link opens Safari instead — that's the expected fallback, not a bug.

**iOS entitlements**: `frontend/ios/App/App/App.entitlements` declares
`applinks:bela-turniri.com` and `webcredentials:bela-turniri.com`, and is
wired into both build configurations of the `App` target via
`CODE_SIGN_ENTITLEMENTS = App/App.entitlements` in `project.pbxproj`.
Nothing further to do in Xcode — opening the project should show
"Associated Domains" under the App target's *Signing & Capabilities* tab
with both entries already listed.

## Sign in with Apple / native Google

Both native shells replace `signInWithPopup` (blocked in WKWebView, and Google
refuses OAuth inside an embedded webview) with
`@capacitor-firebase/authentication`: the plugin runs the OS sign-in sheet,
the app then feeds the returned OAuth credential into the Firebase **JS** SDK
with `signInWithCredential`, so `onAuthStateChanged`, `getIdToken()` and every
REST call downstream behave exactly as on the web. `skipNativeAuth` stays
**false** on purpose (`frontend/capacitor.config.ts`), so the native Firebase
SDK is signed in as well — `@capacitor-firebase/messaging` needs that to bind
the FCM token to the right account.

Sign in with Apple is **mandatory** on iOS: App Store Review guideline 4.8
requires it in any app that offers another third-party social login, and this
app offers Google. It is also enabled on the web (popup) so the same account
works in a browser.

Nothing below is in the repo — these are one-time console steps the owner has
to do, and until they are done the Apple/Google buttons fail with
`auth/operation-not-allowed` or return to a dead end.

### 1. Apple Developer portal

1. **Certificates, Identifiers & Profiles → Identifiers → App ID
   `com.belaturniri.app`** → edit → tick **Sign in with Apple** → Save.
   (`frontend/ios/App/App/App.entitlements` already declares
   `com.apple.developer.applesignin = [Default]`; signing fails if the App ID
   does not have the capability.)
2. **Identifiers → + → Services IDs** → create e.g. `com.belaturniri.web`,
   description "Bela Turniri Web". Edit it → tick **Sign in with Apple** →
   **Configure**:
   - Primary App ID: `com.belaturniri.app`
   - Domains and Subdomains: `bela-turniri.com`
   - Return URLs: `https://bela-turniri.firebaseapp.com/__/auth/handler`
     (the Firebase Auth handler — substitute the project's real
     `authDomain` if it is not `bela-turniri.firebaseapp.com`; it is the
     `VITE_FIREBASE_AUTH_DOMAIN` value)
   This Services ID is only used by the **web** popup flow; the native flow
   authenticates against the App ID directly.
3. **Keys → +** → name e.g. "Bela Turniri Sign in with Apple" → tick
   **Sign in with Apple** → Configure → Primary App ID `com.belaturniri.app`
   → Register → **download the `.p8` once** (Apple never shows it again).
   Note the **Key ID** shown on the key page and the **Team ID** from the top
   right of the portal.

### 2. Firebase console — Apple provider

**Authentication → Sign-in method → Add new provider → Apple → Enable**, then:

- Services ID: `com.belaturniri.web`
- Apple Team ID: the Team ID from step 1.3
- Key ID: the Key ID from step 1.3
- Private key: paste the contents of the `.p8`

Save. Without this the web popup and, on a fresh project, the native flow both
fail with `auth/operation-not-allowed`.

### 3. Native Google

Google sign-in needs the platform config files that are **not** in the repo:

- **iOS**: Firebase console → Project settings → iOS app (`com.belaturniri.app`)
  → download **`GoogleService-Info.plist`** → put it at
  `frontend/ios/App/App/GoogleService-Info.plist` and add it to the `App`
  target in Xcode. Open it, copy the **`REVERSED_CLIENT_ID`** value
  (`com.googleusercontent.apps.<digits>-<hash>`) and replace the placeholder
  `com.googleusercontent.apps.REPLACE_WITH_REVERSED_CLIENT_ID` inside
  `CFBundleURLTypes` in `frontend/ios/App/App/Info.plist`. Without the scheme
  the Google sheet has no way back into the app. (Sign in with Apple needs no
  URL scheme — it runs in-process through AuthenticationServices.)
- **Android**: Firebase console → Android app (`com.belaturniri.app`) →
  download **`google-services.json`** → `frontend/android/app/google-services.json`.
  Then add the signing certificate **SHA-1** of *both* keystores to that
  Firebase Android app (Project settings → Your apps → Add fingerprint) —
  Google sign-in silently returns "developer error" (status 10) otherwise:
  ```bash
  # debug keystore (the one gradlew assembleDebug uses)
  keytool -list -v -alias androiddebugkey -keystore ~/.android/debug.keystore \
      -storepass android -keypass android | grep SHA1
  # release keystore
  keytool -list -v -alias <release-alias> -keystore <release.jks> | grep SHA1
  ```
  Re-download `google-services.json` after adding fingerprints.
- Firebase console → **Authentication → Sign-in method → Google → Enable**
  (this is what the web popup already uses, so it is probably on already).

### 4. After the console work

`frontend/capacitor.config.ts` lists the providers the native plugin builds a
handler for (`["apple.com", "google.com"]`) — that list is not cosmetic, the
plugin rejects with *"sign-in provider is not enabled"* for anything missing.
It only reaches the native projects through a sync, so run:

```bash
cd frontend && npm run build:native      # vite build + npx cap sync
```

Then rebuild the apps. Worth checking on a device: the Apple button appears
**first** on iOS (reviewers look for it), cancelling the sheet shows no error
at all, and signing in with Apple the very first time stores the name — Apple
releases it on the first authorisation only, so `AuthContext` copies it onto
the Firebase user and pushes it to `/user/me/sync` right there; a second
sign-in from a reinstalled app will never see it again.

## Account deletion, reports, retention

Three App Store compliance features, all backend-enforced. Nothing new to
configure — they work on a plain `./ops/deploy.sh` — but there are four
operational facts worth knowing.

### 1. Account deletion is anonymisation (`DELETE /api/user/me`)

The person disappears; the tournaments other people played in stay intact.
The `user_profiles` row and **its slug survive** with `deleted_at` stamped and
every personal field nulled, so old links 404 instead of the slug being
re-issued to the next person whose name normalises to it. Push subscriptions
and devices, the `game_names` row, `blok_sessions` and every `user_blocks`
edge are deleted; `pairs.contact_phone` is nulled while `submitted_by_uid`,
`co_submitted_by_uid` and `tournaments.created_by_uid` are kept. The full
per-table checklist lives in `AccountDeletionService`'s javadoc.

* A **second** `DELETE /api/user/me` is **204**, not 404 — the request means
  "make sure this account is gone", and it is.
* `POST /api/user/me/sync` for a deleted account answers **410
  `ACCOUNT_DELETED`** instead of lazily re-creating the profile. Without that,
  deletion would only mean "logged out until you sign in again".
* `GET /api/public/users/{slug}` for a deleted account is **404**; anywhere the
  name would be rendered (pair "Prijavio: …", partner chips, the block list)
  shows `profile.deletedUser` — "Obrisani korisnik" / "Izbrisan uporabnik".

**Without an FCM service account** (`FIREBASE_SERVICE_ACCOUNT_JSON` /
`FIREBASE_SERVICE_ACCOUNT_FILE` unset — see "Native push (FCM)" above) there is
no `FirebaseApp` in the process, so the **Firebase Auth user is not deleted
server-side**. The backend logs one WARN
(`no Firebase service account configured — Firebase Auth user … was NOT
deleted server-side`) and still returns 204; the local data is anonymised
either way and the frontend's own client-side `deleteUser()` is the second
path. If you see that WARN in production, configure the service account —
it is the same credential native push already needs.

### 2. Reports and blocks (Apple 1.2)

* `POST /api/reports` (signed in) — 201 `{"id": n}`. Unknown target 404,
  reporting your own content 400 `CANNOT_REPORT_SELF`, more than 10 per hour
  per user 429 `RATE_LIMITED`.
* Admin inbox, gated on the `role: "admin"` custom claim
  (`scripts/set-admin.mjs`):
  * `GET /api/admin/reports?status=open|resolved`
  * `GET /api/admin/reports/count?status=open` — the badge
  * `POST /api/admin/reports/{id}/resolve` with
    `{"resolution":"DISMISSED"|"ACTIONED","note":"…"}`
* Blocks: `PUT` / `DELETE /api/user/me/blocks/{uid}`, `GET /api/user/me/blocks`.
  A block hides the profile page **in both directions** (404) and drops that
  organiser's tournaments from `/api/tournaments` and `/api/tournaments/count`
  **for the signed-in blocker only**. A blocked user's **pairs are still
  listed** in a tournament — the organiser needs the full roster and the other
  players need the draw.
* Caching: `PublicReadCacheFilter` now skips any request carrying an
  `Authorization` header outright, so only the uniform anonymous listing is
  ever cacheable by the browser or by Caddy.

### 3. Contact-form retention (scheduler)

`ContactMessageRetentionJob` runs nightly at **04:00 server time**
(`@Scheduled(cron = "0 0 4 * * ?")`, `quarkus-scheduler`) and:

* nulls `contact_messages.ip` on rows older than **30 days**;
* deletes rows older than **12 months**.

**Those two numbers are quoted in the privacy policy** — change one and you
must change the other. The job is gated by the standard
`quarkus.scheduler.enabled` property; the `%test` profile sets it `false` so a
sweep cannot fire mid-test-suite. To disable it on a running box, set
`QUARKUS_SCHEDULER_ENABLED=false` in `.env` and `./ops/up.sh backend`. A log
line appears only when it actually changed something:
`Contact retention: N IP(s) cleared (>30d), M message(s) deleted (>12m).`

### 4. Migrations

Three changelogs, already included in `changelog-master.xml`:
`account_deletion.xml` (the `deleted_at` column + a partial index),
`content_reports.xml` (`content_reports`, `user_blocks`) and
`contact_message_retention.xml` (an index on `contact_messages.created_at`, so
the nightly sweep does not seq-scan). All guarded with
`preConditions onFail="MARK_RAN"` and carrying explicit `<rollback>` blocks.
