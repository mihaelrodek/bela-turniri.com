import { Box, Flex, Grid, HStack, Skeleton, SkeletonCircle, VStack } from "@chakra-ui/react"
import { MAP_DESKTOP_H, MAP_DESKTOP_MIN_H, MAP_MOBILE_H, MAP_MOBILE_MIN_H } from "./mapLayout"

/* ──────────────────────────────────────────────────────────────────────────
   MapPageSkeleton — /karta in grey while its lazy chunk (Leaflet and all)
   downloads (2026-09-29), in place of the old centred spinner: the toolbar
   panel, the desktop list column and the map box, sized from the same
   `mapLayout` constants MapPage uses so the real map lands in the same box.

   Lives outside the page's lazy chunk on purpose (it must be on screen
   before that chunk has arrived). Chakra skeletons only — nothing heavy.
   ────────────────────────────────────────────────────────────────────── */
export default function MapPageSkeleton() {
    return (
        <VStack align="stretch" gap="4" aria-busy="true">
            <Box
                borderWidth="1px"
                borderColor="border.subtle"
                bg="bg.panel"
                rounded="xl"
                p="3"
                shadow="xs"
                aria-hidden="true"
            >
                <Flex align="center" gap={{ base: "2", md: "4" }}>
                    <Skeleton h="8px" flex="1" rounded="full" />
                    <HStack gap="3" display={{ base: "none", md: "flex" }} flexShrink="0">
                        {[0, 1, 2].map((i) => (
                            <HStack key={i} gap="1.5">
                                <SkeletonCircle size="10px" />
                                <Skeleton h="12px" w="64px" rounded="sm" />
                            </HStack>
                        ))}
                    </HStack>
                    <Skeleton h="32px" w={{ base: "32px", md: "120px" }} rounded="md" flexShrink="0" />
                </Flex>
            </Box>
            <Grid
                templateColumns={{ base: "minmax(0, 1fr)", md: "340px minmax(0, 1fr)" }}
                gap="5"
                aria-hidden="true"
            >
                <VStack display={{ base: "none", md: "flex" }} align="stretch" gap="2">
                    <Skeleton h="20px" w="50%" rounded="md" />
                    {[0, 1, 2, 3].map((i) => (
                        <Skeleton key={i} h="84px" rounded="xl" />
                    ))}
                </VStack>
                <Skeleton
                    mt={{ base: "0", md: "7" }}
                    rounded="xl"
                    h={{ base: MAP_MOBILE_H, md: MAP_DESKTOP_H }}
                    minH={{ base: MAP_MOBILE_MIN_H, md: MAP_DESKTOP_MIN_H }}
                />
            </Grid>
        </VStack>
    )
}
