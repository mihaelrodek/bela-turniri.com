import React, { useEffect, useState, type ReactNode } from "react"
import {
    Box, Flex, HStack, IconButton, Image, Button, Container, Menu, Switch, Text, chakra, useBreakpointValue,
    CloseButton, Drawer, Portal, VStack,
} from "@chakra-ui/react"
import { Link as RouterLink, useLocation, useMatch, useResolvedPath, useNavigate } from "react-router-dom"
import { CardsIcon } from "./MobileTabBar"
import {
    FiCalendar, FiEdit3, FiExternalLink, FiHome, FiLogOut, FiMap, FiMenu, FiMoon, FiSun, FiUser, FiVolume2,
} from "react-icons/fi"
import { useAuth } from "../auth/authContextValue"
import { useColorMode } from "../color-mode-hooks"
import { GAMES_BRAND_NAME, GAMES_ORIGIN, homePath, isGamesSite, siteName, brand } from "../site"
import { updateColorMode } from "../api/userMe"
import { useGameEnabled } from "../game/hooks/useGameEnabled"
import { useGameStats } from "../game/hooks/useGameStats"
import { useInstallPrompt, type InstallPromptState } from "../hooks/useInstallPrompt"
import { useInvalidateMyProfile, useMyProfile } from "../hooks/useMyProfile"
import { useTranslation, usePlural } from "../i18n"
import UserAvatar from "./avatars/UserAvatar"
import { InstallAppButton } from "./InstallAppButton"
import LanguagePicker from "./LanguagePicker"
import LiveDot from "./LiveDot"
import { NAVBAR_H } from "./navChrome"
import { open as openWhatsNew, useHasUnseenWhatsNew } from "../whatsNew/store"
import { usePrefetchRoute } from "../hooks/usePrefetchRoute"
import NewBadge from "./NewBadge"
import {
    calendarPageFactory,
    profilePageFactory,
} from "../routes/lazyPages"

/** Map route paths to their chunk factories for prefetching. */
const PREFETCH_MAP: Record<string, (() => Promise<unknown>) | undefined> = {
    "/kalendar": calendarPageFactory,
    "/karta": undefined, // Leaflet is heavy; excluded from prefetch
    "/profil": profilePageFactory,
}

/**
 * Inner height of the bar, i.e. NAVBAR_H minus the 1px bottom hairline.
 * Pinned explicitly rather than derived from padding + content so the header
 * measures EXACTLY what navChrome promises — several screens (tournament
 * sidebar, mobile section band, the map's computed height) position
 * themselves against those numbers and a drift shows up as a gap or overlap.
 */
const BAR_H = {
    base: `${NAVBAR_H.base - 1}px`,
    md: `${NAVBAR_H.md - 1}px`,
}

/**
 * One pill inside the desktop nav capsule below.
 *
 * The links used to float straight on the bar with only the active one
 * carrying a filled background, so the row read as "one button plus some
 * loose text". They now live inside a single rounded container (see
 * `NavCapsule`) and each is a pill within it, which makes the group read as
 * one segmented control — the sibling app's treatment.
 *
 * Colours are semantic tokens, so both themes work without a
 * `useColorModeValue` round-trip: the inactive pill is transparent against
 * the capsule's `bg.subtle` and hovers to `bg.muted`, which is one step
 * LOUDER than the capsule in both directions of the ladder (light
 * gray.50 → gray.100, dark gray.800 → gray.700). Hovering to `bg.panel`
 * would have gone the wrong way in dark and read as a hole in the capsule.
 */
function NavButton({
                       to, exact, icon, accent, isNew, liveBadge, children, onClick,
                   }: {
    to: string
    exact?: boolean
    /** Same glyph the mobile tab bar uses for this destination — see NAV_ITEMS. */
    icon?: ReactNode
    /**
     * Painted as filled even when it is not the current page ("Igraj").
     *
     * The mobile bar gives that destination a raised disc in its middle slot;
     * this is the same emphasis at desktop width, so the two navigations keep
     * agreeing about what stands out. It changes nothing about behaviour — the
     * active pill still wins when you are actually there, so the accent never
     * claims you are on a page you are not.
     */
    accent?: boolean
    isNew?: boolean
    /**
     * Rendered instead of the NOVO badge when present (still hidden while
     * active, same as `isNew`) — the "Igraj · 3 sobe" live-room pill. `null`
     * or `undefined` falls back to the ordinary `isNew` badge, so a caller
     * only has to pass this for the one destination that has live data.
     */
    liveBadge?: React.ReactNode
    children: React.ReactNode
    onClick?: () => void
}) {
    const resolved = useResolvedPath(to)
    const match = useMatch({ path: resolved.pathname, end: !!exact })
    const isActive = !!match
    const prefetch = usePrefetchRoute(PREFETCH_MAP[to])

    return (
        <Button
            asChild
            /* SOLID means "you are here" and nothing else — 2026-09-08, user
               report. The accent used to be solid too, so "Igraj" looked
               exactly like the current page and neither could be read for what
               it was. `subtle` is a pale brand tint: unmistakably highlighted,
               unmistakably not the active pill. When you actually ARE on
               /igra, `isActive` wins and it fills in like every other tab. */
            variant={isActive ? "solid" : accent ? "subtle" : "ghost"}
            colorPalette="brand"
            size="sm"
            // `full` is a real step on the theme's radii scale (src/system.ts),
            // not a hard-coded corner.
            rounded="full"
            px="3"
            gap="1.5"
            color={isActive ? undefined : accent ? "colorPalette.fg" : "fg.soft"}
            _hover={isActive ? undefined : accent ? { bg: "colorPalette.muted" } : { bg: "bg.muted", color: "fg" }}
            onClick={onClick}
            onPointerEnter={prefetch}
            onFocus={prefetch}
        >
            <RouterLink to={to}>
                {/* The icon is decorative here — the link's own text is the
                    accessible name, so no aria-label and no title. */}
                {icon && <Box as="span" display="inline-flex" flexShrink="0" aria-hidden="true">{icon}</Box>}
                <Box as="span" position="relative" display="inline-flex" alignItems="center">
                    {children}
                    {!isActive && (liveBadge ?? (isNew && <NewBadge ml="1.5" />))}
                </Box>
            </RouterLink>
        </Button>
    )
}

