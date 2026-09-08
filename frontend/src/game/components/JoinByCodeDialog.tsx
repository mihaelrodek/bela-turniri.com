import { useEffect, useRef, useState } from "react"
import { Dialog, Field, Input, Portal, Text, VStack } from "@chakra-ui/react"
import { useTranslation } from "../../i18n"

/* ──────────────────────────────────────────────────────────────────────────
   JoinByCodeDialog — "Pridruži se šifrom" (game/DESIGN.md §1 "Lobby").

   A single 4-digit numeric field that autosubmits: nobody wants to also hunt
   for a "Go" button after typing a code someone read out loud to them.
   ────────────────────────────────────────────────────────────────────── */

const CODE_LENGTH = 4

export default function JoinByCodeDialog({
    open,
    roomName,
    onOpenChange,
    onSubmit,
}: {
    open: boolean
    roomName?: string
    onOpenChange: (open: boolean) => void
    /** Called once, the moment the 4th digit is entered. */
    onSubmit: (code: string) => void
}) {
    const { t } = useTranslation()
    const [code, setCode] = useState("")
    const submittedRef = useRef(false)

    useEffect(() => {
        if (!open) {
            setCode("")
            submittedRef.current = false
        }
    }, [open])

    useEffect(() => {
        if (code.length !== CODE_LENGTH || submittedRef.current) return
        submittedRef.current = true
        onSubmit(code)
    }, [code, onSubmit])

    return (
        <Dialog.Root open={open} onOpenChange={(e) => onOpenChange(e.open)} placement="center">
            <Portal>
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content maxW={{ base: "92%", md: "sm" }}>
                        <Dialog.Header>
                            <Dialog.Title>{roomName
                                ? t("game.lobby.joinByCode.privateTitle", { name: roomName })
                                : t("game.lobby.joinByCode.title")}</Dialog.Title>
                        </Dialog.Header>
                        <Dialog.Body>
                            <VStack gap="3" align="stretch">
                                <Text fontSize="sm" color="fg.muted">
                                    {t(roomName ? "game.lobby.joinByCode.privateDescription" : "game.lobby.joinByCode.description")}
                                </Text>
                                <Field.Root>
                                    <Field.Label>{t("game.lobby.joinByCode.codeLabel")}</Field.Label>
                                    <Input
                                        value={code}
                                        onChange={(e) => {
                                            submittedRef.current = false
                                            setCode(e.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH))
                                        }}
                                        inputMode="numeric"
                                        autoComplete="off"
                                        pattern="[0-9]*"
                                        maxLength={CODE_LENGTH}
                                        autoFocus
                                        fontSize="2xl"
                                        letterSpacing="0.4em"
                                        textAlign="center"
                                        h="14"
                                        aria-label={t("game.lobby.joinByCode.codeAria")}
                                        placeholder="0000"
                                    />
                                </Field.Root>
                            </VStack>
                        </Dialog.Body>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Portal>
        </Dialog.Root>
    )
}
