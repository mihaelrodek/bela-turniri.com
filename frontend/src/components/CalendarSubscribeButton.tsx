import { useState } from "react"
import {
    Box,
    Button,
    Dialog,
    HStack,
    IconButton,
    Link as ChakraLink,
    Portal,
    Stack,
    Text,
} from "@chakra-ui/react"
import { FiCalendar, FiCopy, FiDownload, FiX } from "react-icons/fi"
import { useTranslation } from "../i18n"
import { showError, showSuccess } from "../toaster"

/* ──────────────────────────────────────────────────────────────────────────
   CalendarSubscribeButton — self-contained trigger + dialog offering the
   recurring calendar feed (`GET /api/calendar/tournaments.ics`, see
   backend CalendarFeedController) for subscription, as opposed to the
   one-shot "Dodaj u kalendar" download on a single tournament
   (TournamentDetailsPage / utils/ics.ts).

   Subscribing (once, via webcal://) is the whole point: the calendar app
   re-fetches the URL on its own schedule from then on, so new and moved
   tournaments keep appearing without the user ever coming back here. The
   plain https:// URL is also shown/copyable as a fallback for calendar
   apps that don't register the webcal: scheme (notably some Android/web
   clients) — pasting it into "Add calendar by URL" works identically.

   Same base-URL fallback as TournamentQrDialog.tsx (VITE_API_URL,
   defaulting to "/api") rather than importing api/http.ts, since that
   file belongs to another workstream.
   ────────────────────────────────────────────────────────────────────── */

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "/api"

/** `https://…/api/calendar/tournaments.ics` and its `webcal://` twin. */
function feedUrls(): { https: string; webcal: string } {
    const origin = typeof window !== "undefined" ? window.location.origin : ""
    const https = `${origin}${API_BASE}/calendar/tournaments.ics`
    // Calendar clients (Google Calendar, Apple Calendar, Outlook) register
    // the webcal: scheme specifically to mean "subscribe to this, don't
    // just download it once" — swapping http(s): for webcal: is the whole
    // trick, no separate endpoint needed.
    const webcal = https.replace(/^https?:/, "webcal:")
    return { https, webcal }
}

export default function CalendarSubscribeButton() {
    const { t } = useTranslation()
    const [open, setOpen] = useState(false)
    const { https, webcal } = feedUrls()

    const onCopy = async () => {
        try {
            await navigator.clipboard.writeText(https)
            showSuccess(t("common.clipboard.copied"))
        } catch {
            showError(t("common.clipboard.copyFailed"), t("common.calendar.copyFailedDescription"))
        }
    }

    return (
        <>
            {/* Text collapses to icon-only below md — the calendar toolbar
                (view toggle + "U blizini" + this) has to fit one row at
                390px, and "Pretplati se" is the one word this button can
                give up first without losing its meaning (the dialog it
                opens repeats it in full). */}
            <Button
                size="sm"
                variant="outline"
                px={{ base: "2", md: "4" }}
                onClick={() => setOpen(true)}
                whiteSpace="nowrap"
            >
                <FiCalendar />
                {t("common.calendar.subscribeButton")}
            </Button>
            <Dialog.Root
                open={open}
                onOpenChange={(e) => setOpen(e.open)}
                placement="center"
            >
                <Portal>
                    <Dialog.Backdrop />
                    <Dialog.Positioner>
                        <Dialog.Content maxW={{ base: "92%", md: "sm" }}>
                            <Dialog.Header>
                                <HStack justify="space-between" align="center" width="full">
                                    <Dialog.Title>{t("common.calendar.dialogTitle")}</Dialog.Title>
                                    <Dialog.CloseTrigger asChild>
                                        <IconButton aria-label={t("common.close")} variant="ghost" size="sm">
                                            <FiX />
                                        </IconButton>
                                    </Dialog.CloseTrigger>
                                </HStack>
                            </Dialog.Header>
                            <Dialog.Body>
                                <Stack gap="4">
                                    <Text color="fg.muted" fontSize="sm">
                                        {t("common.calendar.description")}
                                    </Text>

                                    <Button colorPalette="blue" asChild>
                                        <a href={webcal}>
                                            <FiCalendar /> {t("common.calendar.subscribeWebcal")}
                                        </a>
                                    </Button>

                                    <Box
                                        bg="bg.panel"
                                        borderWidth="1px"
                                        borderColor="border.subtle"
                                        rounded="lg"
                                        p="3"
                                    >
                                        <Text fontSize="xs" color="fg.muted" mb="1">
                                            {t("common.calendar.manualHint")}
                                        </Text>
                                        <Text
                                            fontSize="xs"
                                            fontFamily="mono"
                                            wordBreak="break-all"
                                        >
                                            {https}
                                        </Text>
                                    </Box>

                                    <HStack gap="2" wrap="wrap">
                                        <Button variant="outline" size="sm" onClick={onCopy}>
                                            <FiCopy /> {t("common.clipboard.copyLink")}
                                        </Button>
                                        <ChakraLink href={https} fontSize="sm" color="fg.muted">
                                            <FiDownload /> {t("common.calendar.downloadIcs")}
                                        </ChakraLink>
                                    </HStack>
                                </Stack>
                            </Dialog.Body>
                        </Dialog.Content>
                    </Dialog.Positioner>
                </Portal>
            </Dialog.Root>
        </>
    )
}
