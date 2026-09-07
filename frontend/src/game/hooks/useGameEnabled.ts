import { useEffect, useState } from "react"

/* ──────────────────────────────────────────────────────────────────────────
   useGameEnabled — production kill switch for the online bela feature.

   Caddy serves `/game-status.json` from a host bind-mount (`ops/game-flag/`,
   see the Caddyfile and docker-compose.prod.yaml) the same way the
   maintenance page's flag works: `touch`/`rm ops/game-flag/ENABLED` on the
   server flips it instantly — no rebuild, no redeploy, no Caddy reload.

   A fresh box has no flag file, so `/game-status.json` answers
   `{"enabled":false}` — the feature stays hidden until deliberately turned
   on. Local dev has no Caddy in front of Vite, so there is nothing to fetch;
   `import.meta.env.DEV` short-circuits to enabled there. A network failure
   in production (Caddy down, JSON malformed) fails CLOSED — hide the
   feature rather than risk sending someone into a half-working game.
   ────────────────────────────────────────────────────────────────────── */

let cached: boolean | null = null
let inflight: Promise<boolean> | null = null

async function fetchEnabled(): Promise<boolean> {
    if (import.meta.env.DEV) return true
    try {
        const res = await fetch("/game-status.json", { cache: "no-store" })
        if (!res.ok) return false
        const data: unknown = await res.json()
        return typeof data === "object" && data !== null && (data as { enabled?: unknown }).enabled === true
    } catch {
        return false
    }
}

/** `null` while the flag is still loading, then the resolved boolean. */
export function useGameEnabled(): boolean | null {
    const [enabled, setEnabled] = useState(cached)

    useEffect(() => {
        if (cached !== null) return
        inflight ??= fetchEnabled().then((v) => {
            cached = v
            return v
        })
        let cancelled = false
        inflight.then((v) => {
            if (!cancelled) setEnabled(v)
        })
        return () => {
            cancelled = true
        }
    }, [])

    return enabled
}
