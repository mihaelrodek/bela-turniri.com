import { useState } from "react"
import {
    Box,
    Button,
    Card,
    Dialog,
    Heading,
    HStack,
    Input,
    Link as ChakraLink,
    Portal,
    Stack,
    Text,
} from "@chakra-ui/react"
import { useQueryClient } from "@tanstack/react-query"
import { Link as RouterLink, useNavigate } from "react-router-dom"
import { FiAlertTriangle, FiTrash2 } from "react-icons/fi"

import { deleteAccount } from "../../api/userMe"
import { loadFirebaseAuth } from "../../firebase"
import { useAuth } from "../../auth/authContextValue"
import { revokeAppleToken } from "../../auth/appleRevocation"
import { purgeLocalAccountData } from "../../auth/localPurge"
import { isNative } from "../../platform"
import { nativeAuth } from "../../platform/nativeAuth"
import { showError, showSuccess } from "../../toaster"
import { errorMessage } from "../../utils/apiError"
import { useTranslation } from "../../i18n"
import { ACCOUNT_DELETION_PATH } from "../accountDeletionPath"

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

   The deletion runs in four steps, in this order:

     1. REVOKE the Sign in with Apple token, for Apple-linked accounts only.
        First, because it needs a live account and a user who can still be
        asked to re-authenticate — both of which the next step takes away.
        Best-effort: see `auth/appleRevocation.ts` for why a failed
        revocation is reported and stepped over rather than aborting.
     2. DELETE server-side. This is the step that must not be skipped; if it
        fails we stop here rather than signing the user out of an account
        that still exists.
     3. DELETE the Firebase user, natively as well as through the JS SDK.
        A second path, because the Admin-SDK half on the server can fail on
        its own while the profile is already gone. A
        `auth/requires-recent-login` rejection is NOT a failure of the delete
        — step 2 has already happened — so it is explained in a toast and the
        sign-out proceeds anyway. (For an Apple account step 1 has already
        re-authenticated, so this rarely fires there.)
     4. SIGN OUT and wipe the device: the query cache, its localStorage
        snapshot, the app's own personal keys and the API cache
        (`auth/localPurge.ts`).
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
        setBusy(true)

        // Step 1 — Apple. `revokeAppleToken` is a no-op for an account with
        // no Apple provider, so there is no branch to get wrong here.
        let appleRevokeFailed = false
        try {
            const fbEarly = await loadFirebaseAuth()
            const currentUser = fbEarly.auth.currentUser
            if (currentUser) {
                appleRevokeFailed = (await revokeAppleToken(currentUser)) === "failed"
            }
        } catch {
            // The auth chunk could not even be loaded. The server half below
            // is what actually deletes the data, so keep going.
        }

        try {
            await deleteAccount()
        } catch (err) {
            // The server half failed — nothing has been deleted, so stop here
            // rather than signing the user out of an account that still exists.
            setBusy(false)
            showError(t("profile.deleteAccount.failed"), errorMessage(err))
            return
        }

        // Step 3 — the Firebase record itself. Natively FIRST: the plugin's
        // own session is the one `@capacitor-firebase/messaging` associated
        // the FCM token with, and it is signed in independently of the JS
        // SDK (`skipNativeAuth: false` in AuthContext.signInWithApple).
        if (isNative) {
            try {
                const FirebaseAuthentication = await nativeAuth()
                await FirebaseAuthentication.deleteUser()
            } catch {
                /* already gone, or needs a recent login — the JS path follows */
            }
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
        // Step 4 — the app's own device storage, which the query-cache purge
        // above does not reach. See `auth/localPurge.ts`.
        await purgeLocalAccountData()
        if (appleRevokeFailed) showError(t("profile.deleteAccount.appleRevokeFailed"))
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
                    {/* The same explanation, in full and without a login —
                        the page Google Play's Data safety form links to. Kept
                        here as well so the in-app path and the public one can
                        never drift into saying different things. */}
                    <Text fontSize="sm">
                        <ChakraLink asChild color="fg.muted" textDecoration="underline">
                            <RouterLink to={ACCOUNT_DELETION_PATH}>
                                {t("profile.deleteAccount.moreInfo")}
                            </RouterLink>
                        </ChakraLink>
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
