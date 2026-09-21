/* ──────────────────────────────────────────────────────────────────────────
   The one function the server calls to switch the demo lobby on.

   Split from `types.ts` so the WIRING can be typed without knowing whether
   `director.ts` exists: `server.ts` imports this signature statically and the
   module itself through a dynamic `import()`, which keeps the whole `demo/`
   tree out of a server started without `GAME_DEMO_LOBBY` — and lets the
   director be written, or deleted before launch, without touching the server.
   ────────────────────────────────────────────────────────────────────── */

import type { DemoClock, DemoDirectorConfig, DemoLobbyApi } from "./types.js"

export interface DemoDirectorDeps {
    lobby: DemoLobbyApi
    config: DemoDirectorConfig
    clock: DemoClock
    rng: () => number
}

/** `stop()` must clear every timer the director owns; the server calls it on
 *  shutdown and expects the process to be able to exit afterwards. */
export interface DemoDirectorHandle {
    stop(): void
}

export type StartDemoDirector = (deps: DemoDirectorDeps) => DemoDirectorHandle
