import { Box, IconButton } from "@chakra-ui/react"
import { useLocation } from "react-router-dom"
import { FiVolume2 } from "react-icons/fi"
import { useTranslation } from "../i18n"
import { usePrefersReducedMotion } from "../game/hooks/usePrefersReducedMotion"
import { MOBILE_TABBAR_CLEARANCE } from "../components/navChrome"
import { open, useHasUnseenWhatsNew } from "./store"

/* ──────────────────────────────────────────────────────────────────────────
   WhatsNewFab — the sticky "Novosti" button that opens `WhatsNewDialog`.

   Mounted once, at root (`main.tsx`), inside the router so it can read the
   current route and hide itself wherever a bottom-docked action bar already
   owns this screen corner:
     - /igra*  — the online-bela table docks the hand at the viewport bottom
       (see MobileTabBar's own `hidden` list for the same reasoning);
     - /blok*  — Bela blok's bottom action bar, AND its `/blok/z/:token`
       share view, which the prefix already covers.

   Deliberately tiny and eager (unlike `WhatsNewDialog`, which is
   `React.lazy`): the badge dot has to be correct on first paint, and this
   component's own weight is a handful of style props plus one icon import,
   not the release prose.
   ────────────────────────────────────────────────────────────────────── */

export default function WhatsNewFab() {
    const { pathname } = useLocation()
    const { t } = useTranslation()
    const unseen = useHasUnseenWhatsNew()
    const reducedMotion = usePrefersReducedMotion()

    const hidden = pathname.startsWith("/igra") || pathname.startsWith("/blok")
    if (hidden) return null

    const label = t("whatsNew.fab.ariaLabel")

    return (
        <Box
            position="fixed"
            right={{ base: "4", md: "24px" }}
            /* Clear of BOTH bottom chromes (2026-09-10): the mobile tab bar
               plus a gap on phones, and the site footer on desktop — sitting
               level with either one read as part of it. */
            bottom={{ base: `calc(${MOBILE_TABBAR_CLEARANCE} + 12px)`, md: "88px" }}
            // Below CookieConsent (950) and the sticky header (1000), above
            // MobileTabBar (900) — it floats just clear of the tab bar, not
            // over it, so this ordering rarely matters in practice.
            zIndex={920}
        >
            <Box position="relative">
                <IconButton
                    aria-label={label}
                    title={label}
                    onClick={open}
                    colorPalette="brand"
                    variant="solid"
                    rounded="full"
                    boxSize="48px"
                    boxShadow="raised"
                    // A single gentle pulse the first time this shows up
                    // unseen — never a loop, and skipped entirely under
                    // reduced motion. Re-mounting the FAB (e.g. navigating
                    // away to a hidden route and back) can replay it once
                    // more while still unseen, which reads as "this is worth
                    // a look" rather than as a nagging animation.
                    css={
                        unseen && !reducedMotion
                            ? {
                                animation: "belaWhatsNewPulse 1.6s ease-out 1",
                                "@keyframes belaWhatsNewPulse": {
                                    "0%": { transform: "scale(1)" },
                                    "30%": { transform: "scale(1.12)" },
                                    "60%": { transform: "scale(0.98)" },
                                    "100%": { transform: "scale(1)" },
                                },
                            }
                            : undefined
                    }
                >
                    <FiVolume2 size={22} />
                </IconButton>
                {unseen && (
                    <Box
                        position="absolute"
                        top="1px"
                        right="1px"
                        boxSize="12px"
                        rounded="full"
                        bg="fg.error"
                        borderWidth="2px"
                        borderColor="bg.canvas"
                        aria-hidden="true"
                    />
                )}
            </Box>
        </Box>
    )
}
