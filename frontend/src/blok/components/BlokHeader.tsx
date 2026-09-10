import { Fragment, type ReactNode } from "react"
import { Box, Card, Flex, HStack, Text } from "@chakra-ui/react"
import { FiChevronDown, FiChevronUp, FiEdit2 } from "react-icons/fi"

import { usePlural, useTranslation } from "../../i18n"
import { BLOK_SIDES, type BlokGameEndRule, type BlokSide } from "../types"
import { sidePalette } from "./blokSide"

/* ──────────────────────────────────────────────────────────────────────────
   BlokHeader — the scoreboard, and the only thing a player looks at from
   across the table.

   Two tiers per side, top to bottom: the running total (as big as the column
   allows) and the side's name. The name is a button: renaming happens far
   more often than anything else in the menu — someone always wants "Ivan i
   Marko" instead of "MI" — and hunting for it in an overflow menu on a phone
   lying on the table is exactly the kind of friction that makes people reach
   for paper instead. The same action is still in the menu for discoverability.

   The "how many times has this side called" badge that used to sit above the
   total is gone — DECISION (2026-09-08), user request: it read as clutter at
   the table and nobody looked at it. `calledCount` is still computed by
   `store.ts` (BLOK.md §5's contract other agents may rely on) and no longer
   consumed here; this file does not touch that contract.

   The number uses `fontVariantNumeric: tabular-nums` so a score climbing
   through 99 → 100 does not shift the layout under the reader's eye, and
   `lineHeight: 1` so the three tiers stack tightly enough to read as one
   unit rather than three separate rows.

   Colour: `colorPalette` is set on each side's column and everything inside
   is styled with palette-relative tokens, so the same markup is AA-legible on
   the light canvas and on the dark one without a single `_dark` branch here.

   ── THE SERIES SCORE IS TWO SMALL NUMBERS, NOT A PILL — 2026-09-08 ────────
   It used to be one centred "SERIJA 2 : 1" badge above the totals. It is now
   one small number over each side's own total, in that side's colour, with no
   label, no separator and nothing centred — the shape the reference app uses,
   and the shape the user asked for. The same information, read as part of the
   column it belongs to instead of as a row of its own.

   What keeps it from being misread as part of the big figure: it is roughly a
   quarter of the total's type size, it is spaced off it, and it never appears
   at all until a game of this session has actually been won (a "0" over a
   fresh blok is a label for nothing). Because there is no longer a spoken
   "SERIJA 2 : 1" pill, each number carries its own accessible name in a
   `srOnly` span — the digit itself is `aria-hidden`, so a screen reader hears
   "Serija — MI: 2 dobivene igre" and never a bare number stuck to the total.

   ── THE CARD HAS TWO CORNERS AND A CHEVRON — 2026-09-08 (§5.2, §5.4) ──────
   Top-left is `share`, top-right is `menu`, and under the divider between the
   two scores is a chevron that opens `games` — the finished games of this
   series. All three are SLOTS: this file renders a scoreboard and must not
   learn what a share token or an archived game is. What it does own is where
   they sit, because that is a fact about this card.

   ── A REAL PAIR NAME HAS TO FIT — 2026-09-08, user report ─────────────────
   Renaming a side to "Perhaj i Galinec" used to read "PERHAJ I GALI…", which
   makes the rename pointless: the name IS the reason anybody opens that
   dialog. Two things fix it together — the label wraps to a second line
   (`lineClamp={2}`, so a long SINGLE word still degrades to an ellipsis
   rather than overflowing) and the type steps down once both names get long
   (`sideNameFontSize`). The step is driven by the LONGER of the two names, so
   the columns never end up in two different sizes, which would read as one
   side being more important than the other. The full name stays reachable
   either way: it is in the button's `title` and in its accessible name.
   ────────────────────────────────────────────────────────────────────── */

