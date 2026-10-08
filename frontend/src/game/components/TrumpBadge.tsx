import type { Ref } from "react"
import { Box, Text, VStack } from "@chakra-ui/react"
import { keyframes } from "@emotion/react"
import type { Suit } from "@bela/protocol"
import { useTranslation } from "../../i18n"
import { suitKey } from "../util/cards"
import SuitGlyph from "./SuitGlyph"
import { INK, type TeamSide } from "./tableStyles"

/* ──────────────────────────────────────────────────────────────────────────
   TrumpBadge — the middle cell of the scoreboard (game/DESIGN.md §1 "Stol").

   ONE object: the suit with the caller's name directly under it, inside the
   same dark cell. It used to be a square with the icon and then a separate
   muted "zove X" line floating under it, which read as two unrelated bits of
   chrome — and with the deal number stacked under that, the middle of the
   scoreboard was three competing captions instead of the one fact a player
   re-checks most often ("what is trump, and who has to make it").

   Before trump is called the same cell says what the table is doing instead
   ("Zvanje aduta"), so the middle column never sits empty and the scoreboard
   never changes width mid-deal.
   ────────────────────────────────────────────────────────────────────── */

/** How the suit mark in the cell is shown (2026-10-08, the trump flight):
 *  - `plain`  — just there (reduced motion, reconnects, no flight possible);
 *  - `hidden` — laid out but invisible, while the "X zove herc" overlay is
 *               up and its clone is on the way here (`TrumpFlight`);
 *  - `landed` — the clone has arrived: the mark pops in where it landed. */
export type TrumpGlyphState = "plain" | "hidden" | "landed"

/** The badge's mark size — the flight scales the overlay's mark down to it. */
export const TRUMP_BADGE_SUIT_SIZE = 28

/* Module-scope emotion keyframes — a nested "@keyframes" in Chakra's `css`
   prop does not run (game/DESIGN.md). Ends on the resting look, so a dead
   animation still leaves the mark readable. The overshoot is the same
   curve the trump overlay itself pops in with. */
const LAND_POP = keyframes({
    from: { transform: "scale(0.55)", opacity: 0.4 },
    "60%": { transform: "scale(1.14)", opacity: 1 },
    to: { transform: "scale(1)", opacity: 1 },
})
const LAND_POP_MS = 260

const CELL = {
    align: "center",
    justify: "center",
    rounded: "l2",
    bg: "transparent",
    border: "none",
    outline: "none",
    boxShadow: "none",
    minW: "66px",
    minH: "54px",
    px: "2",
    py: "1",
} as const

export default function TrumpBadge({
    trump,
    callerName,
    fallback,
    glyph = "plain",
    glyphRef,
}: {
    trump: Suit | null
    /** Who called it — omitted while nobody has. */
    callerName?: string | null
    /** Shown instead of the suit before trump is set. */
    fallback: string
    /** See `TrumpGlyphState`. */
    glyph?: TrumpGlyphState
    /** The mark's wrapper, measured by the page as the flight's landing
     *  spot. Rendered (and so measurable) even while `hidden`. */
    glyphRef?: Ref<HTMLDivElement>
    /** Which pair the caller plays for, so the cell can be bound to them in
     *  the table's two team colours (`TEAM`, DESIGN §6). Null before anyone
     *  has called, when the cell has no side to take. */
    callerTeam?: TeamSide | null
}) {
    const { t } = useTranslation()

    if (!trump) {
        // No border here (2026-09-20, user report: "zvanje aduta" read as an
        // odd pale outlined box floating between the scores). The trump-set
        // branch below already drops the border once a suit is called —
        // this just matches that from the start, so the header never gains
        // a box it then loses. `CELL`'s `minW`/`minH` are kept so the slot's
        // footprint is identical before and after the call and the header
        // doesn't jump when trump is set.
        // A silhouette of a fanned hand instead of the words "zvanje aduta"
        // (2026-10-08, owner): the cell will hold a suit mark in a moment,
        // so it already holds a picture — three card outlines in the muted
        // ink, the size the mark will be. The words stay for screen readers.
        return (
            <VStack {...CELL} gap="0" maxW="120px" role="img" aria-label={fallback} title={fallback}>
                {/* Brand green in both modes: `brand.fg` for the outlines,
                    `brand.subtle` for the faces — semantic tokens, so the
                    silhouette follows the colour mode like the rest of the
                    panel. */}
                <Box color="brand.fg" aria-hidden="true" display="flex">
                    <svg viewBox="0 0 40 30" width="40" height="30" fill="var(--chakra-colors-brand-subtle)" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
                        <rect x="4" y="7" width="14" height="20" rx="2" transform="rotate(-14 11 17)" />
                        <rect x="13" y="4" width="14" height="20" rx="2" />
                        <rect x="22" y="7" width="14" height="20" rx="2" transform="rotate(14 29 17)" />
                    </svg>
                </Box>
            </VStack>
        )
    }

    return (
        <VStack
            {...CELL}
            gap="0.5"
            maxW="120px"
            title={t(suitKey(trump))}
            aria-label={
                callerName
                    ? `${t("game.table.trumpSet", { suit: t(suitKey(trump)) })} · ${t("game.score.calledBy", { name: callerName })}`
                    : t("game.table.trumpSet", { suit: t(suitKey(trump)) })
            }
        >
            {/* 28 px: the suit is the single most re-checked fact on the
                table and it was drawn at caption size. `visibility`, not
                `display`: the slot keeps its box while the clone is in
                the air, so the page can measure where to land it and the
                cell never jumps when the mark appears. */}
            <Box
                ref={glyphRef}
                display="flex"
                alignItems="center"
                justifyContent="center"
                flexShrink={0}
                visibility={glyph === "hidden" ? "hidden" : "visible"}
                animation={glyph === "landed" ? `${LAND_POP} ${LAND_POP_MS}ms cubic-bezier(0.22, 1.2, 0.36, 1)` : undefined}
                transformOrigin="center"
            >
                <SuitGlyph suit={trump} size={TRUMP_BADGE_SUIT_SIZE} />
            </Box>
            {/* The name arrives WITH the mark (2026-10-08, owner): hidden
                while the clone is in the air, same pop when it lands — a
                caller named above an empty slot gave the flight away. */}
            {callerName && (
                <Text
                    fontSize="10px"
                    lineHeight="1.2"
                    fontWeight="bold"
                    color={INK}
                    lineClamp={1}
                    maxW="104px"
                    textAlign="center"
                    visibility={glyph === "hidden" ? "hidden" : "visible"}
                    animation={glyph === "landed" ? `${LAND_POP} ${LAND_POP_MS}ms cubic-bezier(0.22, 1.2, 0.36, 1)` : undefined}
                    transformOrigin="center"
                >
                    {callerName}
                </Text>
            )}
        </VStack>
    )
}
