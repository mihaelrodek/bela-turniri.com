import { Box, Grid, HStack, Spinner, Text, VStack } from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { FiActivity, FiBarChart2 } from "react-icons/fi"
import { adminGetGameAnalytics } from "../api/admin"
import { useTranslation } from "../i18n"
import { qk } from "../queryClient"
import SectionCard from "./SectionCard"

const pct = (value: number) => (value * 100).toFixed(1)
const oneDecimal = (value: number) => value.toFixed(1)

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
    return (
        <Box bg="bg.subtle" rounded="lg" px="3" py="2.5" minW="0">
            <Text fontSize="xs" color="fg.muted" fontWeight="semibold">{label}</Text>
            <Text fontSize={{ base: "xl", md: "2xl" }} fontWeight="bold" lineHeight="short">{value}</Text>
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

export default function AdminGameAnalyticsTab() {
    const { t } = useTranslation()
    const query = useQuery({ queryKey: qk.adminGameAnalytics, queryFn: adminGetGameAnalytics })

    if (query.isLoading) return <HStack justify="center" py="12"><Spinner /><Text>{t("admin.analytics.loading")}</Text></HStack>
    if (!query.data) return <Text color="red.400">{t("admin.analytics.error")}</Text>
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
                    <Box><Text fontWeight="bold" mb="2">{t("admin.analytics.targets")}</Text><Rows>
                        {data.byTarget.map((row) => <Row key={row.label} title={row.label} detail={t("admin.analytics.targetRow", row)} />)}
                    </Rows></Box>
                    <Box><Text fontWeight="bold" mb="2">{t("admin.analytics.trumps")}</Text><Rows>
                        {data.trumps.map((row) => <Row key={row.suit} title={({ HERC: "♥ Herc", KARA: "♦ Kara", PIK: "♠ Pik", TREF: "♣ Tref" } as Record<string, string>)[row.suit] ?? row.suit} detail={t("admin.analytics.trumpRow", { calls: row.calls, share: pct(row.share), success: pct(row.successRate), falls: row.falls })} />)}
                    </Rows></Box>
                    <Box><Text fontWeight="bold" mb="2">{t("admin.analytics.positions")}</Text><Rows>
                        {data.callPositions.map((row) => <Row key={row.position} title={t("admin.analytics.position", { position: row.position })} detail={t("admin.analytics.positionRow", { calls: row.calls, success: pct(row.successRate), falls: row.falls })} />)}
                    </Rows></Box>
                    <Box><Text fontWeight="bold" mb="2">{t("admin.analytics.details")}</Text>
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

                <Grid templateColumns={{ base: "1fr", md: "repeat(2, minmax(0, 1fr))" }} gap="3">
                    <Box borderWidth="1px" borderColor="border.muted" rounded="lg" p="3">
                        <HStack mb="2"><FiActivity /><Text fontWeight="bold">{t("admin.analytics.tableMix")}</Text></HStack>
                        <Text fontSize="sm">{t("admin.analytics.humans")}: {data.details.humanOnlyGames}</Text>
                        <Text fontSize="sm">{t("admin.analytics.mixed")}: {data.details.mixedGames}</Text>
                        <Text fontSize="sm">{t("admin.analytics.bots")}: {data.details.botOnlyGames}</Text>
                    </Box>
                    <Box borderWidth="1px" borderColor="border.muted" rounded="lg" p="3">
                        <Text fontWeight="bold" mb="2">{t("admin.analytics.visibility")}</Text>
                        <Text fontSize="sm">{t("admin.analytics.public")}: {data.details.publicGames}</Text>
                        <Text fontSize="sm">{t("admin.analytics.private")}: {data.details.privateGames}</Text>
                    </Box>
                </Grid>
            </VStack>
        </SectionCard>
    )
}