/** Name label size, stepped by the length of the LONGER of the two names (the
 *  page's action bar steps on the same number, with its own sizes). Two steps,
 *  not a continuous scale: the point is that "Perhaj i Galinec" fits on two
 *  lines, not that every string gets its own type size. */
function sideNameFontSize(longest: number): { base: string; md: string } {
    if (longest > 18) return { base: "2xs", md: "xs" }
    if (longest > 11) return { base: "xs", md: "sm" }
    return { base: "sm", md: "md" }
}

function SideTotal({
    side,
    name,
    total,
    wins,
    nameFontSize,
    onRename,
}: {
    side: BlokSide
    name: string
    total: number
    /** Games this side has won in the session, or null before the session has
     *  finished one — then no number is drawn at all, on either side. */
    wins: number | null
    /** Same value for both sides — see `sideNameFontSize`. */
    nameFontSize: { base: string; md: string }
    onRename: (side: BlokSide) => void
}) {
    const { t } = useTranslation()
    const tp = usePlural()

    return (
        <Flex
            colorPalette={sidePalette(side)}
            direction="column"
            align="center"
            gap="1.5"
            minW="0"
            flex="1"
        >
            {wins !== null ? (
                <Text
                    // A quarter of the total's size and spaced off it: this is
                    // the series, not a digit of the score below.
                    fontSize={{ base: "sm", md: "md" }}
                    fontWeight="bold"
                    lineHeight="1"
                    // On top of the column's own gap: a small number hugging a
                    // 7xl one reads as part of it, which is the one thing this
                    // must never do.
                    mb="1"
                    color="colorPalette.fg"
                    css={{ fontVariantNumeric: "tabular-nums" }}
                >
                    <Box as="span" aria-hidden="true">
                        {wins}
                    </Box>
                    {/* The pill that used to say "SERIJA 2 : 1" out loud is
                        gone, so the number says what it is here. */}
                    <Box as="span" srOnly>
                        {t("blok.series.sideAria", {
                            side: name,
                            games: tp("blok.series.games", wins),
                        })}
                    </Box>
                </Text>
            ) : null}

            <Text
                /* NEVER changes with the games panel (2026-09-09, user
                   request). Making the score smaller while the panel was open
                   did buy the room, but the number people are reading moved
                   and resized under them every time they tapped a chevron —
                   which is a worse fault than a tight screen. The verdict card
                   below gives the height back instead (`BlokSummary compact`). */
                fontSize={{ base: "5xl", sm: "6xl", md: "7xl" }}
                fontWeight="bold"
                lineHeight="1"
                letterSpacing="-0.02em"
                color="colorPalette.fg"
                css={{ fontVariantNumeric: "tabular-nums" }}
            >
                {total}
            </Text>

            {/* `Box as="button"` (the project's pattern — Chakra's polymorphic
                typing has no `type` prop) rather than a real <Button>: the
                button recipe's padding and hover fill fight the score sitting
                right above it, and all this needs is a hit target and a ring. */}
            <Box
                as="button"
                onClick={() => onRename(side)}
                // The full name, always — the label itself may be clamped.
                title={`${name} — ${t("blok.side.rename")}`}
                aria-label={`${t("blok.side.rename")}: ${name}`}
                w="100%"
                maxW="100%"
                flex="1"
                display="flex"
                alignItems="center"
                // …AND centred horizontally. Making the button a flex box (so
                // the name could centre vertically against a two-line
                // neighbour) reset its child to flex-start, which quietly
                // pushed both names to the left edge of their columns —
                // 2026-09-08, user report.
                justifyContent="center"
                px="1.5"
                py="0.5"
                rounded="l2"
                _hover={{ bg: "bg.subtle" }}
                _focusVisible={{ outline: "2px solid", outlineColor: "colorPalette.focusRing", outlineOffset: "1px" }}
            >
                {/* TWO NAMES, ONE CENTRE LINE — 2026-09-08, user report.
                    "PERHAJ I GALINEC" wraps to two lines while "VI" stays on
                    one, and the short one used to sit at the TOP of the taller
                    block: two labels of the same row reading as two different
                    rows. The fix is a row that is always two lines tall and
                    centres its content — `minH="2.5em"` (two lines at the
                    label's own `lineHeight: 1.25`) with `align="center"`.

                    In `em`, and with the name's font size set HERE as well as
                    on the label, so the reserve follows every step of
                    `sideNameFontSize` and every breakpoint by itself; a rem
                    figure would have to be kept in step with that table by
                    hand. `lineClamp={2}` caps the label at two lines, so this
                    box is never overflowed either.

                    The cost is one line of height on a card whose names are
                    both short — and it buys a card that does not change height
                    the moment somebody renames a side, which is the same
                    stability the tabular figures above it are for. The pencil
                    stays where it was, beside the name, centred with it. */}
                <HStack
                    gap="1"
                    justify="center"
                    align="center"
                    minW="0"
                    fontSize={nameFontSize}
                    // NO fixed two-line reserve any more — 2026-09-08. It bought
                    // the alignment cheaply but cost a whole blank line on the
                    // usual card, where both names are short. The two columns
                    // are stretched to the same height by the row above, and
                    // this block fills what is left of its column (`flex="1"`
                    // on the button) and centres inside it — so "VI" still sits
                    // level with "PERHAJ I / GALINEC" and a card whose names
                    // both fit on one line is one line shorter.
                    h="full"
                >
                    <Text
                        fontSize={nameFontSize}
                        fontWeight="semibold"
                        color="fg.soft"
                        textTransform="uppercase"
                        letterSpacing="0.06em"
                        lineHeight="1.25"
                        textAlign="center"
                        minW="0"
                        // Wrap to a second line first; a single word too long
                        // for two lines breaks and then clamps with an
                        // ellipsis rather than pushing the column open.
                        whiteSpace="normal"
                        wordBreak="break-word"
                        lineClamp={2}
                    >
                        {name}
                    </Text>
                    <Box color="fg.subtle" flexShrink="0" display="flex" aria-hidden="true">
                        <FiEdit2 size={12} />
                    </Box>
                </HStack>
            </Box>
        </Flex>
    )
}

