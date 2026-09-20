import { useEffect, useRef } from "react"
import { toaster } from "../toaster"
import { useTranslation } from "../i18n"
import { isNative } from "../platform"

/* ──────────────────────────────────────────────────────────────────────────
   Service-worker registration + "new version available" UX.

   `public/sw.js` calls `self.skipWaiting()` unconditionally from its
   `install` handler and `clients.claim()` unconditionally from `activate` —
   a freshly deployed worker takes over every open tab right away instead of
   sitting in "waiting" until every tab closes (the alternative,
   `SKIP_WAITING`-postMessage pattern). That's deliberate: bela ships small,
   frequent deploys, and an organiser mid-tournament with a tab that never
   closes shouldn't be stuck for hours on a build from before a bug fix.

   The cost of that choice is exactly what this component covers: the
   already-loaded REACT CODE in an open tab keeps running in memory even
   after a new worker has taken over fetches underneath it — nothing forces
   that tab to pick up the new JS. Left alone, that's a stale tab silently
   running the previous version indefinitely, possibly for days.

   `registration.installing`'s `statechange` reaching "installed" WHILE
   `navigator.serviceWorker.controller` is already set is the signal that
   this is an UPDATE, not the page's first-ever SW install on this device —
   a first install has no controller yet (nothing to update FROM), and a
   "new version" toast on someone's very first visit would just be noise.
   On that signal we show a toast that never auto-dismisses (`duration:
   Infinity`) with a "Reload" action — not an automatic reload, which would
   discard whatever the user is mid-typing, but persistent enough that the
   tab can't end up stuck on stale code without the user ever being told.

   ── 2026-09-20: investigated "the toast keeps reappearing after Osvježi" ──
   Read `install`/`activate`/`message` in public/sw.js end to end and fetched
   `/sw.js` from production twice back to back (SHA-256 compared, byte-for-
   byte identical) while reading `navigator.serviceWorker.getRegistration()`:
   `active` was "activated", `waiting`/`installing` both null, a controller
   was present. That is the clean, fully-settled state — no stuck installing
   worker, no drifting bytes from Caddy (`@nostore` sends `Cache-Control:
   no-cache`, which forces revalidation rather than serving something stale;
   confirmed via two `cache: "no-store"` fetches). `install`'s only fallible
   step (`cache.addAll(SHELL)`) is already inside a try/catch that swallows
   the rejection before `self.skipWaiting()` runs, so a bad shell entry can't
   loop the install either. In short: nothing in this file's logic or in
   sw.js reproduces the loop on demand, and the one thing that reliably WOULD
   — a genuinely new deploy landing again shortly after the user reloaded —
   matches this repo's own "small, frequent deploys" cadence and the several
   `fix game` commits shipped back to back around when this was reported.
   Unable to reproduce on an iOS device (simulators are off-limits here), so
   a WebKit-specific SW-lifecycle quirk in standalone/home-screen mode can't
   be ruled out either. Given that, this file no longer tries to pin the
   exact trigger and instead makes the *symptom* impossible to hit twice in
   a row: `recentlyReloadedForUpdate()` below suppresses any update signal
   that fires within `RELOAD_GUARD_MS` of the user's own reload click, and
   the toast is deferred entirely while a live game table is on screen (see
   `deferUntilOffTable`). */

/** `/igra/soba/<code>` — an in-progress hand. Forcing a reload here (or even
 *  just interrupting the player with a persistent toast) fights the table:
 *  the update can wait until the player navigates away on their own. */
const LIVE_TABLE_ROUTE = /^\/igra\/soba\//

function isLiveTableRoute(): boolean {
    return LIVE_TABLE_ROUTE.test(window.location.pathname)
}

/** How often to re-check the route while an update is ready but the player
 *  is at a live table. Coarse on purpose — this only ever runs during that
 *  narrow, rare window, not for the component's whole lifetime. */
const LIVE_TABLE_POLL_MS = 3000

/** sessionStorage key + window for the reload-loop guard. sessionStorage
 *  (not a ref) is what makes this survive the reload it's guarding against —
 *  `window.location.reload()` throws away every in-memory ref and remounts
 *  this component from scratch, so only storage that predates the reload can
 *  answer "did *I* just cause this". */
const RELOAD_FLAG_KEY = "bela:swUpdateReloadedAt"
const RELOAD_GUARD_MS = 60_000

function markReloadedForUpdate() {
    try {
        sessionStorage.setItem(RELOAD_FLAG_KEY, String(Date.now()))
    } catch {
        /* private mode / storage blocked — the guard just won't apply */
    }
}

