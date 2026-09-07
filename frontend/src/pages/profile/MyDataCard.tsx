import React, { Suspense, useRef, useState } from "react"
import { Box, Button, Card, chakra, Heading, HStack, IconButton, SimpleGrid, Text, VStack } from "@chakra-ui/react"
import { isAxiosError } from "axios"
import { FiEdit2, FiGlobe, FiPhone, FiTrash2, FiUser } from "react-icons/fi"
import type { PublicProfile } from "../../api/publicProfile"
import { deleteAvatar, uploadAvatar } from "../../api/userMe"
import ConfirmDialog from "../../components/ConfirmDialog"
import DetailTile from "../../components/DetailTile"
import { showError } from "../../toaster"
import { errorMessage } from "../../utils/apiError"
import { useInvalidateMyProfile } from "../../hooks/useMyProfile"
import { lazyWithReload } from "../../utils/lazyWithReload"
import { useTranslation } from "../../i18n"
import { ProfileAvatar } from "./ProfileHeader"
import { EditProfileDialog } from "./EditProfileDialog"

/* The cropper pulls in react-image-crop plus its CSS on every profile view
   when statically imported. It's only ever needed for the handful of
   seconds between picking a file and confirming/cancelling the crop, so it
   loads lazily and is only mounted (see `cropFile &&` below) while a file is
   actually being cropped. */
const AvatarCropDialog = lazyWithReload(() => import("../../components/AvatarCropDialog"))

/**
 * "Moji podaci" — the owner's own record, and the ONLY place it can be
 * changed. Avatar (upload / remove) on the left of the header, an "Uredi"
 * button on the right opening the existing EditProfileDialog, and the three
 * values below as labelled tiles.
 *
 * Every mutation here still goes through the same two calls it always did:
 * `useInvalidateMyProfile()` (repaints every `qk.profile` consumer, the
 * navbar avatar included) followed by `onProfileChanged()` (refetches the
 * public record this page renders from).
 */
