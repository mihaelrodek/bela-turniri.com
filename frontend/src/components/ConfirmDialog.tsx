import { Button, Dialog, Portal } from "@chakra-ui/react"
import type { ReactNode } from "react"
import { useTranslation } from "../i18n"

/* ──────────────────────────────────────────────────────────────────────────
   ConfirmDialog — the generic two-phase confirmation used everywhere we
   used to call the browser's blocking `window.confirm()`.

   Why a component and not `window.confirm`: the native dialog is not
   themable, is suppressed on some mobile browsers/PWAs, blocks the JS
   thread, and cannot be styled to distinguish a destructive action from a
   harmless one. This mirrors the two-phase pattern already used in
   AdminDashboardTab: clicking the trigger stages the pending action and
   opens the dialog, clicking "Potvrdi" fires it.

   `title` is a ReactNode rather than a string, and `wide` exists, so the two
   rich confirmations in AdminDashboardTab (reset tournament / change status)
   could stop hand-rolling their own Dialog.Root scaffolding: they need an
   icon beside the title and a three-block body, but everything else — the
   shell, the placement, the busy handling, the button pair — was a copy of
   this. Folding them in also gave them the `role="alertdialog"` they were
   missing, which is what makes a screen reader interrupt rather than queue.

   Defaults are Croatian because every UI string in this app is Croatian.
   ────────────────────────────────────────────────────────────────────── */

export default function ConfirmDialog({
    open,
    title,
    description,
    confirmLabel,
    cancelLabel,
    destructive = false,
    busy = false,
    wide = false,
    onConfirm,
    onCancel,
}: {
    open: boolean
    title: ReactNode
    description?: ReactNode
    confirmLabel?: string
    cancelLabel?: string
    /** Paints the confirm button red — use for deletes/resets. */
    destructive?: boolean
    /** Disables both buttons and spins the confirm one while the action runs. */
    busy?: boolean
    /** Roomier shell, for a body that is more than a sentence or two. */
    wide?: boolean
    onConfirm: () => void
    onCancel: () => void
}) {
    const { t } = useTranslation()
    const resolvedConfirmLabel = confirmLabel ?? t("common.confirm")
    const resolvedCancelLabel = cancelLabel ?? t("common.cancel")
    return (
        <Dialog.Root
            open={open}
            onOpenChange={(e) => { if (!e.open && !busy) onCancel() }}
            placement="center"
            role="alertdialog"
        >
            <Portal>
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content maxW={{ base: "92%", md: wide ? "md" : "sm" }}>
                        <Dialog.Header>
                            <Dialog.Title>{title}</Dialog.Title>
                        </Dialog.Header>
                        {description != null && (
                            <Dialog.Body>
                                {/* Dialog.Description, not a bare Text: Ark/Chakra
                                    points the dialog's aria-describedby at this
                                    node's generated id, so screen readers announce
                                    the consequence together with the title. Without
                                    it the attribute dangles at a missing element. */}
                                {typeof description === "string" ? (
                                    <Dialog.Description whiteSpace="pre-line" color="fg.muted">
                                        {description}
                                    </Dialog.Description>
                                ) : (
                                    <Dialog.Description asChild>
                                        <div>{description}</div>
                                    </Dialog.Description>
                                )}
                            </Dialog.Body>
                        )}
                        <Dialog.Footer gap={2}>
                            <Button variant="ghost" onClick={onCancel} disabled={busy}>
                                {resolvedCancelLabel}
                            </Button>
                            <Button
                                colorPalette={destructive ? "red" : "blue"}
                                loading={busy}
                                onClick={onConfirm}
                            >
                                {resolvedConfirmLabel}
                            </Button>
                        </Dialog.Footer>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Portal>
        </Dialog.Root>
    )
}
