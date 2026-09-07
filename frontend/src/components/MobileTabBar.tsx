import { Box, IconButton, Text } from "@chakra-ui/react"
import { Link as RouterLink, useLocation } from "react-router-dom"
import { FiCalendar, FiHome, FiMap, FiPlus, FiUser } from "react-icons/fi"
import { useTranslation } from "../i18n"
import type { ReactNode } from "react"

/**
 * Mobile-only bottom tab bar matching the design handoff (`screen-mobile.jsx`).
 *
 * Anatomy (left → right):
 *   Turniri | Kalendar | [Kreiraj 56px circle] | Karta | Profil
 *
 * The Kreiraj button is a raised solid-blue circle that overflows the bar's
 * top edge so it visually pops above the row — a common bottom-nav pattern
 * for the primary CTA. The other 4 are stacked icon + 11px label.
 *
 * <p>Visibility: shown on `base` viewport, hidden on `md+`. The bar uses
 * `position: fixed` + `bottom: 0` so it stays glued to the viewport bottom
 * even while the page scrolls. iOS safe-area-inset-bottom is respected via
 * `paddingBottom: env(safe-area-inset-bottom)` so the row clears the home
 * indicator on notched phones.
 *
 * <p>This supplements the existing hamburger drawer in NavBar rather than
 * replacing it. The drawer continues to host the secondary affordances
 * (install / help tour) and is still driven by the `bela:open-nav-menu` /
 * `bela:close-nav-menu` window events the guided tour dispatches — those
 * are unaffected here.
 */

type TabDef = {
    to: string
    label: string
    icon: ReactNode
    /** Exact-match flag so `/turniri` doesn't stay highlighted on `/turniri/123`. */
    exact?: boolean
    /** True when the route lives outside the bottom bar (e.g. /turniri/:uuid). */
    matchPrefixes?: string[]
}

/**
 * Built inside the component (not as a module-level constant) so the
 * labels re-render immediately on a language switch — `useTranslation()`
 * only triggers a re-render for the component that calls it, so the tab
 * list has to be recomputed on every render rather than once at import
 * time.
 */
function buildTabs(t: (key: string) => string): TabDef[] {
    return [
        { to: "/turniri", label: t("common.nav.turniri"), icon: <FiHome size={20} />, matchPrefixes: ["/turniri"] },
        { to: "/kalendar", label: t("common.nav.kalendar"), icon: <FiCalendar size={20} /> },
        // Kreiraj sits in the middle slot as a raised circle button —
        // see the dedicated JSX below for the styling. The entry here
        // exists so the surrounding tabs lay out evenly around it.
        { to: "/turniri/novi", label: t("common.mobileNav.kreiraj"), icon: <FiPlus size={22} /> },
        { to: "/karta", label: t("common.nav.karta"), icon: <FiMap size={20} /> },
        { to: "/profil", label: t("common.nav.profil"), icon: <FiUser size={20} />, matchPrefixes: ["/profil"] },
    ]
}

function isActive(pathname: string, tab: TabDef): boolean {
    if (tab.exact) return pathname === tab.to
    if (tab.matchPrefixes) {
        return tab.matchPrefixes.some((p) => pathname === p || pathname.startsWith(p + "/"))
    }
    return pathname === tab.to
}

