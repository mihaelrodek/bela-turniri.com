/* ──────────────────────────────────────────────────────────────────────────
   HTTP + WebSocket server wiring.

   `createServer()` is what both `index.ts` and the tests use, so tests can
   bind an ephemeral port (`port: 0`) and shrink every timing to milliseconds
   instead of touching 8285.

   Public WS path is `/ws/game` (Caddy in prod, the Vite proxy in dev forward it
   unchanged); a bare `/` is accepted too so a plain `ws://host:8285` works.
   ────────────────────────────────────────────────────────────────────── */

import { createServer as createHttpServer } from "node:http"
import type { IncomingMessage, Server as HttpServer, ServerResponse } from "node:http"
import type { AddressInfo } from "node:net"
import type { Duplex } from "node:stream"
import { WebSocketServer } from "ws"
import { LIMITS } from "@bela/protocol"
import { createAuthenticator } from "./auth.js"
import { createProfileLookup } from "./profiles.js"
import type { ProfileLookup } from "./profiles.js"
import type { Authenticator } from "./auth.js"
import { loadConfig, resolveTimings } from "./config.js"
import type { Config, EnvLike, RateLimits, Timings } from "./config.js"
import { Lobby } from "./lobby.js"
import { log, setLogLevel } from "./log.js"
import { Hub } from "./ws.js"

/** Paths accepted for the websocket upgrade. */
const WS_PATHS: ReadonlySet<string> = new Set(["/ws/game", "/ws/game/", "/", ""])

/** Max frame size — the biggest legitimate client frame is a chat line. */
const MAX_PAYLOAD = 32 * 1024

export interface ServerOptions {
    /** Overrides `GAME_PORT`; use 0 for an ephemeral port. */
    port?: number
    host?: string
    /** Environment to read config from (defaults to `process.env`). */
    env?: EnvLike
    config?: Partial<Config>
    timings?: Partial<Timings>
    rateLimits?: Partial<RateLimits>
    /** Injectable for tests; defaults to the Firebase JWKS verifier. */
    authenticator?: Authenticator
    /** Injectable for tests; defaults to the backend-backed profile channel. */
    profiles?: ProfileLookup
}

export interface GameServer {
    readonly httpServer: HttpServer
    readonly wss: WebSocketServer
    readonly config: Config
    readonly timings: Timings
    readonly lobby: Lobby
    readonly hub: Hub
    port(): number
    url(): string
    roomCount(): number
    close(): Promise<void>
}

function resolveRates(overrides: Partial<RateLimits> = {}): RateLimits {
    return {
        messagesPerSecond: LIMITS.messagesPerSecond,
        chatPerSecond: LIMITS.chatPerSecond,
        ...overrides,
    }
}

function originAllowed(cfg: Config, origin: string | undefined): boolean {
    if (!cfg.corsOrigins || cfg.corsOrigins.length === 0) return true
    // Non-browser clients (and same-origin proxies) send no Origin at all.
    if (!origin) return true
    return cfg.corsOrigins.includes(origin)
}

function pathnameOf(url: string | undefined): string {
    if (!url) return "/"
    const q = url.indexOf("?")
    return q === -1 ? url : url.slice(0, q)
}

export async function createServer(options: ServerOptions = {}): Promise<GameServer> {
    const configOverrides: Partial<Config> = { ...options.config }
    if (options.port !== undefined) configOverrides.port = options.port
    if (options.host !== undefined) configOverrides.host = options.host

    const cfg = loadConfig(options.env ?? process.env, configOverrides)
    setLogLevel(cfg.logLevel)

    const timings = resolveTimings(options.timings)
    const rates = resolveRates(options.rateLimits)
    const lobby = new Lobby(timings)
    // One lookup for both directions: the authenticator reads profiles through
    // it on every hello, and the hub writes the in-game name through it — so a
    // write invalidates the very cache the next read consults.
    const profiles = options.profiles ?? createProfileLookup(cfg)
    const auth = options.authenticator ?? createAuthenticator(cfg, profiles)
    const hub = new Hub({ cfg, timings, rates, auth, lobby, profiles })

    const httpServer = createHttpServer((req: IncomingMessage, res: ServerResponse) => {
        const path = pathnameOf(req.url)
        if (req.method === "GET" && (path === "/health" || path === "/healthz")) {
            const body = JSON.stringify({ ok: true, rooms: lobby.size() })
            res.writeHead(200, {
                "content-type": "application/json; charset=utf-8",
                "cache-control": "no-store",
            })
            res.end(body)
            return
        }
        res.writeHead(404, { "content-type": "application/json; charset=utf-8" })
        res.end(JSON.stringify({ ok: false, error: "not_found" }))
    })

    const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_PAYLOAD })

    httpServer.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
        const path = pathnameOf(req.url)
        if (!WS_PATHS.has(path)) {
            socket.write("HTTP/1.1 404 Not Found\r\n\r\n")
            socket.destroy()
            return
        }
        const origin = req.headers.origin
        if (!originAllowed(cfg, typeof origin === "string" ? origin : undefined)) {
            log.warn("ws.origin.rejected", { origin })
            socket.write("HTTP/1.1 403 Forbidden\r\n\r\n")
            socket.destroy()
            return
        }
        wss.handleUpgrade(req, socket, head, (ws) => {
            hub.handleConnection(ws)
        })
    })

    await new Promise<void>((resolve, reject) => {
        const onError = (err: Error): void => {
            httpServer.off("listening", onListening)
            reject(err)
        }
        const onListening = (): void => {
            httpServer.off("error", onError)
            resolve()
        }
        httpServer.once("error", onError)
        httpServer.once("listening", onListening)
        httpServer.listen(cfg.port, cfg.host)
    })

    const port = (): number => {
        const addr = httpServer.address()
        if (addr && typeof addr === "object") return (addr as AddressInfo).port
        return cfg.port
    }

    let closed = false
    const close = async (): Promise<void> => {
        if (closed) return
        closed = true
        hub.close()
        lobby.dispose()
        await new Promise<void>((resolve) => {
            wss.close(() => resolve())
        })
        await new Promise<void>((resolve) => {
            httpServer.close(() => resolve())
        })
    }

    return {
        httpServer,
        wss,
        config: cfg,
        timings,
        lobby,
        hub,
        port,
        url: () => `ws://127.0.0.1:${port()}/ws/game`,
        roomCount: () => lobby.size(),
        close,
    }
}
