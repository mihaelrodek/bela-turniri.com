import { Box, HStack, Text } from "@chakra-ui/react"
import { cardSuit } from "@bela/engine"
import type { Card, Seat, Suit, TrickCard } from "@bela/engine"
import { useTranslation } from "../../i18n"
import PlayingCard from "../components/PlayingCard"
import SuitGlyph from "../components/SuitGlyph"
import { HINT_GLOW, POP, POP_MS, RISE, SHAKE, SHAKE_MS } from "./motion"
import TrumpChip from "./TrumpChip"
import { useCardNames } from "./useCardNames"

/* ──────────────────────────────────────────────────────────────────────────
   MiniTable — a trick shown the way it lies on a table (2026-09-29).

   The first version of the tutorial drew a trick as four cards in a row
   captioned "prva, 2., 3., 4.". The owner's verdict: "how am I supposed to
   know which suit was led?" — a row of cards has no table, no players and no
   led suit. So every trick in the tutorial, shown or asked, is drawn here:

     • FOUR POSITIONS — you at the bottom, your partner opposite, an opponent
       on each side — each with its name, exactly where the real table puts
       them (seat 0 bottom, 1 right, 2 top, 3 left);
     • each card lies in front of whoever threw it, and carries its number in
       the order of play; the FIRST card is marked as such;
     • above the felt: the trump, and the led suit BY NAME ("Otvorena boja:
       herc");
     • a seat that has not played yet shows an empty place — with "?" when it
       is the learner's own, i.e. the card the task is about.

   The cards arrive one at a time in play order, then the winning card is
   ringed. With reduced motion everything is simply there.
   ────────────────────────────────────────────────────────────────────── */

const SEAT_LABEL: Record<Seat, string> = {
    0: "game.learn.seat.you",
    1: "game.learn.seat.right",
    2: "game.learn.seat.partner",
    3: "game.learn.seat.left",
}

/** Card box at `sm` (mađarice height — the French card is shorter and simply
 *  leaves a little air). */
const W = 56
const H = 90
const FELT_W = 296
const FELT_H = 268

/** Top-left corner of each seat's card on the felt. */
const PLACE: Record<Seat, { x: number; y: number }> = {
    2: { x: (FELT_W - W) / 2, y: 22 },
    0: { x: (FELT_W - W) / 2, y: FELT_H - H - 22 },
    3: { x: 26, y: (FELT_H - H) / 2 },
    1: { x: FELT_W - W - 26, y: (FELT_H - H) / 2 },
}

/** Where each seat's name goes, relative to the felt. */
const NAME: Record<Seat, { left?: number; right?: number; top?: number; bottom?: number; width: number; align: "center" }> = {
    2: { left: 0, top: 3, width: FELT_W, align: "center" },
    0: { left: 0, bottom: 3, width: FELT_W, align: "center" },
    3: { left: 0, top: (FELT_H + H) / 2 + 2, width: W + 52, align: "center" },
    1: { right: 0, top: (FELT_H + H) / 2 + 2, width: W + 52, align: "center" },
}

const STEP_MS = 420

export type TableMark = "right" | "wrong"