export function MyDataCard({
    profile,
    onProfileChanged,
}: {
    profile: PublicProfile
    onProfileChanged: () => Promise<void> | void
}) {
    const { t } = useTranslation()
    const [editOpen, setEditOpen] = useState(false)
    const [uploading, setUploading] = useState(false)
    // Avatar mutations change /user/me/profile, which the navbar avatar and
    // every other useMyProfile() consumer render from.
    const invalidateMyProfile = useInvalidateMyProfile()
    // Replaced window.confirm() — see ConfirmDialog mounted at the bottom.
    const [removeAvatarOpen, setRemoveAvatarOpen] = useState(false)
    const fileInputRef = useRef<HTMLInputElement | null>(null)
    // The file just picked, waiting in AvatarCropDialog for a crop before
    // anything is uploaded. Null both before a pick and after the dialog
    // closes — see `onAvatarChosen` and `onCropCancel`.
    const [cropFile, setCropFile] = useState<File | null>(null)

    function onPickAvatar() {
        fileInputRef.current?.click()
    }

    function onAvatarChosen(e: React.ChangeEvent<HTMLInputElement>) {
        const f = e.target.files?.[0]
        // Reset value so picking the same file again still fires onChange.
        e.target.value = ""
        if (f) setCropFile(f)
    }

    function onCropCancel() {
        setCropFile(null)
    }

    /** The dialog handed back a square JPEG blob — upload THAT, not the
     *  original pick. `File`, not `Blob`: `uploadAvatar`'s multipart body
     *  needs a filename, which only `File` carries. */
    async function onCropped(blob: Blob) {
        const f = new File([blob], "avatar.jpg", { type: "image/jpeg" })
        try {
            setUploading(true)
            await uploadAvatar(f)
            // No `bela:profile-updated` dispatch: NavBar's listener for it does
            // nothing but call this same invalidation, so firing both cost a
            // second /user/me/profile round-trip per upload.
            await invalidateMyProfile()
            await onProfileChanged()
            setCropFile(null)
        } catch (err) {
            // The shared axios interceptor already toasted the server's own
            // message (the upload is not `silent`), so a second toast here
            // stacked two red cards for one failure. Only speak up for a
            // failure axios never saw.
            console.warn("Učitavanje profilne slike nije uspjelo", err)
            if (!isAxiosError(err)) {
                showError(t("profile.avatar.uploadFailed"), errorMessage(err))
            }
        } finally {
            setUploading(false)
        }
    }

    /** Runs once the owner confirms in the remove-avatar ConfirmDialog. */
    async function onRemoveAvatar() {
        try {
            setUploading(true)
            await deleteAvatar()
            // Same as the upload path — the invalidation alone repaints every
            // qk.profile consumer, navbar avatar included.
            await invalidateMyProfile()
            await onProfileChanged()
            setRemoveAvatarOpen(false)
        } catch (err) {
            // Avatar stays as it is locally, matching the server.
            console.warn("Brisanje profilne slike nije uspjelo", err)
        } finally {
            setUploading(false)
        }
    }

    return (
        <Card.Root variant="outline" rounded="xl" borderColor="border.emphasized" shadow="sm">
            <Card.Body p={{ base: "4", md: "5" }}>
                <VStack align="stretch" gap="4">
                    <HStack justify="space-between" align="start" gap="3" wrap="wrap">
                        <HStack gap="3" align="center" minW="0">
                            {/* Avatar with its edit affordance. The pencil is
                                the picker; "Ukloni profilnu sliku" appears
                                under the heading only when there is something
                                to remove. */}
                            <Box position="relative" flexShrink={0}>
                                <ProfileAvatar profile={profile} size="56px" fontSize="lg" />
                                <IconButton
                                    aria-label={profile.avatarUrl ? t("profile.avatar.change") : t("profile.avatar.upload")}
                                    title={profile.avatarUrl ? t("profile.avatar.change") : t("profile.avatar.upload")}
                                    size="2xs"
                                    position="absolute"
                                    bottom="-2px"
                                    right="-2px"
                                    rounded="full"
                                    colorPalette="blue"
                                    variant="solid"
                                    loading={uploading}
                                    onClick={onPickAvatar}
                                >
                                    <FiEdit2 />
                                </IconButton>
                                <chakra.input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    display="none"
                                    onChange={onAvatarChosen}
                                />
                            </Box>
                            <Box minW="0">
                                <Heading size="sm">{t("profile.details.title")}</Heading>
                                <Text fontSize="xs" color="fg.muted">
                                    {t("profile.details.description")}
                                </Text>
                                {profile.avatarUrl && (
                                    <Button
                                        size="2xs"
                                        variant="ghost"
                                        colorPalette="red"
                                        mt="1"
                                        onClick={() => setRemoveAvatarOpen(true)}
                                        loading={uploading}
                                    >
                                        <FiTrash2 /> {t("profile.avatar.remove")}
                                    </Button>
                                )}
                            </Box>
                        </HStack>
                        <Button size="xs" variant="outline" onClick={() => setEditOpen(true)}>
                            <FiEdit2 /> {t("profile.details.edit")}
                        </Button>
                    </HStack>

                    {/* Three short values side by side from md up, stacked on a
                        phone where they would not fit. */}
                    <SimpleGrid columns={{ base: 1, md: 3 }} gap={{ base: "2", md: "3" }}>
                        <DetailTile
                            layout="inline"
                            icon={<FiUser size={14} />}
                            label={t("profile.details.nameLabel")}
                            value={profile.displayName ?? t("profile.details.notSet")}
                        />
                        <DetailTile
                            layout="inline"
                            icon={<FiGlobe size={14} />}
                            label={t("profile.details.usernameLabel")}
                            value={profile.slug}
                        />
                        <DetailTile
                            layout="inline"
                            icon={<FiPhone size={14} />}
                            label={t("profile.details.phoneLabel")}
                            value={
                                profile.phone
                                    ? `${profile.phoneCountry ? `${profile.phoneCountry} ` : ""}${profile.phone}`
                                    : t("profile.details.notSet")
                            }
                        />
                    </SimpleGrid>
                </VStack>
            </Card.Body>

            <ConfirmDialog
                open={removeAvatarOpen}
                title={t("profile.avatar.removeConfirmTitle")}
                description={t("profile.avatar.removeConfirmBody")}
                confirmLabel={t("profile.avatar.removeConfirmLabel")}
                destructive
                busy={uploading}
                onConfirm={onRemoveAvatar}
                onCancel={() => setRemoveAvatarOpen(false)}
            />

            {cropFile && (
                <Suspense fallback={null}>
                    <AvatarCropDialog
                        file={cropFile}
                        open
                        busy={uploading}
                        onCancel={onCropCancel}
                        onCropped={(blob) => void onCropped(blob)}
                    />
                </Suspense>
            )}

            <EditProfileDialog
                open={editOpen}
                initialName={profile.displayName ?? ""}
                onClose={() => setEditOpen(false)}
                onSaved={async () => {
                    setEditOpen(false)
                    await onProfileChanged()
                }}
            />
        </Card.Root>
    )
}