/**
 * The five destinations, in order, shared by BOTH navigations.
 *
 * The desktop capsule below and `MobileTabBar` render the same list with the
 * same icons and the same labels, so the two bars read as one navigation seen
 * at two widths rather than as two different menus. Each bar keeps its own
 * array (they render very differently), but the CONTENTS must stay in step —
 * change one, change the other.
 *
 * Deliberately absent:
 *   - "Kreiraj turnir" — an action, not a place. It lives in the /turniri
 *     toolbar (TournamentsPage) and in that page's empty state.
 *   - "Pronađi para" — the /pronadi-para page still exists and is still
 *     reachable by URL; it is only out of the menus for now.
 *   - "Profil" — the avatar in the top-right corner is the way there.
 *
 * "Igraj" is ALWAYS here, including in production while the online-bela kill
 * switch (game/hooks/useGameEnabled.ts) is off. The flag no longer decides
 * whether the destination is visible, only whether it is playable: with it
 * off, /igra renders the "dolazi uskoro" page (src/game/GameFeatureGate.tsx).
 * Do not reintroduce a `gameEnabled` filter here — a menu that grows an item
 * a second after load is worse than one that always tells the truth.
 */
type NavItem = {
    to: string
    label: string
    icon: ReactNode
    /** Exact match, so `/turniri` doesn't stay lit on `/turniri/:slug`. */
    exact?: boolean
    /** Filled even when it is not the current page — see `NavButton`. */
    accent?: boolean
    isNew?: boolean
}

function buildNavItems(t: (key: string) => string): NavItem[] {
    const items: NavItem[] = [
        { to: "/turniri", label: t("common.nav.turniri"), icon: <FiHome size={16} />, exact: true },
        { to: "/kalendar", label: t("common.nav.kalendar"), icon: <FiCalendar size={16} /> },
        // Online bela (src/game), dead centre — the same slot it holds in the
        // mobile tab bar, where the middle is the thumb's home position. Its
        // label lives in the `game` namespace, not in `common`.
        // The same card mark the mobile bar's centre disc carries — the two
        // bars are one navigation seen at two widths (MobileTabBar's header).
        { to: "/igra", label: t("common.nav.igraj"), icon: <CardsIcon size={16} />, accent: true, isNew: true },
        { to: "/karta", label: t("common.nav.karta"), icon: <FiMap size={16} /> },
        // Bela blok (src/blok) — public offline scorepad, no feature flag, no
        // auth. Its label lives in the `blok` namespace with the rest of that
        // subtree.
        { to: "/blok", label: t("common.nav.blok"), icon: <FiEdit3 size={16} /> },
    ]
    // bela.games (src/site.ts) has no tournaments, calendar or map — only
    // the game and the scorepad stay in the nav.
    if (isGamesSite) return items.filter((item) => item.to === "/igra" || item.to === "/blok")
    return items
}

/**
 * The segmented container the desktop nav pills sit in.
 *
 * Height budget: this renders only inside the md+ grid, whose row height is
 * pinned to `BAR_H` (NAVBAR_H − 1px hairline = 51px on md). A `size="sm"`
 * Button is 32px, plus `p="1"` (4px twice) and the 1px hairline twice → 42px,
 * comfortably inside 51px. The capsule therefore changes the padding AROUND
 * the links, never the bar's total height, which several screens read back
 * out of `navChrome.ts`.
 *
 * The fill and the hairline carry each other across the themes: in light the
 * `bg.subtle` fill (gray.50) is nearly invisible on the white/glass bar and
 * the `border.subtle` hairline draws the container; in dark the fill
 * (gray.800) does the work over the gray.900 bar and the hairline (also
 * gray.800) simply disappears into it. Neither theme ends up with an
 * invisible or a heavy box.
 */
function NavCapsule({ children, tourAnchor }: { children: React.ReactNode; tourAnchor?: string }) {
    return (
        <HStack
            data-tour={tourAnchor}
            gap="0.5"
            justify="center"
            bg="bg.subtle"
            borderWidth="1px"
            borderColor="border.subtle"
            rounded="full"
            p="1"
        >
            {children}
        </HStack>
    )
}

