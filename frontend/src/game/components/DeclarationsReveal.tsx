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
   revealed — after the first trick — has to say everything at once: whose
   they were, WHICH CARDS, and that only the strongest team scores while the
   other team's declarations are simply lost.

   It dismisses itself after 3 s (the event queue's dwell) or on a tap,
   whichever comes first: it is an interruption in the middle of a deal and
   must never be something you have to close.
   ────────────────────────────────────────────────────────────────────── */

function seatName(seats: RoomState["seats"], seat: Seat, fallback: string): string {
    const occupant = seats[seat]?.occupant
    if (!occupant) return fallback
    return occupant.kind === "BOT" ? occupant.name : occupant.user.name
}

function declarationLabel(
    t: (key: string, params?: Record<string, string | number>) => string,
    declaration: Declaration,
): string {
    if (declaration.kind === "FOUR") return t("game.declaration.four", { points: declaration.points })
    return t(`game.declaration.sequence.${Math.min(declaration.cards.length, 5)}`)
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
    onDismiss,
}: {
    perSeat: Record<Seat, Declaration[]>
    scoringTeam: Team | null
    seats: RoomState["seats"]
    mySeat: Seat | null
    onDismiss?: () => void
}) {
    const { t } = useTranslation()
    const withDeclarations = SEATS.filter((seat) => (perSeat[seat]?.length ?? 0) > 0)
    const myTeam: Team = mySeat === null ? "A" : teamOf(mySeat)

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
                    withDeclarations.map((seat) => {
                        const scores = scoringTeam !== null && teamOf(seat) === scoringTeam
                        return (
                            <Box
                                key={seat}
                                opacity={scores ? 1 : 0.45}
                                rounded="l2"
                                px="2"
                                py="1.5"
                                bg={scores ? "brand.800/70" : "transparent"}
                                borderWidth="1px"
                                borderColor={scores ? "brand.500" : "brand.800/70"}
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
                                        color={scores ? "brand.200" : INK_MUTED}
                                    >
                                        {scores ? t("game.declarations.scores") : t("game.declarations.lost")}
                                    </Text>
                                </HStack>

                                {perSeat[seat].map((declaration) => (
                                    <HStack key={declaration.cards.join("-")} gap="2" mt="1.5" wrap="wrap">
                                        <HStack gap="0">
                                            {declaration.cards.map((card, i) => (
                                                <Box key={card} ml={i === 0 ? "0" : "-10px"}>
                                                    <PlayingCard card={card} size="sm" />
                                                </Box>
                                            ))}
                                        </HStack>
                                        <Text fontSize="2xs" color={INK_MUTED} flex="1" lineClamp={1}>
                                            {declarationLabel(t, declaration)}
                                        </Text>
                                        <Text textStyle="mono" fontSize="xs" fontWeight="bold" color={INK}>
                                            {declaration.points}
                                        </Text>
                                    </HStack>
                                ))}
                            </Box>
                        )
                    })
                )}

                {scoringTeam !== null && (
                    <Text fontSize="xs" color={INK_MUTED} textAlign="center">
                        {scoringTeam === myTeam
                            ? t("game.declarations.weScore")
                            : t("game.declarations.theyScore")}
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
