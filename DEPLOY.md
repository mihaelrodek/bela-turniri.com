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