/**
 * "Novosti" row, shared by both the guest hamburger and the signed-in avatar
 * menu — same megaphone icon and unseen dot as `WhatsNewFab`, just as a menu
 * item instead of a floating button. `onSelect` opens the dialog directly
 * (no navigation involved), same as the theme switch/language picker beside
 * it not needing a route.
 */
function NovostiMenuItem() {
    const { t } = useTranslation()
    const unseen = useHasUnseenWhatsNew()
    return (
        <Menu.Item value="novosti" onSelect={openWhatsNew}>
            <FiVolume2 />
            {t("common.nav.novosti")}
            {unseen && (
                <Box
                    boxSize="6px"
                    rounded="full"
                    bg="fg.error"
                    ml="1"
                    aria-hidden="true"
                />
            )}
        </Menu.Item>
    )
}

/** Small uppercase section heading inside the dropdowns ("TEMA" / "JEZIK"). */
function MenuSectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <Text
            fontSize="2xs"
            fontWeight="bold"
            letterSpacing="wider"
            textTransform="uppercase"
            color="fg.muted"
        >
            {children}
        </Text>
    )
}

/**
 * Sun/moon slider driving the ONE colour-mode mechanism (`src/color-mode`,
 * next-themes). Flipping it applies the theme locally straight away and, when
 * signed in, persists the choice to the profile exactly like the Postavke tab
 * does — `updateColorMode` + a `qk.profile` invalidation so `ThemeSync` reads
 * the new value back instead of handing the stale one out on the next login.
 */
function ThemeSwitch() {
    const { colorMode, setColorMode } = useColorMode()
    const { user } = useAuth()
    const { t } = useTranslation()
    const invalidateMyProfile = useInvalidateMyProfile()

    async function apply(dark: boolean) {
        const next = dark ? "dark" : "light"
        // Flip locally first — the network round-trip only confirms the save.
        setColorMode(next)
        if (!user) return
        try {
            await updateColorMode(next)
            await invalidateMyProfile()
        } catch {
            // Best-effort: the local theme is already right and the next
            // login resyncs via ThemeSync.
        }
    }

    return (
        <Switch.Root
            checked={colorMode === "dark"}
            onCheckedChange={(e) => { void apply(e.checked) }}
            colorPalette="blue"
            size="lg"
        >
            <Switch.HiddenInput aria-label={t("common.nav.themeLabel")} />
            <Switch.Control>
                <Switch.Thumb>
                    <Switch.ThumbIndicator fallback={<FiSun size={13} />}>
                        <FiMoon size={13} />
                    </Switch.ThumbIndicator>
                </Switch.Thumb>
            </Switch.Control>
        </Switch.Root>
    )
}

/**
 * Install row. Gated on `useInstallPrompt()` here rather than relying on
 * InstallAppButton's own early return, because the surrounding padded and
 * bordered row must disappear too — otherwise browsers that can't install
 * would show an empty divider strip at the bottom of the menu.
 */
function InstallMenuRow({ promptState }: { promptState: InstallPromptState }) {
    const { canInstall, isIos } = promptState
    if (!canInstall && !isIos) return null
    return (
        <Box
            px="3"
            py="2"
            borderTopWidth="1px"
            borderColor="border.subtle"
            onClick={(e) => e.stopPropagation()}
        >
            <InstallAppButton size="sm" variant="labeled" promptState={promptState} />
        </Box>
    )
}

/**
 * Theme + language + install, the block shared by the signed-in user menu and
 * the signed-out guest menu.
 *
 * These are plain Boxes, NOT Menu.Item — an item would swallow the click and
 * auto-close the menu the moment you flip the switch or pick a language, and
 * you'd have to reopen it to see the result. stopPropagation on the row keeps
 * the menu open for the same reason.
 */
function PreferencesSection({ installPrompt }: { installPrompt: InstallPromptState }) {
    const { t } = useTranslation()
    return (
        <>
            <Box
                px="3"
                py="2"
                mt="1"
                borderTopWidth="1px"
                borderColor="border.subtle"
                onClick={(e) => e.stopPropagation()}
            >
                <HStack justify="space-between">
                    <MenuSectionLabel>{t("common.nav.themeLabel")}</MenuSectionLabel>
                    <ThemeSwitch />
                </HStack>
            </Box>
            <Box
                px="3"
                py="2"
                borderTopWidth="1px"
                borderColor="border.subtle"
                onClick={(e) => e.stopPropagation()}
            >
                <MenuSectionLabel>{t("common.language.label")}</MenuSectionLabel>
                <Box mt="1.5">
                    <LanguagePicker />
                </Box>
            </Box>
            <InstallMenuRow promptState={installPrompt} />
        </>
    )
}

/**
 * Signed-out visitors have no user pill to hang the preferences off, so a
 * small hamburger next to "Prijava" carries theme + language + install
 * instead. Anonymous visitors must be able to reach all three; rendering this
 * alongside a signed-in avatar menu would just be a redundant second dropdown,
 * hence it is guest-only.
 */
