/* ──────────────────────────────────────────────────────────────────────────
   @bela/server entry point. Reads the environment (see `config.ts`), starts
   the HTTP health endpoint and the `/ws/game` WebSocket server, and shuts
   down cleanly on SIGINT / SIGTERM.
   ────────────────────────────────────────────────────────────────────── */

import { createServer } from "./server.js"
import { log } from "./log.js"

const server = await createServer()

log.info("server.started", {
    port: server.port(),
    host: server.config.host,
    devAllowAnon: server.config.devAllowAnon,
    firebaseProjectId: server.config.firebaseProjectId,
    corsOrigins: server.config.corsOrigins,
})

if (!server.config.firebaseProjectId && !server.config.devAllowAnon) {
    log.warn("server.noAuth", {
        msg: "FIREBASE_PROJECT_ID nije postavljen i GAME_DEV_ALLOW_ANON je isključen — nitko se ne može prijaviti.",
    })
}

let shuttingDown = false
const shutdown = (signal: string): void => {
    if (shuttingDown) return
    shuttingDown = true
    log.info("server.stopping", { signal })
    void server.close().then(
        () => process.exit(0),
        (err: unknown) => {
            log.error("server.stop.failed", { err })
            process.exit(1)
        },
    )
}

process.on("SIGINT", () => shutdown("SIGINT"))
process.on("SIGTERM", () => shutdown("SIGTERM"))
process.on("uncaughtException", (err) => {
    log.error("uncaughtException", { err })
})
process.on("unhandledRejection", (err) => {
    log.error("unhandledRejection", { err })
})

export { createServer } from "./server.js"
export type { GameServer, ServerOptions } from "./server.js"
