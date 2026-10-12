import { useEffect, useRef, useState } from "react"
import type { PlayerView } from "@bela/protocol"
import type { Team } from "@bela/engine"
import { useGamePrefs } from "./useGamePrefs"
import { usePrefersReducedMotion } from "./usePrefersReducedMotion"

/* ── The deal pouring into the total (2026-09-21, user request) ─────────────
   When a deal ends, the big deal number runs DOWN to zero while the small
   match total runs UP by the same amount, in step — the points visibly move
   from one line to the other instead of the total silently changing with the
   next deal.

   What pours is `dealScore.total[team]`, the figure the server actually wrote,
   NOT the card points on screen: on a "pad" the caller's side writes 0 and the
   other side takes everything, and a štiglja adds its bonus. So at the start
   of the pour the big number becomes that written figure (for an ordinary
   deal it is simply cards + declarations, which is why the separate "+20"
   chip is hidden while it runs — it is inside the number now).

   `progress` is null outside DEAL_DONE/GAME_OVER, 0..1 while pouring, 1 when
   done. A page opened or refreshed in the middle of DEAL_DONE never saw the
   deal end, so it starts at 1 — the settled state, no replay. Reduced motion
   keeps the old static picture (deal number + the total as it stood before
   the deal).

   GAME_OVER pours too (2026-09-29, user request): the deal that WINS the
   match settles in the same state update as any other — `applyPlay` sets
   `dealScore`/`score` identically for both phases and only `winner`/`phase`
   differ — but this pour used to run on `DEAL_DONE` only, so the last deal's
   points landed in the total with no animation at all, immediately below a
   deal-800 + trick-won-1550 dwell chain that was built to cover exactly this
   ~2.3 s. The one path where GAME_OVER carries no fresh `dealScore` for the
   deal in progress — a "dosta" race won mid-deal, before the trick that
   crossed the target is even scored (`finishByDosta`, game.ts) — is excluded
   by the `dealNo` check below, so a stale or absent score is never poured. */
const SETTLE_HOLD_MS = 700
// Slightly slower (2026-09-29, user request — "usporiti") than the original
// 1300 ms; kept under the ~2.3 s of dwell (CARD_PLAYED 800 + TRICK_WON 1550)
// the queue plays before GameOverDialog opens, so the pour finishes with the
// scoreboard still on screen instead of the dialog cutting it off.
const SETTLE_MS = 1550
const easeInOut = (x: number): number => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)

function useSettleProgress(settling: boolean, dealNo: number, reducedMotion: boolean): number | null {
    const [progress, setProgress] = useState<number | null>(settling ? 1 : null)
    const sawPlay = useRef(!settling)
    useEffect(() => {
        if (!settling) {
            sawPlay.current = true
            setProgress(null)
            return
        }
        if (reducedMotion) {
            setProgress(null)
            return
        }
        if (!sawPlay.current) {
            setProgress(1)
            return
        }
        sawPlay.current = false
        setProgress(0)
        let frame = 0
        let start: number | null = null
        const tick = (now: number) => {
            if (start === null) start = now
            const elapsed = now - start - SETTLE_HOLD_MS
            const x = Math.max(0, Math.min(1, elapsed / SETTLE_MS))
            setProgress(easeInOut(x))
            if (x < 1) frame = requestAnimationFrame(tick)
        }
        frame = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(frame)
    }, [settling, dealNo, reducedMotion])
    return progress
}

/** The numbers a score display should SHOW for `view`, with the deal pouring
 *  into the total at the end of a deal. Shared by the portrait `ScoreBoard`
 *  and the landscape table's `ScoreLine` (2026-10-12, owner: the landscape
 *  score jumped straight to the new total, with no pour). */
export function useSettledScore(view: PlayerView) {
    /* Between the last trick and "next deal" the server has ALREADY added the
       deal to `score`, while the big numbers still show that same deal — so
       the small running total read as if the deal would be added a second
       time (747, "127 +50", 924). Until the next deal starts, show the total
       as it stood BEFORE the deal; the recap dialog (DealSummary) carries the
       "Upisano" figure and the header switches to the new total with the
       next deal. GAME_OVER behaves the same way for the deal that ends the
       match — except the "dosta" mid-deal win, where `dealScore` is left
       over from an earlier deal (or null, on the very first one) because the
       deal in progress was never scored; the `dealNo` check keeps that stale
       figure from being poured onto the wrong total. */
    const settling =
        (view.phase === "DEAL_DONE" || view.phase === "GAME_OVER") && view.dealScore?.dealNo === view.dealNo
            ? view.dealScore
            : null
    const [prefs] = useGamePrefs()
    const reducedMotion = usePrefersReducedMotion() || prefs.reduceMotion
    const pour = useSettleProgress(settling !== null, view.dealNo, reducedMotion)
    /** Points of this deal already moved onto the total line. */
    const poured = (team: Team) =>
        settling && pour !== null ? Math.round(settling.total[team] * pour) : 0
    // Optional on PlayerView — the bots hand-assemble views without it — so
    // "no bonus known" reads as no bonus.
    const declarationPoints = view.declarationPoints ?? { A: 0, B: 0 }
    return {
        total: (team: Team) =>
            settling ? view.score[team] - settling.total[team] + poured(team) : view.score[team],
        deal: (team: Team) =>
            settling && pour !== null ? settling.total[team] - poured(team) : view.currentDealPoints[team],
        declarations: (team: Team) =>
            settling && pour !== null ? 0 : declarationPoints[team],
    }
}
