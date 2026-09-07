import { useEffect, useState } from "react"
import { Box, Button, Dialog, Portal, Spinner, Text, VStack } from "@chakra-ui/react"
import { fetchMyTournaments, fetchTournamentDetails } from "../api/tournaments"
import type { TournamentCard, TournamentDetails } from "../types/tournaments"
import { useTranslation } from "../i18n"
import { formatDateTime } from "../utils/format"
import { showError } from "../toaster"

/* ──────────────────────────────────────────────────────────────────────────
   LoadTournamentTemplateDialog — "Učitaj iz predloška" on the create-tournament
   wizard. Lists tournaments the signed-in user has organised before (GET
   /tournaments/mine) and, on pick, fetches that tournament's full details so
   the caller can seed the create form from them via `tournamentFormFromDto` —
   the same builder the "Uredi" form already uses, so there is no second
   mapping to keep in sync.

   The list is fetched fresh every time the dialog opens rather than cached —
   it's a one-shot picker, not a page the user revisits, and a stale list
   here would just show a tournament that no longer exists.
   ────────────────────────────────────────────────────────────────────── */

export default function LoadTournamentTemplateDialog({
    open,
    onClose,
    onApply,
}: {
    open: boolean
    onClose: () => void
    onApply: (details: TournamentDetails) => void
}) {
    const { t } = useTranslation()
    const [items, setItems] = useState<TournamentCard[]>([])
    const [loading, setLoading] = useState(false)
    const [listFailed, setListFailed] = useState(false)
    /** uuid of the row whose details are being fetched, if any — disables that row's button only. */
    const [applyingUuid, setApplyingUuid] = useState<string | null>(null)

    useEffect(() => {
        if (!open) return
        let cancelled = false
        setLoading(true)
        setListFailed(false)
        fetchMyTournaments()
            .then((data) => { if (!cancelled) setItems(data) })
            .catch(() => { if (!cancelled) setListFailed(true) })
            .finally(() => { if (!cancelled) setLoading(false) })
        return () => { cancelled = true }
    }, [open])

    async function pick(card: TournamentCard) {
        if (applyingUuid) return
        setApplyingUuid(card.uuid)
        try {
            const details = await fetchTournamentDetails(card.uuid, { silent: true })
            onApply(details)
        } catch {
            showError(t("forms.createTournament.template.loadDetailsError"))
        } finally {
            setApplyingUuid(null)
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
                    <Dialog.Content maxW={{ base: "92%", md: "md" }}>
                        <Dialog.Header>
                            <Dialog.Title fontSize="md">{t("forms.createTournament.template.dialogTitle")}</Dialog.Title>
                        </Dialog.Header>
                        <Dialog.Body>
                            <Text fontSize="sm" color="fg.muted" mb="3">
                                {t("forms.createTournament.template.dialogHint")}
                            </Text>

                            {loading && (
                                <Box display="flex" justifyContent="center" py="6">
                                    <Spinner size="md" />
                                </Box>
                            )}

                            {!loading && listFailed && (
                                <Text fontSize="sm" color="fg.error">
                                    {t("forms.createTournament.template.loadListError")}
                                </Text>
                            )}

                            {!loading && !listFailed && items.length === 0 && (
                                <Text fontSize="sm" color="fg.muted">
                                    {t("forms.createTournament.template.empty")}
                                </Text>
                            )}

                            {!loading && !listFailed && items.length > 0 && (
                                <VStack align="stretch" gap="2" maxH="50vh" overflowY="auto">
                                    {items.map((card) => (
                                        <Box
                                            key={card.uuid}
                                            display="flex"
                                            alignItems="center"
                                            justifyContent="space-between"
                                            gap="3"
                                            borderWidth="1px"
                                            borderColor="border.subtle"
                                            rounded="md"
                                            px="3"
                                            py="2"
                                        >
                                            <Box minW="0">
                                                <Text fontWeight="medium" truncate>{card.name}</Text>
                                                {card.startAt && (
                                                    <Text fontSize="xs" color="fg.muted">
                                                        {formatDateTime(card.startAt)}
                                                    </Text>
                                                )}
                                            </Box>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                colorPalette="blue"
                                                loading={applyingUuid === card.uuid}
                                                disabled={applyingUuid !== null && applyingUuid !== card.uuid}
                                                onClick={() => void pick(card)}
                                            >
                                                {t("forms.createTournament.template.pick")}
                                            </Button>
                                        </Box>
                                    ))}
                                </VStack>
                            )}
                        </Dialog.Body>
                        <Dialog.Footer gap="2">
                            <Button variant="ghost" onClick={onClose}>
                                {t("common.cancel")}
                            </Button>
                        </Dialog.Footer>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Portal>
        </Dialog.Root>
    )
}
