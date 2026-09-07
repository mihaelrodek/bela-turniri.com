import { Box, HStack, Text } from "@chakra-ui/react"
import { FiAward, FiCheckCircle } from "react-icons/fi"

import { useTranslation } from "../../../i18n"
import { type MatchLocal, winnerOf } from "../../../utils/tournamentMatch"
import type { PairShort } from "../../../types/pairs"
import { type FsSize, fsMetrics, fsScoreText } from "./fullscreenSize"

/* ---------- Fullscreen round board ----------------------------------------

   What this screen is FOR: a laptop or a TV standing in the corner of the
   venue, showing the round that is being played. Nobody reads it from 40 cm
   away — they read it from across a hall, looking for their own pair name and,
   once the round is running, for the score on that line.

   That rules the layout:
     • THE PAIR NAMES ARE THE CONTENT. They get the card's full width, wrap to
       two lines, and are never squeezed down to an ellipsis after two letters
       — which is exactly what the previous "table number owns a 40%-wide
       column, names get what's left" split did on a 15-table round.
     • The table number is a compact badge in the card's top-left corner. It is
       still the first thing the eye lands on (solid brand fill, tabular
       digits) but it costs one short row, not half the card.
     • Cards size to their CONTENT (`auto` rows, `alignContent: start`), so a
       three-table round is three short cards at the top of the board rather
       than three cards stretched to a third of the screen each with the names
       floating in the middle of an empty box.
     • The grid is `repeat(auto-fill, minmax(minCol, 1fr))`, so column count
       follows the actual screen: ~6 columns on a 1999px TV in "Manje",
       ~4 in "Veće", 1 on a phone — with no match-count arithmetic involved.
     • Scores render as soon as they exist (typed, queued or saved), because
       a round in progress is what the wall is showing most of the time.
     • A bye is the same card with a quiet blue badge in place of the table
       number.

   "Manje"/"Veće" is one scale factor (see `fsMetrics`) applied to every type
   size, padding and the column floor at once, so both modes stay fully
   readable — "Manje" fits more tables per screen, it does not make them
   unreadable. */

