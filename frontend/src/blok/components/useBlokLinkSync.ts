import { useEffect, useRef, useState } from "react"

import {
    asBlokLinkStatus,
    blokLinkErrorCode,
    blokLinkErrorStatus,
    fetchBlokLinkStatus,
    fetchMyBlokLinks,
    linkWriteToken,
    pushBlokScore,
    type BlokLinkDto,
} from "../blokLinkApi"
import { saveSessionNow } from "./useBlokHistoryUpload"
import { t } from "../../i18n"
import { showError } from "../../toaster"
import { blokActions } from "../store"
import type { BlokLink, BlokSide } from "../types"

/* ──────────────────────────────────────────────────────────────────────────
   useBlokLinkSync — everything BLOK-LINK.md §3.3 and §6 say about sending, and
   nothing else. Two effects, both of which do literally nothing until this
   scorepad has been linked to a table AND the organiser has approved it.

   WHAT TRAVELS: GAMES, NOT POINTS (§6.1)
   ──────────────────────────────────────
   A tournament match is scored 2:0 or 2:1 — how many games each side won —
   and that is what the organiser's record holds. The point totals (543 : 149)
   are the logbook's own business: they reach the organiser through the public
   logbook (§6.2), never as the match result. So the trigger for a push is the
   SERIES score moving, which happens when a game ends, not when a deal is
   written. Whole minutes pass between two pushes now where the old points
   version sent one per deal.

   THE ORDER OF EVENTS IS THE POINT
   ────────────────────────────────
   A deal is saved to localStorage by `store.ts` and the screen updates. Only
   THEN does this hook notice the series score moved and schedule a PUT.
   Nothing in the entry path awaits anything here, nothing here can block a
   save, and a push that fails leaves the deals exactly where they were. That
   inversion is the whole reason the blok stays usable in a bar with no signal,
   and it is why the push lives in an effect over the derived score rather than
   inside `addRound`.

   THE RECORD COMES FIRST — WHEN THERE IS AN ACCOUNT TO KEEP IT ON (§6.2, §7.2)
   ────────────────────────────────────────────────────────────────────────────
   Linking is consent for the logbook to be public: the organiser's bracket
   shows a link to `/blok/z/{token}`, and the server issues that token when it
   writes a score for an approved link — which it can only do if the series
   exists on the profile. So each push saves the series first, through the same
   idempotent upsert "Spremi" uses. A failed save does NOT hold the score back:
   the result reaching the organiser matters more than the logbook being
   current, and the next push saves again.

   Since §7 that half is conditional. Linking no longer needs an account, and a
   logbook has nowhere to live without one — records hang off a profile. So a
   signed-out link skips the save entirely and pushes only the score, which is
   exactly the deal §7.2 states: the organiser gets the result either way, the
   public record is what signing in adds.

   WHAT PROVES THE PUSH IS OURS (§7.1)
   ───────────────────────────────────
   With an account, the bearer token — unchanged. Without one, the `writeToken`
   the server returned once when the link was created, which is why it is kept
   on the link and sent as a header with every push and every status read.

   WHY A FAILED PUSH IS NOT A TOAST
   ────────────────────────────────
   `blok/blokLinkApi.ts` sends the score with `silent: true`, so the interceptor
   never toasts it. One flaky minute of Wi-Fi would otherwise stack a red box
   over a live game. The failure becomes `pendingSince` on the link, the header
   strip says so quietly, and the next change — or the app coming back to the
   foreground — retries. The ONE thing that does speak up is the 409 that kills
   the link, because after it nothing will ever be sent again and the player has
   to know their score has stopped arriving.

   NO RETRY LOOP
   ─────────────
   Every outcome writes to the store, and every store write re-renders this
   hook, so a naive "if it failed, try again" would spin. `attemptedRef`
   remembers the exact payload last attempted; an identical one is not sent
   again until something real changes — a new series score, the app being
   foregrounded, or the network coming back.
   ────────────────────────────────────────────────────────────────────── */

/**
 * How long the series score has to hold still before it is sent.
 *
 * NOT the old 1.5 s debounce over point totals, and not for the same reason:
 * nobody types games in a burst. What this absorbs is a score that is briefly
 * wrong in transit — the deal that ends a game is saved, and a correction to it
 * a second later takes the win back — plus the ordinary case of two store
 * writes in the same gesture. Short enough that the organiser sees a finished
 * game as it happens.
 */
