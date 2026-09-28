import { Center, Text, VStack, chakra } from "@chakra-ui/react"
import { keyframes } from "@emotion/react"
import { useTranslation } from "../i18n"
import BrandMark from "./BrandMark"

/* ──────────────────────────────────────────────────────────────────────────
   SuitSpinner — the app's page-level loading mark. It renders the current
   product mark through BrandMark, so bela-turniri follows its light/dark logo
   and bela.games keeps its separate identity.

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
            <BrandMark
                w="full"
                h="full"
                aria-hidden="true"
                css={{
                    transformOrigin: "50% 50%",
                    animation: `${orbit} ${DURATION} ${EASING} infinite`,
                    "@media (prefers-reduced-motion: reduce)": {
                        animation: `${pulse} 1.6s ease-in-out infinite`,
                    },
                }}
            />
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
