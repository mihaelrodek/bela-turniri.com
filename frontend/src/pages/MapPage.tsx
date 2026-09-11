import { useEffect, useMemo, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
    Box,
    Button,
    Flex,
    Grid,
    HStack,
    IconButton,
    Slider,
    Text,
    VStack,
    chakra,
} from "@chakra-ui/react"
import { Link as RouterLink, useSearchParams } from "react-router-dom"
import { FiCalendar, FiChevronRight, FiDollarSign, FiEyeOff, FiMapPin, FiNavigation } from "react-icons/fi"

import "leaflet/dist/leaflet.css"
import L from "leaflet"
import {
    Circle,
    MapContainer,
    Marker,
    Popup,
    TileLayer,
    useMap,
} from "react-leaflet"

import type { TournamentCard } from "../types/tournaments"
import { fetchTournaments } from "../api/tournaments"
import { qk } from "../queryClient"
import { NAVBAR_H } from "../components/navChrome"
import { useUserLocation } from "../hooks/useUserLocation"
import { formatDistanceKm, haversineKm } from "../utils/distance"
import { formatDateShort, formatTime } from "../utils/format"
import { positiveAmount } from "../components/listingShared"
import { useDocumentHead } from "../hooks/useDocumentHead"
import { MAP_TARGET_PARAM } from "../utils/mapLink"
import { mapTiles } from "../utils/mapTiles"
import { useTranslation, usePlural } from "../i18n"

/** Stable empty default for the query's `data` — a fresh `[]` literal each
 *  render would bust every useMemo downstream. */
const EMPTY_TOURNAMENTS: TournamentCard[] = []

type TournamentWithCoords = TournamentCard & {
    uuid: string
    latitude: number
    longitude: number
}

/** Shorthand for the translator passed down to the list components below —
 *  keeps their prop types out of the way of the actual JSX. */
type Translate = (key: string, params?: Record<string, string | number>) => string

type Bucket = "thisWeek" | "nextWeek" | "beyond"

// Three-tier urgency by start date (week starts Monday):
//   - thisWeek  → green  — happening within the current week.
//   - nextWeek  → yellow — after this week, up to next Sunday.
//   - beyond    → red    — further out than that (or no date yet).
// Literal hexes on purpose: these colour Leaflet DivIcon markup and inline
// popup styles, which live OUTSIDE the Chakra style engine and so cannot
// resolve a semantic token. They also sit on map tiles, not on app surfaces,
// so they must not follow the light/dark flip.
const PIN_COLORS: Record<Bucket, string> = {
    thisWeek: "#22C55E",  // green-500
    nextWeek: "#EAB308",  // yellow-500
    beyond: "#EF4444",    // red-500
}

/**
 * End-of-this-week cutoff = the Sunday that closes the current week
 * (week starts Mon). Covers the rest of today and the rest of this week.
 */
function endOfThisWeek(now: Date): Date {
    const d = new Date(now)
    d.setHours(23, 59, 59, 999)
    const jsDay = d.getDay() // 0=Sun, 1=Mon, ..., 6=Sat
    const daysToSunday = jsDay === 0 ? 0 : 7 - jsDay
    d.setDate(d.getDate() + daysToSunday)
    return d
}

/**
 * End-of-next-week cutoff = the Sunday that closes next week (week starts Mon).
 * Includes the rest of the current week and all of next week.
 */
function endOfNextWeek(now: Date): Date {
    const d = new Date(now)
    d.setHours(23, 59, 59, 999)
    const jsDay = d.getDay() // 0=Sun, 1=Mon, ..., 6=Sat
    const daysToThisSunday = jsDay === 0 ? 0 : 7 - jsDay
    d.setDate(d.getDate() + daysToThisSunday + 7) // +7 to reach next week's Sunday
    return d
}

/**
 * Build a map pin SVG as a Leaflet DivIcon. Uses the colors above so the legend
 * (and the tournament list) stay in sync with the actual pins on the map.
 */
function makePinIcon(color: string, isUser = false): L.DivIcon {
    const html = isUser
        ? `<div style="
              width: 18px; height: 18px; border-radius: 50%;
              background: #227342; border: 3px solid white;
              box-shadow: 0 0 0 2px rgba(34,115,66,0.4), 0 1px 4px rgba(0,0,0,0.4);">
           </div>`
        : `<svg width="28" height="38" viewBox="0 0 28 38" xmlns="http://www.w3.org/2000/svg">
             <path d="M14 0C6.27 0 0 6.27 0 14c0 9.5 13 22.5 13.5 23a1 1 0 0 0 1 0C15 36.5 28 23.5 28 14c0-7.73-6.27-14-14-14z"
                   fill="${color}" stroke="white" stroke-width="2"/>
             <circle cx="14" cy="14" r="5" fill="white"/>
           </svg>`

    return L.divIcon({
        html,
        className: "map-pin-icon",
        iconSize: isUser ? [18, 18] : [28, 38],
        iconAnchor: isUser ? [9, 9] : [14, 38],
        popupAnchor: isUser ? [0, -12] : [0, -34],
    })
}

function classify(startAt?: string | null): Bucket {
    if (!startAt) return "beyond"
    const start = new Date(startAt).setHours(0, 0, 0, 0)
    const thisWeekEnd = endOfThisWeek(new Date()).getTime()
    const nextWeekEnd = endOfNextWeek(new Date()).getTime()
    // <= thisWeekEnd also catches today and any in-progress tournament
    // whose start date is earlier in the current week.
    if (start <= thisWeekEnd) return "thisWeek"
    if (start <= nextWeekEnd) return "nextWeek"
    return "beyond"
}

