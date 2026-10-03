import { useCallback } from "react"
import type { BidHint, PlayHint } from "@bela/bots"
import { usePlural, useTranslation, type TKey, type TParams } from "../../i18n"
import { useCardNames } from "./useCardNames"

/* ──────────────────────────────────────────────────────────────────────────
   The coach's sentences (2026-09-29).

   `@bela/bots` (`tutor.ts`) returns a suggestion and a REASON CATEGORY that
   it derived from checkable facts. This file only turns the category into
   the one line shown on screen — it adds no reasoning of its own, so what
   the coach says can never be more than what `describePlay` / `hintForBid`
   actually established.
   ────────────────────────────────────────────────────────────────────── */

type Translate = (key: TKey, params?: TParams) => string

/** One line for a suggested card, e.g. "Uzmi štih". */
export function playAdvice(t: Translate, hint: PlayHint): string {
    return t(`game.learn.play.${hint.reason}`)
}

/**
 * One line for a suggested bid: "Zovi herc: u toj boji držiš dva najjača
 * aduta (dečko i devetka). Te boje imaš 3 karte." — the verdict, the fact it
 * rests on, and how many cards of the suit are held.
 */
export function useBidAdvice(): (hint: BidHint) => string {
    const { t } = useTranslation()
    const plural = usePlural()
    const { suitName, rankParams } = useCardNames()
    return useCallback(
        (hint: BidHint) => {
            if (hint.choice === "PASS") return t(`game.learn.bidWhy.${hint.reason}`, rankParams)
            const why = t(`game.learn.bidWhy.${hint.reason}`, { ...rankParams, suit: suitName(hint.choice) })
            const parts = [why]
            // The reason "length" already IS the count.
            if (hint.reason !== "length") parts.push(plural("game.learn.bidWhy.count", hint.count))
            if (hint.forced) parts.unshift(t("game.learn.bidWhy.forced"))
            return parts.join(" ")
        },
        [t, plural, suitName, rankParams],
    )
}
