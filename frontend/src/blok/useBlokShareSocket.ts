import { useEffect, useRef, useState } from "react"

/* ──────────────────────────────────────────────────────────────────────────
   useBlokShareSocket — the VIEWER's half of BLOK-HISTORY.md §5.7.

   A sibling of `hooks/useLiveSocket.ts`, not a generalisation of it. The two
   channels agree on the frame (`{type: "live-update", scope}` — a ping with no
   data, so the page keeps reading through the REST call it already had) and on
   the reconnect discipline, and disagree on the one thing that matters here:
   what a closed socket MEANS.

   ── THE DIFFERENCE, AND WHY IT IS A SEPARATE FILE ─────────────────────────
   A tournament exists whether or not anyone is watching it, so
   `useLiveSocket` may reconnect forever. A share token can be REVOKED, and the
   backend then pings once and closes — after which every handshake to
   `/ws/live/blok/{token}` is refused with a 404. `useLiveSocket`'s ladder
   against that endpoint is an infinite loop of refused upgrades: worse than
   having no socket at all.

   So this one stops, twice over:

     1. The caller passes `undefined` the moment `GET /blok-share/{token}`
        answers 404 — the same trick `useTournamentData` uses to switch its
        socket off, and the authoritative signal, because only the REST call
        can tell a revoked token from a dead network. That is the normal path:
        the revoke ping arrives, the page refetches, the 404 comes back, the
        page shows "this link no longer works" and this hook is disposed.

     2. A ceiling on consecutive handshakes that never opened, for the window
        between the close and that 404 — and for the case where the page is
        left open on a laptop lid that shuts before the refetch lands. After
        `MAX_FAILED_ATTEMPTS` the hook simply stops and reports `connected:
        false`; the page's poll is still running and remains the thing that
        eventually learns the link is gone.

   Note what is deliberately NOT done: a failed handshake is never read as
   "revoked". The browser gives no status code for a rejected upgrade — a 404,
   a proxy stripping the upgrade and a train tunnel are indistinguishable here
   — and a page that showed "this link no longer works" because of a tunnel
   would be a worse bug than the one this file exists to prevent.

   Public URL is `/ws/live/blok/{token}`; Caddy in prod and the Vite dev proxy
   already forward all of `/ws/*` to the backend's `/api/*`, so this path needs
   no configuration of its own.
   ────────────────────────────────────────────────────────────────────── */

/** The frame, as the backend sends it: `{type: "live-update", scope: "blok"}`. */
type BlokLiveUpdate = {
    type?: string
    scope?: string
}

/** 500 ms, 1 s, 2 s, 4 s, 8 s, then a 15 s ceiling. */
const RECONNECT_BASE_MS = 500
const RECONNECT_MAX_MS = 15_000

/** ±30 % on every delay: every viewer of one record loses the socket at the
 *  same instant (a deploy, a proxy restart) and must not come back at it. */
const RECONNECT_JITTER = 0.3

/** A socket must stay open this long before the ladder resets — an
 *  open-then-close cycle proves nothing (see `useLiveSocket`). */
const STABLE_AFTER_MS = 10_000

/**
 * How many handshakes may fail in a row before this hook gives up.
 *
 * Six, which walks the ladder to its ceiling — roughly half a minute of
 * trying. A revoked token is refused instantly and forever, and half a minute
 * of that is the price of not mistaking a tunnel for a revoke. Reset by an
 * actual open, and by the viewer coming back to the tab: they are looking at
 * the page again, so it is worth one more ladder.
 */
const MAX_FAILED_ATTEMPTS = 6

export function useBlokShareSocket(
    /** The share token, or `undefined` to hold no socket at all — which is what
     *  the page passes before the record has loaded and after it 404s. */
    token: string | undefined,
    onUpdate: () => void,
): { connected: boolean } {
    const [connected, setConnected] = useState(false)

    // The callback lives in a ref so a new closure on every render does NOT
    // tear the socket down and reconnect.
    const cbRef = useRef(onUpdate)
    useEffect(() => {
        cbRef.current = onUpdate
    })

    useEffect(() => {
        if (!token) return
        if (typeof window === "undefined" || !("WebSocket" in window)) return

        let socket: WebSocket | null = null
        let disposed = false
        let attempt = 0
        /** Handshakes in a row that never reached `onopen`. */
        let failures = 0
        /** Set once `MAX_FAILED_ATTEMPTS` is hit: no more sockets from here. */
        let gaveUp = false
        /** Whether THIS connection ever opened — decides if a close counts. */
        let opened = false
        let timer: ReturnType<typeof setTimeout> | null = null
        let stableTimer: ReturnType<typeof setTimeout> | null = null

        const url = () => {
            const proto = window.location.protocol === "https:" ? "wss:" : "ws:"
            return `${proto}//${window.location.host}/ws/live/blok/${encodeURIComponent(token)}`
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
            if (disposed || gaveUp) return
            clearTimer()
            // A hidden tab is not being read by anyone; the visibility listener
            // below reconnects the moment it comes back.
            if (document.hidden) return
            const base = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** Math.min(attempt, 5))
            const delay = Math.round(base * (1 + (Math.random() * 2 - 1) * RECONNECT_JITTER))
            attempt += 1
            timer = setTimeout(connect, delay)
        }

        function connect() {
            if (disposed || gaveUp) return
            clearTimer()
            opened = false
            try {
                socket = new WebSocket(url())
            } catch {
                failures += 1
                if (failures >= MAX_FAILED_ATTEMPTS) gaveUp = true
                scheduleReconnect()
                return
            }
            socket.onopen = () => {
                if (disposed) return
                opened = true
                // The handshake was accepted, so the token is alive: the
                // give-up counter starts again from zero. The BACKOFF ladder
                // does not — an open that closes a moment later (backend
                // restart, proxy idle-kill) must not pin the client at 500 ms.
                failures = 0
                clearStableTimer()
                stableTimer = setTimeout(() => {
                    stableTimer = null
                    if (!disposed) attempt = 0
                }, STABLE_AFTER_MS)
                setConnected(true)
            }
            socket.onmessage = (ev) => {
                try {
                    const msg = JSON.parse(String(ev.data)) as BlokLiveUpdate
                    if (msg.type !== "live-update") return
                    // The frame carries nothing but "refetch" — deliberately,
                    // so the public GET stays the only reader of the record and
                    // the only judge of whether the token is still valid.
                    cbRef.current()
                } catch {
                    /* ignore malformed frames */
                }
            }
            socket.onclose = () => {
                if (disposed) return
                clearStableTimer()
                setConnected(false)
                // A close that follows an open is an ordinary drop — or the
                // revoke, whose ping we have just acted on and whose 404 is
                // already on its way to disable this hook. Only a handshake
                // that never opened counts towards giving up.
                if (!opened) {
                    failures += 1
                    if (failures >= MAX_FAILED_ATTEMPTS) gaveUp = true
                }
                scheduleReconnect()
            }
            socket.onerror = () => {
                // Let onclose drive the reconnect — a socket that errors always
                // closes, and handling both would double-schedule the retry.
                try {
                    socket?.close()
                } catch {
                    /* noop */
                }
            }
        }

        // Coming back to the tab: retry at once rather than waiting out a
        // backoff that was never scheduled, and allow one more ladder if we had
        // given up — the viewer is looking at the page again.
        const onVisibility = () => {
            if (disposed || document.hidden) return
            if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return
            if (gaveUp) {
                gaveUp = false
                failures = 0
            }
            // `attempt` is left alone: a tab hidden and shown while the backend
            // is down must not walk the backoff ladder back to 500 ms.
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
    }, [token])

    return { connected }
}
