import {
    Box,
    Button,
    Dialog,
    HStack,
    IconButton,
    Image,
    Portal,
    Stack,
    Text,
} from "@chakra-ui/react"
import { FiCopy, FiDownload, FiX } from "react-icons/fi"
import { useTranslation } from "../i18n"
import { showError, showSuccess } from "../toaster"
import {
    publicTournamentUrl,
    tournamentQrImageUrl,
    tournamentQrRef,
    useTournamentQrDownload,
} from "./tournamentQr"

/* ──────────────────────────────────────────────────────────────────────────
   TournamentQrDialog — shows the tournament's branded QR code so an
   organiser can display it on a screen or print it at the venue.

   Self-contained like ConfirmDialog: no internal trigger, the parent owns
   `open` / `onClose`. The image is served straight from the backend's
   `/tournaments/{id}/qr.png` (see TournamentController#qrCode) — nothing is
   generated on the client.

   URL construction and the download routine live in `./tournamentQr`, shared
   with `TournamentQrCard` (the same code rendered inline on the Detalji
   view) so there is one implementation of each, not two.
   ────────────────────────────────────────────────────────────────────── */

export default function TournamentQrDialog({
    open,
    onClose,
    tournamentUuid,
    tournamentSlug,
    tournamentName,
}: {
    open: boolean
    onClose: () => void
    tournamentUuid: string
    tournamentSlug?: string | null
    tournamentName: string
}) {
    const { t } = useTranslation()

    const ref = tournamentQrRef(tournamentUuid, tournamentSlug)
    const qrImageUrl = tournamentQrImageUrl(ref, 512)
    const shareUrl = publicTournamentUrl(tournamentUuid, tournamentSlug)
    const { downloading, download: onDownload } = useTournamentQrDownload(ref)

    const onCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(shareUrl)
            showSuccess(t("common.clipboard.copied"))
        } catch {
            showError(t("common.clipboard.copyFailed"), t("common.qr.copyFailedDescription"))
        }
    }

    return (
        <Dialog.Root
            open={open}
            onOpenChange={(e) => { if (!e.open) onClose() }}
            placement="center"
        >
            <Portal>
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content maxW={{ base: "92%", md: "sm" }}>
                        <Dialog.Header>
                            <HStack justify="space-between" align="center" width="full">
                                <Dialog.Title>{t("common.qr.dialogTitle")}</Dialog.Title>
                                <Dialog.CloseTrigger asChild>
                                    <IconButton
                                        aria-label={t("common.close")}
                                        variant="ghost"
                                        size="sm"
                                    >
                                        <FiX />
                                    </IconButton>
                                </Dialog.CloseTrigger>
                            </HStack>
                        </Dialog.Header>
                        <Dialog.Body>
                            <Stack gap="4" align="center">
                                <Text color="fg.muted" fontSize="sm" textAlign="center">
                                    {t("common.qr.scanHint", { name: tournamentName })}
                                </Text>
                                <Box
                                    bg="bg.panel"
                                    borderWidth="1px"
                                    borderColor="border.subtle"
                                    rounded="lg"
                                    p="3"
                                    maxW="min(280px, 100%)"
                                    width="full"
                                >
                                    <Image
                                        src={qrImageUrl}
                                        alt={t("common.qr.altText", { name: tournamentName })}
                                        width="full"
                                        height="auto"
                                        rounded="md"
                                    />
                                </Box>
                                <Text
                                    color="fg.muted"
                                    fontSize="xs"
                                    fontFamily="mono"
                                    textAlign="center"
                                    wordBreak="break-all"
                                >
                                    {shareUrl}
                                </Text>
                            </Stack>
                        </Dialog.Body>
                        <Dialog.Footer gap={2}>
                            <Button variant="outline" onClick={onCopyLink}>
                                <FiCopy /> {t("common.clipboard.copyLink")}
                            </Button>
                            <Button colorPalette="blue" loading={downloading} onClick={onDownload}>
                                <FiDownload /> {t("common.qr.downloadButton")}
                            </Button>
                        </Dialog.Footer>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Portal>
        </Dialog.Root>
    )
}
