import { useState } from "react"
import {
    Button,
    Dialog,
    HStack,
    IconButton,
    Image,
    Portal,
} from "@chakra-ui/react"
import { FiDownload } from "react-icons/fi"
import { useInstallPrompt } from "../hooks/useInstallPrompt"
import IosInstallSteps from "./IosInstallSteps"

/**
 * Compact icon-only install affordance. Renders a circular IconButton with
 * just the download glyph — no text label — so it tucks neatly between the
 * auth area and the color-mode toggle without bloating the navbar.
 *
 * Visibility:
 *   - the app is not yet installed (display-mode != standalone), AND
 *   - either the browser fired beforeinstallprompt (Chrome / Edge / Android),
 *     OR we're on iOS Safari (no API available — show step instructions).
 *
 * On all other browsers (already installed, or Firefox desktop, etc.) it
 * renders nothing, so the parent layout is unaffected. The aria-label and
 * native `title` give the icon a name for screen readers and a hover
 * tooltip for sighted desktop users.
 *
 * iOS path opens a dialog with the shared IosInstallSteps walkthrough,
 * which is the same component the FirstRunInstallPrompt uses inline —
 * one source of truth for the Croatian Share-menu copy.
 */
export function InstallAppButton({
    size = "sm",
}: {
    size?: "xs" | "sm" | "md"
}) {
    const { canInstall, isIos, install } = useInstallPrompt()
    const [iosOpen, setIosOpen] = useState(false)

    if (!canInstall && !isIos) return null

    const label = isIos ? "Instaliraj na iPhone" : "Instaliraj aplikaciju"

    function handleClick() {
        if (canInstall) {
            install().catch(() => {
                /* user dismissed or browser refused — no-op */
            })
        } else {
            // iOS path. Open the steps dialog. We don't gate this on isIos
            // because the early-return above already guarantees that one of
            // the two conditions is true.
            setIosOpen(true)
        }
    }

    return (
        <>
            <IconButton
                aria-label={label}
                title={label}
                size={size}
                variant="outline"
                rounded="full"
                colorPalette="blue"
                onClick={handleClick}
            >
                <FiDownload />
            </IconButton>
            <Dialog.Root
                open={iosOpen}
                onOpenChange={(e) => {
                    if (!e.open) setIosOpen(false)
                }}
                placement="center"
                motionPreset="slide-in-bottom"
            >
                <Portal>
                    <Dialog.Backdrop />
                    <Dialog.Positioner>
                        <Dialog.Content maxW={{ base: "92%", md: "md" }}>
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
                                <IosInstallSteps />
                            </Dialog.Body>
                            <Dialog.Footer>
                                <Button variant="ghost" onClick={() => setIosOpen(false)}>
                                    Zatvori
                                </Button>
                            </Dialog.Footer>
                        </Dialog.Content>
                    </Dialog.Positioner>
                </Portal>
            </Dialog.Root>
        </>
    )
}
