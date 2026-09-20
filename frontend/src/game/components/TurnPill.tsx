import { Text } from "@chakra-ui/react"
import { INK, INK_MUTED } from "./tableStyles"

/* ──────────────────────────────────────────────────────────────────────────
   TurnPill — the one line above the hand that says what the table is waiting
   for (game/DESIGN.md §2.6, §6).

   Plain text now, no capsule (2026-09-18, user request: closer to the hand,
   no border, just the words). Three tones still carry the same distinction
   the pill used to carry with colour alone: "you" is the brand colour and
   bold, "call"/"other" are the ink colour, "idle" is muted.
   ────────────────────────────────────────────────────────────────────── */

export type TurnTone = "you" | "call" | "other" | "idle"

export default function TurnPill({
    tone,
    label,
}: {
    tone: TurnTone
    label: string
}) {
    const skin = {
        you: { color: "brand.fg", weight: "bold" as const },
        call: { color: INK, weight: "semibold" as const },
        other: { color: INK, weight: "medium" as const },
        idle: { color: INK_MUTED, weight: "medium" as const },
    }[tone]

    return (
        <Text
            fontSize="sm"
            // Fixed line-height and height (2026-09-20, user report): the
            // tones differ only in weight/colour, but weight alone can move
            // a font's own line metrics a hair, and this line sits directly
            // above the hand — any wobble there moves the hand too. Pinning
            // both means "Tvoj potez" ↔ "Bot Lucija je na potezu" swap the
            // words, never the row's height.
            lineHeight="20px"
            h="20px"
            fontWeight={skin.weight}
            color={skin.color}
            textAlign="center"
            lineClamp={1}
            aria-live="polite"
        >
            {label}
        </Text>
    )
}
