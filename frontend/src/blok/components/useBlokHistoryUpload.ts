import { useEffect, useRef, useState } from "react"

import {
    buildSessionPayload,
    uploadBlokSession,
    type BlokHistoryRecord,
} from "../blokHistoryApi"
import { t } from "../../i18n"
import { showSuccess } from "../../toaster"
import { blokActions, gamesInSession } from "../store"

/* ──────────────────────────────────────────────────────────────────────────
   useBlokHistoryUpload — the network half of "Nova igra" (BLOK-HISTORY.md
   §2.2, §5.6: the menu item that CLOSES the series). Everything it does
   happens AFTER the close the player asked for has already taken effect on
   screen.

   THE ORDER OF EVENTS IS THE POINT — AGAIN
   ────────────────────────────────────────
   Same inversion as `useBlokLinkSync`, and for the same reason: nothing in
   the scorepad may wait on a request. `resetSession()` writes localStorage and
   the screen is empty in the same frame, in a bar with no signal exactly as
   with five bars. This hook then notices a series sitting in
   `pendingSessions`, sends it, and only on a 200 does the store actually
   delete the games. Closing never blocks, and a failed upload never costs a
   game. What it CAN cost is a game that was never finished: those are dropped
   at the close and never reach a payload (§5.6, `buildSessionPayload`).

   WHY IT KEEPS RATHER THAN DELETES
   ────────────────────────────────
   The deliberate trade, stated once so nobody "optimises" it later: a series
   sent TWICE is harmless — the server is idempotent on `sessionId` and
   answers with the record it already has — while a series deleted before it
   arrived is gone forever, off a device whose entire premise is that it has no
   backup and no account. So the local copy outlives every doubt: a timeout, a
   5xx, a captive portal, an answer we cannot parse. Only a 200 erases.

   SIGNED OUT MEANS NOT ONE REQUEST
   ────────────────────────────────
   `enabled` is false for a guest and this hook then does nothing at all — no
   timer, no listener, no fetch. A guest's close clears locally and says so
   once (the page's job), which is BLOK.md's "works without an account"
   promise kept literally: the blok's request count for a signed-out player
   stays at zero.

   NO RETRY LOOP
   ─────────────
   Every outcome writes to the store and every store write re-renders this
   hook, so "if it failed, try again" would spin. `attemptedRef` remembers the
   session id last attempted; the same one is not sent again until something
   real happens — the app coming back to the foreground, the network
   returning, the account signing in, or the page being opened again.

   A QUEUE, NOT A SLOT — AND IT IS STRICTLY IN ORDER
   ────────────────────────────────────────────────
   `pendingSessions` is a list because three evenings in a bar with no signal
   are three closed series, and it is drained from the FRONT (the oldest close
   first, which is the order they were played in). One at a time, always: two
   in parallel would race two read-modify-writes of the same localStorage key
   and one of the two deletions would be lost. Finishing one re-renders this
   hook with a shorter list, which starts the next — so the queue drains by
   itself, and each series is erased locally only by the 200 confirming ITS
   OWN upload, never by a neighbour's.

   AND A THIRD OUTCOME — see `isPermanentFailure` below. A 400 is the one
   answer that will be identical forever; treated as transient it would pin the
   head of the queue and every evening behind it.
   ────────────────────────────────────────────────────────────────────── */

/** Was that "not yet" or "not ever"?
 *
 *  Permanent is deliberately a SHORT allowlist rather than "any 4xx". The
 *  statuses here are the ones whose meaning cannot change by waiting: the
 *  record broke a documented limit (BLOK-HISTORY.md §3.3 → 400), it is too
 *  big for something in the path (413), or it was understood and refused
 *  (422). Everything else is a maybe and stays queued — a 401 is a token
 *  about to be refreshed (`api/http.ts` retries it once by itself), a 403 can
 *  be a proxy between the phone and the server, 408/429 say "later" in so many
 *  words, and 5xx is a deploy in progress. No response at all — offline, DNS,
 *  a captive portal answering with a login page — is the normal case and is
 *  never permanent. When in doubt the answer is "keep it": a series sent twice
 *  costs one request, a series dropped costs an evening.
 */
function isPermanentFailure(err: unknown): boolean {
    if (typeof err !== "object" || err === null) return false
    const response = (err as { response?: { status?: unknown } }).response
    const status = response?.status
    if (typeof status !== "number") return false
    return status === 400 || status === 413 || status === 422
}

/* ──────────────────────────────────────────────────────────────────────────
   THE SECOND WAY A SERIES REACHES THE PROFILE — §5.1
   ──────────────────────────────────────────────────
   The hook below is the RETRY path: it fires by itself, silently, for a series
   that "Nova igra" already closed. `saveSessionNow` is the opposite in every
   respect — the player asked for it, out loud, from the share button, and is
   waiting on the answer. So it awaits, it throws on
   failure (the caller says so, in a toast the player can act on), and it
   returns the record so the share flow knows which `uuid` to ask about.

   What it does NOT do is touch `pendingSessions` or delete anything. Nothing
   is being closed here: the series stays on the phone, keeps its `sessionId`,
   and the very next game lands in the same record. That is the whole of §5.1 —
   the server's POST is an upsert, so "save" and "save again with one more
   game" are the same call.
   ────────────────────────────────────────────────────────────────────── */

