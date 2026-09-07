import { useEffect, useMemo, useState } from "react"
import {
    Badge,
    Box,
    Button,
    Card,
    Dialog,
    HStack,
    Input,
    Portal,
    Spinner,
    Stack,
    Text,
    VStack,
} from "@chakra-ui/react"
import { FiAlertTriangle, FiRefreshCw, FiRepeat, FiSearch, FiUserPlus } from "react-icons/fi"
import {
    adminAttachPair,
    adminListTournaments,
    adminListUnclaimedPairs,
    adminSearchUsers,
    adminSetTournamentStatus,
    adminTransferTournament,
    type AdminPairDto,
    type AdminTournamentDto,
    type AdminUserDto,
    type TournamentStatusValue,
} from "../api/admin"
import { resetTournament } from "../api/tournaments"
import ConfirmDialog from "./ConfirmDialog"
import { useTranslation, usePlural } from "../i18n"
import { formatDateCompact } from "../utils/format"

/**
 * Admin-only "Dashboard" tab on the profile page. Two parallel flows
 * gated on a single tournament picker at the top:
 *
 * <p><b>1. Attach pairs to users</b> — for legacy/organiser-added pairs
 * imported from old spreadsheets. After attaching, the pair shows up on
 * the target user's public profile as if they had self-registered.
 *
 * <p><b>2. Transfer tournament ownership</b> — for tournaments the admin
 * pre-created on behalf of an organiser (e.g. before the organiser had
 * signed up). After transfer the target user becomes the owner and can
 * manage pairs, edit details, generate rounds, set the podium, etc.
 *
 * <p>UI flow:
 *   1. Admin picks a tournament from the list (top section). The list
 *      shows the current owner alongside each row so the admin knows
 *      what they're about to act on.
 *   2. Component fetches unclaimed pairs and renders two sibling cards
 *      below: the pair list (with per-pair "Pridruži korisniku" buttons)
 *      and an ownership card with the current owner + "Prenesi
 *      vlasništvo" button.
 *   3. Either button opens a user-search dialog. Selecting a user fires
 *      the corresponding endpoint and refreshes only the part of state
 *      that changed (pair drops out of the list, or the tournament row
 *      updates with the new owner).
 *
 * <p>Component-level state intentionally lives here rather than a
 * context — the dashboard is a single self-contained screen that
 * doesn't share state with anything else.
 */
