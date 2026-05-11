import { useEffect, useMemo, useState } from "react"
import {
    Box,
    Button,
    HStack,
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

/** Re-fits the map bounds to all visible markers when their list changes. */
function FitBounds({ points }: { points: [number, number][] }) {
    const map = useMap()
    useEffect(() => {
        if (points.length === 0) return
        const bounds = L.latLngBounds(points)
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 })
    }, [points, map])
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

function LegendChip({ color, label }: { color: string; label: string }) {
    return (
        <HStack gap="1.5">
            <Box w="10px" h="10px" rounded="full" bg={color} />
            <Text fontSize="xs" fontWeight="medium">{label}</Text>
        </HStack>
    )
}

/** Radius options exposed in the UI. `null` = no distance filter (show all). */
const RADIUS_OPTIONS: Array<{ label: string; km: number | null }> = [
    { label: "10 km", km: 10 },
    { label: "20 km", km: 20 },
    { label: "50 km", km: 50 },
    { label: "100 km", km: 100 },
    { label: "Sve", km: null },
]

export default function MapPage() {
    const [tournaments, setTournaments] = useState<TournamentCard[]>([])
    const [, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Geolocation — auto-shows on return visits if permission was granted
    const { pos: userPos, status: geoStatus, request: requestLocation, hide: hideLocation } = useUserLocation()

    // Distance filter (only meaningful when we have a user position)
    const [radiusKm, setRadiusKm] = useState<number | null>(null)

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

    // Apply radius filter only if both location and a radius are set
    const placed: TournamentWithCoords[] = useMemo(() => {
        if (!userPos || radiusKm == null) return placedAll
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
                    {/* Radius chips */}
                    <HStack gap="1" wrap="wrap" align="center">
                        <Text fontSize="xs" color="fg.muted" fontWeight="medium">
                            U krugu od:
                        </Text>
                        {RADIUS_OPTIONS.map((opt) => {
                            const active = radiusKm === opt.km
                            return (
                                <Button
                                    key={opt.label}
                                    size="xs"
                                    variant={active ? "solid" : "outline"}
                                    colorPalette={active ? "blue" : "gray"}
                                    onClick={() => setRadiusKm(opt.km)}
                                    disabled={radiusDisabled}
                                    title={radiusDisabled ? "Najprije prikaži svoju lokaciju" : undefined}
                                >
                                    {opt.label}
                                </Button>
                            )
                        })}
                        {!radiusDisabled && radiusKm != null && hiddenByRadius > 0 && (
                            <Text fontSize="xs" color="fg.muted">
                                ({hiddenByRadius} izvan kruga)
                            </Text>
                        )}
                    </HStack>

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
                                            to={`/tournaments/${t.slug ?? t.uuid}`}
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

                    {/* Radius circle when filtering by distance */}
                    {userPos && radiusKm != null && (
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

                    <FitBounds
                        points={
                            userPos && radiusKm != null
                                ? [...allPoints, userPos, ...circleBoxCorners(userPos, radiusKm)]
                                : userPos
                                    ? [...allPoints, userPos]
                                    : allPoints
                        }
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
