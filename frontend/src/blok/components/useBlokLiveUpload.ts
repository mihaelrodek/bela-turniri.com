import { useEffect, useMemo, useRef, useState } from "react"

import { buildSessionPayload } from "../blokHistoryApi"
import { saveSessionNow } from "./useBlokHistoryUpload"
import { gamesInSession } from "../store"
import type { BlokGame } from "../types"

/* ──────────────────────────────────────────────────────────────────────────
   useBlokLiveUpload — the OWNER's half of "zapisnik se osvježava u stvarnom
   vremenu" (BLOK-HISTORY.md §5.7).

   THE PROBLEM IT EXISTS FOR
   ─────────────────────────
   Everything else was already in place: the record is an idempotent upsert on
   `sessionId`, the share token survives it, and the public page can be told to
   refetch over a websocket. What was missing is that the record only MOVED
   twice — at "Nova igra" (§5.6) and, for a linked table, once a game (§6.1).
   A friend watching `/blok/z/{token}` would therefore have been watching a
   snapshot that changes about as often as the evening does, and the socket
   would have had almost nothing to announce. So while somebody could be
   reading, every change goes up.

   WHAT "EVERY CHANGE" MEANS, EXACTLY
   ──────────────────────────────────
   Not "every deal": the fingerprint below is the RECORD, `JSON.stringify` of
   the very payload that would be posted. A rename, a target change, a deleted
   deal, a game that just ended, the end-rule switch — all of them move it; a
   tap that changes nothing a viewer can see (opening the menu, a `setShare`
   write landing back from a previous upload) does not, and costs no request.
   That is also what makes this safe against its own success: the upload writes
   to the store, the store re-renders this hook, and a naive "state changed →
   send" would spin forever.

   IT NEVER DELAYS A DEAL — the same inversion `useBlokLinkSync` documents.
   `store.ts` has already written localStorage and painted the screen by the
   time this effect runs; nothing in the entry path awaits it, and a debounce
   of 1.5 s means the burst of writes one gesture produces (a deal saved, the
   game's `finishedAt` restamped) is one POST rather than three.

   NOT ONE REQUEST FROM A PRIVATE SCOREPAD
   ───────────────────────────────────────
   `enabled` is false unless somebody could actually be reading — a live share
   token, or an approved tournament table (§6.2, whose organiser reads the same
   record under the same token). A kitchen-table blok, a signed-out one, or a
   series merely SAVED but never shared stays exactly as silent as it was
   before this file existed: no timer, no listener, no fetch.

   FAILURE IS STATE, NOT A TOAST
   ─────────────────────────────
   Same discipline as the two hooks beside it (`uploadBlokSession` already
   passes `silent: true`, so the interceptor never speaks either). A failed
   upload means the viewer's page is one change behind for a while — nothing a
   player at the table can act on, and nothing worth a red box over a live
   game. `attemptedRef` stops it retrying the identical payload on every
   render; the next real change, the app being foregrounded, or the network
   coming back is what tries again.

   TWO TABS
   ────────
   Since §5.7 the other tabs of the same browser see every write (`store.ts`,
   the `storage` bridge), so two open scorepads will both notice a change and
   both send it. That is harmless by construction — the POST is an upsert on
   `sessionId` and answers with the same record — and worth far less than the
   machinery a cross-tab election would cost.
   ────────────────────────────────────────────────────────────────────── */

/**
 * How long the record has to hold still before it goes up.
 *
 * The figure §5.7 asks for. Long enough that typing a deal (which lands as a
 * couple of store writes) is one request, and that a mistake corrected
 * immediately never reaches a viewer at all; short enough that somebody
 * watching the link sees the deal while the cards are still being gathered.
 */
const SETTLE_MS = 1_500

export function useBlokLiveUpload({
    game,
    archive,
    enabled,
}: {
    /** The game in progress — its identity changes on every store write. */
    game: BlokGame
    /** The finished games; identity changes when one is filed or deleted. */
    archive: BlokGame[]
    /**
     * Could anybody be reading this series right now?
     *
     * The caller's job, because it is the caller that holds all three parts of
     * the answer: signed in (the endpoint writes to a profile), plus either a
     * live share token or an APPROVED table link. False is the normal state of
     * a scorepad and it means this hook does nothing at all.
     */
    enabled: boolean
}): void {
    /** The payload last known to be on the server, as sent. */
    const sentRef = useRef<string | null>(null)
    /** The payload last attempted and not confirmed — never retried blind. */
    const attemptedRef = useRef<string | null>(null)
    // A counter rather than a boolean, so two triggers in a row both re-run.
    const [retryTick, setRetryTick] = useState(0)

    const sessionId = game.sessionId

    /*
     * The record as it stands, or null when there is nothing filable yet — a
     * series whose only game is still being played (§5.6, `buildSessionPayload`
     * is the single place that decides it).
     *
     * Serialised rather than compared field by field because the string is the
     * honest question: "would this POST send anything the last one did not?".
     * The games are a handful of objects with a few dozen deals between them,
     * and this runs only while the series is actually being shared.
     */
    const payloadJson = useMemo(() => {
        if (!enabled) return null
        const payload = buildSessionPayload(
            sessionId,
            gamesInSession({ current: game, archive }, sessionId),
        )
        return payload === null ? null : JSON.stringify(payload)
    }, [enabled, sessionId, game, archive])

    /* ── retry triggers ────────────────────────────────────────────────
       A phone asleep in a pocket never fires `online`, and a tab that regained
       the network never fires `visibilitychange` — hence both. Wired only
       while the series is live, so an ordinary local blok adds no listeners.
       With nothing owed the effect below returns at its first comparison, so
       waking it costs nothing. */
    useEffect(() => {
        if (!enabled) return
        const retry = () => {
            if (typeof document !== "undefined" && document.hidden) return
            attemptedRef.current = null
            setRetryTick((n) => n + 1)
        }
        window.addEventListener("online", retry)
        document.addEventListener("visibilitychange", retry)
        return () => {
            window.removeEventListener("online", retry)
            document.removeEventListener("visibilitychange", retry)
        }
    }, [enabled])

    /* ── the upload ────────────────────────────────────────────────────── */
    useEffect(() => {
        if (!enabled || payloadJson === null) return
        // The server already has exactly this. Covers the ordinary case AND
        // the hook's own echo: every success writes `share` back to the store.
        if (payloadJson === sentRef.current) return
        // Tried, not confirmed. Wait for a real trigger rather than sending the
        // same bytes again on every render.
        if (payloadJson === attemptedRef.current) return

        let cancelled = false
        const timer = window.setTimeout(() => {
            attemptedRef.current = payloadJson
            // `saveSessionNow` rebuilds from the store rather than taking the
            // payload built above, which is deliberate: it is the one function
            // that also remembers the record's `uuid` and keeps the share token
            // (§5.1). Nothing can have changed in between — any change would
            // have re-run this effect and cleared the timer.
            void saveSessionNow(sessionId)
                .then(() => {
                    if (cancelled) return
                    sentRef.current = payloadJson
                    attemptedRef.current = null
                })
                .catch(() => {
                    /* Offline, a 5xx, a captive portal, a token about to be
                       refreshed. The viewer is one change behind until the next
                       one — which is not something the player can act on, so
                       nothing is said and nothing is lost: the series is still
                       on the phone and "Nova igra" still files it. */
                })
        }, SETTLE_MS)

        return () => {
            cancelled = true
            window.clearTimeout(timer)
        }
    }, [enabled, sessionId, payloadJson, retryTick])
}