export default function AdminDashboardTab() {
    const { t } = useTranslation()
    const plural = usePlural()

    /* ─────────────── Tournament list + selection ─────────────── */

    const [tournaments, setTournaments] = useState<AdminTournamentDto[] | null>(null)
    const [selectedTournamentId, setSelectedTournamentId] = useState<number | null>(null)
    const [tournamentSearch, setTournamentSearch] = useState("")
    const [loadingTournaments, setLoadingTournaments] = useState(false)

    useEffect(() => {
        let cancelled = false
        setLoadingTournaments(true)
        adminListTournaments()
            .then((rows) => { if (!cancelled) setTournaments(rows) })
            .catch(() => { /* http interceptor surfaces the toast */ })
            .finally(() => { if (!cancelled) setLoadingTournaments(false) })
        return () => { cancelled = true }
    }, [])

    // Client-side filter so the admin can narrow down a long list of
    // tournaments by name without an extra API trip. Server-side search
    // would be marginal complexity for a list this size (~tens of rows).
    const filteredTournaments = useMemo(() => {
        if (!tournaments) return []
        const q = tournamentSearch.trim().toLowerCase()
        if (!q) return tournaments
        return tournaments.filter((t) => {
            const hay = `${t.name} ${t.location ?? ""} ${t.slug ?? ""}`.toLowerCase()
            return hay.includes(q)
        })
    }, [tournaments, tournamentSearch])

    const selectedTournament = useMemo(
        () => tournaments?.find((t) => t.id === selectedTournamentId) ?? null,
        [tournaments, selectedTournamentId],
    )

    /* ─────────────── Pairs for selected tournament ─────────────── */

    const [pairs, setPairs] = useState<AdminPairDto[]>([])
    const [loadingPairs, setLoadingPairs] = useState(false)

    useEffect(() => {
        if (selectedTournamentId == null) {
            setPairs([])
            return
        }
        let cancelled = false
        setLoadingPairs(true)
        adminListUnclaimedPairs(selectedTournamentId)
            .then((rows) => { if (!cancelled) setPairs(rows) })
            .catch(() => { /* handled by http toaster */ })
            .finally(() => { if (!cancelled) setLoadingPairs(false) })
        return () => { cancelled = true }
    }, [selectedTournamentId])

    /* ─────────────── User-picker dialog ─────────────── */

    const [attachTargetPair, setAttachTargetPair] = useState<AdminPairDto | null>(null)
    const [userSearch, setUserSearch] = useState("")
    const [users, setUsers] = useState<AdminUserDto[]>([])
    const [loadingUsers, setLoadingUsers] = useState(false)
    const [attaching, setAttaching] = useState<string | null>(null) // userUid in flight

    // Debounced user search. 200ms is short enough that it feels live
    // but coarse enough not to fire one request per keystroke. We use
    // a JS setTimeout instead of pulling in a debounce library.
    useEffect(() => {
        if (attachTargetPair == null) return
        let cancelled = false
        setLoadingUsers(true)
        const handle = setTimeout(() => {
            adminSearchUsers(userSearch)
                .then((rows) => { if (!cancelled) setUsers(rows) })
                .catch(() => { /* handled by toaster */ })
                .finally(() => { if (!cancelled) setLoadingUsers(false) })
        }, 200)
        return () => {
            cancelled = true
            clearTimeout(handle)
        }
    }, [userSearch, attachTargetPair])

    function openAttachDialog(pair: AdminPairDto) {
        setAttachTargetPair(pair)
        setUserSearch("")
        setUsers([])
    }
    function closeAttachDialog() {
        setAttachTargetPair(null)
        setUsers([])
        setUserSearch("")
    }

    /* ─────────────── Transfer-tournament dialog ─────────────── */

    // Kept in parallel to the pair-attach user picker rather than shared
    // because the two flows might both be open in quick succession and
    // we don't want a stale search list carrying over between them.
    const [transferDialogOpen, setTransferDialogOpen] = useState(false)
    const [transferUserSearch, setTransferUserSearch] = useState("")
    const [transferUsers, setTransferUsers] = useState<AdminUserDto[]>([])
    const [loadingTransferUsers, setLoadingTransferUsers] = useState(false)
    const [transferring, setTransferring] = useState<string | null>(null) // userUid in flight

    useEffect(() => {
        if (!transferDialogOpen) return
        let cancelled = false
        setLoadingTransferUsers(true)
        const handle = setTimeout(() => {
            adminSearchUsers(transferUserSearch)
                .then((rows) => { if (!cancelled) setTransferUsers(rows) })
                .catch(() => { /* handled by toaster */ })
                .finally(() => { if (!cancelled) setLoadingTransferUsers(false) })
        }, 200)
        return () => {
            cancelled = true
            clearTimeout(handle)
        }
    }, [transferUserSearch, transferDialogOpen])

    function openTransferDialog() {
        setTransferDialogOpen(true)
        setTransferUserSearch("")
        setTransferUsers([])
    }
    function closeTransferDialog() {
        setTransferDialogOpen(false)
        setTransferUsers([])
        setTransferUserSearch("")
    }

    async function handleTransfer(user: AdminUserDto) {
        if (selectedTournament == null) return
        try {
            setTransferring(user.userUid)
            const result = await adminTransferTournament(selectedTournament.id, user.userUid)
            // Patch the tournament list in place — the picker rows show the
            // owner and we want the new value to appear without a full
            // refetch (cheaper + avoids losing the user's scroll position).
            setTournaments((prev) => prev?.map((t) =>
                t.id === selectedTournament.id
                    ? { ...t, createdByUid: result.userUid, createdByName: result.displayName }
                    : t,
            ) ?? null)
            closeTransferDialog()
        } finally {
            setTransferring(null)
        }
    }

    /* ─────────────── Status override ─────────────── */

    // Confirmation dialog for the status change. The target status is
    // staged here while the dialog is open; null means "no dialog".
    // We never apply a status change without the admin clicking
    // through this confirmation — flipping FINISHED back to STARTED
    // is destructive enough (clears winnerName + podium) that an
    // accidental click on the button row should not commit it.
    const [pendingStatus, setPendingStatus] = useState<TournamentStatusValue | null>(null)
    const [savingStatus, setSavingStatus] = useState(false)

    async function handleConfirmStatusChange() {
        if (selectedTournament == null || pendingStatus == null) return
        try {
            setSavingStatus(true)
            const result = await adminSetTournamentStatus(selectedTournament.id, pendingStatus)
            // Patch the picker list in place so the badge next to the
            // selected row updates without a full refetch.
            setTournaments((prev) => prev?.map((t) =>
                t.id === selectedTournament.id
                    ? { ...t, status: result.status }
                    : t,
            ) ?? null)
            setPendingStatus(null)
        } finally {
            setSavingStatus(false)
        }
    }

    /* ─────────────── Reset tournament ─────────────── */

    // Two-phase confirm: clicking the button opens the dialog, clicking
    // Potvrdi in the dialog fires the actual POST. Resetting deletes
    // rounds + matches and zeroes pair wins/losses on the backend, so
    // an accidental click in the picker shouldn't commit it without a
    // second look.
    const [resetDialogOpen, setResetDialogOpen] = useState(false)
    const [resetting, setResetting] = useState(false)

    async function handleConfirmReset() {
        if (selectedTournament == null) return
        const uuid = selectedTournament.uuid
        if (!uuid) return
        try {
            setResetting(true)
            const updated = await resetTournament(uuid)
            // Patch the picker list in place — the badge next to the
            // selected row updates to DRAFT without refetching.
            setTournaments((prev) => prev?.map((t) =>
                t.id === selectedTournament.id
                    ? { ...t, status: updated.status ?? "DRAFT" }
                    : t,
            ) ?? null)
            setResetDialogOpen(false)
        } finally {
            setResetting(false)
        }
    }

    async function handleAttach(user: AdminUserDto) {
        if (attachTargetPair == null) return
        try {
            setAttaching(user.userUid)
            await adminAttachPair(attachTargetPair.id, user.userUid)
            // Drop the pair from the unclaimed list — it's now claimed.
            setPairs((prev) => prev.filter((p) => p.id !== attachTargetPair.id))
            closeAttachDialog()
        } catch (err) {
            // 409 ALREADY_CLAIMED is silenced by the http interceptor;
            // refresh the list so the now-claimed pair disappears.
            const status = (err as { response?: { status?: number } } | null)?.response?.status
            if (status === 409 && selectedTournamentId != null) {
                adminListUnclaimedPairs(selectedTournamentId)
                    .then(setPairs)
                    .catch(() => {})
            }
        } finally {
            setAttaching(null)
        }
    }

    /* ─────────────── Render ─────────────── */

    return (
        <VStack align="stretch" gap="4">
            <Card.Root variant="outline" rounded="xl" borderColor="border.emphasized" shadow="sm">
                <Card.Body p={{ base: "4", md: "6" }}>
                    <Stack gap="3">
                        <Box>
                            <Text fontSize="lg" fontWeight="semibold">{t("admin.dashboard.heading")}</Text>
                            <Text fontSize="sm" color="fg.muted">
                                {t("admin.dashboard.description")}
                            </Text>
                        </Box>

                        {/* Tournament picker. Plain Input search + scrollable
                            list of matches — works for tens-to-hundreds of
                            tournaments without needing a heavier combobox. */}
                        <Box>
                            <Text fontSize="sm" fontWeight="medium" mb="2">{t("admin.dashboard.tournament.label")}</Text>
                            <HStack mb="2" gap="2">
                                <Box position="relative" flex="1">
                                    <Box position="absolute" left="3" top="50%" transform="translateY(-50%)"
                                         color="fg.muted" pointerEvents="none">
                                        <FiSearch />
                                    </Box>
                                    <Input
                                        pl="9"
                                        placeholder={t("admin.dashboard.tournament.placeholder")}
                                        value={tournamentSearch}
                                        onChange={(e) => setTournamentSearch(e.target.value)}
                                    />
                                </Box>
                            </HStack>
                            {loadingTournaments ? (
                                <HStack py="3" justify="center"><Spinner size="sm" /></HStack>
                            ) : (
                                <Box
                                    maxH="260px"
                                    overflowY="auto"
                                    borderWidth="1px"
                                    borderColor="border.subtle"
                                    rounded="md"
                                >
                                    {filteredTournaments.length === 0 ? (
                                        <Text p="3" fontSize="sm" color="fg.muted">
                                            {t("admin.dashboard.tournament.noResults")}
                                        </Text>
                                    ) : (
                                        filteredTournaments.map((tour) => {
                                            const active = tour.id === selectedTournamentId
                                            return (
                                                <Box
                                                    key={tour.id}
                                                    px="3"
                                                    py="2"
                                                    cursor="pointer"
                                                    bg={active ? "blue.subtle" : "transparent"}
                                                    _hover={{ bg: active ? "blue.subtle" : "bg.muted" }}
                                                    borderBottomWidth="1px"
                                                    borderColor="border.subtle"
                                                    onClick={() => setSelectedTournamentId(tour.id)}
                                                >
                                                    <HStack justify="space-between" gap="2">
                                                        <Box minW="0" flex="1">
                                                            <Text fontSize="sm" fontWeight={active ? "semibold" : "medium"} truncate>
                                                                {tour.name}
                                                            </Text>
                                                            <Text fontSize="xs" color="fg.muted" truncate>
                                                                {/* Fallback is the raw ISO, not "": an unparseable
                                                                    startAt still tells the admin something, whereas
                                                                    an empty string silently drops the date. */}
                                                                {[tour.location, formatDateCompact(tour.startAt, tour.startAt ?? "")].filter(Boolean).join(" • ")}
                                                            </Text>
                                                            <Text fontSize="xs" color="fg.muted" truncate>
                                                                {t("admin.dashboard.tournament.owner", { owner: tour.createdByName || (tour.createdByUid ? t("admin.dashboard.tournament.ownerNameFallback") : t("admin.dashboard.tournament.ownerLegacy")) })}
                                                            </Text>
                                                        </Box>
                                                        {tour.status && (
                                                            <Badge size="sm" variant="subtle"
                                                                   colorPalette={statusPalette(tour.status)}>
                                                                {tour.status}
                                                            </Badge>
                                                        )}
                                                    </HStack>
                                                </Box>
                                            )
                                        })
                                    )}
                                </Box>
                            )}
                        </Box>
                    </Stack>
                </Card.Body>
            </Card.Root>

            {selectedTournament != null && (
                <Card.Root variant="outline" rounded="xl" borderColor="border.emphasized" shadow="sm">
                    <Card.Body p={{ base: "4", md: "6" }}>
                        <Stack gap="3">
                            <Box>
                                <Text fontSize="md" fontWeight="semibold">
                                    {t("admin.dashboard.pairs.heading", { tournamentName: selectedTournament.name })}
                                </Text>
                                <Text fontSize="sm" color="fg.muted">
                                    {t("admin.dashboard.pairs.description")}
                                </Text>
                            </Box>

                            {loadingPairs ? (
                                <HStack py="4" justify="center"><Spinner size="sm" /></HStack>
                            ) : pairs.length === 0 ? (
                                <Text fontSize="sm" color="fg.muted">
                                    {t("admin.dashboard.pairs.empty")}
                                </Text>
                            ) : (
                                <Stack gap="2">
                                    {pairs.map((p) => (
                                        <HStack
                                            key={p.id}
                                            px="3"
                                            py="2"
                                            borderWidth="1px"
                                            borderColor="border.subtle"
                                            rounded="md"
                                            justify="space-between"
                                            gap="3"
                                        >
                                            <Box minW="0" flex="1">
                                                <Text fontSize="sm" fontWeight="medium" truncate>{p.name}</Text>
                                                <Text fontSize="xs" color="fg.muted">
                                                    {t("admin.dashboard.pairs.record", { wins: plural("admin.dashboard.pairs.wins", p.wins), losses: plural("admin.dashboard.pairs.losses", p.losses), eliminated: p.eliminated ? t("admin.dashboard.pairs.record.eliminated") : "" })}
                                                </Text>
                                            </Box>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                colorPalette="blue"
                                                onClick={() => openAttachDialog(p)}
                                            >
                                                <FiUserPlus /> {t("admin.dashboard.pairs.attachButton")}
                                            </Button>
                                        </HStack>
                                    ))}
                                </Stack>
                            )}
                        </Stack>
                    </Card.Body>
                </Card.Root>
            )}

            {selectedTournament != null && (
                <Card.Root variant="outline" rounded="xl" borderColor="border.emphasized" shadow="sm">
                    <Card.Body p={{ base: "4", md: "6" }}>
                        <Stack gap="3">
                            <Box>
                                <Text fontSize="md" fontWeight="semibold">
                                    {t("admin.dashboard.ownership.heading")}
                                </Text>
                                <Text fontSize="sm" color="fg.muted">
                                    {t("admin.dashboard.ownership.description")}
                                </Text>
                            </Box>

                            <Box
                                p="3"
                                bg="bg.muted"
                                rounded="md"
                                borderWidth="1px"
                                borderColor="border.subtle"
                            >
                                <Text fontSize="xs" color="fg.muted">{t("admin.dashboard.ownership.currentLabel")}</Text>
                                <Text fontSize="sm" fontWeight="medium">
                                    {selectedTournament.createdByName
                                        || (selectedTournament.createdByUid
                                            ? t("admin.dashboard.ownership.currentFallback")
                                            : t("admin.dashboard.ownership.currentLegacy"))}
                                </Text>
                                {selectedTournament.createdByUid && (
                                    <Text fontSize="xs" color="fg.muted" mt="1">
                                        {t("admin.dashboard.ownership.uid", { uid: selectedTournament.createdByUid })}
                                    </Text>
                                )}
                            </Box>

                            <HStack justify="flex-end">
                                <Button
                                    size="sm"
                                    variant="solid"
                                    colorPalette="blue"
                                    onClick={openTransferDialog}
                                >
                                    <FiRepeat /> {t("admin.dashboard.ownership.transferButton")}
                                </Button>
                            </HStack>
                        </Stack>
                    </Card.Body>
                </Card.Root>
            )}

            {selectedTournament != null && (
                <Card.Root variant="outline" rounded="xl" borderColor="border.emphasized" shadow="sm">
                    <Card.Body p={{ base: "4", md: "6" }}>
                        <Stack gap="3">
                            <Box>
                                <Text fontSize="md" fontWeight="semibold">
                                    {t("admin.dashboard.status.heading")}
                                </Text>
                                <Text fontSize="sm" color="fg.muted">
                                    {t("admin.dashboard.status.description")}
                                </Text>
                            </Box>

                            <Box
                                p="3"
                                bg="bg.muted"
                                rounded="md"
                                borderWidth="1px"
                                borderColor="border.subtle"
                            >
                                <Text fontSize="xs" color="fg.muted">{t("admin.dashboard.status.currentLabel")}</Text>
                                <HStack mt="1" gap="2" align="center">
                                    {selectedTournament.status ? (
                                        <Badge
                                            size="sm"
                                            variant="subtle"
                                            colorPalette={statusPalette(selectedTournament.status)}
                                        >
                                            {selectedTournament.status}
                                        </Badge>
                                    ) : (
                                        <Text fontSize="sm" color="fg.muted">{t("admin.dashboard.status.unknown")}</Text>
                                    )}
                                </HStack>
                            </Box>

                            <HStack gap="2" wrap="wrap">
                                {(["DRAFT", "STARTED", "FINISHED"] as const).map((s) => {
                                    const isCurrent = selectedTournament.status === s
                                    return (
                                        <Button
                                            key={s}
                                            size="sm"
                                            variant={isCurrent ? "subtle" : "outline"}
                                            colorPalette={statusPalette(s)}
                                            disabled={isCurrent}
                                            onClick={() => setPendingStatus(s)}
                                            title={isCurrent ? t("admin.dashboard.status.buttonTitle.current") : t("admin.dashboard.status.buttonTitle", { status: s })}
                                        >
                                            {s}
                                        </Button>
                                    )
                                })}
                            </HStack>
                        </Stack>
                    </Card.Body>
                </Card.Root>
            )}

            {/* Reset tournament card — visible only when the tournament
                is past DRAFT. Resetting a DRAFT is a no-op for the
                organiser since they can already edit pairs, so we hide
                the button there to keep the dashboard tidy. */}
            {selectedTournament != null
                && selectedTournament.status != null
                && selectedTournament.status !== "DRAFT"
                && (
                <Card.Root variant="outline" rounded="xl" borderColor="border.emphasized" shadow="sm">
                    <Card.Body p={{ base: "4", md: "6" }}>
                        <Stack gap="3">
                            <Box>
                                <Text fontSize="md" fontWeight="semibold">
                                    {t("admin.dashboard.reset.heading")}
                                </Text>
                                <Text fontSize="sm" color="fg.muted">
                                    {t("admin.dashboard.reset.description")}
                                </Text>
                            </Box>

                            <HStack justify="flex-end">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    colorPalette="red"
                                    onClick={() => setResetDialogOpen(true)}
                                    disabled={!selectedTournament.uuid}
                                    title={!selectedTournament.uuid
                                        ? t("admin.dashboard.reset.button.disabled")
                                        : t("admin.dashboard.reset.button.title")}
                                >
                                    <FiRefreshCw /> {t("admin.dashboard.reset.button")}
                                </Button>
                            </HStack>
                        </Stack>
                    </Card.Body>
                </Card.Root>
            )}

            {/* Reset confirmation — spells out exactly what gets wiped vs.
                kept so the admin doesn't accidentally nuke a running
                tournament thinking it'll only clear status.

                Both confirmations below are the shared ConfirmDialog rather
                than a private Dialog.Root, so they share the app's dialog
                shell, its busy handling and — new here — its
                `role="alertdialog"`. Only the body is bespoke; that is what
                the ReactNode `description` slot is for. */}
            <ConfirmDialog
                open={resetDialogOpen}
                wide
                destructive
                busy={resetting}
                onCancel={() => setResetDialogOpen(false)}
                onConfirm={handleConfirmReset}
                cancelLabel={t("admin.confirm.resetTournament.cancelButton")}
                confirmLabel={t("admin.confirm.resetTournament.confirmButton")}
                title={
                    <HStack gap="2" align="center">
                        <Box color="red.fg"><FiAlertTriangle /></Box>
                        {t("admin.confirm.resetTournament.title")}
                    </HStack>
                }
                description={
                    <Stack gap="3">
                        {selectedTournament && (
                            <Box
                                p="3"
                                bg="bg.muted"
                                rounded="md"
                                borderWidth="1px"
                                borderColor="border.subtle"
                            >
                                <Text fontSize="xs" color="fg.muted">{t("admin.confirm.resetTournament.tournamentLabel")}</Text>
                                <Text fontSize="sm" fontWeight="medium">
                                    {selectedTournament.name}
                                </Text>
                                {selectedTournament.status && (
                                    <HStack mt="2" gap="2" align="center">
                                        <Badge
                                            size="sm"
                                            variant="subtle"
                                            colorPalette={statusPalette(selectedTournament.status)}
                                        >
                                            {selectedTournament.status}
                                        </Badge>
                                        <Text fontSize="sm" color="fg.muted">→</Text>
                                        <Badge size="sm" variant="subtle" colorPalette="blue">
                                            DRAFT
                                        </Badge>
                                    </HStack>
                                )}
                            </Box>
                        )}

                        <Box
                            p="3"
                            bg="red.subtle"
                            rounded="md"
                            borderWidth="1px"
                            borderColor="red.muted"
                        >
                            <Text fontSize="sm" color="red.fg" fontWeight="medium" mb="1">
                                {t("admin.confirm.resetTournament.delete.heading")}
                            </Text>
                            <Text fontSize="xs" color="fg.muted" whiteSpace="pre-line">
                                {t("admin.confirm.resetTournament.delete.items")}
                            </Text>
                        </Box>

                        <Box
                            p="3"
                            bg="green.subtle"
                            rounded="md"
                            borderWidth="1px"
                            borderColor="green.muted"
                        >
                            <Text fontSize="sm" color="green.fg" fontWeight="medium" mb="1">
                                {t("admin.confirm.resetTournament.keep.heading")}
                            </Text>
                            <Text fontSize="xs" color="fg.muted" whiteSpace="pre-line">
                                {t("admin.confirm.resetTournament.keep.items")}
                            </Text>
                        </Box>
                    </Stack>
                }
            />

            {/* Status-change confirmation. Always renders the consequences of
                the chosen transition (clearing winner/podium when leaving
                FINISHED) so the admin isn't surprised after the click.

                The confirm button is the standard brand one. It used to be
                painted with `statusPalette(pendingStatus)`, i.e. a different
                colour per target status — which meant this was the only
                confirm button in the app whose colour was not "brand, or red
                when destructive". The status badges inside the body already
                carry that information, and more legibly. */}
            <ConfirmDialog
                open={pendingStatus != null}
                wide
                busy={savingStatus}
                onCancel={() => setPendingStatus(null)}
                onConfirm={handleConfirmStatusChange}
                cancelLabel={t("admin.confirm.statusChange.cancelButton")}
                confirmLabel={t("admin.confirm.statusChange.confirmButton")}
                title={
                    <HStack gap="2" align="center">
                        <Box color="orange.fg"><FiAlertTriangle /></Box>
                        {t("admin.confirm.statusChange.title")}
                    </HStack>
                }
                description={
                    <Stack gap="3">
                        {selectedTournament && pendingStatus && (
                            <>
                                <Box
                                    p="3"
                                    bg="bg.muted"
                                    rounded="md"
                                    borderWidth="1px"
                                    borderColor="border.subtle"
                                >
                                    <Text fontSize="xs" color="fg.muted">{t("admin.confirm.statusChange.tournamentLabel")}</Text>
                                    <Text fontSize="sm" fontWeight="medium">
                                        {selectedTournament.name}
                                    </Text>
                                    <HStack mt="2" gap="2" align="center">
                                        {selectedTournament.status && (
                                            <Badge
                                                size="sm"
                                                variant="subtle"
                                                colorPalette={statusPalette(selectedTournament.status)}
                                            >
                                                {selectedTournament.status}
                                            </Badge>
                                        )}
                                        <Text fontSize="sm" color="fg.muted">→</Text>
                                        <Badge
                                            size="sm"
                                            variant="subtle"
                                            colorPalette={statusPalette(pendingStatus)}
                                        >
                                            {pendingStatus}
                                        </Badge>
                                    </HStack>
                                </Box>

                                {selectedTournament.status === "FINISHED" && pendingStatus !== "FINISHED" && (
                                    <Box
                                        p="3"
                                        bg="orange.subtle"
                                        rounded="md"
                                        borderWidth="1px"
                                        borderColor="orange.muted"
                                    >
                                        <Text fontSize="sm" color="orange.fg" fontWeight="medium">
                                            {t("admin.confirm.statusChange.fromFinished.heading")}
                                        </Text>
                                        <Text fontSize="xs" color="fg.muted" mt="1">
                                            {t("admin.confirm.statusChange.fromFinished.message")}
                                        </Text>
                                    </Box>
                                )}

                                {pendingStatus === "FINISHED" && selectedTournament.status !== "FINISHED" && (
                                    <Box
                                        p="3"
                                        bg="blue.subtle"
                                        rounded="md"
                                        borderWidth="1px"
                                        borderColor="blue.muted"
                                    >
                                        <Text fontSize="sm" color="blue.fg" fontWeight="medium">
                                            {t("admin.confirm.statusChange.toFinished.heading")}
                                        </Text>
                                        <Text fontSize="xs" color="fg.muted" mt="1">
                                            {t("admin.confirm.statusChange.toFinished.message")}
                                        </Text>
                                    </Box>
                                )}
                            </>
                        )}
                    </Stack>
                }
            />

            {/* User-picker dialog. Only rendered when a pair is selected. */}
            <Dialog.Root
                open={attachTargetPair != null}
                onOpenChange={(e) => { if (!e.open) closeAttachDialog() }}
                placement="center"
                motionPreset="slide-in-bottom"
            >
                <Portal>
                    <Dialog.Backdrop />
                    <Dialog.Positioner>
                        <Dialog.Content maxW={{ base: "92%", md: "md" }}>
                            <Dialog.Header>
                                <Dialog.Title>
                                    {t("admin.dialog.attachPair.title")}
                                </Dialog.Title>
                            </Dialog.Header>
                            <Dialog.Body>
                                <Stack gap="3">
                                    {attachTargetPair && (
                                        <Box
                                            p="3"
                                            bg="bg.muted"
                                            rounded="md"
                                            borderWidth="1px"
                                            borderColor="border.subtle"
                                        >
                                            <Text fontSize="xs" color="fg.muted">{t("admin.dialog.attachPair.pairLabel")}</Text>
                                            <Text fontSize="sm" fontWeight="medium">
                                                {attachTargetPair.name}
                                            </Text>
                                        </Box>
                                    )}

                                    <Box position="relative">
                                        <Box position="absolute" left="3" top="50%" transform="translateY(-50%)"
                                             color="fg.muted" pointerEvents="none">
                                            <FiSearch />
                                        </Box>
                                        <Input
                                            pl="9"
                                            placeholder={t("admin.dialog.attachPair.userSearch.placeholder")}
                                            value={userSearch}
                                            onChange={(e) => setUserSearch(e.target.value)}
                                            autoFocus
                                            aria-label={t("admin.dialog.attachPair.userSearch.placeholder")}
                                        />
                                    </Box>

                                    <Box
                                        maxH="320px"
                                        overflowY="auto"
                                        borderWidth="1px"
                                        borderColor="border.subtle"
                                        rounded="md"
                                    >
                                        {loadingUsers ? (
                                            <HStack py="4" justify="center"><Spinner size="sm" /></HStack>
                                        ) : users.length === 0 ? (
                                            <Text p="3" fontSize="sm" color="fg.muted">
                                                {t("admin.dashboard.tournament.noResults")}
                                            </Text>
                                        ) : (
                                            users.map((u) => (
                                                <HStack
                                                    key={u.userUid}
                                                    px="3"
                                                    py="2"
                                                    justify="space-between"
                                                    gap="2"
                                                    borderBottomWidth="1px"
                                                    borderColor="border.subtle"
                                                    _hover={{ bg: "bg.muted" }}
                                                >
                                                    <Box minW="0" flex="1">
                                                        <Text fontSize="sm" fontWeight="medium" truncate>
                                                            {u.displayName || t("admin.dialog.attachPair.userFallback")}
                                                        </Text>
                                                        {u.slug && (
                                                            <Text fontSize="xs" color="fg.muted" truncate>
                                                                {t("admin.dialog.attachPair.userProfile", { slug: u.slug })}
                                                            </Text>
                                                        )}
                                                    </Box>
                                                    <Button
                                                        size="xs"
                                                        variant="solid"
                                                        colorPalette="blue"
                                                        loading={attaching === u.userUid}
                                                        onClick={() => handleAttach(u)}
                                                    >
                                                        {t("admin.dialog.attachPair.attachButton")}
                                                    </Button>
                                                </HStack>
                                            ))
                                        )}
                                    </Box>
                                </Stack>
                            </Dialog.Body>
                            <Dialog.Footer>
                                <Button variant="ghost" onClick={closeAttachDialog}>{t("admin.dialog.attachPair.closeButton")}</Button>
                            </Dialog.Footer>
                        </Dialog.Content>
                    </Dialog.Positioner>
                </Portal>
            </Dialog.Root>

            {/* Tournament-transfer dialog. Only rendered when the admin has
                explicitly opened it — keeps the search effect inert
                otherwise (the effect short-circuits on !transferDialogOpen). */}
            <Dialog.Root
                open={transferDialogOpen}
                onOpenChange={(e) => { if (!e.open) closeTransferDialog() }}
                placement="center"
                motionPreset="slide-in-bottom"
            >
                <Portal>
                    <Dialog.Backdrop />
                    <Dialog.Positioner>
                        <Dialog.Content maxW={{ base: "92%", md: "md" }}>
                            <Dialog.Header>
                                <Dialog.Title>
                                    {t("admin.dialog.transferTournament.title")}
                                </Dialog.Title>
                            </Dialog.Header>
                            <Dialog.Body>
                                <Stack gap="3">
                                    {selectedTournament && (
                                        <Box
                                            p="3"
                                            bg="bg.muted"
                                            rounded="md"
                                            borderWidth="1px"
                                            borderColor="border.subtle"
                                        >
                                            <Text fontSize="xs" color="fg.muted">{t("admin.dialog.transferTournament.tournamentLabel")}</Text>
                                            <Text fontSize="sm" fontWeight="medium">
                                                {selectedTournament.name}
                                            </Text>
                                            <Text fontSize="xs" color="fg.muted" mt="1">
                                                {t("admin.dialog.transferTournament.currentOwner", {
                                                    owner: selectedTournament.createdByName
                                                        || (selectedTournament.createdByUid
                                                            ? t("admin.dialog.transferTournament.userFallback")
                                                            : t("admin.dashboard.tournament.ownerLegacy")),
                                                })}
                                            </Text>
                                        </Box>
                                    )}

                                    <Box position="relative">
                                        <Box position="absolute" left="3" top="50%" transform="translateY(-50%)"
                                             color="fg.muted" pointerEvents="none">
                                            <FiSearch />
                                        </Box>
                                        <Input
                                            pl="9"
                                            placeholder={t("admin.dialog.transferTournament.userSearch.placeholder")}
                                            value={transferUserSearch}
                                            onChange={(e) => setTransferUserSearch(e.target.value)}
                                            autoFocus
                                            aria-label={t("admin.dialog.transferTournament.userSearch.placeholder")}
                                        />
                                    </Box>

                                    <Box
                                        maxH="320px"
                                        overflowY="auto"
                                        borderWidth="1px"
                                        borderColor="border.subtle"
                                        rounded="md"
                                    >
                                        {loadingTransferUsers ? (
                                            <HStack py="4" justify="center"><Spinner size="sm" /></HStack>
                                        ) : transferUsers.length === 0 ? (
                                            <Text p="3" fontSize="sm" color="fg.muted">
                                                {t("admin.dashboard.tournament.noResults")}
                                            </Text>
                                        ) : (
                                            transferUsers.map((u) => {
                                                const isCurrentOwner =
                                                    !!selectedTournament
                                                    && selectedTournament.createdByUid === u.userUid
                                                return (
                                                    <HStack
                                                        key={u.userUid}
                                                        px="3"
                                                        py="2"
                                                        justify="space-between"
                                                        gap="2"
                                                        borderBottomWidth="1px"
                                                        borderColor="border.subtle"
                                                        _hover={{ bg: "bg.muted" }}
                                                    >
                                                        <Box minW="0" flex="1">
                                                            <HStack gap="2">
                                                                <Text fontSize="sm" fontWeight="medium" truncate>
                                                                    {u.displayName || t("admin.dialog.transferTournament.userFallback")}
                                                                </Text>
                                                                {isCurrentOwner && (
                                                                    <Badge size="xs" variant="subtle" colorPalette="gray">
                                                                        {t("admin.dialog.transferTournament.ownerBadge")}
                                                                    </Badge>
                                                                )}
                                                            </HStack>
                                                            {u.slug && (
                                                                <Text fontSize="xs" color="fg.muted" truncate>
                                                                    {t("admin.dialog.transferTournament.userProfile", { slug: u.slug })}
                                                                </Text>
                                                            )}
                                                        </Box>
                                                        <Button
                                                            size="xs"
                                                            variant="solid"
                                                            colorPalette="blue"
                                                            loading={transferring === u.userUid}
                                                            disabled={isCurrentOwner}
                                                            onClick={() => handleTransfer(u)}
                                                        >
                                                            {isCurrentOwner
                                                                ? t("admin.dialog.transferTournament.transferButton.current")
                                                                : t("admin.dialog.transferTournament.transferButton")}
                                                        </Button>
                                                    </HStack>
                                                )
                                            })
                                        )}
                                    </Box>
                                </Stack>
                            </Dialog.Body>
                            <Dialog.Footer>
                                <Button variant="ghost" onClick={closeTransferDialog}>{t("admin.dialog.transferTournament.closeButton")}</Button>
                            </Dialog.Footer>
                        </Dialog.Content>
                    </Dialog.Positioner>
                </Portal>
            </Dialog.Root>
        </VStack>
    )
}

/**
 * Map a tournament status onto a Chakra colorPalette name. Keeps the
 * picker badge, the override card's "current status" badge, and the
 * confirm dialog all in visual sync.
 */
function statusPalette(status: string): "gray" | "blue" | "green" {
    if (status === "FINISHED") return "gray"
    if (status === "STARTED") return "green"
    return "blue" // DRAFT (default)
}

