import { useCallback, useEffect, useMemo, useState } from "react"
import {
    Badge,
    Box,
    Button,
    HStack,
    IconButton,
    Spinner,
    Text,
    VStack,
} from "@chakra-ui/react"
import {
    FiChevronDown,
    FiChevronRight,
    FiDollarSign,
    FiGrid,
    FiLink,
    FiLogOut,
    FiTrash2,
    FiUserPlus,
    FiCreditCard,
} from "react-icons/fi"
import {
    type WaiterBillRowDto,
    type WaiterDto,
    fetchWaiterBills,
    listWaiters,
    revokeAllWaiters,
    revokeWaiter,
    waiterErrorText,
} from "../api/waiterAccess"
import type { MatchBillDto } from "../api/cjenik"
import { useWaiterSession } from "../hooks/useWaiterSession"
import { useLiveSocket } from "../hooks/useLiveSocket"
import { usePolling } from "../hooks/usePolling"
import { formatEur } from "../utils/format"
import { showError, showSuccess } from "../toaster"
/* `tStatic` is the non-reactive translator. The data callbacks below are
   listed in effect dependency arrays, so they must keep a stable identity —
   and `useTranslation()`'s `t` is a fresh closure on every render, which would
   make the bill-loading effect re-fire (and re-fetch) forever. Nothing is
   lost: `tStatic` reads the same module-level locale, at the moment the
   message is actually needed. Same precedent as this page's `matchRow`. */
import { t as tStatic, usePlural, useTranslation } from "../i18n"
import ConfirmDialog from "./ConfirmDialog"
import EmptyState from "./EmptyState"
import { CounterChip } from "./PairsSection"
import WaiterBillDialog from "./WaiterBillDialog"
import WaiterInviteDialog, { WaiterCodeChip } from "./WaiterInviteDialog"

/* ──────────────────────────────────────────────────────────────────────────
   RacuniSection — the Računi tab.

   TWO READERS, ONE LIST
   ─────────────────────
   • The organiser (`canEdit`) gets a waiter-management panel on top — invite
     a named person, see everyone with active access, revoke one or all —
     and the same bill list underneath, because they settle bills at the
     bar too.
   • A waiter gets the list alone, scoped to whichever code they typed in.

   NO SELF-REDEEM ANYMORE
   ───────────────────────
   The single-code design used to have the organiser silently redeem their
   OWN code so they could read the token-only bill list through the same
   path a waiter uses. That stopped making sense once a tournament could
   have several different named codes and no single "the" code to redeem —
   and it stopped being NECESSARY the moment the backend grew a second entry
   into `WaiterBillController`: `WaiterAccessService#authorizeBillAccess`
   accepts the organiser's ordinary Firebase bearer directly. So `token` is
   `null` for the organiser on every bill call below — see `api/waiterAccess`'s
   `billConfig`.

   LIVE, LIKE THE REST OF THE PAGE
   ────────────────────────────────
   `WaiterBillController`'s three mutating endpoints all end up in
   `MatchBillService`, which pings `LiveBroadcaster` (scope "match") after
   every commit — the same signal a score or a drink already sends. So this
   list plugs into the same `useLiveSocket` the rest of the tournament page
   uses and reloads on that ping: a waiter settling table 4 shows up on the
   organiser's phone (or another waiter's) without anyone tapping refresh.
   `usePolling` is the fallback for a socket that never connects (old
   browser, a proxy stripping the upgrade) — same shape as the page's own
   poll, just backed off further while the socket is up.
   ────────────────────────────────────────────────────────────────────── */

/** A round and its bills, in table order — the shape the list renders. */
type BillGroup = {
    roundNumber: number
    rows: WaiterBillRowDto[]
}

/** HTTP status of an axios-shaped rejection, or null for a network error. */
function statusOf(e: unknown): number | null {
    const status = (e as { response?: { status?: unknown } } | null)?.response?.status
    return typeof status === "number" ? status : null
}

