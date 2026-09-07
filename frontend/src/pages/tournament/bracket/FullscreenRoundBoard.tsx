import { Box, HStack, Text } from "@chakra-ui/react"
import { FiAward, FiCheckCircle } from "react-icons/fi"

import { useTranslation } from "../../../i18n"
import { type MatchLocal, winnerOf } from "../../../utils/tournamentMatch"
import type { PairShort } from "../../../types/pairs"
import { type FsSize, fsColumns, fsScoreText } from "./fullscreenSize"

/* ---------- Fullscreen round board ----------------------------------------

   What this screen is FOR: a laptop or a TV standing in the corner of the
   venue, showing the round that is being played. Nobody reads it from 40 cm
   away — they read it from across a hall, looking for one thing ("which table
   am I on?") and, once the round is running, for one more ("what is the score
   on table 4?").

   That rules the layout:
     • The board fills the viewport. Cards are grid cells with `1fr` rows, so
       three matches make three tall cards and twelve make twelve smaller
       ones — the empty two thirds of the old design are gone.
     • Every type size is derived from ONE scalar (`unit` below) computed from
       the number of rows and columns actually on screen, so the type grows
       when there is room and shrinks when there isn't, instead of being
       pinned to breakpoint tokens that know nothing about the match count.
     • The table number is the loudest thing on the card: its own block, in
       the solid brand colour, at roughly 40% of the cell unit.
     • Scores render as soon as they exist (typed, queued or saved), because
       a round in progress is what the wall is showing most of the time.
     • A bye is the same card with a quiet blue block instead of a table
       number — distinct, but not the red-flag "something is wrong here" the
       old italic blue panel read as.

   Sizing is a two-way switch: "larger" = fewer columns and bigger cards,
   "smaller" = one more column and denser cards. */

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

    const cols = fsColumns(matches.length, size)
    const rows = Math.max(1, Math.ceil(matches.length / cols))

    /* The one scalar every type size below is a fraction of: roughly the
       height of a single cell, with a width term so a very wide, very short
       card can't grow type it has no horizontal room for. 82/94 rather than
       100/100 because the header bar, the board's padding and the row gaps
       are not the cards' to spend — deliberately a little conservative, since
       type that lands slightly small is a worse-looking board and type that
       lands slightly large is a clipped one. `dvh` matches the overlay's own
       100dvh height. It is a CSS string, so the BROWSER does the scaling: a
       window resize re-lays-out without a React render. */
    const unit = `min(${(82 / rows).toFixed(2)}dvh, ${((94 / cols) * 0.42).toFixed(2)}vw)`

    /* Phone values are ordinary tokens: at 1 column with a floor on the row
       height the cell arithmetic would just fight the scroll container. */
    const numberSize = { base: "4xl", md: `clamp(2.25rem, calc(${unit} * 0.4), 13rem)` }
    const labelSize = { base: "2xs", md: `clamp(0.625rem, calc(${unit} * 0.07), 1.5rem)` }
    const nameSize = { base: "lg", md: `clamp(1rem, calc(${unit} * 0.15), 4rem)` }
    const scoreSize = { base: "xl", md: `clamp(1.1rem, calc(${unit} * 0.17), 4.5rem)` }
    const blockW = { base: "84px", md: `clamp(4.5rem, calc(${unit} * 0.8), 18rem)` }

    const pairLine = (name: string, score: string, isWinner: boolean) => (
        <HStack gap={{ base: "2", md: "4" }} minW="0" align="center">
            {isWinner && (
                /* react-icons default to 1em, so the trophy scales with the
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
                lineHeight="1.15"
                overflow="hidden"
                textOverflow="ellipsis"
                whiteSpace="nowrap"
            >
                {name}
            </Text>
            {score !== "" && (
                <Text
                    flexShrink={0}
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
            /* Two different jobs at the two sizes, and they need different
               boxes. On a screen the board OWNS its height: `100%` + `1fr`
               rows means the cards divide the viewport between them and
               nothing ever scrolls. On a phone the column is one card wide
               and the round is simply a list, so the height goes back to
               `auto` with a floor per card — a definite 100% there would pin
               the rows to a screenful and clip whatever didn't fit instead of
               letting the container scroll. */
            h={{ base: "auto", md: "100%" }}
            gridTemplateColumns={{ base: "minmax(0, 1fr)", md: `repeat(${cols}, minmax(0, 1fr))` }}
            gridAutoRows={{ base: "minmax(96px, auto)", md: "minmax(0, 1fr)" }}
            gap={{ base: "2", md: "3" }}
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
                        alignItems="stretch"
                        minW="0"
                        minH="0"
                        overflow="hidden"
                        rounded="xl"
                        borderWidth="1px"
                        borderColor={isBye ? "blue.muted" : "border.emphasized"}
                        bg="bg.panel"
                        shadow="card"
                    >
                        {/* The thing a player is scanning for. Solid brand
                            fill, full card height, and the only block on the
                            card allowed to be loud. */}
                        <Box
                            w={blockW}
                            flexShrink={0}
                            bg={isBye ? "blue.subtle" : "brand.solid"}
                            color={isBye ? "blue.fg" : "brand.contrast"}
                            display="flex"
                            flexDirection="column"
                            alignItems="center"
                            justifyContent="center"
                            textAlign="center"
                            px="1"
                            gap="0.5"
                        >
                            {isBye ? (
                                /* Deliberately the SCORE size, not the table
                                    number's: the bye block should read as
                                    "nothing to play here", not compete with the
                                    table numbers a player is scanning for. */
                                <Box fontSize={scoreSize} display="flex" aria-hidden="true">
                                    <FiCheckCircle />
                                </Box>
                            ) : (
                                <>
                                    <Text
                                        fontSize={labelSize}
                                        fontWeight="semibold"
                                        letterSpacing="wider"
                                        textTransform="uppercase"
                                        lineHeight="1.2"
                                        opacity={0.85}
                                    >
                                        {tr("tournament.tableLabel")}
                                    </Text>
                                    <Text
                                        fontSize={numberSize}
                                        fontWeight="bold"
                                        lineHeight="1"
                                        fontVariantNumeric="tabular-nums"
                                    >
                                        {m.tableNo}
                                    </Text>
                                </>
                            )}
                        </Box>

                        <Box
                            flex="1"
                            minW="0"
                            display="flex"
                            flexDirection="column"
                            justifyContent="center"
                            gap={{ base: "1.5", md: "2" }}
                            px={{ base: "3", md: "5" }}
                            py={{ base: "2", md: "3" }}
                        >
                            {isBye ? (
                                <>
                                    <Text
                                        fontSize={nameSize}
                                        fontWeight="bold"
                                        color="fg.ink"
                                        lineHeight="1.15"
                                        overflow="hidden"
                                        textOverflow="ellipsis"
                                        whiteSpace="nowrap"
                                    >
                                        {a}
                                    </Text>
                                    <Text
                                        fontSize={labelSize}
                                        fontWeight="semibold"
                                        letterSpacing="wider"
                                        textTransform="uppercase"
                                        color="blue.fg"
                                    >
                                        {tr("tournament.bracket.bye")}
                                    </Text>
                                </>
                            ) : (
                                <>
                                    {pairLine(a, scoreA, aWon)}
                                    <Box h="1px" bg="border.subtle" flexShrink={0} />
                                    {pairLine(b, scoreB, bWon)}
                                </>
                            )}
                        </Box>
                    </Box>
                )
            })}
        </Box>
    )
}