function GuestMenu({ tourAnchor }: { tourAnchor?: string }) {
    const { t } = useTranslation()
    /* The guest menu body is mounted lazily by Chakra. Listen for the
       one-shot install event here, while the hamburger trigger is always on
       screen, then pass the captured prompt into the menu row. */
    const installPrompt = useInstallPrompt()
    return (
        <Menu.Root>
            <Menu.Trigger asChild>
                <IconButton
                    aria-label={t("common.nav.menuAriaLabel")}
                    title={t("common.nav.menuAriaLabel")}
                    size="sm"
                    variant="ghost"
                    rounded="full"
                    data-tour={tourAnchor}
                >
                    <FiMenu />
                </IconButton>
            </Menu.Trigger>
            <Menu.Positioner>
                <Menu.Content minW="220px">
                    <NovostiMenuItem />
                    <PreferencesSection installPrompt={installPrompt} />
                </Menu.Content>
            </Menu.Positioner>
        </Menu.Root>
    )
}

/**
 * Signed-in menu: profile link → TEMA → JEZIK → (install, when the browser
 * offers it) → sign out. "Odjavi se" sits last behind its own divider so a
 * mis-tap next to "Profil" can't cost a login.
 */
function UserMenu({ tourAnchor, compact }: { tourAnchor?: string; compact?: boolean }) {
    const { user, signOut } = useAuth()
    const { data: profile } = useMyProfile()
    const navigate = useNavigate()
    const { t } = useTranslation()
    const installPrompt = useInstallPrompt()

    async function onSignOut() {
        try {
            await signOut()
        } finally {
            navigate(homePath)
        }
    }

    if (!user) return null
    return (
        <Menu.Root>
            {/* The avatar + name sit in their own pill, matching the nav
                capsule's treatment (same fill, same hairline, same `full`
                radius) so the two clusters read as one system. `compact` is
                the mobile top bar: there it stays a plain ghost button,
                because at 390px the pill's extra padding is width the bar
                cannot spare. */}
            <Menu.Trigger asChild>
                <Button
                    aria-label={t("common.nav.profileMenuAriaLabel")}
                    size="sm"
                    variant="ghost"
                    px={compact ? 1 : undefined}
                    pl={compact ? undefined : "1"}
                    pr={compact ? undefined : { base: "1", lg: "3" }}
                    gap={compact ? undefined : "2"}
                    rounded={compact ? undefined : "full"}
                    bg={compact ? undefined : "bg.subtle"}
                    borderWidth={compact ? undefined : "1px"}
                    borderColor={compact ? undefined : "border.subtle"}
                    _hover={compact ? undefined : { bg: "bg.muted" }}
                    data-tour={tourAnchor}
                >
                    <UserAvatar
                        avatarUrl={profile?.avatarUrl ?? null}
                        avatarPreset={profile?.avatarPreset ?? null}
                        name={user.displayName || user.email}
                        alt={user.displayName ?? t("common.nav.avatarAlt")}
                        size="28px"
                        fontSize="2xs"
                        fontWeight="semibold"
                    />
                    {!compact && (
                        <Box display={{ base: "none", lg: "block" }} fontSize="sm" fontWeight="medium">
                            {user.displayName || user.email}
                        </Box>
                    )}
                </Button>
            </Menu.Trigger>
            <Menu.Positioner>
                <Menu.Content minW="240px">
                    {/* No "Prijavljen kao <e-mail>" header — the trigger pill
                        already shows who is signed in, and the raw address
                        added nothing but a PII line on screen. The menu now
                        starts straight at the items, like the sibling app's.
                        Bela has no Obavijesti / Cjenik / Vodič / Kontakt
                        pages, so only its own real destination (Profil) is
                        listed — a link to a route that does not exist would
                        be worse than a short menu. */}
                    <Menu.Item value="profile" onSelect={() => navigate("/profil")}>
                        <FiUser /> {t("common.nav.profil")}
                    </Menu.Item>
                    <NovostiMenuItem />
                    <PreferencesSection installPrompt={installPrompt} />
                    <Menu.Item
                        value="logout"
                        onSelect={onSignOut}
                        mt="1"
                        borderTopWidth="1px"
                        borderColor="border.subtle"
                    >
                        <FiLogOut /> {t("common.nav.logout")}
                    </Menu.Item>
                </Menu.Content>
            </Menu.Positioner>
        </Menu.Root>
    )
}

/**
 * Small outline chip pointing at bela.games — the dedicated site for the
 * SAME online-bela lobby this build also renders at /igra (2026-09-23, owner
 * request). Desktop-only: `GamesSiteBanner` on the lobby page itself already
 * carries this on mobile, where the right cluster has no room for a second
 * pill next to the auth button. Kept visually quieter than `NavCapsule`'s
 * pills — outline, not filled — so it doesn't compete with the actual nav.
 */
