import { Badge, Box, Dialog, HStack, IconButton, Text, VStack } from "@chakra-ui/react"
import { FiAward, FiCheckCircle, FiHeart, FiX } from "react-icons/fi"

import { PairAvatar } from "../../../components/PairsSection"
import { useTranslation } from "../../../i18n"
import type { RoundLocal } from "../../../utils/tournamentMatch"
import type { PairShort } from "../../../types/pairs"

type Played = {
    round: number
    tableNo: number
    opponentName: string | null
    myScore: number | null | undefined
    oppScore: number | null | undefined
    isFinished: boolean
    isBye: boolean
    isWinner: boolean
}

/**
 * One pair's match history: the stat summary plus a row per match it played.
 *
 * Mounted at the page root so it works regardless of which section is active
 * — it is opened from the Parovi list, but a deep link or the guided tour can
 * change section underneath it.
 */
export default function PairInfoDialog({
    pairId,
    pairs,
    rounds,
    pairById,
    onClose,
}: {
    /** null = closed. */
    pairId: number | null
    pairs: PairShort[]
    rounds: RoundLocal[]
    pairById: Map<number, PairShort>
    onClose: () => void
}) {
    const { t: tr } = useTranslation()

    const pair = pairId !== null ? pairs.find((p) => p.id === pairId) : undefined

    const played: Played[] = pair
        ? rounds.flatMap((r) =>
            r.matches
                .filter((m) => m.pair1Id === pair.id || m.pair2Id === pair.id)
                .map((m) => {
                    const meIs1 = m.pair1Id === pair.id
                    const oppId = meIs1 ? m.pair2Id : m.pair1Id
                    const oppName =
                        (meIs1 ? m.pair2Name : m.pair1Name) ??
                        (oppId ? pairById.get(oppId)?.name ?? null : null)
                    return {
                        round: r.number,
                        tableNo: m.tableNo,
                        opponentName: oppName,
                        myScore: meIs1 ? m.score1 : m.score2,
                        oppScore: meIs1 ? m.score2 : m.score1,
                        isFinished: m.status === "FINISHED",
                        isBye: !m.pair2Id,
                        isWinner: m.winnerPairId != null && m.winnerPairId === pair.id,
                    }
                })
        )
        : []

    const finishedPlayed = played.filter((x) => x.isFinished && !x.isBye)
    const wins = finishedPlayed.filter((x) => x.isWinner).length
    const losses = finishedPlayed.filter((x) => !x.isWinner).length

    return (
        <Dialog.Root
            open={pairId !== null}
            onOpenChange={(e) => { if (!e.open) onClose() }}
        >
            <Dialog.Backdrop />
            <Dialog.Positioner>
                <Dialog.Content maxW="md">
                    {!pair ? null : (
                        <>
                            <Dialog.Header
                                py="3"
                                px="4"
                                borderBottomWidth="1px"
                                borderColor="border.emphasized"
                            >
                                <HStack gap="3" align="center">
                                    <PairAvatar name={pair.name} eliminated={pair.isEliminated} />
                                    <Box flex="1" minW="0">
                                        <Text fontWeight="semibold" lineHeight="short">{pair.name || "—"}</Text>
                                        <Text fontSize="xs" color="fg.muted">{tr("tournament.pairs.matchHistory")}</Text>
                                    </Box>
                                    <IconButton
                                        aria-label={tr("common.close")}
                                        size="sm"
                                        variant="ghost"
                                        onClick={onClose}
                                    >
                                        <FiX />
                                    </IconButton>
                                </HStack>
                            </Dialog.Header>
                            <Dialog.Body py="4" px="4">
                                {/* Stat summary */}
                                <HStack gap="6" mb="4" wrap="wrap">
                                    <Box>
                                        <Text fontSize="xs" color="fg.muted">{tr("tournament.history.played")}</Text>
                                        <Text fontSize="xl" fontWeight="semibold">{finishedPlayed.length}</Text>
                                    </Box>
                                    <Box>
                                        <Text fontSize="xs" color="fg.muted">{tr("tournament.history.wins")}</Text>
                                        <Text fontSize="xl" fontWeight="semibold" color="green.fg">{wins}</Text>
                                    </Box>
                                    <Box>
                                        <Text fontSize="xs" color="fg.muted">{tr("tournament.history.losses")}</Text>
                                        <Text fontSize="xl" fontWeight="semibold" color="red.fg">{losses}</Text>
                                    </Box>
                                    {pair.extraLife && (
                                        <Box>
                                            <Text fontSize="xs" color="fg.muted">{tr("tournament.history.status")}</Text>
                                            <Badge variant="subtle" colorPalette="red">
                                                <HStack gap="1"><FiHeart size={11} /> {tr("tournament.pairs.life.label")}</HStack>
                                            </Badge>
                                        </Box>
                                    )}
                                </HStack>

                                {played.length === 0 ? (
                                    <Box
                                        borderWidth="1px"
                                        borderColor="border.emphasized"
                                        borderStyle="dashed"
                                        rounded="md"
                                        py="8"
                                        px="4"
                                        textAlign="center"
                                    >
                                        <Text color="fg.muted" fontSize="sm">
                                            {tr("tournament.history.empty")}
                                        </Text>
                                    </Box>
                                ) : (
                                    <VStack align="stretch" gap="2">
                                        {played.map((x, i) => (
                                            <Box
                                                key={i}
                                                borderWidth="1px"
                                                borderColor="border.emphasized"
                                                rounded="md"
                                                p="2.5"
                                                bg={
                                                    x.isBye
                                                        ? "blue.subtle"
                                                        : !x.isFinished
                                                            ? "yellow.subtle"
                                                            : x.isWinner
                                                                ? "green.subtle"
                                                                : "red.subtle"
                                                }
                                            >
                                                <HStack justify="space-between" gap="2" wrap="wrap">
                                                    <HStack gap="2" minW="0" flex="1">
                                                        <Badge variant="solid" colorPalette="gray" size="sm" flexShrink={0}>
                                                            {tr("tournament.history.roundShort", { n: x.round })}
                                                        </Badge>
                                                        <Text fontSize="xs" color="fg.muted" flexShrink={0}>
                                                            {tr("tournament.table", { n: x.tableNo })}
                                                        </Text>
                                                        <Text
                                                            fontWeight="medium"
                                                            overflow="hidden"
                                                            textOverflow="ellipsis"
                                                            whiteSpace="nowrap"
                                                            minW="0"
                                                        >
                                                            {x.isBye ? tr("tournament.bracket.bye") : tr("tournament.history.vs", { name: x.opponentName ?? "—" })}
                                                        </Text>
                                                    </HStack>
                                                    <HStack gap="2" flexShrink={0}>
                                                        {!x.isBye && x.isFinished && (
                                                            <Text fontWeight="semibold" fontSize="sm">
                                                                {x.myScore ?? "—"} : {x.oppScore ?? "—"}
                                                            </Text>
                                                        )}
                                                        {x.isBye ? (
                                                            <Badge variant="solid" colorPalette="blue" size="sm">
                                                                <HStack gap="1"><FiCheckCircle size={11} /> {tr("tournament.history.advanced")}</HStack>
                                                            </Badge>
                                                        ) : !x.isFinished ? (
                                                            <Badge variant="solid" colorPalette="yellow" size="sm">{tr("tournament.history.inProgress")}</Badge>
                                                        ) : x.isWinner ? (
                                                            <Badge variant="solid" colorPalette="green" size="sm">
                                                                <HStack gap="1"><FiAward size={11} /> {tr("tournament.history.win")}</HStack>
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="solid" colorPalette="red" size="sm">{tr("tournament.history.loss")}</Badge>
                                                        )}
                                                    </HStack>
                                                </HStack>
                                            </Box>
                                        ))}
                                    </VStack>
                                )}
                            </Dialog.Body>
                        </>
                    )}
                </Dialog.Content>
            </Dialog.Positioner>
        </Dialog.Root>
    )
}
