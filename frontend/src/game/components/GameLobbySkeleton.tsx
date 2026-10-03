import { Box, Center, Flex, HStack, SimpleGrid, Skeleton, SkeletonCircle, VStack } from "@chakra-ui/react"
import SuitSpinner from "../../components/SuitSpinner"

/* ──────────────────────────────────────────────────────────────────────────
   GameLobbySkeleton — the lobby's own shape, grey, while anything about it
   is still loading (2026-09-29, user report).

   Opening the lobby used to walk through four different loading screens in a
   row: the route chunk's spinner, the kill-switch spinner (GameFeatureGate),
   the sign-in spinner (GameIdentityGate), and finally the real page with a
   "?" avatar, "…" for a name and a "Spajanje…" spinner under the filters.
   Each one moved the spinner somewhere else. Every one of those waits now
   renders this instead, so the page keeps one layout from the first frame and
   only fills in.

   Lives outside the lobby's lazy chunk on purpose: App.tsx and both gates
   import it, and it must be on screen BEFORE that chunk has arrived. Chakra
   skeletons only — nothing heavy.
   ────────────────────────────────────────────────────────────────────── */

/** Room cards only — the list area of the real lobby while it connects.
 *  `label` is the spinner's accessible name, never visible text: while the
 *  socket retries, its status flips every attempt, and a visible line kept
 *  swapping between messages (2026-09-29, user report). */
export function RoomCardSkeletons({ count = 3, label }: { count?: number; label?: string }) {
    return (
        <VStack align="stretch" gap="3">
            {label && (
                <Center role="status">
                    <SuitSpinner size="sm" label={label} />
                </Center>
            )}
            <SimpleGrid className="responsive-room-grid" gap="4" aria-hidden="true">
                {Array.from({ length: count }, (_, i) => (
                    <Box key={i} rounded="xl" borderWidth="1px" borderColor="border.subtle" bg="bg" p="2.5">
                        <Flex justify="space-between" align="center" gap="2" mb="2">
                            <Skeleton h="20px" w="40%" rounded="md" />
                            <HStack gap="1.5">
                                <Skeleton h="20px" w="40px" rounded="full" />
                                <Skeleton h="20px" w="72px" rounded="full" />
                                <Skeleton h="20px" w="48px" rounded="full" />
                            </HStack>
                        </Flex>
                        <HStack gap="3">
                            {[0, 1].map((pair) => (
                                <HStack key={pair} gap="1.5">
                                    <SkeletonCircle size="36px" />
                                    <SkeletonCircle size="36px" />
                                </HStack>
                            ))}
                        </HStack>
                    </Box>
                ))}
            </SimpleGrid>
        </VStack>
    )
}

/** The whole lobby: profile row, search + filters, room cards. */
export default function GameLobbySkeleton({ label }: { label?: string }) {
    return (
        <Box maxW="1040px" mx="auto" w="full">
            <VStack gap="6" align="stretch">
                <Flex align="center" gap="3" py="2" aria-hidden="true">
                    <HStack gap="3" flex="1" minW="0">
                        <SkeletonCircle size="56px" />
                        <Skeleton h="22px" w="45%" maxW="200px" rounded="md" />
                    </HStack>
                    <SkeletonCircle size="40px" />
                </Flex>
                <VStack align="stretch" gap="2" aria-hidden="true">
                    <Skeleton h="40px" rounded="l2" />
                    <HStack gap="2" overflow="hidden">
                        {[96, 80, 72, 64, 56].map((w) => (
                            <Skeleton key={w} h="32px" w={`${w}px`} rounded="full" flexShrink={0} />
                        ))}
                    </HStack>
                </VStack>
                <RoomCardSkeletons label={label} />
            </VStack>
        </Box>
    )
}
