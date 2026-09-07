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
   ────────────────────────────────────────────────────────────────────── */

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
        <Box {...GLASS} rounded="l3" px="2" py="2">
            <Flex gap="1.5" align="stretch">
                {SUITS.map((suit) => (
                    <Button
                        key={suit}
                        flex="1"
                        h="60px"
                        minW="56px"
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
                            <SuitGlyph suit={suit} size={26} />
                            <Text fontSize="10px" fontWeight="semibold" textTransform="capitalize" lineHeight="1">
                                {t(suitKey(suit))}
                            </Text>
                        </Flex>
                    </Button>
                ))}

                {canPass ? (
                    <Button
                        h="60px"
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
                        h="60px"
                        px="3"
                        align="center"
                        justify="center"
                        rounded="l2"
                        borderWidth="1px"
                        borderStyle="dashed"
                        borderColor="orange.400"
                    >
                        <Text fontSize="11px" fontWeight="bold" color="orange.300" textAlign="center" maxW="72px">
                            {t("game.bidding.mustCall")}
                        </Text>
                    </Flex>
                )}
            </Flex>
        </Box>
    )
}
