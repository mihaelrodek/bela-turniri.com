import { useState } from "react"
import { Button, Dialog, Portal, Switch, Text, VStack } from "@chakra-ui/react"
import type { TargetScore } from "@bela/protocol"
import { useTranslation } from "../../i18n"

/* ──────────────────────────────────────────────────────────────────────────
   CreateGameDialog — bela.fun's "Do koliko se igra?" modal (game/DESIGN.md
   §1 "Lobby"). No name field: the server auto-generates a two-word Croatian
   room name when `room.create.name` is absent, and picking a target creates
   the room immediately — there is no separate "confirm" step.
   ────────────────────────────────────────────────────────────────────── */

const TARGETS: readonly TargetScore[] = [501, 701, 1001]

export default function CreateGameDialog({
    open,
    onOpenChange,
    onCreate,
    busy = false,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** Fires immediately when a target is picked — the room is created right away. */
    onCreate: (targetScore: TargetScore, isPrivate: boolean) => void
    busy?: boolean
}) {
    const { t } = useTranslation()
    const [isPrivate, setIsPrivate] = useState(false)

    return (
        <Dialog.Root
            open={open}
            onOpenChange={(e) => {
                if (!e.open) setIsPrivate(false)
                onOpenChange(e.open)
            }}
            placement="center"
        >
            <Portal>
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content maxW={{ base: "92%", md: "sm" }}>
                        <Dialog.Header>
                            <Dialog.Title>{t("game.lobby.create.title")}</Dialog.Title>
                        </Dialog.Header>
                        <Dialog.Body>
                            <VStack gap="4" align="stretch">
                                <VStack gap="2" align="stretch">
                                    {TARGETS.map((target) => (
                                        <Button
                                            key={target}
                                            size="xl"
                                            h="16"
                                            fontSize="xl"
                                            colorPalette="brand"
                                            variant="solid"
                                            disabled={busy}
                                            aria-label={t("game.lobby.create.targetAria", { target })}
                                            onClick={() => onCreate(target, isPrivate)}
                                        >
                                            {target}
                                        </Button>
                                    ))}
                                </VStack>

                                <Switch.Root
                                    checked={isPrivate}
                                    onCheckedChange={(e) => setIsPrivate(e.checked)}
                                    colorPalette="brand"
                                >
                                    <Switch.HiddenInput />
                                    <Switch.Control>
                                        <Switch.Thumb />
                                    </Switch.Control>
                                    <Switch.Label>{t("game.lobby.create.private")}</Switch.Label>
                                </Switch.Root>
                                <Text fontSize="xs" color="fg.muted">
                                    {t("game.lobby.form.privateHint")}
                                </Text>
                            </VStack>
                        </Dialog.Body>
                        <Dialog.Footer>
                            <Button variant="ghost" onClick={() => onOpenChange(false)}>
                                {t("game.common.cancel")}
                            </Button>
                        </Dialog.Footer>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Portal>
        </Dialog.Root>
    )
}
