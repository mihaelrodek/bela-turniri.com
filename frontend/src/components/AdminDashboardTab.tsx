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
        } catch (err: any) {
            // 409 ALREADY_CLAIMED is silenced by the http interceptor;
            // refresh the list so the now-claimed pair disappears.
            if (err?.response?.status === 409 && selectedTournamentId != null) {
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
                            <Text fontSize="lg" fontWeight="semibold">Dashboard — pridruživanje parova</Text>
                            <Text fontSize="sm" color="fg.muted">
                                Odaberi turnir, zatim klikni "Pridruži korisniku" pored para da bi
                                ga vezao za registriranog igrača. Nakon pridruživanja par se
                                pojavljuje na profilu odabranog korisnika i automatski se kreira
                                Predlošci-zapis s tim imenom para.
                            </Text>
                        </Box>

                        {/* Tournament picker. Plain Input search + scrollable
                            list of matches — works for tens-to-hundreds of
                            tournaments without needing a heavier combobox. */}
                        <Box>
                            <Text fontSize="sm" fontWeight="medium" mb="2">Turnir</Text>
                            <HStack mb="2" gap="2">
                                <Box position="relative" flex="1">
                                    <Box position="absolute" left="3" top="50%" transform="translateY(-50%)"
                                         color="fg.muted" pointerEvents="none">
                                        <FiSearch />
                                    </Box>
                                    <Input
                                        pl="9"
                                        placeholder="Pretraži turnire po imenu, lokaciji ili slug-u…"
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
                                            Nema rezultata.
                                        </Text>
                                    ) : (
                                        filteredTournaments.map((t) => {
                                            const active = t.id === selectedTournamentId
                                            return (
                                                <Box
                                                    key={t.id}
                                                    px="3"
                                                    py="2"
                                                    cursor="pointer"
                                                    bg={active ? "blue.subtle" : "transparent"}
                                                    _hover={{ bg: active ? "blue.subtle" : "bg.muted" }}
                                                    borderBottomWidth="1px"
                                                    borderColor="border.subtle"
                                                    onClick={() => setSelectedTournamentId(t.id)}
                                                >
                                                    <HStack justify="space-between" gap="2">
                                                        <Box minW="0" flex="1">
                                                            <Text fontSize="sm" fontWeight={active ? "semibold" : "medium"} truncate>
                                                                {t.name}
                                                            </Text>
                                                            <Text fontSize="xs" color="fg.muted" truncate>
                                                                {[t.location, formatDate(t.startAt)].filter(Boolean).join(" • ")}
                                                            </Text>
                                                            <Text fontSize="xs" color="fg.muted" truncate>
                                                                Vlasnik: {t.createdByName || (t.createdByUid ? "(bez imena)" : "— (legacy)")}
                                                            </Text>
                                                        </Box>
                                                        {t.status && (
                                                            <Badge size="sm" variant="subtle"
                                                                   colorPalette={statusPalette(t.status)}>
                                                                {t.status}
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
                                    Nepridruženi parovi · {selectedTournament.name}
                                </Text>
                                <Text fontSize="sm" color="fg.muted">
                                    Prikazani su samo parovi koji još nisu vezani za nijednog
                                    registriranog korisnika.
                                </Text>
                            </Box>

                            {loadingPairs ? (
                                <HStack py="4" justify="center"><Spinner size="sm" /></HStack>
                            ) : pairs.length === 0 ? (
                                <Text fontSize="sm" color="fg.muted">
                                    Nema nepridruženih parova u ovom turniru.
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
                                                    {p.wins} pobjeda · {p.losses} poraza
                                                    {p.eliminated ? " · ispao" : ""}
                                                </Text>
                                            </Box>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                colorPalette="blue"
                                                onClick={() => openAttachDialog(p)}
                                            >
                                                <FiUserPlus /> Pridruži korisniku
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
                                    Vlasništvo turnira
                                </Text>
                                <Text fontSize="sm" color="fg.muted">
                                    Prenesi turnir drugom registriranom korisniku — postaje vlasnik
                                    i može uređivati detalje, upravljati parovima, generirati kola,
                                    postavljati pobjednike itd.
                                </Text>
                            </Box>

                            <Box
                                p="3"
                                bg="bg.muted"
                                rounded="md"
                                borderWidth="1px"
                                borderColor="border.subtle"
                            >
                                <Text fontSize="xs" color="fg.muted">TRENUTNI VLASNIK</Text>
                                <Text fontSize="sm" fontWeight="medium">
                                    {selectedTournament.createdByName
                                        || (selectedTournament.createdByUid
                                            ? "(bez imena)"
                                            : "— (legacy / nema vlasnika)")}
                                </Text>
                                {selectedTournament.createdByUid && (
                                    <Text fontSize="xs" color="fg.muted" mt="1">
                                        UID: {selectedTournament.createdByUid}
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
                                    <FiRepeat /> Prenesi vlasništvo
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
                                    Status turnira (override)
                                </Text>
                                <Text fontSize="sm" color="fg.muted">
                                    Ručno postavi status turnira. Koristi se za ispravak
                                    pogrešnih klikova (npr. slučajno "Završi turnir") ili za
                                    backfill turnira koji su završili izvan aplikacije
                                    (DRAFT → FINISHED). Status se mijenja bez provjere
                                    parova / kola. Vraćanje iz FINISHED briše pobjednika
                                    i podij — ne brišu se rundi/mečevi.
                                </Text>
                            </Box>

                            <Box
                                p="3"
                                bg="bg.muted"
                                rounded="md"
                                borderWidth="1px"
                                borderColor="border.subtle"
                            >
                                <Text fontSize="xs" color="fg.muted">TRENUTNI STATUS</Text>
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
                                        <Text fontSize="sm" color="fg.muted">— (nepoznato)</Text>
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
                                            title={isCurrent ? "Već u tom statusu" : `Postavi status na ${s}`}
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
                                    Resetiraj turnir
                                </Text>
                                <Text fontSize="sm" color="fg.muted">
                                    Vraća turnir u stanje «nacrt» (DRAFT), briše sve runde
                                    i mečeve, ali zadržava parove (pobjede / porazi se
                                    nuliraju, ne briše se status «ima život»). Organizator
                                    može odmah dodavati / mijenjati parove i ponovno
                                    pokrenuti turnir. Pobjednik i podij se brišu.
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
                                        ? "Legacy turnir bez UUID-a — reset nije moguć"
                                        : "Resetiraj turnir u DRAFT i obriši runde"}
                                >
                                    <FiRefreshCw /> Resetiraj turnir
                                </Button>
                            </HStack>
                        </Stack>
                    </Card.Body>
                </Card.Root>
            )}

            {/* Reset confirmation dialog — spells out exactly what gets
                wiped vs. kept so the admin doesn't accidentally nuke a
                running tournament thinking it'll only clear status. */}
            <Dialog.Root
                open={resetDialogOpen}
                onOpenChange={(e) => { if (!e.open) setResetDialogOpen(false) }}
                placement="center"
                motionPreset="slide-in-bottom"
            >
                <Portal>
                    <Dialog.Backdrop />
                    <Dialog.Positioner>
                        <Dialog.Content maxW={{ base: "92%", md: "md" }}>
                            <Dialog.Header>
                                <Dialog.Title>
                                    <HStack gap="2" align="center">
                                        <Box color="red.fg"><FiAlertTriangle /></Box>
                                        Resetiraj turnir?
                                    </HStack>
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
                                            <Text fontSize="xs" color="fg.muted">TURNIR</Text>
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
                                            Briše se:
                                        </Text>
                                        <Text fontSize="xs" color="fg.muted">
                                            • sve runde i mečevi<br />
                                            • pobjednik (winnerName) i podij (2./3. mjesto)<br />
                                            • pobjede / porazi parova (vraćaju se na 0)<br />
                                            • status eliminacije parova (svi ponovo aktivni)
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
                                            Zadržava se:
                                        </Text>
                                        <Text fontSize="xs" color="fg.muted">
                                            • parovi (imena, kotizacija, «ima život» flag)<br />
                                            • postavke turnira (cijene, lokacija, kontakt, plakat)
                                        </Text>
                                    </Box>
                                </Stack>
                            </Dialog.Body>
                            <Dialog.Footer>
                                <Button variant="ghost" onClick={() => setResetDialogOpen(false)} disabled={resetting}>
                                    Odustani
                                </Button>
                                <Button
                                    variant="solid"
                                    colorPalette="red"
                                    loading={resetting}
                                    onClick={handleConfirmReset}
                                >
                                    Resetiraj
                                </Button>
                            </Dialog.Footer>
                        </Dialog.Content>
                    </Dialog.Positioner>
                </Portal>
            </Dialog.Root>

            {/* Status-change confirmation dialog. Always renders the
                consequences of the chosen transition (clearing
                winner/podium when leaving FINISHED) so the admin
                isn't surprised after the click. */}
            <Dialog.Root
                open={pendingStatus != null}
                onOpenChange={(e) => { if (!e.open) setPendingStatus(null) }}
                placement="center"
                motionPreset="slide-in-bottom"
            >
                <Portal>
                    <Dialog.Backdrop />
                    <Dialog.Positioner>
                        <Dialog.Content maxW={{ base: "92%", md: "md" }}>
                            <Dialog.Header>
                                <Dialog.Title>
                                    <HStack gap="2" align="center">
                                        <Box color="orange.fg"><FiAlertTriangle /></Box>
                                        Promjena statusa turnira
                                    </HStack>
                                </Dialog.Title>
                            </Dialog.Header>
                            <Dialog.Body>
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
                                                <Text fontSize="xs" color="fg.muted">TURNIR</Text>
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
                                                        Vraćanje iz FINISHED
                                                    </Text>
                                                    <Text fontSize="xs" color="fg.muted" mt="1">
                                                        Briše se pobjednik (winnerName) i podij
                                                        (2./3. mjesto). Rundi i mečevi ostaju
                                                        netaknuti — za potpuni reset koristi
                                                        "Resetiraj turnir" na stranici turnira.
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
                                                        Postavljanje na FINISHED
                                                    </Text>
                                                    <Text fontSize="xs" color="fg.muted" mt="1">
                                                        Pobjednik se ne postavlja automatski.
                                                        Otvori stranicu turnira pa postavi
                                                        winnerName + podij ako su potrebni.
                                                    </Text>
                                                </Box>
                                            )}
                                        </>
                                    )}
                                </Stack>
                            </Dialog.Body>
                            <Dialog.Footer>
                                <Button variant="ghost" onClick={() => setPendingStatus(null)} disabled={savingStatus}>
                                    Odustani
                                </Button>
                                <Button
                                    variant="solid"
                                    colorPalette={pendingStatus ? statusPalette(pendingStatus) : "blue"}
                                    loading={savingStatus}
                                    onClick={handleConfirmStatusChange}
                                >
                                    Potvrdi
                                </Button>
                            </Dialog.Footer>
                        </Dialog.Content>
                    </Dialog.Positioner>
                </Portal>
            </Dialog.Root>

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
                                    Pridruži par korisniku
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
                                            <Text fontSize="xs" color="fg.muted">PAR</Text>
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
                                            placeholder="Pretraži po imenu i prezimenu…"
                                            value={userSearch}
                                            onChange={(e) => setUserSearch(e.target.value)}
                                            autoFocus
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
                                                Nema rezultata.
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
                                                            {u.displayName || "(bez imena)"}
                                                        </Text>
                                                        {u.slug && (
                                                            <Text fontSize="xs" color="fg.muted" truncate>
                                                                /profil/{u.slug}
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
                                                        Pridruži
                                                    </Button>
                                                </HStack>
                                            ))
                                        )}
                                    </Box>
                                </Stack>
                            </Dialog.Body>
                            <Dialog.Footer>
                                <Button variant="ghost" onClick={closeAttachDialog}>Zatvori</Button>
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
                                    Prenesi vlasništvo turnira
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
                                            <Text fontSize="xs" color="fg.muted">TURNIR</Text>
                                            <Text fontSize="sm" fontWeight="medium">
                                                {selectedTournament.name}
                                            </Text>
                                            <Text fontSize="xs" color="fg.muted" mt="1">
                                                Trenutni vlasnik:{" "}
                                                {selectedTournament.createdByName
                                                    || (selectedTournament.createdByUid
                                                        ? "(bez imena)"
                                                        : "— (legacy)")}
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
                                            placeholder="Pretraži po imenu i prezimenu…"
                                            value={transferUserSearch}
                                            onChange={(e) => setTransferUserSearch(e.target.value)}
                                            autoFocus
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
                                                Nema rezultata.
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
                                                                    {u.displayName || "(bez imena)"}
                                                                </Text>
                                                                {isCurrentOwner && (
                                                                    <Badge size="xs" variant="subtle" colorPalette="gray">
                                                                        vlasnik
                                                                    </Badge>
                                                                )}
                                                            </HStack>
                                                            {u.slug && (
                                                                <Text fontSize="xs" color="fg.muted" truncate>
                                                                    /profil/{u.slug}
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
                                                            {isCurrentOwner ? "Već vlasnik" : "Prenesi"}
                                                        </Button>
                                                    </HStack>
                                                )
                                            })
                                        )}
                                    </Box>
                                </Stack>
                            </Dialog.Body>
                            <Dialog.Footer>
                                <Button variant="ghost" onClick={closeTransferDialog}>Zatvori</Button>
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

/** Human-friendly HR date label for tournament rows. */
function formatDate(iso: string | null): string | null {
    if (!iso) return null
    try {
        return new Intl.DateTimeFormat("hr-HR", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        }).format(new Date(iso))
    } catch {
        return iso
    }
}
