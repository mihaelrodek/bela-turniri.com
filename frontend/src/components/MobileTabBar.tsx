import { Box, Text } from "@chakra-ui/react"
import { Link as RouterLink, useLocation } from "react-router-dom"
import { FiCalendar, FiEdit3, FiHome, FiMap } from "react-icons/fi"
import { useTranslation } from "../i18n"
import type { ReactNode } from "react"

/**
 * Mobile-only bottom tab bar.
 *
 * Anatomy (left → right):
 *   Turniri | Kalendar | Igraj | Karta | Blok
 *
 * "Igraj" sits dead centre on purpose: the middle slot is where a thumb
 * rests, and online bela is the tap we want cheapest. It is also ALWAYS
 * rendered — the production kill switch (game/hooks/useGameEnabled.ts) no
 * longer decides whether the tab exists, only whether /igra shows the game or
 * the "dolazi uskoro" page (src/game/GameFeatureGate.tsx). Do not put a
 * `gameEnabled` filter back here: a fifth tab appearing under the user's
 * thumb a moment after load moves every other tab sideways mid-tap.
 *
 * These are the SAME five destinations, in the same order and with the same
 * icons, that NavBar's desktop capsule renders (see `buildNavItems` there) —
 * the two bars are one navigation seen at two widths. Each bar keeps its own
 * array because they render very differently; the contents must stay in step.
 *
 * Every tab is a stacked icon + 11px label, EXCEPT the centre one, which is a
 * raised disc (`CENTRE_INDEX`). That shape used to belong to a "+" for creating
 * a tournament; creating is an action rather than a place and moved to the
 * /turniri toolbar, but the shape itself was worth keeping — five identical
 * icons have no centre of gravity, and the disc is what makes the thumb's home
 * position mean something. "Profil" is gone as well: the avatar in the
 * top-right corner of NavBar is the way there, and a second door to the same
 * room cost a fifth of the bar.
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

/**
 * Two cards, fanned — the centre tab's mark (2026-09-09, user request).
 *
 * Drawn here rather than pulled from an icon pack: the bar already uses
 * Feather, which has no playing card, and importing a second pack for one
 * glyph costs a chunk of icons nothing else needs. It is `currentColor` and
 * `stroke`-based like every Feather icon beside it, so it inherits the disc's
 * contrast colour and the same 2px weight.
 */
export function CardsIcon({ size = 26 }: { size?: number }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            {/* The back card, tilted; the front one upright over it. */}
            <rect x="3.2" y="6.4" width="10" height="14" rx="2" transform="rotate(-16 8.2 13.4)" />
            <rect x="10.5" y="4" width="10.5" height="15" rx="2" />
        </svg>
    )
}

type TabDef = {
    to: string
    label: string
    icon: ReactNode
    /** Exact-match flag so `/turniri` doesn't stay highlighted on `/turniri/123`. */
    exact?: boolean
    /** True when the route lives outside the bottom bar (e.g. /turniri/:uuid). */
    matchPrefixes?: string[]
}

/** The tab that gets the raised disc: the middle one, "Igraj". Derived from
 *  the list rather than hard-coded, so the shape follows the tabs if the list
 *  ever changes rather than pointing at whatever ends up third. */
