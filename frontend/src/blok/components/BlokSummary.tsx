import { Card, Grid, HStack, Icon, Separator, Text, VStack } from "@chakra-ui/react"
import type { StackProps } from "@chakra-ui/react"
import { FiArrowDown, FiArrowUp, FiAward } from "react-icons/fi"
import type { IconType } from "react-icons"

import { useTranslation } from "../../i18n"
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
            {/* Centred in its own half (2026-09-09, user request). Pushed to
                the outer edges the two columns drifted apart as the card got
                wider, and the label between them stopped looking like it
                belonged to either. */}
            <Text
                colorPalette={sidePalette("us")}
                textAlign="center"
                fontSize={emphasize ? "lg" : "md"}
                fontWeight={emphasize ? "bold" : "medium"}
                color={emphasize ? "colorPalette.fg" : "fg.ink"}
                css={{ fontVariantNumeric: "tabular-nums" }}
            >
                {values.us}
            </Text>
            <Text textAlign="center" fontSize="xs" color="fg.muted" fontWeight="semibold">
                {label}
            </Text>
            <Text
                colorPalette={sidePalette("them")}
                textAlign="center"
                fontSize={emphasize ? "lg" : "md"}
                fontWeight={emphasize ? "bold" : "medium"}
                color={emphasize ? "colorPalette.fg" : "fg.ink"}
                css={{ fontVariantNumeric: "tabular-nums" }}
            >
                {values.them}
            </Text>
        </>
    )
}

/**
 * A grey caption with an arrow, pointing at something that is already on
 * screen: the games of this series above, the button that starts the next one
 * below. One row, no border, no colour — a signpost, not a control.
 */
function Hint({
    icon,
    label,
    above = false,
    mt,
    mb,
    pt,
}: {
    icon: IconType
    label: string
    /** Arrow above the words rather than below them, so the whole thing reads
     *  in the direction it points. */
    above?: boolean
    /** Spacing only — this thing has no other geometry worth exposing. */
    mt?: StackProps["mt"]
    mb?: StackProps["mb"]
    pt?: StackProps["pt"]
}) {
    const arrow = <Icon as={icon} boxSize="4" color="fg.muted" aria-hidden="true" />
    return (
        <VStack gap="0" w="full" mt={mt} mb={mb} pt={pt}>
            {above ? arrow : null}
            {/* Bigger and bold (2026-09-09, user request): these two lines are
                the only instructions on the card, and at `xs` in `fg.subtle`
                they read as a caption on the numbers above rather than as the
                thing to do next. */}
            <Text
                /* A step down again now that it is upper case (2026-09-09):
                   capitals are wider, and at `sm` the block grew tall enough
                   to push its own arrow off the bottom of the card. */
                fontSize={{ base: "xs", md: "sm" }}
                fontWeight="bold"
                color="fg.muted"
                textAlign="center"
                lineHeight="1.3"
                /* Upper case in CSS, not in the dictionaries (2026-09-09, user
                   request): the Croatian and Slovenian strings stay readable
                   sentences, and a locale whose casing rules differ is free to
                   override the transform rather than carry a shouted copy of
                   its own text. */
                textTransform="uppercase"
                letterSpacing="0.04em"
            >
                {label}
            </Text>
            {above ? null : arrow}
        </VStack>
    )
}

