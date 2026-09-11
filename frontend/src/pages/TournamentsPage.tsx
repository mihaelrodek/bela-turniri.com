import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import {
    Box,
    Button,
    chakra,
    Grid,
    Heading,
    HStack,
    IconButton,
    Input,
    Menu,
    Portal,
    Slider,
    Stack,
    Text,
    VStack,
} from "@chakra-ui/react"
import { Link as RouterLink, useNavigate } from "react-router-dom"
import {
    FiCalendar,
    FiCheck,
    FiChevronDown,
    FiChevronUp,
    FiFilter,
    FiGrid,
    FiList,
    FiNavigation,
    FiPlus,
    FiSearch,
    FiSliders,
    FiX,
} from "react-icons/fi"
import { fetchTournaments, fetchTournamentsCount } from "../api/tournaments"
import { qk } from "../queryClient"
import { useUserLocation } from "../hooks/useUserLocation"
import { haversineKm } from "../utils/distance"
import { useDocumentHead } from "../hooks/useDocumentHead"
import { useSearchHotkey } from "../hooks/useSearchHotkey"
import { showError } from "../toaster"
import { useTranslation, usePlural } from "../i18n"
import EmptyState from "../components/EmptyState"
import ListingCard, { ListingCardSkeleton } from "../components/ListingCard"
import ListingRow, { ListingRowSkeleton } from "../components/ListingRow"
import {
    NEARBY_DEFAULT_KM,
    RADIUS_MAX_KM,
    SORT_MODES,
    sortNeedsLocation,
    sortTournaments,
    type ListingTournament,
    type SortMode,
} from "../components/listingShared"
import {
    TURNIRI_LIST_TOUR_STEPS,
    TOUR_RESUME_DETAIL_KEY,
    TOUR_DEMO_TOURNAMENT_SLUG,
    notifyTourOfLayoutChange,
} from "../components/tourSteps"

/* react-joyride and the whole tour runtime are only ever needed when the user
   taps the NavBar "?" button, which the overwhelming majority never do — so
   the component is split out of the list's own chunk and fetched on demand.
   `PageTour` renders null until it has steps to run, so a Suspense fallback of
   `null` keeps the page pixel-identical while the chunk loads. */
const PageTour = lazy(() => import("../components/PageTour"))

/* ──────────────────────────────────────────────────────────────────────────
   TournamentsPage — the listing.

   The screen is one toolbar over two sections:

     1. a single-row toolbar — search (with a real ⌘K / Ctrl-K shortcut behind
        the hint chip), the "Kreiraj turnir" action, a "Filteri" disclosure, a
        "Sortiraj" menu and a Mreža/Popis view switcher. Creating a tournament
        lives HERE, not in the navigation: it is an action rather than a
        destination, and it was costing a slot in both the desktop capsule and
        the mobile tab bar;
     2. a filter panel that only exists while "Filteri" is on, holding the
        location, kotizacija and repasaž ranges plus the "U krugu od" radius —
        the old "Blizu mene" toggle and its three radius chips MOVED here and
        became that one slider, rather than a second set of controls;
     3. "Nadolazeći" and "Završeni turniri", both rendered through the same
        view mode so the switcher is a property of the page, not of one list.

   Filtering and sorting apply to the upcoming list only. The finished list is
   server-paginated ("Učitaj više"), so narrowing it client-side would show a
   count the server never agreed to.
   ────────────────────────────────────────────────────────────────────── */

/** Stable empty default for the query results — a fresh `[]` literal on every
 *  render would bust the filtering useMemos below. */
const EMPTY_CARDS: ListingTournament[] = []

const FINISHED_PREVIEW_LIMIT = 6

/** Below this many trimmed characters the finished-search group doesn't run
 *  at all — mirrors the backend's own `MIN_QUERY_LENGTH` so the SPA never
 *  fires a request the server would just ignore. */
const SEARCH_MIN_LENGTH = 2

/** Page size for the finished-search group's own "prikaži još" ladder. */
const SEARCH_FINISHED_PAGE_SIZE = 20

/** Grid ↔ list is a viewing preference, not a filter: it survives navigating
 *  away and back within the tab, and resets on the next visit. sessionStorage
 *  (not localStorage) is exactly that lifetime. */
const VIEW_STORAGE_KEY = "bela:turniri-view"

type ViewMode = "grid" | "list"

function readStoredView(): ViewMode {
    try {
        return window.sessionStorage.getItem(VIEW_STORAGE_KEY) === "list" ? "list" : "grid"
    } catch {
        /* private mode — fall back to the default */
        return "grid"
    }
}

/** Dictionary leaf for each sort mode, so the internal keys can stay terse
 *  while the copy lives in `pages.tournaments.sort.*`. */
const SORT_LABEL_KEY: Record<SortMode, string> = {
    date_asc: "pages.tournaments.sort.dateAsc",
    date_desc: "pages.tournaments.sort.dateDesc",
    price_asc: "pages.tournaments.sort.priceAsc",
    popular: "pages.tournaments.sort.popular",
    name_asc: "pages.tournaments.sort.nameAsc",
    distance_asc: "pages.tournaments.sort.distanceAsc",
}

/** Small upper-case letter-spaced caption over each control in the filter
 *  panel. The dictionary keeps the copy in normal case; the shouting is
 *  presentation, so it happens here. */
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

/** One half of the Mreža/Popis segmented control. The label is hidden on
 *  phones, so the accessible name has to come from `aria-label` — without it
 *  the button has no name at all at 390px. */
function ViewToggleButton({
    active,
    onClick,
    icon,
    label,
}: {
    active: boolean
    onClick: () => void
    icon: React.ReactNode
    label: string
}) {
    return (
        <chakra.button
            type="button"
            onClick={onClick}
            aria-label={label}
            aria-pressed={active}
            display="inline-flex"
            alignItems="center"
            gap="1.5"
            px={{ base: "2.5", md: "3" }}
            py="1.5"
            rounded="md"
            fontSize="xs"
            fontWeight="bold"
            cursor="pointer"
            bg={active ? "brand.solid" : "transparent"}
            color={active ? "brand.contrast" : "fg.muted"}
            transition="background-color .15s ease, color .15s ease"
            _hover={active ? undefined : { color: "fg.ink" }}
        >
            {icon}
            <Box as="span" display={{ base: "none", md: "inline" }}>{label}</Box>
        </chakra.button>
    )
}

