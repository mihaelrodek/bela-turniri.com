import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
    Box,
    Button,
    chakra,
    Dialog,
    Field,
    Grid,
    HStack,
    IconButton,
    Input,
    NativeSelect,
    Portal,
    Stack,
    Text,
    Textarea,
    VStack,
} from "@chakra-ui/react"
import { useLocation, useNavigate } from "react-router-dom"
import {
    FiCheck,
    FiChevronDown,
    FiChevronUp,
    FiEdit2,
    FiFilter,
    FiSearch,
    FiUserPlus,
    FiUsers,
    FiX,
} from "react-icons/fi"

import { useAuth } from "../auth/authContextValue"
import type { TournamentCard } from "../types/tournaments"
import { fetchTournaments } from "../api/tournaments"
import { qk } from "../queryClient"
import {
    createPairRequest,
    deletePairRequest,
    listPairRequests,
    matchPairRequest,
    updatePairRequest,
    type PairRequest,
} from "../api/pairRequests"
import { useMyProfile } from "../hooks/useMyProfile"
import { useSearchHotkey } from "../hooks/useSearchHotkey"
import ConfirmDialog from "../components/ConfirmDialog"
import EmptyState from "../components/EmptyState"
import PairRequestCard, { PairRequestCardSkeleton } from "../components/PairRequestCard"
import { sortPairRequests } from "../components/pairRequestShared"
import { showError } from "../toaster"
import { formatDateTime } from "../utils/format"
import { hasMapCoordinates, mapLinkFor } from "../utils/mapLink"
import { joinPhone, PHONE_COUNTRIES, sanitizePhone, splitPhone } from "../utils/phone"
import { useTranslation, usePlural } from "../i18n"

/* ──────────────────────────────────────────────────────────────────────────
   FindPairPage — the "tražim para" board.

   The screen is a LIST with a toolbar, not a form with a list under it. The
   old layout opened with "Tražim para" expanded, which pushed the requests —
   the only reason anyone opens this URL — below the fold, and left a lone
   "Sakrij formu" button floating above a card it did not belong to. Posting is
   now one primary button that opens a dialog; the board never moves.

   The toolbar is deliberately the SAME toolbar `TournamentsPage` grew: a
   search box with a real ⌘K shortcut behind its hint chip, a "Filteri"
   disclosure carrying a count badge, a "Sortiraj: …" menu and a Kartice/Popis
   segmented switch. Two filter idioms inside one product is worse than either
   of them; the shared `useSearchHotkey` hook and the `EmptyState` primitive
   are the same reasoning applied one level down.

   Data: exactly ONE query entry, `qk.pairRequests(status, viewer)`. The viewer
   is part of the key because the backend redacts phone numbers for anonymous
   callers (`PairRequestController.redactForAnonymous`) and because the rows
   carry owner-only affordances — without it, signing out on a shared device
   would repaint the previous user's board, phone numbers included, from cache.
   Status stays in the key (it is a server query parameter); everything else
   filters client-side over what that entry already holds.
   ────────────────────────────────────────────────────────────────────── */

type TournamentLite = TournamentCard & { uuid: string }

type StatusFilter = "all" | "open" | "matched"

/** The status the board opens on, and what "Očisti filtere" returns to. */
const DEFAULT_STATUS: StatusFilter = "open"

/** Ties the dialog's <form> (in the scrolling body) to its submit button (in
 *  the pinned footer). Only one such dialog can be open at a time, so a
 *  module constant is enough and no generated id is needed. */
const FORM_ID = "pair-request-form"

/** Croatian text from a failed request: the backend body when it sent one. */
function requestErrorText(e: unknown): string | undefined {
    const data = (e as { response?: { data?: unknown } } | null)?.response?.data
    if (typeof data === "string" && data.trim()) return data.trim()
    if (data && typeof data === "object") {
        const msg = (data as Record<string, unknown>).message
        if (typeof msg === "string" && msg.trim()) return msg.trim()
    }
    return undefined
}

/** Stable empty defaults for query results — a fresh `[]` literal on every
 *  render would bust the filtering useMemos below. */
const EMPTY_TOURNAMENTS: TournamentLite[] = []
const EMPTY_REQUESTS: PairRequest[] = []

/** Upper-case caption over each control in the filter panel, identical to the
 *  tournament listing's. The dictionary keeps the copy in normal case; the
 *  shouting is presentation, so it happens here. */
function FilterLabel({ children }: { children: React.ReactNode }) {
    return (
        <Text
            fontSize="2xs"
            fontWeight="bold"
            letterSpacing="0.1em"
            textTransform="uppercase"
            color="fg.muted"
            mb="1.5"
        >
            {children}
        </Text>
    )
}

