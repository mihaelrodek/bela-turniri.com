/* ──────────────────────────────────────────────────────────────────────────
   The table's surface language, in one place (game/DESIGN.md §2.2).

   The felt is ALWAYS dark — in both themes. A card table is a physical
   object with its own colour; only the chrome around it (navbar, dialogs)
   follows the light/dark preference. That is why nothing here reads a
   semantic token like `bg.panel`, which flips to near-white in light mode:
   the panels that float on the felt are painted from the brand ramp itself
   with an alpha modifier (`brand.950/62` → `color-mix`), so they are the
   same dark glass whatever the theme says.

   Every value is a brand-ramp token. The only literal colours in the game UI
   are the card faces, which are not ours (see PlayingCard.tsx).

   These are spread onto components as PROPS (`<Box {...GLASS} />`), so they
   are deliberately left un-annotated: a `SystemStyleObject` annotation would
   widen `direction` and friends to every CSS value and collide with Flex's
   own `direction` prop. The blur lives under `css` because the `-webkit-`
   prefix (iOS < 18) is not a Chakra style prop — a call site that needs its
   own `css` merges `...GLASS.css` into it.
   ────────────────────────────────────────────────────────────────────── */

const BLUR = {
    backdropFilter: "saturate(150%) blur(12px)",
    WebkitBackdropFilter: "saturate(150%) blur(12px)",
} as const

const BLUR_STRONG = {
    backdropFilter: "saturate(150%) blur(16px)",
    WebkitBackdropFilter: "saturate(150%) blur(16px)",
} as const

/** The ROOM the table stands in: a deep, almost flat felt-green that falls
 *  away at the edges. Deliberately darker and quieter than it used to be —
 *  the eye-catching surface is now the table itself (`TableSurface`), and a
 *  room painted as brightly as the table would leave the table invisible. */
export const FELT = {
    bg: "rgba(0, 43, 24, 0.86)",
    backgroundImage:
        "radial-gradient(ellipse 120% 78% at 50% 42%, rgba(3, 85, 45, 0.78) 0%, rgba(0, 37, 21, 0.88) 66%)",
    backdropFilter: "blur(1px)",
}

/** Dark glass — scoreboard, hand tray, bidding panel. */
export const GLASS = {
    bg: "brand.950/62",
    borderWidth: "1px",
    borderColor: "brand.700/70",
    css: BLUR,
}

/** A denser version for overlays that carry a block of text over the trick. */
export const GLASS_STRONG = {
    bg: "brand.950/88",
    borderWidth: "1px",
    borderColor: "brand.600/80",
    css: BLUR_STRONG,
}

/** Text on the felt. `INK_MUTED` is the pale end of the brand ramp rather
 *  than a grey, so secondary text still belongs to the table. */
export const INK = "white"
export const INK_MUTED = "brand.100/72"

/** A landscape phone (and any very short window): the table has to give the
 *  hand its 68 px and take the difference out of padding. */
export const SHORT = "@media (max-height: 560px)"

/** A small phone in portrait (iPhone SE and friends). The scoreboard and the
 *  hand tray are fixed costs, so what is left for the felt is thin enough
 *  that a full-size trick would run into the seats: the pile scales down
 *  instead of the seats being pushed off the felt. */
export const TIGHT = "@media (max-height: 700px)"

/** The `md` breakpoint as a raw query, so the table's geometry variables can
 *  live in ONE nested `css` object instead of being split between a Chakra
 *  responsive prop and two media queries that would then disagree. */
export const WIDE = "@media (min-width: 48em)"

