import { Box, Flex, HStack, IconButton, Portal, Text, VStack } from "@chakra-ui/react"
import { FiX } from "react-icons/fi"
import type { RoomState, Seat } from "@bela/protocol"
import type { Declaration, Suit, Team } from "@bela/engine"
import { useTranslation } from "../../i18n"
import { otherTeam, SEATS, teamOf } from "../util/seats"
import { RANKS, makeCard, suitKey } from "../util/cards"
import PlayingCard, { SuitIcon } from "./PlayingCard"
import { GLASS_STRONG, INK, INK_MUTED, TEAM } from "./tableStyles"

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

   It dismisses itself after the event queue's dwell or through its close button,
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
                <Text fontSize="3xl" fontWeight="bold" color="brand.fg" lineHeight="1.1">
                    {t("game.bela.title")}
                </Text>
                <Text fontSize="sm" color={INK_MUTED}>
                    {t("game.bela.by", { name: seatName(seats, seat, t("game.seat.empty")) })}
                </Text>
            </VStack>
        </Flex>
    )
}

/** "Bot Dora zove žir" — the moment trump is settled.
 *
 *  A FULL OVERLAY since 2026-09-20 (user request: "stavi bas veci modal koji
 *  se automatski makne kao kad prikazuje zvanja ali krace traje"): same
 *  portal, same dimmed backdrop and same card as the declarations reveal
 *  below, so the two read as one family — only bigger in the suit and much
 *  shorter on screen (`TRUMP_FLASH_MS` in `GameRoomPage`, 1500 ms inside
 *  TRUMP_SET's own 1600 ms dwell, against the declarations' 4000 ms).
 *  It cannot be dismissed by hand and eats no taps (`pointerEvents="none"`):
 *  it is gone before anybody could reach for it, and swallowing the tap that
 *  starts the next card would be worse than the beat itself.
 *
 *  The caller's medallion and the score panel carry the fact for the rest of
 *  the deal; this only makes sure nobody missed the moment it happened. */
export function TrumpFlash({ seats, seat, suit }: { seats: RoomState["seats"]; seat: Seat; suit: Suit }) {
    const { t } = useTranslation()
    return (
        <Portal>
            <Flex
                position="fixed"
                inset="0"
                align="center"
                justify="center"
                px="3"
                zIndex={1500}
                pointerEvents="none"
                bg="blackAlpha.500"
                backdropFilter="blur(2px)"
                css={{
                    animation: "trumpBackdropIn 160ms ease-out",
                    "@keyframes trumpBackdropIn": { from: { opacity: 0 }, to: { opacity: 1 } },
                }}
            >
                <VStack
                    gap="3"
                    {...GLASS_STRONG}
                    borderColor="brand.300"
                    rounded="l3"
                    w="100%"
                    maxW="340px"
                    px="6"
                    py="6"
                    role="status"
                    aria-live="polite"
                    boxShadow="0 18px 40px rgba(0,0,0,0.55)"
                    css={{
                        ...GLASS_STRONG.css,
                        animation: "trumpFlashIn 180ms cubic-bezier(0.22, 1.2, 0.36, 1)",
                        "@keyframes trumpFlashIn": {
                            from: { transform: "scale(0.8)", opacity: 0 },
                            to: { transform: "scale(1)", opacity: 1 },
                        },
                    }}
                >
                    <SuitIcon suit={suit} size={88} />
                    <Text fontSize="2xl" fontWeight="bold" color={INK} lineHeight="1.15" textAlign="center">
                        {t("game.trump.calledBy", {
                            name: seatName(seats, seat, t("game.seat.empty")),
                            suit: t(`game.suit.${suit}`),
                        })}
                    </Text>
                </VStack>
            </Flex>
        </Portal>
    )
}

/** A full-suit hand is rare enough to deserve its own unmistakable moment.
 * The engine has already ended the game when this renders; the overlay only
 * reveals the eight-card hand before the ordinary result dialog appears. */
