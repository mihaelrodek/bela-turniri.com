import { Button, Flex, Text } from "@chakra-ui/react"
import type { PlayerView, Suit } from "@bela/protocol"
import { useTranslation } from "../../i18n"
import { SUITS, suitKey } from "../util/cards"
import SuitGlyph from "./SuitGlyph"
import { INK, INK_MUTED } from "./tableStyles"

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
   46 px still clears the 44 px tap-target floor. No outer glass box around
   the row either (2026-09-18, user request): each button already carries its
   own border, and a second border around the whole strip was just a frame
   around a frame.

   The buttons are a fixed width now, not `flex="1"` stretched edge to edge
   (2026-09-18, user request: "narrower and more compact") — five buttons
   spanning the full felt width read as a toolbar; centred and fixed-width
   they read as one small decision, which is what calling trump actually is.
   ────────────────────────────────────────────────────────────────────── */

/** Button height. Kept at the 44 px accessibility floor + 2, so the row can
 *  never be trimmed further without breaking a tap target. Exported so
 *  `GameRoomPage` can reserve this exact row height for the bottom slot even
 *  while nothing is bidding — otherwise the slot collapsing the instant a
 *  suit is called shrinks the column's fixed height, and the felt's
 *  `flex="1"` block grows to fill the gap, visibly shifting every seat
 *  (2026-09-18, user-reported jump on calling trump). */
export const ROW_H = "46px"

/** One width for all five buttons, so the row is symmetric around the middle
 *  one and that one sits exactly on the hand's centre line. */
const BTN_W = "58px"

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
    if (view.phase !== "BIDDING" || view.seat === null) return null

    const allowed = new Set<Suit>(legal?.suits ?? [])
    const canPass = legal?.canPass ?? true

    return (
        <Flex className="fold-control-strip" justify="center" gap="1" align="stretch">
            {SUITS.map((suit) => (
                <Button
                    key={suit}
                    w={BTN_W}
                    flexShrink={0}
                    h={ROW_H}
                    px="0"
                    variant="outline"
                    rounded="l2"
                    bg="bg.opaque"
                    color={INK}
                    borderColor="border"
                    _hover={{ bg: "bg.muted", borderColor: "brand.300" }}
                    _active={{ bg: "bg.muted" }}
                    disabled={busy || !myTurn || !allowed.has(suit)}
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
                    // Same width as a suit button: with a wider fifth button
                    // the row was centred but the SUITS were not — the
                    // middle one sat left of the hand's axis (2026-09-20).
                    w={BTN_W}
                    h={ROW_H}
                    px="0"
                    fontSize="sm"
                    flexShrink={0}
                    variant="outline"
                    rounded="l2"
                    bg="bg.opaque"
                    color={INK_MUTED}
                    borderColor="border"
                    _hover={{ bg: "bg.muted", color: INK }}
                    disabled={busy || !myTurn}
                    onClick={onPass}
                >
                    {t("game.bidding.pass")}
                </Button>
            ) : (
                <Flex
                    w={BTN_W}
                    h={ROW_H}
                    px="1"
                    flexShrink={0}
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
    )
}
