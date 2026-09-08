import { Box, Flex, HStack, Text, VStack } from "@chakra-ui/react"
import type { RoomState, Seat, TrickReview, WonTrick } from "@bela/protocol"
import { useTranslation } from "../../i18n"
import PlayingCard from "./PlayingCard"
import { GLASS_STRONG, INK, INK_MUTED } from "./tableStyles"

/* ──────────────────────────────────────────────────────────────────────────
   TrickHistory — "gledanje štihova" (game/README.md §1.8).

   Every completed trick of THIS deal, in play order, and for each one WHO
   PLAYED WHICH CARD. That attribution is the whole feature: a flat list of
   cards is something anyone can reconstruct from memory, "the ace of hearts
   came from the seat on my left" is not.

   The component never decides who may look. `PlayerView.trickHistory` is
   `null` for a seat the room's rule excludes — the server redacts it in
   `viewFor`, so there is nothing here to hide and nothing in the frame to
   dig out of devtools. All this does is explain the emptiness.
   ────────────────────────────────────────────────────────────────────── */

function seatName(seats: RoomState["seats"], seat: Seat, fallback: string): string {
    const occupant = seats[seat]?.occupant
    if (!occupant) return fallback
    return occupant.kind === "BOT" ? occupant.name : occupant.user.name
}

export default function TrickHistory({
    tricks,
    trickReview,
    seats,
    mySeat,
    onDismiss,
}: {
    /** `null` = this seat may not review (the server sent nothing). */
    tricks: WonTrick[] | null
    trickReview: TrickReview
    seats: RoomState["seats"]
    mySeat: Seat | null
    onDismiss: () => void
}) {
    const { t } = useTranslation()

    const message =
        tricks === null
            ? t(trickReview === "off" ? "game.tricks.hiddenOff" : "game.tricks.hiddenLeaderPair")
            : tricks.length === 0
              ? t("game.tricks.empty")
              : null

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
            cursor="pointer"
            onClick={onDismiss}
            css={{
                animation: "trickHistoryIn 180ms ease-out",
                "@keyframes trickHistoryIn": { from: { opacity: 0 }, to: { opacity: 1 } },
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
                maxW="460px"
                maxH="94%"
                overflowY="auto"
                boxShadow="0 18px 40px rgba(0,0,0,0.55)"
            >
                <Text fontSize="sm" fontWeight="bold" textAlign="center" color={INK} letterSpacing="wide">
                    {t("game.tricks.title")}
                </Text>

                {message !== null ? (
                    <Text fontSize="xs" color={INK_MUTED} textAlign="center" py="2">
                        {message}
                    </Text>
                ) : (
                    tricks!.map((trick) => (
                        <Box
                            key={trick.no}
                            rounded="l2"
                            px="2"
                            py="1.5"
                            borderWidth="1px"
                            borderColor="brand.800/70"
                            bg="brand.900/50"
                        >
                            <HStack justify="space-between" gap="2">
                                <Text fontSize="xs" fontWeight="bold" color={INK}>
                                    {t("game.tricks.trickNo", { n: trick.no })}
                                </Text>
                                <Text fontSize="9px" color={INK_MUTED} lineClamp={1}>
                                    {t("game.tricks.ledBy", {
                                        name: seatName(seats, trick.leader, t("game.seat.empty")),
                                    })}
                                </Text>
                            </HStack>

                            {/* One column per play, in the order they were
                                thrown: the card with the name of whoever
                                threw it directly under it. */}
                            <HStack gap="1.5" mt="1.5" align="start">
                                {trick.plays.map((play) => {
                                    const won = play.seat === trick.winner
                                    return (
                                        <VStack key={play.card} gap="0.5" flex="1" minW="0" align="center">
                                            <Box opacity={won ? 1 : 0.75}>
                                                <PlayingCard card={play.card} size="sm" />
                                            </Box>
                                            <Text
                                                fontSize="9px"
                                                lineClamp={1}
                                                maxW="100%"
                                                fontWeight={won ? "bold" : "normal"}
                                                color={won ? "brand.200" : INK_MUTED}
                                                title={seatName(seats, play.seat, t("game.seat.empty"))}
                                            >
                                                {play.seat === mySeat
                                                    ? t("game.seat.youSuffix", {
                                                          name: seatName(seats, play.seat, t("game.seat.empty")),
                                                      })
                                                    : seatName(seats, play.seat, t("game.seat.empty"))}
                                            </Text>
                                        </VStack>
                                    )
                                })}
                            </HStack>

                            <Text fontSize="9px" mt="1" color="brand.200" fontWeight="bold" lineClamp={1}>
                                {t("game.tricks.wonBy", {
                                    name: seatName(seats, trick.winner, t("game.seat.empty")),
                                })}
                            </Text>
                        </Box>
                    ))
                )}

                <Text fontSize="2xs" color={INK_MUTED} textAlign="center" opacity={0.8}>
                    {t("game.declarations.tapToClose")}
                </Text>
            </VStack>
        </Flex>
    )
}
