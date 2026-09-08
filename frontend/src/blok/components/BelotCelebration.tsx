import { useEffect } from "react"
import { Box, Portal, Text, VStack } from "@chakra-ui/react"

import { useGamePrefs } from "../../game/hooks/useGamePrefs"
import { usePrefersReducedMotion } from "../../game/hooks/usePrefersReducedMotion"
import { useTranslation } from "../../i18n"

/* ──────────────────────────────────────────────────────────────────────────
   BelotCelebration — the confetti burst for a saved belot (BLOK.md §1.2).

   A belot is the one thing in the blok that ends a game in a single tap, and
   it happens maybe once in a hundred evenings. It gets a moment.

   ── MOTION IS OPTIONAL, THE INFORMATION IS NOT ────────────────────────────
   Nothing is announced here. The deal row's BELOT badge, the sheet's badge
   and the 1001 on the scoreboard say everything; this only celebrates. That
   is why the whole component renders NOTHING at all under reduced motion —
   there is no degraded animation to fall back to, and a still image of
   confetti would be litter — and why the overlay is `aria-hidden` with
   `pointer-events: none`: a screen reader gets the badge, and a thumb aiming
   at the next deal is never intercepted by a decoration.

   Reduced motion is read from BOTH sources, and either one is enough:
     • `prefers-reduced-motion` — the OS setting;
     • `useGamePrefs().reduceMotion` — the app's own "Smanji animacije".
   The blok has no switch of its own and inventing a second one (a menu item
   that only governs a once-a-year burst) would be a worse answer than reading
   the one this device already has. It lives under the online game's settings
   sheet, but it is a per-DEVICE localStorage preference, not game state, and
   it can only ever REDUCE motion — so honouring it here cannot surprise
   anybody in the direction that matters. Same pair `game/pages/GameRoomPage`
   combines, same precedent as the blok already importing `SuitGlyph` from
   `game/`.

   ── NO NEW DEPENDENCY ─────────────────────────────────────────────────────
   Two CSS keyframes and a fixed list of absolutely positioned squares. A
   confetti library would be several kilobytes of vendor bundle (already 1.1
   MB) for an effect that is thirty lines of CSS. The pieces share ONE style
   object per colour and vary through inline custom properties, so the whole
   burst is a handful of emitted classes rather than one per piece.
   ────────────────────────────────────────────────────────────────────── */

/** How long the burst runs before it takes itself off screen. */
const DURATION_MS = 2200

/** Semantic tokens only — the felt green, the success teal and the warning
 *  red the app already ships, so the burst is in the app's palette in both
 *  themes and there is no hand-mixed hex anywhere. */
const TONES = [
    "brand.solid",
    "green.solid",
    "red.solid",
    "brand.fg",
    "green.fg",
    "red.fg",
] as const

/**
 * The pieces, computed ONCE at module load and never randomised per render:
 * a burst that reshuffles on every re-render would flicker, and `Math.random`
 * inside a render body is a bug waiting for StrictMode's double invocation.
 * The arithmetic below is a cheap deterministic spread — irregular enough to
 * read as scattered, identical on every device.
 */
const PIECES = Array.from({ length: 24 }, (_, i) => ({
    left: `${((i * 37) % 100)}%`,
    /** Sideways drift, so they do not fall in 24 parallel lines. */
    drift: `${(((i * 53) % 41) - 20)}vw`,
    delayMs: (i * 61) % 420,
    durationMs: 1300 + ((i * 97) % 500),
    size: 7 + ((i * 13) % 6),
    spin: i % 2 === 0 ? "540deg" : "-540deg",
    tone: TONES[i % TONES.length],
}))

