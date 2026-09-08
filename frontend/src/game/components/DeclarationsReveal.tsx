import { Box, Flex, HStack, Text, VStack } from "@chakra-ui/react"
import type { RoomState, Seat } from "@bela/protocol"
import type { Declaration, Team } from "@bela/engine"
import { useTranslation } from "../../i18n"
import { SEATS, teamOf } from "../util/seats"
import PlayingCard from "./PlayingCard"
import { GLASS_STRONG, INK, INK_MUTED } from "./tableStyles"

/* ──────────────────────────────────────────────────────────────────────────
   DeclarationsReveal — the overlay that answers "who had what, and who got
   the points".

   Declarations are detected automatically by the engine (README §1.4, an
   explicit decision to avoid a "did you forget to declare?" step), which
   means the player never sees them being made. So the one moment they ARE
   revealed — before the first card — has to say whose they were and WHICH
   CARDS.

   ONLY THE SCORING PAIR IS EVER SHOWN, because only the scoring pair is ever
   sent (README §1.4): the losing pair's declarations are cards of hands
   nobody has played yet, and handing them out was free information every
   deal. There is therefore no dimmed "PROPADA" block any more — there is
   nothing to dim. If the VIEWER's own declarations lost, they get one plain
   line saying so and how much went with it; their own cards are theirs to
   know, but nobody else's are shown, and no cards are drawn for that line.

   It dismisses itself after 3.4 s (the event queue's dwell) or on a tap,
   whichever comes first: the automatic opening preview is brief and
   must never be something you have to close.
   ────────────────────────────────────────────────────────────────────── */

function seatName(seats: RoomState["seats"], seat: Seat, fallback: string): string {
    const occupant = seats[seat]?.occupant
    if (!occupant) return fallback
    return occupant.kind === "BOT" ? occupant.name : occupant.user.name
}

function totalPoints(declarations: readonly Declaration[]): number {
    return declarations.reduce((sum, d) => sum + d.points, 0)
}

/** The "Bela!" flash — 20 points for K+Q of trump, announced as it is played. */
export function BelaFlash({ seats, seat }: { seats: RoomState["seats"]; seat: Seat }) {
    const { t } = useTranslation()
    return (
        <Flex position="absolute" inset="0" align="center" justify="center" pointerEvents="none" zIndex={9}>
            <VStack
                gap="0"
                {...GLASS_STRONG}
                borderColor="brand.300"
                rounded="l3"
                px="7"
                py="4"
                boxShadow="0 0 40px rgba(127,196,150,0.4)"
                css={{
                    ...GLASS_STRONG.css,
                    animation: "belaFlashIn 220ms cubic-bezier(0.22, 1.2, 0.36, 1)",
                    "@keyframes belaFlashIn": {
                        from: { transform: "scale(0.7)", opacity: 0 },
                        to: { transform: "scale(1)", opacity: 1 },
                    },
                }}
            >
                <Text fontSize="3xl" fontWeight="bold" color="brand.200" lineHeight="1.1">
                    {t("game.bela.title")}
                </Text>
                <Text fontSize="sm" color={INK_MUTED}>
                    {t("game.bela.by", { name: seatName(seats, seat, t("game.seat.empty")) })}
                </Text>
            </VStack>
        </Flex>
    )
}

