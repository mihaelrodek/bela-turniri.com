import { Flex, Text, VStack } from "@chakra-ui/react"
import type { Suit } from "@bela/protocol"
import { useTranslation } from "../../i18n"
import { suitKey } from "../util/cards"
import SuitGlyph from "./SuitGlyph"
import { INK_MUTED } from "./tableStyles"

/* ──────────────────────────────────────────────────────────────────────────
   TrumpBadge — the middle of the scoreboard (game/DESIGN.md §1 "Stol").

   Once trump is called it is a dark square with the suit and the caller's
   name under it: the two facts a player re-checks most often during a deal,
   parked in the one place they never have to look for. Before that it says
   what the table is doing instead ("Zvanje aduta"), so the middle column
   never sits empty and the scoreboard never changes width.
   ────────────────────────────────────────────────────────────────────── */

export default function TrumpBadge({
    trump,
    callerName,
    fallback,
}: {
    trump: Suit | null
    /** Who called it — omitted while nobody has. */
    callerName?: string | null
    /** Shown instead of the square before trump is set. */
    fallback: string
}) {
    const { t } = useTranslation()

    if (!trump) {
        return (
            <Text
                fontSize="2xs"
                color={INK_MUTED}
                textAlign="center"
                textTransform="uppercase"
                letterSpacing="wider"
                lineClamp={2}
                maxW="112px"
            >
                {fallback}
            </Text>
        )
    }

    return (
        <VStack gap="0.5" align="center" maxW="120px">
            <Flex
                align="center"
                justify="center"
                w="38px"
                h="38px"
                rounded="l2"
                bg="brand.950/85"
                borderWidth="1px"
                borderColor="brand.500"
                boxShadow="0 0 16px rgba(0,0,0,0.4)"
                title={t(suitKey(trump))}
                aria-label={t("game.table.trumpSet", { suit: t(suitKey(trump)) })}
            >
                <SuitGlyph suit={trump} size={24} />
            </Flex>
            {callerName && (
                <Text fontSize="2xs" color={INK_MUTED} lineClamp={1} maxW="112px" textAlign="center">
                    {t("game.score.calledBy", { name: callerName })}
                </Text>
            )}
        </VStack>
    )
}
