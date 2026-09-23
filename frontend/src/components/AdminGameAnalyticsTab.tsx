import { Box, Grid, HStack, Spinner, Text, VStack } from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { FiActivity, FiBarChart2, FiUsers } from "react-icons/fi"
import { adminGetGameAnalytics, adminGetGamePlayers, type AdminGamePlayerDto } from "../api/admin"
import { useTranslation, usePlural } from "../i18n"
import { qk } from "../queryClient"
import { formatDateTime } from "../utils/format"
import SectionCard from "./SectionCard"

const pct = (value: number) => (value * 100).toFixed(1)
const oneDecimal = (value: number) => value.toFixed(1)

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
    return (
        <Box bg="bg.subtle" rounded="lg" px="3" py="2.5" minW="0">
            <Text fontSize="xs" color="fg.muted" fontWeight="semibold">{label}</Text>
            <Text fontSize={{ base: "xl", md: "2xl" }} fontWeight="bold" lineHeight="short" fontFamily="mono" fontVariantNumeric="tabular-nums">{value}</Text>
            {hint && <Text fontSize="xs" color="fg.muted">{hint}</Text>}
        </Box>
    )
}

function Rows({ children }: { children: React.ReactNode }) {
    return <VStack align="stretch" gap="1.5">{children}</VStack>
}

function Row({ title, detail }: { title: string; detail: string }) {
    return (
        <HStack justify="space-between" gap="3" bg="bg.subtle" rounded="md" px="3" py="2">
            <Text fontWeight="semibold" flexShrink={0}>{title}</Text>
            <Text fontSize="sm" color="fg.muted" textAlign="right">{detail}</Text>
        </HStack>
    )
}

/**
 * One account in the "who played" list.
 *
 * Two stacked lines rather than table columns: at phone width a five-column
 * table either scrolls the page sideways or squeezes the name to nothing, and
 * the name is the one thing this section exists to show. The games count stays
 * on the first line, right-aligned, so the list can be scanned by the number
 * it is sorted by.
 */
function KindChip({ kind }: { kind: AdminGamePlayerDto["kind"] }) {
    const { t } = useTranslation()
    const guest = kind === "GUEST"
    return (
        <Text
            as="span"
            flexShrink={0}
            fontSize="2xs"
            fontWeight="bold"
            textTransform="uppercase"
            letterSpacing="0.04em"
            rounded="sm"
            px="1.5"
            py="0.5"
            bg={guest ? "bg.muted" : "brand.subtle"}
            color={guest ? "fg.muted" : "brand.fg"}
        >
            {t(guest ? "admin.analytics.kindGuest" : "admin.analytics.kindAccount")}
        </Text>
    )
}

function PlayerRow({ player }: { player: AdminGamePlayerDto }) {
    const { t } = useTranslation()
    const guest = player.kind === "GUEST"
    return (
        <VStack align="stretch" gap="0.5" bg="bg.subtle" rounded="md" px="3" py="2" minW="0">
            <HStack justify="space-between" gap="3" minW="0">
                <HStack gap="1.5" minW="0">
                    <Text fontWeight="semibold" truncate>{player.name}</Text>
                    <KindChip kind={player.kind} />
                </HStack>
                <Text flexShrink={0} fontWeight="bold" fontFamily="mono" fontVariantNumeric="tabular-nums">
                    {t("admin.analytics.playerGames", { games: player.games })}
                </Text>
            </HStack>
            <Text fontSize="xs" color="fg.muted" fontVariantNumeric="tabular-nums">
                {t("admin.analytics.playerRecord", { wins: player.wins, losses: player.losses })}
                {" · "}
                {t("admin.analytics.playerRanked", {
                    games: player.rankedGames,
                    wins: player.rankedWins,
                    losses: player.rankedLosses,
                })}
                {" · "}
                {t("admin.analytics.playerLast", { date: formatDateTime(player.lastPlayedAt, "—") })}
                {/* A guest has no account, so there is no karma or abandon
                    history to show — printing "10/10" there would invent a
                    reliability record nobody earned. */}
                {!guest && (
                    <>
                        {" · "}
                        {t("admin.analytics.playerAbandons", { abandons: player.abandons })}
                        {" · "}
                        {t("admin.analytics.playerKarma", { karma: player.karma, max: player.maxKarma })}
                    </>
                )}
            </Text>
        </VStack>
    )
}

/**
 * Own query, own loading state: the list comes from a different endpoint
 * (`/admin/game-analytics/players`, read off the finished-games table) than
 * the aggregate above, so a slow or empty one must not hold back the other.
 */