export default function BelotCelebration({
    open,
    onDone,
}: {
    open: boolean
    /** Called when the burst has finished, so the parent can put the flag
     *  back down. Also called immediately when there is no burst to run
     *  (reduced motion), so the parent never has to know which it was. */
    onDone: () => void
}) {
    const { t } = useTranslation()
    const systemReduced = usePrefersReducedMotion()
    const [prefs] = useGamePrefs()
    const reducedMotion = systemReduced || prefs.reduceMotion

    useEffect(() => {
        if (!open) return
        // With motion off there is nothing to wait for: clear the flag on the
        // next tick rather than holding a phantom 2.2 s of "celebrating".
        const timer = window.setTimeout(onDone, reducedMotion ? 0 : DURATION_MS)
        return () => window.clearTimeout(timer)
    }, [open, reducedMotion, onDone])

    if (!open || reducedMotion) return null

    return (
        <Portal>
            <Box
                position="fixed"
                inset="0"
                // Above the fixed action bar (940) and above the entry sheet's
                // layer, which is already closing as this opens. Nothing here
                // can be touched, so no z-index race can trap a tap.
                zIndex={1600}
                pointerEvents="none"
                aria-hidden="true"
                overflow="hidden"
                css={{
                    animation: `belotBurstIn 160ms ease-out`,
                    /* Both keyframe sets are declared here, on the one element
                       that is guaranteed to exist for the whole burst; CSS
                       `@keyframes` are document-global once emitted, so the
                       pieces below just name them. */
                    "@keyframes belotBurstIn": {
                        from: { opacity: 0 },
                        to: { opacity: 1 },
                    },
                    "@keyframes belotConfettiFall": {
                        from: {
                            transform: "translate3d(0, -12vh, 0) rotate(0deg)",
                            opacity: 1,
                        },
                        to: {
                            transform:
                                "translate3d(var(--belot-drift), 110vh, 0) rotate(var(--belot-spin))",
                            opacity: 0,
                        },
                    },
                    "@keyframes belotWordIn": {
                        "0%": { transform: "scale(0.6)", opacity: 0 },
                        "22%": { transform: "scale(1.06)", opacity: 1 },
                        "32%": { transform: "scale(1)", opacity: 1 },
                        "78%": { transform: "scale(1)", opacity: 1 },
                        "100%": { transform: "scale(1)", opacity: 0 },
                    },
                }}
            >
                {PIECES.map((piece, i) => (
                    <Box
                        key={i}
                        position="absolute"
                        top="0"
                        bg={piece.tone}
                        rounded="l1"
                        style={{
                            left: piece.left,
                            width: `${piece.size}px`,
                            height: `${piece.size * 2}px`,
                            animationDelay: `${piece.delayMs}ms`,
                            animationDuration: `${piece.durationMs}ms`,
                            // Read by the keyframes above; per-piece, so the
                            // 24 squares share a single animation rule.
                            ["--belot-drift" as string]: piece.drift,
                            ["--belot-spin" as string]: piece.spin,
                        }}
                        css={{
                            animationName: "belotConfettiFall",
                            animationTimingFunction: "cubic-bezier(0.25, 0.6, 0.4, 1)",
                            animationFillMode: "both",
                        }}
                    />
                ))}

                <VStack
                    position="absolute"
                    insetInline="0"
                    top="28%"
                    gap="1"
                    px="6"
                    textAlign="center"
                    css={{ animation: `belotWordIn ${DURATION_MS}ms ease-out both` }}
                >
                    <Text
                        fontSize={{ base: "5xl", md: "6xl" }}
                        fontWeight="bold"
                        lineHeight="1"
                        color="brand.fg"
                        textTransform="uppercase"
                        letterSpacing="wide"
                        // The word has to survive landing on whatever is behind
                        // it — a bright scoreboard or a dark panel — without a
                        // backdrop of its own, since a scrim would read as a
                        // modal the player has to dismiss.
                        textShadow="0 2px 12px rgba(0, 0, 0, 0.45)"
                    >
                        {t("blok.entry.belot")}
                    </Text>
                    <Text
                        fontSize="sm"
                        fontWeight="semibold"
                        color="fg.ink"
                        textShadow="0 1px 8px rgba(0, 0, 0, 0.45)"
                    >
                        {t("blok.entry.belotHint")}
                    </Text>
                </VStack>
            </Box>
        </Portal>
    )
}
