import { useEffect, useState } from "react"
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
import { FiDownload, FiX } from "react-icons/fi"
import { useInstallPrompt } from "../hooks/useInstallPrompt"

/**
 * One-time coach mark that nudges first-time visitors toward the install
 * flow. Renders a slide-up dialog at the bottom of the screen with the logo,
 * a short blurb, and a primary "Instaliraj" action that fires the same
 * install flow as the navbar button.
 *
 * Visibility rules — all must hold for the dialog to appear:
 *   1. App is not already installed (display-mode != standalone).
 *   2. The browser is install-capable (Chrome/Edge/Android fired
 *      beforeinstallprompt) OR we're on iOS Safari (instructions path).
 *   3. The user hasn't dismissed the hint before (localStorage flag).
 *
 * It auto-shows after a short delay so the SPA has time to paint and the
 * beforeinstallprompt event has time to fire — opening it instantly feels
 * jarring and risks the prompt not being captured yet.
 */

const STORAGE_KEY = "bela:install-hint-dismissed"
const SHOW_AFTER_MS = 1500

/** localStorage helpers, defensive against SSR / private mode quirks. */
function readDismissed(): boolean {
    try {
        return window.localStorage.getItem(STORAGE_KEY) === "1"
    } catch {
        return false
    }
}
function persistDismissed() {
    try {
        window.localStorage.setItem(STORAGE_KEY, "1")
    } catch {
        /* private mode / quota — non-fatal, hint just shows again next visit */
    }
}

export default function FirstRunInstallPrompt() {
    const { canInstall, isIos, installed, install } = useInstallPrompt()
    const [open, setOpen] = useState(false)
    const [dismissed, setDismissed] = useState<boolean>(() => readDismissed())

    // Open the dialog once the page settles and the install prompt is ready.
    // Re-runs whenever canInstall flips true (Chrome may fire the event a
    // few seconds after first paint), so the hint shows on the same visit
    // even if React mounted before the browser decided we're installable.
    useEffect(() => {
        if (dismissed) return
        if (installed) return
        if (!canInstall && !isIos) return
        const id = window.setTimeout(() => setOpen(true), SHOW_AFTER_MS)
        return () => window.clearTimeout(id)
    }, [dismissed, installed, canInstall, isIos])

    function dismiss() {
        setOpen(false)
        setDismissed(true)
        persistDismissed()
    }

    async function onInstallClick() {
        // For canInstall, fire the native prompt directly. For iOS, the
        // navbar's InstallAppButton already owns the instructions dialog —
        // we just close the hint and rely on the user clicking that button.
        if (canInstall) {
            await install().catch(() => {
                /* user dismissed or browser refused — close anyway */
            })
        }
        // Either way, this hint has done its job.
        dismiss()
    }

    if (dismissed || installed) return null
    if (!canInstall && !isIos) return null

    return (
        <Dialog.Root
            open={open}
            onOpenChange={(e) => {
                if (!e.open) dismiss()
            }}
            placement="bottom"
            motionPreset="slide-in-bottom"
        >
            <Portal>
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content maxW={{ base: "100%", md: "md" }}>
                        <Dialog.Body py="5" px={{ base: "4", md: "6" }}>
                            <VStack align="stretch" gap="4">
                                <HStack gap="3" align="center">
                                    <Image
                                        src="/bela-turniri-symbol.svg"
                                        alt=""
                                        h="56px"
                                        w="auto"
                                        flexShrink={0}
                                    />
                                    <Box flex="1">
                                        <Text fontWeight="semibold" fontSize="md">
                                            Instaliraj ovdje
                                        </Text>
                                        <Text fontSize="sm" color="fg.muted">
                                            {isIos
                                                ? "Dodaj Bela Turniri na svoj iPhone — otvara se kao samostalna aplikacija."
                                                : "Spremi Bela Turniri kao aplikaciju i otvori je jednim klikom s početnog zaslona."}
                                        </Text>
                                    </Box>
                                </HStack>

                                <HStack gap="2" justify="flex-end" wrap="wrap">
                                    <Button variant="ghost" size="sm" onClick={dismiss}>
                                        <FiX /> Možda kasnije
                                    </Button>
                                    <Button
                                        variant="solid"
                                        colorPalette="blue"
                                        size="sm"
                                        onClick={onInstallClick}
                                    >
                                        <FiDownload />
                                        {isIos ? " Pokaži upute" : " Instaliraj"}
                                    </Button>
                                </HStack>

                                {/* On iOS we can't trigger the install programmatically.
                                    The "Pokaži upute" button just closes this hint and
                                    points the user at the navbar button, which has the
                                    detailed Share-menu walkthrough. */}
                                {isIos && (
                                    <Text fontSize="xs" color="fg.muted">
                                        Klikni gumb <strong>Instaliraj na iPhone</strong> u izborniku
                                        na vrhu stranice za detaljne upute.
                                    </Text>
                                )}
                            </VStack>
                        </Dialog.Body>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Portal>
        </Dialog.Root>
    )
}