/** Translated label for a bucket — shared by the pin popup and the list. */
function bucketLabel(tt: Translate, bucket: Bucket): string {
    if (bucket === "thisWeek") return tt("pages.map.bucket.thisWeek")
    if (bucket === "nextWeek") return tt("pages.map.bucket.nextWeek")
    return tt("pages.map.bucket.beyond")
}

/**
 * Camera controller — runs inside <MapContainer> via `useMap`. Three phases:
 *
 *   1. <b>Initial focus (once):</b> if the user's location is available,
 *      centre on it at zoom 10 — roughly a 25 km radius visible at typical
 *      screen widths, matching the default slider state ("Sve"). Otherwise
 *      fit the camera to all visible tournament points.
 *
 *   2. <b>Radius follow:</b> once the initial focus has landed, dragging the
 *      radius slider below the max re-fits the camera to the resulting
 *      circle so the search area stays fully visible. Yields to selection
 *      follow (phase 3) when a tournament is selected.
 *
 *   3. <b>Selection follow:</b> selecting a tournament (from the list or by
 *      clicking its pin) flies the camera to it — this is what makes
 *      "clicking a list card focuses its pin" work.
 */
function MapFocus({
    userPos,
    allPoints,
    radiusKm,
    radiusMax,
    selectedTournament,
}: {
    userPos: [number, number] | null
    allPoints: [number, number][]
    radiusKm: number
    radiusMax: number
    selectedTournament: TournamentWithCoords | null
}) {
    const map = useMap()
    // "pending" until we've performed the first focus; afterwards "done"
    // suppresses the initial-focus branch and unlocks the radius-follow
    // branch. Using a ref (not state) so flipping it doesn't trigger
    // re-renders that would re-run effects unnecessarily.
    const initialRef = useRef<"pending" | "done">("pending")

    // Phase 1 — one-time initial focus. Re-runs while pending until
    // either userPos or allPoints becomes meaningful enough to act on.
    useEffect(() => {
        if (initialRef.current === "done") return
        // A selection that exists before the first focus has landed can only
        // have come from the ?turnir= deep link — the user asked for one
        // specific tournament, so phase 3 owns the camera from the start.
        // Marking the initial focus done here also stops a geolocation fix
        // arriving a moment later (the auto-request below fires at 600ms)
        // from yanking the view off the pin they came for.
        if (selectedTournament) {
            initialRef.current = "done"
            return
        }
        if (userPos) {
            map.setView(userPos, 10, { animate: false })
            initialRef.current = "done"
            return
        }
        if (allPoints.length > 0) {
            map.fitBounds(L.latLngBounds(allPoints), {
                padding: [40, 40],
                maxZoom: 12,
            })
            initialRef.current = "done"
        }
    }, [userPos, allPoints, map, selectedTournament])

    // Phase 2 — radius-follow. Only fires after the initial focus has
    // landed and only when the slider is below the max (= "Sve"). Doesn't
    // re-fit when allPoints changes; that lets the slider drive the view
    // without random repositioning when, say, a tournament list refresh
    // arrives in the background. Yields to an active selection.
    useEffect(() => {
        if (initialRef.current !== "done") return
        if (!userPos) return
        if (radiusKm >= radiusMax) return
        if (selectedTournament) return
        const bounds = L.latLngBounds([
            userPos,
            ...circleBoxCorners(userPos, radiusKm),
        ])
        map.fitBounds(bounds, { padding: [40, 40] })
    }, [radiusKm, userPos, radiusMax, map, selectedTournament])

    // Phase 3 — selection follow. Flies to whichever tournament is
    // selected, from the list or from clicking its pin directly.
    useEffect(() => {
        if (!selectedTournament) return
        map.flyTo(
            [selectedTournament.latitude, selectedTournament.longitude],
            Math.max(map.getZoom(), 12),
            { duration: 0.6 },
        )
    }, [selectedTournament, map])

    // Keep the Leaflet canvas in sync when the surrounding layout swaps
    // between the mobile shape (list below the map) and the desktop shape
    // (list beside the map) — Leaflet caches its container's pixel rect, so
    // a CSS-only breakpoint flip otherwise leaves stale/grey tiles until
    // invalidateSize runs.
    useEffect(() => {
        const handle = window.setTimeout(() => map.invalidateSize(), 50)
        return () => window.clearTimeout(handle)
    }, [map])

    return null
}

/**
 * Two opposite corners of a circle's bounding box, in (lat, lng).
 * Approximates 1° latitude ≈ 111 km; longitude scales by cos(lat).
 * Good enough to make sure the whole circle is visible after fitBounds.
 */
function circleBoxCorners(center: [number, number], radiusKm: number): [number, number][] {
    const [lat, lng] = center
    const dLat = radiusKm / 111
    const dLng = radiusKm / (111 * Math.max(0.0001, Math.cos((lat * Math.PI) / 180)))
    return [
        [lat + dLat, lng + dLng],
        [lat - dLat, lng - dLng],
    ]
}

/**
 * Upper bound for the "U krugu od:" slider on the map. Reaching this
 * value is semantically "no radius filter" — the predicate
 * short-circuits to "show all". Mirrors RADIUS_MAX_KM on TournamentsPage
 * so the two filters feel the same.
 */
