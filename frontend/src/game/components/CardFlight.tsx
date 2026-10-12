import { useEffect, useRef } from "react"
import { Box, Portal } from "@chakra-ui/react"
import type { Card } from "@bela/protocol"
import { useGamePrefs } from "../hooks/useGamePrefs"
import { CARD_METRICS, MADJARICA_HEIGHT, isHungarianDeck } from "../util/cards"
import PlayingCard from "./PlayingCard"
import type { FlightRect } from "./TrumpFlight"

/* ──────────────────────────────────────────────────────────────────────────
   CardFlight — one of MY cards leaving the hand for the felt, or coming
   back (2026-10-11, owner: declarations are laid on the table, not shown
   in a popup).

   The same FLIP shape as `TrumpFlight`: the page measures the card's box in
   the hand and the slot waiting for it on the felt (viewport rects, taken
   the moment the flight starts), and this renders a fixed-position CLONE of
   the same `PlayingCard` parked exactly over the first and moves it to the
   second. The real card in the hand is hidden for the trip (`Hand`'s
   `hiddenCards`) and the felt slot shows its own card only once `onDone`
   has fired, so at no instant are there two of it on screen — or none.

   THE THROW (2026-10-12, owner: "stronger"). Going OUT is three beats in
   one WAAPI animation per card, keyframe offsets doing the splitting:
   (a) the card RISES out of the hand, away from the table's centre —
   `direction` × 28 px and a touch bigger (1.06), 180 ms ease-out; (b) a
   160 ms hold in the air; (c) the THROW onto its slot — 280 ms on an
   overshoot curve, with a ±6° wobble that settles into the slot's own
   angle. Coming BACK is the plain 320 ms flight it always was. Cards
   leaving (or returning) together move AT ONCE — no per-card stagger
   (2026-10-12, owner: a declaration lands as one group).

   The clone is drawn at `sm` and SCALED, both at take-off and at landing:
   the hand card is `sm` × `--hand-k` on a phone and `md`/`ml` on the web,
   the felt slot is `sm` × `--decl-k`. The box is parked so that its CENTRE
   is the from-rect's centre and every transform is about that centre
   (the wobble has to turn the card about its middle, not a corner), so
   the keyframes carry centre-to-centre moves and plain scales.

   Reduced motion never reaches this component — the page swaps the cards
   over in place instead.
   ────────────────────────────────────────────────────────────────────── */

/** Beat (a): out of the hand, away from the centre. */
const LIFT_MS = 180
const LIFT_PX = 28
const LIFT_SCALE = 1.06
/** Beat (b): held in the air. */
const HOLD_MS = 160
/** Beat (c): onto the slot, with the wobble and the settle. */
const THROW_MS = 280
const WOBBLE_DEG = 6
const THROW_EASING = "cubic-bezier(0.22, 1.2, 0.36, 1)"
/** The whole throw, take-off to landing, for one card. */
export const CARD_THROW_MS = LIFT_MS + HOLD_MS + THROW_MS
/** The way back into the hand — one plain move. */
export const CARD_RETURN_MS = 320

export default function CardFlight({
    card,
    from,
    to,
    direction,
    throwIn = false,
    delayMs = 0,
    onDone,
}: {
    card: Card
    from: FlightRect
    to: FlightRect
    /** Unit vector from the table's centre toward the seat the card belongs
     *  to — the way it rises before the throw (`positionVector`). */
    direction: { x: number; y: number }
    /** The three-beat throw onto the felt; false = the plain flight back. */
    throwIn?: boolean
    delayMs?: number
    onDone: () => void
}) {
    const [prefs] = useGamePrefs()
    const nodeRef = useRef<HTMLDivElement | null>(null)
    const doneRef = useRef(onDone)
    doneRef.current = onDone
    const drawnW = Number.parseFloat(CARD_METRICS.sm.w)
    const drawnH = Number.parseFloat(isHungarianDeck(prefs.deck) ? MADJARICA_HEIGHT.sm : CARD_METRICS.sm.h)
    const fromScale = from.width > 0 ? from.width / drawnW : 1
    const toScale = to.width > 0 ? to.width / drawnW : 1
    const total = throwIn ? CARD_THROW_MS : CARD_RETURN_MS

    useEffect(() => {
        const node = nodeRef.current
        if (!node) return
        let finished = false
        const finish = () => {
            if (finished) return
            finished = true
            doneRef.current()
        }
        // Centre to centre: the box is parked on the from-rect's centre and
        // transforms about its own centre, so these are the whole move.
        const dx = to.left + to.width / 2 - (from.left + from.width / 2)
        const dy = to.top + to.height / 2 - (from.top + from.height / 2)
        const at = (x: number, y: number, scale: number, deg = 0) =>
            `translate(${x}px, ${y}px) rotate(${deg}deg) scale(${scale})`
        const keyframes: Keyframe[] = throwIn
            ? [
                  { offset: 0, transform: at(0, 0, fromScale), easing: "ease-out" },
                  {
                      offset: LIFT_MS / total,
                      transform: at(direction.x * LIFT_PX, direction.y * LIFT_PX, fromScale * LIFT_SCALE),
                      easing: "linear",
                  },
                  {
                      offset: (LIFT_MS + HOLD_MS) / total,
                      transform: at(direction.x * LIFT_PX, direction.y * LIFT_PX, fromScale * LIFT_SCALE, WOBBLE_DEG),
                      easing: THROW_EASING,
                  },
                  // Most of the way there, leaning the other way, so the
                  // overshoot curve settles the last few px AND the angle.
                  {
                      offset: (LIFT_MS + HOLD_MS + THROW_MS * 0.7) / total,
                      transform: at(dx * 0.92, dy * 0.92, toScale * 1.03, -WOBBLE_DEG),
                      easing: THROW_EASING,
                  },
                  { offset: 1, transform: at(dx, dy, toScale) },
              ]
            : [
                  { transform: at(0, 0, fromScale), easing: "cubic-bezier(0.22, 0.61, 0.36, 1)" },
                  { transform: at(dx, dy, toScale) },
              ]
        let animation: Animation | null = null
        if (typeof node.animate === "function") {
            animation = node.animate(keyframes, { duration: total, delay: delayMs, fill: "both" })
            animation.onfinish = finish
        } else {
            // No WAAPI (very old WebView): nothing moves, the card is simply
            // at its destination when the beat is over.
            node.style.transform = at(dx, dy, toScale)
        }
        // `onfinish` is skipped when the tab is hidden and the animation is
        // throttled; the card must still land (and the hand must be whole).
        const fallback = window.setTimeout(finish, total + delayMs + 80)
        return () => {
            window.clearTimeout(fallback)
            animation?.cancel()
        }
    }, [from, to, direction, throwIn, delayMs, total, fromScale, toScale])

    return (
        <Portal>
            <Box
                ref={nodeRef}
                aria-hidden="true"
                position="fixed"
                // Parked with its CENTRE on the from-rect's centre; the box
                // itself is the drawn size, the rects are reached by scale.
                left={`${from.left + from.width / 2 - drawnW / 2}px`}
                top={`${from.top + from.height / 2 - drawnH / 2}px`}
                w={`${drawnW}px`}
                h={`${drawnH}px`}
                // Over the table and the hand, under nothing that matters —
                // it is on screen for well under a second.
                zIndex={1600}
                pointerEvents="none"
                transformOrigin="center"
                willChange="transform"
                style={{ transform: `scale(${fromScale})` }}
            >
                <PlayingCard card={card} size="sm" />
            </Box>
        </Portal>
    )
}
