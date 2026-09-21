import { chakra } from "@chakra-ui/react"
import { keyframes } from "@emotion/react"
import { useTranslation } from "../i18n"

/* ──────────────────────────────────────────────────────────────────────────
   SuitSpinner — the app's page-level loading mark (2026-09-21, user request):
   the four suits of the logo (heart ↖, bell ↗, leaf ↙, acorn ↘ — same paths,
   same 2×2 geometry, same colours as `public/games/symbol.svg`) travelling
   round their common centre.

   The GROUP turns, and every suit turns the other way by the same angle, so
   each glyph stays upright while it orbits — a bell hanging upside down reads
   as a bug, not as motion. Both keyframes are module-scope (Emotion does not
   run nested `@keyframes` from a `css` prop) and share one duration, which is
   what keeps the counter-rotation exact.

   Small inline spinners (buttons, badges, `size="xs" | "sm"`) stay Chakra's
   `Spinner`: four suits are illegible under ~24 px — the logo README says the
   same of the mark itself.

   Reduced motion: no orbit, a slow opacity pulse instead, so the screen still
   says "working" without anything travelling.
   ────────────────────────────────────────────────────────────────────── */

const orbit = keyframes`
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
`
const upright = keyframes`
    from { transform: rotate(0deg); }
    to   { transform: rotate(-360deg); }
`
const pulse = keyframes`
    0%, 100% { opacity: 1; }
    50%      { opacity: 0.45; }
`

const SIZES = { sm: 28, md: 40, lg: 56, xl: 80 } as const
export type SuitSpinnerSize = keyof typeof SIZES

/** One suit: its cell origin in the 100×100 logo grid and its 100×100 path. */
const SUITS = [
    { key: "heart", x: 18, y: 18, fill: "var(--chakra-colors-suit-heart)", d: "M50 88C22 66 10 52 10 33a20 20 0 0 1 40-8a20 20 0 0 1 40 8c0 19-12 33-40 55Z" },
    { key: "bell", x: 52.56, y: 18, fill: "var(--chakra-colors-suit-bell)", d: "M42 20a8 8 0 0 1 16 0v3c13 6 20 20 20 39v6h8v8H14v-8h8v-6c0-19 7-33 20-39z" },
    { key: "leaf", x: 18, y: 52.56, fill: "var(--chakra-colors-suit-leaf)", d: "M50 8C32 26 12 40 12 58a20 20 0 0 0 33 15l-3 19h16l-3-19a20 20 0 0 0 33-15C88 40 68 26 50 8Z" },
    { key: "acorn", x: 52.56, y: 52.56, fill: "var(--chakra-colors-suit-acorn)", d: "M46 8h8v8h-8z M22 42c0-16 12-26 28-26s28 10 28 26v6H22z M27 54h46c0 20-11 34-23 38C38 88 27 74 27 54Z" },
] as const

/** Cell edge in logo units (`scale(0.2944)` of a 100-unit glyph). */
const CELL = 29.44
const DURATION = "1s"
const EASING = "cubic-bezier(0.65, 0, 0.35, 1)"

export default function SuitSpinner({ size = "md", label }: {
    size?: SuitSpinnerSize
    /** Accessible name; defaults to the shared "Učitavanje…". */
    label?: string
}) {
    const { t } = useTranslation()
    const px = SIZES[size]
    return (
        <chakra.span
            role="status"
            aria-label={label ?? t("common.loading")}
            display="inline-block"
            flexShrink={0}
            lineHeight="0"
            w={`${px}px`}
            h={`${px}px`}
        >
            <chakra.svg
                viewBox="0 0 100 100"
                w="full"
                h="full"
                overflow="visible"
                aria-hidden="true"
                css={{
                    transformOrigin: "50% 50%",
                    animation: `${orbit} ${DURATION} ${EASING} infinite`,
                    "@media (prefers-reduced-motion: reduce)": {
                        animation: `${pulse} 1.6s ease-in-out infinite`,
                    },
                }}
            >
                {SUITS.map((suit) => (
                    <chakra.g
                        key={suit.key}
                        css={{
                            // Turn about the centre of this suit's own cell.
                            transformBox: "view-box",
                            transformOrigin: `${suit.x + CELL / 2}px ${suit.y + CELL / 2}px`,
                            animation: `${upright} ${DURATION} ${EASING} infinite`,
                            "@media (prefers-reduced-motion: reduce)": { animation: "none" },
                        }}
                    >
                        <g transform={`translate(${suit.x} ${suit.y}) scale(0.2944)`} fill={suit.fill}>
                            <path d={suit.d} />
                        </g>
                    </chakra.g>
                ))}
            </chakra.svg>
        </chakra.span>
    )
}
