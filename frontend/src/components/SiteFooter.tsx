import type { BoxProps } from "@chakra-ui/react"
import { Box, Flex, Text } from "@chakra-ui/react"
import { Link as RouterLink, useLocation } from "react-router-dom"
import { useTranslation } from "../i18n"

/* ──────────────────────────────────────────────────────────────────────────
   SiteFooter — global footer rendered once in App.tsx, under the routed
   content, as a sibling of every page. Not a floating/glass surface (see
   design rules: glass is reserved for chrome that overlaps content — the
   sticky header, the mobile tab bar) — this sits in normal document flow,
   so it gets an ordinary opaque `bg.panel` + a hairline top border like any
   other in-flow surface.

   Layout: App.tsx wraps NavBar + the routed Container + this footer in a
   `minH="100dvh"` flex column and passes `mt="auto"` down to us — the
   classic sticky-footer trick. On a page shorter than the viewport that
   margin expands to fill the gap and the footer lands on the viewport's
   bottom edge; on a longer page it collapses to ~0 and the footer just
   follows the content. Deliberately NOT position:fixed — MobileTabBar
   already owns the fixed bottom slot on mobile, and stacking two fixed
   bars would be a layering mess.

   Mobile clearance: MobileTabBar is fixed and paints on top of whatever is
   at the bottom of the document, so once this footer becomes the last
   in-flow element on the page (which it now always is), IT is what needs
   to clear the bar — not the page content above it. `mb` (not `pb`) is used
   so the reserved space stays transparent rather than stretching this
   footer's own background/border down into the gap.
   ────────────────────────────────────────────────────────────────────── */

export default function SiteFooter(props: BoxProps) {
    const { t } = useTranslation()
    const { pathname } = useLocation()
    const year = new Date().getFullYear()

    // The create-tournament wizard claims the whole viewport on purpose —
    // CreateTournamentPage.tsx sizes itself to `100dvh - chrome above` so
    // its own sticky "Odustani / Dalje" bar sits on the true bottom edge
    // with zero page scroll, and MobileTabBar already hides on this same
    // route for the same reason. Rendering this footer here as well would
    // push the document past 100dvh and bring the scrollbar (and a dead
    // gap under the action bar) right back.
    //
    // /igra* is the same deal: the game table is a `100dvh - chrome` column
    // with the hand docked at its bottom edge, and MobileTabBar hides there
    // for exactly this reason too.
    // `/blok` joins them (2026-09-09, reported): the blok sizes itself to
    // `100dvh - chrome` on a phone precisely so the PAGE does not scroll and
    // only the deal list inside it does. A footer under that column makes the
    // document taller than the viewport all the same, and because the score
    // card is `position: sticky` the result was the worst of both — a drag
    // started anywhere outside the inner scroller slid the whole screen up
    // UNDER the pinned card, revealing nothing but the footer.
    if (
        pathname.startsWith("/turniri/novi")
        || pathname.startsWith("/igra")
        || pathname.startsWith("/blok")
    ) return null

    return (
        <Box
            as="footer"
            borderTopWidth={{ base: "0", md: "1px" }}
            borderColor="border.subtle"
            bg={{ base: "transparent", md: "bg.panel" }}
            // Mobile (base/sm) does not show the footer at all — Kontakt /
            // Privatnost / Uvjeti are reachable from the menu, and on a phone
            // the strip only ever appeared squeezed between the content and
            // the fixed MobileTabBar. The element still renders there, just
            // empty: its `mb` is what reserves the room the fixed tab bar
            // paints over (~64px bar body + 28px raised Kreiraj circle ≈ 100px,
            // plus the iOS home-indicator inset), and `mt="auto"` from App.tsx
            // keeps that reserve pinned to the bottom of short pages. md+
            // hides the tab bar, so the reserve drops and the footer shows.
            mb={{ base: "calc(100px + env(safe-area-inset-bottom))", md: "0" }}
            {...props}
        >
            <Flex
                display={{ base: "none", md: "flex" }}
                maxW="6xl"
                mx="auto"
                px={{ base: "4", md: "6" }}
                py={{ base: "4", md: "3" }}
                align="center"
                justify="center"
                gap={{ base: "3", md: "6" }}
                wrap="wrap"
                fontSize="xs"
                color="fg.muted"
            >
                <Flex gap={{ base: "3", md: "5" }} wrap="wrap" justify="center">
                    <Box asChild py="2" _hover={{ color: "fg" }}>
                        <RouterLink to="/kontakt">{t("common.footer.contactLink")}</RouterLink>
                    </Box>
                    <Box asChild py="2" _hover={{ color: "fg" }}>
                        <RouterLink to="/privatnost">{t("common.footer.privacyLink")}</RouterLink>
                    </Box>
                    <Box asChild py="2" _hover={{ color: "fg" }}>
                        <RouterLink to="/uvjeti">{t("common.footer.termsLink")}</RouterLink>
                    </Box>
                </Flex>
                <Text whiteSpace="nowrap">
                    {t("common.footer.copyright", { year })}
                </Text>
            </Flex>
        </Box>
    )
}
