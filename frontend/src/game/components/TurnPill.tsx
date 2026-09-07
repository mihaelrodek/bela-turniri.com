import { Flex, Text } from "@chakra-ui/react"
import { INK, INK_MUTED } from "./tableStyles"

/* ──────────────────────────────────────────────────────────────────────────
   TurnPill — the one line above the hand that says what the table is waiting
   for (game/DESIGN.md §2.6).

   Three tones, and the difference between them is the whole point: "you"
   is a solid light pill you cannot miss with the phone at arm's length,
   "other" is quiet dark glass, "call" sits in between because somebody
   deciding trump is worth a glance but is not your move.
   ────────────────────────────────────────────────────────────────────── */

export type TurnTone = "you" | "call" | "other" | "idle"

export default function TurnPill({ tone, label }: { tone: TurnTone; label: string }) {
    const skin = {
        you: { bg: "brand.300", color: "brand.950", border: "brand.300", weight: "bold" as const },
        call: { bg: "brand.700/80", color: INK, border: "brand.500", weight: "semibold" as const },
        other: { bg: "brand.950/62", color: INK, border: "brand.700/70", weight: "medium" as const },
        idle: { bg: "brand.950/62", color: INK_MUTED, border: "brand.700/70", weight: "medium" as const },
    }[tone]

    return (
        <Flex
            align="center"
            justify="center"
            px="3"
            py="1"
            rounded="full"
            bg={skin.bg}
            color={skin.color}
            borderWidth="1px"
            borderColor={skin.border}
            backdropFilter="blur(8px)"
            boxShadow={tone === "you" ? "0 0 20px rgba(127,196,150,0.35)" : undefined}
            transition="background 0.2s ease, color 0.2s ease"
            maxW="100%"
            aria-live="polite"
        >
            <Text fontSize="xs" fontWeight={skin.weight} lineClamp={1}>
                {label}
            </Text>
        </Flex>
    )
}
