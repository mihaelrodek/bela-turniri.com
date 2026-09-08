import { useState } from "react"
import { Box, Grid, HStack, Text, VStack } from "@chakra-ui/react"
import { FiChevronDown, FiChevronRight } from "react-icons/fi"

import SuitGlyph from "../../game/components/SuitGlyph"
import { suitKey } from "../../game/util/cards"
import { useTranslation } from "../../i18n"
import { scoreRounds, totalsOf, winnerOf } from "../store"
import { BLOK_SIDES, type BlokGame, type BlokRound, type BlokSide } from "../types"
import { sideName } from "./blokSide"
import DealScoreCell from "./DealScoreCell"

/* ──────────────────────────────────────────────────────────────────────────
   BlokSeriesGames — the finished games of THIS series, inside the score card
   (BLOK-HISTORY.md §5.4).

   WHY IT IS IN THE CARD AND NOT IN A DIALOG
   ─────────────────────────────────────────
   It used to be an "Odigrane partije" dialog off the menu, and it read as the
   profile's archive: the player opened the two side by side, saw rows here and
   an empty section there, and concluded the profile was broken. A dialog is a
   place of its own, and a place of its own is what invited the comparison.

   Living UNDER THE SCORE, behind a chevron on the card's own divider, it can
   only be read as what it is: more of the same scoreboard. The card is the
   series being played; the profile keeps the series that were saved. That is
   the distinction the user tripped over, and geography is what teaches it.

   IT SCROLLS INSIDE ITSELF — DECISION, and an amendment to BLOK.md §3.1
   ────────────────────────────────────────────────────────────────────
   On a phone the page is a fixed-height two-row grid: the card in row one
   (`auto`) and the deal list in row two (`minmax(0, 1fr)`, the page's only
   scroller). An expanding card is therefore a card that eats the deal list —
   and with a long enough series it eats it entirely, then overflows the fixed
   height into the strip under the action bar, where nothing can reach it.

   So this panel is CAPPED and scrolls inside itself, rather than pushing. The
   cap (about a third of the viewport) leaves the deal list the majority of the
   column it had, which matters because the list is what somebody is reading
   while they type the next deal. §3.1's rule was that the PAGE must not
   scroll; a bounded, `overscroll-behavior: contain` scroller that exists only
   while this panel is open does not put the page back in motion — it is the
   only alternative that keeps the promise §3.1 was actually protecting.

   NOTHING IS STORED
   ─────────────────
   Every number here is `scoreRounds` / `totalsOf` over the deals, on render,
   exactly as the live scoreboard is (BLOK.md §2). A game's result is the same
   arithmetic whether it is being played or being read back, and a stored total
   would go wrong the first time somebody fixed a deal in game two.
   ────────────────────────────────────────────────────────────────────── */

function declarationTotal(values: number[] | undefined): number {
    return (values ?? []).reduce((sum, value) => sum + value, 0)
}

/** One deal of a finished game in the same compact form as the live list. */
function DealRow({
    round,
    total,
    runningTotal,
    names,
}: {
    round: BlokRound
    total: Record<BlokSide, number>
    runningTotal: Record<BlokSide, number>
    names: Record<BlokSide, string>
}) {
    const { t } = useTranslation()

    return (
        <Grid
            templateColumns="1fr 2.5rem 1fr"
            alignItems="center"
            gap="2"
            px="2"
            py="1.5"
            borderBottomWidth="1px"
            borderColor="border.subtle"
            _last={{ borderBottomWidth: 0 }}
        >
            <DealScoreCell
                side="us"
                name={names.us}
                points={total.us}
                runningTotal={runningTotal.us}
                called={round.caller === "us"}
                declarations={declarationTotal(round.declarations?.us)}
                belot={round.belot === "us"}
                compact
            />

            {/* `SuitGlyph` is decorative by design, so the suit's NAME rides on
                the wrapper. The names come from the existing `game.suit.*`
                keys — the blok never mints its own (BLOK.md §6). */}
            <Box
                gridColumn={2}
                display="flex"
                justifyContent="center"
                alignItems="center"
                {...(round.trump
                    ? {
                        role: "img",
                        "aria-label": t(suitKey(round.trump)),
                        title: t(suitKey(round.trump)),
                    }
                    : { "aria-hidden": "true" as const })}
            >
                {round.trump ? (
                    <SuitGlyph suit={round.trump} size={14} />
                ) : (
                    <Box boxSize="1" rounded="full" bg="border.strong" />
                )}
            </Box>

            <DealScoreCell
                side="them"
                name={names.them}
                points={total.them}
                runningTotal={runningTotal.them}
                called={round.caller === "them"}
                declarations={declarationTotal(round.declarations?.them)}
                belot={round.belot === "them"}
                compact
            />
        </Grid>
    )
}

