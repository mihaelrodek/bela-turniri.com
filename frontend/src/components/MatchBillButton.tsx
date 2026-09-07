import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
    Badge,
    Box,
    Button,
    Dialog,
    HStack,
    IconButton,
    Spinner,
    Text,
    VStack,
} from "@chakra-ui/react"
import {
    type DrinkPriceDto,
    type MatchBillDto,
    type MatchDrinkDto,
    fetchMatchBill,
    fetchTournamentCjenik,
} from "../api/cjenik"
import {
    type QueuedOp,
    subscribeToOutcomes,
    useOfflineQueue,
} from "../hooks/useOfflineQueue"
import { formatDateTime, formatEur } from "../utils/format"
// `tStatic` is the non-reactive translator, for the module-scope replay
// helper below. Components in this file use `useTranslation()`.
import { t as tStatic, useTranslation } from "../i18n"

/** The bill kinds the offline queue carries, narrowed to one match. */
type BillOp = Extract<QueuedOp, { kind: "billAddDrink" | "billRemoveDrink" | "billPay" | "billUnpay" }>

function isBillOpForMatch(op: QueuedOp, matchId: number): op is BillOp {
    switch (op.kind) {
        case "billAddDrink":
        case "billRemoveDrink":
        case "billPay":
        case "billUnpay":
            return op.payload.matchId === matchId
        default:
            return false
    }
}

/**
 * Render the bill as the bartender should see it: the server's last word
 * with every still-queued change replayed on top, in order.
 *
 * Without this, adding a beer with no signal would look like nothing
 * happened — and the bartender would tap again, and again. Optimistic drink
 * rows get a NEGATIVE id, the same convention the rest of the app uses for
 * "exists on screen, not yet on the server"; they cannot be removed until
 * they land, because there is no server row to delete yet.
 */
function withPendingBillOps(
    base: MatchBillDto | null,
    ops: BillOp[],
    cjenik: DrinkPriceDto[],
): MatchBillDto | null {
    if (!base || ops.length === 0) return base
    let drinks: MatchDrinkDto[] = base.drinks
    let paidAt = base.paidAt ?? null
    let optimisticId = -1
    for (const op of ops) {
        switch (op.kind) {
            case "billAddDrink": {
                const price = cjenik.find((p) => p.id === op.payload.priceId)
                const unit = Number(price?.price ?? 0)
                drinks = [...drinks, {
                    id: optimisticId--,
                    priceId: op.payload.priceId,
                    name: price?.name ?? tStatic("tournament.bill.genericDrink"),
                    unitPrice: unit,
                    quantity: op.payload.quantity,
                    lineTotal: unit * op.payload.quantity,
                    createdAt: new Date(op.createdAt).toISOString(),
                }]
                break
            }
            case "billRemoveDrink":
                drinks = drinks.filter((d) => d.id !== op.payload.drinkId)
                break
            case "billPay":
                paidAt = new Date(op.createdAt).toISOString()
                break
            case "billUnpay":
                paidAt = null
                break
        }
    }
    const total = drinks.reduce((sum, d) => sum + Number(d.lineTotal ?? 0), 0)
    return { ...base, drinks, total, paidAt }
}

type Props = {
    tournamentRef: string
    matchId: number
    /** True if this is a BYE match (pair2 missing) — we skip rendering. */
    isBye: boolean
    /** True if match status is FINISHED. Drives 'Loser pays' label. */
    isFinished: boolean
    /** Already-known paidAt from MatchDto so we don't always fetch the bill. */
    paidAt?: string | null
    /** True for owner/admin — gates write actions and the trigger button. */
    canEdit: boolean
    /**
     * True if the current user submitted one of the two pairs in this
     * match. Participants can see their bill (running total during play
     * + paid status afterwards). Non-participants see nothing about the
     * bill — that's a privacy requirement.
     */
    isParticipant: boolean
    /**
     * When set and equal to this match's id, the bill modal auto-opens
     * once on mount. Used by the push-notification deep-link:
     * /tournaments/{ref}?bill={matchId} → user taps notification →
     * lands on this page → modal opens straight into the bill.
     */
    autoOpenBillId?: number | null
    /**
     * Called after any mutation. Receives the fresh paidAt so the
     * parent can patch its match-list state without a full rounds refetch.
     */
    onChange?: (paidAt: string | null) => void
}

/**
 * Per-match drink-bill button.
 *
 *   Owner: shows "Računi (€X.YZ)" pill that opens a modal with full bill
 *          management — pick from cjenik to add a drink, remove a drink,
 *          mark paid / unpay.
 *   Non-owner: only renders if the bill is already paid — surfaces a
 *          "Plaćeno" badge so players can see the match got settled.
 *          BYE matches render nothing.
 */
