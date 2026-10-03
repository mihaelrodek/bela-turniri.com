import { Button, Dialog, Portal, Text, VStack } from "@chakra-ui/react"
import { useTranslation } from "../../i18n"

/* ──────────────────────────────────────────────────────────────────────────
   LearnPromptDialog — "Znaš li kartati belu?" (2026-09-29, owner request).

   Asked ONCE per identity on this browser, in the lobby: a guest right after
   the name-and-face step, a signed-in player on their first visit. The
   lobby decides when (`GameLobbyPage`); the answer is kept by
   `learnStorage.ts`.

   It cannot be dismissed without answering — no ✕, no click-away, no
   Escape. Both answers are one tap and neither is a commitment: "Znam"
   closes it for good, and the tutorial stays in the game settings either
   way.
   ────────────────────────────────────────────────────────────────────── */

export default function LearnPromptDialog({ open, onKnows, onLearn }: {
    open: boolean
    onKnows: () => void
    onLearn: () => void
}) {
    const { t } = useTranslation()
    return (
        <Dialog.Root open={open} placement="center" closeOnInteractOutside={false} closeOnEscape={false}>
            <Portal>
                <Dialog.Backdrop backdropFilter="blur(6px)" />
                <Dialog.Positioner>
                    <Dialog.Content maxW={{ base: "92%", md: "420px" }} rounded="2xl">
                        <Dialog.Header>
                            <Dialog.Title fontSize="2xl" fontFamily="heading">{t("game.learn.prompt.title")}</Dialog.Title>
                        </Dialog.Header>
                        <Dialog.Body>
                            <VStack align="stretch" gap="4">
                                <Text color="fg.muted">{t("game.learn.prompt.body")}</Text>
                                <VStack align="stretch" gap="2">
                                    <Button size="lg" colorPalette="brand" onClick={onLearn}>
                                        {t("game.learn.prompt.learn")}
                                    </Button>
                                    <Button size="lg" variant="outline" onClick={onKnows}>
                                        {t("game.learn.prompt.knows")}
                                    </Button>
                                </VStack>
                                <Text fontSize="xs" color="fg.subtle" textAlign="center">{t("game.learn.prompt.later")}</Text>
                            </VStack>
                        </Dialog.Body>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Portal>
        </Dialog.Root>
    )
}
