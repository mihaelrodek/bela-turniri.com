import { useCallback, useEffect, useRef, useState } from "react"
import {
    Badge,
    Box,
    Button,
    Dialog,
    HStack,
    IconButton,
    Input,
    Portal,
    Spinner,
    Text,
    VStack,
} from "@chakra-ui/react"
import { FiTrash2, FiX } from "react-icons/fi"
import {
    type DrinkPriceDto,
    type MatchBillDto,
    fetchTournamentCjenik,
} from "../api/cjenik"
import {
    addExtraDrink,
    addWaiterDrink,
    deleteExtraBill,
    fetchExtraBill,
    fetchWaiterBill,
    removeExtraDrink,
    removeWaiterDrink,
    renameExtraBill,
    setExtraBillPaid,
    setWaiterBillPaid,
    waiterErrorText,
} from "../api/waiterAccess"
import { newOpId } from "../hooks/useOfflineQueue"
import { formatDateTime, formatEur } from "../utils/format"
import { showError } from "../toaster"
/* `tStatic` for the two async paths (the load effect and `run`), so neither
   has to list a per-render `t` closure among its dependencies; `useTranslation`
   for everything rendered, which must repaint on a language switch. */
import { t as tStatic, useTranslation } from "../i18n"
import ConfirmDialog from "./ConfirmDialog"

/* ──────────────────────────────────────────────────────────────────────────
   WaiterBillDialog — one match's bill, for someone holding a waiter token.

   WHY THIS IS NOT MatchBillButton
   ───────────────────────────────
   MatchBillButton looks like the same screen and is deliberately not reused.
   It is welded to the organiser's offline write queue: every tap goes
   through `useOfflineQueue`, the rendered bill is the server's copy with
   every still-queued op replayed on top (`withPendingBillOps`), optimistic
   rows carry negative ids, and the server's real answer arrives later
   through `subscribeToOutcomes`. That machinery is shared, ordered state
   keyed by op KIND — `billAddDrink`, `billPay` … — all of which send the
   ORGANISER's endpoints with a Firebase bearer. A waiter has no bearer and
   a different set of URLs, so making it serve both would have meant
   threading a second transport through the queue's payload map, the drain,
   and the outcome subscription that the ždrijeb page also listens to. That
   is a recently-hardened surface where a regression costs the organiser
   real money (a double-applied drink, a lost "plaćeno"), and none of it
   buys the waiter anything the queue does not already give them: this is a
   fresh, self-contained screen, so it is synchronous instead — direct calls,
   a busy latch, and a toast when one fails. Exactly how the app worked
   before the queue existed.

   What DID come across, because it is cheap and the failure it prevents is
   the same one: every mutating call carries an `X-Client-Op-Id`. There is no
   queue behind it, but the waiter is on the same venue Wi-Fi, and a
   double-tap on a request that has not visibly returned yet must not put the
   same drink on the bill twice. `newOpId` is the offline queue's own id
   generator — a pure function with a fallback for the Android WebViews that
   have no `crypto.randomUUID` — not any of its state.

   The cjenik is read from the ordinary public endpoint: prices are public
   (`PublicReadCacheFilter` caches that GET for anonymous callers), so the
   waiter surface needs no endpoint of its own for them.
   ────────────────────────────────────────────────────────────────────── */