export function BelotFlash({
    seats,
    seat,
    suit,
    reducedMotion,
}: {
    seats: RoomState["seats"]
    seat: Seat
    suit: Suit
    reducedMotion: boolean
}) {
    const { t } = useTranslation()
    const name = seatName(seats, seat, t("game.seat.empty"))

    return (
        <Portal>
        <Flex
            position="fixed"
            inset="0"
            align="center"
            justify="center"
            px="3"
            pointerEvents="none"
            zIndex={1500}
            bg="bg.opaque"
            backdropFilter="blur(5px)"
            role="status"
            css={{
                animation: reducedMotion ? undefined : "belotBackdropIn 280ms ease-out",
                "@keyframes belotBackdropIn": { from: { opacity: 0 }, to: { opacity: 1 } },
            }}
        >
            <VStack
                gap="2"
                w="100%"
                maxW="390px"
                rounded="l3"
                borderWidth="1px"
                borderColor="brand.300"
                bg="bg.opaque"
                px={{ base: "4", sm: "6" }}
                py={{ base: "5", sm: "6" }}
                boxShadow="0 0 70px rgba(246, 196, 83, 0.34), 0 20px 60px rgba(0,0,0,0.6)"
                css={{
                    animation: reducedMotion ? undefined : "belotPanelIn 520ms cubic-bezier(0.16, 1, 0.3, 1)",
                    "@keyframes belotPanelIn": {
                        from: { transform: "scale(.7) translateY(24px)", opacity: 0 },
                        to: { transform: "scale(1) translateY(0)", opacity: 1 },
                    },
                }}
            >
                <Text fontSize={{ base: "4xl", sm: "5xl" }} lineHeight="1" fontWeight="black" color="yellow.300" letterSpacing="widest">
                    {t("game.belot.title")}
                </Text>
                <Text fontSize="sm" fontWeight="bold" color={INK} textAlign="center">
                    {t("game.belot.by", { name, suit: t(suitKey(suit)) })}
                </Text>

                <Box display="grid" gridTemplateColumns="repeat(4, 48px)" gap="1.5" justifyContent="center" my="2">
                    {RANKS.map((rank, index) => (
                        <Box
                            key={rank}
                            w="48px"
                            h="70px"
                            overflow="hidden"
                            rounded="6px"
                            css={{
                                animation: reducedMotion ? undefined : "belotCardIn 420ms cubic-bezier(.16,1,.3,1) both",
                                animationDelay: reducedMotion ? undefined : `${220 + index * 70}ms`,
                                "@keyframes belotCardIn": {
                                    from: { transform: "translateY(28px) rotate(-5deg)", opacity: 0 },
                                    to: { transform: "translateY(0) rotate(0)", opacity: 1 },
                                },
                            }}
                        >
                            <Box transform="scale(.78)" transformOrigin="top left">
                                <PlayingCard card={makeCard(rank, suit)} size="sm" />
                            </Box>
                        </Box>
                    ))}
                </Box>

                <Text fontSize="xs" color="yellow.200" fontWeight="bold">
                    {t("game.belot.wins")}
                </Text>
            </VStack>
        </Flex>
        </Portal>
    )
}

