import { Box, Card, Heading, HStack, Skeleton, Text, VStack } from "@chakra-ui/react"
import { FiAlertCircle, FiTrendingUp } from "react-icons/fi"
import { useQuery } from "@tanstack/react-query"
import { fetchMyGameStats } from "../../api/userMe"
import { useAuth } from "../../auth/authContextValue"
import { useTranslation, usePlural } from "../../i18n"
import { qk } from "../../queryClient"

/**
 * Game statistics card — displays bela online game results for the profile owner.
 * Shows global stats (games, wins, losses, win rate) and per-category breakdown
 * for target scores actually present in the data.
 */
export function GameStatsCard() {
    const { user } = useAuth()
    const { t } = useTranslation()
    const plural = usePlural()

    const { data: stats, isLoading, error } = useQuery({
        queryKey: qk.gameStats,
        queryFn: fetchMyGameStats,
        enabled: !!user,
        staleTime: 5 * 60_000,
    })

    if (isLoading) {
        return (
            <Card.Root variant="outline" rounded="xl" borderColor="border.emphasized" shadow="sm">
                <Card.Body p={{ base: "4", md: "5" }}>
                    <VStack align="stretch" gap="3">
                        <Skeleton h="24px" w="200px" rounded="md" />
                        <Skeleton h="60px" rounded="md" />
                        <Skeleton h="40px" rounded="md" />
                    </VStack>
                </Card.Body>
            </Card.Root>
        )
    }

    if (error || !stats) {
        return (
            <Card.Root variant="outline" rounded="xl" borderColor="border.emphasized" shadow="sm">
                <Card.Body p={{ base: "4", md: "5" }}>
                    <VStack align="stretch" gap="3">
                        <Heading size="md">{t("profile.gameStats.title")}</Heading>
                        <HStack gap="3" align="center" color="fg.muted" fontSize="sm">
                            <FiAlertCircle size={16} />
                            <Text>{t("profile.gameStats.loadFailed")}</Text>
                        </HStack>
                    </VStack>
                </Card.Body>
            </Card.Root>
        )
    }

    // Empty state: no games played yet
    if (stats.global.games === 0) {
        return (
            <Card.Root variant="outline" rounded="xl" borderColor="border.emphasized" shadow="sm">
                <Card.Body p={{ base: "4", md: "5" }}>
                    <VStack align="stretch" gap="3">
                        <Heading size="md">{t("profile.gameStats.title")}</Heading>
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
                                {t("profile.gameStats.emptyNoGames")}
                            </Text>
                        </Box>
                    </VStack>
                </Card.Body>
            </Card.Root>
        )
    }

    return (
        <Card.Root variant="outline" rounded="xl" borderColor="border.emphasized" shadow="sm">
            <Card.Body p={{ base: "4", md: "5" }}>
                <VStack align="stretch" gap="4">
                    <Heading size="md">{t("profile.gameStats.title")}</Heading>

                    {/* Global stats row */}
                    <GlobalStatsRow stats={stats.global} plural={plural} t={t} />

                    {/* Per-category breakdown — only if categories exist */}
                    {stats.byTargetScore && Object.keys(stats.byTargetScore).length > 0 && (
                        <>
                            <Box borderTopWidth="1px" borderColor="border.emphasized" mx="-4" my="1" />
                            <VStack align="stretch" gap="2">
                                {(["501", "701", "1001"] as const).map((score) => {
                                    const category = stats.byTargetScore?.[score]
                                    if (!category) return null
                                    return (
                                        <CategoryRow
                                            key={score}
                                            targetScore={score}
                                            stats={category}
                                            plural={plural}
                                            t={t}
                                        />
                                    )
                                })}
                            </VStack>
                        </>
                    )}
                </VStack>
            </Card.Body>
        </Card.Root>
    )
}

/**
 * Global stats display row showing games, wins, losses, and win rate.
 */
function GlobalStatsRow({
    stats,
    plural,
    t,
}: {
    stats: { games: number; wins: number; losses: number; winRate: number }
    plural: (baseKey: string, n: number, params?: Record<string, string | number>) => string
    t: (key: string) => string
}) {
    const winRatePercent = (stats.winRate * 100).toFixed(1)

    return (
        <HStack gap="4" wrap="wrap">
            <StatTile
                label={plural("profile.gameStats.games", stats.games)}
                value={stats.games}
            />
            <StatTile
                label={plural("profile.gameStats.wins", stats.wins)}
                value={stats.wins}
                accent="teal"
            />
            <StatTile
                label={plural("profile.gameStats.losses", stats.losses)}
                value={stats.losses}
            />
            <StatTile
                label={t("profile.gameStats.winRate")}
                value={`${winRatePercent}%`}
            />
        </HStack>
    )
}

/**
 * Per-category row showing stats for a specific target score (501/701/1001).
 */
function CategoryRow({
    targetScore,
    stats,
    plural,
    t,
}: {
    targetScore: "501" | "701" | "1001"
    stats: { games: number; wins: number; losses: number; winRate: number }
    plural: (baseKey: string, n: number, params?: Record<string, string | number>) => string
    t: (key: string) => string
}) {
    const winRatePercent = (stats.winRate * 100).toFixed(1)
    const label = t(`profile.gameStats.targetScore.${targetScore}`)

    return (
        <HStack
            gap="2"
            p="2"
            rounded="md"
            bg="bg.subtle"
            fontSize="sm"
            flexWrap="wrap"
            align="center"
        >
            <HStack gap="1" minW="0">
                <FiTrendingUp size={14} opacity={0.6} />
                <Text fontWeight="medium" color="fg.soft">
                    {label}:
                </Text>
            </HStack>
            <HStack gap="1" ml="auto">
                <Text>
                    {plural("profile.gameStats.categoryStats", stats.games, {
                        wins: stats.wins,
                        winRate: winRatePercent,
                    })}
                </Text>
            </HStack>
        </HStack>
    )
}

/**
 * Individual stat tile component.
 */
function StatTile({
    label,
    value,
    accent,
}: {
    label: string
    value: string | number
    accent?: string
}) {
    return (
        <VStack gap="0.5" align="start" flex="1" minW="80px">
            <Text fontSize="xs" color="fg.muted" textTransform="uppercase" fontWeight="semibold">
                {label}
            </Text>
            <Text fontSize="lg" fontWeight="bold" color={accent ? `${accent}.fg` : "fg.emphasis"}>
                {value}
            </Text>
        </VStack>
    )
}
