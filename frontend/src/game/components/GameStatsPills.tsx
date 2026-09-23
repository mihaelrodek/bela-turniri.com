import type { MouseEvent } from "react"
import { Box, chakra, HStack, Popover, Portal, SimpleGrid, Text, VStack } from "@chakra-ui/react"
import { FiShield } from "react-icons/fi"
import { KARMA_MAX } from "@bela/protocol"
import type { GameStatRecord, PlayerGameStats, PlayerReliability } from "@bela/protocol"
import { useTranslation, usePlural } from "../../i18n"
import { STAT_TARGET_SCORES, overallRecord, targetRecord, winPercent, type StatTargetScore } from "../util/gameStats"

/* ──────────────────────────────────────────────────────────────────────────
   Shared stat-pill formatting (2026-09-20, user request) — RoomPanel's seat
   rows and the lobby's own-profile header both read `UserInfo.gameStats`,
   and used to format it twice, slightly differently. One source now: a
   "18–13 · 58%" chip (`StatChip`), a standalone version of it for a seat row
   (`SeatStatPill`), and the lobby's own 4-up overall+discipline grid
   (`MyGameStatsPills`). Components only in this file — non-component
   helpers live in `../util/gameStats.ts` (react-refresh/only-export-
   components).
   ────────────────────────────────────────────────────────────────────── */

function StatChip({ record }: { record: GameStatRecord }) {
    return (
        <>{record.wins}–{record.losses} · {winPercent(record)}%</>
    )
}

/** A seated human's overall record, and nothing else — RoomPanel dropped the
 *  per-discipline second pill and the "Sve" caption (2026-09-20, user
 *  request): the discipline being played is already the room's own target
 *  score, so a second number just repeated the first with a smaller sample. */
export function SeatStatPill({ stats }: { stats: PlayerGameStats }) {
    return (
        <Box px="2" py="0.5" rounded="full" bg="bg.panel" color="fg.muted" borderWidth="1px" borderColor="border.emphasized"
            fontSize="2xs" fontFamily="mono" lineHeight="shorter" fontVariantNumeric="tabular-nums" whiteSpace="nowrap" flexShrink={0}>
            <StatChip record={overallRecord(stats)} />
        </Box>
    )
}

/** A player's reliability, as a "9/10" chip (2026-09-20, user request: karma
 *  has to be readable at the moment you sit down with someone, not only in
 *  your own profile). Renders nothing when the server sent no karma — bots,
 *  dev users and guests with no profile row — because a default "10/10" on a
 *  seat that has no record would be a claim the server never made. Full karma
 *  is muted; anything below it is warned in orange, which is the only state
 *  worth a glance.
 *
 *  The chip is a button: a tap opens a small popover saying what karma is
 *  made of. `reliability` (2026-09-21 karma redesign, `PlayerReliability`) is
 *  optional and separate from `karma` on purpose — an older server sends the
 *  bare number and nothing else, so the popover falls back to JUST the
 *  explanation rather than rendering an "X od Y" line it cannot back up.
 *  When present, the trail is shown, not erased: a rolling-window line
 *  ("napustio X od Y partija u zadnjih Z dana", or a friendlier zero-abandon
 *  sentence) plus the lifetime abandon count, then the explanation. Its click
 *  never bubbles, so it is safe inside a clickable card. */