function PlayersSection() {
    const { t } = useTranslation()
    const plural = usePlural()
    const query = useQuery({ queryKey: qk.adminGamePlayers, queryFn: () => adminGetGamePlayers() })

    const data = query.data
    return (
        <Box borderWidth="1px" borderColor="border.muted" rounded="lg" p="3">
            <HStack mb="2" gap="2">
                <FiUsers />
                <Text fontWeight="bold" fontFamily="heading" letterSpacing="-0.015em">
                    {t("admin.analytics.players")}
                </Text>
                {data && (
                    <Text fontSize="sm" color="fg.muted" fontVariantNumeric="tabular-nums">
                        {plural("admin.analytics.playersCount", data.totalPlayers)}
                    </Text>
                )}
            </HStack>

            {query.isLoading && (
                <HStack py="4" gap="2"><Spinner size="sm" /><Text fontSize="sm">{t("admin.analytics.playersLoading")}</Text></HStack>
            )}
            {!query.isLoading && !data && <Text color="danger" fontSize="sm">{t("admin.analytics.error")}</Text>}

            {data && (
                <VStack align="stretch" gap="2">
                    {data.players.length === 0 && (
                        <Text fontSize="sm" color="fg.muted">{t("admin.analytics.playersEmpty")}</Text>
                    )}
                    {data.players.length > 0 && (
                        // Capped list, so the box scrolls internally instead of
                        // making the whole tab a mile long; overflowX stays
                        // hidden because nothing here is wider than the column.
                        <Box maxH="420px" overflowY="auto" overflowX="hidden">
                            <Rows>
                                {/* Guests have no uid, so their row is keyed by
                                    the name it is grouped by — which is unique
                                    within the list for exactly the same reason. */}
                                {data.players.map((player) => (
                                    <PlayerRow key={player.uid ?? `guest:${player.name}`} player={player} />
                                ))}
                            </Rows>
                        </Box>
                    )}
                    {data.totalPlayers > data.shown && (
                        <Text fontSize="xs" color="fg.muted">
                            {t("admin.analytics.playersCapped", { shown: data.shown })}
                        </Text>
                    )}
                    <Box borderTopWidth="1px" borderColor="border.subtle" pt="2">
                        <Text fontWeight="semibold" fontSize="sm">{t("admin.analytics.anonymous")}</Text>
                        <Text fontSize="sm" color="fg.muted" fontVariantNumeric="tabular-nums">
                            {t("admin.analytics.guestSeats", { seats: data.guestSeats, wins: data.guestWins })}
                        </Text>
                        <Text fontSize="sm" color="fg.muted" fontVariantNumeric="tabular-nums">
                            {t("admin.analytics.botSeats", { seats: data.botSeats })}
                        </Text>
                        <Text fontSize="sm" color="fg.muted" fontVariantNumeric="tabular-nums">
                            {t("admin.analytics.demoSeats", { seats: data.demoSeats })}
                        </Text>
                        <Text fontSize="sm" color="fg.muted" fontVariantNumeric="tabular-nums">
                            {t("admin.analytics.demoGames", { games: data.demoGames })}
                        </Text>
                        <Text fontSize="sm" color="fg.muted" fontVariantNumeric="tabular-nums">
                            {t("admin.analytics.botOnlyGames", { games: data.botOnlyGames })}
                        </Text>
                        <Text fontSize="xs" color="fg.muted">{t("admin.analytics.guestsNote")}</Text>
                        <Text fontSize="xs" color="fg.muted">{t("admin.analytics.rankedNote")}</Text>
                    </Box>
                </VStack>
            )}
        </Box>
    )
}