export default function MiniTable({
    trick,
    trump,
    winner = null,
    pending = null,
    marks,
    pulse = 0,
    animate = true,
    reducedMotion,
    onPick,
}: {
    /** In play order; `trick[0]` opened the trick. */
    trick: readonly TrickCard[]
    trump: Suit
    /** The seat whose card takes the trick — ringed once every card is down. */
    winner?: Seat | null
    /** A seat still to play, drawn as an empty place with "?". */
    pending?: Seat | null
    /** Right/wrong marks on cards the learner tapped. */
    marks?: Partial<Record<Card, TableMark>>
    pulse?: number
    /** Deal the cards in one by one. False for a table that is only context. */
    animate?: boolean
    reducedMotion: boolean
    /** Makes the cards tappable: "which card takes the trick?". */
    onPick?: (entry: TrickCard) => void
}) {
    const { t } = useTranslation()
    const { suitName, cardName } = useCardNames()
    const moving = animate && !reducedMotion
    const lead = trick[0] ? cardSuit(trick[0].card) : null
    const settled = trick.length * STEP_MS

    return (
        <Box>
            <HStack justify="center" gap="2" wrap="wrap" mb="2">
                <TrumpChip trump={trump} />
                {lead !== null && (
                    <HStack gap="1.5" px="2.5" py="1" rounded="full" bg="bg.subtle" borderWidth="1px" borderColor="border.emphasized">
                        <Text fontSize="xs" fontWeight="bold" textTransform="uppercase" letterSpacing="wide">
                            {t("game.learn.table.led")}
                        </Text>
                        <SuitGlyph suit={lead} size={18} />
                        <Text fontSize="sm" fontWeight="bold" textTransform="capitalize">{suitName(lead)}</Text>
                    </HStack>
                )}
            </HStack>

            <Box
                role="group"
                aria-label={t("game.learn.table.aria")}
                position="relative"
                mx="auto"
                rounded="l3"
                borderWidth="1px"
                borderColor="border.subtle"
                backgroundImage="radial-gradient(120% 90% at 50% 38%, var(--chakra-colors-felt), var(--chakra-colors-felt2))"
                style={{ width: FELT_W, maxWidth: "100%", height: FELT_H }}
            >
                {([0, 1, 2, 3] as Seat[]).map((seat) => (
                    <Text
                        key={seat}
                        position="absolute"
                        fontSize="2xs"
                        fontWeight="bold"
                        color={seat % 2 === 0 ? "brand.fg" : "tan"}
                        textTransform="uppercase"
                        letterSpacing="wide"
                        textAlign="center"
                        lineHeight="1.1"
                        style={NAME[seat]}
                    >
                        {t(SEAT_LABEL[seat])}
                    </Text>
                ))}

                {pending !== null && (
                    <Box
                        aria-hidden="true"
                        position="absolute"
                        rounded="md"
                        borderWidth="2px"
                        borderStyle="dashed"
                        borderColor="brand.emphasized"
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        color="brand.fg"
                        fontSize="2xl"
                        fontWeight="black"
                        style={{ left: PLACE[pending].x, top: PLACE[pending].y, width: W, height: H }}
                    >
                        ?
                    </Box>
                )}

                {trick.map((entry, index) => {
                    const mark = marks?.[entry.card] ?? null
                    const wins = winner === entry.seat
                    const first = index === 0
                    const feedback =
                        reducedMotion || mark === null
                            ? undefined
                            : mark === "right"
                              ? `${POP} ${POP_MS}ms ease-out`
                              : `${SHAKE} ${SHAKE_MS}ms ease-in-out`
                    return (
                        <Box
                            key={entry.card}
                            position="absolute"
                            zIndex={wins ? 3 : 2}
                            style={{ left: PLACE[entry.seat].x, top: PLACE[entry.seat].y }}
                            css={
                                moving
                                    ? { animation: `${RISE} 300ms ease-out backwards`, animationDelay: `${index * STEP_MS}ms` }
                                    : undefined
                            }
                        >
                            <Box key={`${mark ?? "idle"}-${pulse}`} css={{ animation: feedback }}>
                                <Box
                                    rounded="md"
                                    css={
                                        wins
                                            ? moving
                                                ? {
                                                      animation: `${HINT_GLOW} 1600ms ease-in-out infinite`,
                                                      animationDelay: `${settled + 200}ms`,
                                                  }
                                                : { boxShadow: "0 0 0 2px var(--chakra-colors-gold)" }
                                            : undefined
                                    }
                                >
                                    <PlayingCard
                                        card={entry.card}
                                        size="sm"
                                        actionHint={first ? t("game.learn.table.firstCard") : undefined}
                                        onSelect={onPick ? () => onPick(entry) : undefined}
                                    />
                                </Box>
                            </Box>
                            <Box
                                position="absolute"
                                top="-8px"
                                left="-8px"
                                minW="20px"
                                h="20px"
                                px={first ? "1.5" : "0"}
                                rounded="full"
                                display="flex"
                                alignItems="center"
                                justifyContent="center"
                                bg={first ? "brand.solid" : "bg.panel"}
                                color={first ? "brand.contrast" : "fg.muted"}
                                borderWidth="1px"
                                borderColor={first ? "brand.solid" : "border.emphasized"}
                                fontSize="10px"
                                fontWeight="bold"
                                lineHeight="1"
                                pointerEvents="none"
                                title={cardName(entry.card)}
                            >
                                {first ? t("game.learn.table.first") : index + 1}
                            </Box>
                            {mark !== null && (
                                <Box
                                    aria-hidden="true"
                                    position="absolute"
                                    top="-8px"
                                    right="-8px"
                                    boxSize="20px"
                                    rounded="full"
                                    bg={mark === "right" ? "ok" : "live"}
                                    borderWidth="2px"
                                    borderColor="bg.panel"
                                    pointerEvents="none"
                                />
                            )}
                        </Box>
                    )
                })}
            </Box>
        </Box>
    )
}
