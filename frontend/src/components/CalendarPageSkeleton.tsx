import { Box, HStack, Skeleton, VStack } from "@chakra-ui/react"

/* ──────────────────────────────────────────────────────────────────────────
   CalendarPageSkeleton — /kalendar's agenda view in grey (2026-09-29).

   App.tsx shows it as the route's Suspense fallback while CalendarPage's
   lazy chunk downloads, in place of the old centred spinner. It draws the
   one-row toolbar (view toggle left, month navigation centre, two buttons
   right)
   and the same event rows CalendarPage shows while its data
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
            <Box
                display="grid"
                gridTemplateColumns={{ base: "auto 1fr", lg: "1fr auto 1fr" }}
                gridTemplateAreas={{ base: `"nav nav" "view actions"`, lg: `"view nav actions"` }}
                alignItems="center"
                gap="3"
                aria-hidden="true"
            >
                <Skeleton gridArea="view" justifySelf="start" h="40px" w={{ base: "84px", md: "200px" }} rounded="lg" />
                <Skeleton gridArea="nav" justifySelf="center" h="40px" w={{ base: "260px", md: "440px" }} rounded="lg" />
                <HStack gridArea="actions" justifySelf="end" gap="2">
                    <Skeleton h="40px" w="110px" rounded="md" />
                    <Skeleton h="40px" w="110px" rounded="md" />
                </HStack>
            </Box>
            <VStack align="stretch" gap="4" aria-hidden="true">
                <VStack align="stretch" gap="2">
                    <CalendarEventRowSkeleton />
                    <CalendarEventRowSkeleton />
                    <CalendarEventRowSkeleton />
                </VStack>
            </VStack>
        </VStack>
    )
}