export default function RacuniSection({
    tournamentUuid,
    tournamentSlug,
    canEdit,
}: {
    tournamentUuid: string
    tournamentSlug?: string | null
    /** True for the organiser/admin — unlocks the waiter-management panel. */
    canEdit: boolean
}) {
    const { t } = useTranslation()
    const plural = usePlural()
    const { token, clear } = useWaiterSession(tournamentUuid)

    /* ---------- Organiser: the waiter list ---------- */
    const [waiters, setWaiters] = useState<WaiterDto[]>([])
    const [waitersLoading, setWaitersLoading] = useState(true)
    const [inviteOpen, setInviteOpen] = useState(false)
    const [revokeTarget, setRevokeTarget] = useState<WaiterDto | null>(null)
    const [revokingOne, setRevokingOne] = useState(false)
    const [revokeAllOpen, setRevokeAllOpen] = useState(false)
    const [revokingAll, setRevokingAll] = useState(false)

    const loadWaiters = useCallback(async () => {
        if (!canEdit) return
        setWaitersLoading(true)
        try {
            setWaiters(await listWaiters(tournamentUuid))
        } catch (e) {
            showError(tStatic("tournament.waiter.manage.loadFailed"), waiterErrorText(e, "") || undefined)
        } finally {
            setWaitersLoading(false)
        }
    }, [canEdit, tournamentUuid])

    useEffect(() => { void loadWaiters() }, [loadWaiters])

    const inviteLink = useCallback((code: string) =>
        `${window.location.origin}/turniri/${tournamentSlug ?? tournamentUuid}/racuni?kod=${code}`,
    [tournamentSlug, tournamentUuid])

    async function copy(value: string, okMessage: string) {
        try {
            await navigator.clipboard.writeText(value)
            showSuccess(okMessage)
        } catch {
            showError(t("common.clipboard.copyFailed"), t("common.qr.copyFailedDescription"))
        }
    }

    async function onRevokeOne() {
        if (!revokeTarget || revokingOne) return
        setRevokingOne(true)
        try {
            await revokeWaiter(tournamentUuid, revokeTarget.id)
            setWaiters((ws) => ws.filter((w) => w.id !== revokeTarget.id))
            setRevokeTarget(null)
        } catch (e) {
            showError(t("tournament.waiter.manage.revokeFailed"), waiterErrorText(e, "") || undefined)
        } finally {
            setRevokingOne(false)
        }
    }

    async function onRevokeAll() {
        if (revokingAll) return
        setRevokingAll(true)
        try {
            await revokeAllWaiters(tournamentUuid)
            setWaiters([])
            setRevokeAllOpen(false)
        } catch (e) {
            showError(t("tournament.waiter.manage.revokeAllFailed"), waiterErrorText(e, "") || undefined)
        } finally {
            setRevokingAll(false)
        }
    }

    /* ---------- The bill list ---------- */
    // Organiser reads with no token at all (their own Firebase session is
    // authorisation enough — see the file banner); a waiter needs a live one.
    const canLoadBills = canEdit || !!token
    const billToken = canEdit ? null : token

    const [bills, setBills] = useState<WaiterBillRowDto[]>([])
    const [loading, setLoading] = useState(true)
    const [selected, setSelected] = useState<WaiterBillRowDto | null>(null)
    /* Manual declutter, not automatic: a paid row stays exactly as shown
       until the reader collapses it themselves — see the file banner and
       the round toggle below for the "sažmi kad smeta" ask. */
    const [collapsedRounds, setCollapsedRounds] = useState<Record<number, boolean>>({})
    const [expandedPaidRows, setExpandedPaidRows] = useState<Record<number, boolean>>({})

    const loadBills = useCallback(async () => {
        if (!canLoadBills) return
        setLoading(true)
        try {
            setBills(await fetchWaiterBills(tournamentUuid, billToken))
        } catch (e) {
            const status = statusOf(e)
            if (!canEdit && (status === 401 || status === 403)) {
                // This device's code was revoked (or expired). Drop it: the
                // page swaps this section back for the code gate on its own.
                clear()
                return
            }
            showError(tStatic("tournament.waiter.list.loadFailed"), waiterErrorText(e, "") || undefined)
        } finally {
            setLoading(false)
        }
    }, [tournamentUuid, canLoadBills, billToken, canEdit, clear])

    useEffect(() => {
        if (!canLoadBills) setBills([])
    }, [canLoadBills])

    const { connected: liveConnected } = useLiveSocket(
        canLoadBills ? tournamentUuid : undefined,
        (scope) => { if (scope === "match") void loadBills() },
    )

    usePolling(
        () => void loadBills(),
        // With the socket up, the poll is only a safety net against a missed
        // ping; without it, it's the only way this list learns anything.
        liveConnected ? 120_000 : 20_000,
        canLoadBills,
    )

    /* ---------- Derived ---------- */
    const unpaidCount = useMemo(() => bills.filter((b) => !b.paid).length, [bills])

    /** Grouped by round, rounds ascending, tables ascending inside each. The
     *  backend already orders it that way; the grouping is presentational and
     *  the sort is belt-and-braces so a reordered response cannot scramble it. */
    const groups: BillGroup[] = useMemo(() => {
        const byRound = new Map<number, WaiterBillRowDto[]>()
        for (const b of bills) {
            const list = byRound.get(b.roundNumber)
            if (list) list.push(b)
            else byRound.set(b.roundNumber, [b])
        }
        return [...byRound.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([roundNumber, rows]) => ({
                roundNumber,
                rows: [...rows].sort((x, y) => (x.tableNo ?? 0) - (y.tableNo ?? 0)),
            }))
    }, [bills])

    /** Patch one row from a bill the dialog just wrote, so the list repaints
     *  without a second round trip to the whole collection. */
    const onBillChanged = useCallback((fresh: MatchBillDto) => {
        setBills((rs) => rs.map((r) => (
            r.matchId !== fresh.matchId ? r : {
                ...r,
                total: fresh.total,
                paid: !!fresh.paidAt,
                paidAt: fresh.paidAt ?? null,
                drinkCount: fresh.drinks.length,
            }
        )))
    }, [])

    const rowLabel = (b: WaiterBillRowDto) =>
        b.tableNo != null
            ? t("tournament.table", { n: b.tableNo })
            : t("tournament.bracket.bye")

    const rowPairs = (b: WaiterBillRowDto) =>
        t("tournament.waiter.list.versus", {
            a: b.pair1Name ?? "—",
            b: b.pair2Name ?? "—",
        })

    const toggleRound = (roundNumber: number) =>
        setCollapsedRounds((c) => ({ ...c, [roundNumber]: !c[roundNumber] }))

    const togglePaidRow = (matchId: number) =>
        setExpandedPaidRows((e) => ({ ...e, [matchId]: !e[matchId] }))

    return (
        <VStack align="stretch" gap="4">
            {/* ===== Organiser: waiter management ===== */}
            {canEdit && (
                <Box
                    bg="bg.panel"
                    borderWidth="1px"
                    borderColor="border.subtle"
                    rounded="xl"
                    shadow="card"
                    p={{ base: "4", md: "5" }}
                >
                    <VStack align="stretch" gap="3">
                        <HStack justify="space-between" align="start" gap="2" wrap="wrap">
                            <Box>
                                <HStack gap="2" align="center" mb="1">
                                    <Box color="brand.fg" display="flex" alignItems="center">
                                        <FiCreditCard size={15} />
                                    </Box>
                                    <Text fontWeight="semibold">{t("tournament.waiter.manage.heading")}</Text>
                                </HStack>
                                <Text fontSize="sm" color="fg.muted" maxW="lg">
                                    {t("tournament.waiter.manage.description")}
                                </Text>
                            </Box>
                            <HStack gap="2" flexShrink={0}>
                                {waiters.length > 0 && (
                                    <Button
                                        size="xs"
                                        variant="outline"
                                        colorPalette="red"
                                        onClick={() => setRevokeAllOpen(true)}
                                    >
                                        <FiTrash2 /> {t("tournament.waiter.manage.revokeAll")}
                                    </Button>
                                )}
                                <Button
                                    size="xs"
                                    colorPalette="blue"
                                    onClick={() => setInviteOpen(true)}
                                >
                                    <FiUserPlus /> {t("tournament.waiter.manage.invite")}
                                </Button>
                            </HStack>
                        </HStack>

                        {waitersLoading && waiters.length === 0 ? (
                            <HStack justify="center" py="4" gap="2">
                                <Spinner size="sm" />
                                <Text fontSize="sm" color="fg.muted">{t("common.loading")}</Text>
                            </HStack>
                        ) : waiters.length === 0 ? (
                            <EmptyState
                                compact
                                icon={FiUserPlus}
                                title={t("tournament.waiter.manage.emptyTitle")}
                                description={t("tournament.waiter.manage.emptyDescription")}
                            />
                        ) : (
                            <VStack align="stretch" gap="2">
                                {waiters.map((w) => (
                                    <HStack
                                        key={w.id}
                                        justify="space-between"
                                        wrap="wrap"
                                        gap="2"
                                        borderWidth="1px"
                                        borderColor="border.subtle"
                                        rounded="lg"
                                        px="3"
                                        py="2"
                                    >
                                        <HStack gap="1.5" minW="3.5rem" flex="1">
                                            <Text fontWeight="medium" minW="0" truncate>
                                                {w.name}
                                            </Text>
                                            {w.canEditCjenik && (
                                                <Badge
                                                    variant="subtle"
                                                    colorPalette="brand"
                                                    size="sm"
                                                    flexShrink={0}
                                                >
                                                    {t("tournament.waiter.manage.headWaiterBadge")}
                                                </Badge>
                                            )}
                                        </HStack>
                                        <HStack gap="1" flexShrink={0}>
                                            <WaiterCodeChip code={w.code} size="sm" />
                                            <IconButton
                                                aria-label={t("tournament.waiter.manage.copyLink")}
                                                title={t("tournament.waiter.manage.copyLink")}
                                                size="xs"
                                                variant="ghost"
                                                onClick={() => void copy(
                                                    inviteLink(w.code),
                                                    t("tournament.waiter.manage.linkCopied"),
                                                )}
                                            >
                                                <FiLink />
                                            </IconButton>
                                            <IconButton
                                                aria-label={t("tournament.waiter.manage.revokeOne")}
                                                title={t("tournament.waiter.manage.revokeOne")}
                                                size="xs"
                                                variant="ghost"
                                                colorPalette="red"
                                                onClick={() => setRevokeTarget(w)}
                                            >
                                                <FiTrash2 />
                                            </IconButton>
                                        </HStack>
                                    </HStack>
                                ))}
                            </VStack>
                        )}
                    </VStack>
                </Box>
            )}

            {/* ===== Header strip: counters left, list actions right ===== */}
            <HStack justify="space-between" align="center" gap="2" rowGap="2">
                <HStack gap="2" wrap="wrap" minW="0" flex="1">
                    <CounterChip
                        icon={<FiGrid size={13} />}
                        value={bills.length}
                        label={plural("tournament.waiter.chip.bills", bills.length)}
                    />
                    <CounterChip
                        icon={<FiDollarSign size={13} />}
                        value={unpaidCount}
                        label={plural("tournament.waiter.chip.unpaid", unpaidCount)}
                        palette={unpaidCount === 0 && bills.length > 0 ? "green" : "yellow"}
                    />
                </HStack>
                <HStack gap="2" flexShrink={0}>
                    {/* A waiter's phone would otherwise carry this tournament's
                        Računi tab forever. The organiser has no use for it —
                        they never held a session to begin with. */}
                    {!canEdit && (
                        <Button size="xs" variant="ghost" onClick={clear}>
                            <FiLogOut /> {t("tournament.waiter.exit")}
                        </Button>
                    )}
                </HStack>
            </HStack>

            {/* ===== The list ===== */}
            {loading && bills.length === 0 ? (
                <HStack justify="center" py="10" gap="2">
                    <Spinner size="sm" />
                    <Text fontSize="sm" color="fg.muted">{t("common.loading")}</Text>
                </HStack>
            ) : bills.length === 0 ? (
                <Box
                    borderWidth="1px"
                    borderColor="border.subtle"
                    borderStyle="dashed"
                    rounded="xl"
                >
                    <EmptyState
                        compact
                        icon={FiCreditCard}
                        title={t("tournament.waiter.list.emptyTitle")}
                        description={t("tournament.waiter.list.emptyDescription")}
                    />
                </Box>
            ) : (
                <VStack align="stretch" gap="4">
                    {groups.map((g) => {
                        const roundCollapsed = !!collapsedRounds[g.roundNumber]
                        const unpaidInRound = g.rows.filter((r) => !r.paid).length
                        return (
                            <Box key={g.roundNumber}>
                                <HStack
                                    as="button"
                                    onClick={() => toggleRound(g.roundNumber)}
                                    gap="1.5"
                                    mb="1.5"
                                    cursor="pointer"
                                    w="full"
                                >
                                    <Box color="fg.muted" display="flex" alignItems="center">
                                        {roundCollapsed ? <FiChevronRight size={14} /> : <FiChevronDown size={14} />}
                                    </Box>
                                    <Text
                                        fontSize="2xs"
                                        fontWeight="semibold"
                                        color="fg.muted"
                                        letterSpacing="wider"
                                        textTransform="uppercase"
                                    >
                                        {t("tournament.round.heading", { n: g.roundNumber })}
                                    </Text>
                                    {roundCollapsed && unpaidInRound > 0 && (
                                        <Badge variant="subtle" colorPalette="yellow" size="sm">
                                            {plural("tournament.waiter.chip.unpaid", unpaidInRound)}
                                        </Badge>
                                    )}
                                </HStack>
                                {!roundCollapsed && (
                                    <VStack align="stretch" gap="2">
                                        {g.rows.map((b) => {
                                            const expanded = !b.paid || !!expandedPaidRows[b.matchId]
                                            if (!expanded) {
                                                return (
                                                    <HStack
                                                        key={b.matchId}
                                                        as="button"
                                                        onClick={() => togglePaidRow(b.matchId)}
                                                        justify="space-between"
                                                        gap="2"
                                                        borderWidth="1px"
                                                        borderColor="border.subtle"
                                                        borderLeftWidth="3px"
                                                        borderLeftColor="green.solid"
                                                        rounded="md"
                                                        bg="bg.panel"
                                                        opacity={0.65}
                                                        px="2.5"
                                                        py="1"
                                                        cursor="pointer"
                                                        aria-label={t("tournament.waiter.list.expandPaid")}
                                                        title={t("tournament.waiter.list.expandPaid")}
                                                    >
                                                        <HStack gap="2" minW="0" flex="1">
                                                            <Badge variant="subtle" colorPalette="gray" size="sm" flexShrink={0}>
                                                                {rowLabel(b)}
                                                            </Badge>
                                                            <Text fontSize="xs" minW="0" lineClamp={1} color="fg.subtle">
                                                                {rowPairs(b)}
                                                            </Text>
                                                        </HStack>
                                                        <HStack gap="2" flexShrink={0}>
                                                            <Text fontSize="xs" fontWeight="semibold" fontVariantNumeric="tabular-nums" color="fg.muted">
                                                                {formatEur(b.total)}
                                                            </Text>
                                                            <FiChevronRight size={13} color="var(--chakra-colors-fg-muted)" />
                                                        </HStack>
                                                    </HStack>
                                                )
                                            }
                                            return (
                                                <Box
                                                    key={b.matchId}
                                                    borderWidth="1px"
                                                    borderColor={b.paid ? "border.subtle" : "border.emphasized"}
                                                    borderLeftWidth="3px"
                                                    borderLeftColor={b.paid ? "green.solid" : "yellow.solid"}
                                                    rounded="md"
                                                    bg="bg.panel"
                                                    // A settled bill is done with: it stays
                                                    // readable but stops competing with the
                                                    // ones still owing, the same "finished
                                                    // reads muted" rule the cards use.
                                                    opacity={b.paid ? 0.65 : 1}
                                                    px="2.5"
                                                    py="2"
                                                    display="flex"
                                                    flexDirection={{ base: "column", sm: "row" }}
                                                    alignItems={{ base: "stretch", sm: "center" }}
                                                    gap="2"
                                                >
                                                    <HStack gap="2" minW="0" flex="1">
                                                        <Badge
                                                            variant="subtle"
                                                            colorPalette="gray"
                                                            size="sm"
                                                            flexShrink={0}
                                                        >
                                                            {rowLabel(b)}
                                                        </Badge>
                                                        <Text fontSize="sm" minW="0" lineClamp={1} color="fg.soft">
                                                            {rowPairs(b)}
                                                        </Text>
                                                    </HStack>
                                                    <HStack gap="3" flexShrink={0} justify="flex-end">
                                                        {/* Stacked, not side by side: "Plaćeno" and
                                                            "Neplaćeno" are different widths, and on one
                                                            line that shoved the price left/right by row —
                                                            right-aligned and stacked, both stay put. */}
                                                        <VStack gap="0.5" align="flex-end" minW="4.5rem">
                                                            <Text
                                                                fontSize="sm"
                                                                fontWeight="bold"
                                                                fontVariantNumeric="tabular-nums"
                                                            >
                                                                {formatEur(b.total)}
                                                            </Text>
                                                            <Badge
                                                                variant="subtle"
                                                                size="sm"
                                                                colorPalette={b.paid ? "green" : "yellow"}
                                                            >
                                                                {b.paid
                                                                    ? t("tournament.bill.paid")
                                                                    : t("tournament.waiter.list.unpaid")}
                                                            </Badge>
                                                        </VStack>
                                                        <Button
                                                            size="xs"
                                                            variant={b.paid ? "outline" : "solid"}
                                                            colorPalette="blue"
                                                            onClick={() => setSelected(b)}
                                                        >
                                                            {t("tournament.waiter.list.openBill")}
                                                        </Button>
                                                        {b.paid && (
                                                            <IconButton
                                                                aria-label={t("tournament.waiter.list.collapsePaid")}
                                                                title={t("tournament.waiter.list.collapsePaid")}
                                                                size="xs"
                                                                variant="ghost"
                                                                onClick={() => togglePaidRow(b.matchId)}
                                                            >
                                                                <FiChevronDown />
                                                            </IconButton>
                                                        )}
                                                    </HStack>
                                                </Box>
                                            )
                                        })}
                                    </VStack>
                                )}
                            </Box>
                        )
                    })}
                </VStack>
            )}

            {/* Mounted only while a row is open, and keyed by the match, so
                switching rows resets the dialog's own state rather than
                showing the previous bill for a frame. */}
            {selected && canLoadBills && (
                <WaiterBillDialog
                    key={selected.matchId}
                    open
                    onClose={() => setSelected(null)}
                    tournamentRef={tournamentUuid}
                    token={billToken}
                    matchId={selected.matchId}
                    heading={`${t("tournament.round.heading", { n: selected.roundNumber })} · ${rowLabel(selected)}`}
                    subheading={rowPairs(selected)}
                    onChanged={onBillChanged}
                />
            )}

            {canEdit && (
                <WaiterInviteDialog
                    open={inviteOpen}
                    onClose={() => setInviteOpen(false)}
                    tournamentUuid={tournamentUuid}
                    linkFor={inviteLink}
                    onInvited={(w) => setWaiters((ws) => [...ws, w])}
                />
            )}

            <ConfirmDialog
                open={revokeTarget !== null}
                title={t("tournament.waiter.manage.revokeOneTitle", { name: revokeTarget?.name ?? "" })}
                description={t("tournament.waiter.manage.revokeOneBody")}
                confirmLabel={t("tournament.waiter.manage.revokeOneConfirm")}
                destructive
                busy={revokingOne}
                onConfirm={() => void onRevokeOne()}
                onCancel={() => setRevokeTarget(null)}
            />

            <ConfirmDialog
                open={revokeAllOpen}
                title={t("tournament.waiter.manage.revokeAllTitle")}
                description={t("tournament.waiter.manage.revokeAllBody")}
                confirmLabel={t("tournament.waiter.manage.revokeAllConfirm")}
                destructive
                busy={revokingAll}
                onConfirm={() => void onRevokeAll()}
                onCancel={() => setRevokeAllOpen(false)}
            />
        </VStack>
    )
}