export default function MobileTabBar() {
    const { pathname } = useLocation()
    const { t } = useTranslation()
    const TABS = buildTabs(t)

    // ── Liquid Glass treatment ────────────────────────────────────────
    // iOS 26 Safari renders its bottom URL/toolbar with a translucent
    // frosted-glass effect. A solid-bg tab bar stacked under it looks
    // like two distinct visual layers from different eras. Matching the
    // browser chrome's recipe — semi-transparent surface + saturate +
    // blur — makes the two read as one continuous frosted band.
    //
    // The values mirror what UIKit's UIBlurEffect uses for its
    // .systemMaterial style: ~75% surface tint, 180% saturation boost
    // (gives the through-color back its punch after the blur fades it),
    // 20px blur. Border alpha is tiny (8%) — under the blur it reads as
    // a hairline separation, not a hard line.
    //
    // Light mode: white surface. Dark mode: near-black. Both are
    // calibrated against the system content showing through them so
    // text contrast on the labels stays AA at typical wallpapers.
    //
    // These values now live in the theme as `bg.glass` / `border.glass` and
    // the blur as `layerStyle="glass.bar"` (src/system.ts), which is also what
    // the sticky header uses — the two frosted bars were drifting apart while
    // each kept its own copy of the recipe. useColorModeValue() is gone with
    // them: the semantic tokens resolve in plain CSS, so the bar no longer
    // paints one frame in the wrong theme on a cold load.

    // Hide the bar on a few full-bleed routes where it would compete with
    // page-level CTAs (e.g. the create form's sticky submit bar would
    // collide with this row at the same viewport bottom). Auth pages
    // also hide it — there's nothing to navigate to until the user
    // signs in.
    // The online-bela table (/igra*) is the same case as the create form: it
    // sizes itself to `100dvh - chrome` and docks the hand on the viewport's
    // bottom edge, which this bar would sit on top of.
    const hidden =
        pathname.startsWith("/prijava") ||
        pathname.startsWith("/registracija") ||
        pathname.startsWith("/turniri/novi") ||
        pathname.startsWith("/igra")

    if (hidden) return null

    return (
        <Box
            as="nav"
            aria-label={t("common.mobileNav.ariaLabel")}
            // `data-tour="nav-items"` lives on this bar so the guided tour
            // still has a mobile anchor for the nav-items step. The
            // hamburger drawer that used to host this anchor was removed
            // — the bottom tab bar replaces it as the canonical mobile
            // navigation surface.
            data-tour="nav-items"
            display={{ base: "flex", md: "none" }}
            position="fixed"
            left="0"
            right="0"
            bottom="0"
            // Liquid-glass surface, defined once in the theme. On a browser
            // without backdrop-filter the layer style's @supports guard swaps
            // the translucent fill for an opaque bg.panel, so the bar is solid
            // rather than washed out and the labels keep full contrast.
            layerStyle="glass.bar"
            borderTopWidth="1px"
            borderColor="border.glass"
            zIndex={900}
            style={{
                // env(safe-area-inset-bottom) clears the iOS home indicator
                // on notched phones. iOS auto-bumps this value when the
                // Safari bottom toolbar is expanded, so the tab bar slides
                // up to stay clear of the browser chrome without us
                // re-measuring anything.
                //
                // Still an inline style rather than a `pb` prop: `env()` is
                // not a spacing token, and this is the only declaration left
                // here now that the blur moved to `layerStyle="glass.bar"`.
                paddingBottom: "env(safe-area-inset-bottom)",
            }}
            px="2"
            pt="2"
        >
            <Box display="grid" gridTemplateColumns="repeat(5, 1fr)" w="100%" alignItems="center">
                {TABS.map((tab, idx) => {
                    const active = isActive(pathname, tab)
                    // Middle slot (idx === 2) is the raised Kreiraj button.
                    if (idx === 2) {
                        return (
                            <Box key={tab.to} display="flex" justifyContent="center">
                                <IconButton
                                    asChild
                                    aria-label={t("common.nav.kreirajTurnir")}
                                    rounded="full"
                                    colorPalette="blue"
                                    variant="solid"
                                    w="56px"
                                    h="56px"
                                    boxShadow="md"
                                    // Negative top margin lifts the circle above
                                    // the bar so it visually pops. The transform
                                    // hint keeps it crisp during scroll on iOS.
                                    mt="-28px"
                                >
                                    <RouterLink to={tab.to}>{tab.icon}</RouterLink>
                                </IconButton>
                            </Box>
                        )
                    }
                    return (
                        <Box
                            asChild
                            key={tab.to}
                            display="flex"
                            flexDirection="column"
                            alignItems="center"
                            gap="2px"
                            py="2"
                            // `blue.fg` is blue.700 in light and blue.300 in dark —
                            // the hardcoded blue.700 it replaced was unreadable on
                            // the dark translucent bar.
                            //
                            // Inactive labels are `fg.muted`, NOT `fg.subtle`.
                            // This bar is translucent, so its effective
                            // background is whatever scrolls under it: at the
                            // 0.72 surface alpha, a maximally contrasting
                            // backdrop (a dark tournament poster under the
                            // light bar) composites to ~#b8b8b8, where
                            // `fg.subtle` measures 2.4:1 — a fail for an 11px
                            // label. `fg.muted` holds 7.7:1 on the ordinary
                            // backdrop and 3.8:1 at that pathological extreme,
                            // which the blur in practice smooths away.
                            color={active ? "blue.fg" : "fg.muted"}
                            fontWeight="500"
                            transition="color 0.15s ease"
                            _hover={{ color: "blue.fg" }}
                        >
                            <RouterLink to={tab.to} aria-label={tab.label} aria-current={active ? "page" : undefined}>
                                {tab.icon}
                                <Text fontSize="11px" mt="2px">
                                    {tab.label}
                                </Text>
                            </RouterLink>
                        </Box>
                    )
                })}
            </Box>
        </Box>
    )
}
