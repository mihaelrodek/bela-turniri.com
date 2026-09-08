import { Text, VStack } from "@chakra-ui/react"
import type { Suit } from "@bela/protocol"
import { useTranslation } from "../../i18n"
import { suitKey } from "../util/cards"
import SuitGlyph from "./SuitGlyph"
import { INK, INK_MUTED } from "./tableStyles"

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
    bg: "brand.950/85",
    borderWidth: "1px",
    borderColor: "brand.500",
    boxShadow: "0 0 16px rgba(0,0,0,0.4)",
    minW: "62px",
    minH: "46px",
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
}) {
    const { t } = useTranslation()

    if (!trump) {
        return (
            <VStack {...CELL} borderColor="brand.700/70" gap="0" maxW="120px">
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
            gap="0.5"
            maxW="120px"
            title={t(suitKey(trump))}
            aria-label={
                callerName
                    ? `${t("game.table.trumpSet", { suit: t(suitKey(trump)) })} · ${t("game.score.calledBy", { name: callerName })}`
                    : t("game.table.trumpSet", { suit: t(suitKey(trump)) })
            }
        >
            <SuitGlyph suit={trump} size={22} />
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
