import type { ReactNode } from "react"
import { Badge, Box, chakra, Flex, Heading, HStack, Text } from "@chakra-ui/react"
import { useTranslation } from "../i18n"
import { CONTENT_STICKY_TOP, NAVBAR_H } from "./navChrome"
import { StickyHeaderStrip, StickyPageHeader } from "./StickyPageHeader"

/* ──────────────────────────────────────────────────────────────────────────
   TournamentSidebar — the navigation shell of the tournament detail screen.

   Two renderings of the SAME section model, mirroring the sibling futsal app:

     • `TournamentSidebar`  — lg+ only. A 244px column pinned under the navbar
       with `position: sticky`; the tournament name, its status pill, a
       VERTICAL section nav, the organiser actions, and whatever extra cards
       the page passes as `children` (today: the results card).

     • `TournamentMobileBar` — base→lg. The same content squeezed into a
       compact sticky band: one row of title + status + actions, and a second
       row with the sections as a horizontally scrollable pill switcher.

   Only one of the two is ever visible, but BOTH are always in the DOM (they
   are toggled with `display`, not unmounted, so switching breakpoints never
   drops React state). The guided tour resolves its anchors with a plain
   `document.querySelector`, which would happily latch onto the hidden copy —
   hence `tourAnchors`: the page passes `true` to exactly one of the two.

   Sticky offsets
   ──────────────
   Both shells derive their `top` from `components/navChrome.ts`, the single
   source of truth for the navbar's rendered height — the values used to be
   hard-coded here and drifted the moment the header changed size. The
   desktop column pins at CONTENT_STICKY_TOP (navbar + the app Container's
   24px top padding); the mobile band's own offset, its full-bleed geometry
   and the Container-padding swallow all live in `StickyPageHeader`, shared
   with the profile page's identical band.

   `SIDEBAR_MAX_H` needs one CSS length, not a breakpoint object, so it is
   built from NAVBAR_H's md value — the only breakpoint at which the desktop
   sidebar is rendered at all.
   ────────────────────────────────────────────────────────────────────── */

/** NavBar + the app Container's `py={6}` — where the content column rests. */
const SIDEBAR_TOP = CONTENT_STICKY_TOP
/** Viewport height left for the pinned column, minus a 16px breathing gap. */
const SIDEBAR_MAX_H = `calc(100vh - ${NAVBAR_H.md + 24}px - 16px - env(safe-area-inset-top, 0px))`

export type TournamentSectionDef = {
    /** Stable key, also the page's `tab` state value. */
    key: string
    label: string
    icon: ReactNode
    /** `data-tour` anchor name, applied only in the visible shell. */
    tour?: string
}

type NavProps = {
    sections: TournamentSectionDef[]
    active: string
    onSelect: (key: string) => void
    /** True in the shell that currently owns the guided-tour anchors. */
    tourAnchors: boolean
}

/* ---------- Status pill ---------- */

/**
 * The tournament's lifecycle state as a single pill: DRAFT is neutral,
 * STARTED is brand blue, FINISHED is yellow. Sits directly under the
 * tournament name in both shells.
 */
export function TournamentStatusPill({ status }: { status?: string | null }) {
    const { t: tr } = useTranslation()
    const kind = status === "STARTED" ? "started" : status === "FINISHED" ? "finished" : "draft"
    const cfg = {
        draft: { label: tr("tournament.status.draft"), palette: "gray" },
        started: { label: tr("tournament.status.started"), palette: "brand" },
        finished: { label: tr("tournament.status.finished"), palette: "yellow" },
    } as const
    return (
        <Badge variant="solid" colorPalette={cfg[kind].palette} size="sm" rounded="full" px="2.5">
            {cfg[kind].label}
        </Badge>
    )
}

/* ---------- Desktop vertical nav row ---------- */

/**
 * One row of the desktop sidebar nav. Active is a solid brand pill; inactive
 * is muted text that picks up a quiet fill on hover — the same weight change
 * futsal uses, so the active row reads without relying on colour alone.
 */