export function SeatKarmaPill({ karma, reliability }: {
    karma: number | null | undefined
    reliability?: PlayerReliability | null
}) {
    const { t } = useTranslation()
    const plural = usePlural()
    if (typeof karma !== "number" || !Number.isFinite(karma)) return null
    const value = Math.max(0, Math.min(KARMA_MAX, Math.round(karma)))
    const tier = karmaTier(value)
    const tone = KARMA_TONES[tier]
    // Pre-composed, already-declined phrases — passed as PLAIN STRING params
    // into the sentence keys below, never a bare {n} dropped into a fixed
    // noun (KARMA-CONTRACT.md). `total` is recentAbandons + recentGames, the
    // denominator the popup shows ("X od Y").
    const total = reliability ? reliability.recentAbandons + reliability.recentGames : 0
    const windowPhrase = reliability ? plural("game.karma.lastDays", reliability.windowDays) : ""
    const durationPhrase = reliability ? plural("game.karma.daysDuration", reliability.windowDays) : ""
    return (
        <Popover.Root positioning={{ placement: "bottom" }} lazyMount unmountOnExit>
            <Popover.Trigger asChild>
                <chakra.button type="button" px="2" py="0.5" rounded="full" bg={tone.bg}
                    color={tone.fg} borderWidth="1px"
                    borderColor={tone.border}
                    fontSize="2xs" fontFamily="mono" lineHeight="shorter" fontVariantNumeric="tabular-nums" whiteSpace="nowrap" flexShrink={0}
                    cursor="pointer" aria-label={t("game.room.karma", { value, max: KARMA_MAX })}
                    onClick={(e: MouseEvent) => e.stopPropagation()}>
                    <HStack gap="1" align="center">
                        <FiShield size={10} aria-hidden />
                        <span>{value}/{KARMA_MAX}</span>
                    </HStack>
                </chakra.button>
            </Popover.Trigger>
            <Portal>
                <Popover.Positioner>
                    <Popover.Content maxW="280px">
                        <Popover.Arrow><Popover.ArrowTip /></Popover.Arrow>
                        <Popover.Body fontSize="sm" color="fg.soft">
                            <VStack align="stretch" gap="1.5">
                                <HStack gap="2" align="center">
                                    <Text fontWeight="semibold" color="fg">{t("game.room.karma", { value, max: KARMA_MAX })}</Text>
                                    <Text fontSize="xs" fontWeight="semibold" px="1.5" rounded="full" bg={tone.bg} color={tone.fg} borderWidth="1px" borderColor={tone.border}>
                                        {t(`game.karma.tier.${tier}`)}
                                    </Text>
                                </HStack>
                                <Text>{t(`game.karma.tierHint.${tier}`)}</Text>
                                {reliability && (
                                    <Text>
                                        {reliability.recentAbandons > 0
                                            ? t("game.karma.abandonedLine", {
                                                abandoned: reliability.recentAbandons,
                                                games: plural("game.karma.gamesOf", total),
                                                window: windowPhrase,
                                            })
                                            : t("game.karma.noAbandonsLine", { window: windowPhrase })}
                                    </Text>
                                )}
                                {reliability && (
                                    <Text>{t("game.karma.totalAbandonsLine", { count: reliability.totalAbandons })}</Text>
                                )}
                                <Text>{t("game.karma.explain", { max: KARMA_MAX, window: durationPhrase || plural("game.karma.daysDuration", 30) })}</Text>
                            </VStack>
                        </Popover.Body>
                    </Popover.Content>
                </Popover.Positioner>
            </Portal>
        </Popover.Root>
    )
}

/* ── Karma tiers (2026-09-23, user request) ──────────────────────────────
   The number alone said little at a glance; three colours do. 8–10 is what
   nearly everybody sits at (green), 5–7 means the person has walked out on a
   few tables lately (yellow), 0–4 is somebody your partner cannot count on
   (red). The thresholds are a product call, not a statistic — change them
   here and in the hr/sl/en `karma.tier*` texts together. Tokens only:
   `ok` (teal, success), `gold` (warning), `danger`/`red` (error). */
type KarmaTier = "good" | "fair" | "poor"

function karmaTier(value: number): KarmaTier {
    if (value >= 8) return "good"
    if (value >= 5) return "fair"
    return "poor"
}

const KARMA_TONES: Record<KarmaTier, { bg: string; fg: string; border: string }> = {
    good: { bg: "ok.subtle", fg: "ok", border: "ok" },
    fair: { bg: "gold.subtle", fg: "yellow.fg", border: "yellow.emphasized" },
    poor: { bg: "red.subtle", fg: "red.fg", border: "red.emphasized" },
}

