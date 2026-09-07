import { useEffect, useRef, useState } from "react"

/* ──────────────────────────────────────────────────────────────────────────
   useLiveSocket - realtime "something changed in this tournament" channel.

   The backend pushes a tiny frame whenever a spectator-visible write commits
   (score, round draw/finish, pair roster, tournament status, drinks bill).
   The frame carries NO data - only "refetch" - so the page keeps using the
   same REST calls (and the same careful merge logic) its poll already uses.
   Polling stays as the fallback: if the socket can't connect (old browser,
   a proxy stripping the upgrade), the page still updates, just slower.

   Public URL is /ws/live/{uuid}; Caddy in prod and the Vite dev proxy both
   rewrite that to the backend's /api/live/{uuid} (websockets-next registers
   under quarkus.http.root-path - see LiveSocket.java).

   One connection per tournament: a viewer of tournament A never receives -
   or learns about - traffic for tournament B, and no client-side filtering
   is needed.
   ────────────────────────────────────────────────────────────────────── */

/** A realtime "live data changed" push from the backend (see LiveSocket.java). */
type LiveUpdate = {
    type?: string
    tournamentUuid?: string
    scope?: string
}

/** 500 ms, 1 s, 2 s, 4 s, 8 s, then a 15 s ceiling. */
const RECONNECT_BASE_MS = 500
const RECONNECT_MAX_MS = 15_000

/**
 * ±30 % of randomness on every delay. Every viewer of a tournament loses the
 * socket at the same instant (a deploy, a proxy restart), and without jitter
 * they all come back at the same instant too — a thundering herd against a
 * backend that has just started.
 */
const RECONNECT_JITTER = 0.3

/**
 * A socket must stay open this long before the ladder resets. `onopen` fires
 * as soon as the handshake completes, which proves nothing: a backend
 * restarting, a proxy killing idle upgrades or a connection cap all produce
 * open-then-close cycles, and resetting there pinned the client at the
 * 500 ms floor forever.
 */
const STABLE_AFTER_MS = 10_000

export function useLiveSocket(
    tournamentUuid: string | undefined,
    onUpdate: (scope: string) => void,
): { connected: boolean } {
    const [connected, setConnected] = useState(false)

    // The callback lives in a ref so a new closure on every render (which is
    // what a page-level `useCallback` dependency change produces) does NOT
    // tear the socket down and reconnect.
    const cbRef = useRef(onUpdate)
    useEffect(() => {
        cbRef.current = onUpdate
    })

    useEffect(() => {
        if (!tournamentUuid) return
        if (typeof window === "undefined" || !("WebSocket" in window)) return

        let socket: WebSocket | null = null
        let disposed = false
        let attempt = 0
        let timer: ReturnType<typeof setTimeout> | null = null
        let stableTimer: ReturnType<typeof setTimeout> | null = null

        const url = () => {
            const proto = window.location.protocol === "https:" ? "wss:" : "ws:"
            return `${proto}//${window.location.host}/ws/live/${encodeURIComponent(tournamentUuid)}`
        }

        const clearTimer = () => {
            if (timer !== null) {
                clearTimeout(timer)
                timer = null
            }
        }

        const clearStableTimer = () => {
            if (stableTimer !== null) {
                clearTimeout(stableTimer)
                stableTimer = null
            }
        }

        const scheduleReconnect = () => {
            if (disposed) return
            clearTimer()
            // A hidden tab is not being read by anyone; retrying there just
            // burns battery and server sockets. The visibility listener below
            // reconnects the moment the tab comes back.
            if (document.hidden) return
            const base = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** Math.min(attempt, 5))
            const delay = Math.round(base * (1 + (Math.random() * 2 - 1) * RECONNECT_JITTER))
            attempt += 1
            timer = setTimeout(connect, delay)
        }

        function connect() {
            if (disposed) return
            clearTimer()
            try {
                socket = new WebSocket(url())
            } catch {
                scheduleReconnect()
                return
            }
            socket.onopen = () => {
                if (disposed) return
                // NOT `attempt = 0` here: an open that closes again a moment
                // later (backend restart, proxy idle-kill, connection cap)
                // would reset the ladder every cycle and the client would
                // hammer the 500 ms floor forever. The ladder resets only once
                // this socket has proven it survives.
                clearStableTimer()
                stableTimer = setTimeout(() => {
                    stableTimer = null
                    if (!disposed) attempt = 0
                }, STABLE_AFTER_MS)
                setConnected(true)
            }
            socket.onmessage = (ev) => {
                try {
                    const msg = JSON.parse(String(ev.data)) as LiveUpdate
                    if (msg.type !== "live-update") return
                    cbRef.current(msg.scope ?? "")
                } catch {
                    /* ignore malformed frames */
                }
            }
            socket.onclose = () => {
                if (disposed) return
                // The socket did not reach STABLE_AFTER_MS, so the ladder
                // keeps climbing instead of restarting at the floor.
                clearStableTimer()
                setConnected(false)
                scheduleReconnect()
            }
            socket.onerror = () => {
                // Let onclose drive the reconnect - a socket that errors always
                // closes, and handling both would double-schedule the retry.
                try {
                    socket?.close()
                } catch {
                    /* noop */
                }
            }
        }

        // Coming back to the tab: if the socket died while hidden, retry at
        // once rather than waiting out a backoff that never got scheduled.
        const onVisibility = () => {
            if (disposed || document.hidden) return
            if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return
            // Connect NOW (the user is looking at the page again) but leave
            // `attempt` alone: a tab that is hidden and shown while the
            // backend is down must not walk the ladder back to 500 ms.
            connect()
        }
        document.addEventListener("visibilitychange", onVisibility)

        connect()

        return () => {
            disposed = true
            clearTimer()
            clearStableTimer()
            document.removeEventListener("visibilitychange", onVisibility)
            setConnected(false)
            try {
                socket?.close()
            } catch {
                /* noop */
            }
        }
    }, [tournamentUuid])

    return { connected }
}
