# syntax=docker/dockerfile:1.7
#
# "Edge" image — builds the Vite SPA and serves it via Caddy.
# Caddy also reverse-proxies /api/* to the backend container, terminates
# TLS via Let's Encrypt, and routes crawler User-Agents to the SSR preview
# endpoints. One container, one config file, no cross-volume gymnastics.
#
# Build context: the REPO ROOT (so we can COPY the Caddyfile that lives
# at the project root). docker-compose.prod.yaml takes care of this.
#
#   docker build -t bela-edge -f frontend/Dockerfile .
#
# Required build args (Vite inlines them at build time):
#   VITE_API_URL                — defaults to /api (same-origin via Caddy)
#   VITE_FIREBASE_API_KEY
#   VITE_FIREBASE_AUTH_DOMAIN
#   VITE_FIREBASE_PROJECT_ID
#   VITE_FIREBASE_APP_ID
#   VITE_GOOGLE_MAPS_API_KEY   — Places autocomplete; empty = Nominatim fallback
#   VITE_CARTO_API_KEY         — basemap key; empty = watermarked tiles
#   VITE_MAP_TILE_URL / VITE_MAP_TILE_ATTRIBUTION — alternative tile provider

# ─────────────────────────── Stage 1: build ───────────────────────────
FROM node:22-alpine AS build

WORKDIR /app

# Cache npm install — separate layer, only invalidates when package*.json change.
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci

# Copy the rest of the frontend source.
COPY frontend/ ./

# `@bela/engine` / `@bela/protocol` are resolved by vite.config.ts /
# tsconfig.app.json as a relative alias to the SIBLING `game/` workspace's
# source (`../game/packages/.../src/index.ts`, not a package published to
# npm — see game/README.md). WORKDIR here is /app, so that alias resolves
# to /game/... — this copy has to land at exactly that path or `npm run
# build` fails with "Cannot find module '@bela/engine'" (it did, the first
# time this shipped: the edge image never had `game/` in it at all).
COPY game/ /game/

# Vite reads VITE_* env vars at build time and inlines the values into
# the bundle. They're not secrets (Firebase web config is public per
# Firebase's docs), but they DO need to be set or auth will silently
# misconfigure itself.
ARG VITE_API_URL=/api
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_APP_ID
ARG VITE_GOOGLE_MAPS_API_KEY
ARG VITE_CARTO_API_KEY
ARG VITE_MAP_TILE_URL
ARG VITE_MAP_TILE_ATTRIBUTION
ENV VITE_API_URL=$VITE_API_URL \
    VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY \
    VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN \
    VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID \
    VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID \
    VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY \
    VITE_CARTO_API_KEY=$VITE_CARTO_API_KEY \
    VITE_MAP_TILE_URL=$VITE_MAP_TILE_URL \
    VITE_MAP_TILE_ATTRIBUTION=$VITE_MAP_TILE_ATTRIBUTION

RUN npm run build
# → /app/dist contains the static SPA bundle.

# ─────────────────── Stage 2: custom Caddy build ──────────────────────
# The stock Caddy image has no `rate_limit` directive. Build a Caddy binary
# that includes the caddy-ratelimit module (per-IP request throttling on the
# /api surface - see the Caddyfile) via xcaddy, then copy it into the runtime
# image below. Pinned module version keeps builds reproducible.
FROM caddy:2-builder-alpine AS caddy-build
# Pinned to an exact module version so two builds of the same commit produce
# the same binary. v0.1.0 is the module's latest tagged release; bump this line
# deliberately (and rebuild once) rather than letting the build float.
ARG CADDY_RATELIMIT_VERSION=v0.1.0
RUN xcaddy build \
    --with github.com/mholt/caddy-ratelimit@${CADDY_RATELIMIT_VERSION}

# ─────────────────────────── Stage 3: serve ───────────────────────────
FROM caddy:2-alpine

# Swap in the custom Caddy binary (stock binary → one with rate_limit).
COPY --from=caddy-build /usr/bin/caddy /usr/bin/caddy

# Caddyfile lives at the repo root (build context). It defines TLS,
# the /api proxy, rate limits, and the crawler routing for OG previews.
# Baked into the image so a deploy is just "rebuild + restart".
COPY Caddyfile /etc/caddy/Caddyfile

# Static SPA bundle.
COPY --from=build /app/dist /srv

EXPOSE 80 443
