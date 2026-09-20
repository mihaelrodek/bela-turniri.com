import { useEffect } from "react"
import type { Suit } from "@bela/engine"

import BelotShowcase from "../../game/components/BelotShowcase"
import { useGamePrefs } from "../../game/hooks/useGamePrefs"
import { usePrefersReducedMotion } from "../../game/hooks/usePrefersReducedMotion"
import { useTranslation } from "../../i18n"

/* ──────────────────────────────────────────────────────────────────────────
   BelotCelebration — the moment a saved belot gets (BLOK.md §1.2).

   A belot is the one thing in the blok that ends a game in a single tap, and
   it happens maybe once in a hundred evenings. Since 2026-09-20 (user
   request: the confetti squares were "not good") it is the SAME show the
   online table puts on — `game/components/BelotShowcase`: eight cards of one
   suit rising and opening into a fan over golden rays, a burst of suit marks,
   the word landing letter by letter. Same precedent as the blok already
   importing `SuitGlyph` from `game/`.

   The blok is entered by hand and never learns WHICH eight cards they were,
   so the caller hands in a suit (`randomSuit()`, picked in the save handler —
   not here, a render body must not roll dice).

   ── MOTION IS OPTIONAL, THE INFORMATION IS NOT ────────────────────────────
   Nothing is announced here that the deal row's BELOT badge and the 1001 on
   the scoreboard do not already say. Under reduced motion — the OS setting
   OR the app's own "Smanji animacije", either is enough — the same picture
   is shown standing still, for a shorter time. The stage covers the screen,
   so a tap anywhere puts it away at once: a thumb aiming at "Nova partija"
   never has to wait for a decoration.
   ────────────────────────────────────────────────────────────────────── */

/** How long the show runs before it takes itself off screen. */
const DURATION_MS = 7600
/** Standing still there is nothing to watch finish — just long enough to read. */
const REDUCED_DURATION_MS = 2200

export default function BelotCelebration({
    suit,
    onDone,
}: {
    /** The suit to celebrate with, or null while there is nothing to show. */
    suit: Suit | null
    /** Called when the show has finished or was tapped away, so the parent
     *  can put the flag back down. */
    onDone: () => void
}) {
    const { t } = useTranslation()
    const systemReduced = usePrefersReducedMotion()
    const [prefs] = useGamePrefs()
    const reducedMotion = systemReduced || prefs.reduceMotion
    const durationMs = reducedMotion ? REDUCED_DURATION_MS : DURATION_MS

    useEffect(() => {
        if (suit === null) return
        const timer = window.setTimeout(onDone, durationMs)
        return () => window.clearTimeout(timer)
    }, [suit, durationMs, onDone])

    if (suit === null) return null

    return (
        <BelotShowcase
            suit={suit}
            kicker={t("blok.entry.belotCongrats")}
            title={t("blok.entry.belot")}
            subtitle={t("blok.entry.belotHint")}
            durationMs={durationMs}
            reducedMotion={reducedMotion}
            onDismiss={onDone}
        />
    )
}