/** One finished game: a tappable summary line that opens its deals. */
function GameRow({
    game,
    seriesScore,
}: {
    game: BlokGame
    seriesScore: Record<BlokSide, number>
}) {
    const { t } = useTranslation()
    const [open, setOpen] = useState(false)

    const names = {
        us: sideName("us", game.names, t),
        them: sideName("them", game.names, t),
    }
    const totals = totalsOf(game)
    // The game's own target — a belot deal is worth exactly that (BLOK.md
    // §1.2), and an archived game may have been played to a different one.
    const outcomes = scoreRounds(game.rounds, game.target)
    let runningUs = 0
    let runningThem = 0
    const rows = game.rounds.map((round, index) => {
        const total = outcomes[index]?.total ?? { us: 0, them: 0 }
        runningUs += total.us
        runningThem += total.them
        return { round, total, runningTotal: { us: runningUs, them: runningThem } }
    })

    return (
        <Box borderWidth="1px" borderColor="border.subtle" rounded="l3" bg="bg.subtle">
            <Box
                as="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                w="full"
                minW="0"
                textAlign="start"
                px="3"
                py="2.5"
                rounded="l2"
                _hover={{ bg: "bg.panel" }}
                _focusVisible={{
                    outline: "2px solid",
                    outlineColor: "brand.focusRing",
                    outlineOffset: "-2px",
                }}
                title={t(open ? "blok.games.hideDeals" : "blok.games.showDeals")}
            >
                {/* ONE COLUMN PER SIDE, aligned with the card above it — the
                    game's points as the figure, and under it how the SERIES
                    stood after this game. The row used to read
                    "1 : 0 … 1149 : 543": two score pairs side by side, in
                    different units, with nothing saying which was which. Split
                    per side, each number sits under its own team's name in the
                    card, and the two quantities stop competing. */}
                <HStack gap="3" minW="0" align="center">
                    <Box color="fg.subtle" flexShrink="0" display="flex" aria-hidden="true">
                        {open ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}
                    </Box>
                    <Grid templateColumns="1fr 1fr" gap="2" flex="1" minW="0">
                        {BLOK_SIDES.map((side) => (
                            <Box key={side} textAlign="center" minW="0">
                                <Text
                                    fontSize="sm"
                                    fontWeight="semibold"
                                    color="fg.ink"
                                    lineHeight="1.15"
                                    css={{ fontVariantNumeric: "tabular-nums" }}
                                >
                                    {totals[side]}
                                </Text>
                                <Text
                                    fontSize="2xs"
                                    fontWeight="bold"
                                    color={side === "us" ? "brand.fg" : "fg.muted"}
                                    lineHeight="1.2"
                                    css={{ fontVariantNumeric: "tabular-nums" }}
                                >
                                    {seriesScore[side]}
                                </Text>
                            </Box>
                        ))}
                    </Grid>
                </HStack>
            </Box>

            {open ? (
                /* Opaque (`bg`, not `bg.panel`): this panel opens INSIDE the
                   pinned score card and the deal list keeps scrolling behind
                   it, so a translucent fill let two lists overlap on screen. */
                <Box borderTopWidth="1px" borderColor="border.subtle" bg="bg" pb="1">
                    <Grid
                        templateColumns="1fr 2.5rem 1fr"
                        gap="2"
                        px="2"
                        py="1.5"
                        borderBottomWidth="1px"
                        borderColor="border.subtle"
                        bg="bg.subtle"
                    >
                        {BLOK_SIDES.map((side, index) => (
                            <Text
                                key={side}
                                gridColumn={index === 0 ? 1 : 3}
                                textAlign="center"
                                fontSize="2xs"
                                fontWeight="bold"
                                textTransform="uppercase"
                                letterSpacing="0.06em"
                                color="fg.subtle"
                                truncate
                            >
                                {names[side]}
                            </Text>
                        ))}
                    </Grid>
                    {rows.map(({ round, total, runningTotal }) => (
                        <DealRow
                            key={round.id}
                            round={round}
                            total={total}
                            runningTotal={runningTotal}
                            names={names}
                        />
                    ))}
                </Box>
            ) : null}
        </Box>
    )
}

export default function BlokSeriesGames({
    games,
}: {
    /** Finished games of the CURRENT series, oldest first. Never the game in
     *  progress — that one is the scoreboard right above this panel. */
    games: BlokGame[]
    /* `pendingSeries` used to be here and the line it drew has MOVED to
       `BlokPage`, above the deal list. Two reasons, and the second is the real
       one: this panel is behind a chevron, so the count was hidden until
       somebody went looking; and the panel is not rendered at all until the
       series has a finished game — which means that right after "Nova igra",
       the one moment there is guaranteed to be something in the queue, there
       was nowhere for the sentence to appear. */
}) {
    const { t } = useTranslation()
    let winsUs = 0
    let winsThem = 0
    const seriesScores = games.map((game) => {
        const winner = winnerOf(game)
        if (winner === "us") winsUs += 1
        if (winner === "them") winsThem += 1
        return { us: winsUs, them: winsThem }
    })

    return (
        <Box
            mt="3"
            pt="3"
            borderTopWidth="1px"
            borderColor="border.subtle"
            /* Capped and self-scrolling — see the file header. `contain` stops
               a flick at the end of this list from dragging the deal list (or
               the PWA's pull-to-refresh) behind it.

               `min(28dvh, 14rem)` rather than a bare percentage, and the number
               is arithmetic rather than taste: the card above this holds the
               agreement line, two big totals, the chevron, its own padding and
               — when the blok is linked to a table — the status strip, which on
               a short phone (a 568 px viewport) comes to roughly 200 px. The
               column those share is `100dvh` minus the app chrome minus the
               action bar, about 378 px there. 28dvh (≈ 158 px) is what still
               leaves the deal list a row rather than letting the card overflow
               the fixed height into the strip under the action bar, where
               nothing can reach it. The `rem` half caps a tall tablet, where
               28dvh would be more panel than anybody wants at once. */
            maxH={{ base: "min(28dvh, 14rem)", md: "22rem" }}
            overflowY="auto"
            overscrollBehavior="contain"
        >
            {games.length === 0 ? (
                <Text fontSize="xs" color="fg.subtle" py="2">
                    {t("blok.archive.empty")}
                </Text>
            ) : (
                <VStack gap="2" align="stretch">
                    {games.map((game, index) => (
                        <GameRow
                            key={game.id}
                            game={game}
                            seriesScore={seriesScores[index]}
                        />
                    ))}
                </VStack>
            )}
        </Box>
    )
}