const MAP_RADIUS_MAX_KM = 100

/**
 * Desktop height shared by the map and the "visible on map" list column, so
 * their bottoms line up and the list scrolls INSIDE itself instead of the
 * page growing underneath it. Computed from this page's actual chrome —
 * not guessed:
 *   NavBar (sticky, 52px from NAVBAR_H.md) + Container top padding (py=6 → 24px)
 *   + the toolbar panel (~76px, incl. its own p="3" padding)
 *   + the VStack gap above the grid (gap="4" → 16px)
 *   + Container bottom padding (py=6 → 24px — this app has no sticky
 *     footer below the routed content, unlike the sibling futsal app)
 *   + ~10px safety margin for borders / scrollbar
 *   = 202px of fixed chrome around the map on md+.
 * `100dvh` (not `vh`) so the value tracks the real visible viewport, same
 * reasoning as the mobile constant below.
 */
const MAP_DESKTOP_H = `calc(100dvh - ${NAVBAR_H.md + 24 + 76 + 16 + 24 + 10}px - env(safe-area-inset-top, 0px))`
const MAP_DESKTOP_MIN_H = "420px"

/**
 * Mobile map height. Unlike the desktop column, the tournament list sits
 * BELOW the map on phones (see the ordering note on the grid below), so
 * there is no "chrome below the map" to subtract here — only the toolbar
 * strip above it. 52dvh gives a genuinely usable map on the first screen
 * without pushing the list far off-screen, and `dvh` (not `vh`) tracks the
 * real visible viewport as Safari's URL bar collapses/expands, so the map
 * doesn't jump or overflow when that happens.
 */
const MAP_MOBILE_H = "52dvh"
const MAP_MOBILE_MIN_H = "340px"

/** Independent-scroll cap for the mobile list, which sits below the map in
 *  normal page flow. Kept well short of the viewport so the map + toolbar
 *  are still visible above it on first paint, while staying tall enough to
 *  show a handful of cards before the list itself takes over scrolling. */
const MAP_MOBILE_LIST_MAX_H = "38vh"

function LegendChip({ color, label }: { color: string; label: string }) {
    return (
        <HStack gap="1.5">
            <Box w="10px" h="10px" rounded="full" bg={color} />
            <Text fontSize="xs" fontWeight="medium">{label}</Text>
        </HStack>
    )
}

/** Compact pin-colour legend, sized for the map's bottom-left overlay on
 *  phones (see the mobile map box below) — smaller than `LegendChip`, whose
 *  full size is reserved for the toolbar panel on md+. */
function LegendDot({ color, label }: { color: string; label: string }) {
    return (
        <HStack gap="1">
            <Box w="7px" h="7px" rounded="full" bg={color} flexShrink="0" />
            <Text fontSize="10px" fontWeight="semibold" color="fg.muted">{label}</Text>
        </HStack>
    )
}

/** One row of the tournament list: colour-coded pin dot, name + place, and a
 *  chevron that opens the tournament's own detail page. The row itself is a
 *  separate click target from the chevron — clicking anywhere else on the
 *  card only selects it (focuses its pin on the map), it does not navigate;
 *  the chevron is what leaves the map to view the tournament. */
function TournamentListItem({
    t,
    active,
    onSelect,
    tt,
}: {
    t: TournamentWithCoords
    active: boolean
    onSelect: () => void
    tt: Translate
}) {
    const bucket = classify(t.startAt)
    const color = PIN_COLORS[bucket]
    return (
        <HStack
            colorPalette="blue"
            align="center"
            gap="3"
            px="3"
            py="2.5"
            rounded="lg"
            borderWidth="1px"
            borderColor={active ? "colorPalette.emphasized" : "border.subtle"}
            bg={active ? "colorPalette.subtle" : "bg.panel"}
            cursor="pointer"
            onClick={onSelect}
            _hover={{ bg: active ? "colorPalette.subtle" : "bg.subtle" }}
            transition="background-color 150ms, border-color 150ms"
        >
            <Box w="10px" h="10px" rounded="full" bg={color} flexShrink="0" />
            <Box flex="1" minW="0">
                <Text fontSize="sm" fontWeight="semibold" truncate>
                    {t.name}
                </Text>
                {t.location && (
                    <Text fontSize="xs" color="fg.muted" truncate mt="0.5">
                        {t.location}
                    </Text>
                )}
            </Box>
            <IconButton
                asChild
                aria-label={tt("pages.map.list.openDetailsAria", { name: t.name })}
                title={tt("pages.map.list.openDetailsAria", { name: t.name })}
                size="xs"
                variant="ghost"
                flexShrink="0"
                onClick={(e) => e.stopPropagation()}
            >
                <RouterLink to={`/turniri/${t.slug ?? t.uuid}`}>
                    <FiChevronRight />
                </RouterLink>
            </IconButton>
        </HStack>
    )
}

/** Shared header (visible count + "clear selection") and scroll region for
 *  the list of tournaments currently placed on the map. Used both as the
 *  desktop sidebar and as the mobile panel below the map — `maxH` is the
 *  only thing that differs between the two placements. */