/**
 * Save the current series to the profile, right now, and return its record.
 *
 * `null` means there was nothing to send — a series with no FINISHED game in
 * it (§5.6), which is a perfectly ordinary state for a blok somebody just
 * opened or is playing the first game of. Rejects on a failed request; the
 * caller shows the error.
 */
export async function saveSessionNow(sessionId: string): Promise<BlokHistoryRecord | null> {
    const games = gamesInSession(blokActions.read(), sessionId)
    const payload = buildSessionPayload(sessionId, games)
    if (payload === null) return null

    const record = await uploadBlokSession(payload)
    if (record !== null) {
        // Remember the address, not the content: the record lives on the
        // profile from here on, and this is only what lets "Podijeli" and
        // "Prekini dijeljenje" find it again without a second round trip.
        //
        // The token is KEPT when the response does not carry one. An upsert
        // that echoes no `shareToken` means "this response says nothing about
        // sharing", not "the link is gone" — and the difference matters,
        // because §5.1 posts this series again after every new game while the
        // link stays live throughout. Only an explicit revoke clears a token.
        const held = blokActions.read().share
        const previous = held && held.sessionId === sessionId ? held.token : null
        blokActions.setShare({
            sessionId,
            uuid: record.uuid,
            token: record.shareToken ?? previous,
        })
    }
    return record
}

export function useBlokHistoryUpload({
    pendingSessions,
    enabled,
}: {
    /** Series closed by "Nova igra" whose upload is not confirmed. */
    pendingSessions: string[]
    /** False when nobody is signed in — then not one request leaves the device. */
    enabled: boolean
}): void {
    const attemptedRef = useRef<string | null>(null)
    // A counter rather than a boolean, so two triggers in a row both re-run.
    const [retryTick, setRetryTick] = useState(0)

    // One at a time: the queue is normally of length one, sending them in
    // parallel would race two writes to the same storage key, and completing
    // this one re-runs the effect for the next.
    const next = pendingSessions.length > 0 ? pendingSessions[0] : null

    /* ── retry triggers ────────────────────────────────────────────────
       A phone asleep in a pocket never fires `online`, and a tab that regained
       the network never fires `visibilitychange` — hence both. Wired only
       while something is outstanding, so an ordinary local blok adds no
       listeners at all. */
    useEffect(() => {
        if (!enabled || next === null) return
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
    }, [enabled, next])

    /* ── signing in IS a trigger ────────────────────────────────────────
       The queue can be full while `enabled` is false — a player who was
       signed in when the series closed, was signed out by an expired session,
       or simply plays first and signs in afterwards. `enabled` is already in
       the upload effect's dependencies, so the flip re-runs it; what would
       stop it is `attemptedRef` still holding this session id from an attempt
       that failed BEFORE the sign-out. Clearing it here is the difference
       between "signing in sends what is waiting" and "signing in sends what is
       waiting, unless it had been tried once".

       Declared ABOVE the upload effect on purpose: effects of one commit run
       in declaration order, so the ref is already clear when the upload effect
       reads it in that same commit. */
    const wasEnabled = useRef(enabled)
    useEffect(() => {
        if (enabled && !wasEnabled.current) {
            attemptedRef.current = null
            setRetryTick((n) => n + 1)
        }
        wasEnabled.current = enabled
    }, [enabled])

    /* ── the upload ────────────────────────────────────────────────────── */
    useEffect(() => {
        if (!enabled || next === null) return
        // Already tried this one and it failed. Wait for a real trigger rather
        // than hammering the server on every render.
        if (attemptedRef.current === next) return

        const games = gamesInSession(blokActions.read(), next)
        const payload = buildSessionPayload(next, games)
        if (payload === null) {
            // A marker with nothing behind it: every game of the series was
            // deleted by hand from the archive between the close and now.
            // There is nothing to send and nothing to keep — drop the marker
            // rather than retrying an empty record forever.
            blokActions.forgetPendingSession(next)
            return
        }

        let cancelled = false
        attemptedRef.current = next
        void uploadBlokSession(payload)
            .then(() => {
                if (cancelled) return
                attemptedRef.current = null
                // Only now: the server has it, so the local copy may go.
                blokActions.completeSessionUpload(next)
                // ONE toast for a drained queue, not one per series. Three
                // evenings uploaded on the walk back into signal is one piece
                // of news ("it is on your profile"), and three identical
                // toasts stacked behind each other would be the "toast per
                // attempt" this is meant not to be. The check reads the store
                // back rather than the render's `pendingSessions`, which is a
                // frame old and still contains the one just completed.
                if (blokActions.read().pendingSessions.length === 0) {
                    showSuccess(t("blok.newGame.saved"))
                }
            })
            .catch((err: unknown) => {
                if (cancelled) return
                if (isPermanentFailure(err)) {
                    // Not "not yet" — "not ever". Out of the queue so the
                    // evenings behind it can go up, games kept, and the page
                    // says so once (`blok.archive.rejected`). Retrying this
                    // forever and deleting it are both worse; see
                    // `store.ts → rejectSessionUpload`.
                    attemptedRef.current = null
                    blokActions.rejectSessionUpload(next)
                    return
                }
                // Transient by assumption — offline, 5xx, a captive portal, an
                // expired token about to be refreshed. Nothing is deleted, no
                // toast is raised, and the marker stays for the next trigger.
                // Treating a failure as fatal here would be the one mistake
                // that loses an evening of play.
            })

        return () => {
            cancelled = true
        }
    }, [enabled, next, retryTick])
}
