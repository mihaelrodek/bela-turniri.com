import { useEffect, useState } from "react"
import {
    Button,
    Dialog,
    Portal,
    RadioGroup,
    Stack,
    Text,
    Textarea,
} from "@chakra-ui/react"

import {
    createReport,
    REPORT_MESSAGE_MAX,
    type ReportReason,
    type ReportTargetType,
} from "../api/reports"
import { showError, showSuccess } from "../toaster"
import { errorMessage } from "../utils/apiError"
import { useTranslation } from "../i18n"

/* ──────────────────────────────────────────────────────────────────────────
   "Prijavi sadržaj" — one dialog for all three reportable things (a
   tournament, a pair, a player's profile). App Store review requires a way to
   flag user-generated content and an operator queue behind it; the queue is
   the "Prijave" section of the admin dashboard.

   One component rather than three: the only thing that differs per target is
   the title line, which the caller supplies as `targetLabel`. The reasons are
   a fixed four-value enum shared with the backend, so they translate here and
   travel as codes.

   The dialog owns nothing but its own form state — it never mutates the page
   it was opened from, because a report changes nothing the reader can see.

   Its copy lives in the `profile` namespace even though it is opened from
   the tournament page too: reporting, blocking and account deletion are one
   user-safety family, and splitting the same dialog's strings across two
   dictionaries is how the two halves drift apart. Only the ENTRY labels
   ("Prijavi turnir", "Prijavi par") belong to `tournament`.
   ────────────────────────────────────────────────────────────────────── */

/** The four reasons, in the order they are offered. */
const REASONS: ReportReason[] = ["SPAM", "OFFENSIVE", "PERSONAL_DATA", "OTHER"]

export default function ReportDialog({
    targetType,
    targetId,
    targetLabel,
    open,
    onClose,
}: {
    targetType: ReportTargetType
    /** UUID (tournament), pair id as a string, or slug (profile). */
    targetId: string
    /** What the reader sees they are reporting — shown in the dialog body. */
    targetLabel: string
    open: boolean
    onClose: () => void
}) {
    const { t } = useTranslation()
    const [reason, setReason] = useState<ReportReason>("SPAM")
    const [message, setMessage] = useState("")
    const [busy, setBusy] = useState(false)

    // Reopening must not show the previous attempt's half-typed text — the
    // dialog is mounted by its parent and only toggled, so nothing else
    // resets it.
    useEffect(() => {
        if (open) {
            setReason("SPAM")
            setMessage("")
        }
    }, [open])

    async function onSubmit() {
        try {
            setBusy(true)
            await createReport({
                targetType,
                targetId,
                reason,
                message: message.trim() || undefined,
            })
            showSuccess(t("profile.report.success"))
            onClose()
        } catch (err) {
            // The call is `silent`, so every outcome is worded here. The
            // backend's bare codes (ApiCodes) are never shown as-is.
            const res = (err as { response?: { status?: number; data?: unknown } } | null)?.response
            const data = res?.data
            const code = typeof data === "string"
                ? data.trim()
                : typeof (data as { code?: unknown } | null)?.code === "string"
                    ? String((data as { code: string }).code)
                    : ""
            if (res?.status === 429) {
                showError(t("profile.report.error.rateLimited"))
            } else if (res?.status === 400 && code === "CANNOT_REPORT_SELF") {
                showError(t("profile.report.error.self"))
            } else if (res?.status === 404) {
                showError(t("profile.report.error.notFound"))
            } else {
                showError(t("profile.report.error.generic"), errorMessage(err))
            }
        } finally {
            setBusy(false)
        }
    }

    return (
        <Dialog.Root
            open={open}
            onOpenChange={(e) => { if (!e.open && !busy) onClose() }}
            placement="center"
        >
            <Portal>
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content maxW={{ base: "92%", md: "md" }}>
                        <Dialog.Header>
                            <Dialog.Title>{t("profile.report.title")}</Dialog.Title>
                        </Dialog.Header>
                        <Dialog.Body>
                            <Stack gap="4">
                                <Dialog.Description color="fg.muted" fontSize="sm">
                                    {t("profile.report.body", { target: targetLabel })}
                                </Dialog.Description>

                                <RadioGroup.Root
                                    value={reason}
                                    onValueChange={(e) => setReason((e.value as ReportReason) ?? "SPAM")}
                                >
                                    <Stack gap="2">
                                        {REASONS.map((r) => (
                                            <RadioGroup.Item key={r} value={r}>
                                                <RadioGroup.ItemHiddenInput />
                                                <RadioGroup.ItemControl />
                                                <RadioGroup.ItemText fontSize="sm">
                                                    {t(`profile.report.reason.${r}`)}
                                                </RadioGroup.ItemText>
                                            </RadioGroup.Item>
                                        ))}
                                    </Stack>
                                </RadioGroup.Root>

                                <Stack gap="1">
                                    <Text fontSize="sm" fontWeight="medium">
                                        {t("profile.report.messageLabel")}
                                    </Text>
                                    <Textarea
                                        value={message}
                                        maxLength={REPORT_MESSAGE_MAX}
                                        minH="100px"
                                        onChange={(e) => setMessage(e.target.value)}
                                        placeholder={t("profile.report.messagePlaceholder")}
                                    />
                                    {/* Plain fraction, not a plural family: it is a
                                        counter ("120/1000"), not a sentence. */}
                                    <Text fontSize="xs" color="fg.muted" textAlign="right">
                                        {message.length}/{REPORT_MESSAGE_MAX}
                                    </Text>
                                </Stack>
                            </Stack>
                        </Dialog.Body>
                        <Dialog.Footer gap={2}>
                            <Button variant="ghost" onClick={onClose} disabled={busy}>
                                {t("common.cancel")}
                            </Button>
                            <Button colorPalette="red" loading={busy} onClick={() => void onSubmit()}>
                                {t("profile.report.submit")}
                            </Button>
                        </Dialog.Footer>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Portal>
        </Dialog.Root>
    )
}
