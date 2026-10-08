import { useEffect, useRef } from "react"
import { Box, Portal } from "@chakra-ui/react"
import type { Suit } from "@bela/protocol"
import SuitGlyph from "./SuitGlyph"

/* ──────────────────────────────────────────────────────────────────────────
   TrumpFlight — the suit mark leaving the "X zove herc" overlay and landing
   in the scoreboard's trump cell (2026-10-08, owner request).

   A FLIP flight: the page measures the overlay's suit mark and the badge's
   suit slot the moment the overlay is about to go (both viewport rects,
   taken right then — on a phone the scoreboard is wherever it is at that
   instant), and this renders a fixed-position CLONE of the same `SuitGlyph`
   parked exactly over the overlay's mark, then moves it to the badge. The
   badge keeps its own glyph invisible until `onDone`, when it pops in
   (`TrumpBadge`, `glyph="landed"`).

   Geometry is per flight, so the movement is driven through the Web
   Animations API on the node rather than a module-level emotion `keyframes`
   (the convention for everything else on the table, game/DESIGN.md): a
   keyframe cannot carry "translate by whatever the distance happens to be
   today". `fill: "forwards"` holds the last frame until the clone unmounts,
   so a late `onDone` never flashes it back to the start.

   Reduced motion never reaches this component — the page skips straight to
   the badge instead (no flight to shorten, the fact is already on screen).
   ────────────────────────────────────────────────────────────────────── */

export const TRUMP_FLIGHT_MS = 650

export type FlightRect = Pick<DOMRect, "left" | "top" | "width" | "height">

export default function TrumpFlight({
    suit,
    size,
    from,
    to,
    onDone,
}: {
    suit: Suit
    /** The overlay's glyph size in px — the clone is drawn at exactly that,
     *  so the mark that lifts off is pixel-identical to the one it replaces. */
    size: number
    /** Where the overlay's mark was, viewport coordinates. */
    from: FlightRect
    /** Where the badge's mark is, viewport coordinates. */
    to: FlightRect
    onDone: () => void
}) {
    const nodeRef = useRef<HTMLDivElement | null>(null)
    const doneRef = useRef(onDone)
    doneRef.current = onDone

    useEffect(() => {
        const node = nodeRef.current
        if (!node) return
        let finished = false
        const finish = () => {
            if (finished) return
            finished = true
            doneRef.current()
        }
        // Centre to centre, scale by height: the badge's mark is the same
        // glyph a size down, and the two marks need not share an aspect
        // ratio (the plain-text suits of the French decks are narrower than
        // they are tall).
        const dx = to.left + to.width / 2 - (from.left + from.width / 2)
        const dy = to.top + to.height / 2 - (from.top + from.height / 2)
        const scale = from.height > 0 ? to.height / from.height : 1
        let animation: Animation | null = null
        if (typeof node.animate === "function") {
            animation = node.animate(
                [
                    { transform: "translate(0, 0) scale(1)" },
                    { transform: `translate(${dx}px, ${dy}px) scale(${scale})` },
                ],
                { duration: TRUMP_FLIGHT_MS, easing: "cubic-bezier(0.45, 0, 0.25, 1)", fill: "forwards" },
            )
            animation.onfinish = finish
        } else {
            // No WAAPI (very old WebView): nothing moves, the badge just
            // shows after the same beat.
            node.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`
        }
        // `onfinish` is skipped when the tab is hidden and the animation
        // is throttled; the badge must still land.
        const fallback = window.setTimeout(finish, TRUMP_FLIGHT_MS + 80)
        return () => {
            window.clearTimeout(fallback)
            animation?.cancel()
        }
    }, [from, to])

    return (
        <Portal>
            <Box
                ref={nodeRef}
                aria-hidden="true"
                position="fixed"
                left={`${from.left}px`}
                top={`${from.top}px`}
                w={`${from.width}px`}
                h={`${from.height}px`}
                display="flex"
                alignItems="center"
                justifyContent="center"
                // Over the dimmed overlay it is leaving (z 1500) and under
                // nothing that matters — it is on screen for half a second.
                zIndex={1600}
                pointerEvents="none"
                transformOrigin="center"
                willChange="transform"
            >
                <SuitGlyph suit={suit} size={size} />
            </Box>
        </Portal>
    )
}