/** One segment of the status control inside the filter panel. */
function StatusSegment({
    active,
    onClick,
    label,
}: {
    active: boolean
    onClick: () => void
    label: string
}) {
    return (
        <chakra.button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            flex="1"
            px="2"
            py="1.5"
            rounded="md"
            fontSize="xs"
            fontWeight="bold"
            whiteSpace="nowrap"
            cursor="pointer"
            bg={active ? "brand.solid" : "transparent"}
            color={active ? "brand.contrast" : "fg.muted"}
            transition="background-color .15s ease, color .15s ease"
            _hover={active ? undefined : { color: "fg.ink" }}
        >
            {label}
        </chakra.button>
    )
}

/** The count chip that replaced the bare "0 zahtjeva" line of text. */
function CountChip({
    children,
    tone = "brand",
}: {
    children: React.ReactNode
    tone?: "brand" | "muted"
}) {
    return (
        <HStack
            gap="1.5"
            px="2.5"
            py="1"
            rounded="full"
            bg={tone === "brand" ? "brand.subtle" : "bg.muted"}
            color={tone === "brand" ? "brand.fg" : "fg.muted"}
            flexShrink="0"
        >
            <FiUsers size={13} />
            <Text fontSize="xs" fontWeight="bold" whiteSpace="nowrap">
                {children}
            </Text>
        </HStack>
    )
}

