import { Box, HStack, Skeleton, SkeletonCircle, SkeletonText, VStack } from "@chakra-ui/react"

/* ──────────────────────────────────────────────────────────────────────────
   ProfilePageSkeleton — /profil/:slug in grey while it loads (2026-09-29).

   ONE component for both waits: App.tsx shows it as the route's Suspense
   fallback while PublicProfilePage's lazy chunk downloads, and the page
   renders the very same thing while the profile itself is fetched. Before,
   the first wait was a centred spinner and the second three grey slabs, so
   the screen changed twice before any real content showed.

   Whether the viewer owns the profile is not known yet at this point, so it
   draws the common denominator: an identity card, a strip, a list card.

   `ProfileCardSkeleton` is one card on its own — the profile's lazy admin
   tabs use it while their chunk arrives.

   Lives outside the page's lazy chunk on purpose (it must be on screen
   before that chunk has arrived). Chakra skeletons only — nothing heavy.
   ────────────────────────────────────────────────────────────────────── */

/** One rounded, bordered card with a title bar and a few lines. */
export function ProfileCardSkeleton({ lines = 3 }: { lines?: number }) {
    return (
        <Box
            rounded="xl"
            borderWidth="1px"
            borderColor="border.subtle"
            bg="bg.panel"
            p="5"
            aria-hidden="true"
        >
            <Skeleton h="20px" w="40%" maxW="220px" rounded="md" mb="4" />
            <SkeletonText noOfLines={lines} gap="3" />
        </Box>
    )
}

export default function ProfilePageSkeleton() {
    return (
        <VStack align="stretch" gap="4" maxW="900px" mx="auto" w="full" aria-busy="true">
            <Box
                rounded="xl"
                borderWidth="1px"
                borderColor="border.subtle"
                bg="bg.panel"
                p="5"
                aria-hidden="true"
            >
                <HStack gap="4">
                    <SkeletonCircle size="72px" />
                    <VStack align="stretch" gap="2" flex="1" minW="0">
                        <Skeleton h="22px" w="55%" maxW="260px" rounded="md" />
                        <Skeleton h="14px" w="35%" maxW="160px" rounded="md" />
                    </VStack>
                </HStack>
            </Box>
            <Skeleton h="44px" rounded="xl" aria-hidden="true" />
            <ProfileCardSkeleton lines={5} />
        </VStack>
    )
}