export default function MatchBillButton({
    tournamentRef,
    matchId,
    isBye,
    isFinished,
    paidAt,
    canEdit,
    isParticipant,
    autoOpenBillId,
    onChange,
}: Props) {
    const { t } = useTranslation()
    const [open, setOpen] = useState(false)
    const [bill, setBill] = useState<MatchBillDto | null>(null)
    const [cjenik, setCjenik] = useState<DrinkPriceDto[]>([])
    const [loading, setLoading] = useState(false)
    // Guard against React StrictMode double-invoking the effect in dev.
    const autoOpenedRef = useRef(false)
    // Monotonic request token. Every fetch captures the value it started
    // with and drops its result if a newer fetch has since bumped the
    // counter — otherwise a slow bill response for match A can land after
    // the user already opened match B and overwrite it. Unmount is tracked
    // separately (mountedRef): bumping the request token on unmount used to
    // strand the spinner under StrictMode, where the effect's cleanup runs
    // between the first and second mount and invalidated the live fetch.
    const reqRef = useRef(0)
    const mountedRef = useRef(true)

    useEffect(() => {
        mountedRef.current = true
        return () => { mountedRef.current = false }
    }, [])

    /* ---------- The offline queue ----------
       Bill writes are typed at the table, on the same failing Wi-Fi as the
       scores, so they go into the queue rather than straight down the wire:
       enqueue is synchronous and never fails, the drain sends them in the
       order they were tapped, and each carries an X-Client-Op-Id so a replay
       cannot put the same rakija on the bill twice. There is no `busy` latch
       any more — there is nothing to wait for, and double-tapping now means
       two drinks because that is what the bartender actually did. */
    const { pending, enqueue } = useOfflineQueue(tournamentRef)

    const pendingBillOps = useMemo(
        () => pending.filter((op): op is BillOp => isBillOpForMatch(op, matchId)),
        [pending, matchId],
    )

    /**
     * What the bartender sees: the server's last word with every still-queued
     * change replayed on top. This is also what keeps the row visually
     * pending — the optimistic drinks and paid flag survive every refetch
     * below, because they are re-applied after it rather than stored in it.
     */
    const view = useMemo(
        () => withPendingBillOps(bill, pendingBillOps, cjenik),
        [bill, pendingBillOps, cjenik],
    )

    const refresh = useCallback(async () => {
        const token = ++reqRef.current
        setLoading(true)
        try {
            const [b, c] = await Promise.all([
                fetchMatchBill(tournamentRef, matchId),
                canEdit
                    ? fetchTournamentCjenik(tournamentRef)
                    : Promise.resolve([] as DrinkPriceDto[]),
            ])
            if (token !== reqRef.current || !mountedRef.current) return
            setBill(b)
            setCjenik(c)
        } catch (err) {
            // Interceptor already toasted (these calls are `silent`, so a
            // failure just leaves the modal on its spinner-less empty state).
            if (token === reqRef.current) console.warn("Dohvat računa nije uspio", err)
        } finally {
            // Ungated on the mount flag on purpose — the spinner must always
            // be cleared for the request that is still the current one.
            if (token === reqRef.current) setLoading(false)
        }
    }, [tournamentRef, matchId, canEdit])

    // Auto-open from push deep-link: when our matchId is what the URL
    // pointed at, fire the open + refresh exactly once. Skipped for BYE
    // matches and non-participants (covered by the early returns below
    // — by the time the component renders, those cases never reach
    // this effect because the trigger isn't rendered).
    useEffect(() => {
        if (autoOpenedRef.current) return
        if (autoOpenBillId == null || autoOpenBillId !== matchId) return
        // Same gating the trigger uses — don't waste a fetch on a match
        // the current user wouldn't be allowed to see anyway.
        if (isBye) return
        if (!canEdit && !isParticipant) return
        autoOpenedRef.current = true
        // Run the same handler the click would run.
        setOpen(true)
        void refresh()
    }, [autoOpenBillId, matchId, canEdit, isBye, isParticipant, refresh])

    // `onChange` is usually an inline arrow from the parent row, so it would
    // re-subscribe on every render of the round list. Mirror it instead.
    const onChangeRef = useRef(onChange)
    onChangeRef.current = onChange

    /* ---------- Where the queue's answer lands ----------
       Each of the four bill endpoints returns the whole recomputed
       MatchBillDto, so a confirmed op replaces the local base outright — no
       patching, no drift. The op has just left `pending`, so the optimistic
       copy of it disappears in the same update and the row stops looking
       pending exactly when it stops being pending.

       A dropped op (the server rejected it: bill already locked, drink gone)
       means the optimistic bill on screen is now a lie. The queue has
       already said WHAT was dropped, so all this has to do is resync. */
    useEffect(() => {
        return subscribeToOutcomes((outcome) => {
            if (!isBillOpForMatch(outcome.op, matchId)) return
            if (outcome.op.tournamentUuid !== tournamentRef) return
            if (!mountedRef.current) return
            if (outcome.status === "dropped") {
                void refresh()
                return
            }
            const fresh = outcome.data as MatchBillDto | null
            if (!fresh) return
            // Claim the request token so a bill fetch still in flight — one
            // started before this op was sent — cannot overwrite the newer
            // answer we just got. Clearing `loading` here too: that fetch
            // will now skip its own finally-branch.
            reqRef.current += 1
            setBill(fresh)
            setLoading(false)
            onChangeRef.current?.(fresh.paidAt ?? null)
        })
    }, [matchId, tournamentRef, refresh])

    // BYE matches have no opponent — there's no shared table to settle.
    if (isBye) return null

    // Privacy: only owner/bartender and players who were AT this table see
    // anything about the bill. Everyone else gets no badge, no button,
    // no peek at prices.
    if (!canEdit && !isParticipant) return null

    const onOpen = async () => {
        setOpen(true)
        await refresh()
    }

    /*
     * All four handlers are fire-and-forget. `enqueue` writes to
     * localStorage and kicks the drain synchronously, so the tap is
     * acknowledged on screen (through `view`) whether or not there is any
     * signal — which is the entire point of the feature.
     */

    const handleAdd = (priceId: number) => {
        enqueue("billAddDrink", { matchId, priceId, quantity: 1 })
    }

    const handleRemove = (drinkId: number) => {
        // Optimistic rows carry a negative id and have no server row to
        // delete yet. The button is not rendered for them; this is the
        // belt-and-braces half.
        if (drinkId < 0) return
        enqueue("billRemoveDrink", { matchId, drinkId })
    }

    const handlePay = () => {
        enqueue("billPay", { matchId })
        // Tell the parent row now rather than on confirmation: its "Plaćeno"
        // chip has to move with the modal, and the queue's own answer will
        // overwrite this with the server's timestamp when it lands.
        onChange?.(new Date().toISOString())
    }

    const handleUnpay = () => {
        enqueue("billUnpay", { matchId })
        onChange?.(null)
    }

    // ----- Trigger -----
    // Same control shape for owner and participants — just a tappable
    // chip that shows current status. The modal underneath gates
    // edit vs. read-only via `canEdit`.
    // Once the bill is fetched it is the authority: an unpaid fetched bill
    // must win over a stale `paidAt` prop. `??` would have fallen through to
    // the prop whenever bill.paidAt was null, showing "Plaćeno" on a bill the
    // organiser just un-paid. `view`, not `bill`, so a queued pay/unpay shows
    // immediately instead of waiting for a connection.
    const isPaid = view ? !!view.paidAt : !!paidAt
    const pendingCount = pendingBillOps.length
    const trigger = (
        <Button
            size="xs"
            variant={isPaid ? "outline" : "subtle"}
            colorPalette={isPaid ? "green" : "blue"}
            onClick={onOpen}
        >
            {isPaid ? t("tournament.bill.paid") : t("tournament.bill.button")}
        </Button>
    )

    return (
        <>
            {trigger}

            <Dialog.Root
                open={open}
                onOpenChange={(e) => { if (!e.open) setOpen(false) }}
            >
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content maxW="md">
                        <Dialog.Header>
                            <HStack justify="space-between" w="100%">
                                <Text fontWeight="semibold">{t("tournament.bill.dialogTitle")}</Text>
                                <HStack gap="2">
                                    {/* Quiet, local counterpart to SyncIndicator: the
                                        drinks above are already on screen, this says
                                        they have not reached the server yet. */}
                                    {pendingCount > 0 && (
                                        <Text fontSize="xs" color="fg.muted">
                                            {t("tournament.pendingSave")}
                                        </Text>
                                    )}
                                    {isPaid && (
                                        <Badge colorPalette="green" variant="subtle">{t("tournament.bill.paid")}</Badge>
                                    )}
                                </HStack>
                            </HStack>
                        </Dialog.Header>
                        <Dialog.Body>
                            {loading || !view ? (
                                <HStack justify="center" py="6">
                                    <Spinner size="sm" />
                                    <Text fontSize="sm" color="fg.muted">{t("common.loading")}</Text>
                                </HStack>
                            ) : (
                                <BillBody
                                    bill={view}
                                    cjenik={cjenik}
                                    isFinished={isFinished}
                                    canEdit={canEdit}
                                    onAdd={handleAdd}
                                    onRemove={handleRemove}
                                />
                            )}
                        </Dialog.Body>
                        <Dialog.Footer>
                            <Button
                                variant="ghost"
                                onClick={() => setOpen(false)}
                            >
                                {t("common.close")}
                            </Button>
                            {canEdit && view && (
                                isPaid ? (
                                    <Button
                                        colorPalette="gray"
                                        variant="outline"
                                        onClick={handleUnpay}
                                    >
                                        {t("tournament.bill.unpay")}
                                    </Button>
                                ) : (
                                    <Button
                                        colorPalette="green"
                                        onClick={handlePay}
                                        disabled={view.drinks.length === 0}
                                    >
                                        {t("tournament.bill.markPaid")}
                                    </Button>
                                )
                            )}
                        </Dialog.Footer>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Dialog.Root>
        </>
    )
}

