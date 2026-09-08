import { useId, useState } from "react"
import { Box, Grid, HStack, Text, VStack } from "@chakra-ui/react"
import { FiChevronDown, FiChevronRight } from "react-icons/fi"
import { scoreManualDeal } from "@bela/engine"
import DealScoreCell from "../blok/components/DealScoreCell"
import SuitGlyph from "../game/components/SuitGlyph"
import { suitKey } from "../game/util/cards"
import { useTranslation } from "../i18n"

/* ──────────────────────────────────────────────────────────────────────────
   Shared "games + deals" presentation for a Bela blok session — every game
   in order, and inside each game every deal: who called, both sides' points,
   summed declarations, running totals and the trump.

   Used by BOTH the public share page (`pages/SharedBlokPage.tsx`,
   BLOK-HISTORY.md §5.2) and the owner's private history
   (`pages/profile/BlokHistoryCard.tsx`, §4), which is why it lives in a
   neutral location and reads the stable `blok.*` domain keys directly
   (`blok.entry.*`, `blok.games.*`, `game.suit.*`) rather than taking a dozen
   label props.

   Types here are structural, not imported from `api/blokHistory.ts` or
   `api/blokShare.ts` on purpose: both call sites already have a DTO in
   exactly this shape, and this component only needs the shape, not a
   dependency on either owner-specific module. Extra DTO fields (e.g.
   `gameEndRule`, rendered by the callers in their own meta line) pass
   through structurally and are simply not read here.

   ── Three deliberate presentation decisions (2026-09-08, from the user's
      screenshot of a real shared series) ──────────────────────────────────

   1. OPAQUE, not glass. `bg.panel` is a 61%-translucent token by design
      (see `system.ts`), so a card painted with it lets the app's canvas —
      including its playing-card illustration — read straight through a
      dense table of numbers. Every surface here is therefore an OPAQUE
      semantic token: `bg.subtle` for the game body, `bg.muted` for its
      header band, hairlines in `border.subtle`. Both are real ladder steps
      in light and dark, so this needs no hand-mixed alpha and no
      per-theme special case.

   2. THE FIGURES WIN. A deal row is scanned for two numbers; everything
      else on it (summed zvanja and the caller mark) is context for those
      numbers, not a peer of them. So the points
      are `xl`/bold in tabular numerals and the supporting text drops to
      `2xs` in `fg.muted`/`fg.subtle`. Same idea one level up: the game
      header pairs the running series score ("1 : 0") with that game's total
      in loud tabular figures.

   3. GAMES COLLAPSE. A 7-game series is a wall of deals. Each game is a
      real `<button>` header (keyboard-reachable, `aria-expanded`,
      `aria-controls`) toggling its deals. DEFAULT: a single-game series
      opens EXPANDED, anything longer opens COLLAPSED — so a long series
      starts as a readable summary of results and the reader chooses which
      game to open. The panel stays mounted and is hidden with `display`,
      so `aria-controls` always resolves to a real element.
   ────────────────────────────────────────────────────────────────────── */

export type BlokGamesListSide = "us" | "them"
export type BlokGamesListTrump = "HERC" | "KARA" | "PIK" | "TREF"

export interface BlokGamesListRound {
    caller: BlokGamesListSide
    cards: { us: number; them: number }
    declarations: { us: number[]; them: number[] }
    stiglja: BlokGamesListSide | null
    /**
     * The side that showed a belot, or null (BLOK.md §1.2). OPTIONAL because
     * it rides inside the record's existing `payload` (BLOK-HISTORY.md §2.3,
     * stored as opaque `jsonb`) and every session filed before the field
     * existed simply has no such key — absent means "no belot", and no
     * backend migration is involved either way.
     */
    belot?: BlokGamesListSide | null
    trump: BlokGamesListTrump | null
}

export interface BlokGamesListGame {
    id: string
    /** The game's points target — a belot deal is worth exactly that many
     *  points, so a record cannot be re-scored without it. Present on both
     *  callers' DTOs already (`api/blokHistory.ts`, `api/blokShare.ts`). */
    target: number
    winner: BlokGamesListSide | null
    totals: { us: number; them: number }
    rounds: BlokGamesListRound[]
}

/** `scoreManualDeal`, but a deal that cannot be scored (corrupt/legacy data)
 *  degrades to a zero row instead of throwing mid-render. */
function safeRoundOutcome(
    round: BlokGamesListRound,
    target: number,
): { total: { us: number; them: number }; fell: boolean } {
    try {
        return scoreManualDeal({
            caller: round.caller,
            cards: round.cards,
            declarations: round.declarations,
            stiglja: round.stiglja,
            belot: round.belot ?? null,
            target,
        })
    } catch {
        return { total: { us: 0, them: 0 }, fell: false }
    }
}

function declarationTotal(values: number[] | undefined): number {
    return (values ?? []).reduce((sum, value) => sum + value, 0)
}

