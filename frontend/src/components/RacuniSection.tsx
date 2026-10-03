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
    FiLink,
    FiLogOut,
    FiPlus,
    FiTrash2,
    FiUserPlus,
    FiCreditCard,
} from "react-icons/fi"
import {
    type WaiterBillRowDto,
    type WaiterDto,
    createExtraBill,
    fetchWaiterBills,
    listWaiters,
    revokeAllWaiters,
    revokeWaiter,
    waiterErrorText,
} from "../api/waiterAccess"
import type { MatchBillDto } from "../api/cjenik"
import { newOpId } from "../hooks/useOfflineQueue"
import { useWaiterSession } from "../hooks/useWaiterSession"
import { useLiveSocket } from "../hooks/useLiveSocket"
import { usePolling } from "../hooks/usePolling"
import { formatDateTime, formatEur } from "../utils/format"
import { showError, showSuccess } from "../toaster"
/* `tStatic` is the non-reactive translator. The data callbacks below are
   listed in effect dependency arrays, so they must keep a stable identity —
   and `useTranslation()`'s `t` is a fresh closure on every render, which would
   make the bill-loading effect re-fire (and re-fetch) forever. Nothing is
   lost: `tStatic` reads the same module-level locale, at the moment the
   message is actually needed. Same precedent as this page's `matchRow`. */
import { t as tStatic, usePlural, useTranslation } from "../i18n"
import AddBillDialog from "./AddBillDialog"
import ConfirmDialog from "./ConfirmDialog"
import EmptyState from "./EmptyState"
import { WHATS_NEW_FAB } from "./navChrome"
import WaiterBillDialog from "./WaiterBillDialog"
import WaiterInviteDialog, { WaiterCodeChip } from "./WaiterInviteDialog"

/* ──────────────────────────────────────────────────────────────────────────
   RacuniSection — the Računi tab.

   2026-10-03 — COLLAPSIBLE WAITERS CARD + "DODAJ RAČUN"
   ─────────────────────────────────────────────────────
   The waiters card collapses to one summary line (chevron toggle, remembered
   per tournament in localStorage; default expanded while there are no waiters,
   collapsed once there are some). "+ Dodaj račun" opens `AddBillDialog`: pick
   a Runda + Stol to open that table's bill, or "Ostalo" to create a bill tied
   to no match. Those come back from the same list as `kind: "EXTRA"` rows and
   render in a last group after the rounds with the same two-line row, counted
   in the unpaid chip; `rowKey` keeps match and extra ids from colliding.

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
    /** Stable key for the collapse state: "r<n>" for a round, "extra" for the "Ostalo" group. */
    key: string
    /** Null for the "Ostalo" group (2026-10-03): bills with no match, listed after the rounds. */
    roundNumber: number | null
    rows: WaiterBillRowDto[]
}

/** Identity of a list row across both kinds — a match id and an extra-bill id can collide. */
const rowKey = (b: WaiterBillRowDto) =>
    b.kind === "EXTRA" ? `e${b.extraBillId}` : `m${b.matchId}`

/* 2026-10-03: the waiters card is collapsible and the choice is remembered per
   tournament. Stored as "1" (collapsed) / "0" (expanded); no entry means
   "decide by content" — expanded while there are no waiters yet (the invite
   button is the point), collapsed once there are some. localStorage can throw
   (private mode, blocked site data), hence the try/catch on both sides. */
