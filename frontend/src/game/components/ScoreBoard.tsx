import { useState, type ReactNode } from "react"
import { Box, Flex, HStack, IconButton, Text, VStack } from "@chakra-ui/react"
import { FiChevronDown, FiChevronUp } from "react-icons/fi"
import type { PlayerView, RoomState, Seat } from "@bela/protocol"
import type { Team } from "@bela/engine"
import { useTranslation } from "../../i18n"
import { teamOf } from "../util/seats"
import SuitGlyph from "./SuitGlyph"
import TrumpBadge from "./TrumpBadge"
import { GLASS, INK, INK_MUTED, SHORT } from "./tableStyles"

/* ──────────────────────────────────────────────────────────────────────────
   ScoreBoard — the panel across the top of the felt.

   MI | adut+zvač | ONI, in that order and always in that order. A player does
   not think in team letters; "we are 40 behind" is the only framing that
   matters at the table, and the letters survive only in the protocol. A
   spectator has no team, so they get the seats' own perspective (Tim A /
   Tim B) instead.

   THE BIG NUMBER IS THE CURRENT DEAL ("bodovi mješanja"), the running match
   total sits small underneath. That is the way round the reference table
   reads it, and it is the right way round: during a deal the only number
   anyone is actually doing arithmetic with is "how much have we taken so
   far, and is it going to be enough" — the match total moves once every few
   minutes and can be glanced at. We had it inverted, with the trick count in
   the small line, so the number in the biggest type on the table was the one
   that never changed while you played.

   The deal figure is `PlayerView.currentDealPoints`: the card points of
   COMPLETED tricks (README §2). It is not a secret — those cards fell face up
   in front of everybody — but it is deliberately not a prediction either: no
   last-trick 10, no štiglja, no fall. Those are settled at the end of the deal
   and appear in the summary and in the total.

   Declarations are the ONE thing that stands beside it: `+150` in small type
   next to the big number, from `PlayerView.declarationPoints` (README §2).
   Only one team ever has it (the other's declarations are lost, §1.4), except
   for a bela, which is in the figure and can therefore put a `+20` on the
   losing side too. It is shown only when non-zero, and it is deliberately NOT
   added into the big number: the big number is card points taken, and a player
   reading "how much do we still need" wants those two quantities separately.

   The deal number, the target and the history toggle share one thin footer
   row, out of the way of the trump cell.
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
    noDeclarations = false,
    allowBela = true,
}: {
    view: PlayerView
    seats: RoomState["seats"]
    targetScore: number
    /** The room's house rules. They change how the deal SCORES, so they are
     *  stated on the table itself and not only on the room screen — and in a
     *  colour you cannot mistake for decoration. */
    noDeclarations?: boolean
    allowBela?: boolean
}) {
    const { t } = useTranslation()
    const [open, setOpen] = useState(false)

    const spectator = view.seat === null
    const myTeam: Team = spectator ? "A" : teamOf(view.seat as Seat)
    const theirTeam: Team = myTeam === "A" ? "B" : "A"
    const trump = view.bidding.trump
    const caller = view.bidding.caller
    const hasHistory = view.history.length > 0

    const usLabel = spectator ? t("game.score.teamA") : t("game.score.us")
    const themLabel = spectator ? t("game.score.teamB") : t("game.score.them")
    // Optional on PlayerView — the bots hand-assemble views without it — so
    // "no bonus known" reads as no bonus.
    const declarationPoints = view.declarationPoints ?? { A: 0, B: 0 }

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
                    dealPoints={view.currentDealPoints[myTeam]}
                    declarationPoints={declarationPoints[myTeam]}
                    declarationLabel={t("game.score.declarationBonus")}
                    total={view.score[myTeam]}
                    totalLabel={t("game.score.matchTotal", { total: view.score[myTeam] })}
                    align="start"
                />

                <VStack gap="0.5" align="center" flexShrink={0}>
                    {(noDeclarations || !allowBela) && (
                        <HStack gap="1" role="group" aria-label={t("game.rules.title")}>
                            {noDeclarations && <RuleChip>{t("game.rules.noDeclarations")}</RuleChip>}
                            {!allowBela && <RuleChip>{t("game.rules.noBela")}</RuleChip>}
                        </HStack>
                    )}
                    <TrumpBadge
                        trump={trump}
                        callerName={caller === null ? null : seatName(seats, caller, t("game.seat.empty"))}
                        fallback={t("game.table.phaseBidding")}
                    />
                </VStack>

                <TeamColumn
                    label={themLabel}
                    dealPoints={view.currentDealPoints[theirTeam]}
                    declarationPoints={declarationPoints[theirTeam]}
                    declarationLabel={t("game.score.declarationBonus")}
                    total={view.score[theirTeam]}
                    totalLabel={t("game.score.matchTotal", { total: view.score[theirTeam] })}
                    align="end"
                />
            </Flex>

            {/* Footer: what we are playing to, and the way into the history.
                The deal number and the trick count used to sit here too and
                were dropped (2026-09-08): neither is something a player acts
                on. The deal number is bookkeeping, and the trick count is
                already legible from the table — what matters about the tricks
                is the POINTS in them, which is the big number above. */}
            <HStack gap="1.5" mt="0.5" justify="center" color={INK_MUTED} fontSize="2xs" lineHeight="1.3">
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

/** A house rule in force this deal ("Bez zvanja", "Bez bele"). Solid amber on
 *  a green table: it has to be the one thing on the scoreboard that is not
 *  brand-coloured, or it reads as another muted caption and nobody sees it. */
function RuleChip({ children }: { children: ReactNode }) {
    return (
        <Flex
            align="center"
            px="1.5"
            py="0.5"
            rounded="full"
            bg="orange.300"
            color="brand.950"
            borderWidth="1px"
            borderColor="orange.200"
            fontSize="9px"
            fontWeight="bold"
            lineHeight="1.4"
            textTransform="uppercase"
            letterSpacing="wide"
            whiteSpace="nowrap"
        >
            {children}
        </Flex>
    )
}

function TeamColumn({
    label,
    dealPoints,
    declarationPoints,
    declarationLabel,
    total,
    totalLabel,
    align,
}: {
    label: string
    /** This deal, from completed tricks — the big number. */
    dealPoints: number
    /** Declarations (+ an announced bela) this team has banked; 0 for the pair
     *  that lost the declarations contest. Rendered only when non-zero. */
    declarationPoints: number
    declarationLabel: string
    total: number
    totalLabel: string
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
            {/* The bonus rides on the big number's own line — the table screen
                is a phone in portrait and there is no row to spare (DESIGN §4.6).
                It sits INBOARD (right of the left column, left of the right
                one) so the two big numbers keep the outer edges. */}
            <HStack
                gap="1"
                align="baseline"
                flexDirection={align === "end" ? "row-reverse" : "row"}
            >
                <Text
                    textStyle="mono"
                    fontSize={{ base: "2xl", md: "3xl" }}
                    lineHeight="1.05"
                    fontWeight="bold"
                    color={INK}
                    fontVariantNumeric="tabular-nums"
                    css={{ [SHORT]: { fontSize: "22px" } }}
                >
                    {dealPoints}
                </Text>
                {declarationPoints > 0 && (
                    <Text
                        textStyle="mono"
                        fontSize="xs"
                        fontWeight="bold"
                        color="brand.200"
                        fontVariantNumeric="tabular-nums"
                        whiteSpace="nowrap"
                        title={declarationLabel}
                        aria-label={`${declarationLabel}: ${declarationPoints}`}
                    >
                        +{declarationPoints}
                    </Text>
                )}
            </HStack>
            <Text
                fontSize="2xs"
                color={INK_MUTED}
                fontVariantNumeric="tabular-nums"
                lineClamp={1}
                title={`${total}`}
            >
                {totalLabel}
            </Text>
        </VStack>
    )
}