export function BlokGamesList({
    games,
    nameUs,
    nameThem,
}: {
    games: BlokGamesListGame[]
    nameUs: string
    nameThem: string
}) {
    const { t } = useTranslation()
    const baseId = useId()

    /* Default open state, decided once per mounted series (see (3) above).
       A series is a fixed record — it never grows while on screen — so the
       initialiser is the whole story; the callers key this component by the
       record's identity when they can show more than one. */
    const [openIds, setOpenIds] = useState<Record<string, boolean>>(
        () => (games.length === 1 ? { [games[0].id]: true } : {}),
    )
    let winsUs = 0
    let winsThem = 0
    const seriesScores = games.map((game) => {
        if (game.winner === "us") winsUs += 1
        if (game.winner === "them") winsThem += 1
        return { us: winsUs, them: winsThem }
    })

    return (
        <VStack align="stretch" gap="3">
            {games.map((g, gi) => {
                const open = openIds[g.id] ?? false
                const panelId = `${baseId}-blok-game-${gi}`
                const outcomes = g.rounds.map((round) => safeRoundOutcome(round, g.target))
                let runningUs = 0
                let runningThem = 0
                const rows = g.rounds.map((round, index) => {
                    const total = outcomes[index].total
                    runningUs += total.us
                    runningThem += total.them
                    return { round, total, runningTotal: { us: runningUs, them: runningThem } }
                })
                return (
                    <Box
                        key={g.id}
                        borderWidth="1px"
                        borderColor="border.subtle"
                        rounded="lg"
                        overflow="hidden"
                        bg="bg.subtle"
                    >
                        <Box
                            as="button"
                            w="full"
                            textAlign="start"
                            aria-expanded={open}
                            aria-controls={panelId}
                            title={t(open ? "blok.games.hideDeals" : "blok.games.showDeals")}
                            onClick={() => setOpenIds((prev) => ({ ...prev, [g.id]: !open }))}
                            bg="bg.muted"
                            px="3"
                            py="2.5"
                            borderBottomWidth={open ? "1px" : "0"}
                            borderColor="border.subtle"
                            _hover={{ bg: "bg.emphasized" }}
                            _focusVisible={{
                                outline: "2px solid",
                                outlineColor: "brand.focusRing",
                                outlineOffset: "-2px",
                            }}
                        >
                            {/* ONE COLUMN PER SIDE, in the same order and the
                                same places as the deals below and the header
                                above: the game's points as the figure, the
                                SERIES standing after that game small under it.
                                It used to read "1 : 0 … 1149 : 543" — two
                                score pairs in different units sharing a line,
                                with nothing to say which was which. */}
                            <HStack gap="2" minW="0" align="center">
                                <Box color="fg.subtle" flexShrink="0" display="flex" aria-hidden="true">
                                    {open ? <FiChevronDown size={16} /> : <FiChevronRight size={16} />}
                                </Box>
                                <Grid templateColumns="1fr 1fr" gap="2" flex="1" minW="0">
                                    {(["us", "them"] as const).map((side) => (
                                        <Box key={side} textAlign="center" minW="0">
                                            <Text
                                                fontSize="lg"
                                                fontWeight="bold"
                                                color="fg.ink"
                                                lineHeight="1.15"
                                                css={{ fontVariantNumeric: "tabular-nums" }}
                                            >
                                                {g.totals[side]}
                                            </Text>
                                            <Text
                                                fontSize="2xs"
                                                fontWeight="bold"
                                                color={side === "us" ? "brand.fg" : "fg.muted"}
                                                lineHeight="1.2"
                                                css={{ fontVariantNumeric: "tabular-nums" }}
                                            >
                                                {seriesScores[gi][side]}
                                            </Text>
                                        </Box>
                                    ))}
                                </Grid>
                            </HStack>
                        </Box>
                        <VStack
                            id={panelId}
                            align="stretch"
                            gap="0"
                            display={open ? "flex" : "none"}
                        >
                            <Grid
                                templateColumns="1fr 2.5rem 1fr"
                                gap="2"
                                px="3"
                                py="1.5"
                                borderBottomWidth="1px"
                                borderColor="border.subtle"
                                bg="bg.muted"
                            >
                                <Text gridColumn="1" textAlign="center" fontSize="2xs" fontWeight="bold" textTransform="uppercase" letterSpacing="0.06em" color="fg.subtle" truncate>
                                    {nameUs}
                                </Text>
                                <Text gridColumn="3" textAlign="center" fontSize="2xs" fontWeight="bold" textTransform="uppercase" letterSpacing="0.06em" color="fg.subtle" truncate>
                                    {nameThem}
                                </Text>
                            </Grid>

                            {rows.map(({ round, total, runningTotal }, index) => (
                                <Grid
                                    key={index}
                                    templateColumns="1fr 2.5rem 1fr"
                                    alignItems="center"
                                    px="3"
                                    py="2"
                                    borderBottomWidth={index < rows.length - 1 ? "1px" : "0"}
                                    borderColor="border.subtle"
                                    gap="2"
                                >
                                    <DealScoreCell
                                        side="us"
                                        name={nameUs}
                                        points={total.us}
                                        runningTotal={runningTotal.us}
                                        called={round.caller === "us"}
                                        declarations={declarationTotal(round.declarations.us)}
                                        belot={round.belot === "us"}
                                        compact
                                    />
                                    <Box
                                        gridColumn="2"
                                        display="flex"
                                        alignItems="center"
                                        justifyContent="center"
                                        minW="6"
                                        {...(round.trump
                                            ? { role: "img" as const, "aria-label": t(suitKey(round.trump)), title: t(suitKey(round.trump)) }
                                            : { "aria-hidden": "true" as const })}
                                    >
                                        {round.trump ? (
                                            <SuitGlyph suit={round.trump} size={18} />
                                        ) : (
                                            <Box boxSize="1" rounded="full" bg="border.strong" />
                                        )}
                                    </Box>
                                    <DealScoreCell
                                        side="them"
                                        name={nameThem}
                                        points={total.them}
                                        runningTotal={runningTotal.them}
                                        called={round.caller === "them"}
                                        declarations={declarationTotal(round.declarations.them)}
                                        belot={round.belot === "them"}
                                        compact
                                    />
                                </Grid>
                            ))}
                        </VStack>
                    </Box>
                )
            })}
        </VStack>
    )
}
