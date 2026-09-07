import { Box, Flex, HStack, Text } from "@chakra-ui/react"
import { FaTrophy } from "react-icons/fa"
import { useTranslation } from "../i18n"

/* ──────────────────────────────────────────────────────────────────────────
   TournamentResultsCard — the podium of a finished tournament, as a compact
   card. Lives in the tournament detail sidebar on lg+ (under the section
   nav) and in the content column on phones, mirroring the sibling futsal
   app's „Rezultati“ block.

   Read-only on purpose: filling the podium in stays where it already is,
   in the Parovi tab's PodiumEditor. This is the always-visible summary.

   The three metals are literal hex values rather than theme tokens — gold,
   silver and bronze read as themselves in both colour modes and have no
   sensible semantic equivalent. Everything around them (surface, border,
   text) is a semantic token, so the card follows light/dark like any other.
   ────────────────────────────────────────────────────────────────────── */

/** Gold / silver / bronze, in podium order.
 *
 *  Exported because three screens were carrying their own copy of these three
 *  hex values (this card, the tournament detail page's rewards tile and the
 *  profile page's winner trophy) and a fourth would have been along shortly.
 *  They stay literals rather than semantic tokens on purpose: the metals read
 *  as themselves in both colour modes and have no `fg.*` equivalent. */
export const MEDALS = ["#F5C518", "#9CA3AF", "#CD7F32"] as const

export default function TournamentResultsCard({
    winnerName,
    secondName,
    thirdName,
}: {
    winnerName?: string | null
    secondName?: string | null
    thirdName?: string | null
}) {
    const { t: tr } = useTranslation()

    const places = [
        { label: tr("tournament.place.first"), name: winnerName },
        { label: tr("tournament.place.second"), name: secondName },
        { label: tr("tournament.place.third"), name: thirdName },
    ].map((p, i) => ({ ...p, color: MEDALS[i] }))

    // Nothing decided yet — the card would be an empty golden box.
    if (!places.some((p) => p.name && p.name.trim())) return null

    return (
        <Box
            flexShrink={0}
            bg="yellow.subtle"
            borderWidth="1px"
            borderColor="yellow.muted"
            rounded="xl"
            shadow="card"
            p="3"
        >
            <Text
                fontSize="2xs"
                fontWeight="semibold"
                color="fg.muted"
                letterSpacing="wider"
                textTransform="uppercase"
                mb="2"
                px="0.5"
            >
                {tr("tournament.results.heading")}
            </Text>
            <Flex direction="column" gap="1.5">
                {places.map((p) =>
                    p.name && p.name.trim() ? (
                        <HStack
                            key={p.label}
                            gap="2.5"
                            px="2.5"
                            py="2"
                            rounded="lg"
                            bg="bg.panel"
                            borderWidth="1px"
                            borderColor="border.subtle"
                        >
                            <Box color={p.color} flexShrink={0} display="flex" alignItems="center">
                                <FaTrophy size={16} />
                            </Box>
                            <Box minW="0">
                                <Text
                                    fontSize="2xs"
                                    color="fg.muted"
                                    letterSpacing="wide"
                                    textTransform="uppercase"
                                    lineHeight="1.2"
                                >
                                    {p.label}
                                </Text>
                                <Text fontWeight="semibold" fontSize="sm" lineHeight="1.3" truncate>
                                    {p.name}
                                </Text>
                            </Box>
                        </HStack>
                    ) : null,
                )}
            </Flex>
        </Box>
    )
}
