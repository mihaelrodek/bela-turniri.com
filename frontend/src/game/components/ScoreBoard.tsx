import { useState, type ReactNode } from "react"
import { Box, Flex, HStack, IconButton, Text, VStack } from "@chakra-ui/react"
import { FiChevronDown, FiChevronUp } from "react-icons/fi"
import type { PlayerView, RoomState, Seat } from "@bela/protocol"
import type { Team } from "@bela/engine"
import { useTranslation } from "../../i18n"
import { teamOf } from "../util/seats"
import SuitGlyph from "./SuitGlyph"
import TrumpBadge from "./TrumpBadge"
import { INK, INK_MUTED, SHORT, TEAM, type TeamSide } from "./tableStyles"

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

   HUD v3 (DESIGN §6) changed the packaging, not the facts:

   - each side is now a CARD in its team's colour (`TEAM`, tableStyles.ts) —
     ours green, theirs gold, the same two colours the seats wear, so the
     score and the ring of players finally agree about who is who;
   - a 2 px PROGRESS BAR under each card runs the match total toward the
     target. "512, do 1001" is two numbers and a subtraction; a bar half full
     is the same fact without the arithmetic, and it is the question every
     player asks between deals. The numbers stay under it for anyone who
     wants them exactly;
   - the old footer row is gone: it existed to carry "do 1001", and the bar
     carries that now. Only the history chevron survives it.
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
    header,
    actions,
    noDeclarations = false,
    allowBela = true,
}: {
    view: PlayerView
    seats: RoomState["seats"]
    targetScore: number
    header?: ReactNode
    actions?: ReactNode
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
    /* Between the last trick and "next deal" the server has ALREADY added the
       deal to `score`, while the big numbers still show that same deal — so
       the small running total read as if the deal would be added a second
       time (747, "127 +50", 924). Until the next deal starts, show the total
       as it stood BEFORE the deal; the recap dialog (DealSummary) carries the
       "Upisano" figure and the header switches to the new total with the
       next deal. */
    const settling = view.phase === "DEAL_DONE" ? view.dealScore : null
    const shownTotal = (team: Team) =>
        settling ? view.score[team] - settling.total[team] : view.score[team]

    return (
        <Box
            // NO PANEL AT ALL (2026-09-18, user request, third pass): not
            // `{...GLASS}`, no background, no rounded corners, no shadow, no
            // backdrop blur. Every one of those reads as a "box around the
            // score" even with the border gone, which is the thing that was
            // actually being complained about. What is left is the score
            // itself sitting on the table, and ONE hairline under it as the
            // delimiter between the score and the playing surface.
            bg="transparent"
            boxShadow="none"
            borderColor="border.subtle"
            borderTopWidth="0"
            borderInlineStartWidth="0"
            borderInlineEndWidth="0"
            borderBottomWidth="1px"
            position="relative"
            zIndex={10}
            px="3"
            // Trimmed on a phone (2026-09-20): the panel was ~135 px of a
            // 796 px column, and every pixel it gives back is a pixel of
            // felt. Only padding and gaps went — the type is untouched.
            pt={{ base: "0.5", md: "1" }}
            pb={{ base: "0.5", md: "1.5" }}
            css={{ [SHORT]: { paddingTop: "2px", paddingBottom: "2px" } }}
        >
            {/* Moved off the "ONI" progress bar (2026-09-20, user request):
                it used to sit `insetEnd`/`bottom` of the score Flex below,
                level with "Zvanja", which on md+ put it tiny and half-hidden
                at the right end of the away team's progress line, overlapping
                the bar. It now mirrors the settings gear's own corner
                (`TableHeader.tsx`, `insetEnd="0" top="0"`, 32px hit target)
                on the OPPOSITE side of the same header row — a corner that
                row leaves empty otherwise — instead of sharing a row with
                anything that moves or means something else. Absolutely
                positioned against this Box exactly like the gear is against
                its own row, so it costs no height: the collapsed panel is
                exactly as tall on a phone as it was before this moved, and
                the table below (tuned to that height) does not shift. */}
            {hasHistory && (
                <IconButton
                    position="absolute"
                    insetStart="0"
                    top="0"
                    size="xs"
                    minW="32px"
                    minH="32px"
                    variant="ghost"
                    color={INK_MUTED}
                    _hover={{ bg: "bg.muted" }}
                    aria-label={t("game.score.historyTitle")}
                    title={t("game.score.historyTitle")}
                    aria-expanded={open}
                    onClick={() => setOpen((v) => !v)}
                >
                    {open ? <FiChevronUp /> : <FiChevronDown />}
                </IconButton>
            )}
            {header}
            <Flex position="relative" align="stretch" justify="space-between" gap={{ base: "1.5", md: "2" }}>
                <TeamCard
                    label={usLabel}
                    team="us"
                    dealPoints={view.currentDealPoints[myTeam]}
                    declarationPoints={declarationPoints[myTeam]}
                    declarationLabel={t("game.score.declarationBonus")}
                    total={shownTotal(myTeam)}
                    progressLabel={t("game.score.progress", {
                        total: shownTotal(myTeam),
                        target: targetScore,
                    })}
                    targetScore={targetScore}
                    align="start"
                />

                <VStack gap={{ base: "0", md: "0.5" }} align="center" flexShrink={0}>
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
                        // Whose deal this is, in the same two colours the
                        // seats and the cards use — so "who has to make it"
                        // is answered by the cell's own border, not only by
                        // the name inside it.
                        callerTeam={caller === null ? null : teamOf(caller) === myTeam ? "us" : "them"}
                    />
                    {actions}
                </VStack>

                <TeamCard
                    label={themLabel}
                    team="them"
                    dealPoints={view.currentDealPoints[theirTeam]}
                    declarationPoints={declarationPoints[theirTeam]}
                    declarationLabel={t("game.score.declarationBonus")}
                    total={shownTotal(theirTeam)}
                    progressLabel={t("game.score.progress", {
                        total: shownTotal(theirTeam),
                        target: targetScore,
                    })}
                    targetScore={targetScore}
                    align="end"
                />
            </Flex>

            {/* The history panel itself: wider than the old version (2026-09-18,
                user request — "bigger, full width") — it now bleeds to the
                same edges as the glass panel around it, `left="0" right="0"`,
                instead of stopping at the inner padding, and its rows carry
                more type and breathing room to match. */}
            {open && hasHistory && (
                <Box
                    position="absolute"
                    top="calc(100% - 6px)"
                    left="0"
                    right="0"
                    zIndex={20}
                    px="3"
                    py="2.5"
                    rounded="l2"
                    bg="bg.opaque"
                    borderWidth="1px"
                    borderColor="border"
                    boxShadow="0 12px 30px rgba(0,0,0,0.28)"
                    maxH="220px"
                    overflowY="auto"
                >
                    {view.history.map((deal) => (
                        <HStack
                            key={deal.dealNo}
                            gap="2"
                            justify="space-between"
                            py="1"
                            fontSize="xs"
                            color={INK}
                        >
                            <HStack gap="1.5" minW="0">
                                <Text color={INK_MUTED} minW="16px">{deal.dealNo}.</Text>
                                <SuitGlyph suit={deal.trump} size={13} />
                                <Text color={INK_MUTED} lineClamp={1}>
                                    {seatName(seats, deal.caller, t("game.seat.empty"))}
                                </Text>
                                <Text color={deal.passed ? "brand.200" : "red.300"} fontWeight="bold">
                                    {deal.passed ? t("game.deal.passed") : t("game.deal.fell")}
                                </Text>
                            </HStack>
                            <HStack gap="2" fontVariantNumeric="tabular-nums" flexShrink={0}>
                                <Text minW="34px" textAlign="end" fontWeight="bold">
                                    {deal.total[myTeam]}
                                </Text>
                                <Text minW="34px" textAlign="end" color={INK_MUTED}>
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

function TeamCard({
    label,
    team,
    dealPoints,
    declarationPoints,
    declarationLabel,
    total,
    progressLabel,
    targetScore,
    align,
}: {
    label: string
    /** Which pair this card is, relative to the viewer (`TEAM`, DESIGN §6). */
    team: TeamSide
    /** This deal, from completed tricks — the big number. */
    dealPoints: number
    /** Declarations (+ an announced bela) this team has banked; 0 for the pair
     *  that lost the declarations contest. Rendered only when non-zero. */
    declarationPoints: number
    declarationLabel: string
    total: number
    /** Spoken form of the bar, for anyone who cannot see a 2 px line. */
    progressLabel: string
    targetScore: number
    align: "start" | "end"
}) {
    // Clamped, because the deal that wins the match usually overshoots the
    // target and a bar past 100 % would render as a bar that lost its end.
    const progress = Math.max(0, Math.min(1, targetScore > 0 ? total / targetScore : 0))

    return (
        <VStack
            gap="0"
            align="center"
            minW="0"
            flex="1"
            px={{ base: "1.5", md: "2" }}
            pt="0"
            pb={{ base: "0", md: "1" }}
            rounded="l2"
            bg="transparent"
            borderWidth="1px"
            // The team's own colour as a hairline: enough to bind the card to
            // the seats that share it, too quiet to fight the big number.
            borderColor="transparent"
        >
            <Text
                fontSize="2xs"
                color={TEAM[team]}
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
            <Flex justify="center" w="100%">
                <Box position="relative" display="inline-flex" alignItems="baseline">
                    <Text
                        fontSize={{ base: "2xl", md: "4xl" }}
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
                            position="absolute"
                            top="50%"
                            transform="translateY(-50%)"
                            {...(align === "end"
                                ? { right: "calc(100% + 4px)" }
                                : { left: "calc(100% + 4px)" })}
                            fontSize="xs"
                            fontWeight="bold"
                            color={TEAM[team]}
                            fontVariantNumeric="tabular-nums"
                            whiteSpace="nowrap"
                            title={declarationLabel}
                            aria-label={`${declarationLabel}: ${declarationPoints}`}
                        >
                            +{declarationPoints}
                        </Text>
                    )}
                </Box>
            </Flex>

            {/* Match total, under the deal number. The deal figure resets
                every hand; a player mid-deal still wants "how much have we
                banked overall" without opening the history panel — the bar
                alone answers "how close" but not "how much". */}
            <Text
                fontSize="2xs"
                lineHeight="1.2"
                color={INK_MUTED}
                fontVariantNumeric="tabular-nums"
            >
                {total}
            </Text>

            {/* The bar. 2 px, full width of the card, and it fills from the
                card's OUTER edge inward (`row-reverse` on the right-hand
                card) so the two bars grow toward each other and the gap
                between them is the gap in the match. */}
            <Box
                w="100%"
                h="2px"
                mt={{ base: "0.5", md: "1" }}
                rounded="full"
                bg="border.subtle"
                overflow="hidden"
                display="flex"
                flexDirection={align === "end" ? "row-reverse" : "row"}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={targetScore}
                aria-valuenow={total}
                aria-label={progressLabel}
            >
                <Box
                    h="100%"
                    rounded="full"
                    bg={TEAM[team]}
                    style={{ width: `${progress * 100}%` }}
                    // Points arrive once a deal, so this can afford to move;
                    // 160 ms is under the reaction-time floor where motion
                    // starts to feel like waiting.
                    transition="width 160ms ease-out"
                />
            </Box>
        </VStack>
    )
}
