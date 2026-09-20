import type { MouseEvent } from "react"
import { Box, chakra, HStack, Popover, Portal, SimpleGrid, Text, VStack } from "@chakra-ui/react"
import { FiShield } from "react-icons/fi"
import { KARMA_MAX } from "@bela/protocol"
import type { GameStatRecord, PlayerGameStats } from "@bela/protocol"
import { useTranslation } from "../../i18n"
import { KARMA_RECOVERY_GAMES, STAT_TARGET_SCORES, overallRecord, targetRecord, winPercent, type StatTargetScore } from "../util/gameStats"

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
            fontSize="2xs" lineHeight="shorter" fontVariantNumeric="tabular-nums" whiteSpace="nowrap" flexShrink={0}>
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
 *  (`game.karma.explain`, taken from the backend's `GameReliabilityService`
 *  rules). Its click never bubbles, so it is safe inside a clickable card. */
export function SeatKarmaPill({ karma }: { karma: number | null | undefined }) {
    const { t } = useTranslation()
    if (typeof karma !== "number" || !Number.isFinite(karma)) return null
    const value = Math.max(0, Math.min(KARMA_MAX, Math.round(karma)))
    const low = value < KARMA_MAX
    return (
        <Popover.Root positioning={{ placement: "bottom" }} lazyMount unmountOnExit>
            <Popover.Trigger asChild>
                <chakra.button type="button" px="2" py="0.5" rounded="full" bg={low ? "orange.subtle" : "bg.panel"}
                    color={low ? "orange.fg" : "fg.muted"} borderWidth="1px"
                    borderColor={low ? "orange.emphasized" : "border.emphasized"}
                    fontSize="2xs" lineHeight="shorter" fontVariantNumeric="tabular-nums" whiteSpace="nowrap" flexShrink={0}
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
                            <Text fontWeight="semibold" color="fg" mb="1">{t("game.room.karma", { value, max: KARMA_MAX })}</Text>
                            {t("game.karma.explain", { max: KARMA_MAX, recovery: KARMA_RECOVERY_GAMES })}
                        </Popover.Body>
                    </Popover.Content>
                </Popover.Positioner>
            </Portal>
        </Popover.Root>
    )
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
            <Text fontSize="2xs" fontWeight="semibold" lineHeight="shorter" fontVariantNumeric="tabular-nums" truncate w="full" textAlign="center">
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

/** The signed-in player's own record: overall total plus one tile per
 *  discipline (163/501/701/1001), same numbers and rounding RoomPanel's seat
 *  pill uses. Renders nothing for a guest or anyone with no persisted record
 *  yet (`gameStats` absent) — a row of "0–0 · 0%" tiles would just be noise
 *  for a player who has never finished a game; the guest hint line right
 *  below already tells them how to start one.
 *
 *  Two variants, one component, so a guest/no-stats render (`null`) and the
 *  5-tile content stay in exactly one place (2026-09-20, user request: put
 *  the tiles in the header row on md+ where there is room beside the
 *  avatar/name, keep the phone layout as its own row underneath):
 *   - `"grid"` (default): a 5-column grid that fills its container, up to
 *     340/420px — the phone header's own row.
 *   - `"row"`: five fixed-width (~112px) tiles side by side, meant to sit
 *     inline between the profile name and the settings gear on md+. The
 *     caller is responsible for hiding whichever variant does not apply at
 *     the current breakpoint (see `GameLobbyPage`), so exactly one renders
 *     at a time — never both, and never a layout shift when `stats` is
 *     absent, since both instances return `null` identically. */
export function MyGameStatsPills({ stats, variant = "grid" }: {
    stats: PlayerGameStats | null | undefined
    variant?: "grid" | "row"
}) {
    const { t } = useTranslation()
    if (!stats) return null
    const overallLabel = t("game.room.statsTitle")
    if (variant === "row") {
        return (
            <HStack gap="1.5" flexShrink={0}>
                <StatTile label={overallLabel} record={overallRecord(stats)} w="112px" />
                {STAT_TARGET_SCORES.map((target) => (
                    <StatTile key={target} label={discLabel(t, target)} record={targetRecord(stats, target)} w="112px" />
                ))}
            </HStack>
        )
    }
    return (
        <SimpleGrid columns={STAT_TARGET_SCORES.length + 1} gap="1.5" w="full" maxW={{ base: "340px", md: "420px" }}>
            <StatTile label={overallLabel} record={overallRecord(stats)} />
            {STAT_TARGET_SCORES.map((target) => (
                <StatTile key={target} label={discLabel(t, target)} record={targetRecord(stats, target)} />
            ))}
        </SimpleGrid>
    )
}