const waitersCollapsedKey = (uuid: string) => `bela:racuni:waiters-collapsed:${uuid}`
function readWaitersCollapsed(uuid: string): boolean | null {
    try {
        const v = window.localStorage.getItem(waitersCollapsedKey(uuid))
        return v === "1" ? true : v === "0" ? false : null
    } catch {
        return null
    }
}
function writeWaitersCollapsed(uuid: string, collapsed: boolean) {
    try {
        window.localStorage.setItem(waitersCollapsedKey(uuid), collapsed ? "1" : "0")
    } catch {
        /* a preference, not data: losing it is fine */
    }
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
    tournamentStatus,
}: {
    tournamentUuid: string
    tournamentSlug?: string | null
    /** True for the organiser/admin — unlocks the waiter-management panel. */
    canEdit: boolean
    /** Inviting a new waiter makes no sense once the tournament is over —
     *  there is nothing left to bill. Existing waiter access can still be
     *  revoked, so the panel itself only disappears when there is also
     *  nobody left to revoke (see the render below). */
    tournamentStatus?: string | null
}) {
    const { t } = useTranslation()
    const isFinished = tournamentStatus === "FINISHED"
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
    const [storedCollapsed, setStoredCollapsed] = useState<boolean | null>(
        () => readWaitersCollapsed(tournamentUuid),
    )
    useEffect(() => { setStoredCollapsed(readWaitersCollapsed(tournamentUuid)) }, [tournamentUuid])
    // Until the first load answers, treat "no waiters yet" as the default so the
    // card does not flash collapsed and then spring open.
    const waitersCollapsed = storedCollapsed ?? (!waitersLoading && waiters.length > 0)
    const toggleWaiters = () => {
        const next = !waitersCollapsed
        setStoredCollapsed(next)
        writeWaitersCollapsed(tournamentUuid, next)
    }

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
    const [collapsedRounds, setCollapsedRounds] = useState<Record<string, boolean>>({})
    const [expandedPaidRows, setExpandedPaidRows] = useState<Record<string, boolean>>({})
    const [addOpen, setAddOpen] = useState(false)
    const [addBusy, setAddBusy] = useState(false)

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

    /** Grouped by round, rounds ascending, tables ascending inside each. The
     *  backend already orders it that way; the grouping is presentational and
     *  the sort is belt-and-braces so a reordered response cannot scramble it. */
    const groups: BillGroup[] = useMemo(() => {
        const byRound = new Map<number, WaiterBillRowDto[]>()
        const extras: WaiterBillRowDto[] = []
        for (const b of bills) {
            if (b.kind === "EXTRA" || b.roundNumber == null) { extras.push(b); continue }
            const list = byRound.get(b.roundNumber)
            if (list) list.push(b)
            else byRound.set(b.roundNumber, [b])
        }
        const out: BillGroup[] = [...byRound.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([roundNumber, rows]) => ({
                key: `r${roundNumber}`,
                roundNumber,
                rows: [...rows].sort((x, y) => (x.tableNo ?? 0) - (y.tableNo ?? 0)),
            }))
        // "Ostalo" last, in creation order (the backend sends them oldest first).
        if (extras.length > 0) out.push({ key: "extra", roundNumber: null, rows: extras })
        return out
    }, [bills])

    /** Patch one row from a bill the dialog just wrote, so the list repaints
     *  without a second round trip to the whole collection. */
    const onBillChanged = useCallback((fresh: MatchBillDto) => {
        setBills((rs) => rs.map((r) => (
            (fresh.extraBillId != null
                ? r.kind !== "EXTRA" || r.extraBillId !== fresh.extraBillId
                : r.kind === "EXTRA" || r.matchId !== fresh.matchId) ? r : {
                ...r,
                label: fresh.extraBillId != null ? (fresh.label ?? null) : r.label,
                total: fresh.total,
                paid: !!fresh.paidAt,
                paidAt: fresh.paidAt ?? null,
                paidByName: fresh.paidByName ?? null,
                drinkCount: fresh.drinks.length,
            }
        )))
    }, [])

    const rowLabel = (b: WaiterBillRowDto) =>
        b.kind === "EXTRA"
            ? t("tournament.waiter.extra.default")
            : b.tableNo != null
            ? t("tournament.table", { n: b.tableNo })
            : t("tournament.bracket.bye")

    const rowPairs = (b: WaiterBillRowDto) =>
        b.kind === "EXTRA"
            ? (b.label ?? "")
            : t("tournament.waiter.list.versus", {
                a: b.pair1Name ?? "—",
                b: b.pair2Name ?? "—",
            })

    const toggleRound = (key: string) =>
        setCollapsedRounds((c) => ({ ...c, [key]: !c[key] }))

    const togglePaidRow = (key: string) =>
        setExpandedPaidRows((e) => ({ ...e, [key]: !e[key] }))

    /** "Dodaj račun" → "Za stol": just open that table's existing bill. */
    const onPickMatch = (row: WaiterBillRowDto) => {
        setAddOpen(false)
        setSelected(row)
    }

    /** "Dodaj račun" → "Ostalo": create the bill, show it in the list, open it. */
    const onCreateExtra = async (label: string) => {
        if (addBusy) return
        setAddBusy(true)
        try {
            const row = await createExtraBill(tournamentUuid, billToken, label, newOpId())
            setBills((rs) => (rs.some((r) => rowKey(r) === rowKey(row)) ? rs : [...rs, row]))
            setAddOpen(false)
            setSelected(row)
        } catch (e) {
            showError(tStatic("tournament.waiter.extra.createFailed"), waiterErrorText(e, "") || undefined)
        } finally {
            setAddBusy(false)
        }
    }

    return (
        <VStack align="stretch" gap="4">
            {/* ===== Organiser: waiter management ===== */}
            {canEdit && (!isFinished || waiters.length > 0) && (
                <Box
                    bg="bg.panel"
                    borderWidth="1px"
                    borderColor="border.subtle"
                    rounded="xl"
                    shadow="card"
                    p={{ base: "4", md: "5" }}
                >
                    <VStack align="stretch" gap="3">
                        <HStack justify="space-between" align="center" gap="2" wrap="wrap">
                            {/* `1 1 12rem`, not `flex="1"` (basis 0): in a wrapping row
                                a zero basis let the title column collapse to a sliver
                                and the description wrapped one word per line beside
                                the buttons (2026-10-03, reported). The description now
                                sits under the whole row instead of inside this box. */}
                            <Box minW="0" flex="1 1 12rem">
                                {/* The whole title row toggles the card, like the round headings below. */}
                                <HStack
                                    as="button"
                                    onClick={toggleWaiters}
                                    gap="2"
                                    align="center"
                                    cursor="pointer"
                                    w="full"
                                    minW="0"
                                    textAlign="left"
                                    aria-expanded={!waitersCollapsed}
                                    aria-label={waitersCollapsed
                                        ? t("tournament.waiter.manage.expand")
                                        : t("tournament.waiter.manage.collapse")}
                                >
                                    <Box color="fg.muted" display="flex" alignItems="center">
                                        {waitersCollapsed ? <FiChevronRight size={14} /> : <FiChevronDown size={14} />}
                                    </Box>
                                    <Box color="brand.fg" display="flex" alignItems="center">
                                        <FiCreditCard size={15} />
                                    </Box>
                                    <Text fontFamily="heading" fontWeight="semibold" letterSpacing="-0.015em">
                                        {t("tournament.waiter.manage.heading")}
                                    </Text>
                                    {waitersCollapsed && (
                                        <Text fontSize="sm" color="fg.muted" minW="0" lineClamp={1}>
                                            {waiters.length > 0
                                                ? `· ${plural("tournament.waiter.manage.summary", waiters.length)}`
                                                : (waitersLoading ? "" : `· ${t("tournament.waiter.manage.summaryNone")}`)}
                                        </Text>
                                    )}
                                </HStack>
                            </Box>
                            {!waitersCollapsed && (
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
                                    {!isFinished && (
                                        <Button
                                            size="xs"
                                            colorPalette="blue"
                                            onClick={() => setInviteOpen(true)}
                                        >
                                            <FiUserPlus /> {t("tournament.waiter.manage.invite")}
                                        </Button>
                                    )}
                                </HStack>
                            )}
                        </HStack>

                        {!waitersCollapsed && (
                            <Text fontSize="sm" color="fg.muted" maxW="lg">
                                {t("tournament.waiter.manage.description")}
                            </Text>
                        )}

                        {waitersCollapsed ? null : waitersLoading && waiters.length === 0 ? (
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

            {/* The paid/unpaid counters are gone (2026-10-03, owner). A waiter's
                phone would otherwise carry this tournament's Računi tab
                forever, so "Odjava" stays — right-aligned, only for them. */}
            {!canEdit && (
                <HStack justify="flex-end">
                    <Button size="xs" variant="ghost" onClick={clear}>
                        <FiLogOut /> {t("tournament.waiter.exit")}
                    </Button>
                </HStack>
            )}

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
                        const roundCollapsed = !!collapsedRounds[g.key]
                        const unpaidInRound = g.rows.filter((r) => !r.paid).length
                        return (
                            <Box key={g.key}>
                                <HStack
                                    as="button"
                                    onClick={() => toggleRound(g.key)}
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
                                        fontFamily="mono"
                                        fontVariantNumeric="tabular-nums"
                                        color="fg.muted"
                                        letterSpacing="wider"
                                        textTransform="uppercase"
                                    >
                                        {g.roundNumber == null
                                            ? t("tournament.waiter.extra.default")
                                            : t("tournament.round.heading", { n: g.roundNumber })}
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
                                            const expanded = !b.paid || !!expandedPaidRows[rowKey(b)]
                                            if (!expanded) {
                                                return (
                                                    <HStack
                                                        key={rowKey(b)}
                                                        as="button"
                                                        onClick={() => togglePaidRow(rowKey(b))}
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
                                                            <Text fontSize="xs" fontWeight="semibold" fontFamily="mono" fontVariantNumeric="tabular-nums" color="fg.muted">
                                                                {formatEur(b.total)}
                                                            </Text>
                                                            <FiChevronRight size={13} color="var(--chakra-colors-fg-muted)" />
                                                        </HStack>
                                                    </HStack>
                                                )
                                            }
                                            /* Two lines, the same on a phone and a
                                               desktop (2026-10-03, owner: the old
                                               side-by-side layout wrapped badly
                                               once expanded). Line 1: table, pair
                                               names, price. Line 2: status — and,
                                               for a settled bill, WHO took the
                                               money and WHEN — with the actions on
                                               the right. */
                                            return (
                                                <Box
                                                    key={rowKey(b)}
                                                    borderWidth="1px"
                                                    borderColor={b.paid ? "border.subtle" : "border.emphasized"}
                                                    borderLeftWidth="3px"
                                                    borderLeftColor={b.paid ? "green.solid" : "yellow.solid"}
                                                    rounded="md"
                                                    bg="bg.panel"
                                                    px="3"
                                                    py="2.5"
                                                >
                                                    <HStack justify="space-between" align="center" gap="3">
                                                        <HStack gap="2" minW="0" flex="1">
                                                            <Badge variant="subtle" colorPalette="gray" size="sm" flexShrink={0}>
                                                                {rowLabel(b)}
                                                            </Badge>
                                                            <Text fontSize="sm" minW="0" lineClamp={1} color={b.paid ? "fg.muted" : "fg.soft"}>
                                                                {rowPairs(b)}
                                                            </Text>
                                                        </HStack>
                                                        <Text
                                                            fontSize="md"
                                                            fontWeight="bold"
                                                            fontFamily="mono"
                                                            fontVariantNumeric="tabular-nums"
                                                            flexShrink={0}
                                                        >
                                                            {formatEur(b.total)}
                                                        </Text>
                                                        {/* Fixed-width slot on EVERY row, so the price and
                                                            the "Otvori račun" button sit in the same column
                                                            whether or not a collapse chevron is there
                                                            (2026-10-03, reported: beside the button, the
                                                            chevron pushed it left on paid rows only). */}
                                                        <Box w="28px" h="28px" flexShrink={0} ml="-1">
                                                            {b.paid && (
                                                                <IconButton
                                                                    aria-label={t("tournament.waiter.list.collapsePaid")}
                                                                    title={t("tournament.waiter.list.collapsePaid")}
                                                                    size="xs"
                                                                    variant="ghost"
                                                                    onClick={() => togglePaidRow(rowKey(b))}
                                                                >
                                                                    <FiChevronDown />
                                                                </IconButton>
                                                            )}
                                                        </Box>
                                                    </HStack>
                                                    <HStack justify="space-between" align="center" gap="3" mt="2">
                                                        <HStack gap="2" minW="0" flex="1">
                                                            <Badge
                                                                variant="subtle"
                                                                size="sm"
                                                                colorPalette={b.paid ? "green" : "yellow"}
                                                                flexShrink={0}
                                                            >
                                                                {b.paid
                                                                    ? t("tournament.bill.paid")
                                                                    : t("tournament.waiter.list.unpaid")}
                                                            </Badge>
                                                            {b.paid && b.paidAt && (
                                                                <Text fontSize="xs" color="fg.muted" minW="0" lineClamp={1}>
                                                                    {b.paidByName
                                                                        ? t("tournament.bill.paidByAt", {
                                                                            name: b.paidByName,
                                                                            at: formatDateTime(b.paidAt),
                                                                        })
                                                                        : formatDateTime(b.paidAt)}
                                                                </Text>
                                                            )}
                                                        </HStack>
                                                        <HStack gap="1.5" flexShrink={0}>
                                                            <Button
                                                                size="xs"
                                                                variant={b.paid ? "outline" : "solid"}
                                                                colorPalette="blue"
                                                                onClick={() => setSelected(b)}
                                                            >
                                                                {t("tournament.waiter.list.openBill")}
                                                            </Button>
                                                        </HStack>
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
                    key={rowKey(selected)}
                    open
                    onClose={() => setSelected(null)}
                    tournamentRef={tournamentUuid}
                    token={billToken}
                    matchId={selected.kind === "EXTRA" ? null : selected.matchId}
                    extraBillId={selected.kind === "EXTRA" ? selected.extraBillId : null}
                    heading={selected.kind === "EXTRA" || selected.roundNumber == null
                        ? rowLabel(selected)
                        : `${t("tournament.round.heading", { n: selected.roundNumber })} · ${rowLabel(selected)}`}
                    subheading={rowPairs(selected)}
                    onChanged={onBillChanged}
                    onDeleted={() => {
                        const gone = rowKey(selected)
                        setBills((rs) => rs.filter((r) => rowKey(r) !== gone))
                        setSelected(null)
                    }}
                />
            )}

            {/* "Dodaj račun" is ALWAYS reachable: pinned to the bottom and centred,
                on the same horizontal axis as the Novosti button, however far the
                list is scrolled. The wrapper ignores pointer events so it never
                blocks the rows beside the button. */}
            {canLoadBills && (
                <Box
                    // FIXED to the viewport, not sticky: sticky sits right after
                    // the content, so with few or no bills it floated mid-page
                    // (2026-10-03, reported). Sharing the FAB's bottom offset and
                    // row height keeps both controls vertically centred together.
                    position="fixed"
                    left="0"
                    right="0"
                    bottom={WHATS_NEW_FAB.bottom}
                    h={`${WHATS_NEW_FAB.size}px`}
                    zIndex={8}
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    pointerEvents="none"
                >
                    <Button
                        pointerEvents="auto"
                        colorPalette="blue"
                        size="md"
                        rounded="full"
                        px="6"
                        shadow="raised"
                        onClick={() => setAddOpen(true)}
                    >
                        <FiPlus /> {t("tournament.waiter.extra.add")}
                    </Button>
                </Box>
            )}
            {/* Space under the list so the last bill can scroll clear of the button. */}
            {canLoadBills && <Box h={{ base: "72px", md: "56px" }} aria-hidden="true" />}

            {addOpen && canLoadBills && (
                <AddBillDialog
                    open
                    onClose={() => setAddOpen(false)}
                    rows={bills}
                    busy={addBusy}
                    onPickMatch={onPickMatch}
                    onCreateExtra={onCreateExtra}
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
