import { useCallback, useMemo } from "react"
import { cardRank, cardSuit } from "@bela/engine"
import type { Card, Rank, Suit } from "@bela/engine"
import { useTranslation } from "../../i18n"
import { rankKey } from "../util/cards"

/**
 * Card and suit names as the TUTORIAL says them (2026-09-29, owner's ruling
 * after trying the first version).
 *
 * ONE vocabulary, whatever deck is on screen:
 *
 *   • a suit is taught under BOTH its names — "Herc ili srce", "Kara ili
 *     bundeva", "Pik ili zelje", "Tref ili žir" (`suitBoth`) — because the
 *     same suit is called either at a real table. Where there is room for
 *     one word only (a chip, a sentence) the first name is used (`suitName`);
 *   • a rank is the plain word: dečko, dama, kralj, as. Never the mađarice
 *     "dolnji" / "gornji" — nobody at a table says them.
 *
 * `rankParams` are the six named ranks as `t()` parameters (`{jack}`,
 * `{nine}` …). The sentences that use them keep the name in the nominative
 * — "držiš najjačeg aduta ({jack})" — because a parameter cannot be declined.
 */
export interface CardNames {
    cardName: (card: Card) => string
    rankName: (rank: Rank) => string
    /** The short, first name: "herc". */
    suitName: (suit: Suit) => string
    /** Both names, as the suits lesson teaches them: "Herc ili srce". */
    suitBoth: (suit: Suit) => string
    rankParams: Record<"jack" | "queen" | "king" | "ace" | "nine" | "ten", string>
}

export function useCardNames(): CardNames {
    const { t } = useTranslation()
    const rankName = useCallback((rank: Rank) => t(rankKey(rank)), [t])
    const suitName = useCallback((suit: Suit) => t(`game.learn.suitShort.${suit}`), [t])
    const suitBoth = useCallback((suit: Suit) => t(`game.learn.suitBoth.${suit}`), [t])
    const cardName = useCallback(
        (card: Card) => t("game.card.aria", { rank: rankName(cardRank(card)), suit: suitName(cardSuit(card)) }),
        [t, rankName, suitName],
    )
    const rankParams = useMemo(
        () => ({
            jack: rankName("J"),
            queen: rankName("Q"),
            king: rankName("K"),
            ace: rankName("A"),
            nine: rankName("9"),
            ten: rankName("10"),
        }),
        [rankName],
    )
    return { cardName, rankName, suitName, suitBoth, rankParams }
}
