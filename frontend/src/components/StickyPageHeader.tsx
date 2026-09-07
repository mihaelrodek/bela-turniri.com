import { useEffect, useRef } from "react"
import { Box, type BoxProps } from "@chakra-ui/react"
import { NAVBAR_TOP } from "./navChrome"

/* ──────────────────────────────────────────────────────────────────────────
   StickyPageHeader — the one mobile page header in the app.

   Two screens pin an identity band under the navbar on phones and tablets:
   the tournament detail shell (title + status + section pills) and the
   owner's profile (avatar + name + section pills). They used to build that
   band inline, twice, and both inherited the same three defects:

     • They sat INSIDE the app Container, so the painted band stopped 16px
       short of each screen edge and page content scrolled visibly through
       those two gutters — a card floating under the navbar rather than a
       continuation of it.
     • The pill strip bled only 4px (`mx="-1"`), so the active pill was
       clipped against the band's own edge instead of running to the screen
       edge, and there was no hint that the row scrolls at all.
     • Nothing scrolled the active pill into view, so selecting a section
       from a deep-linked tab left the current pill off-screen.

   This module fixes all three once. `StickyPageHeader` is the full-bleed
   frosted band; `StickyHeaderStrip` is the horizontally scrollable row that
   lives inside it.

   Full bleed without `100vw`
   ──────────────────────────
   `100vw` includes the scrollbar and would overflow the document. Instead
   the band cancels the Container's own horizontal padding with an exactly
   equal negative margin and pays it straight back as its own padding. That
   is only exact while the Container is narrower than its `maxW="6xl"` — true
   at every breakpoint these headers render at (both hide from `lg` up, and
   `lg` is 992px, well under 1152px).
   ────────────────────────────────────────────────────────────────────── */

/** The app Container's horizontal padding — `<Container maxW="6xl" py={6}>`
 *  in App.tsx takes Chakra's default `px: { base: 4, md: 6, lg: 8 }`. Only
 *  the two breakpoints these headers are visible at are listed. Keep in sync
 *  with that Container. */
const PAGE_GUTTER_X = { base: "4", md: "6" } as const
const PAGE_GUTTER_X_NEG = { base: "-4", md: "-6" } as const
/** The same two figures as raw lengths — `scroll-padding-inline` is not a
 *  spacing-token prop, so it has to be written out in the `css` escape. */
const PAGE_GUTTER_LEN = { base: "16px", md: "24px" } as const

/** The Container's `py={6}`. The band swallows it and pays it back as
 *  padding, so the painted surface is flush with the navbar's bottom edge
 *  from the very first pixel of scroll instead of catching 24px late. */
const CONTAINER_PY = "24px"

/**
 * The pinned band itself: edge to edge, square, hairline-bottomed, on the
 * same frosted surface as the navbar directly above it so the two read as
 * one piece of chrome. Callers supply the `display` that hides it on the
 * breakpoints where their desktop shell takes over.
 */
export function StickyPageHeader({ children, ...rest }: BoxProps) {
    return (
        <Box
            position="sticky"
            top={NAVBAR_TOP}
            zIndex={100}
            layerStyle="glass.bar"
            mx={PAGE_GUTTER_X_NEG}
            px={PAGE_GUTTER_X}
            mt={`-${CONTAINER_PY}`}
            pt={CONTAINER_PY}
            pb="2"
            mb="4"
            rounded="none"
            borderBottomWidth="1px"
            borderColor="border.subtle"
            {...rest}
        >
            {children}
        </Box>
    )
}

/**
 * A horizontally scrollable row inside the band — the section pills.
 *
 * It bleeds to the screen edges (so a pill can scroll fully out of sight
 * rather than being clipped by a margin) but keeps the page gutter as its
 * own padding AND as its `scroll-padding`, so a snapped pill lines up with
 * the page content beneath it. The scrollbar is hidden on every engine;
 * `scroll-snap` on the inline axis is `proximity`, not `mandatory`, so a
 * deliberate half-scroll to peek at the next label is allowed to stay.
 *
 * `activeKey` is not read for rendering: it is the change signal that
 * scrolls the marked child (`data-nav-active="true"`) back into view. The
 * marker is a custom attribute rather than `data-active`, which Chakra's
 * `_active` pseudo already claims.
 */
export function StickyHeaderStrip({
    activeKey,
    children,
    ...rest
}: BoxProps & { activeKey: string }) {
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const el = ref.current?.querySelector<HTMLElement>('[data-nav-active="true"]')
        // `inline: nearest` scrolls this strip only as far as it must, and
        // `block: nearest` keeps it from dragging the whole page vertically
        // — with the pill already on screen the call is a no-op.
        el?.scrollIntoView({ inline: "nearest", block: "nearest" })
    }, [activeKey])

    return (
        <Box
            ref={ref}
            overflowX="auto"
            // Hidden rather than left to compute to `auto`: a sideways strip
            // must never grow a vertical scrollbar of its own. `py` is the
            // room that buys — a focus ring (2px at 1px offset) has somewhere
            // to be drawn instead of being sheared off by the clip.
            overflowY="hidden"
            py="1"
            mx={PAGE_GUTTER_X_NEG}
            px={PAGE_GUTTER_X}
            css={{
                scrollPaddingInline: PAGE_GUTTER_LEN,
                scrollSnapType: "inline proximity",
                overscrollBehaviorX: "contain",
                scrollbarWidth: "none",
                "&::-webkit-scrollbar": { display: "none" },
            }}
            {...rest}
        >
            {children}
        </Box>
    )
}
