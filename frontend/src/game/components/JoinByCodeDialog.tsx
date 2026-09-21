import { useCallback, useEffect, useRef, useState } from "react"
import { Box, Dialog, Grid, HStack, IconButton, Portal, SimpleGrid, Text, VisuallyHidden, VStack } from "@chakra-ui/react"
import { keyframes } from "@emotion/react"
import { FiDelete, FiX } from "react-icons/fi"
import { useTranslation } from "../../i18n"
import { useGamePrefs } from "../hooks/useGamePrefs"
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion"
import { playHaptic } from "../util/haptics"
import type { GameError } from "../types"

/* ──────────────────────────────────────────────────────────────────────────
   JoinByCodeDialog — "Pridruži se šifrom" (game/DESIGN.md §1 "Lobby").

   A custom 4-digit dial pad, not a native numeric input (2026-09-20, user
   report): on an iPhone PWA the system keyboard + its accessory bar cover the
   field the instant it opens, so nobody can actually see what they typed. A
   dial pad of real `<button>`s never triggers that keyboard at all — the
   digit boxes and keys ARE the input, `inputMode`/`pattern` are gone because
   there is no focusable text field to carry them.

   Still autosubmits the moment the 4th digit lands: nobody wants to also hunt
   for a "Go" button after typing a code someone read out loud to them. See
   `game/DESIGN.md`'s "Šifra sobe — biračka tipkovnica" section for the full
   rationale and the desktop keyboard/paste support this also carries.
   ────────────────────────────────────────────────────────────────────── */

const CODE_LENGTH = 4

/** Plays once per rejection — `key={shakeNonce}` on the wrapper below remounts
 *  the node so the animation restarts even on the SAME wrong code twice in a
 *  row (repeating the keyframe name alone would not replay a finished one). */
const SHAKE = keyframes({
    "0%, 100%": { transform: "translateX(0)" },
    "20%": { transform: "translateX(-10px)" },
    "40%": { transform: "translateX(8px)" },
    "60%": { transform: "translateX(-6px)" },
    "80%": { transform: "translateX(4px)" },
})

type PadKey =
    | { kind: "digit"; value: string }
    | { kind: "clear" }
    | { kind: "backspace" }

const PAD_KEYS: PadKey[] = [
    { kind: "digit", value: "1" }, { kind: "digit", value: "2" }, { kind: "digit", value: "3" },
    { kind: "digit", value: "4" }, { kind: "digit", value: "5" }, { kind: "digit", value: "6" },
    { kind: "digit", value: "7" }, { kind: "digit", value: "8" }, { kind: "digit", value: "9" },
    { kind: "clear" }, { kind: "digit", value: "0" }, { kind: "backspace" },
]