function recentlyReloadedForUpdate(): boolean {
    try {
        const raw = sessionStorage.getItem(RELOAD_FLAG_KEY)
        if (!raw) return false
        const at = Number(raw)
        return Number.isFinite(at) && Date.now() - at < RELOAD_GUARD_MS
    } catch {
        return false
    }
}

export default function SwUpdateToast() {
    const { t } = useTranslation()
    const notifiedRef = useRef(false)

    useEffect(() => {
        // Native shells load `dist/` straight from the app bundle — there is
        // no deploy pushing a new sw.js underneath a running instance, an app
        // update instead installs a whole new bundle via the store, so this
        // whole "new version available" flow doesn't apply.
        if (isNative) return
        if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return
        if (!import.meta.env.PROD) return

        // Bounded to the rare case where an update becomes ready while the
        // player is mid-hand — started only from `notifyUpdateReady` below,
        // stopped the moment the route clears or the component unmounts.
        let deferTimer: ReturnType<typeof setInterval> | null = null
        function stopDeferring() {
            if (deferTimer !== null) {
                clearInterval(deferTimer)
                deferTimer = null
            }
        }
        function deferUntilOffTable() {
            if (deferTimer !== null) return
            deferTimer = setInterval(() => {
                if (!isLiveTableRoute()) {
                    stopDeferring()
                    showUpdateToast()
                }
            }, LIVE_TABLE_POLL_MS)
        }

        function showUpdateToast() {
            notifiedRef.current = true
            toaster.create({
                id: "sw-update-available",
                type: "info",
                title: t("common.swUpdate.title"),
                description: t("common.swUpdate.description"),
                duration: Infinity,
                closable: true,
                action: {
                    label: t("common.swUpdate.reload"),
                    onClick: () => {
                        markReloadedForUpdate()
                        window.location.reload()
                    },
                },
            })
        }

        function notifyUpdateReady() {
            if (notifiedRef.current) return
            // A signal that fires just after the user's own reload click is
            // either this same deploy re-announcing itself or a WebKit SW-
            // lifecycle quirk (see the file header) — either way, showing
            // the toast again a few seconds after "Osvježi" reads as a loop.
            if (recentlyReloadedForUpdate()) return
            if (isLiveTableRoute()) {
                deferUntilOffTable()
                return
            }
            showUpdateToast()
        }

        function wireRegistration(registration: ServiceWorkerRegistration) {
            // A worker may already be sitting installed/waiting from before this
            // component mounted (it finished installing while the tab was
            // backgrounded) — catch that case in addition to the live event below.
            if (registration.waiting && navigator.serviceWorker.controller) {
                notifyUpdateReady()
            }
            registration.addEventListener("updatefound", () => {
                const installing = registration.installing
                if (!installing) return
                installing.addEventListener("statechange", () => {
                    if (installing.state === "installed" && navigator.serviceWorker.controller) {
                        notifyUpdateReady()
                    }
                })
            })
        }

        /* ── keeping the offline precache on the CURRENT build ──────────────
           `public/sw.js` precaches the app shell and the /blok route chunk from
           `/precache-manifest.json` (written at build time by vite.config.ts's
           `bela-precache-manifest` plugin), so an installed PWA opened with no
           signal still reaches the scorepad. The worker cannot notice a deploy
           on its own: its own bytes never change, so `install` — the only event
           that would otherwise re-read the manifest — runs once per device, ever.

           So the page asks. One postMessage per load, answered by a ~300-byte
           manifest fetch, and the worker adds only what it does not already
           hold; offline it fails silently and keeps the last good precache.
           `ready` rather than `controller` because a first-ever install has no
           controller yet — `ready` resolves once a worker is active, which is
           exactly when there is someone to ask. */
        function askForPrecache() {
            navigator.serviceWorker.ready
                .then((registration) => {
                    registration.active?.postMessage({ type: "bela:precache" })
                })
                .catch(() => {
                    /* no worker ever became active — nothing to refresh */
                })
        }

        function onLoad() {
            askForPrecache()
            navigator.serviceWorker.register("/sw.js").then(wireRegistration).catch((err) => {
                // Non-fatal — the app still works; only the install prompt and
                // offline shell (and this update toast) are unavailable.
                console.warn("[sw] registration failed:", err)
            })
        }

        window.addEventListener("load", onLoad)
        return () => {
            window.removeEventListener("load", onLoad)
            stopDeferring()
        }
    }, [t])

    return null
}
