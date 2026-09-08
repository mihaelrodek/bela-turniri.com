import { Button, Dialog, HStack, Portal, Text, VStack } from "@chakra-ui/react"
import { useTranslation } from "../../i18n"
import { useGamePrefs } from "../hooks/useGamePrefs"
import PlayingCard from "./PlayingCard"
import GameOption from "./GameOption"

export default function GameSettingsSheet({ open, onClose }: {
    open: boolean
    onClose: () => void
}) {
    const { t } = useTranslation()
    const [prefs, setPrefs] = useGamePrefs()
    return (
        <Dialog.Root open={open} onOpenChange={(e) => { if (!e.open) onClose() }} placement="center" scrollBehavior="inside">
            <Portal>
                <Dialog.Backdrop backdropFilter="blur(6px)" />
                <Dialog.Positioner>
                    <Dialog.Content maxW={{ base: "94%", md: "480px" }} rounded="2xl">
                        <Dialog.Header><Dialog.Title fontSize="2xl">{t("game.settings.title")}</Dialog.Title></Dialog.Header>
                        <Dialog.Body>
                            <VStack gap="3" align="stretch">
                                <GameOption label={t("game.settings.alwaysReady")} hint={t("game.settings.alwaysReadyHint")}
                                    checked={prefs.alwaysReady} onChange={(alwaysReady) => setPrefs({ alwaysReady })} />
                                <GameOption label={t("game.settings.sound")} checked={prefs.sound} onChange={(sound) => setPrefs({ sound })} />
                                <GameOption label={t("game.settings.reduceMotion")} checked={prefs.reduceMotion} onChange={(reduceMotion) => setPrefs({ reduceMotion })} />
                                <Text fontSize="sm" fontWeight="semibold" mt="3">{t("game.settings.deckType")}</Text>
                                <HStack gap="3" align="stretch">
                                    {(["madjarice", "francuske"] as const).map((deck) => (
                                        <Button key={deck} flex="1" h="auto" py="4" flexDirection="column" gap="3" colorPalette="brand"
                                            variant={prefs.deck === deck ? "subtle" : "outline"} aria-pressed={prefs.deck === deck} onClick={() => setPrefs({ deck })}>
                                            <PlayingCard card="JHERC" size="sm" deck={deck} />
                                            {t(`game.settings.deck.${deck}`)}
                                        </Button>
                                    ))}
                                </HStack>
                            </VStack>
                        </Dialog.Body>
                        <Dialog.Footer><Button colorPalette="brand" onClick={onClose}>{t("game.common.close")}</Button></Dialog.Footer>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Portal>
        </Dialog.Root>
    )
}
