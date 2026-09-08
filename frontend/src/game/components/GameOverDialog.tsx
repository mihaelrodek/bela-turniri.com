import { Button, Dialog, HStack, Portal, Text, VStack } from "@chakra-ui/react"
import type { Team } from "@bela/engine"
import { useTranslation } from "../../i18n"

/* ──────────────────────────────────────────────────────────────────────────
   GameOverDialog — the ONE place a finished game is announced (README §1.7).

   It used to be a wide strip above the room panel, which is the worst of both
   worlds: it shouted at the top of a screen the player was already reading,
   and it never went away, so the room underneath was permanently pushed down
   and half-hidden by an announcement about a game that was over. A result is
   a moment, not a piece of furniture: it belongs in the middle of the screen,
   once, with a way to put it down.

   Four things, in this order: who won, one line about what happens next, the
   Mi/Oni score card, and a single button that dismisses it. Behind it the
   room is already back in LOBBY with its seats and its "Spreman" switch, so
   there is nothing else for this dialog to offer.

   Not dismissable by clicking away — the result is the one thing that must be
   read — but the button is a plain dismiss: the room stays as it is and the
   same players can start again with the same seats.
   ────────────────────────────────────────────────────────────────────── */

export default function GameOverDialog({
    open,
    winner,
    score,
    myTeam,
    /** A spectator has no side, so the columns are named Tim A / Tim B. */
    spectator = false,
    onDismiss,
}: {
    open: boolean
    winner: Team | null
    score: Record<Team, number>
    myTeam: Team
    spectator?: boolean
    onDismiss: () => void
}) {
    const { t } = useTranslation()
    if (!winner) return null

    const theirTeam: Team = myTeam === "A" ? "B" : "A"
    const weWon = winner === myTeam
    const title = spectator
        ? t("game.over.finalScore")
        : weWon
          ? t("game.over.youWon")
          : t("game.over.youLost")

    return (
        <Dialog.Root
            open={open}
            placement="center"
            closeOnInteractOutside={false}
            onOpenChange={(e) => { if (!e.open) onDismiss() }}
        >
            <Portal>
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content maxW={{ base: "92%", md: "xs" }}>
                        <Dialog.Header pb="1">
                            <Dialog.Title>{title}</Dialog.Title>
                        </Dialog.Header>
                        <Dialog.Body>
                            <VStack gap="3" align="stretch">
                                <Text fontSize="sm" color="fg.muted">
                                    {t("game.over.description")}
                                </Text>
                                <HStack
                                    gap="0"
                                    justify="center"
                                    rounded="l2"
                                    borderWidth="1px"
                                    borderColor="border.subtle"
                                    bg="bg.subtle"
                                    py="2"
                                >
                                    <Side
                                        label={spectator ? t("game.score.teamA") : t("game.score.us")}
                                        value={score[myTeam]}
                                        won={weWon}
                                    />
                                    <Text fontSize="lg" color="fg.muted" px="2" aria-hidden="true">:</Text>
                                    <Side
                                        label={spectator ? t("game.score.teamB") : t("game.score.them")}
                                        value={score[theirTeam]}
                                        won={!weWon}
                                    />
                                </HStack>
                            </VStack>
                        </Dialog.Body>
                        <Dialog.Footer>
                            <Button colorPalette="brand" w="100%" onClick={onDismiss}>
                                {t("game.over.dismiss")}
                            </Button>
                        </Dialog.Footer>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Portal>
        </Dialog.Root>
    )
}

function Side({ label, value, won }: { label: string; value: number; won: boolean }) {
    return (
        <VStack gap="0" minW="72px">
            <Text fontSize="2xs" color="fg.muted" textTransform="uppercase" letterSpacing="widest">
                {label}
            </Text>
            <Text
                textStyle="mono"
                fontSize="3xl"
                lineHeight="1.1"
                fontWeight="bold"
                fontVariantNumeric="tabular-nums"
                color={won ? "brand.fg" : "fg"}
            >
                {value}
            </Text>
        </VStack>
    )
}