function SidebarNavItem({
    icon,
    label,
    active,
    tour,
    onClick,
}: {
    icon: ReactNode
    label: string
    active: boolean
    tour?: string
    onClick: () => void
}) {
    return (
        <chakra.button
            type="button"
            onClick={onClick}
            data-tour={tour}
            aria-current={active ? "page" : undefined}
            display="flex"
            alignItems="center"
            gap="2.5"
            w="full"
            textAlign="left"
            px="3"
            py="2"
            rounded="lg"
            fontSize="sm"
            fontWeight={active ? "bold" : "medium"}
            colorPalette="brand"
            bg={active ? "colorPalette.solid" : "transparent"}
            color={active ? "colorPalette.contrast" : "fg.soft"}
            cursor="pointer"
            transition="background 120ms, color 120ms"
            _hover={{ bg: active ? "colorPalette.solid" : "bg.subtle", color: active ? "colorPalette.contrast" : "fg.ink" }}
        >
            <Box display="flex" alignItems="center" flexShrink={0}>
                {icon}
            </Box>
            {label}
        </chakra.button>
    )
}

/* ---------- Desktop sidebar ---------- */

/**
 * The lg+ sidebar. Rendered as a flow-level 244px column so the content
 * column can simply take the remaining width; the pinned card lives INSIDE
 * it. The wrapper must stretch to the full height of the page row (the page
 * uses the default `align="stretch"` on the surrounding Flex) — a sticky box
 * can only travel inside its containing block, so a shrink-to-fit wrapper
 * would unpin the card the moment the column's own bottom edge scrolled by.
 */
export function TournamentSidebar({
    name,
    status,
    sections,
    active,
    onSelect,
    tourAnchors,
    primaryActions,
    iconActions,
    topSlot,
    children,
}: NavProps & {
    name: string
    status?: string | null
    /** Labelled buttons (Uredi / Obriši) shown above the icon row. */
    primaryActions?: ReactNode
    /** Icon-only secondary actions (share / calendar / QR). */
    iconActions?: ReactNode
    /** Small slot above the heading — the back link and sync indicator. */
    topSlot?: ReactNode
    /** Extra cards stacked under the menu card (the results card). */
    children?: ReactNode
}) {
    return (
        <Box w="244px" flexShrink={0} display={{ base: "none", lg: "block" }}>
            <Flex
                direction="column"
                gap="3"
                position="sticky"
                top={SIDEBAR_TOP}
                // Viewport-bound: a finished tournament adds the results card,
                // which on a short laptop screen would otherwise push the nav
                // out of reach. Anything taller scrolls inside the column.
                maxH={SIDEBAR_MAX_H}
                overflowY="auto"
                overscrollBehavior="contain"
                css={{
                    scrollbarWidth: "thin",
                    "&::-webkit-scrollbar": { width: "6px" },
                    "&::-webkit-scrollbar-track": { background: "transparent" },
                    "&::-webkit-scrollbar-thumb": {
                        background: "var(--chakra-colors-border-emphasized)",
                        borderRadius: "999px",
                    },
                }}
            >
                <Box
                    flexShrink={0}
                    bg="bg.panel"
                    borderWidth="1px"
                    borderColor="border"
                    rounded="xl"
                    shadow="card"
                    p="3"
                >
                    {topSlot && <Box mb="2">{topSlot}</Box>}
                    <Heading
                        as="h1"
                        size="sm"
                        px="1"
                        lineHeight="1.3"
                        letterSpacing="-0.01em"
                        lineClamp={3}
                    >
                        {name}
                    </Heading>
                    <Flex justify="center" px="1" pt="2" pb="3">
                        <TournamentStatusPill status={status} />
                    </Flex>

                    <Flex direction="column" gap="0.5">
                        {sections.map((s) => (
                            <SidebarNavItem
                                key={s.key}
                                icon={s.icon}
                                label={s.label}
                                active={active === s.key}
                                tour={tourAnchors ? s.tour : undefined}
                                onClick={() => onSelect(s.key)}
                            />
                        ))}
                    </Flex>

                    {(primaryActions || iconActions) && (
                        <Box borderTopWidth="1px" borderColor="border.subtle" mt="3" pt="3">
                            {primaryActions && (
                                <Flex gap="2" mb={iconActions ? "2" : "0"}>
                                    {primaryActions}
                                </Flex>
                            )}
                            {iconActions && (
                                <Flex gap="1" align="center" justify="center">
                                    {iconActions}
                                </Flex>
                            )}
                        </Box>
                    )}
                </Box>

                {children}
            </Flex>
        </Box>
    )
}