export default function BlokSummary({
    winner,
    names,
    totals,
    declarations,
    stiglje,
    seriesWinner,
    reviewableGames,
    compact = false,
}: {
    winner: BlokSide
    names: Record<BlokSide, string>
    totals: Record<BlokSide, number>
    /** Sum of every declaration a side made across the game. */
    declarations: Record<BlokSide, number>
    /** How many deals a side swept all eight tricks. */
    stiglje: Record<BlokSide, number>
    /** Who has taken the series, or null while it is still running — always
     *  null for an open-ended series, which is the default. */
    seriesWinner: BlokSide | null
    /**
     * How many games of this series can be reviewed behind the score card's
     * chevron — the just-finished one included.
     *
     * Only ever compared to zero: above zero the card points UP at them. The
     * count rather than a boolean because the caller already has the list, and
     * a `hasSomething` prop is a boolean somebody has to keep in step with the
     * panel it describes.
     */
    reviewableGames: number
    /**
     * Draw tighter, because the score card above is showing its games panel
     * and the screen has to hold both (2026-09-09, user request).
     *
     * Padding and type only — nothing is hidden. A summary that drops a number
     * to fit is a summary you cannot trust, and the three lines it carries are
     * the whole reason the card exists.
     */
    compact?: boolean
}) {
    const { t } = useTranslation()

    // `seriesWinner` is already null for an open series (`seriesWinnerFrom`),
    // so this is the whole of "the evening is over" — no second condition.
    const seriesDone = seriesWinner !== null
    const verdictSide = seriesWinner ?? winner
    /** Did this side type a name for itself? An empty string is the default. */
    const named = names[verdictSide].trim() !== ""

    return (
        <Card.Root
            variant="outline"
            rounded="xl"
            bg="bg.panel"
            borderColor="border.emphasized"
            shadow="card"
            /* Fills the height its wrapper gives it (see `BlokPage`), and
               `w="100%"` because a flex child does not stretch sideways on
               its own. On md the wrapper is a grid item of its own row, so
               100% is simply that row — no change there. */
            h="100%"
            w="100%"
            display="flex"
            flexDirection="column"
        >
            <Card.Body
                px={{ base: "4", md: "5" }}
                py={compact ? "2" : { base: "4", md: "5" }}
                flex="1"
                minH="0"
                display="flex"
                flexDirection="column"
            >
                {/* TWO SIGNPOSTS, POINTING AT THINGS THAT ARE ALREADY THERE
                    (2026-09-09, user request).

                    The games of this series live behind a chevron on the score
                    card ABOVE, and the next game starts from the button BELOW.
                    Both were discoverable only by trying them. A line of grey
                    text with an arrow costs one row each and says where to
                    look — which is all a person needs the first time and all
                    they will read the tenth.

                    The arrow points at the thing, so it is drawn on the side
                    the thing is on: up here, down at the foot of the card. */}
                {reviewableGames > 0 ? (
                    <Hint icon={FiArrowUp} label={t("blok.summary.reviewGames")} above mb={compact ? "1" : "3"} />
                ) : null}
                {/* Left, not centred (2026-09-09, user request): a pair name
                    can be long enough to wrap, and a centred two-line verdict
                    made the medal beside it look detached from the words. */}
                <HStack gap="2.5" align="center" justify="flex-start">
                    <Icon as={FiAward} boxSize={compact ? "5" : "6"} color="brand.fg" />
                    <Text
                        fontSize={compact ? "md" : { base: "lg", md: "xl" }}
                        fontWeight="bold"
                        lineHeight="1.2"
                        color="fg.ink"
                        textAlign="left"
                    >
                        {/* A pair that typed its own name is called by it:
                            "Perhaj i Galinec su pobijedili", not "Mi smo
                            pobijedili" (2026-09-09, user request). The MI/VI
                            wording is what a nameless side falls back to, and
                            it stays the default because most tables never type
                            anything. */}
                        {named
                            ? t(
                                seriesDone ? "blok.series.wonNamed" : "blok.winner.named",
                                { name: names[verdictSide] },
                            )
                            : t(
                                seriesDone
                                    ? (verdictSide === "us"
                                        ? "blok.series.won.us"
                                        : "blok.series.won.them")
                                    : sideWinnerKey(verdictSide),
                            )}
                    </Text>
                </HStack>

                <Separator my={compact ? "2" : "4"} borderColor="border.subtle" />

                <Grid templateColumns="minmax(0, 1fr) auto minmax(0, 1fr)" columnGap="3" rowGap={compact ? "0.5" : "2.5"} alignItems="center">
                    {BLOK_SIDES.map((side, index) => (
                        <Text
                            key={side}
                            gridColumn={index === 0 ? 1 : 3}
                            textAlign="center"
                            fontSize="2xs"
                            fontWeight="bold"
                            textTransform="uppercase"
                            letterSpacing="0.08em"
                            color="fg.subtle"
                            wordBreak="break-word"
                            lineClamp={2}
                            title={names[side]}
                        >
                            {names[side]}
                        </Text>
                    ))}

                    <SummaryRow label={t("blok.summary.points")} values={totals} emphasize />
                    <SummaryRow label={t("blok.summary.declarations")} values={declarations} />
                    <SummaryRow label={t("blok.summary.stiglje")} values={stiglje} />
                </Grid>

                {/* THE TWO BUTTONS MOVED TO THE ACTION BAR (2026-09-09, user
                    request): once a game is won, "Poništi zadnju rundu" takes
                    the MI box and "Sljedeća partija" takes the VI box, at the
                    bottom of the screen where the thumb already is. They are
                    not repeated here — one action, one place — and what is
                    left on this card is the verdict and the numbers.

                    Which is also what the arrow below now points at. */}
                {/* The arrow points past the card at the action bar, where
                    the two buttons now live. */}
                {/* `mt="auto"` is what puts it on the floor of the card: the
                    verdict and the numbers keep their natural height at the
                    top, and this sits just above the action bar it points at,
                    however tall the phone is. */}
                <Hint
                    icon={FiArrowDown}
                    label={t(seriesDone ? "blok.summary.startNewSeries" : "blok.summary.startNextGame")}
                    mt="auto"
                    pt={compact ? "1.5" : "3"}
                />
            </Card.Body>
        </Card.Root>
    )
}
