import { useCallback, useEffect, useState, type CSSProperties } from "react"
import { PHONE_GRID_H, PHONE_GRID_W } from "../components/handLayout"

/* ──────────────────────────────────────────────────────────────────────────
   useTableScale — how big the hand and the trick are on THIS screen.

   Until 2026-09-20 a phone got fixed steps: an `sm` hand, an `sm` (then `md`)
   trick, and three media queries that shrank the trick again. Every step was
   tuned against one screenshot and wrong on the next one — an installed PWA,
   the same phone in a Safari tab (URL bar + toolbar on screen) and a tall
   Android differ by 200 px of height, and a step cannot follow that (user
   report, twice in one day: first "karte na stolu su jako male", then, after
   an `xs` hand, "karte u ruci se jedva vide").

   So the phone layout is now a BUDGET. The room's own box is measured, the
   rows that never change are subtracted, and what is left is split between
   the two things that can flex:

     --hand-k   zoom of the two-row hand, drawn at `sm` (56 × 90)
     --pile-k   scale of the trick, drawn at `md` (72 × 116) — and of the
                seat clearances that stand off from it (`tableStyles.ts`)

   The split aims at ONE thing: a card on the felt and a card in the hand
   about the same width. Neither of the two complaints above was about an
   absolute size — each was about one pile of cards being visibly smaller
   than the other. So the height is divided such that `72 * pile` comes out
   near `56 * hand`; the hand is then capped by the width a page-centred grid has
   between my avatar and its mirror image, and whatever that cap frees goes to the trick. Over-estimating
   the fixed rows only leaves a little slack; under-estimating would squeeze
   the ring, so the constants lean generous.

   From 48em up nothing here applies: the hand is one row in a fixed size
   and the felt has height to spare, so both factors are 1.
   ────────────────────────────────────────────────────────────────────── */

/** Score panel + turn pill + reactions/bidding row, in px — everything in
 *  the column that is not felt or hand. Measured off a 393 pt iPhone. */
const FIXED_ROWS = 106 + 32 + 56
/** The iPhone home indicator, which only an installed PWA has to clear: in a
 *  browser tab the toolbar sits there instead and is outside our box. */
const HOME_INDICATOR = 34
/** The hand's own vertical padding around the grid. */
const HAND_PAD = 12
/** My avatar docked left of the hand: inset 12 + 40 px avatar + the dealer
 *  badge's overhang. The grid is centred on the page, so it has to leave
 *  this much free on BOTH sides. */
const AVATAR_RESERVE = 62
/** The ring that does not scale with the trick: the partner's seat block and
 *  its offset (`SEAT_BLOCK` + 14 in tableStyles.ts). */
const RING_FIXED = 116
/** …and the part that does: `--seat-clear-y` + `--cy-free` at scale 1. */
const RING_SCALED = 214
/** Pile scale per unit of hand scale at which both cards are equally wide:
 *  56 px (`sm`) against 72 px (`md`). */
const PILE_PER_HAND = 56 / 72

/** Half the `md` pile's width at scale 1 (REST_X 66 + half a 72 px card)
 *  plus a breath — `--seat-clear-x` in tableStyles.ts. */
const PILE_HALF_W = 104
/** A flank seat (`--seat-w` 92) + `--seat-gutter` 8 + the table's own px 8. */
const FLANK_SEAT = 108
/** How far the pile may reach into a flank seat's (mostly empty) box. */
const SEAT_INTRUSION = 8
/** Hand card width relative to a trick card's. "Malo prevelike" for both was
 *  the verdict on the first dynamic build (2026-09-20), so the trick is also
 *  capped just under its drawn size. */
const HAND_VS_PILE = 0.92
const PILE_MAX = 1

const PHONE_MAX_W = 768

export interface TableScale {
    /** Attach to the room's root element. */
    ref: (node: HTMLElement | null) => void
    /** CSS variables for that same element. */
    style: CSSProperties
}

function clamp(min: number, value: number, max: number): number {
    return Math.max(min, Math.min(value, max))
}

function isStandalone(): boolean {
    if (typeof window === "undefined") return false
    const nav = window.navigator as Navigator & { standalone?: boolean }
    return nav.standalone === true || window.matchMedia?.("(display-mode: standalone)").matches === true
}

export function computeScale(
    width: number,
    height: number,
    seated: boolean,
    standalone: boolean,
): { hand: number; pile: number } {
    if (width <= 0 || height <= 0) return { hand: 1, pile: 1 }
    if (width >= PHONE_MAX_W) {
        // One-row hand. A landscape phone lands here too; its felt is short,
        // so the trick keeps the factor the old SHORT query gave it.
        return { hand: 1, pile: height <= 560 ? 0.66 : 1 }
    }
    const reserve = seated ? AVATAR_RESERVE : 8
    const avail = height - FIXED_ROWS - (standalone ? HOME_INDICATOR : 0)

    // WIDTH LIMITS THE TRICK TOO (2026-09-20, user report: the pile ran into
    // both flank seats on a 393 px phone). Half the screen has to hold half
    // the pile (104 px at scale 1), a flank seat and its gutter; the seat's
    // own box is mostly air around a 48 px avatar, so the pile may reach
    // `SEAT_INTRUSION` px into it.
    const pileByWidth = (width / 2 - (FLANK_SEAT - SEAT_INTRUSION)) / PILE_HALF_W
    const pileCap = Math.min(PILE_MAX, pileByWidth)

    // Height such that hand and trick cards come out equally wide:
    //   PHONE_GRID_H*k + HAND_PAD + RING_FIXED + RING_SCALED*PILE_PER_HAND*k = avail
    const balanced = (avail - HAND_PAD - RING_FIXED) / (PHONE_GRID_H + RING_SCALED * PILE_PER_HAND)
    const byWidth = (width - 2 * reserve) / PHONE_GRID_W
    // The hand follows the trick, a touch smaller (`HAND_VS_PILE`): a wide
    // row is no reason for hand cards to outgrow the ones on the felt.
    const byPile = (Math.min(pileCap, balanced * PILE_PER_HAND) / PILE_PER_HAND) * HAND_VS_PILE
    // Floor 0.95 (≈53 px cards): the `xs` experiment showed that below this
    // the hand stops being readable, so on a short screen the trick gives way
    // first. Only the row's real width may push the hand under it.
    const hand = clamp(Math.min(0.95, byWidth), Math.min(balanced, byWidth, byPile), 1.5)
    const left = avail - (PHONE_GRID_H * hand + HAND_PAD) - RING_FIXED
    const pile = clamp(0.64, Math.min(pileCap, left / RING_SCALED), PILE_MAX)
    return { hand, pile }
}

export function useTableScale(seated: boolean): TableScale {
    const [node, setNode] = useState<HTMLElement | null>(null)
    const [size, setSize] = useState({ w: 0, h: 0 })
    const ref = useCallback((el: HTMLElement | null) => setNode(el), [])

    useEffect(() => {
        if (!node) return
        const read = (): void => {
            const rect = node.getBoundingClientRect()
            const w = Math.round(rect.width)
            const h = Math.round(rect.height)
            setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }))
        }
        read()
        if (typeof ResizeObserver === "undefined") {
            window.addEventListener("resize", read)
            return () => window.removeEventListener("resize", read)
        }
        const observer = new ResizeObserver(read)
        observer.observe(node)
        return () => observer.disconnect()
    }, [node])

    const { hand, pile } = computeScale(size.w, size.h, seated, isStandalone())
    return {
        ref,
        style: {
            "--hand-k": hand.toFixed(3),
            "--pile-k": pile.toFixed(3),
        } as CSSProperties,
    }
}