function GamesSiteLinkChip() {
    return (
        <Button asChild size="sm" variant="outline" rounded="full" color="fg.muted" borderColor="border.subtle">
            <chakra.a
                href={GAMES_ORIGIN}
                target="_blank"
                rel="noopener noreferrer"
                display="inline-flex"
                alignItems="center"
                gap="1"
            >
                {/* The app's own mark + product name (2026-09-23, owner) —
                    "bela.games" read as a bare domain; this reads as a product. */}
                <Image src="/games/symbol.svg" alt="" boxSize="18px" rounded="sm" />
                {GAMES_BRAND_NAME} <FiExternalLink size={13} />
            </chakra.a>
        </Button>
    )
}

/**
 * Right-hand cluster. Signed in: just the avatar pill (everything else is
 * inside its menu). Signed out: "Prijava" plus the guest hamburger.
 *
 * Module-level, NOT nested inside NavBar: a component declared in the render
 * body is a brand-new type on every parent render, so React would unmount and
 * remount the whole dropdown — and flipping the theme invalidates `qk.profile`,
 * which re-renders NavBar, which used to snap the menu shut mid-interaction.
 */
function AuthArea({ compact, tourAnchor }: { compact?: boolean; tourAnchor?: string }) {
    const { user, loading } = useAuth()
    const { t } = useTranslation()

    if (loading) return null
    if (!user) {
        // Single Prijava button — the login page itself has a "Nemaš račun?
        // Registriraj se" link, so showing both buttons in the navbar was
        // redundant noise.
        return (
            <HStack gap="1.5">
                <Button asChild size="sm" variant="solid" colorPalette="blue">
                    <RouterLink to="/prijava">{t("common.nav.login")}</RouterLink>
                </Button>
                <GuestMenu tourAnchor={tourAnchor} />
            </HStack>
        )
    }
    return <UserMenu tourAnchor={tourAnchor} compact={compact} />
}

/* ── bela.games mobile bar (2026-09-20, owner's design) ─────────────────────
   The games site has exactly two places to be, so they are a SWITCH in the
   middle of the header rather than a tab bar at the bottom: mark on the left
   (no wordmark — the address bar and the icon already say it), Igraj | Blok
   in the centre, and one hamburger on the right that opens a side drawer with
   everything else (account, news, theme, language, install, sign out). The
   bottom tab bar is not rendered at all on this site (`MobileTabBar`). */

function GamesSwitch() {
    const { t } = useTranslation()
    const { pathname } = useLocation()
    const onBlok = pathname.startsWith("/blok")
    const items = [
        { to: "/igra", label: t("common.nav.igraj"), icon: <CardsIcon size={16} />, active: !onBlok },
        { to: "/blok", label: t("common.nav.blok"), icon: <FiEdit3 size={15} />, active: onBlok },
    ]
    // Same live-room pull as NavBar's desktop capsule (useGameStats.ts, one
    // shared poller — mounting this alongside the desktop capsule never
    // starts a second interval). Games-site visitors only ever see this
    // switch, never the capsule, so it gets its own compact rendering rather
    // than reusing NavButton's pill markup.
    const gameEnabled = useGameEnabled()
    const gameStats = useGameStats(gameEnabled)
    const plural = usePlural()
    const liveRooms = gameStats?.rooms ?? 0
    return (
        <HStack
            as="nav"
            aria-label={t("common.mobileNav.ariaLabel")}
            gap="0.5"
            p="0.5"
            rounded="full"
            bg="bg.subtle"
            borderWidth="1px"
            borderColor="border.subtle"
        >
            {items.map((item) => (
                <chakra.a
                    key={item.to}
                    asChild
                    display="inline-flex"
                    alignItems="center"
                    gap="1.5"
                    h="32px"
                    px="3.5"
                    rounded="full"
                    fontSize="sm"
                    fontWeight="semibold"
                    textDecoration="none"
                    bg={item.active ? "brand.solid" : "transparent"}
                    color={item.active ? "brand.contrast" : "fg.muted"}
                    _hover={{ textDecoration: "none", color: item.active ? "brand.contrast" : "fg" }}
                    transition="background 0.15s ease, color 0.15s ease"
                >
                    <RouterLink to={item.to} aria-current={item.active ? "page" : undefined}>
                        {item.icon}
                        {item.label}
                        {item.to === "/igra" && liveRooms > 0 && (
                            <HStack as="span" gap="1" display="inline-flex" alignItems="center">
                                <LiveDot />
                                <Box as="span" fontFamily="mono" fontVariantNumeric="tabular-nums" fontSize="xs">
                                    {plural("common.nav.liveRooms", liveRooms)}
                                </Box>
                            </HStack>
                        )}
                    </RouterLink>
                </chakra.a>
            ))}
        </HStack>
    )
}

/** One row of the side drawer: icon, label, optional trailing node. */
function DrawerRow({ icon, children, onClick, danger }: {
    icon: ReactNode
    children: ReactNode
    onClick: () => void
    danger?: boolean
}) {
    return (
        <Button
            variant="ghost"
            w="100%"
            h="12"
            px="3"
            justifyContent="flex-start"
            gap="3"
            fontSize="md"
            fontWeight="medium"
            rounded="lg"
            color={danger ? "fg.error" : "fg"}
            onClick={onClick}
        >
            {icon}
            {children}
        </Button>
    )
}

