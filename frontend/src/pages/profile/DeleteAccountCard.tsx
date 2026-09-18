import { useState } from "react"
import {
    Box,
    Button,
    Card,
    Dialog,
    Heading,
    HStack,
    Input,
    Portal,
    Stack,
    Text,
} from "@chakra-ui/react"
import { useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { FiAlertTriangle, FiTrash2 } from "react-icons/fi"

import { deleteAccount } from "../../api/userMe"
import { loadFirebaseAuth } from "../../firebase"
import { useAuth } from "../../auth/authContextValue"
import { showError, showSuccess } from "../../toaster"
import { errorMessage } from "../../utils/apiError"
import { useTranslation } from "../../i18n"

/* ──────────────────────────────────────────────────────────────────────────
   "Brisanje računa" — App Store review requires that an account created in
   the app can be deleted from inside it, without writing to support.

   Deliberately the LAST card on the owner's own Postavke section: it is the
   one irreversible thing on this page, and nothing should sit under it that
   a reader might be scrolling towards.

   Two guards, not one:
     • the button only opens a dialog, and
     • the dialog's destructive button stays disabled until the reader types
       the confirmation word (hr "OBRIŠI", sl "IZBRIŠI") — a word, not a
       checkbox, because a checkbox is one stray tap away and this is not.

   The deletion itself runs in two halves. The server anonymises the profile
   and deletes the Firebase user when it can; the client then calls Firebase's
   own `deleteUser` as a second path, because the Admin-SDK half can fail on
   its own while the profile is already gone. A `auth/requires-recent-login`
   rejection is NOT a failure of the delete — the server side has already
   happened — so it is explained in a toast and the sign-out proceeds anyway.
   ────────────────────────────────────────────────────────────────────── */

export function DeleteAccountCard() {
    const { t } = useTranslation()
    const { signOut } = useAuth()
    const navigate = useNavigate()
    const queryClient = useQueryClient()

    const [open, setOpen] = useState(false)
    const [typed, setTyped] = useState("")
    const [busy, setBusy] = useState(false)

    // The word the reader has to type. Translated: a Slovenian reader is
    // asked for a Slovenian word, and it is compared case-insensitively so a
    // phone keyboard's autocapitalisation can't lock anyone out.
    const confirmWord = t("profile.deleteAccount.confirmWord")
    const typedOk = typed.trim().toLocaleUpperCase() === confirmWord.toLocaleUpperCase()

    function close() {
        if (busy) return
        setOpen(false)
        setTyped("")
    }

    async function onConfirm() {
        if (!typedOk) return
        try {
            setBusy(true)
            await deleteAccount()
        } catch (err) {
            // The server half failed — nothing has been deleted, so stop here
            // rather than signing the user out of an account that still exists.
            setBusy(false)
            showError(t("profile.deleteAccount.failed"), errorMessage(err))
            return
        }

        // Second path. Whatever happens here, the account is gone server-side.
        const fb = await loadFirebaseAuth()
        const current = fb.auth.currentUser
        if (current) {
            try {
                await fb.deleteUser(current)
            } catch (err) {
                const code = (err as { code?: string } | null)?.code
                if (code === "auth/requires-recent-login") {
                    showError(t("profile.deleteAccount.recentLogin"))
                }
                // Any other failure is silent on purpose: the Firebase user is
                // an empty shell at this point and the server already dropped
                // its data. Nagging about it would read as "delete failed".
            }
        }

        try {
            await signOut()
        } catch {
            /* already signed out, or the token is gone with the user */
        }
        // Clear rather than invalidate: every cached entry belongs to an
        // account that no longer exists, and a refetch would only 401.
        queryClient.clear()
        showSuccess(t("profile.deleteAccount.done"))
        navigate("/")
    }

    return (
        <Card.Root variant="outline" rounded="xl" borderColor="red.muted" shadow="sm">
            <Card.Body p={{ base: "3", md: "5" }}>
                <Stack gap="3">
                    <HStack gap="2.5" align="center">
                        <Box color="red.fg" flexShrink={0}><FiAlertTriangle size={18} /></Box>
                        <Heading size="sm" color="red.fg">{t("profile.deleteAccount.heading")}</Heading>
                    </HStack>
                    <Text fontSize="sm" color="fg.muted">
                        {t("profile.deleteAccount.what")}
                    </Text>
                    <Text fontSize="sm" color="fg.muted">
                        {t("profile.deleteAccount.keeps")}
                    </Text>
                    <Box>
                        <Button
                            size="sm"
                            variant="outline"
                            colorPalette="red"
                            onClick={() => setOpen(true)}
                        >
                            <FiTrash2 /> {t("profile.deleteAccount.button")}
                        </Button>
                    </Box>
                </Stack>
            </Card.Body>

            {/* Hand-rolled rather than ConfirmDialog: this confirmation has a
                typed-word gate, which that component has no room for. The
                shell, placement and `role="alertdialog"` are copied from it so
                the two still look and behave like one dialog. */}
            <Dialog.Root
                open={open}
                onOpenChange={(e) => { if (!e.open) close() }}
                placement="center"
                role="alertdialog"
            >
                <Portal>
                    <Dialog.Backdrop />
                    <Dialog.Positioner>
                        <Dialog.Content maxW={{ base: "92%", md: "md" }}>
                            <Dialog.Header>
                                <Dialog.Title>{t("profile.deleteAccount.dialogTitle")}</Dialog.Title>
                            </Dialog.Header>
                            <Dialog.Body>
                                <Stack gap="3">
                                    <Dialog.Description color="fg.muted" fontSize="sm">
                                        {t("profile.deleteAccount.dialogBody")}
                                    </Dialog.Description>
                                    <Text fontSize="sm">
                                        {t("profile.deleteAccount.typePrompt", { word: confirmWord })}
                                    </Text>
                                    <Input
                                        value={typed}
                                        onChange={(e) => setTyped(e.target.value)}
                                        placeholder={confirmWord}
                                        autoComplete="off"
                                        autoCorrect="off"
                                        autoCapitalize="characters"
                                        aria-label={t("profile.deleteAccount.typePrompt", { word: confirmWord })}
                                    />
                                </Stack>
                            </Dialog.Body>
                            <Dialog.Footer gap={2}>
                                <Button variant="ghost" onClick={close} disabled={busy}>
                                    {t("common.cancel")}
                                </Button>
                                <Button
                                    colorPalette="red"
                                    loading={busy}
                                    disabled={!typedOk}
                                    onClick={() => void onConfirm()}
                                >
                                    {t("profile.deleteAccount.confirmButton")}
                                </Button>
                            </Dialog.Footer>
                        </Dialog.Content>
                    </Dialog.Positioner>
                </Portal>
            </Dialog.Root>
        </Card.Root>
    )
}

export default DeleteAccountCard