const SETTLE_MS = 700

/**
 * How often a PENDING request asks whether the organiser has decided.
 *
 * Only while PENDING, only while the tab is visible, and never at all for a
 * blok with no link — a scorepad that was never linked makes no requests, per
 * §3.1. Once APPROVED the polling stops: the score pushes themselves are the
 * heartbeat, and a link the organiser later breaks surfaces as the 409 that
 * ends it. The decision also arrives as a push notification (§2.4); this is
 * what makes the header strip agree with it without a reload.
 */
const POLL_MS = 20_000

/**
 * The three 409 codes that mean "this link is over" (§3.3). Everything else —
 * a 5xx, a timeout, a captive portal, no answer at all — is transient and
 * stays queued behind `pendingSince`.
 */
const FATAL_CODE_MESSAGE: Record<string, string> = {
    ROUND_COMPLETED: "blok.link.ended.roundCompleted",
    TOURNAMENT_FINISHED: "blok.link.ended.tournamentFinished",
    LINK_NOT_APPROVED: "blok.link.ended.notApproved",
}

/** Display fields worth refreshing from the server when it sends them. */
function displayPatch(dto: BlokLinkDto): Partial<BlokLink> {
    const patch: Partial<BlokLink> = {}
    if (typeof dto.tournamentName === "string" && dto.tournamentName !== "") {
        patch.tournamentName = dto.tournamentName
    }
    if (typeof dto.roundNumber === "number" && Number.isFinite(dto.roundNumber)) {
        patch.roundNumber = dto.roundNumber
    }
    if (typeof dto.tableNo === "number" && Number.isFinite(dto.tableNo)) patch.tableNo = dto.tableNo
    if (typeof dto.usPairName === "string" && dto.usPairName !== "") patch.usPairName = dto.usPairName
    if (typeof dto.themPairName === "string" && dto.themPairName !== "") {
        patch.themPairName = dto.themPairName
    }
    return patch
}

/** The payload of one attempt, so an identical retry can be recognised. */
type Attempt = { uuid: string; us: number; them: number; final: boolean }

/**
 * Save the series, then send the score — the order §6.2 requires.
 *
 * The save is best-effort: its failure is swallowed, because the organiser
 * seeing 2:1 matters more than the public logbook being one game behind, and
 * the next push repeats both halves anyway. Only the push's own failure is
 * reported to the caller, which is what decides `pendingSince`.
 *
 * With no account the save is not attempted at all (§7.2): the upload endpoint
 * writes to a profile, and a guest has none. Trying anyway would spend a
 * guaranteed 401 before every single score push, on a phone that may be on bar
 * Wi-Fi, for a record that could not have been created either way.
 */
async function saveThenPush(
    uuid: string,
    writeToken: string | null,
    sessionId: string,
    body: { us: number; them: number; final: boolean },
    signedIn: boolean,
): Promise<void> {
    if (signedIn) {
        try {
            await saveSessionNow(sessionId)
        } catch {
            /* the logbook can catch up on the next push; the score cannot wait */
        }
    }
    await pushBlokScore(uuid, { ...body, sessionId }, writeToken)
}

/**
 * Send the final series score NOW, outside React — for "Resetiraj" (§6.1).
 *
 * The reset closes the series and drops the link in the same localStorage
 * write, so the effect below can never be the one to say "this is final": by
 * the time it re-runs there is no link left. The caller therefore fires this
 * first, with the values it is about to reset, and does not await it — a reset
 * stays instantaneous with no signal, exactly like every other local action.
 *
 * Skips silently when the same score has already gone out as final (the series
 * reached its target and the effect sent it), so closing a decided series does
 * not write the same result into the match twice.
 */
export function finalizeBlokLink(
    link: BlokLink | null,
    wins: Record<BlokSide, number>,
    sessionId: string,
    signedIn: boolean,
): void {
    if (link === null || link.status !== "APPROVED") return
    const synced = link.syncedGames
    if (link.syncedFinal && synced !== null && synced.us === wins.us && synced.them === wins.them) {
        return
    }
    const uuid = link.uuid
    void saveThenPush(
        uuid,
        linkWriteToken(link),
        sessionId,
        { us: wins.us, them: wins.them, final: true },
        signedIn,
    )
        .then(() => {
            // The link is normally gone by now (the reset dropped it) and
            // `patchLink` is a no-op then — which is the point of it being a
            // no-op. It still matters for the one caller that finalises WITHOUT
            // resetting, and it costs nothing here.
            const live = blokActions.read().current?.link
            if (live && live.uuid === uuid) {
                blokActions.patchLink({
                    syncedGames: { us: wins.us, them: wins.them },
                    syncedFinal: true,
                    pendingSince: null,
                })
            }
        })
        .catch(() => {
            /* The series is closed and the link with it: there is nothing left
               on screen to retry from and nothing to warn about. The organiser
               keeps whatever provisional score last arrived, which is the same
               2:1 the player is looking at. */
        })
}