/** `w` is only ever passed by the `"row"` variant below — the `"grid"`
 *  variant relies on `SimpleGrid` to divide its own width evenly, a fixed
 *  tile width there would just leave a gap or overflow at 340px.
 *
 *  `truncate` rather than a bare `whiteSpace="nowrap"` (2026-09-20, "Brza
 *  163" discipline): a fifth tile in the same grid width leaves each column
 *  narrower, and un-clipped nowrap text would bleed into its neighbour
 *  instead of just clipping — the one thing that would actually overflow
 *  the pill row on a 360px phone. */
function StatTile({ label, record, w }: { label: string; record: GameStatRecord; w?: string }) {
    return (
        <VStack gap="0" px="1" py="1" rounded="lg" bg="bg.subtle" borderWidth="1px" borderColor="border.subtle" minW="0" w={w} flexShrink={0}>
            <Text fontSize="2xs" color="fg.muted" fontWeight="semibold" lineHeight="shorter" truncate w="full" textAlign="center">{label}</Text>
            <Text fontSize="2xs" fontFamily="mono" fontWeight="semibold" lineHeight="shorter" fontVariantNumeric="tabular-nums" truncate w="full" textAlign="center">
                <StatChip record={record} />
            </Text>
        </VStack>
    )
}

/** The bare number reads fine as a discipline label for 501/701/1001, but
 *  "163" alone would not say "quick game" — it gets the short
 *  `game.stats.quickLabel` word instead (pills are tight, no room for the
 *  full "Brza 163" name used elsewhere). */
function discLabel(t: (key: string) => string, target: StatTargetScore): string {
    return target === "163" ? t("game.stats.quickLabel") : target
}

/** The signed-in player's own record: displays a single clickable "Ukupno"
 *  overall tile that opens a popover with the full breakdown (overall plus
 *  one tile per discipline: 163/501/701/1001). Renders nothing for a guest or
 *  anyone with no persisted record yet (`gameStats` absent or zero finished
 *  games) — the guest hint line right below already tells them how to start
 *  one (2026-09-21, owner request: five "0–0 · 0%" tiles were noise; only
 *  Ukupno shown, rest on click).
 *
 *  Two variants accept the same props but render identically: both display one
 *  tile; the variant exists only so the component signature stays compatible:
 *   - `"grid"` (default): 112px fixed width for consistency
 *   - `"row"`: 112px fixed width for consistency. The caller may hide/show
 *     variants at different breakpoints (see `GameLobbyPage`), so both return
 *     `null` identically when `stats` is absent or games is zero. */
export function MyGameStatsPills({ stats }: {
    stats: PlayerGameStats | null | undefined
    /** Kept so existing callers compile; both variants are the one tile now. */
    variant?: "grid" | "row"
}) {
    const { t } = useTranslation()
    if (!stats) return null
    const overall = overallRecord(stats)
    if (overall.games === 0) return null
    const overallLabel = t("game.room.statsTitle")
    return (
        <Popover.Root positioning={{ placement: "bottom" }} lazyMount unmountOnExit>
            <Popover.Trigger asChild>
                <chakra.button type="button" w="112px" cursor="pointer" aria-label={overallLabel} aria-haspopup="dialog">
                    <StatTile label={overallLabel} record={overall} w="112px" />
                </chakra.button>
            </Popover.Trigger>
            <Portal>
                <Popover.Positioner>
                    <Popover.Content>
                        <Popover.Arrow><Popover.ArrowTip /></Popover.Arrow>
                        <Popover.Body p="3">
                            <SimpleGrid columns={3} gap="1.5" w="full">
                                <StatTile label={overallLabel} record={overall} />
                                {STAT_TARGET_SCORES.map((target) => (
                                    <StatTile key={target} label={discLabel(t, target)} record={targetRecord(stats, target)} />
                                ))}
                            </SimpleGrid>
                        </Popover.Body>
                    </Popover.Content>
                </Popover.Positioner>
            </Portal>
        </Popover.Root>
    )
}
