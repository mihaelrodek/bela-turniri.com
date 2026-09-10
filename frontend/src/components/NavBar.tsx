import React, { useEffect, type ReactNode } from "react"
import {
    Box, Flex, HStack, IconButton, Image, Button, Container, Menu, Switch, Text, chakra, useBreakpointValue,
} from "@chakra-ui/react"
import { Link as RouterLink, useMatch, useResolvedPath, useNavigate } from "react-router-dom"
import { CardsIcon } from "./MobileTabBar"
import {
    FiCalendar, FiEdit3, FiHome, FiLogOut, FiMap, FiMenu, FiMoon, FiSun, FiUser,
} from "react-icons/fi"
import { useAuth } from "../auth/authContextValue"
import { useColorMode } from "../color-mode-hooks"
import { updateColorMode } from "../api/userMe"
import { useInstallPrompt, type InstallPromptState } from "../hooks/useInstallPrompt"
import { useInvalidateMyProfile, useMyProfile } from "../hooks/useMyProfile"
import { useTranslation } from "../i18n"
import { InstallAppButton } from "./InstallAppButton"
import LanguagePicker from "./LanguagePicker"
import { NAVBAR_H } from "./navChrome"

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
                       to, exact, icon, accent, children, onClick,
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
    children: React.ReactNode
    onClick?: () => void
}) {
    const resolved = useResolvedPath(to)
    const match = useMatch({ path: resolved.pathname, end: !!exact })
    const isActive = !!match

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
        >
            <RouterLink to={to}>
                {/* The icon is decorative here — the link's own text is the
                    accessible name, so no aria-label and no title. */}
                {icon && <Box as="span" display="inline-flex" flexShrink="0" aria-hidden="true">{icon}</Box>}
                {children}
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
}

function buildNavItems(t: (key: string) => string): NavItem[] {
    return [
        { to: "/turniri", label: t("common.nav.turniri"), icon: <FiHome size={16} />, exact: true },
        { to: "/kalendar", label: t("common.nav.kalendar"), icon: <FiCalendar size={16} /> },
        // Online bela (src/game), dead centre — the same slot it holds in the
        // mobile tab bar, where the middle is the thumb's home position. Its
        // label lives in the `game` namespace, not in `common`.
        // The same card mark the mobile bar's centre disc carries — the two
        // bars are one navigation seen at two widths (MobileTabBar's header).
        { to: "/igra", label: t("game.nav.igraj"), icon: <CardsIcon size={16} />, accent: true },
        { to: "/karta", label: t("common.nav.karta"), icon: <FiMap size={16} /> },
        // Bela blok (src/blok) — public offline scorepad, no feature flag, no
        // auth. Its label lives in the `blok` namespace with the rest of that
        // subtree.
        { to: "/blok", label: t("blok.nav"), icon: <FiEdit3 size={16} /> },
    ]
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

function UserAvatar({
    name,
    email,
    avatarUrl,
}: {
    name?: string | null
    email?: string | null
    avatarUrl?: string | null
}) {
    const { t } = useTranslation()
    const source = (name || email || "?").trim()
    const initials =
        source
            .split(/[\s@]+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((s) => s[0]?.toUpperCase())
            .join("") || "?"
    return (
        <Box
            w="28px"
            h="28px"
            rounded="full"
            overflow="hidden"
            bg="blue.subtle"
            color="blue.fg"
            display="flex"
            alignItems="center"
            justifyContent="center"
            fontWeight="semibold"
            fontSize="2xs"
        >
            {avatarUrl ? (
                <Image
                    src={avatarUrl}
                    alt={name ?? t("common.nav.avatarAlt")}
                    w="100%"
                    h="100%"
                    objectFit="cover"
                    // Non-critical: a 28 px avatar must never block the brand
                    // mark or first paint. (The logo above stays eager — it's
                    // an LCP candidate.)
                    loading="lazy"
                    decoding="async"
                />
            ) : (
                initials
            )}
        </Box>
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
            navigate("/turniri")
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
                        name={user.displayName}
                        email={user.email}
                        avatarUrl={profile?.avatarUrl ?? null}
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
            style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
            {/* py={0}: the row height is pinned by BAR_H instead, so the
                rendered header matches NAVBAR_H to the pixel (plus the safe-area
                inset above, on a notched device). */}
            <Container maxW="6xl" py={0}>
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
                                to="/turniri"
                                aria-label={t("common.nav.brandAriaLabel")}
                            >
                                <Image
                                    src="/bela-turniri-symbol.svg"
                                    alt=""
                                    h={{ base: "28px", md: "32px" }}
                                    w="auto"
                                    draggable={false}
                                />
                                <Box
                                    as="span"
                                    display={{ base: "none", sm: "inline" }}
                                    fontWeight="semibold"
                                >
                                    {t("common.nav.brandName")}
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
                            to="/turniri"
                            aria-label={t("common.nav.brandAriaLabel")}
                        >
                            <Image
                                src="/bela-turniri-symbol.svg"
                                alt=""
                                h="28px"
                                w="auto"
                                draggable={false}
                            />
                            <Box as="span" fontWeight="semibold">{t("common.nav.brandName")}</Box>
                        </RouterLink>
                    </chakra.a>
                    <Box flex="1" />
                    <Box data-tour={isMobile ? "nav-auth" : undefined}>
                        <AuthArea compact tourAnchor={isMobile ? "help-install" : undefined} />
                    </Box>
                </Flex>
            </Container>
        </Box>
    )
}
