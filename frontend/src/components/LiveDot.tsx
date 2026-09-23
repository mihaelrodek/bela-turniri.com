import { Box } from "@chakra-ui/react"
import { keyframes } from "@emotion/react"

/* ──────────────────────────────────────────────────────────────────────────
   LiveDot — small pulsing "ok"-coloured dot, the nav's live-room indicator
   (NavBar's "Igraj · 3 sobe" pill, MobileTabBar's count badge on the centre
   button — both from useGameStats.ts, 2026-09-22).

   Module-scope keyframes: a nested "@keyframes" inside Chakra's `css` prop
   does not run (see game/components/RoomListItem.tsx, components/
   SuitSpinner.tsx). The animation is disabled via the same
   `@media (prefers-reduced-motion: reduce)` guard SuitSpinner uses rather
   than the game package's `usePrefersReducedMotion` hook — this component
   lives outside `src/game/`, so it follows the app-shell convention instead
   of reaching into the game workspace for a plain media-query check. Ends on
   full opacity/no ring, so a reduced-motion browser (which never starts the
   animation) still shows a plain, visible dot rather than nothing.
   ────────────────────────────────────────────────────────────────────── */

const pulse = keyframes`
    0%   { box-shadow: 0 0 0 0 color-mix(in srgb, var(--chakra-colors-ok) 55%, transparent); }
    70%  { box-shadow: 0 0 0 5px color-mix(in srgb, var(--chakra-colors-ok) 0%, transparent); }
    100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--chakra-colors-ok) 0%, transparent); }
`

export default function LiveDot({ size = "6px" }: { size?: string }) {
    return (
        <Box
            as="span"
            aria-hidden="true"
            boxSize={size}
            rounded="full"
            bg="ok"
            flexShrink={0}
            css={{
                animation: `${pulse} 2s ease-out infinite`,
                "@media (prefers-reduced-motion: reduce)": { animation: "none" },
            }}
        />
    )
}
