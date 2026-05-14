import { useEffect, useMemo, useRef, useState } from "react"
import {
    Box,
    Button,
    HStack,
    Slider,
    Text,
    VStack,
} from "@chakra-ui/react"
import { Link as RouterLink } from "react-router-dom"
import { FiCalendar, FiDollarSign, FiEyeOff, FiMapPin, FiNavigation } from "react-icons/fi"

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
import { useUserLocation } from "../hooks/useUserLocation"
import { haversineKm } from "../utils/distance"

type TournamentWithCoords = TournamentCard & {
    uuid: string
    latitude: number
    longitude: number
}

type Bucket = "today" | "soon" | "later"

// Today = green, until end of next week (next Sunday) = yellow, beyond = red.
const PIN_COLORS: Record<Bucket, string> = {
    today: "#22C55E",  // green-500
    soon: "#EAB308",   // yellow-500
    later: "#EF4444",  // red-500
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
 * stays in sync with the actual pins on the map.
 */
function makePinIcon(color: string, isUser = false): L.DivIcon {
    const html = isUser
        ? `<div style="
              width: 18px; height: 18px; border-radius: 50%;
              background: #2563EB; border: 3px solid white;
              box-shadow: 0 0 0 2px rgba(37,99,235,0.4), 0 1px 4px rgba(0,0,0,0.4);">
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
    if (!startAt) return "later"
    const start = new Date(startAt).setHours(0, 0, 0, 0)
    const today = new Date().setHours(0, 0, 0, 0)
    const cutoff = endOfNextWeek(new Date()).getTime()
    if (start === today) return "today"
    if (start >= today && start <= cutoff) return "soon"
    return "later"
}

function formatDateShort(iso?: string | null): string {
    if (!iso) return "—"
    return new Intl.DateTimeFormat("hr-HR", {
        weekday: "short",
        day: "2-digit",
        month: "short",
    }).format(new Date(iso))
}
function formatTime(iso?: string | null): string {
    if (!iso) return ""
    return new Intl.DateTimeFormat("hr-HR", {
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(iso))
}

/**
 * Initial camera focus + radius-circle follow.
 *
 * <p>Two-phase behaviour:
 *
 *   1. <b>Initial open (runs once):</b> if the user's location is
 *      available, centre on it at zoom 10 — roughly a 25 km radius
 *      visible at typical screen widths. This matches the default
 *      slider state ("Sve") so the visual scope of the map agrees
 *      with the visual scope of the filter. If location isn't
 *      available, fall back to fitting all tournament points.
 *
 *   2. <b>After initial focus:</b> when the user drags the radius
 *      slider below the max, fit the camera to the resulting circle
 *      so the search area stays fully visible. Doesn't react to
 *      tournament-point changes — once the user has set their view
 *      they decide when to zoom out, except when they explicitly
 *      narrow the radius.
 */
function MapFocus({
    userPos,
    allPoints,
    radiusKm,
    radiusMax,
}: {
    userPos: [number, number] | null
    allPoints: [number, number][]
    radiusKm: number
    radiusMax: number
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
    }, [userPos, allPoints, map])

    // Phase 2 — radius-follow. Only fires after the initial focus has
    // landed and only when the slider is below the max (= "Sve"). Doesn't
    // re-fit when allPoints changes; that lets the slider drive the view
    // without random repositioning when, say, a tournament list refresh
    // arrives in the background.
    useEffect(() => {
        if (initialRef.current !== "done") return
        if (!userPos) return
        if (radiusKm >= radiusMax) return
        const bounds = L.latLngBounds([
            userPos,
            ...circleBoxCorners(userPos, radiusKm),
        ])
        map.fitBounds(bounds, { padding: [40, 40] })
    }, [radiusKm, userPos, radiusMax, map])

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

function LegendChip({ color, label }: { color: string; label: string }) {
    return (
        <HStack gap="1.5">
            <Box w="10px" h="10px" rounded="full" bg={color} />
            <Text fontSize="xs" fontWeight="medium">{label}</Text>
        </HStack>
    )
}

export default function MapPage() {
    const [tournaments, setTournaments] = useState<TournamentCard[]>([])
    const [, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Geolocation — auto-shows on return visits if permission was granted
    const { pos: userPos, status: geoStatus, request: requestLocation, hide: hideLocation } = useUserLocation()

    // Distance filter — slider 1–100 km, auto-applies. 100 is treated
    // as "show all" so dragging to the right edge disables the filter
    // entirely. Only meaningful when location is on; the slider is
    // disabled otherwise.
    // Reaching MAP_RADIUS_MAX_KM (100) is the "show all" affordance —
    // the filter short-circuits at that point. Default is the max so
    // the map shows every tournament until the user narrows down.
    const [radiusKm, setRadiusKm] = useState<number>(MAP_RADIUS_MAX_KM)

    useEffect(() => {
        let cancelled = false
        ;(async () => {
            try {
                setLoading(true)
                setError(null)
                const data = await fetchTournaments("upcoming")
                if (!cancelled) setTournaments(data)
            } catch (e: any) {
                if (!cancelled) setError(e?.message ?? "Failed to load tournaments")
            } finally {
                if (!cancelled) setLoading(false)
            }
        })()
        return () => { cancelled = true }
    }, [])

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

    // Default Croatia view if nothing to fit to
    const defaultCenter: [number, number] = [44.5, 16.5]
    const defaultZoom = 7

    const missingCoords = tournaments.length - placedAll.length
    const hiddenByRadius = placedAll.length - placed.length
    const radiusDisabled = !userPos

    return (
        <VStack align="stretch" gap="4">
            {/* Single compact controls row: legend + radius chips + location toggle */}
            <HStack justify="space-between" gap="3" wrap="wrap" align="center">
                <HStack gap="3" wrap="wrap" align="center">
                    {/* Radius slider — 1–100 km, auto-applies. The max
                        (MAP_RADIUS_MAX_KM) is treated as "Sve" — the
                        filter short-circuits at that point so dragging
                        to the right edge shows every tournament. */}
                    <Box minW={{ base: "100%", md: "240px" }}>
                        <HStack gap="2" mb="1" align="center" wrap="wrap">
                            <Text fontSize="xs" color="fg.muted" fontWeight="medium">
                                U krugu od:
                            </Text>
                            <Text fontSize="xs" fontWeight="semibold" color="blue.fg">
                                {radiusDisabled
                                    ? "—"
                                    : (radiusKm >= MAP_RADIUS_MAX_KM ? "Sve" : `${radiusKm} km`)}
                            </Text>
                            {!radiusDisabled && radiusKm < MAP_RADIUS_MAX_KM && hiddenByRadius > 0 && (
                                <Text fontSize="xs" color="fg.muted">
                                    ({hiddenByRadius} izvan kruga)
                                </Text>
                            )}
                        </HStack>
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

                    {/* Vertical separator */}
                    <Box
                        h="20px"
                        w="1px"
                        bg="border.emphasized"
                        display={{ base: "none", md: "block" }}
                    />

                    {/* Legend */}
                    <HStack gap="3" wrap="wrap">
                        <LegendChip color={PIN_COLORS.today} label="Danas" />
                        <LegendChip color={PIN_COLORS.soon} label="Do sljedeće nedjelje" />
                        <LegendChip color={PIN_COLORS.later} label="Kasnije" />
                    </HStack>
                </HStack>

                {/* Location toggle — pinned right */}
                {geoStatus === "granted" ? (
                    <Button size="sm" variant="outline" onClick={hideLocation}>
                        <FiEyeOff /> Sakrij moju lokaciju
                    </Button>
                ) : (
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={requestLocation}
                        disabled={geoStatus === "asking"}
                        loading={geoStatus === "asking"}
                    >
                        <FiNavigation /> Prikaži moju lokaciju
                    </Button>
                )}
            </HStack>

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
                        Pristup lokaciji je odbijen. Možeš ga uključiti kasnije u postavkama preglednika.
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
                    <Text fontSize="sm">Tvoj preglednik ne podržava geolokaciju.</Text>
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

            {/* Map container */}
            <Box
                borderWidth="1px"
                borderColor="border.emphasized"
                rounded="xl"
                overflow="hidden"
                shadow="sm"
                h={{ base: "60vh", md: "70vh" }}
                bg="bg.muted"
            >
                <MapContainer
                    center={userPos ?? defaultCenter}
                    zoom={userPos ? 10 : defaultZoom}
                    scrollWheelZoom
                    style={{ height: "100%", width: "100%" }}
                >
                    {/* CARTO Voyager — neutral, readable, free, no attribution issues */}
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                    />

                    {placed.map((t) => {
                        const bucket = classify(t.startAt)
                        return (
                            <Marker
                                key={t.uuid}
                                position={[t.latitude, t.longitude]}
                                icon={makePinIcon(PIN_COLORS[bucket])}
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
                                            {bucket === "today" ? "Danas" : bucket === "soon" ? "Uskoro" : "Kasnije"}
                                        </span>
                                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                                            <FiCalendar size={12} />
                                            <span>{formatDateShort(t.startAt)} • {formatTime(t.startAt)}</span>
                                        </div>
                                        {t.location && (
                                            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                                                <FiMapPin size={12} />
                                                <span>{t.location}</span>
                                            </div>
                                        )}
                                        {/* Pricing summary — kotizacija (entry fee)
                                            and repasaž (repassage / second-chance
                                            fee), pulled from the same card payload
                                            the list uses. Hide the row when both
                                            are zero/missing so we don't clutter the
                                            popup with "0€". */}
                                        {(() => {
                                            const fmt = (n?: number | null) => {
                                                if (typeof n !== "number" || !Number.isFinite(n)) return null
                                                const s = n.toFixed(2)
                                                return (s.endsWith(".00") ? s.slice(0, -3) : s) + "€"
                                            }
                                            const entry = fmt(t.entryPrice)
                                            const rep = fmt(t.repassagePrice)
                                            if (!entry && !rep) return null
                                            return (
                                                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                                                    <FiDollarSign size={12} />
                                                    <span>
                                                        {entry && <>Kotizacija: <strong>{entry}</strong></>}
                                                        {entry && rep && " • "}
                                                        {rep && <>Repasaž: <strong>{rep}</strong></>}
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
                                                background: "#3B82F6",
                                                color: "white",
                                                textAlign: "center",
                                                textDecoration: "none",
                                                fontSize: 13,
                                                fontWeight: 600,
                                            }}
                                        >
                                            Više detalja →
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
                                <strong>Tvoja lokacija</strong>
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
                                color: "#3B82F6",
                                weight: 2,
                                opacity: 0.7,
                                fillColor: "#3B82F6",
                                fillOpacity: 0.08,
                            }}
                        />
                    )}

                    <MapFocus
                        userPos={userPos}
                        allPoints={allPoints}
                        radiusKm={radiusKm}
                        radiusMax={MAP_RADIUS_MAX_KM}
                    />
                </MapContainer>
            </Box>

            {tournaments.length > 0 && missingCoords > 0 && (
                <Text fontSize="xs" color="fg.muted">
                    {missingCoords} {missingCoords === 1 ? "turnir" : "turnira"} nema poznatih koordinata.
                    Backfill se može pokrenuti pozivom <code>POST /api/tournaments/geocode-missing</code>.
                </Text>
            )}
        </VStack>
    )
}