function GamesSideMenu({ tourAnchor }: { tourAnchor?: string }) {
    const { t } = useTranslation()
    const { user, signOut } = useAuth()
    const { data: profile } = useMyProfile()
    const navigate = useNavigate()
    const installPrompt = useInstallPrompt()
    const unseen = useHasUnseenWhatsNew()
    const [open, setOpen] = useState(false)

    const go = (to: string) => {
        setOpen(false)
        navigate(to)
    }
    async function onSignOut() {
        setOpen(false)
        try {
            await signOut()
        } finally {
            navigate(homePath)
        }
    }

    return (
        <Drawer.Root open={open} onOpenChange={(e) => setOpen(e.open)} placement="end" size="xs">
            <Drawer.Trigger asChild>
                <IconButton
                    aria-label={t("common.nav.menuAriaLabel")}
                    title={t("common.nav.menuAriaLabel")}
                    size="sm"
                    variant="ghost"
                    rounded="full"
                    position="relative"
                    data-tour={tourAnchor}
                >
                    <FiMenu />
                    {unseen && (
                        <Box position="absolute" top="1.5" right="1.5" boxSize="7px" rounded="full" bg="fg.error" aria-hidden="true" />
                    )}
                </IconButton>
            </Drawer.Trigger>
            <Portal>
                <Drawer.Backdrop />
                <Drawer.Positioner>
                    <Drawer.Content
                        /* OPAQUE on purpose. The drawer recipe's stock
                           `bg.panel` is 61% translucent and a sliding panel
                           cannot hold a backdrop blur, so the lobby read
                           straight through the menu (2026-09-20, user report:
                           "previše glossy"). A side menu is a solid sheet. */
                        bg="bg.opaque"
                        shadow="xl"
                        css={{
                            paddingTop: "var(--safe-top)",
                            paddingBottom: "var(--safe-bottom)",
                            paddingRight: "var(--safe-right)",
                        }}
                    >
                        <Drawer.Header pb="2">
                            {user ? (
                                <HStack gap="3" minW="0">
                                    <UserAvatar
                                        avatarUrl={profile?.avatarUrl ?? null}
                                        avatarPreset={profile?.avatarPreset ?? null}
                                        name={user.displayName || user.email}
                                        alt={user.displayName ?? t("common.nav.avatarAlt")}
                                        size="40px"
                                        fontSize="sm"
                                        fontWeight="semibold"
                                    />
                                    <Drawer.Title fontSize="md" truncate>
                                        {user.displayName || user.email}
                                    </Drawer.Title>
                                </HStack>
                            ) : (
                                <Drawer.Title fontSize="md">{siteName}</Drawer.Title>
                            )}
                            <Drawer.CloseTrigger asChild>
                                <CloseButton size="sm" />
                            </Drawer.CloseTrigger>
                        </Drawer.Header>
                        <Drawer.Body px="2" pt="1">
                            <VStack align="stretch" gap="0.5">
                                {user ? (
                                    <DrawerRow icon={<FiUser />} onClick={() => go("/profil")}>
                                        {t("common.nav.profil")}
                                    </DrawerRow>
                                ) : (
                                    <Button colorPalette="brand" size="lg" mx="1" mb="2" onClick={() => go("/prijava")}>
                                        {t("common.nav.login")}
                                    </Button>
                                )}
                                <DrawerRow
                                    icon={<FiVolume2 />}
                                    onClick={() => {
                                        setOpen(false)
                                        openWhatsNew()
                                    }}
                                >
                                    {t("common.nav.novosti")}
                                    {unseen && <Box boxSize="6px" rounded="full" bg="fg.error" aria-hidden="true" />}
                                </DrawerRow>
                            </VStack>
                            <PreferencesSection installPrompt={installPrompt} />
                            {user && (
                                <Box mt="2" pt="2" borderTopWidth="1px" borderColor="border.subtle">
                                    <DrawerRow icon={<FiLogOut />} onClick={() => { void onSignOut() }} danger>
                                        {t("common.nav.logout")}
                                    </DrawerRow>
                                </Box>
                            )}
                        </Drawer.Body>
                    </Drawer.Content>
                </Drawer.Positioner>
            </Portal>
        </Drawer.Root>
    )
}

function GamesMobileBar({ tourAnchor }: { tourAnchor?: string }) {
    const { t } = useTranslation()
    return (
        <Flex display={{ base: "flex", md: "none" }} h={BAR_H} align="center" position="relative">
            <RouterLink to={homePath} aria-label={t("common.nav.brandAriaLabel", { site: siteName })} style={{ display: "inline-flex" }}>
                <Image src={brand.symbolSvg} alt="" h="30px" w="auto" draggable={false} />
            </RouterLink>
            {/* Centred on the BAR, not on the space left between the two
                side items, which have different widths. */}
            <Box position="absolute" left="50%" top="50%" transform="translate(-50%, -50%)">
                <GamesSwitch />
            </Box>
            <Box flex="1" />
            <GamesSideMenu tourAnchor={tourAnchor} />
        </Flex>
    )
}