/* ============================================================
   Bill body — list of drinks + cjenik picker
   ============================================================ */

function BillBody({
    bill,
    cjenik,
    isFinished,
    canEdit,
    onAdd,
    onRemove,
}: {
    /** The server bill with every still-queued change replayed on top. */
    bill: MatchBillDto
    cjenik: DrinkPriceDto[]
    isFinished: boolean
    canEdit: boolean
    onAdd: (priceId: number) => void
    onRemove: (drinkId: number) => void
}) {
    const { t } = useTranslation()
    return (
        <VStack align="stretch" gap="3">
            {/* Loser banner: only after match finishes */}
            {isFinished && bill.loserPairName && (
                <Box
                    colorPalette="orange"
                    p="2.5"
                    rounded="md"
                    bg="colorPalette.subtle"
                    borderWidth="1px"
                    borderColor="colorPalette.muted"
                >
                    <Text fontSize="sm">
                        <b>{t("tournament.bill.payer")}</b> {bill.loserPairName}
                    </Text>
                </Box>
            )}

            {/* Drinks list */}
            {bill.drinks.length === 0 ? (
                <Text color="fg.muted" fontSize="sm">{t("tournament.bill.noDrinks")}</Text>
            ) : (
                <VStack align="stretch" gap="1">
                    {bill.drinks.map((d) => (
                        <HStack
                            key={d.id}
                            justify="space-between"
                            borderBottomWidth="1px"
                            borderColor="border.subtle"
                            py="1"
                        >
                            <Text
                                fontSize="sm"
                                // A negative id is an optimistic row: added
                                // here, not yet acknowledged by the server.
                                color={d.id < 0 ? "fg.muted" : undefined}
                            >
                                {d.name}
                                {d.quantity > 1 && <> {t("tournament.bill.quantity", { n: d.quantity })}</>}
                            </Text>
                            <HStack gap="2">
                                <Text fontSize="sm" fontWeight="medium">
                                    {formatEur(d.lineTotal)}
                                </Text>
                                {/* Remove allowed only when bill isn't
                                    marked paid yet — same freeze rule the
                                    backend enforces — and never for a row
                                    that is still queued: there is no server
                                    row to delete, and the add it would have
                                    to cancel is already on its way. */}
                                {canEdit && !bill.paidAt && d.id > 0 && (
                                    <IconButton
                                        aria-label={t("tournament.bill.remove")}
                                        size="2xs"
                                        variant="ghost"
                                        colorPalette="red"
                                        onClick={() => onRemove(d.id)}
                                    >
                                        ×
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

            {/* Who settled it, and when — `paidByName` is always a display
                snapshot (the organiser's name, or a waiter's invited name),
                never a raw uid. */}
            {!!bill.paidAt && (
                <Text fontSize="xs" color="fg.muted">
                    {bill.paidByName
                        ? t("tournament.bill.paidByAt", {
                            name: bill.paidByName,
                            at: formatDateTime(bill.paidAt),
                        })
                        : t("tournament.bill.paidAt", { at: formatDateTime(bill.paidAt) })}
                </Text>
            )}

            {/* Cjenik picker — owner only, when not yet paid */}
            {canEdit && !bill.paidAt && (
                <Box>
                    <Text fontSize="sm" color="fg.muted" mb="2" mt="2">
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
                                    onClick={() => p.id != null && onAdd(p.id)}
                                    disabled={p.id == null}
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
    )
}