export default function FullscreenRoundBoard({
    matches,
    pairById,
    size,
}: {
    matches: MatchLocal[]
    pairById: Map<number, PairShort>
    size: FsSize
}) {
    const { t: tr } = useTranslation()

    const z = fsMetrics(size)

    /* Every size below is a plain px string built from `z`, so the two modes
       differ by exactly one multiplier and nothing else. */
    const nameSize = `${z.name}px`
    const scoreSize = `${z.score}px`
    const labelSize = `${z.label}px`
    const badgePadX = `${Math.round(z.padX * 0.6)}px`
    const badgePadY = `${Math.round(z.padY * 0.25)}px`

    const pairLine = (name: string, score: string, isWinner: boolean) => (
        <HStack gap={`${z.rowGap}px`} minW="0" align="center">
            {isWinner && (
                /* react-icons default to 1em, so the medal scales with the
                   name it belongs to without a second size formula. */
                <Box color="green.fg" flexShrink={0} fontSize={nameSize} display="flex" aria-hidden="true">
                    <FiAward />
                </Box>
            )}
            <Text
                flex="1"
                minW="0"
                fontSize={nameSize}
                fontWeight={isWinner ? "bold" : "medium"}
                color={isWinner ? "green.fg" : "fg.ink"}
                lineHeight="1.2"
                /* Two lines, then ellipsis: long pair names must READ, but a
                   card in a grid row can't be allowed to grow without a
                   ceiling either. `break-word` keeps a single very long token
                   inside the card instead of widening the column. */
                lineClamp={2}
                wordBreak="break-word"
            >
                {name}
            </Text>
            {score !== "" && (
                <Text
                    flexShrink={0}
                    /* A floor wide enough for one digit, so the two scores on
                       a card line up under each other. */
                    minW={`${Math.round(z.score * 0.7)}px`}
                    textAlign="right"
                    fontSize={scoreSize}
                    fontWeight="bold"
                    lineHeight="1"
                    fontVariantNumeric="tabular-nums"
                    color={isWinner ? "green.fg" : "fg.soft"}
                >
                    {score}
                </Text>
            )}
        </HStack>
    )

    return (
        <Box
            display="grid"
            /* `min(px, 100%)` rather than a bare px floor: on a 390px phone the
               "Veće" floor (435px) would otherwise overflow the viewport
               instead of collapsing to one full-width column. */
            gridTemplateColumns={`repeat(auto-fill, minmax(min(${z.minCol}px, 100%), 1fr))`}
            gridAutoRows="auto"
            alignContent="start"
            gap={`${z.gap}px`}
        >
            {matches.map((m) => {
                const a = m.pair1Name ?? (m.pair1Id ? pairById.get(m.pair1Id)?.name : undefined) ?? "—"
                const b = m.pair2Name ?? (m.pair2Id ? pairById.get(m.pair2Id)?.name : undefined) ?? "—"
                const isBye = !m.pair2Id
                const winner = m.status === "FINISHED" ? winnerOf(m) : null
                const aWon = winner != null && winner === m.pair1Id
                const bWon = winner != null && winner === m.pair2Id
                const scoreA = fsScoreText(m._score1, m.score1)
                const scoreB = fsScoreText(m._score2, m.score2)

                return (
                    <Box
                        key={m.id}
                        display="flex"
                        flexDirection="column"
                        gap={`${z.rowGap}px`}
                        minW="0"
                        rounded="l3"
                        borderWidth="1px"
                        borderColor={isBye ? "blue.muted" : "border.emphasized"}
                        bg="bg.panel"
                        shadow="card"
                        px={`${z.padX}px`}
                        py={`${z.padY}px`}
                    >
                        {/* The thing a player scans for, in one compact chip:
                            loud enough to find from across the hall, small
                            enough that it never costs the names their room. */}
                        <HStack
                            alignSelf="flex-start"
                            align="baseline"
                            gap={`${Math.round(z.rowGap * 0.75)}px`}
                            rounded="l2"
                            px={badgePadX}
                            py={badgePadY}
                            bg={isBye ? "blue.subtle" : "brand.solid"}
                            color={isBye ? "blue.fg" : "brand.contrast"}
                        >
                            {isBye ? (
                                <>
                                    <Box
                                        fontSize={labelSize}
                                        display="flex"
                                        alignSelf="center"
                                        aria-hidden="true"
                                    >
                                        <FiCheckCircle />
                                    </Box>
                                    <Text
                                        fontSize={labelSize}
                                        fontWeight="bold"
                                        letterSpacing="wider"
                                        textTransform="uppercase"
                                        lineHeight="1.2"
                                    >
                                        {tr("tournament.bracket.bye")}
                                    </Text>
                                </>
                            ) : (
                                <>
                                    <Text
                                        fontSize={labelSize}
                                        fontWeight="semibold"
                                        letterSpacing="wider"
                                        textTransform="uppercase"
                                        lineHeight="1.2"
                                        opacity={0.9}
                                    >
                                        {tr("tournament.tableLabel")}
                                    </Text>
                                    <Text
                                        fontSize={`${z.tableNo}px`}
                                        fontWeight="bold"
                                        lineHeight="1.1"
                                        fontVariantNumeric="tabular-nums"
                                    >
                                        {m.tableNo}
                                    </Text>
                                </>
                            )}
                        </HStack>

                        {isBye ? (
                            <Text
                                fontSize={nameSize}
                                fontWeight="bold"
                                color="fg.ink"
                                lineHeight="1.2"
                                lineClamp={2}
                                wordBreak="break-word"
                            >
                                {a}
                            </Text>
                        ) : (
                            <>
                                {pairLine(a, scoreA, aWon)}
                                <Box h="1px" bg="border.subtle" flexShrink={0} />
                                {pairLine(b, scoreB, bWon)}
                            </>
                        )}
                    </Box>
                )
            })}
        </Box>
    )
}
