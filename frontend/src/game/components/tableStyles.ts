/** Theme-aware game surfaces and responsive seat/card geometry. */

const BLUR = {
    backdropFilter: "saturate(150%) blur(12px)",
    WebkitBackdropFilter: "saturate(150%) blur(12px)",
} as const

const BLUR_STRONG = {
    backdropFilter: "saturate(150%) blur(16px)",
    WebkitBackdropFilter: "saturate(150%) blur(16px)",
} as const

export const TEAM = {
    /** My pair — me and the seat opposite me. */
    us: "brand.fg",
    /** The other pair. A literal, because the brand ramp is one hue and a
     *  second team needs a second one; this is the bell suit's gold. */
    them: "#d9a521",
} as const

export type TeamSide = keyof typeof TEAM

/** Neutral, theme-aware surfaces; the application artwork stays visible. */
export const PLAY_AREA = {
    bg: "transparent",
    color: "fg.ink",
}

export const GLASS = {
    bg: "bg.panel",
    borderWidth: "1px",
    borderColor: "border.subtle",
    boxShadow: "0 2px 10px rgba(0,0,0,0.03)",
    css: BLUR,
}

export const GLASS_STRONG = {
    bg: "bg.opaque",
    borderWidth: "1px",
    borderColor: "border",
    css: BLUR_STRONG,
}

export const INK = "fg.ink"
export const INK_MUTED = "fg.muted"

/** A landscape phone (and any very short window): the table has to give the
 *  hand its 68 px and take the difference out of padding. */
export const SHORT = "@media (max-height: 560px)"

/** A small phone in portrait (iPhone SE and friends). The scoreboard and the
 *  hand tray are fixed costs, so what is left for the felt is thin enough
 *  that a full-size trick would run into the seats: the pile scales down
 *  instead of the seats being pushed off the felt. */
export const TIGHT = "@media (max-height: 700px)"

/** Narrow phones (320–360 px wide). Seat names give up a little width and
 * the trick contracts before either can be clipped by the viewport edge. */
export const NARROW = "@media (max-width: 360px)"

/** The `md` breakpoint as a raw query, so the table's geometry variables can
 *  live in ONE nested `css` object instead of being split between a Chakra
 *  responsive prop and two media queries that would then disagree. */
export const WIDE = "@media (min-width: 48em)"

/** Desktop pointers only. A "lift on hover" on a touch screen fires on the
 *  tap that plays the card, i.e. always and pointlessly. */
export const HOVER = "@media (hover: hover) and (pointer: fine)"

/** Shared geometry keeps player seats clear of the central trick.
 * The centre follows the available height, including compact desktop windows. */

/** The reserved height of one seat block: the 42 px avatar in its 3 px ring
 *  (48), 4 px, the name pill (22), 2 px, and the 17 px status slot. Stated
 *  here because the anchors clamp against it and the box's own floor is the
 *  sum of it and the two gaps — see `Seat.tsx` for the drawing. */
const SEAT_BLOCK = "94px"

/**
 * The geometry block for the table's root element.
 *
 * @param bottomSeat true when seat "bottom" is actually drawn on the felt
 *   (i.e. we are a spectator); then the centre has to sit a full seat above
 *   the bottom edge instead of just clearing the pile, and the box needs the
 *   height to put that seat in.
 */
