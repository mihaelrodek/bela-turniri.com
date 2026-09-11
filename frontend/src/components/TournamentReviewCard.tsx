import { Box, chakra, Flex, Text, VStack } from "@chakra-ui/react"
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
    /** Long free text (location, rewards, details) spans both columns of
     *  the label/value grid instead of sharing a row with another field. */
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
            {/* Row layout only kicks in at `md`: at `sm` a 40%-wide poster
                column would squeeze the label/value grid into an unreadable
                sliver, so phones AND small tablets stack the poster above
                the rows. */}
            <Flex direction={{ base: "column", md: "row" }} align="stretch">
                {posterSrc ? (
                    /* Poster rail, poster present — sized to actually be
                       readable (was a 160px cropped sliver before). The
                       inner box fixes a portrait-poster aspect ratio and
                       uses `contain` so the whole poster shows regardless
                       of its real proportions; `bg.subtle` fills whatever
                       the image doesn't (the "letterbox"). */
                    <Box
                        w={{ base: "100%", md: "40%" }}
                        maxW={{ md: "420px" }}
                        flexShrink={0}
                        p={{ base: "4", md: "5" }}
                        display="flex"
                        alignItems="flex-start"
                        justifyContent="center"
                        borderBottomWidth={{ base: "1px", md: "0" }}
                        borderRightWidth={{ base: "0", md: "1px" }}
                        borderColor="border.subtle"
                    >
                        <Box
                            w="100%"
                            aspectRatio={3 / 4}
                            bg="bg.subtle"
                            borderWidth="1px"
                            borderColor="border.subtle"
                            rounded="lg"
                            overflow="hidden"
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                        >
                            <img
                                src={posterSrc}
                                alt={posterAlt}
                                loading="lazy"
                                decoding="async"
                                style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                            />
                        </Box>
                    </Box>
                ) : (
                    /* No poster — keep the old slim placeholder band rather
                       than reserving the big frame above for nothing. */
                    <Box
                        w={{ base: "100%", md: "160px" }}
                        h={{ base: "120px", md: "auto" }}
                        minH={{ md: "120px" }}
                        flexShrink={0}
                        bg="bg.subtle"
                        borderBottomWidth={{ base: "1px", md: "0" }}
                        borderRightWidth={{ base: "0", md: "1px" }}
                        borderColor="border.subtle"
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        color="fg.subtle"
                    >
                        <VStack gap="1">
                            <FiImage size={22} aria-hidden />
                            <Text fontSize="xs">{noPosterLabel}</Text>
                        </VStack>
                    </Box>
                )}

                <Box flex="1" minW="0" px={{ base: "4", md: "5" }} py="4">
                    <Text fontSize="lg" fontWeight="bold" lineHeight="1.2" truncate>
                        {heading.trim() || <chakra.span color="fg.subtle">{headingFallback}</chakra.span>}
                    </Text>
                    <Text fontSize="sm" color="fg.muted" mt="1">
                        {subheading}
                    </Text>

                    {/* Compact label/value grid: two columns for short
                        values so the summary fits without scrolling, one
                        full-width row (`wide`) for long free text. */}
                    <Box
                        display="grid"
                        gridTemplateColumns={{ base: "1fr", sm: "1fr 1fr" }}
                        columnGap="5"
                        mt="3"
                    >
                        {rows.map((row) => (
                            <Box
                                key={row.label}
                                gridColumn={row.wide ? "1 / -1" : "auto"}
                                borderTopWidth="1px"
                                borderColor="border.subtle"
                                py="1.5"
                            >
                                <Text
                                    fontSize="xs"
                                    color="fg.muted"
                                    textTransform="uppercase"
                                    letterSpacing="0.03em"
                                >
                                    {row.label}
                                </Text>
                                <Box
                                    fontSize="sm"
                                    fontWeight="medium"
                                    mt="0.5"
                                    // Location, rewards and details are prose —
                                    // never clip them; numbers/dates get the
                                    // tabular figure alignment.
                                    whiteSpace={row.wide ? "normal" : undefined}
                                    fontVariantNumeric={row.wide ? undefined : "tabular-nums"}
                                >
                                    {row.value}
                                </Box>
                            </Box>
                        ))}
                    </Box>
                </Box>
            </Flex>
        </Box>
    )
}
