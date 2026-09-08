import { Box, Button, Heading, HStack, Text, VStack } from "@chakra-ui/react"
import { useTranslation } from "../i18n"

/* ──────────────────────────────────────────────────────────────────────────
   "This page needs the network; the blok does not."

   Shown by ErrorBoundary when a route's chunk could not be fetched and the
   device is offline (`lazyWithReload` → `OFFLINE_CHUNK_ERROR`). It replaces
   two worse outcomes an installed PWA opened on a bus used to produce: the
   generic "Osvježi stranicu" crash screen, which asks for the one thing that
   cannot work, and a Suspense spinner over an import that will never resolve.

   WHY IT IS NOT A GLOBAL "YOU ARE OFFLINE" SCREEN — DECISION. Plenty of this
   app does work with no signal: `public/sw.js` keeps a snapshot of anonymous
   API reads, so an already-visited round view and its standings open and
   survive a reload. Painting an offline screen over every route the moment
   `navigator.onLine` flips would take that away and replace it with a
   sentence. This renders for exactly one failure — the page's CODE is not on
   this device and cannot be fetched — which is the only case where there is
   genuinely nothing to show.

   The two buttons are full navigations, not router links: the boundary is
   showing precisely because the SPA could not load a piece of itself, so the
   honest recovery is to go through the service worker again rather than to
   ask the same broken router for another route.
   ────────────────────────────────────────────────────────────────────── */

/** True while the player is already inside the scorepad — then the "open the
 *  blok" button would point at the page that just failed. */
function onBlok(): boolean {
    if (typeof window === "undefined") return false
    const path = window.location.pathname
    return path === "/blok" || path.startsWith("/blok/")
}

export default function OfflineNotice() {
    const { t } = useTranslation()
    const showBlok = !onBlok()

    return (
        <Box minH="100dvh" display="flex" alignItems="center" justifyContent="center" p="6">
            <VStack gap="4" textAlign="center" maxW="sm">
                <Heading size="md">{t("common.offline.title")}</Heading>
                <Text fontSize="sm" color="fg.muted">
                    {t(showBlok ? "common.offline.description" : "common.offline.descriptionBlok")}
                </Text>
                <HStack gap="3">
                    <Button variant="outline" onClick={() => window.location.reload()}>
                        {t("common.offline.retry")}
                    </Button>
                    {showBlok ? (
                        <Button colorPalette="brand" onClick={() => window.location.assign("/blok")}>
                            {t("common.offline.blok")}
                        </Button>
                    ) : null}
                </HStack>
            </VStack>
        </Box>
    )
}
