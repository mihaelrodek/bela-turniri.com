import React from "react"
import { Badge, Box, Button, Card, chakra, Heading, HStack, Input, Text, VStack } from "@chakra-ui/react"
import { Link as RouterLink } from "react-router-dom"
import { FaTrophy } from "react-icons/fa"
import { FiShare2 } from "react-icons/fi"
import type { PairSummary, PublicProfile } from "../../api/publicProfile"
import { useTranslation, usePlural } from "../../i18n"
import { pairKey } from "./pairKey"


/* -------------------------------------------------------------------------- */
/* Turniri card                                                                */
/* -------------------------------------------------------------------------- */

export function TournamentsCard({
    profile,
    activePair,
    setActivePair,
    search,
    setSearch,
    filteredCount,
    rows,
}: {
    profile: PublicProfile
    activePair: string | null
    setActivePair: (name: string) => void
    search: string
    setSearch: (value: string) => void
    filteredCount: number
    rows: React.ReactNode
}) {
    const { t } = useTranslation()
    const plural = usePlural()
    return (
                <Card.Root variant="outline" rounded="xl" borderColor="border.emphasized" shadow="sm">
                    <Card.Body p={{ base: "4", md: "5" }}>
                        <VStack align="stretch" gap="3">
                            <HStack justify="space-between" wrap="wrap" gap="2">
                                <Heading size="md">
                                    {t("profile.tournaments.heading")}
                                    {activePair ? <chakra.span color="fg.muted"> — {activePair}</chakra.span> : null}
                                </Heading>
                                {activePair && profile.pairs.length > 0 && (
                                    <Badge variant="subtle" colorPalette="blue">
                                        {plural("profile.tournamentsCount", filteredCount)}
                                    </Badge>
                                )}
                            </HStack>

                            {/* Pair picker — filter chips */}
                            {profile.pairs.length === 0 ? (
                                <Box
                                    borderWidth="1px"
                                    borderColor="border.emphasized"
                                    borderStyle="dashed"
                                    rounded="md"
                                    py="6"
                                    px="4"
                                    textAlign="center"
                                >
                                    <Text color="fg.muted" fontSize="sm">
                                        {t("profile.tournaments.emptyNoPairs")}
                                    </Text>
                                </Box>
                            ) : (
                                <HStack gap="2" wrap="wrap">
                                    {profile.pairs.map((p) => (
                                        <PairChip
                                            key={p.name}
                                            pair={p}
                                            active={activePair != null && pairKey(activePair) === pairKey(p.name)}
                                            onClick={() => setActivePair(p.name)}
                                        />
                                    ))}
                                </HStack>
                            )}

                            {/* Partner link for the currently selected pair.
                                Rendered as a separate clickable element
                                because nesting it inside the chip button is
                                an HTML anti-pattern (button-in-button). */}
                            {activePair && (() => {
                                const cur = profile.pairs.find(
                                    (p) => pairKey(p.name) === pairKey(activePair),
                                )
                                if (!cur || !cur.partnerSlug) return null
                                return (
                                    <HStack gap="2" fontSize="sm" color="fg.muted">
                                        <FiShare2 size={14} />
                                        <Text>
                                            {t("profile.tournaments.partnerLabel")}{" "}
                                            <RouterLink
                                                to={`/profil/${cur.partnerSlug}`}
                                                style={{
                                                    color: "var(--chakra-colors-blue-fg)",
                                                    fontWeight: 500,
                                                }}
                                            >
                                                {cur.partnerName || cur.partnerSlug}
                                            </RouterLink>
                                        </Text>
                                    </HStack>
                                )
                            })()}

                            {/* Tournament list — only after a pair is picked */}
                            {activePair && (
                                <>
                                    <Box borderTopWidth="1px" borderColor="border.emphasized" mx="-4" my="1" />
                                    <Input
                                        size="sm"
                                        placeholder={t("profile.tournaments.searchPlaceholder")}
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                    />
                                    {filteredCount === 0 ? (
                                        <Box
                                            borderWidth="1px"
                                            borderColor="border.emphasized"
                                            borderStyle="dashed"
                                            rounded="md"
                                            py="6"
                                            px="4"
                                            textAlign="center"
                                        >
                                            <Text color="fg.muted" fontSize="sm">
                                                {t("profile.tournaments.emptyFiltered")}
                                            </Text>
                                        </Box>
                                    ) : (
                                        <VStack align="stretch" gap="2.5">
                                            {rows}
                                        </VStack>
                                    )}
                                </>
                            )}
                        </VStack>
                    </Card.Body>
                </Card.Root>
    )
}

function PairChip({
    pair,
    active,
    onClick,
}: {
    pair: PairSummary
    active: boolean
    onClick: () => void
}) {
    const { t } = useTranslation()
    return (
        <Button
            size="sm"
            variant={active ? "solid" : "outline"}
            colorPalette={active ? "blue" : "gray"}
            onClick={onClick}
            rounded="full"
            px="3.5"
        >
            <HStack gap="1.5">
                <Text fontWeight="medium">{pair.name}</Text>
                <Text fontSize="xs" opacity={0.85}>
                    · {pair.tournamentCount}
                </Text>
                {/* When active the chip is a SOLID blue button whose background is
                    the same in both themes, so the on-solid colours below are
                    deliberately fixed steps rather than semantic tokens. */}
                {pair.wins > 0 && (
                    <HStack gap="0.5" color={active ? "yellow.200" : "yellow.fg"}>
                        <FaTrophy size={10} />
                        <Text fontSize="xs">{pair.wins}</Text>
                    </HStack>
                )}
                {pair.partnerSlug && (
                    // Tiny "shared" indicator — the actual partner link
                    // renders below the chip strip so it stays accessible
                    // (no nested clickable inside the button).
                    <Box color={active ? "blue.100" : "blue.fg"} title={t("profile.pair.sharedTitle")}>
                        <FiShare2 size={11} />
                    </Box>
                )}
            </HStack>
        </Button>
    )
}
