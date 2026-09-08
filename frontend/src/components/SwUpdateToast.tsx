import { useEffect, useRef } from "react"
import { toaster } from "../toaster"
import { useTranslation } from "../i18n"

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
   tab can't end up stuck on stale code without the user ever being told. */

export default function SwUpdateToast() {
    const { t } = useTranslation()
    const notifiedRef = useRef(false)

    useEffect(() => {
        if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return
        if (!import.meta.env.PROD) return

        function notifyUpdateReady() {
            if (notifiedRef.current) return
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
                    onClick: () => window.location.reload(),
                },
            })
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
        return () => window.removeEventListener("load", onLoad)
    }, [t])

    return null
}