function TournamentMapList({
    placed,
    placedAll,
    selectedUuid,
    onSelect,
    onClear,
    maxH,
    tt,
    plural,
}: {
    placed: TournamentWithCoords[]
    placedAll: TournamentWithCoords[]
    selectedUuid: string | null
    onSelect: (uuid: string) => void
    onClear: () => void
    maxH: string
    tt: Translate
    plural: (baseKey: string, count: number) => string
}) {
    return (
        <>
            <Flex justify="space-between" align="center" mb="2" minH="20px" gap="2">
                <Text fontSize="xs" fontWeight="semibold" color="fg.muted">
                    {placed.length > 0 ? plural("pages.map.list.count", placed.length) : ""}
                </Text>
                {selectedUuid && (
                    <Text
                        fontSize="xs"
                        fontWeight="medium"
                        color="blue.fg"
                        cursor="pointer"
                        onClick={onClear}
                    >
                        {tt("pages.map.list.clearSelection")}
                    </Text>
                )}
            </Flex>
            <VStack align="stretch" gap="2" maxH={maxH} overflowY="auto" pr="1">
                {placed.length === 0 ? (
                    <Box
                        borderWidth="1px"
                        borderStyle="dashed"
                        borderColor="border.subtle"
                        rounded="lg"
                        p="5"
                        textAlign="center"
                    >
                        <Text fontSize="sm" color="fg.muted">
                            {placedAll.length === 0
                                ? tt("pages.map.list.emptyNone")
                                : tt("pages.map.list.emptyNoResults")}
                        </Text>
                    </Box>
                ) : (
                    placed.map((t) => (
                        <TournamentListItem
                            key={t.uuid}
                            t={t}
                            active={selectedUuid === t.uuid}
                            onSelect={() => onSelect(t.uuid)}
                            tt={tt}
                        />
                    ))
                )}
            </VStack>
        </>
    )
}