export default function FindPairPage() {
    const { t: tt } = useTranslation()
    const plural = usePlural()
    const { user, isAdmin } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()
    const queryClient = useQueryClient()

    /* ── Data ───────────────────────────────────────────────────────────────
       The upcoming tournaments share /turniri's cache entry, so arriving here
       from the listing costs no request at all. They feed three things: the
       form's picker, the "Turnir" filter, and the coordinates the request
       cards need for their "open on map" button (the pair-request DTO carries
       no latitude/longitude of its own).
       ──────────────────────────────────────────────────────────────────── */
    const { data: tournamentsData, isPending: loadingTournaments } = useQuery({
        queryKey: qk.tournaments({ status: "upcoming" }),
        queryFn: () => fetchTournaments("upcoming"),
    })
    const tournaments = (tournamentsData ?? EMPTY_TOURNAMENTS) as TournamentLite[]

    /** uuid → `/karta?turnir=…` for every tournament we can actually place. */
    const mapHrefByTournament = useMemo(() => {
        const out = new Map<string, string>()
        for (const item of tournaments) {
            if (hasMapCoordinates(item)) out.set(item.uuid, mapLinkFor(item))
        }
        return out
    }, [tournaments])

    /* ── Toolbar state ──────────────────────────────────────────────────── */
    const [filtersOpen, setFiltersOpen] = useState(false)
    const [search, setSearch] = useState("")
    const [statusFilter, setStatusFilter] = useState<StatusFilter>(DEFAULT_STATUS)
    const [tournamentFilter, setTournamentFilter] = useState<string>("") // empty = all
    const [onlyMine, setOnlyMine] = useState(false)

    const searchRef = useRef<HTMLInputElement>(null)
    const isApple = useSearchHotkey(searchRef)

    /* ── Form state ─────────────────────────────────────────────────────────
       `editingUuid` set => editing an existing request; otherwise creating.
       The form lives in a dialog, so opening it never moves the board.
       ──────────────────────────────────────────────────────────────────── */
    const [formOpen, setFormOpen] = useState(false)
    const [editingUuid, setEditingUuid] = useState<string | null>(null)
    const [selectedTournamentUuid, setSelectedTournamentUuid] = useState<string>("")
    const [playerName, setPlayerName] = useState("")
    const [phoneCountry, setPhoneCountry] = useState<string>("+385")
    const [phone, setPhone] = useState("")
    const [note, setNote] = useState("")
    const [submitting, setSubmitting] = useState(false)
    const [formError, setFormError] = useState<string | null>(null)
    // Two-phase delete — replaced the blocking window.confirm().
    const [pendingDeleteUuid, setPendingDeleteUuid] = useState<string | null>(null)
    const [deleting, setDeleting] = useState(false)

    // Shared own-profile query (see hooks/useMyProfile) — the navbar and
    // ThemeSync read the same entry, so this prefill costs no extra request.
    const { data: myProfile } = useMyProfile()

    /* One-shot latch for the country-code prefill, the same one
       CreateTournamentPage uses. `phoneCountry` has a non-empty default
       ("+385"), so an "is it empty" guard can never fire, and this effect
       re-runs on every new `profile` object — without the latch a background
       profile refetch would snap the dropdown back after the user picked a
       different country. Reset in `resetForm`, so a freshly opened form seeds
       again from the saved profile. */
    const phoneCountrySeededRef = useRef(false)

    // Prefill name from the Firebase profile when the form opens for create.
    // Only seeds when blank, so nothing already typed is overwritten, and
    // skipped entirely when editing (the server gave us the values).
    useEffect(() => {
        if (!formOpen) return
        if (editingUuid) return
        if (!user) return
        if (playerName.trim()) return
        const seed = myProfile?.displayName?.trim()
            || user.displayName?.trim()
            || user.email?.split("@")[0]
            || ""
        if (seed) setPlayerName(seed)
    }, [formOpen, user, playerName, editingUuid, myProfile])

    // Prefill phone from the saved profile, same rules.
    useEffect(() => {
        if (!formOpen) return
        if (editingUuid) return
        if (!user) return
        if (!myProfile) return
        if (!phone.trim() && myProfile.phone) setPhone(myProfile.phone)
        if (myProfile.phoneCountry && !phoneCountrySeededRef.current) {
            phoneCountrySeededRef.current = true
            setPhoneCountry(myProfile.phoneCountry)
        }
    // `phone` is deliberately absent: including it would re-run the effect on
    // every keystroke, and the guard above already makes a re-run a no-op.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formOpen, user, editingUuid, myProfile])

    // Default the form's tournament picker to the first upcoming tournament,
    // once, as soon as the list lands. Kept as an effect (not derived state)
    // so the user's own pick is never overwritten by a background refetch.
    useEffect(() => {
        if (selectedTournamentUuid) return
        const first = tournaments[0]
        if (first?.uuid) setSelectedTournamentUuid(first.uuid)
    }, [tournaments, selectedTournamentUuid])

    /* ── The board ──────────────────────────────────────────────────────── */
    const viewerKey = user?.uid ?? "anon"
    const requestsQueryKey = qk.pairRequests(statusFilter, viewerKey)
    const {
        data: requests = EMPTY_REQUESTS,
        isPending: loadingRequests,
        error: requestsQueryError,
    } = useQuery<PairRequest[]>({
        queryKey: requestsQueryKey,
        queryFn: () => listPairRequests(statusFilter === "all" ? undefined : statusFilter),
    })
    const requestsError = requestsQueryError
        ? (requestsQueryError.message || tt("pages.findPair.loadRequestsError"))
        : null

    /** Apply a local edit to the currently displayed request list. The board is
     *  small and the mutations return the full updated row, so patching the
     *  cache directly beats a refetch round-trip. Other status buckets are
     *  invalidated so they re-read when the user switches to them. */
    const patchRequests = useCallback(
        (updater: (rs: PairRequest[]) => PairRequest[]) => {
            queryClient.setQueryData<PairRequest[]>(requestsQueryKey, (rs) => updater(rs ?? []))
            // Prefix key, not `qk.pairRequests()` — that would build a concrete
            // ["pairRequests", "all", "anon"] entry and match nothing else.
            queryClient.invalidateQueries({
                queryKey: qk.pairRequestsRoot,
                exact: false,
                refetchType: "none",
            })
        },
        // requestsQueryKey is a fresh tuple each render but its CONTENT only
        // changes with statusFilter / viewerKey, which is what actually matters.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [queryClient, statusFilter, viewerKey],
    )

    const activeFilterCount =
        (statusFilter !== DEFAULT_STATUS ? 1 : 0) +
        (tournamentFilter ? 1 : 0) +
        (onlyMine ? 1 : 0)

    /** True when the reader has narrowed the board themselves — which is what
     *  separates "nobody has posted" from "your filters hid everything". */
    const isFiltering = search.trim().length > 0 || activeFilterCount > 0

    function resetFilters() {
        setSearch("")
        setStatusFilter(DEFAULT_STATUS)
        setTournamentFilter("")
        setOnlyMine(false)
    }

    const visibleRequests = useMemo(() => {
        const q = search.trim().toLowerCase()
        const mine = user?.uid
        const base = requests.filter((r) => {
            if (tournamentFilter && r.tournamentUuid !== tournamentFilter) return false
            if (onlyMine && (!mine || r.createdByUid !== mine)) return false
            if (q) {
                const blob = `${r.playerName} ${r.tournamentName} ${r.note ?? ""} ${r.tournamentLocation ?? ""}`
                    .toLowerCase()
                if (!blob.includes(q)) return false
            }
            return true
        })
        return sortPairRequests(base)
    }, [requests, search, tournamentFilter, onlyMine, user?.uid])

    const openCount = useMemo(
        () => requests.filter((r) => r.status === "OPEN").length,
        [requests],
    )

    /* ── Form actions ───────────────────────────────────────────────────── */

    function resetForm() {
        setEditingUuid(null)
        setPlayerName("")
        setPhone("")
        setPhoneCountry("+385")
        setNote("")
        setFormError(null)
        phoneCountrySeededRef.current = false
    }

    function closeForm() {
        resetForm()
        setFormOpen(false)
    }

    /** The primary action. Anonymous visitors can read the board but not post,
     *  so they are routed to /prijava and back rather than shown a form that
     *  would 401 on submit. */
    function openCreateForm() {
        if (!user) {
            const from = `${location.pathname}${location.search}`
            navigate(`/prijava?next=${encodeURIComponent(from)}`, { state: { from } })
            return
        }
        resetForm()
        setFormOpen(true)
    }

    /** Open the form pre-populated with an existing request's values. */
    function startEdit(r: PairRequest) {
        setEditingUuid(r.uuid)
        setSelectedTournamentUuid(r.tournamentUuid)
        setPlayerName(r.playerName)
        const split = splitPhone(r.phone)
        setPhoneCountry(split.country)
        setPhone(split.local)
        setNote(r.note ?? "")
        setFormError(null)
        // Editing must not be overwritten by the create-path prefills, and the
        // latch is what stops a profile refetch touching the country code.
        phoneCountrySeededRef.current = true
        setFormOpen(true)
    }

    const onSubmit: React.FormEventHandler<HTMLFormElement> = async (e) => {
        e.preventDefault()
        setFormError(null)
        if (!selectedTournamentUuid) {
            setFormError(tt("pages.findPair.form.selectTournamentError"))
            return
        }
        if (!playerName.trim()) {
            setFormError(tt("pages.findPair.form.nameRequiredError"))
            return
        }
        try {
            setSubmitting(true)
            const fullPhone = joinPhone(phoneCountry, phone) ?? ""
            if (editingUuid) {
                const updated = await updatePairRequest(editingUuid, {
                    playerName: playerName.trim(),
                    phone: fullPhone,
                    note: note.trim() || null,
                })
                patchRequests((rs) => rs.map((r) => (r.uuid === updated.uuid ? updated : r)))
            } else {
                const created = await createPairRequest(selectedTournamentUuid, {
                    playerName: playerName.trim(),
                    phone: fullPhone,
                    note: note.trim() || null,
                })
                patchRequests((rs) => [created, ...rs])
            }
            closeForm()
        } catch (e) {
            setFormError(
                requestErrorText(e)
                    ?? (editingUuid
                        ? tt("pages.findPair.form.saveEditError")
                        : tt("pages.findPair.form.createError")),
            )
        } finally {
            setSubmitting(false)
        }
    }

    async function onMatch(uuid: string) {
        try {
            const updated = await matchPairRequest(uuid)
            patchRequests((rs) => rs.map((r) => (r.uuid === uuid ? updated : r)))
        } catch (e) {
            showError(tt("pages.findPair.toast.matchErrorTitle"), requestErrorText(e))
        }
    }

    /** Staged by the delete button, fired by the ConfirmDialog at the bottom. */
    async function onConfirmDelete() {
        const uuid = pendingDeleteUuid
        if (!uuid) return
        try {
            setDeleting(true)
            await deletePairRequest(uuid)
            patchRequests((rs) => rs.filter((r) => r.uuid !== uuid))
            setPendingDeleteUuid(null)
        } catch (e) {
            showError(tt("pages.findPair.toast.deleteErrorTitle"), requestErrorText(e))
        } finally {
            setDeleting(false)
        }
    }

    const selectedTournament = useMemo(
        () => tournaments.find((t) => t.uuid === selectedTournamentUuid),
        [tournaments, selectedTournamentUuid],
    )

    const gridCols = { base: "1fr", md: "1fr 1fr", xl: "repeat(3, 1fr)" }

    /* ── Rendering the board ────────────────────────────────────────────── */

    function renderBoard() {
        if (loadingRequests) {
            return (
                <Grid templateColumns={gridCols} gap="4">
                    <PairRequestCardSkeleton />
                    <PairRequestCardSkeleton />
                    <PairRequestCardSkeleton />
                </Grid>
            )
        }

        if (requestsError) {
            return (
                <Box borderWidth="1px" borderColor="red.muted" bg="red.subtle" rounded="lg" p="4">
                    <Text color="red.fg" fontSize="sm">{requestsError}</Text>
                </Box>
            )
        }

        if (visibleRequests.length === 0) {
            /* Two genuinely different states, and the funnel icon only ever
               belonged to the second one:
                 · nothing has been posted (or nothing in this status) and the
                   reader has narrowed nothing — the fix is to POST;
                 · the reader's own search/filters emptied a non-empty board —
                   the fix is to CLEAR them. */
            return isFiltering ? (
                <Box borderWidth="1px" borderColor="border.emphasized" borderStyle="dashed" rounded="xl">
                    <EmptyState
                        compact
                        icon={FiFilter}
                        title={tt("pages.findPair.empty.noResultsTitle")}
                        description={tt("pages.findPair.empty.noResultsDescription")}
                        action={
                            <Button size="sm" variant="outline" onClick={resetFilters}>
                                {tt("pages.findPair.empty.clearFilters")}
                            </Button>
                        }
                    />
                </Box>
            ) : (
                <Box borderWidth="1px" borderColor="border.emphasized" borderStyle="dashed" rounded="xl">
                    <EmptyState
                        compact
                        icon={FiUsers}
                        title={tt("pages.findPair.empty.noRequestsTitle")}
                        description={
                            user
                                ? tt("pages.findPair.empty.noRequestsDescription")
                                : tt("pages.findPair.empty.noRequestsAnonDescription")
                        }
                        action={
                            <Button size="sm" colorPalette="brand" onClick={openCreateForm}>
                                <FiUserPlus /> {tt("pages.findPair.form.toggleShow")}
                            </Button>
                        }
                    />
                </Box>
            )
        }

        const items = visibleRequests.map((r) => {
            // Spareno / uredi / obriši belong to the original poster and to
            // admins; everyone else reads the row.
            const canManage = (!!user?.uid && user.uid === r.createdByUid) || isAdmin
            return {
                r,
                canManage,
                mapHref: mapHrefByTournament.get(r.tournamentUuid) ?? null,
                anonymous: !user,
                onEdit: () => startEdit(r),
                onMatch: () => onMatch(r.uuid),
                onDelete: () => setPendingDeleteUuid(r.uuid),
            }
        })

        return (
            <Grid templateColumns={gridCols} gap="4">
                {items.map((props) => (
                    <PairRequestCard key={props.r.uuid} {...props} />
                ))}
            </Grid>
        )
    }

    return (
        <VStack align="stretch" gap="4">
            {/* ── Header band: what the board holds, and the one way to add to
                it. The count chip is the "0 zahtjeva" line of text promoted to
                the thing it always was. At 390px the chips and the button
                still share this row — the button loses nothing but padding. */}
            <HStack justify="space-between" align="center" gap="3" wrap="wrap" rowGap="2">
                {/* Held back until the first fetch settles: a chip reading
                    "0 zahtjeva" over three skeletons states something we do
                    not know yet. */}
                <HStack gap="2" wrap="wrap" rowGap="2" minW="0">
                    {!loadingRequests && !requestsError && (
                        <>
                            <CountChip>
                                {requests.length !== visibleRequests.length
                                    ? plural("pages.findPair.stats.countOfTotal", visibleRequests.length, {
                                        total: requests.length,
                                    })
                                    : plural("pages.findPair.stats.count", visibleRequests.length)}
                            </CountChip>
                            {statusFilter !== "open" && (
                                <CountChip tone="muted">
                                    {plural("pages.findPair.stats.activeTotal", openCount)}
                                </CountChip>
                            )}
                        </>
                    )}
                </HStack>
                <Button
                    size="sm"
                    h={{ base: "38px", md: "40px" }}
                    colorPalette="brand"
                    rounded="lg"
                    fontWeight="bold"
                    flexShrink="0"
                    onClick={openCreateForm}
                >
                    <FiUserPlus /> {tt("pages.findPair.form.toggleShow")}
                </Button>
            </HStack>

            {/* ── Toolbar. Same shape as /turniri: one row on md+, and on
                phones the search takes a full row with the three controls
                sharing the row beneath it (Filteri keeps its word — it is the
                only one that opens anything — while Sortiraj collapses to its
                icon and the view switch to two). Dropping labels rather than
                wrapping keeps the toolbar two rows tall so the first request
                stays on the first screen. */}
            <Box>
                <Stack direction={{ base: "column", md: "row" }} gap="2" align="stretch">
                    <Box position="relative" flex="1" minW={{ base: "100%", md: "240px" }}>
                        <Box
                            position="absolute"
                            left="3.5"
                            top="50%"
                            color="fg.muted"
                            pointerEvents="none"
                            zIndex="1"
                            style={{ transform: "translateY(-50%)" }}
                        >
                            <FiSearch />
                        </Box>
                        <Input
                            ref={searchRef}
                            h={{ base: "42px", md: "44px" }}
                            pl="10"
                            pr="16"
                            bg="bg.panel"
                            borderColor="border.subtle"
                            rounded="lg"
                            placeholder={tt("pages.findPair.filters.searchPlaceholder")}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => {
                                // Escape empties a non-empty box, then gets out
                                // of the way on a second press.
                                if (e.key !== "Escape") return
                                if (search) {
                                    e.preventDefault()
                                    setSearch("")
                                } else {
                                    e.currentTarget.blur()
                                }
                            }}
                        />
                        <Box
                            position="absolute"
                            right="2.5"
                            top="50%"
                            style={{ transform: "translateY(-50%)" }}
                        >
                            {search ? (
                                <IconButton
                                    aria-label={tt("pages.findPair.filters.searchClearAria")}
                                    size="xs"
                                    variant="ghost"
                                    onClick={() => setSearch("")}
                                >
                                    <FiX />
                                </IconButton>
                            ) : (
                                // Hidden on phones: there is no physical
                                // keyboard to press it with, and a hint for a
                                // shortcut you cannot use is worse than none.
                                <Box
                                    display={{ base: "none", md: "block" }}
                                    title={tt("pages.findPair.filters.searchShortcutTitle")}
                                    aria-hidden="true"
                                    textStyle="mono"
                                    fontSize="2xs"
                                    color="fg.muted"
                                    bg="bg.subtle"
                                    borderWidth="1px"
                                    borderColor="border.subtle"
                                    px="1.5"
                                    py="0.5"
                                    rounded="sm"
                                >
                                    {isApple ? "⌘K" : "Ctrl K"}
                                </Box>
                            )}
                        </Box>
                    </Box>

                    <HStack gap="2" wrap="nowrap" justify={{ base: "space-between", md: "flex-start" }}>
                        <Button
                            h={{ base: "42px", md: "44px" }}
                            px={{ base: "3", md: "4" }}
                            variant={activeFilterCount > 0 ? "solid" : "outline"}
                            colorPalette={activeFilterCount > 0 ? "brand" : "gray"}
                            bg={activeFilterCount > 0 ? undefined : "bg.panel"}
                            rounded="lg"
                            fontWeight="semibold"
                            onClick={() => setFiltersOpen((v) => !v)}
                            aria-expanded={filtersOpen}
                            title={filtersOpen
                                ? tt("pages.findPair.filters.toggleHide")
                                : tt("pages.findPair.filters.toggleShow")}
                        >
                            <FiFilter /> {tt("pages.findPair.filters.button")}
                            {activeFilterCount > 0 && (
                                <Box
                                    ml="1"
                                    px="1.5"
                                    rounded="full"
                                    bg="whiteAlpha.400"
                                    fontSize="2xs"
                                    fontWeight="bold"
                                >
                                    {activeFilterCount}
                                </Box>
                            )}
                            {filtersOpen ? <FiChevronUp /> : <FiChevronDown />}
                        </Button>
                    </HStack>
                </Stack>

                {/* ── Expanded filter panel ──────────────────────────────── */}
                {filtersOpen && (
                    <Box
                        mt="3"
                        p="4"
                        bg="bg.panel"
                        borderWidth="1px"
                        borderColor="border.subtle"
                        rounded="xl"
                        shadow="card"
                    >
                        <Grid
                            templateColumns={{ base: "1fr", md: "minmax(220px, auto) minmax(200px, 1fr)" }}
                            gap="3"
                        >
                            <Box minW="0">
                                <FilterLabel>{tt("pages.findPair.filters.statusLabel")}</FilterLabel>
                                {/* Segmented rather than a select: three options
                                    that change what the SERVER is asked for
                                    deserve to be visible at a glance, and at
                                    390px three short words still fit one row. */}
                                <HStack
                                    gap="1"
                                    p="1"
                                    bg="bg.subtle"
                                    borderWidth="1px"
                                    borderColor="border.subtle"
                                    rounded="lg"
                                    role="group"
                                    aria-label={tt("pages.findPair.filters.statusLabel")}
                                >
                                    <StatusSegment
                                        active={statusFilter === "open"}
                                        onClick={() => setStatusFilter("open")}
                                        label={tt("pages.findPair.filters.statusOpen")}
                                    />
                                    <StatusSegment
                                        active={statusFilter === "matched"}
                                        onClick={() => setStatusFilter("matched")}
                                        label={tt("pages.findPair.filters.statusMatched")}
                                    />
                                    <StatusSegment
                                        active={statusFilter === "all"}
                                        onClick={() => setStatusFilter("all")}
                                        label={tt("pages.findPair.filters.statusAll")}
                                    />
                                </HStack>
                            </Box>
                            <Box minW="0">
                                <FilterLabel>{tt("pages.findPair.tournamentLabel")}</FilterLabel>
                                <NativeSelect.Root size="sm">
                                    <NativeSelect.Field
                                        value={tournamentFilter}
                                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                                            setTournamentFilter(e.target.value)
                                        }
                                    >
                                        <option value="">
                                            {tt("pages.findPair.filters.allTournaments")}
                                        </option>
                                        {tournaments.map((item) => (
                                            <option key={item.uuid} value={item.uuid}>
                                                {item.name}
                                            </option>
                                        ))}
                                    </NativeSelect.Field>
                                </NativeSelect.Root>
                            </Box>
                        </Grid>

                        <HStack
                            mt="4"
                            pt="3"
                            borderTopWidth="1px"
                            borderColor="border.subtle"
                            gap="2"
                            wrap="wrap"
                            rowGap="2"
                        >
                            {/* Only offered to someone who HAS requests of their
                                own to isolate — for a guest it would filter to a
                                guaranteed zero. */}
                            {user && (
                                <Button
                                    size="xs"
                                    variant={onlyMine ? "solid" : "outline"}
                                    colorPalette={onlyMine ? "brand" : "gray"}
                                    onClick={() => setOnlyMine((v) => !v)}
                                    aria-pressed={onlyMine}
                                >
                                    <FiUsers /> {tt("pages.findPair.filters.onlyMine")}
                                </Button>
                            )}
                            <Button
                                size="xs"
                                variant="ghost"
                                ml="auto"
                                onClick={resetFilters}
                                disabled={!isFiltering}
                                title={isFiltering
                                    ? tt("pages.findPair.filters.clearAllTitleActive")
                                    : tt("pages.findPair.filters.clearAllTitleInactive")}
                            >
                                {tt("pages.findPair.filters.clearAll")}
                            </Button>
                        </HStack>
                    </Box>
                )}
            </Box>

            {/* Signed-out readers see every phone redacted by the backend. Say
                so once, as a property of the page, instead of letting each card
                imply something it cannot know. */}
            {!user && (
                <HStack
                    gap="3"
                    px="3.5"
                    py="2.5"
                    rounded="lg"
                    borderWidth="1px"
                    borderColor="border.subtle"
                    bg="bg.subtle"
                    wrap="wrap"
                    rowGap="2"
                >
                    <Text fontSize="sm" color="fg.muted" flex="1" minW="200px">
                        {tt("pages.findPair.anonNotice")}
                    </Text>
                    <Button
                        size="xs"
                        variant="outline"
                        colorPalette="brand"
                        flexShrink="0"
                        onClick={() => {
                            const from = `${location.pathname}${location.search}`
                            navigate(`/prijava?next=${encodeURIComponent(from)}`, { state: { from } })
                        }}
                    >
                        {tt("common.nav.login")}
                    </Button>
                </HStack>
            )}

            {renderBoard()}

            {/* ── The form. A dialog, not a panel above the list: the board is
                the page, posting is a task, and a task that opens in place is
                what buried the requests in the first place. On phones it is a
                bottom sheet that scrolls inside itself, so the page behind
                never grows into a wall. */}
            <Dialog.Root
                open={formOpen}
                onOpenChange={(e) => { if (!e.open && !submitting) closeForm() }}
                placement={{ base: "bottom", md: "center" }}
                motionPreset={{ base: "slide-in-bottom", md: "scale" }}
                scrollBehavior="inside"
            >
                <Portal>
                    <Dialog.Backdrop />
                    <Dialog.Positioner>
                        {/* `placement="bottom"` gives the content a 4rem margin
                            top AND bottom (Chakra's `--dialog-base-margin`),
                            and the positioner clips overflow while
                            `scrollBehavior="inside"` is on — so the height cap
                            has to leave room for BOTH margins or the sheet gets
                            cut off. 9rem > 8rem does that with a little slack.
                            The 4rem bottom margin also clears the 56px
                            MobileTabBar, which the backdrop covers anyway. */}
                        <Dialog.Content
                            maxW={{ base: "calc(100% - 1.5rem)", md: "xl" }}
                            maxH={{ base: "calc(100dvh - 9rem)", md: "85vh" }}
                        >
                            {/* The dialog header recipe is `display:flex` with
                                no justification of its own, so the title block
                                and the close button need one set here. */}
                            <Dialog.Header justifyContent="space-between" alignItems="center">
                                <HStack gap="2.5" align="center" minW="0">
                                    <Box color="brand.fg" display="inline-flex">
                                        {editingUuid ? <FiEdit2 /> : <FiUserPlus />}
                                    </Box>
                                    <Dialog.Title fontSize="md">
                                        {editingUuid
                                            ? tt("pages.findPair.form.titleEdit")
                                            : tt("pages.findPair.form.titleCreate")}
                                    </Dialog.Title>
                                </HStack>
                                <Dialog.CloseTrigger asChild>
                                    <IconButton
                                        aria-label={tt("common.cancel")}
                                        size="xs"
                                        variant="ghost"
                                        disabled={submitting}
                                    >
                                        <FiX />
                                    </IconButton>
                                </Dialog.CloseTrigger>
                            </Dialog.Header>

                            {/* The <form> lives in the body (which is what
                                scrolls) while the submit button lives in the
                                pinned footer, joined by the HTML `form`
                                attribute rather than by nesting. Enter from any
                                field still submits, and on a phone the buttons
                                never scroll out of reach. */}
                            <Dialog.Body>
                                <chakra.form id={FORM_ID} onSubmit={onSubmit}>
                                    <VStack align="stretch" gap="4">
                                        <Field.Root required>
                                            <Field.Label>
                                                {tt("pages.findPair.tournamentLabel")}{" "}
                                                <Field.RequiredIndicator />
                                            </Field.Label>
                                            <NativeSelect.Root size="sm" disabled={!!editingUuid}>
                                                <NativeSelect.Field
                                                    value={selectedTournamentUuid}
                                                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                                                        setSelectedTournamentUuid(e.target.value)
                                                    }
                                                >
                                                    {loadingTournaments ? (
                                                        <option value="">{tt("common.loading")}</option>
                                                    ) : editingUuid ? (
                                                        // While editing we always render the
                                                        // request's tournament so the value
                                                        // stays valid even when it has left
                                                        // the upcoming list.
                                                        <>
                                                            {!tournaments.some((item) => item.uuid === selectedTournamentUuid) && (
                                                                <option value={selectedTournamentUuid}>
                                                                    {requests.find((r) => r.uuid === editingUuid)?.tournamentName
                                                                        ?? selectedTournamentUuid}
                                                                </option>
                                                            )}
                                                            {tournaments.map((item) => (
                                                                <option key={item.uuid} value={item.uuid}>
                                                                    {item.name}
                                                                </option>
                                                            ))}
                                                        </>
                                                    ) : tournaments.length === 0 ? (
                                                        <option value="">
                                                            {tt("pages.findPair.form.noUpcomingTournaments")}
                                                        </option>
                                                    ) : (
                                                        tournaments.map((item) => (
                                                            <option key={item.uuid} value={item.uuid}>
                                                                {item.name}
                                                            </option>
                                                        ))
                                                    )}
                                                </NativeSelect.Field>
                                            </NativeSelect.Root>
                                            {editingUuid && (
                                                <Field.HelperText>
                                                    {tt("pages.findPair.form.tournamentLockedHelp")}
                                                </Field.HelperText>
                                            )}
                                            {selectedTournament && !editingUuid && (
                                                <Field.HelperText>
                                                    {[
                                                        selectedTournament.location,
                                                        formatDateTime(selectedTournament.startAt),
                                                    ].filter(Boolean).join(" · ")}
                                                </Field.HelperText>
                                            )}
                                        </Field.Root>

                                        <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap="4">
                                            <Field.Root required>
                                                <Field.Label>
                                                    {tt("pages.findPair.form.nameLabel")}{" "}
                                                    <Field.RequiredIndicator />
                                                </Field.Label>
                                                <Input
                                                    size="sm"
                                                    placeholder={tt("pages.findPair.form.namePlaceholder")}
                                                    value={playerName}
                                                    onChange={(e) => setPlayerName(e.target.value)}
                                                />
                                            </Field.Root>
                                            <Field.Root>
                                                <Field.Label>
                                                    {tt("pages.findPair.form.phoneLabel")}{" "}
                                                    <chakra.span color="fg.muted" fontSize="xs">
                                                        {tt("pages.findPair.form.optional")}
                                                    </chakra.span>
                                                </Field.Label>
                                                <HStack gap="2" w="full">
                                                    <NativeSelect.Root size="sm" w="110px" flexShrink="0">
                                                        <NativeSelect.Field
                                                            aria-label={tt("pages.findPair.form.phoneCountryAria")}
                                                            value={phoneCountry}
                                                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                                                                setPhoneCountry(e.target.value)
                                                            }
                                                        >
                                                            {PHONE_COUNTRIES.map((c) => (
                                                                <option key={c.value} value={c.value}>{c.label}</option>
                                                            ))}
                                                        </NativeSelect.Field>
                                                    </NativeSelect.Root>
                                                    <Input
                                                        flex="1"
                                                        minW="0"
                                                        size="sm"
                                                        type="tel"
                                                        inputMode="numeric"
                                                        pattern="[0-9 ]*"
                                                        placeholder={tt("pages.findPair.form.phonePlaceholder")}
                                                        value={phone}
                                                        // Digits + spaces only — the dial code
                                                        // lives in the adjacent select.
                                                        onChange={(e) => setPhone(sanitizePhone(e.target.value))}
                                                    />
                                                </HStack>
                                                <Field.HelperText>
                                                    {tt("pages.findPair.form.phoneVisibilityHelp")}
                                                </Field.HelperText>
                                            </Field.Root>
                                        </Grid>

                                        <Field.Root>
                                            <Field.Label>{tt("pages.findPair.form.noteLabel")}</Field.Label>
                                            <Textarea
                                                size="sm"
                                                placeholder={tt("pages.findPair.form.notePlaceholder")}
                                                value={note}
                                                onChange={(e) => setNote(e.target.value)}
                                                rows={3}
                                            />
                                        </Field.Root>

                                        {formError && (
                                            <Box
                                                borderWidth="1px"
                                                borderColor="red.muted"
                                                bg="red.subtle"
                                                rounded="md"
                                                p="3"
                                            >
                                                <Text color="red.fg" fontSize="sm">{String(formError)}</Text>
                                            </Box>
                                        )}
                                    </VStack>
                                </chakra.form>
                            </Dialog.Body>

                            <Dialog.Footer gap="2">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={closeForm}
                                    disabled={submitting}
                                >
                                    {tt("common.cancel")}
                                </Button>
                                <Button
                                    type="submit"
                                    form={FORM_ID}
                                    colorPalette="brand"
                                    size="sm"
                                    loading={submitting}
                                    disabled={!selectedTournamentUuid || submitting}
                                >
                                    {editingUuid ? (
                                        <><FiCheck /> {tt("common.save")}</>
                                    ) : (
                                        <><FiUserPlus /> {tt("pages.findPair.form.toggleShow")}</>
                                    )}
                                </Button>
                            </Dialog.Footer>
                        </Dialog.Content>
                    </Dialog.Positioner>
                </Portal>
            </Dialog.Root>

            <ConfirmDialog
                open={pendingDeleteUuid !== null}
                title={tt("pages.findPair.confirmDelete.title")}
                description={tt("pages.findPair.confirmDelete.description")}
                confirmLabel={tt("common.delete")}
                destructive
                busy={deleting}
                onConfirm={onConfirmDelete}
                onCancel={() => setPendingDeleteUuid(null)}
            />
        </VStack>
    )
}
