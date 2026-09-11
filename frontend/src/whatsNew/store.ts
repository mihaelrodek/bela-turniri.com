import { useSyncExternalStore } from "react"
import { LATEST_VERSION } from "./latestVersion"

/* ──────────────────────────────────────────────────────────────────────────
   Module-level store for the "Novosti" dialog's open/closed state and the
   "have I seen the newest release" flag.

   Same hand-rolled pattern as `src/i18n/index.ts`: a plain module-level
   variable plus `useSyncExternalStore`, so any component can read it
   reactively without a Context provider, and non-component code (none here
   today, but `open()`/`close()` are plain functions) can drive it too.

   `hasUnseen()` compares against `LATEST_VERSION`, NOT the full `RELEASES`
   array from `./releases` — see `latestVersion.ts` for why: that file pulls
   in both locales' full release prose, and this store is imported by the
   eager `WhatsNewFab`, so importing it here would defeat lazy-loading the
   dialog.
   ────────────────────────────────────────────────────────────────────── */

const STORAGE_KEY = "bela:whatsnew:seen"

let isOpen = false
const listeners = new Set<() => void>()

function emit() {
    for (const l of listeners) l()
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
}

function getOpenSnapshot(): boolean {
    return isOpen
}

export function useIsWhatsNewOpen(): boolean {
    return useSyncExternalStore(subscribe, getOpenSnapshot)
}

export function open() {
    isOpen = true
    emit()
}

export function close() {
    isOpen = false
    emit()
    markSeen()
}

/** Last version tag the visitor has opened the dialog for (or dismissed it
 *  with), read straight from storage — no need for it to be reactive on its
 *  own, `hasUnseen()` is what components subscribe to. */
function readSeen(): string | null {
    try {
        return window.localStorage.getItem(STORAGE_KEY)
    } catch {
        // Private mode / storage blocked: treat as "seen" everywhere below,
        // never nag someone whose browser can't remember the choice anyway.
        return LATEST_VERSION
    }
}

function writeSeen(version: string) {
    try {
        window.localStorage.setItem(STORAGE_KEY, version)
    } catch {
        // Non-fatal — readSeen()'s catch already treats unavailable storage
        // as permanently "seen", so there is nothing to recover here.
    }
}

/** True when the newest release is newer than whatever version this device
 *  last saw. Not itself a hook — `useHasUnseenWhatsNew()` below is, and
 *  re-renders on `markSeen()`/`open()`/`close()` the same way `isOpen` does,
 *  since seeing the newest release always happens through this module. */
export function hasUnseen(): boolean {
    return readSeen() !== LATEST_VERSION
}

export function markSeen() {
    if (readSeen() === LATEST_VERSION) return
    writeSeen(LATEST_VERSION)
    emit()
}

/** Reactive wrapper around `hasUnseen()` for the FAB's badge dot — same
 *  subscribe/emit pair as `useIsWhatsNewOpen()`, since `markSeen()` (on
 *  close) and a future release both change what it returns. */
export function useHasUnseenWhatsNew(): boolean {
    return useSyncExternalStore(subscribe, hasUnseen)
}