/* ---------- Mobile band ---------- */

/**
 * The base→lg shell. Everything the sidebar carries, folded into two rows
 * that stay pinned under the navbar for the whole page — so switching
 * sections never needs a scroll back to the top.
 *
 * The section switcher scrolls horizontally rather than wrapping: four
 * Croatian labels do not fit a 390px phone, and a wrapping row would make
 * the pinned band tall enough to eat a third of the screen. It runs to both
 * screen edges (see `StickyHeaderStrip`) so the row visibly continues past
 * the viewport instead of looking like a clipped card, and the active pill
 * is scrolled back into view whenever the section changes.
 */
export function TournamentMobileBar({
    name,
    status,
    sections,
    active,
    onSelect,
    tourAnchors,
    actions,
}: NavProps & {
    name: string
    status?: string | null
    /** Trailing slot on the title row — icon buttons and the overflow menu. */
    actions?: ReactNode
}) {
    const { t: tr } = useTranslation()
    return (
        <StickyPageHeader display={{ base: "block", lg: "none" }}>
            <HStack align="flex-start" gap="2" mb="2.5">
                <Box flex="1" minW="0">
                    <Heading
                        as="h1"
                        size={name.length > 34 ? "sm" : "md"}
                        lineHeight="1.25"
                        letterSpacing="-0.01em"
                        lineClamp={2}
                    >
                        {name}
                    </Heading>
                    <Box pt="1.5">
                        <TournamentStatusPill status={status} />
                    </Box>
                </Box>
                {actions && (
                    <HStack gap="1" flexShrink={0}>
                        {actions}
                    </HStack>
                )}
            </HStack>

            <StickyHeaderStrip
                as="nav"
                aria-label={tr("tournament.nav.sectionsAria")}
                activeKey={active}
            >
                <HStack gap="1.5" minW="max-content">
                    {sections.map((s) => {
                        const isActive = active === s.key
                        return (
                            <chakra.button
                                key={s.key}
                                type="button"
                                onClick={() => onSelect(s.key)}
                                data-tour={tourAnchors ? s.tour : undefined}
                                data-nav-active={isActive ? "true" : undefined}
                                aria-current={isActive ? "page" : undefined}
                                display="flex"
                                alignItems="center"
                                gap="1.5"
                                flexShrink={0}
                                px="3"
                                py="1.5"
                                rounded="full"
                                fontSize="sm"
                                fontWeight={isActive ? "bold" : "medium"}
                                colorPalette="brand"
                                bg={isActive ? "colorPalette.solid" : "bg.subtle"}
                                color={isActive ? "colorPalette.contrast" : "fg.soft"}
                                borderWidth="1px"
                                borderColor={isActive ? "colorPalette.solid" : "border.subtle"}
                                cursor="pointer"
                                transition="background 120ms, color 120ms"
                                css={{ scrollSnapAlign: "start" }}
                            >
                                <Box display="flex" alignItems="center">{s.icon}</Box>
                                <Text as="span" whiteSpace="nowrap">{s.label}</Text>
                            </chakra.button>
                        )
                    })}
                </HStack>
            </StickyHeaderStrip>
        </StickyPageHeader>
    )
}