export default function BlokHeader({
    names,
    totals,
    target,
    seriesTarget,
    gameEndRule,
    seriesWins,
    onRename,
    menu,
    share,
    games,
    openGames,
    onGamesOpenChange,
    strip,
}: {
    names: Record<BlokSide, string>
    totals: Record<BlokSide, number>
    target: number
    /** Won games that take the series, or null for an open-ended one — the
     *  default. Only decides whether "do 2 dobivene igre" rides along on the
     *  target line; the per-side scores are shown either way. */
    seriesTarget: number | null
    /**
     * How a single game ends — BLOK.md §3.5. ALWAYS named on the target line
     * (BLOK-HISTORY.md §5.5), not just when it is the non-default one: the two
     * rules produce different winners from the same deals, so the line that
     * says what is being played to has to say which of them is in force. The
     * earlier "announce only the non-default" conditional is gone.
     */
    gameEndRule: BlokGameEndRule
    /** Games won per side in this session — counted, never stored. */
    seriesWins: Record<BlokSide, number>
    onRename: (side: BlokSide) => void
    /** The overflow menu trigger, parked in the card's top-right corner. */
    menu?: ReactNode
    /**
     * The share control, parked in the card's top-LEFT corner — the opposite
     * corner from the menu, deliberately (BLOK-HISTORY.md §5.2).
     *
     * Sharing left the menu because it is a frequent, non-destructive action
     * and the menu is where settings and endings live; a control somebody uses
     * every evening does not belong behind the same tap as "Obriši igru". A
     * slot rather than a prop pair, for the same reason `strip` is one: this
     * card renders a score and knows nothing about tokens or accounts.
     */
    share?: ReactNode
    /**
     * The finished games of this series (`BlokSeriesGames`), revealed by the
     * chevron under the divider — §5.4.
     *
     * The chevron is drawn ONLY when this is provided, so a first game on a
     * fresh blok has no control pointing at nothing. Open/closed is local
     * state here: it is a property of this render of this screen, not of the
     * game, and storing it would be storing a preference nobody set.
     */
    games?: ReactNode
    /** Is the games panel open? Held by the page — see the note by
     *  `gamesOpen` below. */
    openGames: boolean
    onGamesOpenChange: (open: boolean) => void
    /**
     * The tournament-link status strip (`BlokLinkStrip`), under the totals.
     *
     * A slot rather than a prop pair, because this card knows nothing about
     * links and should not start to: it renders a score. It sits BELOW the
     * numbers on purpose — the score is what the table reads from across the
     * felt, and pushing it down for a line about the network would invert
     * what this screen is for. Absent (and costing no height) on the ordinary
     * offline blok, which is every blok until someone links one.
     */
    strip?: ReactNode
}) {
    const { t } = useTranslation()
    const tp = usePlural()
    const nameFontSize = sideNameFontSize(Math.max(names.us.length, names.them.length))
    /* Held by the PAGE since 2026-09-09: opening this panel makes the score
       card taller, and the verdict card below has to know so it can give the
       room back (`BlokSummary compact`). A local `useState` could not tell it. */
    const gamesOpen = openGames
    const setGamesOpen = onGamesOpenChange

    /* One quiet line for everything the table agreed on before dealing: what
       is being played to, how a game ends, and how long the series is (when it
       has a length). "DO 1001 · PROLAZ", and with a series "DO 1001 · PROLAZ ·
       do 2 dobivene igre" — BLOK-HISTORY.md §5.5. The middot is punctuation,
       not a word: every phrase here comes from the dictionaries.

       Order is fixed and not alphabetical: the points target and the rule are
       one sentence about a single GAME ("do 1001, i to na prolaz"), so they
       stay adjacent; the series length is about the evening and comes last. */
    const agreement = [
        // Just the number (2026-09-09, user request). "DO 1001 · PROLAZ" said
        // the same thing twice: the line IS the agreement, and nobody reads a
        // score card wondering what 1001 might be counting.
        String(target),
        // Dedicated inline labels keep the compact agreement explicit in
        // each locale and consistently capitalised.
        t(gameEndRule === "prolaz" ? "blok.rule.prolazInline" : "blok.rule.dostaInline"),
        seriesTarget !== null
            ? t("blok.series.badgeTarget", { games: tp("blok.series.games", seriesTarget) })
            : null,
    ].filter((part): part is string => part !== null)

    // From the FIRST finished game on — see the file header. Null on both
    // sides at once, so the two columns never differ in height.
    const showWins = seriesWins.us + seriesWins.them > 0

    return (
        <Card.Root
            variant="outline"
            rounded="xl"
            borderColor="border.emphasized"
            /* OPAQUE, not `bg.panel` — that token is 61 % translucent by
               design (system.ts), which is fine for a card the page scrolls
               PAST but wrong for this one: the card is pinned and the deal
               list scrolls underneath it, so rows were sliding visibly
               through the scores. `bg` is the same colour without the alpha. */
            bg="bg"
            shadow="card"
            position="relative"
            overflow="hidden"
        >
            {/* The two corners, and they are not interchangeable: sharing is a
                frequent, harmless action and sits LEFT, where a thumb reaching
                across a phone lands first; the menu — settings, deletes, the
                end of the evening — stays RIGHT, where it has always been. */}
            {share ? (
                <Box position="absolute" top="2" left="2" zIndex="1">
                    {share}
                </Box>
            ) : null}
            {menu ? (
                <Box position="absolute" top="2" right="2" zIndex="1">
                    {menu}
                </Box>
            ) : null}

            {/* Tightened 2026-09-08 (user: "napravi ovaj box malo kompaktniji"). The
                card is row one of a fixed-height column and every pixel here is
                one the deal list does not get, so the padding is the smallest
                that still lets the scores breathe. */}
            <Card.Body px={{ base: "3", md: "6" }} pt={{ base: "2", md: "4" }} pb={{ base: "1.5", md: "3" }}>
                <Text
                    fontSize="xs"
                    color="fg.subtle"
                    textAlign="center"
                    // Clear of both corner buttons: this line is centred in the
                    // card, and on a narrow phone "DO 1001 · PROLAZ · do 2
                    // dobivene igre" is long enough to run under them.
                    px="9"
                    mb={{ base: "2", md: "3" }}
                    css={{ fontVariantNumeric: "tabular-nums" }}
                >
                    {/* Rendered as parts rather than one joined string, because
                        the rule is now ALWAYS in here and on a 320 px phone
                        with long side names the line can need a second row. A
                        plain string would break wherever it ran out of width —
                        "DO" on one row and "1001" on the next, or a number
                        orphaned from its unit. Each part is `nowrap`, so the
                        only break opportunities are the spaces around the
                        middots: the line wraps between agreements, never
                        inside one. The separator is left in the accessibility
                        tree exactly as it was when this was one string. */}
                    {agreement.map((part, i) => (
                        <Fragment key={part}>
                            {i > 0 ? " · " : null}
                            <Box as="span" whiteSpace="nowrap">
                                {part}
                            </Box>
                        </Fragment>
                    ))}
                </Text>

                <HStack align="start" gap={{ base: "1", md: "4" }}>
                    {BLOK_SIDES.map((side, i) => (
                        <Fragment key={side}>
                            {i > 0 && (
                                <Box
                                    alignSelf="stretch"
                                    w="1px"
                                    bg="border.subtle"
                                    // Starts level with the middle of the big
                                    // totals, so it divides the score and not
                                    // the small series numbers above it — which
                                    // push everything down by about one line
                                    // when they are there.
                                    mt={showWins ? "12" : "7"}
                                    aria-hidden="true"
                                />
                            )}
                            <SideTotal
                                side={side}
                                name={names[side]}
                                total={totals[side]}
                                wins={showWins ? seriesWins[side] : null}
                                nameFontSize={nameFontSize}
                                onRename={onRename}
                            />
                        </Fragment>
                    ))}
                </HStack>

                {/* Directly under the line that divides the two scores, and on
                    that line's own axis — §5.4. A chevron rather than a labelled
                    button: it sits on a card whose every other pixel is score,
                    and "show/hide" is what a chevron already means. The label is
                    on the control, not beside it. */}
                {games ? (
                    <Box display="flex" justifyContent="center" mt="0">
                        <Box
                            as="button"
                            onClick={() => setGamesOpen(!gamesOpen)}
                            aria-expanded={gamesOpen}
                            aria-label={t(gamesOpen ? "blok.games.hide" : "blok.games.show")}
                            title={t(gamesOpen ? "blok.games.hide" : "blok.games.show")}
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                            // A wide, shallow target: it lives between the score
                            // and the deals, so height is the scarce axis and
                            // width is free.
                            w="7rem"
                            // Shallower than a tap target's 44px on purpose:
                            // it is a wide strip, easy to hit across, and the
                            // height it gives back goes to the deal list.
                            h="5"
                            rounded="l2"
                            color="fg.subtle"
                            _hover={{ bg: "bg.subtle", color: "fg.muted" }}
                            _focusVisible={{
                                outline: "2px solid",
                                outlineColor: "brand.focusRing",
                                outlineOffset: "1px",
                            }}
                        >
                            {gamesOpen ? <FiChevronUp size={18} /> : <FiChevronDown size={18} />}
                        </Box>
                    </Box>
                ) : null}

                {games && gamesOpen ? games : null}

                {strip}
            </Card.Body>
        </Card.Root>
    )
}
