import { Center, Text, VStack, chakra } from "@chakra-ui/react"
import { keyframes } from "@emotion/react"
import { useTranslation } from "../i18n"
import { isGamesSite } from "../site"
import BrandMark from "./BrandMark"

/* ──────────────────────────────────────────────────────────────────────────
   SuitSpinner — the app's page-level loading mark. It renders the current
   product mark through BrandMark, so bela-turniri follows its light/dark logo
   and bela.games keeps its separate identity.

   bela.games is the one exception (2026-09-29, user request): its mark is a
   rounded-square background tile with the four suits laid out in a 2×2 grid
   ON it, and spinning the whole tile as one image made the square itself —
   its rounded corners, its fill colour — read as part of the loading
   animation instead of as chrome the suits sit on. `GamesSuitMark` below
   reproduces that SVG (`public/games/symbol.svg`) inline, but WITHOUT its
   `<rect>` tile: just the four suit `<g>`s, on whatever surface the spinner
   is placed on. bela-turniri's mark stays on the BrandMark path: its
   fan-of-cards artwork is a single interlocking shape, not glyphs on a tile,
   so dropping a "background" from it isn't the same operation.

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
const pulse = keyframes`
    0%, 100% { opacity: 1; }
    50%      { opacity: 0.45; }
`

const SIZES = { sm: 28, md: 40, lg: 56, xl: 80 } as const
export type SuitSpinnerSize = keyof typeof SIZES

const DURATION = "1s"
const EASING = "cubic-bezier(0.65, 0, 0.35, 1)"

const ORBIT_KEYFRAMES = {
    animation: `${orbit} ${DURATION} ${EASING} infinite`,
    "@media (prefers-reduced-motion: reduce)": {
        animation: `${pulse} 1.6s ease-in-out infinite`,
    },
} as const

/** For BrandMark's whole-image orbit: a plain box, so a percentage origin
 *  resolves against its own rendered size same as any HTML element,
 *  correctly at every `size` prop. */
const ORBIT_CSS = { transformOrigin: "50% 50%", ...ORBIT_KEYFRAMES } as const

/** For the `<g>` inside `GamesSuitMark` below: an SVG child element's
 *  transform-origin resolves in the nearest viewport's user-space
 *  (the viewBox), not against its own rendered CSS pixel size or its own
 *  bounding box, so this is `viewBox` coordinates — the tile's actual
 *  centre — not a percentage, and it stays correct at every `size`. */
const SVG_ORBIT_CSS = { transformOrigin: "50px 50px", ...ORBIT_KEYFRAMES } as const

/**
 * bela.games's mark, inlined from `public/games/symbol.svg` — same viewBox,
 * same four paths, same fills, so it never drifts from that file — MINUS its
 * `<rect>` background tile (2026-09-29, user follow-up: "idalje se u
 * spinneru prikazuje pozadina" — dropping only the rotation wasn't enough,
 * the tile itself has to go). What is left is just the four glyphs, on
 * whatever surface the spinner sits on.
 */
function GamesSuitMark({ px }: { px: number }) {
    return (
        <svg viewBox="0 0 100 100" width={px} height={px} aria-hidden="true">
            <chakra.g css={SVG_ORBIT_CSS}>
                <g transform="translate(18 18) scale(0.29440)" fill="#E24B4A">
                    <path d="M50 88C22 66 10 52 10 33a20 20 0 0 1 40-8a20 20 0 0 1 40 8c0 19-12 33-40 55Z" />
                </g>
                <g transform="translate(52.56 18) scale(0.29440)" fill="#F2C14E">
                    <path d="M42 20a8 8 0 0 1 16 0v3c13 6 20 20 20 39v6h8v8H14v-8h8v-6c0-19 7-33 20-39z" />
                </g>
                <g transform="translate(18 52.56) scale(0.29440)" fill="#4DA66A">
                    <path d="M50 8C32 26 12 40 12 58a20 20 0 0 0 33 15l-3 19h16l-3-19a20 20 0 0 0 33-15C88 40 68 26 50 8Z" />
                </g>
                <g transform="translate(52.56 52.56) scale(0.29440)" fill="#B8823F">
                    <path d="M46 8h8v8h-8z M22 42c0-16 12-26 28-26s28 10 28 26v6H22z M27 54h46c0 20-11 34-23 38C38 88 27 74 27 54Z" />
                </g>
            </chakra.g>
        </svg>
    )
}

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
            {isGamesSite ? (
                <GamesSuitMark px={px} />
            ) : (
                <BrandMark w="full" h="full" aria-hidden="true" css={ORBIT_CSS} />
            )}
        </chakra.span>
    )
}

/** A whole-page wait: the mark, big, in the MIDDLE of the screen (2026-09-21,
 *  reported — a bare `<SuitSpinner />` returned from a gate rendered as a
 *  small mark in the page's top-left corner, where nobody looks). `label`
 *  puts a line of text under it; without one only the accessible name says
 *  what is happening. */
export function PageLoading({ label, minH = "60vh" }: { label?: string; minH?: string }) {
    return (
        <Center minH={minH} w="full">
            <VStack gap="4">
                <SuitSpinner size="xl" label={label} />
                {label && <Text color="fg.muted">{label}</Text>}
            </VStack>
        </Center>
    )
}
