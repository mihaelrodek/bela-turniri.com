import { Text } from "@chakra-ui/react"
import { keyframes } from "@emotion/react"
import type { TurnCountdown } from "../hooks/useTurnCountdown"
import { INK, INK_MUTED } from "./tableStyles"

/* ──────────────────────────────────────────────────────────────────────────
   TurnPill — the one line above the hand that says what the table is waiting
   for (game/DESIGN.md §2.6, §6).

   Plain text, no capsule (2026-09-18, user request: closer to the hand, no
   border, just the words). Three tones still carry the same distinction the
   pill used to carry with colour alone: "you" is the brand colour and bold,
   "call"/"other" are the ink colour, "idle" is muted.

   The clock itself is the capsule track above (`TurnProgressBar`), not
   this line (2026-10-08, owner: no seconds and no frame around the words);
   the words only turn red with it for the last seconds.
   ────────────────────────────────────────────────────────────────────── */

export type TurnTone = "you" | "call" | "other" | "idle"

/* Same blink as the clock's capsule above, so the two read as one alarm. */
const URGENT_BLINK = keyframes({
    "0%, 100%": { opacity: 1 },
    "50%": { opacity: 0.35 },
})

export default function TurnPill({
    tone,
    label,
    countdown = null,
    reducedMotion = false,
}: {
    tone: TurnTone
    label: string
    /** The running human turn clock; null when nothing is counting (a bot's
     *  think pause, a wait on the server) — then the words stand bare. */
    countdown?: TurnCountdown | null
    reducedMotion?: boolean
}) {
    const skin = {
        you: { color: "brand.fg", weight: "bold" as const },
        call: { color: INK, weight: "semibold" as const },
        other: { color: INK, weight: "medium" as const },
        idle: { color: INK_MUTED, weight: "medium" as const },
    }[tone]
    const counting = countdown !== null
    const urgent = countdown?.urgent ?? false

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
            color={urgent && counting ? "danger" : skin.color}
            textAlign="center"
            lineClamp={1}
            transition="color 150ms ease"
            animation={urgent && counting && !reducedMotion ? `${URGENT_BLINK} 0.8s ease-in-out infinite` : undefined}
            aria-live="polite"
        >
            {label}
        </Text>
    )
}
