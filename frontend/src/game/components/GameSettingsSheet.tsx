/* ──────────────────────────────────────────────────────────────────────────
   GameSettingsSheet — zvuk / smanji animacije / vrsta karata
   (game/DESIGN.md §2.10). STUB: the settings agent implements the body; the
   table renders <GameSettingsSheet open onClose /> behind a gear button.
   ────────────────────────────────────────────────────────────────────── */

import { Box, Button, Dialog, HStack, Portal, Switch, Text, VStack } from "@chakra-ui/react"
import { useTranslation } from "../../i18n"
import { useGamePrefs } from "../hooks/useGamePrefs"
import PlayingCard from "./PlayingCard"

export default function GameSettingsSheet(props: { open: boolean; onClose: () => void }) {
    const { t } = useTranslation()
    const [prefs, setPrefs] = useGamePrefs()

    return (
        <Dialog.Root open={props.open} onOpenChange={(e) => { if (!e.open) props.onClose() }} placement="center">
            <Portal>
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content maxW={{ base: "92%", md: "sm" }}>
                        <Dialog.Header>
                            <Dialog.Title fontSize="md">{t("game.settings.title")}</Dialog.Title>
                        </Dialog.Header>
                        <Dialog.Body>
                            <VStack gap="6" align="stretch">
                                {/* Zvuk switch */}
                                <HStack justify="space-between" align="center">
                                    <Text fontSize="sm" fontWeight="500">{t("game.settings.sound")}</Text>
                                    <Switch.Root
                                        checked={prefs.sound}
                                        onCheckedChange={(e) => setPrefs({ sound: e.checked })}
                                        colorPalette="brand"
                                        size="md"
                                    >
                                        <Switch.HiddenInput />
                                        <Switch.Control>
                                            <Switch.Thumb />
                                        </Switch.Control>
                                    </Switch.Root>
                                </HStack>

                                {/* Smanji animacije switch */}
                                <VStack gap="2" align="stretch">
                                    <HStack justify="space-between" align="center">
                                        <Text fontSize="sm" fontWeight="500">{t("game.settings.reduceMotion")}</Text>
                                        <Switch.Root
                                            checked={prefs.reduceMotion}
                                            onCheckedChange={(e) => setPrefs({ reduceMotion: e.checked })}
                                            colorPalette="brand"
                                            size="md"
                                        >
                                            <Switch.HiddenInput />
                                            <Switch.Control>
                                                <Switch.Thumb />
                                            </Switch.Control>
                                        </Switch.Root>
                                    </HStack>
                                    <Text fontSize="xs" color="fg.muted">{t("game.settings.reduceMotionHint")}</Text>
                                </VStack>

                                {/* Vrsta karata selector */}
                                <VStack gap="3" align="stretch">
                                    <Text fontSize="sm" fontWeight="500">{t("game.settings.deckType")}</Text>
                                    <HStack gap="3" role="radiogroup" align="stretch">
                                        {(["madjarice", "francuske"] as const).map((deck) => (
                                            <DeckOption
                                                key={deck}
                                                label={t(`game.settings.deck.${deck}`)}
                                                isSelected={prefs.deck === deck}
                                                isRecommended={deck === "madjarice"}
                                                onSelect={() => setPrefs({ deck })}
                                            />
                                        ))}
                                    </HStack>
                                </VStack>
                            </VStack>
                        </Dialog.Body>
                        <Dialog.Footer>
                            <Button variant="ghost" onClick={props.onClose}>
                                {t("game.common.close")}
                            </Button>
                        </Dialog.Footer>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Portal>
        </Dialog.Root>
    )
}

function DeckOption({
    label,
    isSelected,
    isRecommended,
    onSelect,
}: {
    label: string
    isSelected: boolean
    isRecommended: boolean
    onSelect: () => void
}) {
    const { t } = useTranslation()

    return (
        <Box
            as="button"
            flex="1"
            role="radio"
            aria-checked={isSelected}
            onClick={onSelect}
            p="3"
            rounded="md"
            borderWidth="2px"
            borderColor={isSelected ? "brand.500" : "border.subtle"}
            bg={isSelected ? "bg.muted" : "bg.subtle"}
            transition="all 0.2s"
            _hover={{ borderColor: "brand.500", bg: "bg.muted" }}
            cursor="pointer"
            display="flex"
            flexDirection="column"
            alignItems="center"
            gap="2"
        >
            {isRecommended && (
                <Text fontSize="xs" fontWeight="600" color="brand.500" textTransform="uppercase">
                    {t("game.settings.recommended")}
                </Text>
            )}
            <Box h="16" display="flex" alignItems="center" justifyContent="center">
                <PlayingCard card="JHERC" size="sm" />
            </Box>
            <Text fontSize="sm" fontWeight="500">{label}</Text>
        </Box>
    )
}
