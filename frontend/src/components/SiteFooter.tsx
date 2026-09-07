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
    if (pathname.startsWith("/turniri/novi")) return null

    return (
        <Box
            as="footer"
            borderTopWidth="1px"
            borderColor="border.subtle"
            bg="bg.panel"
            // Mirrors MobileTabBar's own visual-footprint comment: ~64px bar
            // body + 28px raised Kreiraj circle that overflows above it via
            // negative margin-top ≈ 100px, plus the iOS home-indicator inset
            // stacked on top. md+ hides the bar entirely, so the reserve drops.
            mb={{ base: "calc(100px + env(safe-area-inset-bottom))", md: "0" }}
            {...props}
        >
            <Flex
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