export function tableGeometry(bottomSeat: boolean) {
    const cyBottom = bottomSeat
        ? "calc(var(--seat-y) + var(--seat-h))"
        : "var(--cy-free)"
    // A spectator's box carries two full seat blocks (top and bottom) plus
    // both gaps, so its floor is ~90 px taller than a player's.
    // The table lives in the remaining height after the score board, hand,
    // reactions and iPhone safe areas. `vh` alone is wrong there: a standalone
    // iPhone PWA loses the status-bar inset, while DevTools commonly does not.
    // Keep the requested clamp, but cap it at the parent we actually received
    // so the seat anchors and trick centre shrink with the visible felt.
    const boxH = (min: number, vh: number, max: number) =>
        `min(100%, clamp(${bottomSeat ? min + 90 : min}px, ${vh}vh, ${bottomSeat ? max + 90 : max}px))`
    // How fast the vertical gap grows with the box. A spectator's ring has to
    // fit TWICE over (`--cy-bottom` is a whole seat for them), so their gap
    // grows at two thirds the rate; at 0.32 the top seat would be pushed off
    // the top of the box on every window under ~520 px.
    const vy = bottomSeat ? "0.22" : "0.32"

    return {
        "--box-h": boxH(352, 44, 470),
        "--seat-w": "92px",
        "--seat-h": SEAT_BLOCK,
        "--seat-overlap": "18px",
        "--seat-clear-x": "108px",
        "--seat-clear-y": "120px",
        /** Grows with the box, never below the pile's clearance, and capped
         *  so a very tall window does not fling the seats into the corners. */
        "--seat-x": "max(var(--seat-clear-x), min(calc(0.46 * var(--box-h)), 200px))",
        "--seat-y": `max(var(--seat-clear-y), min(calc(${vy} * var(--box-h)), 176px))`,
        /** Room under the pile when nothing is seated there. */
        "--cy-free": "calc(var(--seat-y) + 8px)",
        "--cy-bottom": cyBottom,
        /** Distance of the table's centre from the TOP of the box. */
        "--table-cy": bottomSeat ? "50%" : "60%",
        /** The stadium: as wide as the ring of seats (plus the rim they sit
         *  on), capped at 94 % so it never touches the column's own edge. */
        "--table-w": "min(94%, calc(2 * var(--seat-x) + 2 * var(--seat-overlap)))",
        /** …and as tall as the ring allows, but never so tall that its lower
         *  half runs past the bottom of the box and under the hand tray. */
        "--table-h": "min(calc(2 * var(--cy-bottom) - 10px), calc(2 * var(--seat-y) + 2 * var(--seat-overlap)))",
        height: "var(--box-h)",

        [WIDE]: {
            "--box-h": boxH(392, 50, 520),
            "--seat-w": "116px",
            "--seat-x": "max(var(--seat-clear-x), min(calc(0.46 * var(--box-h)), 240px))",
            "--seat-y": `max(var(--seat-clear-y), min(calc(${vy} * var(--box-h)), 190px))`,
            "--cy-free": "calc(var(--seat-y) + 10px)",
        },

        // iPhone SE and friends: the pile is already scaled to 0.86 by
        // TrickArea, so the seats may close in by the same amount.
        [TIGHT]: {
            "--box-h": boxH(320, 42, 372),
            "--seat-clear-x": "93px",
            "--seat-clear-y": "104px",
            "--seat-x": "max(var(--seat-clear-x), min(calc(0.46 * var(--box-h)), 170px))",
            "--seat-y": `max(var(--seat-clear-y), min(calc(${vy} * var(--box-h)), 150px))`,
            "--cy-free": "calc(var(--seat-y) + 8px)",
        },

        [NARROW]: {
            "--seat-w": "82px",
            "--seat-clear-x": "82px",
            "--seat-x": "max(var(--seat-clear-x), min(calc(0.42 * var(--box-h)), 132px))",
            "--table-w": "min(98%, calc(2 * var(--seat-x) + 2 * var(--seat-overlap)))",
        },

        // Landscape: width is free, height is not. The seats go out to the
        // flanks, the top seat comes down, the seat block drops its status
        // slot (Seat.tsx does the same under SHORT — keep the two in step),
        // and the box takes whatever height the column has left rather than
        // asking for its own. The gaps are stated as plain numbers here
        // because `--box-h` is no longer a length we control.
        [SHORT]: {
            "--seat-h": "76px",
            "--seat-clear-x": "72px",
            "--seat-clear-y": "80px",
            "--seat-overlap": "14px",
            "--seat-x": "170px",
            "--seat-y": "84px",
            "--cy-free": "92px",
            height: "100%",
        },
    } as const
}
