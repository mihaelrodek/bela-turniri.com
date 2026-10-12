import { useEffect, useState } from "react"

/* ──────────────────────────────────────────────────────────────────────────
   useFanRect — where my fan of cards ACTUALLY is (2026-10-12, owner, sixth
   pass).

   The landscape table used to place the bidding row and the corner blocks
   from formulas (the fan's zoom, its cell width, its top padding). They
   drifted from the screen — the outer cards' rotated corners stick out,
   cell widths round, the lift padding is not where a card is — so on the
   owner's 852 × 393 the bidding row sat ON the cards and the declare card
   covered two of them. Now the fan is MEASURED.

   What is measured, in the coordinates of the felt ROOT (the fixed,
   full-screen box), as whole px:
     top    the highest point of any slot (min top of every `[data-hand-slot]`
            box — the slots carry the fan's rotation, so their boxes already
            include the tilted corners)
     left   the leftmost / rightmost point of any slot; empty and card-back
     right  slots count too, so the box does not jump as cards are played
     cornerLeft   the inner edge of the bottom-left corner (a zero-size probe
     cornerRight  at `max(6px, safe-left)`, and its mirror on the right) —
                  so the safe areas are read as px, never re-derived

   Re-measured on: the root or the fan resizing, any slot being added or
   removed (a deal, a played card, the talon), the end of any animation or
   transition inside the fan (the deal-in settling), and window resize /
   orientation change. All of it coalesced into one rAF. Everything is torn
   down on unmount, and a missing node simply means "nothing measured yet"
   (null) — callers keep a fallback for that one frame.
   ────────────────────────────────────────────────────────────────────── */

export interface FanRect {
    top: number
    left: number
    right: number
    cornerLeft: number
    cornerRight: number
}

function sameRect(a: FanRect | null, b: FanRect): boolean {
    return a !== null
        && a.top === b.top
        && a.left === b.left
        && a.right === b.right
        && a.cornerLeft === b.cornerLeft
        && a.cornerRight === b.cornerRight
}

export function useFanRect() {
    const [root, setRoot] = useState<HTMLElement | null>(null)
    const [fan, setFan] = useState<HTMLElement | null>(null)
    const [leftProbe, setLeftProbe] = useState<HTMLElement | null>(null)
    const [rightProbe, setRightProbe] = useState<HTMLElement | null>(null)
    const [rect, setRect] = useState<FanRect | null>(null)

    useEffect(() => {
        if (!root || !fan || !leftProbe || !rightProbe) {
            setRect(null)
            return
        }
        let frame = 0
        const measure = () => {
            frame = 0
            const origin = root.getBoundingClientRect()
            let top = Infinity
            let left = Infinity
            let right = -Infinity
            for (const slot of fan.querySelectorAll<HTMLElement>("[data-hand-slot]")) {
                const box = slot.getBoundingClientRect()
                if (box.width === 0 || box.height === 0) continue
                top = Math.min(top, box.top)
                left = Math.min(left, box.left)
                right = Math.max(right, box.right)
            }
            if (!Number.isFinite(top)) {
                setRect(null)
                return
            }
            const next: FanRect = {
                // Rounded OUTWARD, so a placement against them can only err
                // on the side of more air.
                top: Math.floor(top - origin.top),
                left: Math.floor(left - origin.left),
                right: Math.ceil(right - origin.left),
                cornerLeft: Math.round(leftProbe.getBoundingClientRect().left - origin.left),
                cornerRight: Math.round(rightProbe.getBoundingClientRect().left - origin.left),
            }
            setRect((prev) => (sameRect(prev, next) ? prev : next))
        }
        const schedule = () => {
            if (frame === 0) frame = requestAnimationFrame(measure)
        }
        schedule()

        const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule)
        resize?.observe(root)
        resize?.observe(fan)
        const mutation = typeof MutationObserver === "undefined" ? null : new MutationObserver(schedule)
        mutation?.observe(fan, { childList: true, subtree: true })
        fan.addEventListener("animationend", schedule)
        fan.addEventListener("transitionend", schedule)
        window.addEventListener("resize", schedule)
        window.addEventListener("orientationchange", schedule)
        return () => {
            if (frame !== 0) cancelAnimationFrame(frame)
            resize?.disconnect()
            mutation?.disconnect()
            fan.removeEventListener("animationend", schedule)
            fan.removeEventListener("transitionend", schedule)
            window.removeEventListener("resize", schedule)
            window.removeEventListener("orientationchange", schedule)
        }
    }, [root, fan, leftProbe, rightProbe])

    return {
        /** The felt root — the coordinate space of every measurement. */
        rootRef: setRoot,
        /** A wrapper around the `Hand` (its slots carry `data-hand-slot`). */
        fanRef: setFan,
        /** Zero-size probes at the two bottom corners' inner edges. */
        leftProbeRef: setLeftProbe,
        rightProbeRef: setRightProbe,
        rect,
    }
}