export default function WaiterBillDialog({
    open,
    onClose,
    tournamentRef,
    token,
    matchId,
    extraBillId = null,
    heading,
    subheading,
    onChanged,
    onDeleted,
}: {
    open: boolean
    onClose: () => void
    /** Tournament uuid or slug — both resolve on the backend. */
    tournamentRef: string
    /** The waiter session token, sent as `X-Waiter-Token` — or null for the
     *  organiser, whose ordinary Firebase bearer is authorisation enough. */
    token: string | null
    /** Null for an "Ostalo" bill (2026-10-03) — then `extraBillId` is set and every
     *  call below goes to the extra-bill endpoints instead; the dialog is otherwise
     *  the same. */
    matchId: number | null
    extraBillId?: number | null
    /** "Runda 2 · Stol 4" — the row's own label, so no second fetch. */
    heading: string
    /** "Ivan i Marko — Ana i Petra". */
    subheading: string
    /** Fired after every successful mutation so the list can repaint. */
    onChanged?: (bill: MatchBillDto) => void
    /** "Ostalo" bill deleted — the list drops the row and closes the dialog. */
    onDeleted?: () => void
}) {
    const { t } = useTranslation()
    const isExtra = extraBillId != null
    /* One adapter per call, so the markup below reads the same for both kinds.
       Both are stable for the lifetime of the dialog (it is keyed per row). */
    const api = {
        fetch: () => (isExtra
            ? fetchExtraBill(tournamentRef, extraBillId, token)
            : fetchWaiterBill(tournamentRef, matchId as number, token)),
        add: (priceId: number, opId: string) => (isExtra
            ? addExtraDrink(tournamentRef, extraBillId, token, priceId, 1, opId)
            : addWaiterDrink(tournamentRef, matchId as number, token, priceId, 1, opId)),
        remove: (drinkId: number, opId: string) => (isExtra
            ? removeExtraDrink(tournamentRef, extraBillId, token, drinkId, opId)
            : removeWaiterDrink(tournamentRef, matchId as number, token, drinkId, opId)),
        paid: (paid: boolean, opId: string) => (isExtra
            ? setExtraBillPaid(tournamentRef, extraBillId, token, paid, opId)
            : setWaiterBillPaid(tournamentRef, matchId as number, token, paid, opId)),
    }
    const [labelDraft, setLabelDraft] = useState("")
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [bill, setBill] = useState<MatchBillDto | null>(null)
    const [cjenik, setCjenik] = useState<DrinkPriceDto[]>([])
    const [loading, setLoading] = useState(true)
    /** A mutation is in flight; every control is latched until it answers. */
    const [busy, setBusy] = useState(false)

    // The dialog is mounted per selected row and unmounts on close, so the
    // only late-response case left is a fetch resolving after the reader has
    // already closed it. Tracking mount is enough — no request token needed.
    const mountedRef = useRef(true)
    useEffect(() => {
        mountedRef.current = true
        return () => { mountedRef.current = false }
    }, [])

    // `onChanged` is an inline arrow from the list; mirror it so the
    // callbacks below keep a stable identity.
    const onChangedRef = useRef(onChanged)
    onChangedRef.current = onChanged

    const applyBill = useCallback((fresh: MatchBillDto) => {
        if (!mountedRef.current) return
        setBill(fresh)
        onChangedRef.current?.(fresh)
    }, [])

    /* Initial load: the bill and the price list, in parallel. */
    useEffect(() => {
        let cancelled = false
        setLoading(true)
        void Promise.all([
            api.fetch(),
            // A tournament with no cjenik is a normal state (the organiser
            // has not set prices yet), so a failure here must not take the
            // bill down with it — the drinks already on it still render.
            fetchTournamentCjenik(tournamentRef).catch(() => [] as DrinkPriceDto[]),
        ])
            .then(([b, c]) => {
                if (cancelled || !mountedRef.current) return
                setBill(b)
                setLabelDraft(b.label ?? "")
                setCjenik(c)
            })
            .catch((e) => {
                if (cancelled) return
                // `waiterErrorText` with an empty fallback so a body that
                // carried nothing useful leaves the toast at its title alone
                // rather than repeating it as its own description.
                showError(tStatic("tournament.waiter.list.loadFailed"), waiterErrorText(e, "") || undefined)
            })
            .finally(() => {
                if (!cancelled && mountedRef.current) setLoading(false)
            })
        return () => { cancelled = true }
        // `api` is rebuilt every render; these three fully determine it.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tournamentRef, matchId, extraBillId, token])

    /**
     * Run one mutation with the busy latch held. Every waiter write returns
     * the whole recomputed bill, so there is nothing to patch — the answer
     * replaces the local copy outright and cannot drift.
     */
    const run = useCallback(async (action: (opId: string) => Promise<MatchBillDto>) => {
        if (busy) return
        setBusy(true)
        try {
            applyBill(await action(newOpId()))
        } catch (e) {
            // The waiter calls are `silent`, so this is the only place the
            // failure is reported. A toast, not an inline line: the reader is
            // looking at the drink they just tapped, not at a form field.
            showError(tStatic("tournament.waiter.actionFailed"), waiterErrorText(e, "") || undefined)
        } finally {
            if (mountedRef.current) setBusy(false)
        }
    }, [busy, applyBill])

    /** Organiser deletes (after a confirm) even a bill with drinks; a waiter only an empty one. */
    const canDelete = isExtra && !!bill && !bill.paidAt && (token === null || bill.drinks.length === 0)

    async function onDelete() {
        if (busy || extraBillId == null) return
        setBusy(true)
        try {
            await deleteExtraBill(tournamentRef, extraBillId, token, newOpId())
            setDeleteOpen(false)
            onDeleted?.()
        } catch (e) {
            showError(tStatic("tournament.waiter.actionFailed"), waiterErrorText(e, "") || undefined)
        } finally {
            if (mountedRef.current) setBusy(false)
        }
    }

    const isPaid = !!bill?.paidAt
    /* Same freeze rule the backend enforces: a settled bill is closed. */
    const editable = !!bill && !isPaid && !busy

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
                    <Dialog.Content maxW={{ base: "92%", md: "md" }}>
                        <Dialog.Header>
                            <HStack justify="space-between" align="start" gap="2" w="full">
                                <Box minW="0">
                                    <Dialog.Title fontSize="md">{heading}</Dialog.Title>
                                    <Text fontSize="sm" color="fg.muted" lineClamp={2}>
                                        {isExtra ? (bill?.label ?? subheading) : subheading}
                                    </Text>
                                </Box>
                                <HStack gap="2" flexShrink={0}>
                                    {isPaid && (
                                        <Badge colorPalette="green" variant="subtle">
                                            {t("tournament.bill.paid")}
                                        </Badge>
                                    )}
                                    <Dialog.CloseTrigger asChild>
                                        <IconButton
                                            aria-label={t("common.close")}
                                            variant="ghost"
                                            size="sm"
                                            disabled={busy}
                                        >
                                            <FiX />
                                        </IconButton>
                                    </Dialog.CloseTrigger>
                                </HStack>
                            </HStack>
                        </Dialog.Header>

                        <Dialog.Body>
                            {loading || !bill ? (
                                <HStack justify="center" py="6">
                                    <Spinner size="sm" />
                                    <Text fontSize="sm" color="fg.muted">{t("common.loading")}</Text>
                                </HStack>
                            ) : (
                                <VStack align="stretch" gap="3">
                                    {/* "Ostalo" bills are nameable; saved on blur / Enter. */}
                                    {isExtra && !isPaid && (
                                        <Input
                                            size="sm"
                                            value={labelDraft}
                                            onChange={(e) => setLabelDraft(e.target.value)}
                                            onBlur={() => {
                                                if (busy || extraBillId == null) return
                                                if (labelDraft.trim() === (bill.label ?? "")) return
                                                void run(async (opId) =>
                                                    renameExtraBill(tournamentRef, extraBillId, token, labelDraft, opId),
                                                )
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur() }
                                            }}
                                            aria-label={t("tournament.waiter.extra.label")}
                                            placeholder={t("tournament.waiter.extra.labelPlaceholder")}
                                            maxLength={60}
                                            disabled={busy}
                                        />
                                    )}
                                    {/* Drinks already on the bill */}
                                    {bill.drinks.length === 0 ? (
                                        <Text color="fg.muted" fontSize="sm">
                                            {t("tournament.bill.noDrinks")}
                                        </Text>
                                    ) : (
                                        <VStack align="stretch" gap="1">
                                            {bill.drinks.map((d) => (
                                                <HStack
                                                    key={d.id}
                                                    justify="space-between"
                                                    borderBottomWidth="1px"
                                                    borderColor="border.subtle"
                                                    py="1.5"
                                                    gap="2"
                                                >
                                                    <Text fontSize="sm" minW="0" lineClamp={1}>
                                                        {d.name}
                                                        {d.quantity > 1 && (
                                                            <> {t("tournament.bill.quantity", { n: d.quantity })}</>
                                                        )}
                                                    </Text>
                                                    <HStack gap="2" flexShrink={0}>
                                                        <Text fontSize="sm" fontWeight="medium">
                                                            {formatEur(d.lineTotal)}
                                                        </Text>
                                                        {!isPaid && (
                                                            <IconButton
                                                                aria-label={t("tournament.bill.remove")}
                                                                title={t("tournament.bill.remove")}
                                                                size="2xs"
                                                                variant="ghost"
                                                                colorPalette="red"
                                                                disabled={busy}
                                                                onClick={() => void run((opId) =>
                                                                    api.remove(d.id, opId),
                                                                )}
                                                            >
                                                                <FiX />
                                                            </IconButton>
                                                        )}
                                                    </HStack>
                                                </HStack>
                                            ))}
                                        </VStack>
                                    )}

                                    {/* Total */}
                                    <HStack justify="space-between" pt="1">
                                        <Text fontWeight="semibold">{t("tournament.bill.total")}</Text>
                                        <Text fontWeight="bold" fontSize="md">
                                            {formatEur(bill.total)}
                                        </Text>
                                    </HStack>

                                    {/* Who settled it, and when — `paidByName` is
                                        always a display snapshot (the organiser's
                                        name, or a waiter's invited name), never a
                                        raw uid. */}
                                    {isPaid && (
                                        <Text fontSize="xs" color="fg.muted">
                                            {bill.paidByName
                                                ? t("tournament.bill.paidByAt", {
                                                    name: bill.paidByName,
                                                    at: formatDateTime(bill.paidAt),
                                                })
                                                : t("tournament.bill.paidAt", {
                                                    at: formatDateTime(bill.paidAt),
                                                })}
                                        </Text>
                                    )}

                                    {/* Cjenik picker. Same chip shape MatchBillButton
                                        uses, so the two screens read as one feature —
                                        rebuilt here rather than imported, for the
                                        reasons at the top of this file. */}
                                    {!isPaid && (
                                        <Box>
                                            <Text fontSize="sm" color="fg.muted" mb="2" mt="1">
                                                {t("tournament.bill.addDrink")}
                                            </Text>
                                            {cjenik.length === 0 ? (
                                                <Text fontSize="xs" color="fg.muted">
                                                    {t("tournament.bill.noCjenik")}
                                                </Text>
                                            ) : (
                                                <Box display="flex" flexWrap="wrap" gap="2">
                                                    {cjenik.map((p) => (
                                                        <Button
                                                            key={p.id ?? p.name}
                                                            size="xs"
                                                            variant="outline"
                                                            disabled={p.id == null || !editable}
                                                            onClick={() => {
                                                                if (p.id == null) return
                                                                void run((opId) => api.add(p.id as number, opId))
                                                            }}
                                                        >
                                                            {t("tournament.bill.priceChip", {
                                                                name: p.name,
                                                                price: formatEur(p.price),
                                                            })}
                                                        </Button>
                                                    ))}
                                                </Box>
                                            )}
                                        </Box>
                                    )}
                                </VStack>
                            )}
                        </Dialog.Body>

                        <Dialog.Footer gap="2">
                            {canDelete && (
                                <IconButton
                                    aria-label={t("tournament.waiter.extra.delete")}
                                    title={t("tournament.waiter.extra.delete")}
                                    variant="ghost"
                                    colorPalette="red"
                                    disabled={busy}
                                    mr="auto"
                                    onClick={() => {
                                        if (bill && bill.drinks.length > 0) setDeleteOpen(true)
                                        else void onDelete()
                                    }}
                                >
                                    <FiTrash2 />
                                </IconButton>
                            )}
                            <Button variant="ghost" onClick={onClose} disabled={busy}>
                                {t("common.close")}
                            </Button>
                            {bill && (
                                isPaid ? (
                                    <Button
                                        variant="outline"
                                        colorPalette="gray"
                                        loading={busy}
                                        onClick={() => void run((opId) =>
                                            api.paid(false, opId),
                                        )}
                                    >
                                        {t("tournament.bill.unpay")}
                                    </Button>
                                ) : (
                                    <Button
                                        colorPalette="green"
                                        loading={busy}
                                        disabled={bill.drinks.length === 0 || busy}
                                        onClick={() => void run((opId) =>
                                            api.paid(true, opId),
                                        )}
                                    >
                                        {t("tournament.bill.markPaid")}
                                    </Button>
                                )
                            )}
                        </Dialog.Footer>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Portal>
            <ConfirmDialog
                open={deleteOpen}
                title={t("tournament.waiter.extra.deleteTitle")}
                description={t("tournament.waiter.extra.deleteBody")}
                confirmLabel={t("tournament.waiter.extra.deleteConfirm")}
                destructive
                busy={busy}
                onConfirm={() => void onDelete()}
                onCancel={() => setDeleteOpen(false)}
            />
        </Dialog.Root>
    )
}
