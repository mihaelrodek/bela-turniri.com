import { useEffect, useRef, useState } from "react"
import { Box, Button, Dialog, Portal, Text } from "@chakra-ui/react"
import ReactCrop, {
    centerCrop,
    makeAspectCrop,
    type Crop,
    type PixelCrop,
} from "react-image-crop"
import "react-image-crop/dist/ReactCrop.css"
import { useTranslation } from "../i18n"

/* ──────────────────────────────────────────────────────────────────────────
   AvatarCropDialog — pick the square that becomes the circular avatar,
   before it ever leaves the browser.

   WHY A CROP STEP AT ALL
   ───────────────────────
   `uploadAvatar` used to take whatever the file picker returned, straight
   to the backend. Every avatar in the app is rendered circular (`rounded=
   "full"` + `objectFit="cover"`) — CSS/Thumbnailator only ever centre-crop
   a non-square source, so a portrait photo with the face off-centre lost
   the face. This puts the choice of WHICH square in front of the person
   uploading it, once, instead of guessing.

   SQUARE FILE, NOT A PUNCHED-OUT CIRCLE
   ──────────────────────────────────────
   `circularCrop` on `ReactCrop` is a visual aid ONLY — an overlay so the
   picker shows what the eventual circular mask will keep — the crop region
   itself is still a plain square. The canvas below draws that square
   as-is, no alpha clipping, and uploads a normal opaque JPEG. Every
   consumer already renders it circular via CSS (`ProfileAvatar`, the
   navbar `UserAvatar`, …); duplicating that as a transparency mask baked
   into the file would be two implementations of the same mask that could
   drift, for a format Thumbnailator's server-side downscale has no
   particular reason to handle specially.

   `centerAspectCrop` seeds a centred 90%-of-the-shorter-side square on
   load — close enough for most photos that a lot of uploads need no drag
   at all, while still leaving every pixel of the source reachable.
   ────────────────────────────────────────────────────────────────────── */

/** A centred, 1:1 crop covering 90% of whichever dimension is shorter. */
function centerAspectCrop(mediaWidth: number, mediaHeight: number): Crop {
    return centerCrop(
        makeAspectCrop({ unit: "%", width: 90 }, 1, mediaWidth, mediaHeight),
        mediaWidth,
        mediaHeight,
    )
}

/** Draw the chosen pixel region of `image` onto a same-size canvas and
 *  export it as a JPEG blob — the file that actually gets uploaded. */
function cropToBlob(image: HTMLImageElement, crop: PixelCrop): Promise<Blob | null> {
    const scaleX = image.naturalWidth / image.width
    const scaleY = image.naturalHeight / image.height
    const width = Math.max(1, Math.round(crop.width * scaleX))
    const height = Math.max(1, Math.round(crop.height * scaleY))

    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    if (!ctx) return Promise.resolve(null)

    ctx.drawImage(
        image,
        crop.x * scaleX, crop.y * scaleY, width, height,
        0, 0, width, height,
    )
    return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92))
}

export default function AvatarCropDialog({
    file,
    open,
    busy,
    onCancel,
    onCropped,
}: {
    /** The file just picked. Null while closed — nothing to read yet. */
    file: File | null
    open: boolean
    /** Upload in flight — disables the confirm button, same as the rest of the card. */
    busy?: boolean
    onCancel: () => void
    /** Fired with the cropped square, ready to hand straight to `uploadAvatar`. */
    onCropped: (blob: Blob) => void
}) {
    const { t } = useTranslation()
    const [imgSrc, setImgSrc] = useState("")
    const [crop, setCrop] = useState<Crop>()
    const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
    const imgRef = useRef<HTMLImageElement | null>(null)

    // One object URL per file, revoked when it's replaced or the dialog
    // closes — otherwise every picked photo leaks its blob URL.
    useEffect(() => {
        if (!file) {
            setImgSrc("")
            return
        }
        const url = URL.createObjectURL(file)
        setImgSrc(url)
        return () => URL.revokeObjectURL(url)
    }, [file])

    function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
        const { width, height } = e.currentTarget
        setCrop(centerAspectCrop(width, height))
    }

    async function onConfirm() {
        if (!completedCrop || !imgRef.current || busy) return
        const blob = await cropToBlob(imgRef.current, completedCrop)
        if (blob) onCropped(blob)
    }

    return (
        <Dialog.Root
            open={open}
            onOpenChange={(e) => { if (!e.open && !busy) onCancel() }}
            placement="center"
        >
            <Portal>
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content maxW={{ base: "92%", md: "sm" }}>
                        <Dialog.Header>
                            <Dialog.Title fontSize="md">{t("profile.avatar.cropTitle")}</Dialog.Title>
                        </Dialog.Header>
                        <Dialog.Body>
                            <Text fontSize="sm" color="fg.muted" mb="3">
                                {t("profile.avatar.cropHint")}
                            </Text>
                            {imgSrc && (
                                <Box
                                    display="flex"
                                    justifyContent="center"
                                    bg="bg.subtle"
                                    rounded="md"
                                    overflow="hidden"
                                    p="2"
                                >
                                    <ReactCrop
                                        crop={crop}
                                        onChange={(_, percentCrop) => setCrop(percentCrop)}
                                        onComplete={(c) => setCompletedCrop(c)}
                                        aspect={1}
                                        circularCrop
                                        keepSelection
                                    >
                                        <img
                                            ref={imgRef}
                                            src={imgSrc}
                                            alt=""
                                            onLoad={onImageLoad}
                                            style={{ maxHeight: "55vh", display: "block" }}
                                        />
                                    </ReactCrop>
                                </Box>
                            )}
                        </Dialog.Body>
                        <Dialog.Footer gap="2">
                            <Button variant="ghost" onClick={onCancel} disabled={busy}>
                                {t("common.cancel")}
                            </Button>
                            <Button
                                colorPalette="blue"
                                loading={busy}
                                disabled={!completedCrop || busy}
                                onClick={() => void onConfirm()}
                            >
                                {t("profile.avatar.cropConfirm")}
                            </Button>
                        </Dialog.Footer>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Portal>
        </Dialog.Root>
    )
}