export function useBlokLinkSync({
    link,
    seriesWins,
    seriesDecided,
    sessionId,
    signedIn,
}: {
    link: BlokLink | null
    /** Games WON per side in this series — what the match record holds (§6.1). */
    seriesWins: Record<BlokSide, number>
    /** The series has reached its target: the match result is final. */
    seriesDecided: boolean
    /** Which series is being played — the record the token hangs off (§6.2). */
    sessionId: string
    /**
     * Whether there is an account behind this blok.
     *
     * It is NO LONGER the switch that decides whether anything leaves the
     * device — a link can now be made and driven with no account at all (§7),
     * and what silences this hook is simply having no link, which is the
     * ordinary state of every scorepad on a kitchen table. What it still
     * decides is the two things an account is required for: saving the series
     * to the profile before each push (§6.2), and reading the link's status
     * through `/blok-links/mine` rather than through its write token.
     */
    signedIn: boolean
}): void {
    const attemptedRef = useRef<Attempt | null>(null)
    // Bumped by "try again now" moments (foreground, network back). A counter
    // rather than a boolean so two of them in a row both re-run the effect.
    const [retryTick, setRetryTick] = useState(0)

    const uuid = link?.uuid ?? null
    const status = link?.status ?? null
    const syncedUs = link?.syncedGames?.us ?? null
    const syncedThem = link?.syncedGames?.them ?? null
    const syncedFinal = link?.syncedFinal ?? false
    const pendingSince = link?.pendingSince ?? null
    // Null for a link made while signed in (the account is the credential) and
    // for anything stored before §7. Kept as a plain string so it can sit in a
    // dependency array next to the rest.
    const writeToken = link === null ? null : linkWriteToken(link)

    /* ── retry triggers ────────────────────────────────────────────────
       A phone asleep in a pocket never fires an `online` event, and a tab
       that regained the network never fires `visibilitychange` — hence both.
       Wired only while there is something outstanding, so an ordinary local
       blok adds no listeners at all. */
    useEffect(() => {
        if (uuid === null || status !== "APPROVED" || pendingSince === null) return
        const retry = () => {
            if (typeof document !== "undefined" && document.hidden) return
            // Forget the failed attempt so the send effect stops recognising
            // it as "already tried", then wake that effect.
            attemptedRef.current = null
            setRetryTick((n) => n + 1)
        }
        window.addEventListener("online", retry)
        document.addEventListener("visibilitychange", retry)
        return () => {
            window.removeEventListener("online", retry)
            document.removeEventListener("visibilitychange", retry)
        }
    }, [uuid, status, pendingSince])

    /* ── the push ──────────────────────────────────────────────────────── */
    useEffect(() => {
        if (uuid === null || status !== "APPROVED") return

        const alreadySent =
            syncedUs === seriesWins.us
            && syncedThem === seriesWins.them
            && syncedFinal === seriesDecided
        if (alreadySent) {
            // Nothing owed. This also covers the case where a failed push is
            // followed by an edit that puts the series score back exactly where
            // the server already has it — the outstanding flag has to clear, or
            // the strip would warn about a send that is no longer needed.
            if (pendingSince !== null) blokActions.patchLink({ pendingSince: null })
            attemptedRef.current = null
            return
        }

        const attempted = attemptedRef.current
        if (
            attempted !== null
            && attempted.uuid === uuid
            && attempted.us === seriesWins.us
            && attempted.them === seriesWins.them
            && attempted.final === seriesDecided
        ) {
            // Same payload, already tried, already failed. Wait for a real
            // trigger rather than hammering the server every render.
            return
        }

        // The decided series does not wait out the settle delay: there is no
        // further game to correct it with, and the organiser's round can be
        // closed the moment the last one ends. Still a timer rather than a
        // direct call, so a score change and the series being decided in the
        // same commit send exactly one request.
        const delay = seriesDecided ? 0 : SETTLE_MS
        let cancelled = false

        const timer = window.setTimeout(() => {
            const payload: Attempt = {
                uuid,
                us: seriesWins.us,
                them: seriesWins.them,
                final: seriesDecided,
            }
            attemptedRef.current = payload
            void saveThenPush(
                uuid,
                writeToken,
                sessionId,
                { us: payload.us, them: payload.them, final: payload.final },
                signedIn,
            )
                .then(() => {
                    if (cancelled) return
                    attemptedRef.current = null
                    blokActions.patchLink({
                        syncedGames: { us: payload.us, them: payload.them },
                        syncedFinal: payload.final,
                        pendingSince: null,
                    })
                })
                .catch((err: unknown) => {
                    if (cancelled) return
                    const code = blokLinkErrorCode(err)
                    const messageKey = code === null ? undefined : FATAL_CODE_MESSAGE[code]
                    if (blokLinkErrorStatus(err) === 409 && messageKey) {
                        // The link is over: the round closed, the tournament
                        // finished, or the approval was withdrawn. Kill it
                        // locally and say so ONCE — the status flip stops this
                        // effect from ever running again for this link, so
                        // there is no second toast to suppress.
                        attemptedRef.current = null
                        blokActions.patchLink({ status: "REVOKED", pendingSince: null })
                        showError(t(messageKey))
                        return
                    }
                    // Transient. Stamp the FIRST failure only — `pendingSince`
                    // is "how long has this been stuck", not "when did the
                    // last attempt fail" — reading the freshest value from the
                    // store rather than the closure, which is a render old.
                    const live = blokActions.read().current?.link
                    if (live && live.uuid === uuid && live.pendingSince === null) {
                        blokActions.patchLink({ pendingSince: Date.now() })
                    }
                })
        }, delay)

        return () => {
            cancelled = true
            window.clearTimeout(timer)
        }
    }, [
        uuid,
        writeToken,
        signedIn,
        status,
        syncedUs,
        syncedThem,
        syncedFinal,
        pendingSince,
        seriesWins.us,
        seriesWins.them,
        seriesDecided,
        sessionId,
        retryTick,
    ])

    /* ── waiting for the organiser's decision ───────────────────────────── */
    useEffect(() => {
        if (uuid === null || status !== "PENDING") return
        // Signed in, the question is "which of my links is this" and
        // `/blok-links/mine` answers it. Signed out there is no "mine", so the
        // question is asked about this one link and the write token answers for
        // us (§7.1). With neither — a link from before §7 whose token was never
        // issued, or one whose token this device has lost — there is nothing to
        // ask with, and asking anonymously would only earn a 401 every 20
        // seconds. The strip then stays on "waiting", which is true; the
        // organiser's decision still arrives as a push notification.
        if (!signedIn && writeToken === null) return
        let cancelled = false

        const check = () => {
            if (typeof document !== "undefined" && document.hidden) return
            const ask: Promise<BlokLinkDto | null> =
                signedIn || writeToken === null
                    ? fetchMyBlokLinks().then((mine) => mine.find((l) => l.uuid === uuid) ?? null)
                    : fetchBlokLinkStatus(uuid, writeToken)
            void ask
                .then((found) => {
                    if (cancelled) return
                    // Nothing came back: an older backend, a filtered response,
                    // anything. Leave the request showing as pending rather
                    // than inventing a verdict the organiser never gave.
                    if (!found) return
                    const patch = displayPatch(found)
                    // A status we do not recognise leaves the link PENDING —
                    // "approved" is never inferred from an unexpected value.
                    const status = asBlokLinkStatus(found.status)
                    if (status !== null && status !== "PENDING") patch.status = status
                    if (Object.keys(patch).length > 0) blokActions.patchLink(patch)
                })
                .catch(() => {
                    /* offline or a blip — the next tick asks again, silently */
                })
        }

        check()
        const interval = window.setInterval(check, POLL_MS)
        // Coming back to the tab is when the answer is most likely to have
        // arrived (the organiser approved while the phone was in a pocket).
        const onVisible = () => check()
        document.addEventListener("visibilitychange", onVisible)
        return () => {
            cancelled = true
            window.clearInterval(interval)
            document.removeEventListener("visibilitychange", onVisible)
        }
    }, [uuid, status, signedIn, writeToken])
}