export default function AdminGameAnalyticsTab() {
    const { t } = useTranslation()
    const query = useQuery({ queryKey: qk.adminGameAnalytics, queryFn: adminGetGameAnalytics })

    if (query.isLoading) return <HStack justify="center" py="12"><Spinner /><Text>{t("admin.analytics.loading")}</Text></HStack>
    if (!query.data) return <Text color="danger">{t("admin.analytics.error")}</Text>
    const data = query.data

    return (
        <SectionCard icon={<FiBarChart2 />} title={t("admin.analytics.title")} description={t("admin.analytics.description")}>
            <VStack align="stretch" gap="5">
                <Grid templateColumns={{ base: "repeat(2, minmax(0, 1fr))", lg: "repeat(5, minmax(0, 1fr))" }} gap="2">
                    <Stat label={t("admin.analytics.roomsCreated")} value={data.summary.roomsCreated} />
                    <Stat label={t("admin.analytics.gamesStarted")} value={data.summary.gamesStarted} />
                    <Stat label={t("admin.analytics.completed")} value={data.summary.completed} hint={t("admin.analytics.completionRate", { value: pct(data.summary.completionRate) })} />
                    <Stat label={t("admin.analytics.abandoned")} value={data.summary.abandoned} />
                    <Stat label={t("admin.analytics.inProgress")} value={data.summary.inProgress} />
                </Grid>

                <Grid templateColumns={{ base: "1fr", lg: "repeat(2, minmax(0, 1fr))" }} gap="4">
                    <Box><Text fontWeight="bold" mb="2" fontFamily="heading" letterSpacing="-0.015em">{t("admin.analytics.targets")}</Text><Rows>
                        {data.byTarget.map((row) => <Row key={row.label} title={row.label} detail={t("admin.analytics.targetRow", row)} />)}
                    </Rows></Box>
                    <Box><Text fontWeight="bold" mb="2" fontFamily="heading" letterSpacing="-0.015em">{t("admin.analytics.trumps")}</Text><Rows>
                        {data.trumps.map((row) => <Row key={row.suit} title={({ HERC: "♥ Herc", KARA: "♦ Kara", PIK: "♠ Pik", TREF: "♣ Tref" } as Record<string, string>)[row.suit] ?? row.suit} detail={t("admin.analytics.trumpRow", { calls: row.calls, share: pct(row.share), success: pct(row.successRate), falls: row.falls })} />)}
                    </Rows></Box>
                    <Box><Text fontWeight="bold" mb="2" fontFamily="heading" letterSpacing="-0.015em">{t("admin.analytics.positions")}</Text><Rows>
                        {data.callPositions.map((row) => <Row key={row.position} title={t("admin.analytics.position", { position: row.position })} detail={t("admin.analytics.positionRow", { calls: row.calls, success: pct(row.successRate), falls: row.falls })} />)}
                    </Rows></Box>
                    <Box><Text fontWeight="bold" mb="2" fontFamily="heading" letterSpacing="-0.015em">{t("admin.analytics.details")}</Text>
                        <Grid templateColumns="repeat(2, minmax(0, 1fr))" gap="2">
                            <Stat label={t("admin.analytics.deals")} value={data.details.deals} />
                            <Stat label={t("admin.analytics.avgDeals")} value={oneDecimal(data.details.averageDealsPerCompletedGame)} />
                            <Stat label={t("admin.analytics.avgDuration")} value={t("admin.analytics.minutes", { value: oneDecimal(data.details.averageDurationMinutes) })} />
                            <Stat label={t("admin.analytics.declarationPoints")} value={data.details.declarationPoints} />
                            <Stat label={t("admin.analytics.stiglja")} value={data.details.stiglja} />
                            <Stat label={t("admin.analytics.belot")} value={data.details.belot} />
                            <Stat label={t("admin.analytics.autoPlayed")} value={data.details.autoPlayedActions} />
                        </Grid>
                    </Box>
                </Grid>

                <PlayersSection />

                <Grid templateColumns={{ base: "1fr", md: "repeat(2, minmax(0, 1fr))" }} gap="3">
                    <Box borderWidth="1px" borderColor="border.muted" rounded="lg" p="3">
                        <HStack mb="2"><FiActivity /><Text fontWeight="bold" fontFamily="heading" letterSpacing="-0.015em">{t("admin.analytics.tableMix")}</Text></HStack>
                        <Text fontSize="sm">{t("admin.analytics.humans")}: {data.details.humanOnlyGames}</Text>
                        <Text fontSize="sm">{t("admin.analytics.mixed")}: {data.details.mixedGames}</Text>
                        <Text fontSize="sm">{t("admin.analytics.bots")}: {data.details.botOnlyGames}</Text>
                    </Box>
                    <Box borderWidth="1px" borderColor="border.muted" rounded="lg" p="3">
                        <Text fontWeight="bold" mb="2" fontFamily="heading" letterSpacing="-0.015em">{t("admin.analytics.visibility")}</Text>
                        <Text fontSize="sm">{t("admin.analytics.public")}: {data.details.publicGames}</Text>
                        <Text fontSize="sm">{t("admin.analytics.private")}: {data.details.privateGames}</Text>
                    </Box>
                </Grid>
            </VStack>
        </SectionCard>
    )
}
