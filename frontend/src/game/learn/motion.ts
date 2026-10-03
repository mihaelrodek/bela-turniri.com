import { keyframes } from "@emotion/react"
import { useGamePrefs } from "../hooks/useGamePrefs"
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion"

/* ──────────────────────────────────────────────────────────────────────────
   Tutorial motion (2026-09-29) — every animation of the lessons and the
   practice table, in one place.

   MODULE-LEVEL emotion `keyframes`, like `Hand.tsx` and `Seat.tsx`: a nested
   "@keyframes" inside Chakra's `css` prop does not run (game/DESIGN.md).
   Each one ENDS on the element's resting style, so dropping the animation —
   reduced motion, or the node simply re-rendering — never leaves a card
   displaced.
   ────────────────────────────────────────────────────────────────────── */

/** A right answer: a small pop. */
export const POP = keyframes({
    "0%": { transform: "scale(1)" },
    "40%": { transform: "scale(1.12)" },
    "100%": { transform: "scale(1)" },
})

/** A wrong answer: a short sideways shake — a "no", not an alarm. */
export const SHAKE = keyframes({
    "0%, 100%": { transform: "translateX(0)" },
    "20%": { transform: "translateX(-6px)" },
    "40%": { transform: "translateX(6px)" },
    "60%": { transform: "translateX(-4px)" },
    "80%": { transform: "translateX(4px)" },
})

/** The trump jack and nine jumping to the front of the row. */
export const JUMP = keyframes({
    "0%": { transform: "translateY(0) scale(1)" },
    "35%": { transform: "translateY(-26px) scale(1.08)" },
    "70%": { transform: "translateY(-10px) scale(1.04)" },
    "100%": { transform: "translateY(0) scale(1)" },
})

/** A mark, a label or a feedback line arriving. */
export const RISE = keyframes({
    from: { opacity: 0, transform: "translateY(6px)" },
    to: { opacity: 1, transform: "translateY(0)" },
})

/** The coach's suggested card: a slow gold breath around it. */
export const HINT_GLOW = keyframes({
    "0%, 100%": { boxShadow: "0 0 0 2px var(--chakra-colors-gold), 0 0 0 0 transparent" },
    "50%": {
        boxShadow:
            "0 0 0 2px var(--chakra-colors-gold), 0 0 16px 4px color-mix(in srgb, var(--chakra-colors-gold) 45%, transparent)",
    },
})

export const POP_MS = 360
export const SHAKE_MS = 380
export const JUMP_MS = 620
/** A card sliding to another place in a row (the strength lessons). */
export const MOVE_MS = 520
export const MOVE_EASING = "cubic-bezier(0.22, 1, 0.36, 1)"

/** Reduced motion for the tutorial: the OS setting OR the in-game "Smanji
 *  animacije" — the same pair every table animation checks. */
export function useLearnReducedMotion(): boolean {
    const [prefs] = useGamePrefs()
    const system = usePrefersReducedMotion()
    return system || prefs.reduceMotion
}