export default function NavBar() {
    const { t } = useTranslation()

    /**
     * True when the viewport is below the md breakpoint (Chakra's mobile
     * range). Computed via Chakra's breakpoint hook rather than CSS so we
     * can conditionally apply `data-tour` attributes — only the currently
     * visible variant of the nav (desktop HStack vs. mobile top-bar Flex)
     * gets the anchor. Otherwise Joyride's querySelector would find the
     * hidden desktop nav first on mobile, anchor on a 0×0 element, and
     * the tooltip would render off-screen. {ssr: false} keeps SSR happy
     * by deferring evaluation to the client (the actual desktop SPA build
     * runs in the browser anyway).
     */
    const isMobile = useBreakpointValue({ base: true, md: false }, { ssr: false }) ?? false

    /* Built on every render rather than once at import time: `useTranslation`
       only re-renders the component that called it, so the labels have to be
       recomputed here for a language switch to reach them. Same reasoning as
       MobileTabBar's buildTabs. */
    const navItems = buildNavItems(t)

    /**
     * Live-room count for the "Igraj" pill (owner, 2026-09-22). `useGameStats`
     * shares ONE poller across every consumer (this bar, MobileTabBar, and —
     * on the games domains — GamesSwitch below), so mounting several of them
     * at once never starts a second 30s loop. `useGameEnabled` gates it: no
     * fetch at all while the feature is off or the kill switch hasn't
     * resolved yet.
     *
     * `undefined` (not `null`/0) when there is nothing to show, so
     * `NavButton`'s `liveBadge ?? (isNew && <NewBadge/>)` falls through to
     * today's NOVO badge exactly as before — the pill only replaces it once
     * there is a real count to show.
     */
    const gameEnabled = useGameEnabled()
    const gameStats = useGameStats(gameEnabled)
    const plural = usePlural()
    const liveRooms = gameStats?.rooms ?? 0
    const liveRoomsBadge = liveRooms > 0 ? (
        <HStack as="span" gap="1" ml="1.5" display="inline-flex" alignItems="center">
            <Box as="span" aria-hidden="true" color="fg.muted" fontWeight="normal">·</Box>
            <LiveDot />
            <Box as="span" fontFamily="mono" fontVariantNumeric="tabular-nums" fontWeight="normal">
                {plural("common.nav.liveRooms", liveRooms)}
            </Box>
        </HStack>
    ) : undefined

    // Bridge for the legacy `bela:profile-updated` window event that
    // PublicProfilePage dispatches after an avatar upload/removal: turn it into
    // a cache invalidation so every consumer of qk.profile repaints (the avatar
    // in UserMenu comes from that same shared query), not just this component.
    const invalidateMyProfile = useInvalidateMyProfile()
    useEffect(() => {
        const handler = () => { invalidateMyProfile() }
        window.addEventListener("bela:profile-updated", handler)
        return () => window.removeEventListener("bela:profile-updated", handler)
    }, [invalidateMyProfile])

    // zIndex must beat Leaflet's internal panes (controls go up to ~800)
    // because Menu.Positioner is rendered inside this sticky header's
    // stacking context — without it the profile dropdown ends up behind
    // the Leaflet map on /karta.
    // Semantic tokens rather than useColorModeValue(): the hook resolves on the
    // client AFTER hydration, so the bar painted one frame in the wrong theme on
    // every cold load. `layerStyle` / `border.glass` carry both halves the
    // same way.
    //
    // `layerStyle="glass.bar"` (src/system.ts) is the frosted surface: a
    // translucent background plus a backdrop blur, so page content softens as
    // it scrolls under the header instead of hard-cutting at its edge. The
    // nav's own text is NOT faded — the translucency is on the background
    // only — and browsers without backdrop-filter fall back to an opaque
    // bg.panel via the @supports guard in the layer style.
    return (
        <Box
            as="header"
            layerStyle="glass.bar"
            borderBottomWidth="1px"
            borderColor="border.glass"
            position="sticky"
            top={0}
            zIndex={1000}
            // Clears the notch/Dynamic Island when this PWA is installed and
            // launched standalone on iOS (viewport-fit=cover in index.html
            // lets content draw under the notch, so without this the header
            // sits behind it). 0px on every other browser — see navChrome.ts.
            // `--safe-top` (index.html) rather than a bare `env(...)`: below
            // WebView 140 that resolves to 0px even under Android 16
            // edge-to-edge, where Capacitor's own `--safe-area-inset-top`
            // still carries the real value.
            style={{ paddingTop: "var(--safe-top)" }}
        >
            {/* py={0}: the row height is pinned by BAR_H instead, so the
                rendered header matches NAVBAR_H to the pixel (plus the safe-area
                inset above, on a notched device). */}
            <Container
                maxW="6xl"
                py={0}
                /* Same treatment the page Container gets in App.tsx: in
                   LANDSCAPE on a notched phone the logo on one end and the
                   language/account controls on the other would otherwise sit
                   under the cutout. Both terms are 0 in portrait and in a
                   browser tab, so this costs nothing anywhere else. */
                css={{
                    paddingInlineStart: "max(var(--chakra-spacing-4), var(--safe-left))",
                    paddingInlineEnd: "max(var(--chakra-spacing-4), var(--safe-right))",
                }}
            >
                <Box
                    display={{ base: "none", md: "grid" }}
                    h={BAR_H}
                    gridTemplateColumns="1fr auto 1fr"
                    alignItems="center"
                    gap={3}
                >
                    <Box>
                        {/* Brand mark — rendered as a plain link, NOT a Button.
                            We don't want the ghost-button hover/active background
                            washing across the logo when the mouse passes over.
                            The chakra factory call gives us style props on a
                            real <a>; visited/focus/active styles are reset to
                            keep it visually quiet, while the link still
                            navigates and shows a keyboard focus ring. */}
                        <chakra.a
                            asChild
                            display="inline-flex"
                            alignItems="center"
                            gap="2"
                            color="fg"
                            fontWeight="semibold"
                            textDecoration="none"
                            _hover={{ textDecoration: "none", color: "fg" }}
                            _active={{ color: "fg" }}
                            _focusVisible={{ outline: "2px solid", outlineColor: "blue.solid", outlineOffset: "2px", borderRadius: "md" }}
                        >
                            <RouterLink
                                to={homePath}
                                aria-label={t("common.nav.brandAriaLabel", { site: siteName })}
                            >
                                <Image
                                    src={brand.symbolSvg}
                                    alt=""
                                    h={{ base: "28px", md: "32px" }}
                                    w="auto"
                                    draggable={false}
                                />
                                <Box
                                    as="span"
                                    display={{ base: "none", sm: "inline" }}
                                    fontFamily="heading"
                                    fontWeight="semibold"
                                    letterSpacing="-0.015em"
                                >
                                    {siteName}
                                </Box>
                            </RouterLink>
                        </chakra.a>
                    </Box>

                    {/* Segmented nav group. Desktop-only by construction: it
                        lives inside the `md`-and-up grid, so at 390px it is
                        not rendered at all and cannot wrap the bar onto a
                        second row — day-to-day navigation on a phone is the
                        fixed MobileTabBar at the foot of the viewport. */}
                    <NavCapsule tourAnchor={isMobile ? undefined : "nav-items"}>
                        {navItems.map((item) => (
                            <NavButton
                                key={item.to}
                                to={item.to}
                                exact={item.exact}
                                icon={item.icon}
                                accent={item.accent}
                                isNew={item.isNew}
                                liveBadge={item.to === "/igra" ? liveRoomsBadge : undefined}
                            >
                                {item.label}
                            </NavButton>
                        ))}
                    </NavCapsule>

                    {/* One trigger, nothing else: theme, language and install
                        used to sit out here as loose icons and now live inside
                        the dropdown below it. */}
                    <HStack
                        data-tour={isMobile ? undefined : "nav-auth"}
                        justify="end"
                        gap="1.5"
                    >
                        {/* bela.games pointer — only the full site has a
                            twin to point at, and only here (md+): the mobile
                            top bar has no spare width for a second pill next
                            to the auth control, so /igra's own
                            GamesSiteBanner carries this there instead. */}
                        {!isGamesSite && <GamesSiteLinkChip />}
                        <AuthArea tourAnchor={isMobile ? undefined : "help-install"} />
                    </HStack>
                </Box>

                {/* ====================== Mobile top bar ======================
                    Day-to-day navigation lives in the fixed bottom tab bar
                    (MobileTabBar) — the same five destinations as the desktop
                    capsule above (Turniri / Kalendar / Igraj / Karta / Blok)
                    are one tap away there, and are deliberately NOT duplicated
                    in the menu. What stays in the top bar:

                      - Brand mark (logo + "Bela Turniri") on the left
                      - Auth control on the right: the avatar menu, or
                        "Prijava" + a guest hamburger

                    The `data-tour` anchors are kept so the guided tour can
                    still spotlight nav-auth + help-install on mobile. The
                    nav-items anchor moved to the bottom tab bar itself. */}
                {isGamesSite ? (
                    <GamesMobileBar tourAnchor={isMobile ? "help-install" : undefined} />
                ) : (
                    <Flex display={{ base: "flex", md: "none" }} h={BAR_H} align="center" gap="1">
                        <chakra.a
                            asChild
                            display="inline-flex"
                            alignItems="center"
                            gap="1.5"
                            color="fg"
                            fontWeight="semibold"
                            textDecoration="none"
                            _hover={{ textDecoration: "none", color: "fg" }}
                            _active={{ color: "fg" }}
                            _focusVisible={{ outline: "2px solid", outlineColor: "blue.solid", outlineOffset: "2px", borderRadius: "md" }}
                        >
                            <RouterLink
                                to={homePath}
                                aria-label={t("common.nav.brandAriaLabel", { site: siteName })}
                            >
                                <Image
                                    src={brand.symbolSvg}
                                    alt=""
                                    h="28px"
                                    w="auto"
                                    draggable={false}
                                />
                                <Box as="span" fontFamily="heading" fontWeight="semibold" letterSpacing="-0.015em">{siteName}</Box>
                            </RouterLink>
                        </chakra.a>
                        <Box flex="1" />
                        <Box data-tour={isMobile ? "nav-auth" : undefined}>
                            <AuthArea compact tourAnchor={isMobile ? "help-install" : undefined} />
                        </Box>
                    </Flex>
                )}
            </Container>
        </Box>
    )
}