export default function DeclarationsReveal({
    perSeat,
    scoringTeam,
    seats,
    mySeat,
    ownDeclarations,
    declarationPoints,
    belaDeclared,
    trumpSuit = null,
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
    /** Live totals include Bela, which can belong to the other pair even
     *  when ordinary declarations were awarded to the scoring pair. */
    declarationPoints?: Record<Team, number>
    belaDeclared: Team | null
    /** Trump of the running deal — the only thing needed to DRAW a bela, since
     *  bela is always K+Q of trump. Null before trump is settled, in which case
     *  there can be no bela either. */
    trumpSuit?: Suit | null
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
    const theirTeam = otherTeam(myTeam)
    const ordinaryPoints: Record<Team, number> = { A: 0, B: 0 }
    for (const seat of withDeclarations) {
        ordinaryPoints[teamOf(seat)] += totalPoints(perSeat[seat] ?? [])
    }
    const points = declarationPoints ?? ordinaryPoints
    const hasVisiblePoints = points.A > 0 || points.B > 0
    const teamRows = [
        {
            team: myTeam,
            side: "us" as const,
            label: mySeat === null ? t("game.score.teamA") : t("game.score.us"),
        },
        {
            team: theirTeam,
            side: "them" as const,
            label: mySeat === null ? t("game.score.teamB") : t("game.score.them"),
        },
    ]
    /* Bela is K+Q of trump and the engine only ever tells us the TEAM that
       announced it (`PlayerView.belaDeclared`), never the seat — so it is
       drawn as its own row, attributed to that pair, with the two real cards
       rather than a footnote under the total. */
    const belaRow =
        belaDeclared !== null && trumpSuit !== null
            ? teamRows.find((row) => row.team === belaDeclared) ?? null
            : null

    return (
        <Portal>
            <Flex
                position="fixed"
                inset="0"
                align="center"
                justify="center"
                px="3"
                zIndex={1500}
                bg="blackAlpha.500"
                backdropFilter="blur(2px)"
                onClick={onDismiss}
                css={{
                    // Same rule as the table under it (2026-09-20): this is a
                    // picture of cards, not text to select. Portals render
                    // outside the room's own subtree, so it is repeated here.
                    userSelect: "none",
                    WebkitUserSelect: "none",
                    WebkitTouchCallout: "none",
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
                position="relative"
                boxShadow="0 18px 40px rgba(0,0,0,0.55)"
                onClick={(event) => event.stopPropagation()}
            >
                {onDismiss && (
                    <IconButton
                        aria-label={t("game.common.close")}
                        title={t("game.common.close")}
                        variant="ghost"
                        size="xs"
                        position="absolute"
                        top="2"
                        right="2"
                        onClick={onDismiss}
                    >
                        <FiX />
                    </IconButton>
                )}
                <Text fontSize="sm" fontWeight="bold" textAlign="center" color={INK} letterSpacing="wide">
                    {t("game.declarations.title")}
                </Text>

                {hasVisiblePoints && (
                    <HStack gap="2" align="stretch">
                        {teamRows.map(({ team, side, label }) => (
                            <VStack
                                key={team}
                                flex="1"
                                gap="0.5"
                                align={side === "us" ? "start" : "end"}
                                rounded="l2"
                                px="2.5"
                                py="2"
                                bg="bg.subtle"
                                borderTopWidth="2px"
                                borderTopColor={TEAM[side]}
                            >
                                <Text
                                    fontSize="2xs"
                                    fontWeight="bold"
                                    color={TEAM[side]}
                                    textTransform="uppercase"
                                    letterSpacing="wide"
                                >
                                    {label}
                                </Text>
                                <Text
                                    fontSize="xl"
                                    lineHeight="1"
                                    fontWeight="black"
                                    color={points[team] > 0 ? INK : INK_MUTED}
                                    fontVariantNumeric="tabular-nums"
                                >
                                    {points[team] > 0 ? `+${points[team]}` : "—"}
                                </Text>
                                {belaDeclared === team && belaRow === null && (
                                    <Text fontSize="2xs" fontWeight="bold" color={TEAM[side]}>
                                        {t("game.declarations.bela")}
                                    </Text>
                                )}
                            </VStack>
                        ))}
                    </HStack>
                )}

                {withDeclarations.length === 0 && belaDeclared === null ? (
                    <Text fontSize="xs" color={INK_MUTED} textAlign="center" py="2">
                        {t("game.declarations.none")}
                    </Text>
                ) : (
                    withDeclarations.map((seat) => {
                        const declarations = perSeat[seat] ?? []
                        const points = totalPoints(declarations)

                        return (
                            <Box
                                key={seat}
                                rounded="l2"
                                px="2"
                                py="1.5"
                                bg="bg.subtle"
                                borderWidth="1px"
                                borderColor="border"
                            >
                            <HStack justify="space-between" gap="2">
                                <HStack gap="1.5" minW="0">
                                    <Text fontSize="xs" fontWeight="bold" color={INK} lineClamp={1}>
                                        {seatName(seats, seat, t("game.seat.empty"))}
                                    </Text>
                                    <Text
                                        fontSize="xs"
                                        fontWeight="black"
                                        color="brand.fg"
                                        fontVariantNumeric="tabular-nums"
                                        flexShrink={0}
                                    >
                                        + {points}
                                    </Text>
                                </HStack>
                            </HStack>

                            {/* The cards are enough to explain the declaration;
                                its combined value lives beside the player's
                                name, where it is easier to scan. */}
                            {declarations.map((declaration) => (
                                <HStack key={declaration.cards.join("-")} gap="2" mt="1.5" wrap="wrap">
                                    <HStack gap="0" flex="1" minW="0">
                                        {declaration.cards.map((card, i) => (
                                            <Box key={card} ml={i === 0 ? "0" : "-10px"}>
                                                <PlayingCard card={card} size="sm" />
                                            </Box>
                                        ))}
                                    </HStack>
                                </HStack>
                            ))}
                            </Box>
                        )
                    })
                )}

                {belaRow && trumpSuit !== null && (
                    <Box
                        rounded="l2"
                        px="2"
                        py="1.5"
                        bg="bg.subtle"
                        borderWidth="1px"
                        borderColor="border"
                    >
                        <HStack justify="space-between" gap="2">
                            <Text fontSize="xs" fontWeight="bold" color={INK} lineClamp={1}>
                                {t("game.declarations.bela")}
                            </Text>
                            <Text
                                fontSize="2xs"
                                fontWeight="bold"
                                color={TEAM[belaRow.side]}
                                textTransform="uppercase"
                                letterSpacing="wide"
                                flexShrink={0}
                            >
                                {belaRow.label}
                            </Text>
                        </HStack>
                        <HStack gap="0" mt="1.5">
                            {[makeCard("K", trumpSuit), makeCard("Q", trumpSuit)].map((card, i) => (
                                <Box key={card} ml={i === 0 ? "0" : "-10px"}>
                                    <PlayingCard card={card} size="sm" />
                                </Box>
                            ))}
                        </HStack>
                    </Box>
                )}

                {/* Our own declarations lost. One line, no cards: the viewer
                    already holds these eight cards, but there is nothing to
                    show off and nothing anyone else may see. */}
                {ownLost > 0 && (
                    <Text fontSize="2xs" color={INK_MUTED} textAlign="center">
                        {t("game.declarations.oursLost", { points: ownLost })}
                    </Text>
                )}

            </VStack>
            </Flex>
        </Portal>
    )
}
