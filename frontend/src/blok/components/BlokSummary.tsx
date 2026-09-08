import { Box, Button, Card, Grid, HStack, Icon, Separator, Text } from "@chakra-ui/react"
import { FiArrowRight, FiAward, FiPlusCircle, FiRotateCcw } from "react-icons/fi"

import { usePlural, useTranslation } from "../../i18n"
import { BLOK_SIDES, type BlokSide } from "../types"
import { sidePalette, sideWinnerKey } from "./blokSide"

/* ──────────────────────────────────────────────────────────────────────────
   BlokSummary — the end of the game: who won, an escape hatch, and the three
   numbers people actually argue about afterwards.

   It renders only once a side has reached the target. Until then the board
   IS the summary, and a permanently visible "totals" table under a scoreboard
   that already shows the totals is noise.

   Order is deliberate: the verdict, then UNDO, then the breakdown, then the
   action that moves on. Undo sits directly under the verdict because the
   single most common reason to look at this card is that the last deal was
   typed wrong and the game ended by accident — that has to be reachable before
   the eye lands on the big primary button that files the game away.

   The breakdown is a 3-column grid rather than a Table: three rows of two
   numbers do not need table semantics, and a grid keeps the numbers on the
   same right-aligned rails as the deal list above it.

   ── SERIES — 2026-09-08 ───────────────────────────────────────────────────
   A blok IS a series, so this card has to answer a second question: is the
   EVENING over, or only this game? Three shapes, and the first is the default
   — an open-ended series, which is exactly the card that existed before:

     - open series (`seriesTarget === null`): the game verdict, the running
       record underneath it once there is one, and "Sljedeća partija" as the
       primary action. NOTHING here ever declares the series over, because
       nothing can: only the menu's "Nova igra" closes and files it.
     - target set, not reached: the game verdict, a line saying where the
       series stands (2 : 1, playing to 3), same "Sljedeća partija" primary —
       because that is literally what happens next.
     - target reached: the verdict says the SERIES was won, and the primary
       action becomes "Nova igra", which files the whole series on the profile,
       puts the series score back to 0:0 and clears the pad (BLOK-HISTORY.md
       §2.2, §5.6). "Sljedeća partija" is dropped from this card at that point:
       offering it beside the action that ENDS the evening is how a finished
       series silently becomes a fourth game nobody meant to play.

   ── TWO ACTIONS, TWO NAMES — BLOK-HISTORY.md §5.6 ─────────────────────────
   The button under a won game says "Sljedeća partija", never "Započni novu
   igru": since §5.6 the words "Nova igra" belong to the menu item that CLOSES
   the series, and a card offering the same phrase for the opposite act — one
   continues the 2 : 1, the other zeroes it — is the confusion that revision
   removed. The icons say it too: an arrow onwards here, the menu's plus for
   the ending.
   ────────────────────────────────────────────────────────────────────── */

function SummaryRow({
    label,
    values,
    emphasize = false,
}: {
    label: string
    values: Record<BlokSide, number>
    emphasize?: boolean
}) {
    return (
        <>
            <Text fontSize="sm" color="fg.muted">
                {label}
            </Text>
            {BLOK_SIDES.map((side) => (
                <Text
                    key={side}
                    colorPalette={sidePalette(side)}
                    textAlign="right"
                    fontSize={emphasize ? "md" : "sm"}
                    fontWeight={emphasize ? "bold" : "medium"}
                    color={emphasize ? "colorPalette.fg" : "fg.ink"}
                    css={{ fontVariantNumeric: "tabular-nums" }}
                >
                    {values[side]}
                </Text>
            ))}
        </>
    )
}

