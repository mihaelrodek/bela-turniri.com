import { useSyncExternalStore } from "react"

/* ──────────────────────────────────────────────────────────────────────────
   useGameStats — the nav "Igraj" live-room count pull (owner, 2026-09-22).

   `GET /game-stats.json` is Caddy's public, unauthenticated proxy onto the
   game server's `GET /stats` (game/packages/server/src/server.ts, backed by
   `Lobby.stats()`) — no websocket, plain fetch, same-origin. It answers
   `{ rooms, playing, waiting, players, humans }`; only the first four are
   used here (`humans` is a strict "real accounts only" count the backend
   keeps for a possible future switch — see the Caddyfile/server comments).

   ONE POLLER FOR THE WHOLE APP. NavBar's desktop pill and MobileTabBar's
   centre button (and, on the games domains, GamesSwitch) all want this
   number, but nothing here should run two independent 30s intervals. So the
   fetch loop, the last-known value and the visibility gating live at MODULE
   scope — a tiny store — and every component subscribes to it through
   `useSyncExternalStore`. The first subscriber starts the interval, the
   last one to unmount stops it.

   Polls every 30s while `document.visibilityState === "visible"`, and once
   more the instant the tab regains visibility (mirrors `usePolling.ts`'s
   rationale, but that hook is per-component and would double-poll here).
   Never throws: a network error or a malformed body just keeps the last
   known value (or `null`, if there never was one) — the nav must never crash
   or flash to a scary state over a flaky poll. Nothing is persisted; a
   reload starts from `null` again, same as `useGameEnabled`.
   ────────────────────────────────────────────────────────────────────── */

export interface GameStats {
    rooms: number
    playing: number
    waiting: number
    players: number
}

const POLL_MS = 30_000

let stats: GameStats | null = null
const listeners = new Set<() => void>()
let intervalId: ReturnType<typeof setInterval> | null = null
let visibilityBound = false

function notify(): void {
    for (const listener of listeners) listener()
}

function isGameStats(data: unknown): data is GameStats {
    if (typeof data !== "object" || data === null) return false
    const d = data as Record<string, unknown>
    return (
        typeof d.rooms === "number" &&
        typeof d.playing === "number" &&
        typeof d.waiting === "number" &&
        typeof d.players === "number"
    )
}

async function fetchStats(): Promise<void> {
    try {
        const res = await fetch("/game-stats.json", { cache: "no-store" })
        if (!res.ok) return
        const data: unknown = await res.json()
        if (!isGameStats(data)) return
        stats = data
        notify()
    } catch {
        // Offline / DNS hiccup / whatever — keep the last known value.
    }
}

function onTick(): void {
    if (document.visibilityState === "visible") void fetchStats()
}

function onVisibilityChange(): void {
    if (document.visibilityState === "visible") void fetchStats()
}

function startPolling(): void {
    if (intervalId !== null) return
    if (document.visibilityState === "visible") void fetchStats()
    intervalId = setInterval(onTick, POLL_MS)
    if (!visibilityBound) {
        visibilityBound = true
        document.addEventListener("visibilitychange", onVisibilityChange)
    }
}

function stopPolling(): void {
    if (intervalId !== null) {
        clearInterval(intervalId)
        intervalId = null
    }
}

let subscriberCount = 0

function subscribe(listener: () => void): () => void {
    listeners.add(listener)
    subscriberCount++
    startPolling()
    return () => {
        listeners.delete(listener)
        subscriberCount--
        if (subscriberCount <= 0) stopPolling()
    }
}

/** Stable no-op subscribe used while the game feature is disabled/unresolved
 *  — `useSyncExternalStore` needs a stable function identity, so this is a
 *  module-level constant rather than an inline arrow (an inline one would
 *  resubscribe, and warn, on every render). */
function noopSubscribe(): () => void {
    return () => {}
}

function getSnapshot(): GameStats | null {
    return stats
}

function getServerSnapshot(): GameStats | null {
    return null
}

/**
 * Live room count for the nav "Igraj" pull.
 *
 * `enabled` should be the resolved value of `useGameEnabled()`. While it is
 * `false` or `null` (feature off, or the kill switch hasn't resolved yet)
 * this touches no timer and no network at all, and returns `null`. Once
 * `enabled` is `true`, it joins the shared poller and returns the last known
 * snapshot (`null` until the first successful fetch).
 */
export function useGameStats(enabled: boolean | null): GameStats | null {
    const value = useSyncExternalStore(enabled ? subscribe : noopSubscribe, getSnapshot, getServerSnapshot)
    return enabled ? value : null
}
