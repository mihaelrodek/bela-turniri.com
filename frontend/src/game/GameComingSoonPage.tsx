import { useEffect } from "react"
import { Box, Button, HStack, Heading, Text, VStack } from "@chakra-ui/react"
import { Link as RouterLink } from "react-router-dom"
import { FiArrowLeft, FiEdit3 } from "react-icons/fi"
import { useDocumentHead } from "../hooks/useDocumentHead"
import { useTranslation } from "../i18n"

/* ──────────────────────────────────────────────────────────────────────────
   What /igra* renders while the production kill switch is OFF.

   "Igraj" is now a permanent item in both navigations (NavBar's desktop
   capsule and MobileTabBar), so the flag no longer decides whether the
   feature is VISIBLE — only whether it is PLAYABLE. Someone who taps it
   while online bela is off has to land somewhere honest, and a toast plus a
   silent bounce to /turniri looked like a broken link. Hence a real page.

   Lives next to `GameFeatureGate` rather than in `pages/` on purpose: the
   gate is imported eagerly by App.tsx and renders this before any of the
   game's lazy chunks are touched, so this file must stay free of every
   `src/game` dependency (no socket, no protocol types, no card renderer) or
   the whole game bundle would ride into the main chunk for visitors who
   cannot even play yet.

   Deliberately plain: no countdown, no e-mail capture, no date. We do not
   know when the flag flips, and a promise we might miss is worse than none.
   ────────────────────────────────────────────────────────────────────── */

/**
 * Keeps this route out of search results for as long as the feature is off.
 *
 * Same shape as `SharedBlokPage`'s local `useNoIndex`, and local for the same
 * reason: the shared `useDocumentHead` hook has no notion of `<meta
 * name="robots">`, and teaching it one for two callers would change a hook
 * every other route also mounts.
 *
 * Why noindex here: this page is thin by design — it is a placeholder with no
 * content a searcher is looking for. Worse, it is TEMPORARY: the moment the
 * ops flag flips on, `/igra` becomes the real lobby (which sets its own
 * indexable title/description), and an indexed "dolazi uskoro" snippet would
 * keep telling people the feature does not exist yet. The effect is cleaned
 * up on unmount, so nothing leaks onto the next route.
 */
function useNoIndex() {
    useEffect(() => {
        let el = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]')
        const created = !el
        if (!el) {
            el = document.createElement("meta")
            el.setAttribute("name", "robots")
            document.head.appendChild(el)
        }
        const previous = el.getAttribute("content")
        el.setAttribute("content", "noindex, nofollow")
        return () => {
            if (!el) return
            if (created) {
                el.parentElement?.removeChild(el)
            } else if (previous != null) {
                el.setAttribute("content", previous)
            }
        }
    }, [])
}

export default function GameComingSoonPage() {
    const { t } = useTranslation()

    useNoIndex()
    useDocumentHead({
        title: t("game.comingSoon.metaTitle"),
        description: t("game.comingSoon.metaDescription"),
        ogTitle: t("game.comingSoon.title"),
        ogDescription: t("game.comingSoon.metaDescription"),
    })

    return (
        <VStack align="stretch" gap="4" maxW="640px" mx="auto" py={{ base: "8", md: "12" }}>
            {/* Same card treatment as NotFoundPage — the two are siblings in
                kind (a dead end with a way out), so they should not look like
                they came from different apps. Semantic tokens only, so both
                themes come out of the theme rather than a colour-mode hook. */}
            <Box
                borderWidth="1px"
                borderColor="border.emphasized"
                rounded="xl"
                shadow="sm"
                bg="bg.panel"
                p={{ base: "6", md: "8" }}
                textAlign="center"
            >
                <Text
                    fontSize="xs"
                    fontWeight="bold"
                    letterSpacing="wider"
                    textTransform="uppercase"
                    color="fg.muted"
                    mb="2"
                >
                    {t("game.comingSoon.label")}
                </Text>
                <Heading size="lg" mb="3">{t("game.comingSoon.title")}</Heading>
                <Text color="fg.muted" mb="6">
                    {t("game.comingSoon.description")}
                </Text>
                <HStack justify="center" gap="3" wrap="wrap">
                    <Button asChild size="sm" variant="solid" colorPalette="brand">
                        <RouterLink to="/turniri">
                            <FiArrowLeft /> {t("game.comingSoon.backToTournaments")}
                        </RouterLink>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                        <RouterLink to="/blok">
                            <FiEdit3 /> {t("game.comingSoon.openBlok")}
                        </RouterLink>
                    </Button>
                </HStack>
            </Box>
        </VStack>
    )
}
