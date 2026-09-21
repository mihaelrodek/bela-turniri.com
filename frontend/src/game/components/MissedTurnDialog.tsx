import { Button, Dialog, Portal, Text, VStack } from "@chakra-ui/react"
import { useTranslation } from "../../i18n"
import { GLASS_STRONG, INK } from "./tableStyles"

/* ──────────────────────────────────────────────────────────────────────────
   MissedTurnDialog — shown when the turn timer ran out and the server's bot
   played one move for me. Informs the player and returns them to the game.
   ────────────────────────────────────────────────────────────────────────── */

export default function MissedTurnDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { t } = useTranslation()

    return (
        <Dialog.Root
            open={open}
            onOpenChange={(e: { open: boolean }) => {
                if (!e.open) onClose()
            }}
            placement="center"
        >
            <Portal>
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content
                        maxW="360px"
                        {...GLASS_STRONG}
                        rounded="l3"
                        boxShadow="0 18px 40px rgba(0,0,0,0.55)"
                    >
                        <Dialog.Header fontSize="lg" fontFamily="heading" fontWeight="bold" color={INK} textAlign="center" px="3" py="2.5">
                            {t("game.missedTurn.title")}
                        </Dialog.Header>
                        <Dialog.Body px="3" pb="3">
                            <VStack gap="3" align="stretch">
                                <Text fontSize="sm" color="fg.muted" textAlign="center" lineHeight="1.5">
                                    {t("game.missedTurn.body")}
                                </Text>
                                <Button
                                    w="100%"
                                    h="46px"
                                    variant="outline"
                                    rounded="l2"
                                    bg="brand.subtle"
                                    color={INK}
                                    borderColor="brand.300"
                                    _hover={{ bg: "bg.muted" }}
                                    _active={{ bg: "brand.500" }}
                                    onClick={onClose}
                                >
                                    {t("game.missedTurn.back")}
                                </Button>
                            </VStack>
                        </Dialog.Body>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Portal>
        </Dialog.Root>
    )
}