/**
 * The list's empty branches keep their dashed outline; the content inside is
 * the shared EmptyState primitive so this page and the pair board render the
 * same icon tile, spacing and muted copy.
 */
function ListEmptyState({
    title,
    description,
    cta,
}: {
    title: string
    description?: string
    cta?: React.ReactNode
}) {
    return (
        <Box borderWidth="1px" borderColor="border.emphasized" borderStyle="dashed" rounded="xl">
            <EmptyState compact icon={FiCalendar} title={title} description={description} action={cta} />
        </Box>
    )
}

// ---------- page ----------

export default function TournamentsPage() {
    // `t` is the per-card tournament item throughout the listing components —
    // alias the translator here for symmetry with them.
    const { t: tt, locale } = useTranslation()
    const plural = usePlural()

    useDocumentHead({
        title: tt("pages.tournaments.seo.title"),
        description: tt("pages.tournaments.seo.description"),
        ogTitle: tt("pages.tournaments.seo.ogTitle"),
        ogDescription: tt("pages.tournaments.seo.ogDescription"),
        ogType: "website",
        canonical: "https://bela-turniri.com/turniri",
    })

    const navigate = useNavigate()

    /* ── Data ──────────────────────────────────────────────────────────────
       Three independent react-query entries instead of one big effect. Coming
       back to /turniri inside the 30 s staleTime repaints from cache with no
       request at all; past that it repaints from cache and revalidates in the
       background, so the list never flashes an empty skeleton again.
       ──────────────────────────────────────────────────────────────────── */

    // How many finished tournaments to ask the server for. "Učitaj više" and
    // the tour's eager-load both just raise this number; the query key carries
    // it, so each page size is its own cache entry and keepPreviousData keeps
    // the shorter list on screen while the longer one loads.
    const [finishedLimit, setFinishedLimit] = useState(FINISHED_PREVIEW_LIMIT)

    const upcomingQuery = useQuery({
        queryKey: qk.tournaments({ status: "upcoming" }),
        queryFn: () => fetchTournaments("upcoming"),
    })
    const finishedQuery = useQuery({
        queryKey: qk.tournaments({ status: "finished", limit: finishedLimit }),
        queryFn: () => fetchTournaments("finished", { offset: 0, limit: finishedLimit }),
        placeholderData: keepPreviousData,
    })
    const finishedCountQuery = useQuery({
        queryKey: qk.tournamentsCount("finished"),
        queryFn: () => fetchTournamentsCount("finished"),
    })

    const upcoming = (upcomingQuery.data ?? EMPTY_CARDS) as ListingTournament[]
    const finished = (finishedQuery.data ?? EMPTY_CARDS) as ListingTournament[]
    const finishedTotal = finishedCountQuery.data ?? 0

    const loading = upcomingQuery.isPending
    const error = upcomingQuery.error
        ? (upcomingQuery.error.message || tt("pages.tournaments.loadErrorFallback"))
        : null
    const loadingFinished = finishedQuery.isPending
    const errorFinished = finishedQuery.error
        ? (finishedQuery.error.message || tt("pages.tournaments.loadFinishedErrorFallback"))
        : null
    // Fetching a LARGER page while the previous one is still on screen — i.e.
    // exactly the "Učitaj više" spinner state.
    const loadingMoreFinished = finishedQuery.isFetching && !finishedQuery.isPending

    // Tour replay state — the NavBar "Pokaži kako" button dispatches a
    // window event we listen for here. Incrementing the counter on each
    // event makes PageTour's forceRun prop change, which triggers a
    // run() inside Joyride.
    const [tourReplayKey, setTourReplayKey] = useState(0)
    useEffect(() => {
        function onReplay() {
            setTourReplayKey((k) => k + 1)
        }
        window.addEventListener("bela:tour-replay", onReplay)
        return () => window.removeEventListener("bela:tour-replay", onReplay)
    }, [])

    /* ── Toolbar state ──────────────────────────────────────────────────── */
    const [filtersOpen, setFiltersOpen] = useState(false) // collapsed by default
    const [view, setView] = useState<ViewMode>(readStoredView)
    const [sortMode, setSortMode] = useState<SortMode>("date_asc")
    const [search, setSearch] = useState("")

    // ── "Završeni turniri" SEARCH group ─────────────────────────────────
    // The finished bucket above is only ever the first page or two — a
    // search box match against `search` can't see the rest of it. So once
    // the box has 2+ chars, ALSO ask the server directly for matching
    // finished tournaments and render them as their own group. Debounced so
    // a fast typist fires one request, not one per keystroke.
    const [debouncedSearch, setDebouncedSearch] = useState("")
    useEffect(() => {
        const id = window.setTimeout(() => setDebouncedSearch(search.trim()), 300)
        return () => window.clearTimeout(id)
    }, [search])

    const searchActive = debouncedSearch.length >= SEARCH_MIN_LENGTH

    // Own "prikaži još" ladder, reset whenever the search term itself
    // changes so a new query always starts from the first page again.
    const [searchFinishedLimit, setSearchFinishedLimit] = useState(SEARCH_FINISHED_PAGE_SIZE)
    useEffect(() => {
        setSearchFinishedLimit(SEARCH_FINISHED_PAGE_SIZE)
    }, [debouncedSearch])

    const searchFinishedQuery = useQuery({
        queryKey: qk.tournaments({ status: "finished", q: debouncedSearch, limit: searchFinishedLimit }),
        queryFn: () => fetchTournaments("finished", { q: debouncedSearch, offset: 0, limit: searchFinishedLimit }),
        enabled: searchActive,
        placeholderData: keepPreviousData,
    })
    const searchFinishedCountQuery = useQuery({
        queryKey: qk.tournamentsCount("finished", debouncedSearch),
        queryFn: () => fetchTournamentsCount("finished", debouncedSearch),
        enabled: searchActive,
    })

    const searchFinishedResults = searchActive
        ? ((searchFinishedQuery.data ?? EMPTY_CARDS) as ListingTournament[])
        : EMPTY_CARDS
    const searchFinishedTotal = searchActive ? (searchFinishedCountQuery.data ?? 0) : 0
    const searchFinishedLoading = searchActive && searchFinishedQuery.isPending
    const searchFinishedLoadingMore =
        searchActive && searchFinishedQuery.isFetching && !searchFinishedQuery.isPending
    const searchFinishedHasMore = searchActive && searchFinishedResults.length < searchFinishedTotal
    const searchFinishedHasResults = searchActive && searchFinishedResults.length > 0

    function loadMoreSearchFinished() {
        if (searchFinishedLoadingMore) return
        if (searchFinishedResults.length >= searchFinishedTotal) return
        setSearchFinishedLimit((n) => n + SEARCH_FINISHED_PAGE_SIZE)
    }

    const [locationFilter, setLocationFilter] = useState("")
    const [priceMin, setPriceMin] = useState("")
    const [priceMax, setPriceMax] = useState("")
    const [repassageMin, setRepassageMin] = useState("")
    const [repassageMax, setRepassageMax] = useState("")
    /* "U krugu od" — the old "Blizu mene" toggle plus its 25/50/100 chips,
       collapsed into one slider. Parked at RADIUS_MAX_KM, which reads as
       "Sve" and short-circuits the distance predicate entirely, so the filter
       stays OFF on a return visit where the browser silently restored a
       previously-granted position. */
    const [radiusKm, setRadiusKm] = useState<number>(RADIUS_MAX_KM)

    useEffect(() => {
        try {
            window.sessionStorage.setItem(VIEW_STORAGE_KEY, view)
        } catch {
            /* private mode — the pick just won't survive a navigation */
        }
    }, [view])

    /* ── ⌘K / Ctrl-K focuses the search box ──────────────────────────────
       The listener and the Apple test live in `hooks/useSearchHotkey` — the
       pair board's toolbar is the same toolbar and needs the same shortcut,
       and two copies of a global keydown handler is how two screens end up
       disagreeing about it. */
    const searchRef = useRef<HTMLInputElement>(null)
    useSearchHotkey(searchRef)

    /* ── User location, for the radius filter ───────────────────────────── */
    const { pos: userPos, status: geoStatus, request: requestLocation } = useUserLocation()

    // Tracks a request() we triggered ourselves from the "Uključi" button, so
    // the denial toast fires exactly once for that user action and never as a
    // side effect of an unrelated re-render (e.g. the browser already being in
    // the "denied" state on mount, before the user touched anything).
    const awaitingPermissionRef = useRef(false)
    useEffect(() => {
        if (!awaitingPermissionRef.current) return
        if (geoStatus === "asking") return // still resolving
        if (geoStatus === "denied" || geoStatus === "unsupported") {
            awaitingPermissionRef.current = false
            if (geoStatus === "denied") {
                showError(
                    tt("pages.tournaments.nearMe.deniedTitle"),
                    tt("pages.tournaments.nearMe.deniedDescription"),
                )
            }
            return
        }
        if (!userPos) return // granted, position still on its way
        awaitingPermissionRef.current = false
        // Asking for a position and then seeing nothing change would read as a
        // broken button, so land the slider on the default "blizu" radius —
        // unless the user had already dragged it somewhere themselves.
        setRadiusKm((km) => (km >= RADIUS_MAX_KM ? NEARBY_DEFAULT_KM : km))
        // `tt` is a fresh closure every render; depending on it would re-run
        // this effect constantly. The ref guard makes a re-run a no-op anyway.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [geoStatus, userPos])

    /** "Uključi" next to the radius slider — asks the browser for a position,
     *  or explains why it can't when permission is already refused. */
    function enableLocation() {
        if (geoStatus === "denied") {
            // Already known to be denied — don't even ask, just explain.
            showError(
                tt("pages.tournaments.nearMe.deniedTitle"),
                tt("pages.tournaments.nearMe.deniedDescription"),
            )
            return
        }
        awaitingPermissionRef.current = true
        requestLocation()
    }

    const sanitizeNum = (s: string) => s.replace(/[^\d.,]/g, "").replace(",", ".")
    const parseNum = (s: string): number | null => {
        if (!s.trim()) return null
        const n = parseFloat(s)
        return Number.isFinite(n) ? n : null
    }

    /** The radius filter is only doing anything when we know where the user is
     *  AND the slider is off its "Sve" stop. */
    const nearMeActive = !!userPos && radiusKm < RADIUS_MAX_KM

    const activeFilterCount =
        (locationFilter.trim() ? 1 : 0) +
        (priceMin.trim() ? 1 : 0) +
        (priceMax.trim() ? 1 : 0) +
        (repassageMin.trim() ? 1 : 0) +
        (repassageMax.trim() ? 1 : 0) +
        (nearMeActive ? 1 : 0)

    const isFiltering = search.trim().length > 0 || activeFilterCount > 0

    function resetFilters() {
        setSearch("")
        setLocationFilter("")
        setPriceMin("")
        setPriceMax("")
        setRepassageMin("")
        setRepassageMax("")
        setRadiusKm(RADIUS_MAX_KM)
    }

    /**
     * Ask the server for a bigger slice of the finished list. Idempotent —
     * re-clicking "Učitaj više" while a fetch is in-flight is a no-op because
     * the button is disabled on `loadingMoreFinished`, and raising the limit to
     * the same value is a cache hit.
     */
    function loadMoreFinished() {
        if (loadingMoreFinished) return
        if (finished.length >= finishedTotal) return
        setFinishedLimit((n) => n + FINISHED_PREVIEW_LIMIT)
    }

    const finishedHasMore = finished.length < finishedTotal

    // Eagerly load the entire finished list when the tour will need it.
    // The demo tournament (TOUR_DEMO_TOURNAMENT_SLUG) is the oldest
    // finished tournament, so it sits at the bottom of the paginated
    // list — without this it would never be in the rendered DOM and the
    // bridge step's anchor would silently miss.
    //
    // The tour no longer auto-launches on first visit; it only runs via
    // the navbar "Pokaži kako" button, which increments tourReplayKey.
    // So we only need to eager-load when tourReplayKey > 0. A ref-backed
    // attempted-key marker stops the effect from firing again after
    // `finished` updates from our own fetch, since `finished` would
    // otherwise re-run the effect and risk fetching twice.
    const eagerLoadKeyRef = useRef<number | null>(null)
    useEffect(() => {
        if (loading) return // wait for initial fetch to settle
        if (tourReplayKey === 0) return
        if (eagerLoadKeyRef.current === tourReplayKey) return
        eagerLoadKeyRef.current = tourReplayKey

        if (finished.some((item) => item.slug === TOUR_DEMO_TOURNAMENT_SLUG)) return
        if (finishedTotal === 0) return

        // Raising the limit is all it takes — the query re-keys and fetches the
        // wide page, keeping the current list on screen meanwhile.
        setFinishedLimit((n) => Math.max(n, finishedTotal, 200))
        // `finished` is intentionally NOT in deps — the effect changes what it
        // resolves to, and re-running on every update would loop.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tourReplayKey, loading, finishedTotal])

    /* ── Search + filters + sort, applied to the upcoming list ────────────
       When a position is known every survivor gets a `distanceKm` (so the
       cards can show it and "Najbliži prvi" has something to sort on); when
       the radius is narrower than "Sve" the ones outside it are dropped.
       Tournaments without geocoded coordinates can't be measured against a
       radius at all, so instead of silently vanishing they are counted
       separately and surfaced as a note under the grid.
       ──────────────────────────────────────────────────────────────────── */
    const { visible: filteredUpcoming, missingLocationCount } = useMemo(() => {
        const q = search.trim().toLowerCase()
        const loc = locationFilter.trim().toLowerCase()
        const min = parseNum(priceMin)
        const max = parseNum(priceMax)
        const repMin = parseNum(repassageMin)
        const repMax = parseNum(repassageMax)
        const me = userPos ? { lat: userPos[0], lng: userPos[1] } : null
        const limitByRadius = !!me && radiusKm < RADIUS_MAX_KM

        let missing = 0
        const base: ListingTournament[] = []

        for (const item of upcoming) {
            const place = (item.location ?? "").toLowerCase()
            // The placeholder promises name / city / venue, and `location` is
            // where both the city and the hall end up, so one query hits both.
            if (q && !item.name.toLowerCase().includes(q) && !place.includes(q)) continue
            if (loc && !place.includes(loc)) continue

            if (typeof item.entryPrice === "number") {
                if (min != null && item.entryPrice < min) continue
                if (max != null && item.entryPrice > max) continue
            } else if (min != null || max != null) {
                // Tournaments with no known kotizacija drop out only once a
                // kotizacija bound is actually set.
                continue
            }

            if (typeof item.repassagePrice === "number") {
                if (repMin != null && item.repassagePrice < repMin) continue
                if (repMax != null && item.repassagePrice > repMax) continue
            } else if (repMin != null || repMax != null) {
                continue
            }

            if (!me) {
                base.push(item)
                continue
            }
            if (typeof item.latitude !== "number" || typeof item.longitude !== "number") {
                if (limitByRadius) {
                    missing += 1
                    continue
                }
                base.push(item)
                continue
            }
            const distanceKm = haversineKm(me, { lat: item.latitude, lng: item.longitude })
            if (limitByRadius && distanceKm > radiusKm) continue
            base.push({ ...item, distanceKm })
        }

        return {
            visible: sortTournaments(base, sortMode, locale === "sl" ? "sl-SI" : "hr-HR"),
            missingLocationCount: missing,
        }
    }, [
        upcoming,
        search,
        locationFilter,
        priceMin,
        priceMax,
        repassageMin,
        repassageMax,
        userPos,
        radiusKm,
        sortMode,
        locale,
    ])

    // Distinguishes the two empty-result reasons: nothing within the radius
    // (widen it) vs. the generic "no filter matches" (clear them).
    const noneNearby = nearMeActive && filteredUpcoming.length === 0 && upcoming.length > 0

    const gridCols = { base: "1fr", md: "1fr 1fr", lg: "repeat(3, 1fr)" }

    /** Both sections render through the same switch, so "Mreža"/"Popis" is a
     *  property of the page rather than of one list. */
    function renderItems(items: ListingTournament[], variant: "upcoming" | "finished") {
        if (view === "list") {
            return (
                <VStack align="stretch" gap="2">
                    {items.map((item, idx) => (
                        <Box
                            key={item.uuid}
                            data-tour={
                                variant === "upcoming" && idx === 0
                                    ? "turniri-first-card"
                                    : undefined
                            }
                        >
                            <ListingRow item={item} variant={variant} />
                        </Box>
                    ))}
                </VStack>
            )
        }
        return (
            <Grid templateColumns={gridCols} gap="4">
                {items.map((item, idx) => (
                    <Box
                        key={item.uuid}
                        // The first upcoming card carries a tour anchor so the
                        // "Pogledajmo jedan turnir" step has a concrete element
                        // to point at. Anchored on the wrapper so the data
                        // attribute doesn't have to be threaded through
                        // ListingCard.
                        data-tour={
                            variant === "upcoming" && idx === 0 ? "turniri-first-card" : undefined
                        }
                    >
                        <ListingCard item={item} variant={variant} priority={idx === 0} />
                    </Box>
                ))}
            </Grid>
        )
    }

    const skeletons = view === "list" ? (
        <VStack align="stretch" gap="2">
            <ListingRowSkeleton />
            <ListingRowSkeleton />
            <ListingRowSkeleton />
        </VStack>
    ) : (
        <Grid templateColumns={gridCols} gap="4">
            <ListingCardSkeleton />
            <ListingCardSkeleton />
            <ListingCardSkeleton />
        </Grid>
    )

    const sortLabel = tt(SORT_LABEL_KEY[sortMode])

    return (
        <VStack align="stretch" gap="8">
            {/* ===================== Upcoming ===================== */}
            <Box>
                {/* Toolbar — rendered as soon as the initial fetch settles,
                    regardless of list size. Gating it on `upcoming.length > 0`
                    used to hide it entirely on a deploy with no tournaments
                    yet, which also dropped the `turniri-filters` tour anchor
                    from the DOM and stalled the guided tour at the previous
                    step. */}
                {!loading && (
                    <Box data-tour="turniri-filters" mb="4">
                        {/* One row on md+; on phones the search and the create
                            button take the full width and the three remaining
                            controls share the row beneath them (see the notes
                            on each control). */}
                        <Stack direction={{ base: "column", md: "row" }} gap="2" align="stretch">
                            {/* Search + "Kreiraj turnir" share a row at every
                                width. The create button moved OUT of both
                                navigations (it is an action, not a place) and
                                landed here rather than in the second row: that
                                row already carries Filteri + Sortiraj + the
                                view switcher and is at its limit at 320px,
                                whereas the search field can spare ~44px. */}
                            <HStack
                                flex="1"
                                gap="2"
                                align="stretch"
                                // 260px of search + the 44px button: the same
                                // floor the search field alone used to hold, so
                                // the md row still can't squeeze the query box
                                // down to nothing.
                                minW={{ base: "100%", md: "304px" }}
                            >
                                <Box position="relative" flex="1" minW="0">
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
                                        placeholder={tt("pages.tournaments.search.placeholder")}
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        onKeyDown={(e) => {
                                            // Escape empties a non-empty box, then
                                            // gets out of the way on a second press.
                                            if (e.key !== "Escape") return
                                            if (search) {
                                                e.preventDefault()
                                                setSearch("")
                                            } else {
                                                e.currentTarget.blur()
                                            }
                                        }}
                                        aria-label={tt("pages.tournaments.search.placeholder")}
                                    />
                                    {search && (
                                        <Box
                                            position="absolute"
                                            right="2.5"
                                            top="50%"
                                            style={{ transform: "translateY(-50%)" }}
                                        >
                                            <IconButton
                                                aria-label={tt("pages.tournaments.search.clearAria")}
                                                size="xs"
                                                variant="ghost"
                                                onClick={() => setSearch("")}
                                            >
                                                <FiX />
                                            </IconButton>
                                        </Box>
                                    )}
                                </Box>

                                {/* Rendered for signed-out visitors too, exactly
                                    like this page's empty-state CTA: /turniri/novi
                                    is wrapped in RequireAuth, which bounces them to
                                    /prijava?next=… and back. No new sign-in flow,
                                    and no button that silently does nothing.

                                    The label collapses below lg — the toolbar has
                                    room for it at 6xl but not next to a 230px
                                    Sortiraj button at 768px — so the accessible
                                    name comes from `aria-label`, which is present
                                    at every width. */}
                                <Button
                                    asChild
                                    h={{ base: "42px", md: "44px" }}
                                    px={{ base: "3", md: "0", lg: "4" }}
                                    // On phones this is a pill with a visible
                                    // "Kreiraj" label instead of a bare square
                                    // icon — this pill IS the toolbar's only
                                    // create affordance there (MobileTabBar
                                    // deliberately has no "create" tab), and a
                                    // first-time visitor had no way to guess a
                                    // lone "+" makes a tournament. `auto` lets
                                    // it grow to fit icon + text (~110px); the
                                    // search field just gives up that width —
                                    // there's no 260px floor to protect here,
                                    // since the outer Stack is a column at
                                    // `base` and this row is the search field's
                                    // and the button's alone. That floor only
                                    // matters once `md` turns this into one
                                    // shared row with Filteri / Sortiraj, where
                                    // the button stays the square icon-only
                                    // button it always was.
                                    w={{ base: "auto", md: "44px", lg: "auto" }}
                                    flexShrink="0"
                                    colorPalette="brand"
                                    rounded="lg"
                                    fontWeight="semibold"
                                    aria-label={tt("common.nav.kreirajTurnir")}
                                    title={tt("common.nav.kreirajTurnir")}
                                >
                                    <RouterLink to="/turniri/novi">
                                        <Box as="span" display="inline-flex" flexShrink="0" aria-hidden="true">
                                            <FiPlus />
                                        </Box>
                                        {/* Same "Kreiraj" label at base and lg,
                                            hidden only at the in-between `md`
                                            square-icon width. The full "Kreiraj
                                            turnir" stays as the accessible name
                                            above, where a screen reader has no
                                            row to read it from. */}
                                        <Box as="span" display={{ base: "inline", md: "none", lg: "inline" }}>
                                            {tt("common.mobileNav.kreiraj")}
                                        </Box>
                                    </RouterLink>
                                </Button>
                            </HStack>

                            {/* Filteri + Sortiraj + the grid/list toggle share
                                ONE row even at 360px: the two buttons are
                                allowed to shrink and truncate their label
                                (`minW="0"` on the button, `minW="0"` +
                                `truncate` on the text span), and the toggle
                                is pinned to the right with `ml="auto"` so it
                                never gets squeezed out first. */}
                            <HStack gap="2" align="center" wrap="nowrap">
                                <Button
                                    size={{ base: "sm", md: "md" }}
                                    h={{ base: "36px", md: "44px" }}
                                    px={{ base: "2", md: "4" }}
                                    minW="0"
                                    flexShrink="1"
                                    variant={activeFilterCount > 0 ? "solid" : "outline"}
                                    colorPalette={activeFilterCount > 0 ? "brand" : "gray"}
                                    bg={activeFilterCount > 0 ? undefined : "bg.panel"}
                                    rounded="lg"
                                    fontWeight="semibold"
                                    onClick={() => setFiltersOpen((v) => !v)}
                                    aria-expanded={filtersOpen}
                                    title={filtersOpen
                                        ? tt("pages.tournaments.filters.toggleHide")
                                        : tt("pages.tournaments.filters.toggleShow")}
                                >
                                    <Box flexShrink="0" display="inline-flex">
                                        <FiFilter />
                                    </Box>
                                    <Box as="span" minW="0" truncate>
                                        {tt("pages.tournaments.filters.button")}
                                    </Box>
                                    {activeFilterCount > 0 && (
                                        <Box
                                            ml="1"
                                            px="1.5"
                                            rounded="full"
                                            bg="whiteAlpha.400"
                                            fontSize="2xs"
                                            fontWeight="bold"
                                            flexShrink="0"
                                        >
                                            {activeFilterCount}
                                        </Box>
                                    )}
                                    <Box flexShrink="0" display="inline-flex">
                                        {filtersOpen ? <FiChevronUp /> : <FiChevronDown />}
                                    </Box>
                                </Button>

                                <Menu.Root>
                                    <Menu.Trigger asChild>
                                        <Button
                                            size={{ base: "sm", md: "md" }}
                                            h={{ base: "36px", md: "44px" }}
                                            px={{ base: "2", md: "4" }}
                                            // Sized on md+ to the LONGEST label, not
                                            // the active one, so picking a different
                                            // sort never resizes the button and
                                            // shifts the switcher beside it. On
                                            // phones it shrinks freely instead.
                                            minW={{ base: "0", md: "230px" }}
                                            flexShrink="1"
                                            variant="outline"
                                            colorPalette="gray"
                                            bg="bg.panel"
                                            rounded="lg"
                                            fontWeight="semibold"
                                            aria-label={tt("pages.tournaments.sort.label")}
                                        >
                                            <Box flexShrink="0" display="inline-flex">
                                                <FiSliders />
                                            </Box>
                                            {/* The "Sortiraj:" prefix only shows on
                                                md+ — on phones the icon plus the
                                                current value ("Najraniji prvi") is
                                                the whole story. */}
                                            <Box as="span" minW="0" truncate>
                                                <Box as="span" display={{ base: "none", md: "inline" }}>
                                                    {tt("pages.tournaments.sort.label")}{" "}
                                                </Box>
                                                <Box as="span" color="brand.fg" fontWeight="bold">
                                                    {sortLabel}
                                                </Box>
                                            </Box>
                                            <Box flexShrink="0" display="inline-flex">
                                                <FiChevronDown />
                                            </Box>
                                        </Button>
                                    </Menu.Trigger>
                                    <Portal>
                                        <Menu.Positioner>
                                            <Menu.Content minW="240px">
                                                {SORT_MODES.map((mode) => {
                                                    const active = mode === sortMode
                                                    const blocked = sortNeedsLocation(mode) && !userPos
                                                    return (
                                                        <Menu.Item
                                                            key={mode}
                                                            value={mode}
                                                            disabled={blocked}
                                                            onSelect={() => {
                                                                if (!blocked) setSortMode(mode)
                                                            }}
                                                        >
                                                            <HStack gap="2.5" w="full">
                                                                <Box
                                                                    color="brand.fg"
                                                                    opacity={active ? 1 : 0}
                                                                    flexShrink="0"
                                                                    display="inline-flex"
                                                                >
                                                                    <FiCheck />
                                                                </Box>
                                                                <Text
                                                                    flex="1"
                                                                    fontWeight={active ? "bold" : "medium"}
                                                                >
                                                                    {tt(SORT_LABEL_KEY[mode])}
                                                                </Text>
                                                            </HStack>
                                                        </Menu.Item>
                                                    )
                                                })}
                                            </Menu.Content>
                                        </Menu.Positioner>
                                    </Portal>
                                </Menu.Root>

                                <HStack
                                    gap="1"
                                    h={{ base: "36px", md: "44px" }}
                                    px="1"
                                    bg="bg.panel"
                                    borderWidth="1px"
                                    borderColor="border.subtle"
                                    rounded="lg"
                                    flexShrink="0"
                                    ml="auto"
                                    role="group"
                                    aria-label={tt("pages.tournaments.view.label")}
                                >
                                    <ViewToggleButton
                                        active={view === "grid"}
                                        onClick={() => setView("grid")}
                                        icon={<FiGrid size={15} />}
                                        label={tt("pages.tournaments.view.grid")}
                                    />
                                    <ViewToggleButton
                                        active={view === "list"}
                                        onClick={() => setView("list")}
                                        icon={<FiList size={15} />}
                                        label={tt("pages.tournaments.view.list")}
                                    />
                                </HStack>
                            </HStack>
                        </Stack>

                        {/* ── Expanded filter panel ────────────────────────── */}
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
                                    templateColumns={{ base: "1fr", md: "minmax(180px, 1fr) auto auto" }}
                                    gap="3"
                                >
                                    <Box minW="0">
                                        <FilterLabel>
                                            {tt("pages.tournaments.filters.locationLabel")}
                                        </FilterLabel>
                                        <Input
                                            size="sm"
                                            placeholder={tt("pages.tournaments.filters.locationPlaceholder")}
                                            value={locationFilter}
                                            onChange={(e) => setLocationFilter(e.target.value)}
                                        />
                                    </Box>
                                    <Box minW="0">
                                        <FilterLabel>
                                            {tt("pages.tournaments.filters.priceLabel")}
                                        </FilterLabel>
                                        <HStack gap="1.5">
                                            <Input
                                                size="sm"
                                                w={{ base: "full", md: "80px" }}
                                                inputMode="decimal"
                                                placeholder={tt("pages.tournaments.filters.priceFromPlaceholder")}
                                                value={priceMin}
                                                onChange={(e) => setPriceMin(sanitizeNum(e.target.value))}
                                            />
                                            <Text color="fg.subtle">–</Text>
                                            <Input
                                                size="sm"
                                                w={{ base: "full", md: "80px" }}
                                                inputMode="decimal"
                                                placeholder={tt("pages.tournaments.filters.priceToPlaceholder")}
                                                value={priceMax}
                                                onChange={(e) => setPriceMax(sanitizeNum(e.target.value))}
                                            />
                                        </HStack>
                                    </Box>
                                    <Box minW="0">
                                        <FilterLabel>
                                            {tt("pages.tournaments.filters.repassageLabel")}
                                        </FilterLabel>
                                        <HStack gap="1.5">
                                            <Input
                                                size="sm"
                                                w={{ base: "full", md: "80px" }}
                                                inputMode="decimal"
                                                placeholder={tt("pages.tournaments.filters.priceFromPlaceholder")}
                                                value={repassageMin}
                                                onChange={(e) => setRepassageMin(sanitizeNum(e.target.value))}
                                            />
                                            <Text color="fg.subtle">–</Text>
                                            <Input
                                                size="sm"
                                                w={{ base: "full", md: "80px" }}
                                                inputMode="decimal"
                                                placeholder={tt("pages.tournaments.filters.priceToPlaceholder")}
                                                value={repassageMax}
                                                onChange={(e) => setRepassageMax(sanitizeNum(e.target.value))}
                                            />
                                        </HStack>
                                    </Box>
                                </Grid>

                                {/* Second row: the radius that used to be a
                                    "Blizu mene" toggle plus three chips. One
                                    slider says the same thing with fewer
                                    controls, and its right edge is where
                                    "Očisti sve" lives — inside the panel, so it
                                    can appear and disappear without nudging the
                                    toolbar above. */}
                                <Box mt="4" pt="3" borderTopWidth="1px" borderColor="border.subtle">
                                    <HStack gap="2" mb="2" align="center" wrap="wrap">
                                        <FilterLabel>
                                            {tt("pages.tournaments.filters.radiusLabel")}
                                        </FilterLabel>
                                        <Text
                                            fontSize="xs"
                                            fontWeight="bold"
                                            color="brand.fg"
                                            mb="1.5"
                                            minW="46px"
                                        >
                                            {!userPos
                                                ? "—"
                                                : radiusKm >= RADIUS_MAX_KM
                                                    ? tt("pages.tournaments.filters.radiusAll")
                                                    : `${radiusKm} km`}
                                        </Text>
                                        {geoStatus === "unsupported" ? (
                                            // No Geolocation API (or an insecure
                                            // context): hide the control rather
                                            // than offer a button that can never
                                            // work.
                                            <Text fontSize="xs" color="fg.muted" mb="1.5">
                                                {tt("pages.tournaments.nearMe.unsupported")}
                                            </Text>
                                        ) : !userPos ? (
                                            <Button
                                                size="xs"
                                                variant="ghost"
                                                colorPalette="brand"
                                                mb="1.5"
                                                onClick={enableLocation}
                                                disabled={geoStatus === "asking"}
                                                loading={geoStatus === "asking"}
                                            >
                                                <FiNavigation /> {tt("pages.tournaments.nearMe.enable")}
                                            </Button>
                                        ) : null}
                                        {geoStatus === "denied" && (
                                            <Text fontSize="xs" color="fg.muted" mb="1.5">
                                                {tt("pages.tournaments.nearMe.denied")}
                                            </Text>
                                        )}
                                        <Button
                                            size="xs"
                                            variant="ghost"
                                            ml="auto"
                                            mb="1.5"
                                            onClick={resetFilters}
                                            disabled={!isFiltering}
                                            title={isFiltering
                                                ? tt("pages.tournaments.filters.clearAllTitleActive")
                                                : tt("pages.tournaments.filters.clearAllTitleInactive")}
                                        >
                                            {tt("pages.tournaments.filters.clearAll")}
                                        </Button>
                                    </HStack>
                                    <Slider.Root
                                        min={5}
                                        max={RADIUS_MAX_KM}
                                        step={5}
                                        value={[radiusKm]}
                                        onValueChange={(e) => setRadiusKm(e.value[0])}
                                        disabled={!userPos}
                                        colorPalette="brand"
                                        aria-label={[tt("pages.tournaments.filters.radiusLabel")]}
                                    >
                                        <Slider.Control>
                                            <Slider.Track>
                                                <Slider.Range />
                                            </Slider.Track>
                                            <Slider.Thumbs />
                                        </Slider.Control>
                                    </Slider.Root>
                                </Box>
                            </Box>
                        )}
                    </Box>
                )}

                {loading ? (
                    skeletons
                ) : upcoming.length === 0 ? (
                    <ListEmptyState
                        title={error
                            ? tt("pages.tournaments.empty.upcomingErrorTitle")
                            : tt("pages.tournaments.empty.upcomingEmptyTitle")}
                        description={error ?? tt("pages.tournaments.empty.upcomingEmptyDescription")}
                        cta={
                            !error && (
                                <Button asChild size="sm" colorPalette="brand">
                                    <RouterLink to="/turniri/novi">
                                        <FiPlus /> {tt("pages.tournaments.createCta")}
                                    </RouterLink>
                                </Button>
                            )
                        }
                    />
                ) : filteredUpcoming.length === 0 && !searchFinishedHasResults ? (
                    // "No tournaments near you" (the radius found zero, but the
                    // unfiltered list isn't empty) reads differently from the
                    // generic "no filter matches" below — the fix there is to
                    // widen the radius, not to clear every filter. Either way,
                    // this only fires when the finished-search group (below)
                    // has nothing either — a search that matches a finished
                    // tournament should show THAT, not a "no results" screen.
                    noneNearby ? (
                        <ListEmptyState
                            title={tt("pages.tournaments.empty.noneNearbyTitle")}
                            description={tt("pages.tournaments.empty.noneNearbyDescription", { radius: radiusKm })}
                            cta={
                                <HStack gap="2" justify="center">
                                    {radiusKm < RADIUS_MAX_KM && (
                                        <Button
                                            size="sm"
                                            colorPalette="brand"
                                            onClick={() =>
                                                setRadiusKm((km) => Math.min(RADIUS_MAX_KM, km + 25))
                                            }
                                        >
                                            {tt("pages.tournaments.empty.widenRadius")}
                                        </Button>
                                    )}
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setRadiusKm(RADIUS_MAX_KM)}
                                    >
                                        {tt("pages.tournaments.empty.disableNearMe")}
                                    </Button>
                                </HStack>
                            }
                        />
                    ) : (
                        <ListEmptyState
                            title={tt("pages.tournaments.empty.noResultsTitle")}
                            description={tt("pages.tournaments.empty.noResultsDescription")}
                            cta={
                                <Button size="sm" variant="outline" onClick={resetFilters}>
                                    {tt("pages.tournaments.empty.clearFilters")}
                                </Button>
                            }
                        />
                    )
                ) : filteredUpcoming.length > 0 ? (
                    <>
                        <Box data-tour="turniri-upcoming">
                            {renderItems(filteredUpcoming, "upcoming")}
                        </Box>
                        {/* Tournaments without geocoded coordinates can't be
                            measured against the radius — rather than silently
                            vanishing, they're counted here so the user knows
                            the list isn't the full picture. */}
                        {missingLocationCount > 0 && (
                            <Text fontSize="xs" color="fg.muted" mt="3">
                                {plural("pages.tournaments.missingLocation", missingLocationCount)}
                            </Text>
                        )}
                    </>
                ) : null /* filteredUpcoming is empty but the finished-search
                            group below has matches — nothing to say up here */}
            </Box>

            {/* ===================== Završeni turniri (search match) =====
                A second, server-searched group for finished tournaments —
                separate from the "Nadolazeći" filters (price/radius/location
                don't apply here, only the search text does; see the query
                definitions above). Only appears once the search box has 2+
                chars, and stays out of the way entirely otherwise, per spec:
                an empty search changes nothing about the page. */}
            {searchActive && (searchFinishedLoading || searchFinishedHasResults) && (
                <Box data-tour="turniri-search-finished">
                    <Heading size="md" mb="1">{tt("pages.tournaments.finishedHeading")}</Heading>
                    {!searchFinishedLoading && (
                        <Text fontSize="sm" color="fg.muted" mb="4">
                            {plural("pages.tournaments.searchFinished.resultsCount", searchFinishedTotal)}
                        </Text>
                    )}
                    {searchFinishedLoading ? (
                        skeletons
                    ) : (
                        <>
                            {renderItems(searchFinishedResults, "finished")}
                            {searchFinishedHasMore && (
                                <HStack justify="center" mt="4">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        colorPalette="brand"
                                        onClick={loadMoreSearchFinished}
                                        loading={searchFinishedLoadingMore}
                                    >
                                        {tt("pages.tournaments.searchFinished.showMore", {
                                            count: searchFinishedTotal - searchFinishedResults.length,
                                        })}
                                    </Button>
                                </HStack>
                            )}
                        </>
                    )}
                </Box>
            )}

            {/* ===================== Finished ===================== */}
            <Box data-tour="turniri-finished">
                <Heading size="lg" mb="4">{tt("pages.tournaments.finishedHeading")}</Heading>

                {loadingFinished ? (
                    skeletons
                ) : finished.length === 0 ? (
                    <ListEmptyState
                        title={
                            errorFinished
                                ? tt("pages.tournaments.empty.finishedErrorTitle")
                                : tt("pages.tournaments.empty.finishedEmptyTitle")
                        }
                        description={
                            errorFinished ?? tt("pages.tournaments.empty.finishedEmptyDescription")
                        }
                    />
                ) : (
                    <>
                        {/* Which finished entry hosts the `turniri-demo-card`
                            tour anchor. Preferred: the hand-picked demo
                            tournament identified by TOUR_DEMO_TOURNAMENT_SLUG.
                            Fallback: the first finished one. Without the
                            fallback, deploys that never imported the demo
                            would have no anchor at all and the tour's bridge
                            step would stall on a Next button that goes
                            nowhere. */}
                        {(() => {
                            const demoIdx = finished.findIndex(
                                (item) => item.slug === TOUR_DEMO_TOURNAMENT_SLUG,
                            )
                            const anchorIdx = demoIdx >= 0 ? demoIdx : 0
                            const wrap = (node: React.ReactNode, idx: number) => (
                                <Box data-tour={idx === anchorIdx ? "turniri-demo-card" : undefined}>
                                    {node}
                                </Box>
                            )
                            if (view === "list") {
                                return (
                                    <VStack align="stretch" gap="2">
                                        {finished.map((item, idx) => (
                                            <Box key={item.uuid}>
                                                {wrap(<ListingRow item={item} variant="finished" />, idx)}
                                            </Box>
                                        ))}
                                    </VStack>
                                )
                            }
                            return (
                                <Grid templateColumns={gridCols} gap="4">
                                    {finished.map((item, idx) => (
                                        <Box key={item.uuid}>
                                            {wrap(<ListingCard item={item} variant="finished" />, idx)}
                                        </Box>
                                    ))}
                                </Grid>
                            )
                        })()}
                        {/* Učitaj više — fetches the next page from the backend
                            and appends it. Hidden once everything is loaded. */}
                        {finishedHasMore && (
                            <HStack justify="center" mt="4">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    colorPalette="brand"
                                    onClick={loadMoreFinished}
                                    loading={loadingMoreFinished}
                                >
                                    {tt("pages.tournaments.loadMore", { count: finishedTotal - finished.length })}
                                </Button>
                            </HStack>
                        )}
                    </>
                )}
            </Box>

            {/* Guided tour. It no longer auto-launches on first visit — it runs
                ONLY when the user clicks the NavBar "?" ("Pokaži kako") button,
                which dispatches a window event we pick up via tourReplayKey. No
                seenStorageKey is passed, so PageTour's auto-launch path is
                disabled entirely. After the final step we navigate to a
                finished tournament with a sessionStorage resume flag, and the
                detail page picks the tour up as a continuation. */}
            <Suspense fallback={null}>
                <PageTour
                    key={tourReplayKey}
                    steps={TURNIRI_LIST_TOUR_STEPS()}
                    forceRun={tourReplayKey > 0 ? true : undefined}
                    onStepChange={(nextIndex) => {
                        // The filter panel deliberately stays collapsed during
                        // the tour: expanding it grew the
                        // `[data-tour="turniri-filters"]` anchor from ~50px to
                        // ~250px, which pushed the popper-positioned tooltip
                        // far below the controls it was describing. The user
                        // can still tap "Filteri" once the tour ends.

                        // Mobile-only: open the hamburger drawer at the nav
                        // steps so the `data-tour="nav-items"` anchor (which
                        // lives inside the drawer's Stack on mobile) is in the
                        // DOM when Joyride looks for it, and close it again as
                        // soon as we move past the auth step. Desktop is
                        // unaffected — the drawer block doesn't render at md+.
                        const isNavStep = nextIndex === 1 || nextIndex === 2
                        window.dispatchEvent(new CustomEvent(
                            isNavStep ? "bela:open-nav-menu" : "bela:close-nav-menu",
                        ))
                        if (isNavStep) notifyTourOfLayoutChange()
                    }}
                    onFinished={(info) => {
                        // "Preskoči" / the X close button: the user has said
                        // they don't want any more onboarding right now — do
                        // NOT bridge to the detail-page tour, do NOT navigate.
                        if (info?.skipped) return

                        // Normal "Završi" path — bridge to the detail-page
                        // tour. Preferred target is the hardcoded demo
                        // tournament (29 pairs, 8 rounds, full cjenik — a
                        // known-good record). On deploys where the demo SQL
                        // was never imported, fall back to whatever finished
                        // tournament is loaded, then to an upcoming one.
                        const hasDemoLoaded = finished.some(
                            (item) => item.slug === TOUR_DEMO_TOURNAMENT_SLUG,
                        )
                        let slug: string | undefined
                        if (hasDemoLoaded && TOUR_DEMO_TOURNAMENT_SLUG) {
                            slug = TOUR_DEMO_TOURNAMENT_SLUG
                        } else {
                            const target = finished[0] ?? upcoming[0]
                            slug = target?.slug || target?.uuid
                        }
                        if (!slug) return // nothing to bridge to — tour ends here
                        try {
                            window.sessionStorage.setItem(TOUR_RESUME_DETAIL_KEY, "1")
                        } catch { /* private mode */ }
                        navigate(`/turniri/${slug}`)
                    }}
                />
            </Suspense>
        </VStack>
    )
}
