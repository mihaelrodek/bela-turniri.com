import { Box, chakra, Flex, HStack, Text, VStack } from "@chakra-ui/react"
import { FiImage } from "react-icons/fi"
import type { ReactNode } from "react"

/* ──────────────────────────────────────────────────────────────────────────
   TournamentReviewCard — the read-only "Pregled" screen of the create-
   tournament wizard: poster + headline on top, a label/value list below.

   Deliberately presentational. Every string, including the "not entered"
   fallbacks, is built by the caller, so the whole form state stays in
   CreateTournamentPage and this file never has to know what a repasaž is.
   ────────────────────────────────────────────────────────────────────── */

export type ReviewRow = {
    label: string
    value: ReactNode
    /** Long free text (details) gets its own full-width row. */
    wide?: boolean
}

export default function TournamentReviewCard({
    heading,
    headingFallback,
    subheading,
    posterSrc,
    posterAlt,
    noPosterLabel,
    rows,
}: {
    /** Tournament name as typed; empty renders `headingFallback`. */
    heading: string
    headingFallback: string
    /** One-line "check this before publishing" hint under the heading. */
    subheading: string
    posterSrc: string | null
    posterAlt: string
    noPosterLabel: string
    rows: ReviewRow[]
}) {
    return (
        <Box
            bg="bg.panel"
            borderWidth="1px"
            borderColor="border.emphasized"
            rounded="xl"
            shadow="sm"
            overflow="hidden"
        >
            <Flex direction={{ base: "column", sm: "row" }} align="stretch">
                {/* Poster rail — a slim band on phones so an empty poster
                    doesn't eat half the first screen of the summary. */}
                <Box
                    w={{ base: "100%", sm: "160px" }}
                    h={{ base: "120px", sm: "auto" }}
                    minH={{ sm: "120px" }}
                    flexShrink={0}
                    bg="bg.subtle"
                    borderBottomWidth={{ base: "1px", sm: "0" }}
                    borderRightWidth={{ base: "0", sm: "1px" }}
                    borderColor="border.subtle"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    color="fg.subtle"
                >
                    {posterSrc ? (
                        <img
                            src={posterSrc}
                            alt={posterAlt}
                            loading="lazy"
                            decoding="async"
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                    ) : (
                        <VStack gap="1">
                            <FiImage size={22} aria-hidden />
                            <Text fontSize="xs">{noPosterLabel}</Text>
                        </VStack>
                    )}
                </Box>

                <Box flex="1" minW="0" px={{ base: "4", md: "5" }} py="4">
                    <Text fontSize="lg" fontWeight="bold" lineHeight="1.2" truncate>
                        {heading.trim() || <chakra.span color="fg.subtle">{headingFallback}</chakra.span>}
                    </Text>
                    <Text fontSize="sm" color="fg.muted" mt="1">
                        {subheading}
                    </Text>

                    <VStack align="stretch" gap="0" mt="3">
                        {rows.map((row) => (
                            <Box
                                key={row.label}
                                borderTopWidth="1px"
                                borderColor="border.subtle"
                                py="2"
                            >
                                {row.wide ? (
                                    <VStack align="stretch" gap="0.5">
                                        <Text fontSize="xs" color="fg.muted">
                                            {row.label}
                                        </Text>
                                        <Box fontSize="sm">{row.value}</Box>
                                    </VStack>
                                ) : (
                                    <HStack align="start" justify="space-between" gap="4">
                                        <Text fontSize="sm" color="fg.muted" flexShrink={0}>
                                            {row.label}
                                        </Text>
                                        <Box fontSize="sm" fontWeight="medium" textAlign="end" minW="0">
                                            {row.value}
                                        </Box>
                                    </HStack>
                                )}
                            </Box>
                        ))}
                    </VStack>
                </Box>
            </Flex>
        </Box>
    )
}
