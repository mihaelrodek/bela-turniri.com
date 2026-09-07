import { useCallback, useEffect, useState } from "react"
import { redeemWaiterCode } from "../api/waiterAccess"

/* ──────────────────────────────────────────────────────────────────────────
   useWaiterSession — "does this device hold a waiter token for tournament X".

   The token is what the venue staff carry instead of an account. It is
   tournament-scoped, so it is stored under a per-tournament key rather than
   in one blob: a waiter who works two tournaments in a week holds two
   independent sessions, and clearing one must not touch the other.

   WHY A MODULE-LEVEL STORE AND NOT PLAIN useState
   ───────────────────────────────────────────────
   Three components read this for the same tournament at once — the page
   (to decide whether the Računi nav item exists at all), the section, and
   the code gate that creates the session. When the gate redeems a code, all
   three have to learn about it in the same commit, or the gate would stay
   on screen until something else happened to re-render the page. So writes
   go through `writeSession`, which updates the cache and notifies every live
   hook instance; each one re-reads and re-renders. Same shape as the
   offline queue's store, minus the drain.

   Every localStorage touch is wrapped: private mode, "block all cookies"
   and a full quota all throw. When storage is unavailable the in-memory
   cache alone carries the session — degraded (a reload loses it, and the
   waiter re-types four letters) but never broken.
   ────────────────────────────────────────────────────────────────────── */

const KEY_PREFIX = "bela:waiter:"

/** Persisted shape. `canEditCjenik` rides along with the token itself
 *  (rather than being re-derived later) because there is nowhere else to
 *  ask for it: a waiter has no account the cjenik tab could otherwise look
 *  the permission up against. */
type StoredSession = { token: string; canEditCjenik: boolean }

/**
 * Last known session per tournament uuid. Also the whole store when
 * localStorage throws, and what makes `getSession` cheap enough to call
 * from every render of every subscriber.
 */
const cache = new Map<string, StoredSession | null>()

const listeners = new Set<() => void>()

function storageKey(tournamentUuid: string): string {
    return `${KEY_PREFIX}${tournamentUuid}`
}

function readStored(tournamentUuid: string): StoredSession | null {
    try {
        const raw = window.localStorage.getItem(storageKey(tournamentUuid))
        if (!raw) return null
        const parsed: unknown = JSON.parse(raw)
        if (typeof parsed !== "object" || parsed === null) return null
        const token = (parsed as StoredSession).token
        if (typeof token !== "string" || token === "") return null
        return { token, canEditCjenik: (parsed as StoredSession).canEditCjenik === true }
    } catch {
        // Unparseable, or storage unavailable — treat as "no session" and
        // let the caller show the code gate.
        return null
    }
}

/** Cached read; the disk is consulted once per tournament per page load. */
function getSession(tournamentUuid: string | null | undefined): StoredSession | null {
    if (!tournamentUuid) return null
    const cached = cache.get(tournamentUuid)
    if (cached !== undefined) return cached
    const fromDisk = readStored(tournamentUuid)
    cache.set(tournamentUuid, fromDisk)
    return fromDisk
}

/** Write (or clear, with `null`) and wake every subscriber. */
function writeSession(tournamentUuid: string, session: StoredSession | null) {
    cache.set(tournamentUuid, session)
    try {
        if (session === null) window.localStorage.removeItem(storageKey(tournamentUuid))
        else window.localStorage.setItem(storageKey(tournamentUuid), JSON.stringify(session))
    } catch {
        /* storage unavailable — the in-memory cache is all we get */
    }
    listeners.forEach((l) => l())
}

export type WaiterSession = {
    /** The opaque token, or null when this device has no session here. */
    token: string | null
    hasSession: boolean
    /** "Gazda konobara" — this session can also replace the cjenik. False when there is no session. */
    canEditCjenik: boolean
    /**
     * Trade a code for a token and store it. Re-throws on failure so the
     * caller can render the backend's message inline next to the field —
     * the API call is `silent`, so nothing else will surface it.
     */
    redeem: (code: string) => Promise<void>
    /** Forget the session on this device. */
    clear: () => void
}

/**
 * @param tournamentUuid the tournament the session belongs to. Undefined
 *        while the page is still loading; the hook then reports no session
 *        and `redeem` refuses, rather than writing under a key of "undefined".
 */
export function useWaiterSession(tournamentUuid: string | null | undefined): WaiterSession {
    const [session, setSession] = useState<StoredSession | null>(() => getSession(tournamentUuid))

    useEffect(() => {
        // Re-read on mount and whenever the tournament changes: the value
        // captured by useState's initialiser belongs to the first uuid this
        // instance ever saw.
        setSession(getSession(tournamentUuid))
        const onChange = () => setSession(getSession(tournamentUuid))
        listeners.add(onChange)
        return () => {
            listeners.delete(onChange)
        }
    }, [tournamentUuid])

    const redeem = useCallback(async (code: string) => {
        if (!tournamentUuid) throw new Error("No tournament")
        const result = await redeemWaiterCode(tournamentUuid, code.trim())
        // Keyed by the uuid this hook was asked about, which is also what
        // every reader on the page passes — the response's own
        // `tournamentUuid` is the same tournament resolved server-side.
        writeSession(tournamentUuid, { token: result.token, canEditCjenik: result.canEditCjenik })
    }, [tournamentUuid])

    const clear = useCallback(() => {
        if (!tournamentUuid) return
        writeSession(tournamentUuid, null)
    }, [tournamentUuid])

    return {
        token: session?.token ?? null,
        hasSession: session !== null,
        canEditCjenik: session?.canEditCjenik ?? false,
        redeem,
        clear,
    }
}
