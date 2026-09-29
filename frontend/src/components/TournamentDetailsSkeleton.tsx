import { Box, HStack, Skeleton, SkeletonText, VStack } from "@chakra-ui/react"
import { useTranslation } from "../i18n"

/* ──────────────────────────────────────────────────────────────────────────
   TournamentDetailsSkeleton — the tournament page's shape, grey: a header
   strip, the section pills, the tile grid and a stack of list rows
   (2026-09-29).

   ONE component for both waits on /turniri/:slug: App.tsx shows it as the
   route's Suspense fallback while the page's lazy chunk downloads, and
   TournamentDetailsPage renders the very same thing while its data loads.
   Before, the first wait was a centred spinner and the second this layout,
   so the screen jumped once before it even started filling in.

   Lives outside the page's lazy chunk on purpose (it must be on screen
   before that chunk has arrived). Chakra skeletons only — nothing heavy.
   ────────────────────────────────────────────────────────────────────── */
export default function TournamentDetailsSkeleton() {
    const { t } = useTranslation()
    return (
        <VStack align="stretch" gap="4" aria-busy="true" aria-label={t("tournament.loadingAria")}>
            <Skeleton height="24px" width="60%" maxW="320px" rounded="md" />
            <HStack gap="2" aria-hidden="true">
                {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} height="32px" width="88px" rounded="md" />
                ))}
            </HStack>
            <Box
                display="grid"
                gridTemplateColumns={{ base: "1fr", md: "1fr 1fr", lg: "1fr 1fr 1fr" }}
                gap="3"
                aria-hidden="true"
            >
                {[0, 1, 2, 3, 4, 5].map((i) => (
                    <Box
                        key={i}
                        borderWidth="1px"
                        borderColor="border.emphasized"
                        rounded="lg"
                        px="3"
                        py="2.5"
                    >
                        <Skeleton height="10px" width="45%" mb="2" rounded="sm" />
                        <Skeleton height="18px" width="75%" rounded="sm" />
                    </Box>
                ))}
            </Box>
            <VStack align="stretch" gap="2" aria-hidden="true">
                {[0, 1, 2].map((i) => (
                    <Box
                        key={i}
                        borderWidth="1px"
                        borderColor="border.emphasized"
                        rounded="lg"
                        p="3"
                    >
                        <SkeletonText noOfLines={2} gap="2" />
                    </Box>
                ))}
            </VStack>
        </VStack>
    )
}