const CENTRE_INDEX = 2

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
        // Online bela (src/game) — centre slot, see the header comment. The
        // bar hides itself on /igra* (`hidden` below), so this tab hands the
        // game its own full screen.
        { to: "/igra", label: t("game.nav.igraj"), icon: <CardsIcon />, matchPrefixes: ["/igra"] },
        { to: "/karta", label: t("common.nav.karta"), icon: <FiMap size={20} /> },
        // Bela blok (src/blok) — public offline scorepad, meant to be opened
        // one-handed at a real table, so mobile is its primary surface. Its own
        // bottom-docked entry buttons (BLOK.md §3.1) are why /blok is in the
        // `hidden` list below — same pattern as /turniri/novi's sticky submit
        // bar and the game table's docked hand.
        { to: "/blok", label: t("blok.nav"), icon: <FiEdit3 size={20} />, matchPrefixes: ["/blok"] },
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
    // The online-bela TABLE (/igra/soba/…) is the same case as the create
    // form: it sizes itself to `100dvh - chrome` and docks the hand on the
    // viewport's bottom edge, which this bar would sit on top of.
    //
    // Only the table, not all of `/igra` — NARROWED 2026-09-08. "Igraj" is now
    // the centre tab and, while the feature flag is off in production, it
    // lands on the "dolazi uskoro" page. Hiding the bar there took the whole
    // navigation away from someone who had simply tapped the middle tab and
    // found nothing to play, leaving that page's own two buttons as the only
    // way out. The lobby has no bottom-docked chrome either, so it keeps the
    // bar too.
    const hidden =
        pathname.startsWith("/prijava") ||
        pathname.startsWith("/registracija") ||
        pathname.startsWith("/turniri/novi") ||
        pathname.startsWith("/igra/soba") ||
        pathname.startsWith("/blok")

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
            {/* Column count follows the tab count rather than a hard-coded
                number, so adding or removing a destination can never leave a
                dead column behind. (It is a stable 5 today — the "Igraj" tab
                no longer comes and goes with its production flag.) */}
            <Box
                display="grid"
                gridTemplateColumns={`repeat(${TABS.length}, 1fr)`}
                w="100%"
                alignItems="center"
            >
                {TABS.map((tab, index) => {
                    const active = isActive(pathname, tab)

                    /* THE CENTRE TAB IS RAISED — restored 2026-09-08 at the
                       user's request, now carrying "Igraj" instead of the old
                       create-tournament "+". A bar of five identical icons has
                       no centre of gravity; the raised disc is what makes the
                       thumb's home position mean something, and online play is
                       what the user wants it to mean. It is a link like every
                       other tab — same route, same accessible name — only
                       painted differently, so nothing about navigation depends
                       on the shape. */
                    if (index === CENTRE_INDEX) {
                        return (
                            <Box
                                key={tab.to}
                                display="flex"
                                flexDirection="column"
                                alignItems="center"
                                justifyContent="flex-end"
                                gap="2px"
                                py="2"
                            >
                                <Box
                                    asChild
                                    display="flex"
                                    alignItems="center"
                                    justifyContent="center"
                                    /* BIGGER, AND LIFTED ONLY UPWARDS
                                       (2026-09-09, user request). The label
                                       sits BELOW the disc, in line with every
                                       other tab's label, so the negative
                                       margin has to be paid back below it —
                                       otherwise the word falls past the bar's
                                       own padding and off the screen, which is
                                       what happened the first time. */
                                    boxSize="60px"
                                    mt="-26px"
                                    mb="-4px"
                                    rounded="full"
                                    bg="brand.solid"
                                    color="brand.contrast"
                                    borderWidth="4px"
                                    /* Ringed in the page's own colour so the
                                       disc reads as sitting ON the bar rather
                                       than punched through it. */
                                    borderColor="bg.canvas"
                                    boxShadow="raised"
                                    transition="transform 0.15s ease"
                                    _hover={{ transform: "translateY(-1px)" }}
                                    _active={{ transform: "translateY(0)" }}
                                >
                                    <RouterLink
                                        to={tab.to}
                                        aria-label={tab.label}
                                        aria-current={active ? "page" : undefined}
                                    >
                                        {tab.icon}
                                    </RouterLink>
                                </Box>
                                {/* Named like every other destination. The
                                    disc was the only unlabelled thing in the
                                    bar — a green circle you had to press to
                                    find out what it did. */}
                                <Text
                                    fontSize="11px"
                                    lineHeight="1"
                                    fontWeight="bold"
                                    color={active ? "brand.fg" : "fg.muted"}
                                    aria-hidden="true"
                                >
                                    {tab.label}
                                </Text>
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