export default function BlokSummary({
    winner,
    names,
    totals,
    declarations,
    stiglje,
    seriesTarget,
    seriesWins,
    seriesWinner,
    canUndo,
    onUndo,
    onNextGame,
    onCloseSeries,
}: {
    winner: BlokSide
    names: Record<BlokSide, string>
    totals: Record<BlokSide, number>
    /** Sum of every declaration a side made across the game. */
    declarations: Record<BlokSide, number>
    /** How many deals a side swept all eight tricks. */
    stiglje: Record<BlokSide, number>
    /** Won games that take the series, or null for an open-ended one — the
     *  default, in which nothing but "Resetiraj" ends the evening. */
    seriesTarget: number | null
    /** Games won per side in this session — counted, never stored. */
    seriesWins: Record<BlokSide, number>
    /** Who has taken the series, or null while it is still running — always
     *  null for an open-ended series, which is the default. */
    seriesWinner: BlokSide | null
    canUndo: boolean
    onUndo: () => void
    /** Start the NEXT game inside this series — the running 2 : 1 continues.
     *  No dialog and no confirmation: nothing is filed and nothing is lost. */
    onNextGame: () => void
    /** Close the series: file it, series score back to 0:0, empty pad — the
     *  menu's "Nova igra" (§5.6). The page owns the confirmation, exactly as it
     *  does for the menu's own item. */
    onCloseSeries: () => void
}) {
    const { t } = useTranslation()
    const tp = usePlural()

    // `seriesWinner` is already null for an open series (`seriesWinnerFrom`),
    // so this is the whole of "the evening is over" — no second condition.
    const seriesDone = seriesWinner !== null
    const verdictSide = seriesWinner ?? winner
    // The running record is worth a line as soon as there is one, target or
    // not: it is what the table is actually keeping score of.
    const playedGames = seriesWins.us + seriesWins.them

    return (
        <Card.Root
            colorPalette={sidePalette(verdictSide)}
            variant="outline"
            rounded="xl"
            bg="colorPalette.subtle"
            borderColor="colorPalette.emphasized"
            shadow="raised"
        >
            <Card.Body px={{ base: "4", md: "5" }} py={{ base: "4", md: "5" }}>
                <HStack gap="2.5" align="center">
                    <Icon as={FiAward} boxSize="6" color="colorPalette.fg" />
                    <Box minW="0">
                        <Text
                            fontSize={{ base: "lg", md: "xl" }}
                            fontWeight="bold"
                            lineHeight="1.2"
                            color="colorPalette.fg"
                        >
                            {t(
                                seriesDone
                                    ? (verdictSide === "us"
                                        ? "blok.series.won.us"
                                        : "blok.series.won.them")
                                    : sideWinnerKey(verdictSide),
                            )}
                        </Text>
                        {/* The verdict key is fixed wording ("Mi smo
                            pobijedili"); a renamed side would otherwise never
                            appear here, so the name rides along underneath.
                            Wraps rather than truncates for the same reason the
                            header does — a pair name is the point. */}
                        <Text fontSize="sm" color="fg.muted" lineClamp={2} wordBreak="break-word">
                            {names[verdictSide]}
                        </Text>
                    </Box>
                </HStack>

                {/* Where the series stands, worded three ways: won, it says
                    what the "Resetiraj" below is for; running towards a
                    target, it is the score AND what it is played to; running
                    open-ended, it is just the score, because there is nothing
                    to measure it against. The game count goes through the
                    plural family — Slovenian's dual makes "2 dobljeni igri" a
                    different word from "3 dobljene igre". */}
                {seriesDone || playedGames > 0 ? (
                    <Text mt="2" fontSize="sm" color="fg.muted">
                        {seriesDone
                            ? t("blok.series.finish")
                            : seriesTarget !== null
                                ? t("blok.series.progress", {
                                    usWins: seriesWins.us,
                                    themWins: seriesWins.them,
                                    games: tp("blok.series.games", seriesTarget),
                                })
                                : t("blok.series.running", {
                                    usWins: seriesWins.us,
                                    themWins: seriesWins.them,
                                })}
                    </Text>
                ) : null}

                <Button
                    mt="3"
                    size="sm"
                    variant="outline"
                    colorPalette="gray"
                    alignSelf="flex-start"
                    disabled={!canUndo}
                    onClick={onUndo}
                >
                    <FiRotateCcw /> {t("blok.round.undoLast")}
                </Button>

                <Separator my="4" borderColor="colorPalette.emphasized" />

                <Grid templateColumns="1fr auto auto" columnGap="4" rowGap="2" alignItems="center">
                    {/* Column heads: the names, so the two numeric rails are
                        readable without counting back up to the scoreboard. */}
                    <Box />
                    {BLOK_SIDES.map((side) => (
                        <Text
                            key={side}
                            textAlign="right"
                            fontSize="2xs"
                            fontWeight="bold"
                            textTransform="uppercase"
                            letterSpacing="0.08em"
                            color="fg.subtle"
                            minW="3.5rem"
                            maxW="7rem"
                            wordBreak="break-word"
                            lineClamp={2}
                            title={names[side]}
                        >
                            {names[side]}
                        </Text>
                    ))}

                    <SummaryRow label={t("blok.summary.total")} values={totals} emphasize />
                    <SummaryRow label={t("blok.summary.declarations")} values={declarations} />
                    <SummaryRow label={t("blok.summary.stiglje")} values={stiglje} />
                </Grid>

                {seriesDone ? (
                    <Button mt="4" size="lg" w="100%" colorPalette="brand" onClick={onCloseSeries}>
                        <FiPlusCircle /> {t("blok.menu.newGame")}
                    </Button>
                ) : (
                    <Button mt="4" size="lg" w="100%" colorPalette="brand" onClick={onNextGame}>
                        <FiArrowRight /> {t("blok.winner.nextGame")}
                    </Button>
                )}
            </Card.Body>
        </Card.Root>
    )
}