/* ──────────────────────────────────────────────────────────────────────────
   THE TABLE'S GEOMETRY, as CSS custom properties.

   Every seat, the felt oval and the trick pile are placed from ONE set of
   numbers, set on the table's root element and read by `SEAT_ANCHORS`
   (util/seats.ts), `TableSurface` and `TrickArea`. Before this they were
   three sets of magic numbers in three files that had to be "bumped
   together", and of course they drifted.

     --seat-w    one seat's width. All four seats are the same component at
                 the same width; nothing about a seat depends on which side
                 of the table it is on except where it is pinned.
     --seat-h    the height a seat block RESERVES (avatar + name + status
                 slot), so a seat that gains or loses its status chip does
                 not move, and so an anchor can clamp itself inside the box.
     --seat-x    horizontal gap from the table's centre to a flank seat's
                 inner edge. Must clear the trick pile's half-width
                 (`REST_X` + half a card + scatter, TrickArea.tsx).
     --seat-y    vertical gap from the centre to the top seat's lower edge.
                 Must clear the pile's half-height the same way.
     --cy-free   how far the centre sits above the bottom when NOBODY is
                 seated down there: just enough to clear the pile.
     --cy-bottom the same distance, actually used — `--cy-free`, or a whole
                 seat when a spectator's bottom seat has to fit under it.
     --table-cy  the centre, measured from the TOP: 100 % − `--cy-bottom`.
     --table-w
     --table-h   the translucent playing cloth's own size.

   The centre is `--cy-bottom` above the bottom rather than at 50 % because
   the bottom seat is normally not drawn on the felt at all — it is me, and I
   am in `MySeatBar` under it. A symmetric box therefore reserved a whole
   seat's worth of empty green between the flank seats and the hand tray,
   which is exactly the void this layout was reported for. A spectator, who
   HAS a bottom seat, gets `--cy-bottom` widened back out to a full seat.

   The media blocks are ordered WIDE → TIGHT → SHORT and rely on it: a short
   desktop window takes TIGHT's numbers over WIDE's, and a landscape phone
   takes SHORT's over both.
   ────────────────────────────────────────────────────────────────────── */

/** The reserved height of one seat block: the 42 px avatar in its 3 px ring
 *  (48), 4 px, the name pill (22), 2 px, and the 17 px status slot. Stated
 *  here because the anchors clamp against it and the box's own height is the
 *  sum of it and the two gaps — see `Seat.tsx` for the drawing. */
const SEAT_BLOCK = "94px"

/**
 * The geometry block for the table's root element.
 *
 * @param bottomSeat true when seat "bottom" is actually drawn on the felt
 *   (i.e. we are a spectator); then the centre has to sit a full seat above
 *   the bottom edge instead of just clearing the pile.
 */
export function tableGeometry(bottomSeat: boolean) {
    const cyBottom = bottomSeat
        ? "calc(var(--seat-y) + var(--seat-h))"
        : "var(--cy-free)"
    return {
        "--seat-w": "92px",
        "--seat-h": SEAT_BLOCK,
        "--seat-x": "126px",
        "--seat-y": "126px",
        /** Room under the pile when nothing is seated there. */
        "--cy-free": "134px",
        "--cy-bottom": cyBottom,
        /** Distance of the table's centre from the TOP of the box. */
        "--table-cy": "calc(100% - var(--cy-bottom))",
        /** A compact rectangular play area, like a cloth laid out for bela. */
        "--table-w": "min(88%, calc(2 * var(--seat-x) + 178px))",
        "--table-h": "min(calc(2 * var(--cy-bottom) - 20px), calc(2 * var(--seat-x) + 90px))",
        height: "calc(var(--seat-y) + var(--seat-h) + var(--cy-bottom))",

        [WIDE]: {
            "--seat-w": "116px",
            "--seat-x": "168px",
            "--seat-y": "146px",
            "--cy-free": "142px",
        },

        // iPhone SE and friends: the pile is already scaled to 0.86 by
        // TrickArea, so the seats may close in by the same amount.
        [TIGHT]: {
            "--seat-x": "104px",
            "--seat-y": "110px",
            "--cy-free": "112px",
        },

        // Landscape: width is free, height is not. The seats go out to the
        // flanks, the top seat comes down, the seat block drops its status
        // slot (Seat.tsx does the same under SHORT — keep the two in step),
        // and the box takes whatever height the column has left rather than
        // asking for its own.
        [SHORT]: {
            "--seat-h": "76px",
            "--seat-x": "160px",
            "--seat-y": "72px",
            "--cy-free": "78px",
            height: "100%",
        },
    } as const
}

/** A translucent bela cloth. The background cards remain visible through it. */
export const SURFACE = {
    backgroundImage:
        "linear-gradient(145deg, rgba(18, 116, 65, 0.30), rgba(1, 44, 24, 0.52)), radial-gradient(circle at 50% 48%, rgba(119, 211, 157, 0.12), transparent 58%)",
    backdropFilter: "blur(2px)",
    boxShadow: [
        "0 12px 30px rgba(0,0,0,0.22)",
        "inset 0 1px 0 rgba(255,255,255,0.08)",
        "inset 0 0 40px rgba(0,0,0,0.16)",
    ].join(", "),
}
