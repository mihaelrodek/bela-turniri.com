import { Text, VStack } from "@chakra-ui/react"
import type { Suit } from "@bela/protocol"
import { useTranslation } from "../../i18n"
import { suitKey } from "../util/cards"
import SuitGlyph from "./SuitGlyph"
import { INK, INK_MUTED, type TeamSide } from "./tableStyles"

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

const CELL = {
    align: "center",
    justify: "center",
    rounded: "l2",
    bg: "transparent",
    borderWidth: "1px",
    borderColor: "border",
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
}: {
    trump: Suit | null
    /** Who called it — omitted while nobody has. */
    callerName?: string | null
    /** Shown instead of the suit before trump is set. */
    fallback: string
    /** Which pair the caller plays for, so the cell can be bound to them in
     *  the table's two team colours (`TEAM`, DESIGN §6). Null before anyone
     *  has called, when the cell has no side to take. */
    callerTeam?: TeamSide | null
}) {
    const { t } = useTranslation()

    if (!trump) {
        return (
            <VStack {...CELL} borderColor="border.subtle" gap="0" maxW="120px">
                <Text
                    fontSize="2xs"
                    color={INK_MUTED}
                    textAlign="center"
                    textTransform="uppercase"
                    letterSpacing="wider"
                    lineHeight="1.2"
                    lineClamp={2}
                >
                    {fallback}
                </Text>
            </VStack>
        )
    }

    return (
        <VStack
            {...CELL}
            borderWidth="0"
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
                table and it was drawn at caption size. */}
            <SuitGlyph suit={trump} size={28} />
            {callerName && (
                <Text
                    fontSize="10px"
                    lineHeight="1.2"
                    fontWeight="bold"
                    color={INK}
                    lineClamp={1}
                    maxW="104px"
                    textAlign="center"
                >
                    {callerName}
                </Text>
            )}
        </VStack>
    )
}
