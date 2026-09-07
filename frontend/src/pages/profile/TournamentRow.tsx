import React, { useEffect, useRef, useState } from "react"
import type { BadgeProps } from "@chakra-ui/react"
import { Badge, Box, Button, HStack, Spinner, Text, VStack } from "@chakra-ui/react"
import { Link as RouterLink } from "react-router-dom"
import { FaTrophy } from "react-icons/fa"
import { FiCalendar, FiChevronDown, FiChevronRight, FiMapPin } from "react-icons/fi"
import { getPairMatchHistory, type PairMatchHistory } from "../../api/publicProfile"
import type { MyTournamentParticipation } from "../../api/userMe"
import { MEDALS } from "../../components/TournamentResultsCard"
import { errorMessage } from "../../utils/apiError"
import { formatDate } from "../../utils/format"
import { useTranslation } from "../../i18n"
import { MatchRow } from "./MatchRow"

/**
 * A tournament row that toggles open to fetch + show match-by-match history.
 *
 * Memoised: the parent owns the profile search box, so without this every
 * keystroke re-rendered every row (and each row can hold an expanded match
 * list). The `row` objects keep their identity across a filter, so the
 * default shallow compare is enough.
 */
export const TournamentRow = React.memo(function TournamentRow({
    slug,
    row,
}: {
    slug: string
    row: MyTournamentParticipation
}) {
    const { t } = useTranslation()
    const [open, setOpen] = useState(false)
    const [history, setHistory] = useState<PairMatchHistory | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    // Flipped on unmount so a slow history response can't write into a row
    // the user has already scrolled/filtered away.
    const aliveRef = useRef(true)
    useEffect(() => () => { aliveRef.current = false }, [])

    async function toggle() {
        const next = !open
        setOpen(next)
        if (next && !history && !loading) {
            try {
                setLoading(true)
                setError(null)
                const h = await getPairMatchHistory(slug, row.pairId)
                if (aliveRef.current) setHistory(h)
            } catch (e) {
                if (aliveRef.current) setError(errorMessage(e, t("profile.matches.loadFailed")))
            } finally {
                if (aliveRef.current) setLoading(false)
            }
        }
    }

    let badge: { palette: BadgeProps["colorPalette"]; label: string; icon?: React.ReactNode } | null = null
    if (row.isWinner) {
        badge = { palette: "yellow", label: t("profile.status.winner"), icon: <FaTrophy size={11} color={MEDALS[0]} /> }
    } else if (row.pendingApproval) {
        badge = { palette: "yellow", label: t("profile.status.pendingApproval") }
    } else if (row.eliminated) {
        badge = { palette: "red", label: t("profile.status.eliminated") }
    } else if (row.tournamentStatus === "STARTED") {
        badge = { palette: "green", label: t("profile.status.active") }
    } else if (row.tournamentStatus === "FINISHED") {
        badge = { palette: "gray", label: t("profile.status.finished") }
    } else {
        badge = { palette: "blue", label: t("profile.status.announced") }
    }

    return (
        <Box
            borderWidth="1px"
            borderColor="border.emphasized"
            rounded="md"
            shadow="sm"
            overflow="hidden"
        >
            <Box
                as="button"
                onClick={toggle}
                w="100%"
                p="3"
                textAlign="left"
                _hover={{ bg: "bg.subtle" }}
                transition="background 0.1s"
            >
                <HStack justify="space-between" gap="3" wrap="wrap" mb="1.5">
                    <HStack gap="2" flex="1" minW="0">
                        {open ? <FiChevronDown /> : <FiChevronRight />}
                        <Text fontWeight="semibold" lineHeight="short">
                            {row.tournamentName}
                        </Text>
                    </HStack>
                    {badge && (
                        <Badge variant="solid" colorPalette={badge.palette} size="sm">
                            <HStack gap="1">
                                {badge.icon}
                                {badge.label}
                            </HStack>
                        </Badge>
                    )}
                </HStack>
                <HStack gap="3" wrap="wrap" fontSize="xs" color="fg.muted" pl="6">
                    {row.tournamentStartAt && (
                        <HStack gap="1"><FiCalendar /><Text>{formatDate(row.tournamentStartAt)}</Text></HStack>
                    )}
                    {row.tournamentLocation && (
                        <HStack gap="1"><FiMapPin /><Text>{row.tournamentLocation}</Text></HStack>
                    )}
                    {!row.pendingApproval && (
                        <Badge variant="subtle" colorPalette="gray" size="sm">{t("profile.record", { wins: row.wins, losses: row.losses })}</Badge>
                    )}
                    {row.extraLife && <Badge variant="subtle" colorPalette="red" size="sm">{t("profile.extraLife")}</Badge>}
                </HStack>
            </Box>

            {open && (
                <Box borderTopWidth="1px" borderColor="border.emphasized" bg="bg.subtle" p="3">
                    {loading ? (
                        <HStack gap="2" color="fg.muted"><Spinner size="xs" /><Text fontSize="sm">{t("common.loading")}</Text></HStack>
                    ) : error ? (
                        <Text fontSize="sm" color="red.fg">{error}</Text>
                    ) : !history || history.matches.length === 0 ? (
                        <Text fontSize="sm" color="fg.muted">{t("profile.matches.empty")}</Text>
                    ) : (
                        <VStack align="stretch" gap="1.5">
                            {history.matches.map((m, i) => (
                                <MatchRow key={`${m.roundNumber ?? "?"}-${i}`} m={m} />
                            ))}
                            <HStack pt="2" justify="flex-end">
                                <Button size="xs" variant="ghost" asChild>
                                    <RouterLink to={`/turniri/${row.tournamentSlug ?? row.tournamentUuid}`}>
                                        {t("profile.openTournament")}
                                    </RouterLink>
                                </Button>
                            </HStack>
                        </VStack>
                    )}
                </Box>
            )}
        </Box>
    )
})
