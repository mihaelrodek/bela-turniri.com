import { Box, Button, Dialog, Heading, HStack, Portal, Text, VStack } from "@chakra-ui/react"
import { FiUpload } from "react-icons/fi"
import { useTranslation } from "../../i18n"
import AvatarPicker from "./AvatarPicker"
import UserAvatar from "./UserAvatar"
import type { AvatarId } from "./avatarArt"

/* ──────────────────────────────────────────────────────────────────────────
   "Profilna slika" — the one place a user changes their face.

   It used to be two separate affordances: a pencil on the avatar that opened
   a file picker, and a character grid further down the card. That made the
   two look like unrelated features and hid the fact that they are one
   choice. The pencil now opens THIS, which offers both side by side
   (2026-09-11).

   The dialog does not upload or save anything itself — it only reports which
   way the user went. `MyDataCard` owns the mutations, the crop dialog and the
   remove-confirm, all of which already existed and are untouched.
   ────────────────────────────────────────────────────────────────────── */

export interface AvatarChooserDialogProps {
    open: boolean
    onClose: () => void
    /** Current photo URL, so the dialog can show it and offer to remove it. */
    avatarUrl?: string | null
    /** Currently picked character, highlighted in the grid. */
    avatarPreset?: string | null
    name?: string | null
    /** A face was picked. The caller saves it and closes the dialog. */
    onPickPreset: (id: AvatarId) => void
    /** "Uploadaj sliku" — the caller opens its file input. */
    onUploadPhoto: () => void
    /** "Ukloni sliku" — the caller opens its remove-confirm. Only rendered
     *  when there is a photo to remove. */
    onRemovePhoto: () => void
    /**
     * "Koristi ovu fotografiju" — clear the stored character so the photo the
     * user already uploaded becomes current again. Only reachable when BOTH
     * exist, which happens after picking a character on top of a photo: the
     * photo file is never deleted, it is only out-ranked, and without this
     * there would be no way back to it short of uploading it a second time.
     */
    onUsePhoto: () => void
    /** A save is in flight: the grid is dimmed and the buttons disabled so a
     *  second click cannot fire an overlapping request. */
    busy?: boolean
}

export default function AvatarChooserDialog({
    open,
    onClose,
    avatarUrl,
    avatarPreset,
    name,
    onPickPreset,
    onUploadPhoto,
    onRemovePhoto,
    onUsePhoto,
    busy = false,
}: AvatarChooserDialogProps) {
    const { t } = useTranslation()

    return (
        <Dialog.Root
            open={open}
            onOpenChange={(e) => { if (!e.open && !busy) onClose() }}
            placement="center"
            scrollBehavior="inside"
        >
            <Portal>
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content maxW={{ base: "94%", md: "560px" }} rounded="2xl">
                        <Dialog.Header>
                            <HStack gap="3" align="center">
                                {/* The live result of whatever is currently
                                    chosen — the same component every other
                                    surface renders, so what you see here is
                                    exactly what the navbar will show. */}
                                <UserAvatar
                                    avatarUrl={avatarUrl}
                                    avatarPreset={avatarPreset}
                                    name={name}
                                    size="48px"
                                />
                                <Dialog.Title>{t("profile.avatar.dialogTitle")}</Dialog.Title>
                            </HStack>
                        </Dialog.Header>
                        <Dialog.Body>
                            <VStack align="stretch" gap="5">
                                <Box>
                                    <Heading size="xs" mb="0.5">{t("profile.avatar.useCharacter")}</Heading>
                                    <Text fontSize="xs" color="fg.muted" mb="3">
                                        {t("profile.avatar.chooseHint")}
                                    </Text>
                                    <Box
                                        opacity={busy ? 0.6 : 1}
                                        pointerEvents={busy ? "none" : "auto"}
                                        transition="opacity 120ms"
                                    >
                                        <AvatarPicker
                                            value={avatarPreset ?? null}
                                            onChange={onPickPreset}
                                        />
                                    </Box>
                                </Box>

                                <Box borderTopWidth="1px" borderColor="border.subtle" pt="4">
                                    <Heading size="xs" mb="0.5">{t("profile.avatar.usePhoto")}</Heading>
                                    <Text fontSize="xs" color="fg.muted" mb="3">
                                        {t("profile.avatar.photoHint")}
                                    </Text>
                                    <HStack gap="2" wrap="wrap">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            loading={busy}
                                            onClick={onUploadPhoto}
                                        >
                                            <FiUpload />
                                            {avatarUrl
                                                ? t("profile.avatar.change")
                                                : t("profile.avatar.upload")}
                                        </Button>
                                        {avatarUrl && avatarPreset && (
                                            <Button
                                                size="sm"
                                                colorPalette="brand"
                                                disabled={busy}
                                                onClick={onUsePhoto}
                                            >
                                                {t("profile.avatar.usePhotoAgain")}
                                            </Button>
                                        )}
                                        {avatarUrl && (
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                colorPalette="red"
                                                disabled={busy}
                                                onClick={onRemovePhoto}
                                            >
                                                {t("profile.avatar.remove")}
                                            </Button>
                                        )}
                                    </HStack>
                                </Box>
                            </VStack>
                        </Dialog.Body>
                        <Dialog.Footer>
                            <Button variant="ghost" disabled={busy} onClick={onClose}>
                                {t("common.close")}
                            </Button>
                        </Dialog.Footer>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Portal>
        </Dialog.Root>
    )
}
