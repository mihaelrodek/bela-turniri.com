import { Box, Button, Flex, Text } from "@chakra-ui/react"
import type { PlayerView, Suit } from "@bela/protocol"
import { useTranslation } from "../../i18n"
import { SUITS, suitKey } from "../util/cards"
import SuitGlyph from "./SuitGlyph"
import { GLASS, INK, INK_MUTED } from "./tableStyles"

/* ──────────────────────────────────────────────────────────────────────────
   BiddingPanel — four suits and "Dalje", shown ONLY when the decision is
   mine.

   There is no auction: the first player to name a suit sets trump (README
   §1.2), so this is a single decision and the panel disappears the moment it
   is made. While somebody else is deciding the panel renders nothing at all
   — the status pill above the hand says who, and their seat carries the
   chip. A dead panel with four greyed-out buttons is just noise you have to
   look past four times a deal.

   The dealer speaking fourth may NOT pass ("mus"): `legalBids.canPass` says
   so, and rather than disabling a button with no explanation the panel
   REPLACES it with the reason.

   The row is deliberately SHORT — 46 px buttons, one line of padding. It only
   exists for a few seconds a deal, and every pixel it takes is a pixel off
   the felt above it, which is the thing the player is actually looking at.
   46 px still clears the 44 px tap-target floor.
   ────────────────────────────────────────────────────────────────────── */

/** Button height. Kept at the 44 px accessibility floor + 2, so the row can
 *  never be trimmed further without breaking a tap target. */
const ROW_H = "46px"

export default function BiddingPanel({
    view,
    busy = false,
    onBid,
    onPass,
}: {
    view: PlayerView
    /** Animations still running, or the socket is down. */
    busy?: boolean
    onBid: (trump: Suit) => void
    onPass: () => void
}) {
    const { t } = useTranslation()
    const legal = view.legalBids
    const myTurn = legal !== null && view.seat !== null && view.turn === view.seat
    if (!myTurn) return null

    const allowed = new Set<Suit>(legal.suits)
    const canPass = legal.canPass

    return (
        <Box {...GLASS} rounded="l3" px="1.5" py="1.5">
            <Flex gap="1" align="stretch">
                {SUITS.map((suit) => (
                    <Button
                        key={suit}
                        flex="1"
                        h={ROW_H}
                        minW="52px"
                        px="0"
                        variant="outline"
                        rounded="l2"
                        bg="brand.900/70"
                        color={INK}
                        borderColor="brand.600"
                        _hover={{ bg: "brand.700", borderColor: "brand.300" }}
                        _active={{ bg: "brand.600" }}
                        disabled={busy || !allowed.has(suit)}
                        onClick={() => onBid(suit)}
                        aria-label={t("game.bidding.callSuit", { suit: t(suitKey(suit)) })}
                    >
                        <Flex direction="column" align="center" gap="0.5">
                            <SuitGlyph suit={suit} size={24} />
                            <Text fontSize="9px" fontWeight="semibold" textTransform="capitalize" lineHeight="1">
                                {t(suitKey(suit))}
                            </Text>
                        </Flex>
                    </Button>
                ))}

                {canPass ? (
                    <Button
                        h={ROW_H}
                        px="3"
                        variant="outline"
                        rounded="l2"
                        bg="brand.950/62"
                        color={INK_MUTED}
                        borderColor="brand.700"
                        _hover={{ bg: "brand.900", color: INK }}
                        disabled={busy}
                        onClick={onPass}
                    >
                        {t("game.bidding.pass")}
                    </Button>
                ) : (
                    <Flex
                        h={ROW_H}
                        px="2"
                        align="center"
                        justify="center"
                        rounded="l2"
                        borderWidth="1px"
                        borderStyle="dashed"
                        borderColor="orange.400"
                    >
                        <Text fontSize="10px" fontWeight="bold" color="orange.300" textAlign="center" maxW="64px" lineHeight="1.2">
                            {t("game.bidding.mustCall")}
                        </Text>
                    </Flex>
                )}
            </Flex>
        </Box>
    )
}