export default function JoinByCodeDialog({
    open,
    roomName,
    error,
    onOpenChange,
    onSubmit,
}: {
    open: boolean
    roomName?: string
    /**
     * The socket's current error, whatever it last was. The dialog only
     * reacts when it is BOTH open and the error is stamped
     * `ref: "room.joinByCode"` — the server's answer to a code this dialog
     * itself just sent (`game.error.ROOM_NOT_FOUND` for a code nobody holds,
     * `WIN_RATE_TOO_LOW` / `ROOM_FULL` / `SPECTATORS_DISABLED` for one that
     * resolves to a room this account cannot enter). Any of those clears the
     * digits and shakes the pad so the player can just try again; the host
     * page still owns showing the toast and calling `clearError()`.
     */
    error?: GameError | null
    onOpenChange: (open: boolean) => void
    /** Called once, the moment the 4th digit is entered (or completed by
     *  paste / Enter). */
    onSubmit: (code: string) => void
}) {
    const { t } = useTranslation()
    const [code, setCode] = useState("")
    const [shakeNonce, setShakeNonce] = useState(0)
    const submittedRef = useRef(false)
    const handledErrorRef = useRef<GameError | null | undefined>(null)
    const osReducedMotion = usePrefersReducedMotion()
    const [gamePrefs] = useGamePrefs()
    const reduceMotion = osReducedMotion || gamePrefs.reduceMotion

    useEffect(() => {
        if (!open) {
            setCode("")
            submittedRef.current = false
            handledErrorRef.current = null
        }
    }, [open])

    // Autosubmit the instant the code is complete — from a tap, a hardware
    // digit, or a paste, all of which only ever go through `setCode`.
    useEffect(() => {
        if (code.length !== CODE_LENGTH || submittedRef.current) return
        submittedRef.current = true
        onSubmit(code)
    }, [code, onSubmit])

    // A refusal of OUR code: clear the digits and shake, once per error
    // object (a re-render with the same still-unconsumed error — e.g. the
    // host page has not yet run its own `clearError()` — must not wipe
    // digits the player has since started retyping).
    useEffect(() => {
        if (!open || !error || error.ref !== "room.joinByCode") return
        if (handledErrorRef.current === error) return
        handledErrorRef.current = error
        setCode("")
        submittedRef.current = false
        if (!reduceMotion) setShakeNonce((n) => n + 1)
    }, [open, error, reduceMotion])

    const appendDigit = useCallback((digit: string) => {
        setCode((prev) => {
            if (prev.length >= CODE_LENGTH) return prev
            submittedRef.current = false
            return prev + digit
        })
        playHaptic("keyTap")
    }, [])

    const backspace = useCallback(() => {
        setCode((prev) => {
            if (prev.length === 0) return prev
            submittedRef.current = false
            return prev.slice(0, -1)
        })
        playHaptic("keyTap")
    }, [])

    const clearAll = useCallback(() => {
        submittedRef.current = false
        setCode((prev) => (prev.length === 0 ? prev : ""))
        playHaptic("keyTap")
    }, [])

    // Desktop hardware keyboard + paste, while the dialog is open. There is
    // deliberately no focusable text field to attach this to — the digit
    // boxes are display-only — so it listens on `document` instead.
    useEffect(() => {
        if (!open) return

        function onKeyDown(e: KeyboardEvent) {
            if (e.ctrlKey || e.metaKey || e.altKey) return
            if (e.key >= "0" && e.key <= "9") {
                e.preventDefault()
                appendDigit(e.key)
                return
            }
            if (e.key === "Backspace") {
                e.preventDefault()
                backspace()
                return
            }
            if (e.key === "Escape") {
                e.preventDefault()
                onOpenChange(false)
                return
            }
            if (e.key === "Enter") {
                e.preventDefault()
                setCode((prev) => {
                    if (prev.length === CODE_LENGTH && !submittedRef.current) {
                        submittedRef.current = true
                        onSubmit(prev)
                    }
                    return prev
                })
            }
        }

        function onPaste(e: ClipboardEvent) {
            const digits = (e.clipboardData?.getData("text") ?? "").replace(/\D/g, "").slice(0, CODE_LENGTH)
            if (!digits) return
            e.preventDefault()
            submittedRef.current = false
            setCode(digits)
        }

        document.addEventListener("keydown", onKeyDown)
        document.addEventListener("paste", onPaste)
        return () => {
            document.removeEventListener("keydown", onKeyDown)
            document.removeEventListener("paste", onPaste)
        }
    }, [open, appendDigit, backspace, onOpenChange, onSubmit])

    const digitsAria = t("game.lobby.joinByCode.enteredAria", { count: code.length, total: CODE_LENGTH })

    return (
        <Dialog.Root
            open={open}
            onOpenChange={(e) => onOpenChange(e.open)}
            placement={{ base: "bottom", md: "center" }}
            motionPreset={{ base: "slide-in-bottom", md: "scale" }}
        >
            <Portal>
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content
                        maxW={{ base: "100%", md: "380px" }}
                        w={{ base: "100%", md: "380px" }}
                        m={{ base: "0", md: "auto" }}
                        roundedTop={{ base: "2xl", md: "2xl" }}
                        roundedBottom={{ base: "0", md: "2xl" }}
                        pb={{ base: "calc(14px + var(--safe-bottom))", md: "5" }}
                    >
                        <Dialog.Header>
                            <HStack justify="space-between" align="flex-start" w="full" gap="3">
                                <Dialog.Title>{roomName
                                    ? t("game.lobby.joinByCode.privateTitle", { name: roomName })
                                    : t("game.lobby.joinByCode.title")}</Dialog.Title>
                                <Dialog.CloseTrigger asChild>
                                    <IconButton aria-label={t("common.close")} variant="ghost" size="sm" flexShrink={0}>
                                        <FiX />
                                    </IconButton>
                                </Dialog.CloseTrigger>
                            </HStack>
                        </Dialog.Header>
                        <Dialog.Body pt="0">
                            <VStack gap="5" align="stretch">
                                <Text fontSize="sm" color="fg.muted">
                                    {t(roomName ? "game.lobby.joinByCode.privateDescription" : "game.lobby.joinByCode.description")}
                                </Text>

                                <Box key={shakeNonce} animation={shakeNonce > 0 ? `${SHAKE} 400ms ease-in-out` : undefined}>
                                    <Grid
                                        templateColumns={`repeat(${CODE_LENGTH}, 1fr)`}
                                        gap={{ base: "2.5", md: "3" }}
                                        role="group"
                                        aria-label={t("game.lobby.joinByCode.codeAria")}
                                    >
                                        {Array.from({ length: CODE_LENGTH }).map((_, i) => {
                                            const filled = i < code.length
                                            return (
                                                <Box
                                                    key={i}
                                                    aspectRatio="1"
                                                    display="flex"
                                                    alignItems="center"
                                                    justifyContent="center"
                                                    rounded="l2"
                                                    borderWidth="2px"
                                                    borderColor={filled ? "brand.400" : "border.subtle"}
                                                    bg="bg.subtle"
                                                    fontSize="3xl"
                                                    fontWeight="bold"
                                                    color={filled ? "fg.ink" : "fg.subtle"}
                                                    opacity={filled ? 1 : 0.4}
                                                >
                                                    {filled ? code[i] : "0"}
                                                </Box>
                                            )
                                        })}
                                    </Grid>
                                </Box>
                                <VisuallyHidden aria-live="polite">{digitsAria}</VisuallyHidden>

                                <SimpleGrid columns={3} gap={{ base: "2.5", md: "3" }}>
                                    {PAD_KEYS.map((key, i) => {
                                        if (key.kind === "digit") {
                                            return (
                                                <IconButton
                                                    key={i}
                                                    aria-label={key.value}
                                                    variant="outline"
                                                    minH="14"
                                                    h="14"
                                                    fontSize="2xl"
                                                    fontWeight="bold"
                                                    rounded="l2"
                                                    css={{ touchAction: "manipulation", userSelect: "none", WebkitTouchCallout: "none" }}
                                                    onClick={() => appendDigit(key.value)}
                                                >
                                                    {key.value}
                                                </IconButton>
                                            )
                                        }
                                        if (key.kind === "clear") {
                                            return (
                                                <IconButton
                                                    key={i}
                                                    aria-label={t("game.lobby.joinByCode.clearAria")}
                                                    variant="ghost"
                                                    color="fg.muted"
                                                    minH="14"
                                                    h="14"
                                                    fontSize="lg"
                                                    rounded="l2"
                                                    css={{ touchAction: "manipulation", userSelect: "none", WebkitTouchCallout: "none" }}
                                                    disabled={code.length === 0}
                                                    onClick={clearAll}
                                                >
                                                    <FiX />
                                                </IconButton>
                                            )
                                        }
                                        return (
                                            <IconButton
                                                key={i}
                                                aria-label={t("game.lobby.joinByCode.backspaceAria")}
                                                variant="ghost"
                                                color="fg.muted"
                                                minH="14"
                                                h="14"
                                                fontSize="lg"
                                                rounded="l2"
                                                css={{ touchAction: "manipulation", userSelect: "none", WebkitTouchCallout: "none" }}
                                                disabled={code.length === 0}
                                                onClick={backspace}
                                            >
                                                <FiDelete />
                                            </IconButton>
                                        )
                                    })}
                                </SimpleGrid>
                            </VStack>
                        </Dialog.Body>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Portal>
        </Dialog.Root>
    )
}