export default function MapPage() {
    const { t: tt } = useTranslation()
    const plural = usePlural()

    // /karta was the only routed page that never set a head, so it inherited
    // whatever title, description and canonical the previous route had left
    // behind. Same shape as CalendarPage's call.
    useDocumentHead({
        title: tt("pages.map.seo.title"),
        description: tt("pages.map.seo.description"),
        ogTitle: tt("pages.map.seo.ogTitle"),
        ogDescription: tt("pages.map.seo.ogDescription"),
        ogType: "website",
        canonical: "https://bela-turniri.com/karta",
    })

    // Upcoming tournaments, shared through one cache entry — coming back to
    // /karta inside the staleTime window repaints the pins instantly instead of
    // re-fetching and re-mounting the marker layer.
    const { data: tournaments = EMPTY_TOURNAMENTS, error: queryError } =
        useQuery<TournamentCard[]>({
            queryKey: qk.map,
            queryFn: () => fetchTournaments("upcoming"),
        })
    const error = queryError ? (queryError.message || tt("pages.map.loadErrorFallback")) : null

    // Geolocation — auto-shows on return visits if permission was granted
    const { pos: userPos, status: geoStatus, request: requestLocation, hide: hideLocation } = useUserLocation()

    // Auto-ask for location permission the first time the map is opened.
    // We only fire while the hook reports "idle" — that's the browser's
    // "prompt" state, i.e. the user hasn't decided yet. On return visits
    // the hook resolves to "granted" / "denied" (the browser remembers
    // the choice) and this never fires again. We also skip "hidden" so a
    // user who explicitly hid their location isn't re-prompted.
    //
    // The hook resolves its mount check asynchronously (Permissions API),
    // so we wait a short beat before requesting: if the status settles
    // to a non-idle value within that window, this effect re-runs and
    // the cleanup clears the timer before it fires.
    const autoRequestedRef = useRef(false)
    useEffect(() => {
        if (autoRequestedRef.current) return
        if (geoStatus !== "idle") return
        const handle = window.setTimeout(() => {
            autoRequestedRef.current = true
            requestLocation()
        }, 600)
        return () => window.clearTimeout(handle)
        // requestLocation is recreated each render but functionally
        // stable; depending on it would reset the timer on unrelated
        // re-renders (e.g. the tournament fetch resolving).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [geoStatus])

    // Distance filter — slider 1–100 km, auto-applies. 100 is treated
    // as "show all" so dragging to the right edge disables the filter
    // entirely. Only meaningful when location is on; the slider is
    // disabled otherwise.
    // Reaching MAP_RADIUS_MAX_KM (100) is the "show all" affordance —
    // the filter short-circuits at that point. Default is the max so
    // the map shows every tournament until the user narrows down.
    const [radiusKm, setRadiusKm] = useState<number>(MAP_RADIUS_MAX_KM)

    // Which tournament (if any) is focused — set by clicking either a list
    // card or a pin. Drives the pin popup, the camera fly-to (MapFocus
    // phase 3) and the list card's highlighted state, so all three always
    // agree on what's "selected".
    const [selectedUuid, setSelectedUuid] = useState<string | null>(null)

    // Map of uuid → Leaflet Marker so selecting a list card can imperatively
    // open that marker's popup. Kept outside React state (a ref, not state)
    // to avoid re-renders — Leaflet owns these instances, not React.
    const markersRef = useRef<Map<string, L.Marker>>(new Map())

    // All tournaments that have valid coordinates
    const placedAll: TournamentWithCoords[] = useMemo(() => {
        return tournaments
            .filter((t) =>
                typeof t.latitude === "number" &&
                typeof t.longitude === "number" &&
                isFinite(t.latitude) &&
                isFinite(t.longitude),
            )
            .map((t) => t as TournamentWithCoords)
    }, [tournaments])

    /* ── Deep link: /karta?turnir=<slug|uuid> ─────────────────────────────
       Lets another screen (today the calendar's "open on map" control) hand
       the map a tournament to focus. It does NOT get its own code path: it
       resolves to a uuid and then goes through `setSelectedUuid`, exactly
       like a click on a list card — same highlighted card, same camera
       fly-to (MapFocus phase 3), same popup. One selection mechanism, so the
       deep-linked state and the clicked state can never look different.

       Read-only: the parameter is never rewritten. The URL therefore stays
       shareable and Back keeps working, at the cost of the parameter going
       stale once the user selects something else — which is invisible, since
       it is only ever read again on a fresh mount.
       ─────────────────────────────────────────────────────────────────── */
    const [searchParams] = useSearchParams()
    const targetParam = searchParams.get(MAP_TARGET_PARAM)?.trim() || null

    // Which target has already been consumed. A ref, not state: applying is a
    // one-shot effect per target. Re-applying would fight the user — they
    // must be able to select another pin, or clear the selection, without the
    // URL dragging them back.
    const appliedTargetRef = useRef<string | null>(null)
    useEffect(() => {
        if (!targetParam) {
            appliedTargetRef.current = null
            return
        }
        if (appliedTargetRef.current === targetParam) return
        // Nothing to resolve against until the query lands; stay unconsumed
        // so this re-runs when the tournaments arrive.
        if (placedAll.length === 0) return
        appliedTargetRef.current = targetParam
        // Either form of the id, matching every other tournament route in the
        // app (the backend's findByUuidOrSlug does the same).
        const match = placedAll.find((t) => t.slug === targetParam || t.uuid === targetParam)
        // A target that does not resolve — deleted tournament, typo'd slug,
        // a finished one (this page only plots the "upcoming" bucket), or one
        // that has no coordinates — is not an error. Leave the map in its
        // normal state rather than putting an error in front of someone who
        // just wanted to see a map.
        if (match) setSelectedUuid(match.uuid)
    }, [targetParam, placedAll])

    // Apply radius filter when location is on; 500 effectively means "all".
    const placed: TournamentWithCoords[] = useMemo(() => {
        if (!userPos || radiusKm >= MAP_RADIUS_MAX_KM) return placedAll
        const me = { lat: userPos[0], lng: userPos[1] }
        return placedAll.filter(
            (t) => haversineKm(me, { lat: t.latitude, lng: t.longitude }) <= radiusKm,
        )
    }, [placedAll, userPos, radiusKm])

    const allPoints = useMemo<[number, number][]>(
        () => placed.map((t) => [t.latitude, t.longitude]),
        [placed],
    )

    const selectedTournament = useMemo(
        () => placed.find((t) => t.uuid === selectedUuid) ?? null,
        [placed, selectedUuid],
    )

    // Drop the selection if it falls out of the currently-placed set (e.g.
    // the radius was narrowed past it) — otherwise "Poništi odabir" would
    // linger over a card that no longer exists in the list.
    useEffect(() => {
        if (selectedUuid && !placed.some((t) => t.uuid === selectedUuid)) {
            setSelectedUuid(null)
        }
    }, [placed, selectedUuid])

    // Open the selected tournament's popup whenever selection changes. The
    // marker may not exist yet on first render (Leaflet mounts
    // asynchronously), so we retry once more after a short timeout in case
    // the marker registered after this effect ran.
    useEffect(() => {
        if (!selectedUuid) return
        const open = () => {
            const marker = markersRef.current.get(selectedUuid)
            if (marker) marker.openPopup()
        }
        open()
        const handle = window.setTimeout(open, 120)
        return () => window.clearTimeout(handle)
    }, [selectedUuid])

    function selectTournament(uuid: string) {
        // Toggle off when selecting the already-selected entry — gives the
        // user a way to clear the focus without zooming out manually.
        setSelectedUuid((cur) => (cur === uuid ? null : uuid))
    }

    // Default Croatia view if nothing to fit to
    const defaultCenter: [number, number] = [44.5, 16.5]
    const defaultZoom = 7

    const hiddenByRadius = placedAll.length - placed.length
    const radiusDisabled = !userPos

    return (
        <VStack align="stretch" gap="4">
            {/* Toolbar panel — radius filter, legend and the location
                toggle live inside one rounded panel instead of floating
                loose on the page background. A single non-wrapping row on
                every breakpoint: the legend and the labelled location
                button collapse to compact/icon-only forms on phones (the
                legend re-appears as an overlay pill on the map itself, see
                below) rather than wrapping onto extra rows and pushing the
                map further down the first screen. */}
            <Box borderWidth="1px" borderColor="border.subtle" bg="bg.panel" rounded="xl" p="3" shadow="xs">
                <Flex align="center" gap={{ base: "2", md: "4" }} wrap="nowrap">
                    <HStack gap="2" flex="1" minW="0">
                        <Text
                            fontSize="xs"
                            color="fg.muted"
                            fontWeight="medium"
                            flexShrink="0"
                            display={{ base: "none", sm: "block" }}
                        >
                            {tt("pages.map.radiusLabel")}
                        </Text>
                        <Box flex="1" minW="60px">
                            <Slider.Root
                                min={1}
                                max={MAP_RADIUS_MAX_KM}
                                step={1}
                                value={[radiusKm]}
                                onValueChange={(e) => setRadiusKm(e.value[0])}
                                disabled={radiusDisabled}
                                colorPalette="blue"
                            >
                                <Slider.Control>
                                    <Slider.Track>
                                        <Slider.Range />
                                    </Slider.Track>
                                    <Slider.Thumbs />
                                </Slider.Control>
                            </Slider.Root>
                        </Box>
                        <Text
                            fontSize="xs"
                            fontWeight="semibold"
                            color="blue.fg"
                            flexShrink="0"
                            minW={{ base: "34px", md: "44px" }}
                            textAlign="right"
                        >
                            {radiusDisabled
                                ? "—"
                                : (radiusKm >= MAP_RADIUS_MAX_KM ? tt("pages.map.radiusAll") : `${radiusKm} km`)}
                        </Text>
                    </HStack>

                    {/* Vertical separator — desktop only, where the legend
                        joins the same row. */}
                    <Box
                        h="20px"
                        w="1px"
                        bg="border.emphasized"
                        display={{ base: "none", md: "block" }}
                        flexShrink="0"
                    />

                    {/* Legend — desktop only; phones get the compact
                        overlay pill on the map instead (see below). */}
                    <HStack gap="3" display={{ base: "none", md: "flex" }} flexShrink="0">
                        <LegendChip color={PIN_COLORS.thisWeek} label={tt("pages.map.bucket.thisWeek")} />
                        <LegendChip color={PIN_COLORS.nextWeek} label={tt("pages.map.bucket.nextWeek")} />
                        <LegendChip color={PIN_COLORS.beyond} label={tt("pages.map.bucket.beyond")} />
                    </HStack>

                    {/* Location toggle — icon-only on phones (label is what
                        forced this cluster onto a second row before), full
                        labelled button on md+. */}
                    <Box flexShrink="0">
                        {geoStatus === "granted" ? (
                            <>
                                <IconButton
                                    display={{ base: "inline-flex", md: "none" }}
                                    aria-label={tt("pages.map.hideLocation")}
                                    title={tt("pages.map.hideLocation")}
                                    size="sm"
                                    variant="outline"
                                    rounded="full"
                                    onClick={hideLocation}
                                >
                                    <FiEyeOff />
                                </IconButton>
                                <Button
                                    display={{ base: "none", md: "inline-flex" }}
                                    size="sm"
                                    variant="outline"
                                    onClick={hideLocation}
                                >
                                    <FiEyeOff /> {tt("pages.map.hideLocation")}
                                </Button>
                            </>
                        ) : (
                            <>
                                <IconButton
                                    display={{ base: "inline-flex", md: "none" }}
                                    aria-label={tt("pages.map.showLocation")}
                                    title={tt("pages.map.showLocation")}
                                    size="sm"
                                    variant="outline"
                                    rounded="full"
                                    onClick={requestLocation}
                                    disabled={geoStatus === "asking"}
                                    loading={geoStatus === "asking"}
                                >
                                    <FiNavigation />
                                </IconButton>
                                <Button
                                    display={{ base: "none", md: "inline-flex" }}
                                    size="sm"
                                    variant="outline"
                                    onClick={requestLocation}
                                    disabled={geoStatus === "asking"}
                                    loading={geoStatus === "asking"}
                                >
                                    <FiNavigation /> {tt("pages.map.showLocation")}
                                </Button>
                            </>
                        )}
                    </Box>
                </Flex>

                {/* "N outside the radius" note — its own row, desktop only;
                    the compact single-row phone strip has no room for it
                    and the value chip already communicates the filter. */}
                {!radiusDisabled && radiusKm < MAP_RADIUS_MAX_KM && hiddenByRadius > 0 && (
                    <Text display={{ base: "none", md: "block" }} fontSize="xs" color="fg.muted" mt="2">
                        {tt("pages.map.hiddenByRadius", { n: hiddenByRadius })}
                    </Text>
                )}
            </Box>

            {/* Quick-select chips — mobile only. The full list sits below the
                map (see the ordering note further down), out of the first
                screen; this lets a tap jump straight to a pin without
                scrolling down for it first. Reuses the exact same selection
                state a list row or clicking a pin already drives — one
                mechanism, three ways to trigger it. Desktop skips this: its
                list column sits right beside the map, already serving the
                same "quick jump" job. */}
            {placed.length > 0 && (
                <Box
                    display={{ base: "block", md: "none" }}
                    overflowX="auto"
                    mx="-1"
                    px="1"
                    css={{ scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}
                >
                    <HStack gap="2" minW="max-content" pb="1">
                        {placed.map((t) => {
                            const bucket = classify(t.startAt)
                            const active = selectedUuid === t.uuid
                            return (
                                <chakra.button
                                    key={t.uuid}
                                    type="button"
                                    onClick={() => selectTournament(t.uuid)}
                                    aria-pressed={active}
                                    display="inline-flex"
                                    alignItems="center"
                                    gap="1.5"
                                    flexShrink={0}
                                    px="3"
                                    py="1.5"
                                    rounded="full"
                                    borderWidth="1px"
                                    borderColor={active ? "blue.emphasized" : "border.subtle"}
                                    bg={active ? "blue.subtle" : "bg.panel"}
                                    color={active ? "blue.fg" : "fg.soft"}
                                    fontSize="xs"
                                    fontWeight="semibold"
                                    cursor="pointer"
                                >
                                    <Box w="7px" h="7px" rounded="full" bg={PIN_COLORS[bucket]} flexShrink={0} />
                                    <Text as="span" maxW="150px" truncate>{t.name}</Text>
                                </chakra.button>
                            )
                        })}
                    </HStack>
                </Box>
            )}

            {geoStatus === "denied" && (
                <Box
                    borderWidth="1px"
                    borderColor="orange.muted"
                    bg="orange.subtle"
                    rounded="md"
                    px="3"
                    py="2"
                >
                    <Text fontSize="sm">
                        {tt("pages.map.locationDenied")}
                    </Text>
                </Box>
            )}
            {geoStatus === "unsupported" && (
                <Box
                    borderWidth="1px"
                    borderColor="orange.muted"
                    bg="orange.subtle"
                    rounded="md"
                    px="3"
                    py="2"
                >
                    <Text fontSize="sm">{tt("pages.map.locationUnsupported")}</Text>
                </Box>
            )}

            {error && (
                <Box
                    borderWidth="1px"
                    borderColor="red.muted"
                    bg="red.subtle"
                    rounded="md"
                    px="3"
                    py="2"
                >
                    <Text fontSize="sm" color="red.fg">{error}</Text>
                </Box>
            )}

            {/* Main split — a fixed-width list column beside a flexible map
                on md+; one column on phones.

                Mobile ordering: the map comes FIRST, the list SECOND. This
                page's shell (unlike the sibling futsal app's) lets the
                whole route scroll normally — the bottom tab bar's clearance
                is already reserved by the app-level Container padding, not
                by pinning this page to the viewport — so there is no need
                to cram the list above the fold. Putting the map first means
                it gets a full, immediately usable height on first paint
                (see MAP_MOBILE_H above); the list is one scroll away below
                it, capped to its own independently-scrolling region so
                browsing it never fights the map for space or hides behind
                the tab bar. Three children are declared below in DOM order
                (desktop list, map, mobile list); the two that aren't shown
                at a given breakpoint are `display: none`, which removes
                them from the grid entirely, so no `order` juggling is
                needed to get map-then-list on phones and list-beside-map
                on md+. */}
            <Grid templateColumns={{ base: "1fr", md: "340px 1fr" }} gap="5">
                {/* Desktop list column */}
                <Box display={{ base: "none", md: "block" }}>
                    <TournamentMapList
                        placed={placed}
                        placedAll={placedAll}
                        selectedUuid={selectedUuid}
                        onSelect={selectTournament}
                        onClear={() => setSelectedUuid(null)}
                        maxH={MAP_DESKTOP_H}
                        tt={tt}
                        plural={plural}
                    />
                </Box>

                {/* Map container. `mt="7"` on md+ offsets the map's top edge
                    by the list header's height (minH 20px + mb "2" = 28px =
                    the "7" spacing token) so the map lines up with the
                    first list card instead of sitting higher than it. */}
                <Box
                    mt={{ base: "0", md: "7" }}
                    borderWidth="1px"
                    borderColor="border.emphasized"
                    rounded="xl"
                    overflow="hidden"
                    shadow="sm"
                    h={{ base: MAP_MOBILE_H, md: MAP_DESKTOP_H }}
                    minH={{ base: MAP_MOBILE_MIN_H, md: MAP_DESKTOP_MIN_H }}
                    bg="bg.muted"
                    position="relative"
                >
                    <MapContainer
                        center={userPos ?? defaultCenter}
                        zoom={userPos ? 10 : defaultZoom}
                        scrollWheelZoom
                        style={{ height: "100%", width: "100%" }}
                    >
                        {/* Basemap (CARTO Voyager by default — keyless, neutral,
                            readable) resolved in utils/mapTiles.ts, which lets a
                            keyed provider be swapped in via env vars. */}
                        <TileLayer
                            attribution={mapTiles.attribution}
                            url={mapTiles.url}
                            maxZoom={mapTiles.maxZoom}
                        />

                        {placed.map((t) => {
                            const bucket = classify(t.startAt)
                            // Distance from the user, shown in the popup below —
                            // only computable once we know where the user is.
                            const distanceKm = userPos
                                ? haversineKm({ lat: userPos[0], lng: userPos[1] }, { lat: t.latitude, lng: t.longitude })
                                : null
                            return (
                                <Marker
                                    key={t.uuid}
                                    position={[t.latitude, t.longitude]}
                                    icon={makePinIcon(PIN_COLORS[bucket])}
                                    eventHandlers={{
                                        // Register/unregister this marker so
                                        // selecting it from the list can
                                        // imperatively open its popup.
                                        add: (e) => {
                                            markersRef.current.set(t.uuid, e.target as L.Marker)
                                        },
                                        remove: () => {
                                            markersRef.current.delete(t.uuid)
                                        },
                                        click: () => {
                                            setSelectedUuid(t.uuid)
                                        },
                                    }}
                                >
                                    <Popup minWidth={220} maxWidth={280}>
                                        <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 4 }}>
                                            <strong style={{ fontSize: 14, lineHeight: 1.3 }}>{t.name}</strong>
                                            <span
                                                style={{
                                                    display: "inline-block",
                                                    alignSelf: "flex-start",
                                                    padding: "2px 8px",
                                                    borderRadius: 4,
                                                    fontSize: 11,
                                                    fontWeight: 600,
                                                    textTransform: "uppercase",
                                                    letterSpacing: 0.5,
                                                    color: "white",
                                                    background: PIN_COLORS[bucket],
                                                }}
                                            >
                                                {bucketLabel(tt, bucket)}
                                            </span>
                                            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                                                <FiCalendar size={12} />
                                                <span>{formatDateShort(t.startAt)} • {formatTime(t.startAt, "")}</span>
                                            </div>
                                            {t.location && (
                                                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                                                    <FiMapPin size={12} />
                                                    <span>
                                                        {t.location}
                                                        {distanceKm != null && ` • ${formatDistanceKm(distanceKm)}`}
                                                    </span>
                                                </div>
                                            )}
                                            {!t.location && distanceKm != null && (
                                                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                                                    <FiMapPin size={12} />
                                                    <span>{formatDistanceKm(distanceKm)}</span>
                                                </div>
                                            )}
                                            {/* Pricing summary — kotizacija (entry fee)
                                                and repasaž (repassage / second-chance
                                                fee), pulled from the same card payload
                                                the list uses. Hide the row when both
                                                are zero/missing so we don't clutter the
                                                popup with "0€". */}
                                            {(() => {
                                                // Gate on the NUMBER, not the formatted
                                                // string: formatAmount(0) is "0€", which
                                                // is truthy and would print the very row
                                                // we mean to hide for a free tournament.
                                                const entry = positiveAmount(t.entryPrice)
                                                const rep = positiveAmount(t.repassagePrice)
                                                if (!entry && !rep) return null
                                                return (
                                                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                                                        <FiDollarSign size={12} />
                                                        <span>
                                                            {entry && <>{tt("pages.map.popup.entryPriceLabel")} <strong>{entry}</strong></>}
                                                            {entry && rep && " • "}
                                                            {rep && <>{tt("pages.map.popup.repassagePriceLabel")} <strong>{rep}</strong></>}
                                                        </span>
                                                    </div>
                                                )
                                            })()}
                                            <RouterLink
                                                to={`/turniri/${t.slug ?? t.uuid}`}
                                                style={{
                                                    display: "inline-block",
                                                    marginTop: 4,
                                                    padding: "6px 10px",
                                                    borderRadius: 6,
                                                    background: "#227342",
                                                    color: "white",
                                                    textAlign: "center",
                                                    textDecoration: "none",
                                                    fontSize: 13,
                                                    fontWeight: 600,
                                                }}
                                            >
                                                {tt("pages.map.popup.moreDetails")}
                                            </RouterLink>
                                        </div>
                                    </Popup>
                                </Marker>
                            )
                        })}

                        {/* User position marker */}
                        {userPos && (
                            <Marker position={userPos} icon={makePinIcon("", true)}>
                                <Popup>
                                    <strong>{tt("pages.map.popup.yourLocation")}</strong>
                                </Popup>
                            </Marker>
                        )}

                        {/* Radius circle — drawn whenever we have a location
                            AND the slider is below max. At max km the circle
                            would dwarf the map (and the filter is a no-op),
                            so we hide it instead of cluttering the view. */}
                        {userPos && radiusKm < MAP_RADIUS_MAX_KM && (
                            <Circle
                                center={userPos}
                                radius={radiusKm * 1000}
                                pathOptions={{
                                    color: "#2f8f52",
                                    weight: 2,
                                    opacity: 0.7,
                                    fillColor: "#227342",
                                    fillOpacity: 0.08,
                                }}
                            />
                        )}

                        <MapFocus
                            userPos={userPos}
                            allPoints={allPoints}
                            radiusKm={radiusKm}
                            radiusMax={MAP_RADIUS_MAX_KM}
                            selectedTournament={selectedTournament}
                        />
                    </MapContainer>

                    {/* Phone-only pin legend, floated over the map's
                        bottom-left corner — the toolbar panel drops the
                        legend on phones (see above) to stay a single row,
                        so it re-appears here instead. Costs no layout
                        height and stays clear of taps: Leaflet's own
                        controls sit at z-index 1000, so 500 keeps this
                        below them. */}
                    <HStack
                        display={{ base: "flex", md: "none" }}
                        position="absolute"
                        left="8px"
                        bottom="8px"
                        zIndex={500}
                        pointerEvents="none"
                        gap="2"
                        px="2"
                        py="1"
                        rounded="md"
                        bg="bg.panel"
                        borderWidth="1px"
                        borderColor="border.subtle"
                        shadow="sm"
                        opacity={0.95}
                    >
                        <LegendDot color={PIN_COLORS.thisWeek} label={tt("pages.map.bucket.thisWeek")} />
                        <LegendDot color={PIN_COLORS.nextWeek} label={tt("pages.map.bucket.nextWeek")} />
                        <LegendDot color={PIN_COLORS.beyond} label={tt("pages.map.bucket.beyond")} />
                    </HStack>
                </Box>

                {/* Mobile list — below the map, see the ordering note above
                    the grid. Its own scroll region (MAP_MOBILE_LIST_MAX_H)
                    keeps it from growing the page without bound. */}
                <Box display={{ base: "block", md: "none" }}>
                    <TournamentMapList
                        placed={placed}
                        placedAll={placedAll}
                        selectedUuid={selectedUuid}
                        onSelect={selectTournament}
                        onClear={() => setSelectedUuid(null)}
                        maxH={MAP_MOBILE_LIST_MAX_H}
                        tt={tt}
                        plural={plural}
                    />
                </Box>
            </Grid>
        </VStack>
    )
}
