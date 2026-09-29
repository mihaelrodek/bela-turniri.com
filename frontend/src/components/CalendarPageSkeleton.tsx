import { Box, HStack, Skeleton, Stack, VStack } from "@chakra-ui/react"

/* ──────────────────────────────────────────────────────────────────────────
   CalendarPageSkeleton — /kalendar's agenda view in grey (2026-09-29).

   App.tsx shows it as the route's Suspense fallback while CalendarPage's
   lazy chunk downloads, in place of the old centred spinner. It draws the
   page header (title, count, view toggle + two buttons), the month
   navigation and the same event rows CalendarPage shows while its data
   loads — so chunk wait and data wait read as one continuous skeleton.

   `CalendarEventRowSkeleton` moved here from CalendarEventRow.tsx for that
   reason: this file must stay outside the lazy chunk (it is on screen before
   that chunk has arrived). Chakra skeletons only — nothing heavy.
   ────────────────────────────────────────────────────────────────────── */

/** Skeleton with the row's silhouette, so the agenda doesn't jump on load. */
export function CalendarEventRowSkeleton() {
    return (
        <Box
            h={{ base: "88px", md: "96px" }}
            rounded="xl"
            borderWidth="1px"
            borderColor="border.subtle"
            bg="bg.subtle"
        />
    )
}

export default function CalendarPageSkeleton() {
    return (
        <VStack align="stretch" gap="5" aria-busy="true">
            <Stack
                direction={{ base: "column", md: "row" }}
                justify="space-between"
                align={{ base: "stretch", md: "center" }}
                gap="3"
                aria-hidden="true"
            >
                <Box>
                    <Skeleton h="30px" w="160px" rounded="md" />
                    <Skeleton h="14px" w="120px" rounded="md" mt="1.5" />
                </Box>
                <HStack gap="2" flexShrink="0">
                    <Skeleton h="42px" w={{ base: "84px", md: "200px" }} rounded="lg" />
                    <Skeleton h="32px" w="110px" rounded="md" />
                    <Skeleton h="32px" w="110px" rounded="md" />
                </HStack>
            </Stack>
            <VStack align="stretch" gap="4" aria-hidden="true">
                <Box display="grid" gridTemplateColumns="1fr auto 1fr" alignItems="center" gap="2">
                    <Skeleton h="32px" w="32px" rounded="md" justifySelf="start" />
                    <Skeleton h="24px" w="140px" rounded="md" />
                    <HStack gap="1" justifySelf="end">
                        <Skeleton h="32px" w="32px" rounded="md" />
                        <Skeleton h="32px" w="56px" rounded="md" />
                    </HStack>
                </Box>
                <VStack align="stretch" gap="2">
                    <CalendarEventRowSkeleton />
                    <CalendarEventRowSkeleton />
                    <CalendarEventRowSkeleton />
                </VStack>
            </VStack>
        </VStack>
    )
}
