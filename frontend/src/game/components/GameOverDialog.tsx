import { Button, Dialog, HStack, Portal, Text, VStack } from "@chakra-ui/react"
import type { Team } from "@bela/engine"
import { useTranslation } from "../../i18n"

/* ──────────────────────────────────────────────────────────────────────────
   GameOverDialog — the end of a game (one team reached the target, README
   §1.7). Not dismissable by clicking away: the room is finished behind it
   and there is nothing to go back to on the table.

   "Nova igra" is a link back to the lobby, not a restart: `room.start` on a
   FINISHED room is not part of the protocol, so the honest thing is to send
   the player where a new room is actually opened.
   ────────────────────────────────────────────────────────────────────── */

export default function GameOverDialog({
    open,
    winner,
    score,
    myTeam,
    onBackToLobby,
    onNewGame,
}: {
    open: boolean
    winner: Team | null
    score: Record<Team, number>
    myTeam: Team
    onBackToLobby: () => void
    /** Opens the lobby with the "new room" flow — omitted for a spectator. */
    onNewGame?: () => void
}) {
    const { t } = useTranslation()
    if (!winner) return null

    const theirTeam: Team = myTeam === "A" ? "B" : "A"
    const weWon = winner === myTeam

    return (
        <Dialog.Root open={open} placement="center" closeOnInteractOutside={false}>
            <Portal>
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content maxW={{ base: "92%", md: "sm" }}>
                        <Dialog.Header>
                            <Dialog.Title>
                                {weWon ? t("game.over.youWon") : t("game.over.youLost")}
                            </Dialog.Title>
                        </Dialog.Header>
                        <Dialog.Body>
                            <VStack gap="3">
                                <Text
                                    fontSize="2xs"
                                    color="fg.muted"
                                    textTransform="uppercase"
                                    letterSpacing="widest"
                                >
                                    {t("game.over.finalScore")}
                                </Text>
                                <HStack gap="6" justify="center">
                                    <VStack gap="0">
                                        <Text fontSize="2xs" color="fg.muted" textTransform="uppercase">
                                            {t("game.score.us")}
                                        </Text>
                                        <Text
                                            textStyle="mono"
                                            fontSize="3xl"
                                            fontWeight="bold"
                                            color={weWon ? "brand.fg" : "fg"}
                                        >
                                            {score[myTeam]}
                                        </Text>
                                    </VStack>
                                    <VStack gap="0">
                                        <Text fontSize="2xs" color="fg.muted" textTransform="uppercase">
                                            {t("game.score.them")}
                                        </Text>
                                        <Text
                                            textStyle="mono"
                                            fontSize="3xl"
                                            fontWeight="bold"
                                            color={weWon ? "fg" : "brand.fg"}
                                        >
                                            {score[theirTeam]}
                                        </Text>
                                    </VStack>
                                </HStack>
                                <Text fontSize="sm" color="fg.muted" textAlign="center">
                                    {t("game.over.description")}
                                </Text>
                            </VStack>
                        </Dialog.Body>
                        <Dialog.Footer>
                            <HStack gap="2" w="100%">
                                <Button variant="outline" flex="1" onClick={onBackToLobby}>
                                    {t("game.over.backToLobby")}
                                </Button>
                                {onNewGame && (
                                    <Button colorPalette="brand" flex="1" onClick={onNewGame}>
                                        {t("game.over.newGame")}
                                    </Button>
                                )}
                            </HStack>
                        </Dialog.Footer>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Portal>
        </Dialog.Root>
    )
}
