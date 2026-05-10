import { useState } from "react"
import {
    Box,
    Button,
    Dialog,
    HStack,
    Image,
    Portal,
    Text,
    VStack,
} from "@chakra-ui/react"
import { FiDownload, FiShare, FiPlusSquare } from "react-icons/fi"
import { useInstallPrompt } from "../hooks/useInstallPrompt"

/**
 * Renders an "Instaliraj aplikaciju" button when:
 *   - the app is not yet installed (display-mode != standalone), AND
 *   - either the browser fired beforeinstallprompt (Chrome / Edge / Android),
 *     OR we're on iOS Safari (no API available — show step instructions).
 *
 * On all other browsers (already installed, or Firefox desktop, etc.) it
 * renders nothing, so the parent layout is unaffected.
 *
 * Pass `variant="solid"` to make the button stand out (used in the mobile
 * menu where space is generous); the default ghost variant blends quietly
 * into a NavBar.
 */
export function InstallAppButton({
    size = "sm",
    variant = "ghost",
    fullWidth = false,
}: {
    size?: "xs" | "sm" | "md"
    variant?: "ghost" | "solid" | "outline"
    fullWidth?: boolean
}) {
    const { canInstall, isIos, install } = useInstallPrompt()
    const [iosOpen, setIosOpen] = useState(false)

    if (!canInstall && !isIos) return null

    if (canInstall) {
        return (
            <Button
                size={size}
                variant={variant}
                colorPalette="blue"
                width={fullWidth ? "full" : undefined}
                onClick={() => install()}
            >
                <FiDownload /> Instaliraj aplikaciju
            </Button>
        )
    }

    // iOS Safari path — open a small dialog with the manual share-menu steps.
    return (
        <>
            <Button
                size={size}
                variant={variant}
                colorPalette="blue"
                width={fullWidth ? "full" : undefined}
                onClick={() => setIosOpen(true)}
            >
                <FiDownload /> Instaliraj na iPhone
            </Button>
            <IosInstallDialog open={iosOpen} onClose={() => setIosOpen(false)} />
        </>
    )
}

/** Step-by-step instructions for iOS Safari users. */
function IosInstallDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
    return (
        <Dialog.Root
            open={open}
            onOpenChange={(e) => {
                if (!e.open) onClose()
            }}
            placement="center"
            motionPreset="slide-in-bottom"
        >
            <Portal>
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content>
                        <Dialog.Header>
                            <HStack gap="2" align="center">
                                <Image
                                    src="/bela-turniri-symbol.svg"
                                    alt=""
                                    h="28px"
                                    w="auto"
                                />
                                <Dialog.Title>Instaliraj Bela Turniri</Dialog.Title>
                            </HStack>
                        </Dialog.Header>
                        <Dialog.Body>
                            <VStack align="stretch" gap="3">
                                <Text fontSize="sm" color="fg.muted">
                                    Otvori stranicu u Safari pregledniku, a zatim:
                                </Text>
                                <HStack align="start" gap="3">
                                    <Box
                                        minW="28px"
                                        h="28px"
                                        rounded="full"
                                        bg="blue.subtle"
                                        color="blue.fg"
                                        display="flex"
                                        alignItems="center"
                                        justifyContent="center"
                                        fontWeight="bold"
                                        fontSize="sm"
                                    >
                                        1
                                    </Box>
                                    <Text fontSize="sm">
                                        Klikni ikonu <Box as="span" display="inline-flex" alignItems="center"><FiShare /></Box>{" "}
                                        <strong>Podijeli</strong> u donjem dijelu Safarija.
                                    </Text>
                                </HStack>
                                <HStack align="start" gap="3">
                                    <Box
                                        minW="28px"
                                        h="28px"
                                        rounded="full"
                                        bg="blue.subtle"
                                        color="blue.fg"
                                        display="flex"
                                        alignItems="center"
                                        justifyContent="center"
                                        fontWeight="bold"
                                        fontSize="sm"
                                    >
                                        2
                                    </Box>
                                    <Text fontSize="sm">
                                        Pomakni se i odaberi{" "}
                                        <Box as="span" display="inline-flex" alignItems="center"><FiPlusSquare /></Box>{" "}
                                        <strong>Dodaj na početni zaslon</strong>.
                                    </Text>
                                </HStack>
                                <HStack align="start" gap="3">
                                    <Box
                                        minW="28px"
                                        h="28px"
                                        rounded="full"
                                        bg="blue.subtle"
                                        color="blue.fg"
                                        display="flex"
                                        alignItems="center"
                                        justifyContent="center"
                                        fontWeight="bold"
                                        fontSize="sm"
                                    >
                                        3
                                    </Box>
                                    <Text fontSize="sm">
                                        Potvrdi <strong>Dodaj</strong> u gornjem desnom kutu.
                                    </Text>
                                </HStack>
                                <Text fontSize="xs" color="fg.muted" pt="2">
                                    Nakon dodavanja, ikona aplikacije će se pojaviti na tvojem
                                    početnom zaslonu i otvarati će se kao samostalna aplikacija.
                                </Text>
                            </VStack>
                        </Dialog.Body>
                        <Dialog.Footer>
                            <Button variant="ghost" onClick={onClose}>
                                Zatvori
                            </Button>
                        </Dialog.Footer>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Portal>
        </Dialog.Root>
    )
}
