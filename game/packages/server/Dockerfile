# Multi-stage build for @bela/server (Node WebSocket game server)
# Matches the backend/edge pattern: builder stage runs deps + build, runtime
# stage copies only dist/ and runs the bundled index.js.

# --- Builder stage: npm ci + npm run build:server ---
FROM node:22-alpine AS builder
WORKDIR /app

# Copy the entire game/ context (pnpm workspace)
COPY . .

# Install dependencies and build the server bundle via esbuild
RUN npm ci && npm run build:server

# --- Runtime stage: node dist/index.js ---
FROM node:22-alpine

WORKDIR /app

# Non-root user (matches backend/edge security model)
RUN addgroup -S gameserver && adduser -S gameserver -G gameserver

# Copy only the bundled output from the builder
COPY --from=builder --chown=gameserver:gameserver /app/packages/server/dist /app/dist

USER gameserver

# Health check endpoint: GET /health on 8285 must respond 200
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=5s \
    CMD wget -qO- http://127.0.0.1:8285/health || exit 1

EXPOSE 8285

CMD ["node", "dist/index.js"]
