import type { ReactNode } from "react"
import { Box, Flex, Grid, Skeleton, SkeletonCircle, VStack } from "@chakra-ui/react"

/* ──────────────────────────────────────────────────────────────────────────
   GameTableSkeleton — the card table's shape, grey, while a room is being
   joined (2026-09-29, user report).

   Opening /igra/soba/:id used to show a centred spinner twice over — once
   while the game chunk downloaded (App.tsx's route fallback) and again while
   the socket joined the room (GameRoomPage's `!room` branch). Both waits now
   draw this instead: a score strip, four seats (avatar circle + name bar) at
   top / left / right / bottom around a centre where the trick lands, and the
   hand tray — two rows of four cards on a phone, one row of eight from `md`,
   at the same card widths `handLayout` uses (56 / 72 px, mađarica ratio).

   `status` is drawn over the centre, so the page can keep its joining spinner (and,
   once slow, a back-to-lobby button) on screen without a second layout.

   Lives outside the game's lazy chunk on purpose: App.tsx imports it, and it
   must be on screen BEFORE that chunk has arrived. Chakra skeletons only —
   nothing heavy, nothing from @bela/*.
   ────────────────────────────────────────────────────────────────────── */

/** One seat: avatar circle over a name bar. */
function SeatSkeleton() {
    return (
        <VStack gap="1.5">
            <SkeletonCircle size={{ base: "40px", md: "44px" }} />
            <Skeleton h="12px" w="64px" rounded="full" />
        </VStack>
    )
}

export default function GameTableSkeleton({ status }: { status?: ReactNode }) {
    return (
        <Flex direction="column" gap="3" maxW="880px" mx="auto" w="full" aria-busy="true">
            {/* Score strip */}
            <Skeleton h="40px" rounded="xl" aria-hidden="true" />

            {/* The felt: partner on top, opponents on the flanks, trick in the middle. */}
            <Box position="relative" h="clamp(260px, 44vh, 420px)">
                <Box position="absolute" top="2" left="50%" transform="translateX(-50%)" aria-hidden="true">
                    <SeatSkeleton />
                </Box>
                <Box position="absolute" left="1" top="50%" transform="translateY(-50%)" aria-hidden="true">
                    <SeatSkeleton />
                </Box>
                <Box position="absolute" right="1" top="50%" transform="translateY(-50%)" aria-hidden="true">
                    <SeatSkeleton />
                </Box>
                <Flex
                    position="absolute"
                    top="50%"
                    left="50%"
                    transform="translate(-50%, -50%)"
                    w={{ base: "132px", md: "176px" }}
                    h={{ base: "132px", md: "176px" }}
                    rounded="full"
                    borderWidth="2px"
                    borderStyle="dashed"
                    borderColor="border.subtle"
                    align="center"
                    justify="center"
                    textAlign="center"
                    px="3"
                >
                    {status}
                </Flex>
            </Box>

            {/* My seat, then the hand tray. */}
            <Flex justify="center" aria-hidden="true">
                <SeatSkeleton />
            </Flex>
            <Grid
                templateColumns={{ base: "repeat(4, 56px)", md: "repeat(8, 72px)" }}
                gap="6px"
                justifyContent="center"
                aria-hidden="true"
            >
                {Array.from({ length: 8 }, (_, i) => (
                    <Skeleton key={i} h={{ base: "90px", md: "115px" }} rounded="md" />
                ))}
            </Grid>
        </Flex>
    )
}
