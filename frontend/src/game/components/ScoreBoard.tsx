import { useState } from "react"
import { Box, Flex, HStack, IconButton, Text, VStack } from "@chakra-ui/react"
import { FiChevronDown, FiChevronUp } from "react-icons/fi"
import type { PlayerView, RoomState, Seat } from "@bela/protocol"
import type { Team } from "@bela/engine"
import { usePlural, useTranslation } from "../../i18n"
import { teamOf } from "../util/seats"
import SuitGlyph from "./SuitGlyph"
import TrumpBadge from "./TrumpBadge"
import { GLASS, INK, INK_MUTED, SHORT } from "./tableStyles"

/* ──────────────────────────────────────────────────────────────────────────
   ScoreBoard — the panel across the top of the felt.

   MI | trump | ONI, in that order and always in that order. A player does
   not think in team letters; "we are 40 behind" is the only framing that
   matters at the table, and the letters survive only in the protocol. A
   spectator has no team, so they get the seats' own perspective (Tim A /
   Tim B) instead.

   Under each total sits what THIS deal has taken so far — tricks, because
   the redacted `PlayerView` deliberately carries no running card points
   (they would leak how a hidden hand is doing). It is one row on a
   landscape phone and one row on a desktop: the history is the only thing
   that expands, and only between deals.
   ────────────────────────────────────────────────────────────────────── */

function seatName(seats: RoomState["seats"], seat: Seat, fallback: string): string {
    const occupant = seats[seat]?.occupant
    if (!occupant) return fallback
    return occupant.kind === "BOT" ? occupant.name : occupant.user.name
}

export default function ScoreBoard({
    view,
    seats,
    targetScore,
}: {
    view: PlayerView
    seats: RoomState["seats"]
    targetScore: number
}) {
    const { t } = useTranslation()
    const plural = usePlural()
    const [open, setOpen] = useState(false)

    const spectator = view.seat === null
    const myTeam: Team = spectator ? "A" : teamOf(view.seat as Seat)
    const theirTeam: Team = myTeam === "A" ? "B" : "A"
    const trump = view.bidding.trump
    const caller = view.bidding.caller
    const hasHistory = view.history.length > 0

    const usLabel = spectator ? t("game.score.teamA") : t("game.score.us")
    const themLabel = spectator ? t("game.score.teamB") : t("game.score.them")

    return (
        <Box
            {...GLASS}
            rounded="l3"
            px="3"
            py="2"
            css={{ ...GLASS.css, [SHORT]: { paddingTop: "4px", paddingBottom: "4px" } }}
        >
            <Flex align="center" justify="space-between" gap="2">
                <TeamColumn
                    label={usLabel}
                    score={view.score[myTeam]}
                    tricks={plural("game.table.trickCount", view.tricksWon[myTeam])}
                    align="start"
                />

                <VStack gap="0.5" align="center" flexShrink={0}>
                    <TrumpBadge
                        trump={trump}
                        callerName={caller === null ? null : seatName(seats, caller, t("game.seat.empty"))}
                        fallback={t("game.table.phaseBidding")}
                    />
                    <HStack gap="1.5" color={INK_MUTED} fontSize="2xs">
                        <Text>{t("game.score.dealNo", { n: view.dealNo })}</Text>
                        <Text aria-hidden="true">·</Text>
                        <Text>{t("game.score.target", { target: targetScore })}</Text>
                        {hasHistory && (
                            <IconButton
                                size="2xs"
                                variant="plain"
                                color={INK_MUTED}
                                minW="16px"
                                h="16px"
                                aria-label={t("game.score.historyTitle")}
                                aria-expanded={open}
                                onClick={() => setOpen((v) => !v)}
                            >
                                {open ? <FiChevronUp /> : <FiChevronDown />}
                            </IconButton>
                        )}
                    </HStack>
                </VStack>

                <TeamColumn
                    label={themLabel}
                    score={view.score[theirTeam]}
                    tricks={plural("game.table.trickCount", view.tricksWon[theirTeam])}
                    align="end"
                />
            </Flex>

            {open && hasHistory && (
                <Box mt="2" pt="2" borderTopWidth="1px" borderColor="brand.700/70" maxH="132px" overflowY="auto">
                    {view.history.map((deal) => (
                        <HStack
                            key={deal.dealNo}
                            gap="2"
                            justify="space-between"
                            py="0.5"
                            fontSize="2xs"
                            color={INK}
                        >
                            <HStack gap="1.5" minW="0">
                                <Text color={INK_MUTED} minW="14px">{deal.dealNo}.</Text>
                                <SuitGlyph suit={deal.trump} size={11} />
                                <Text color={INK_MUTED} lineClamp={1}>
                                    {seatName(seats, deal.caller, t("game.seat.empty"))}
                                </Text>
                                <Text color={deal.passed ? "brand.200" : "red.300"} fontWeight="bold">
                                    {deal.passed ? t("game.deal.passed") : t("game.deal.fell")}
                                </Text>
                            </HStack>
                            <HStack gap="2" fontVariantNumeric="tabular-nums" flexShrink={0}>
                                <Text minW="30px" textAlign="end" fontWeight="bold">
                                    {deal.total[myTeam]}
                                </Text>
                                <Text minW="30px" textAlign="end" color={INK_MUTED}>
                                    {deal.total[theirTeam]}
                                </Text>
                            </HStack>
                        </HStack>
                    ))}
                </Box>
            )}
        </Box>
    )
}

function TeamColumn({
    label,
    score,
    tricks,
    align,
}: {
    label: string
    score: number
    tricks: string
    align: "start" | "end"
}) {
    return (
        <VStack gap="0" align={align} minW="0" flex="1">
            <Text
                fontSize="2xs"
                color={INK_MUTED}
                textTransform="uppercase"
                letterSpacing="widest"
                fontWeight="bold"
            >
                {label}
            </Text>
            <Text
                textStyle="mono"
                fontSize={{ base: "2xl", md: "3xl" }}
                lineHeight="1.05"
                fontWeight="bold"
                color={INK}
                fontVariantNumeric="tabular-nums"
                css={{ [SHORT]: { fontSize: "22px" } }}
            >
                {score}
            </Text>
            <Text fontSize="2xs" color={INK_MUTED} lineClamp={1}>
                {tricks}
            </Text>
        </VStack>
    )
}