export default function DeclarationsReveal({
    perSeat,
    scoringTeam,
    seats,
    mySeat,
    ownDeclarations,
    onDismiss,
}: {
    /** The SCORING pair only — that is all the engine sends (README §1.4). */
    perSeat: Partial<Record<Seat, Declaration[]>>
    scoringTeam: Team | null
    seats: RoomState["seats"]
    mySeat: Seat | null
    /** The viewer's own declarations, from `PlayerView.declarations[mySeat]`.
     *  Used ONLY to say "yours lost" when our pair did not win the contest. */
    ownDeclarations?: readonly Declaration[]
    onDismiss?: () => void
}) {
    const { t } = useTranslation()
    const myTeam: Team = mySeat === null ? "A" : teamOf(mySeat)
    // Belt and braces: the payload is already trimmed server-side, but the
    // overlay must not render a losing block even if one ever reached it.
    const withDeclarations = SEATS.filter(
        (seat) =>
            (perSeat[seat]?.length ?? 0) > 0 &&
            scoringTeam !== null &&
            teamOf(seat) === scoringTeam,
    )
    const ownLost =
        scoringTeam !== null && myTeam !== scoringTeam ? totalPoints(ownDeclarations ?? []) : 0

    return (
        <Flex
            position="absolute"
            inset="0"
            align="center"
            justify="center"
            px="3"
            zIndex={8}
            bg="brand.950/55"
            backdropFilter="blur(2px)"
            cursor={onDismiss ? "pointer" : "default"}
            onClick={onDismiss}
            css={{
                animation: "belaRevealIn 180ms ease-out",
                "@keyframes belaRevealIn": { from: { opacity: 0 }, to: { opacity: 1 } },
            }}
        >
            <VStack
                gap="2"
                align="stretch"
                {...GLASS_STRONG}
                rounded="l3"
                px="4"
                py="3"
                w="100%"
                maxW="420px"
                maxH="94%"
                overflowY="auto"
                boxShadow="0 18px 40px rgba(0,0,0,0.55)"
            >
                <Text fontSize="sm" fontWeight="bold" textAlign="center" color={INK} letterSpacing="wide">
                    {t("game.declarations.title")}
                </Text>

                {withDeclarations.length === 0 ? (
                    <Text fontSize="xs" color={INK_MUTED} textAlign="center" py="2">
                        {t("game.declarations.none")}
                    </Text>
                ) : (
                    withDeclarations.map((seat) => (
                        <Box
                            key={seat}
                            rounded="l2"
                            px="2"
                            py="1.5"
                            bg="brand.800/70"
                            borderWidth="1px"
                            borderColor="brand.500"
                        >
                            <HStack justify="space-between" gap="2">
                                <Text fontSize="xs" fontWeight="bold" color={INK} lineClamp={1}>
                                    {seatName(seats, seat, t("game.seat.empty"))}
                                </Text>
                                <Text
                                    fontSize="9px"
                                    fontWeight="bold"
                                    textTransform="uppercase"
                                    letterSpacing="wide"
                                    color="brand.200"
                                >
                                    {t("game.declarations.scores")}
                                </Text>
                            </HStack>

                            {/* Cards and the points, nothing else. The old
                                "terca (20)" / "kvarta (50)" caption is gone
                                (2026-09-08): nobody at a table says it, the
                                cards already are the declaration, and the
                                number is right there. */}
                            {(perSeat[seat] ?? []).map((declaration) => (
                                <HStack key={declaration.cards.join("-")} gap="2" mt="1.5" wrap="wrap">
                                    <HStack gap="0" flex="1" minW="0">
                                        {declaration.cards.map((card, i) => (
                                            <Box key={card} ml={i === 0 ? "0" : "-10px"}>
                                                <PlayingCard card={card} size="sm" />
                                            </Box>
                                        ))}
                                    </HStack>
                                    <Text textStyle="mono" fontSize="xs" fontWeight="bold" color={INK}>
                                        {declaration.points}
                                    </Text>
                                </HStack>
                            ))}
                        </Box>
                    ))
                )}

                {scoringTeam !== null && (
                    <Text fontSize="xs" color={INK_MUTED} textAlign="center">
                        {scoringTeam === myTeam
                            ? t("game.declarations.weScore")
                            : t("game.declarations.theyScore")}
                    </Text>
                )}

                {/* Our own declarations lost. One line, no cards: the viewer
                    already holds these eight cards, but there is nothing to
                    show off and nothing anyone else may see. */}
                {ownLost > 0 && (
                    <Text fontSize="2xs" color={INK_MUTED} textAlign="center">
                        {t("game.declarations.oursLost", { points: ownLost })}
                    </Text>
                )}

                {onDismiss && (
                    <Text fontSize="2xs" color={INK_MUTED} textAlign="center" opacity={0.8}>
                        {t("game.declarations.tapToClose")}
                    </Text>
                )}
            </VStack>
        </Flex>
    )
}
