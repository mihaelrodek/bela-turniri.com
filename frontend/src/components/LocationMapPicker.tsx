import { useEffect, useState } from "react"
import { Box, Text } from "@chakra-ui/react"
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet"
// Leaflet's stylesheet — imported here (not just on the standalone /karta
// page) because the create / edit tournament forms mount this picker
// without ever loading MapPage's chunk. Without the CSS the tiles and
// controls render unstyled / misaligned. Vite dedupes the import, so
// pulling it in from two places is harmless.
import "leaflet/dist/leaflet.css"
import L from "leaflet"

/**
 * Custom marker icon for the picked location.
 *
 * <p>Why a hand-rolled {@code divIcon} instead of react-leaflet's
 * default {@code <Marker>} icon: Leaflet's default icon points at PNG
 * files bundled inside the leaflet package
 * ({@code marker-icon.png} / {@code marker-shadow.png}). Vite doesn't
 * rewrite those internal URLs, so the browser requests a path that
 * 404s — the marker renders as an empty box (just the transparent
 * icon frame / shadow, "only borders"). An inline-SVG divIcon carries
 * its own artwork in the HTML string, so there's no image URL to
 * resolve and the pin always shows. MapPage.tsx does the same thing.
 *
 * <p>Module-level constant — built once and reused for every render.
 */
const PICKER_PIN_ICON = L.divIcon({
    html: `<svg width="28" height="38" viewBox="0 0 28 38" xmlns="http://www.w3.org/2000/svg">
             <path d="M14 0C6.27 0 0 6.27 0 14c0 9.5 13 22.5 13.5 23a1 1 0 0 0 1 0C15 36.5 28 23.5 28 14c0-7.73-6.27-14-14-14z"
                   fill="#3182CE" stroke="white" stroke-width="2"/>
             <circle cx="14" cy="14" r="5" fill="white"/>
           </svg>`,
    className: "location-picker-pin",
    iconSize: [28, 38],
    // Anchor at the tip of the teardrop so the point sits exactly on
    // the picked coordinate.
    iconAnchor: [14, 38],
})

/**
 * Small Leaflet map for picking a location by clicking the map. Used as
 * a companion to {@link LocationAutocomplete} on the create-tournament
 * form: the user can either type and pick from suggestions, OR click
 * somewhere on the map and let us reverse-geocode the point into an
 * address. Both flows ultimately fill the same `location` string in
 * the parent form.
 *
 * <p>Reverse geocoding goes through OSM Nominatim, same as the forward
 * autocomplete, so picks here look identical to picks from the dropdown
 * (same Nominatim display_name format, same coordinate accuracy).
 */
export default function LocationMapPicker({
    value,
    onPick,
    height = "220px",
    minH,
}: {
    /** Pin position. When null/undefined no marker is drawn. */
    value?: { lat: number; lng: number } | null
    /** Fires when the user clicks the map AND the reverse geocode resolves. */
    onPick: (picked: { displayName: string; lat: number; lng: number }) => void
    /**
     * Chakra height value — accepts plain strings like "220px" or responsive
     * objects like {@code { base: "220px", md: "100%" }}. Defaults to a
     * fixed 220px which is the right size for the mobile create-form
     * layout; the parent passes a responsive value when the map needs to
     * fill a side column on desktop.
     */
    height?: string | { base?: string; sm?: string; md?: string; lg?: string }
    /** Optional minimum height — only needed when {@code height="100%"}
     *  to ensure the map doesn't collapse if its parent has no height. */
    minH?: string | number
}) {
    const [busy, setBusy] = useState(false)
    const [err, setErr] = useState<string | null>(null)

    // Default view: Croatia center + a country-wide zoom so the user
    // sees something familiar before they click. Once a `value` exists
    // we zoom in to street level.
    const center: [number, number] = value
        ? [value.lat, value.lng]
        : [44.5, 16.5]
    const zoom = value ? 14 : 7

    async function handleClick(lat: number, lng: number) {
        if (busy) return
        setBusy(true)
        setErr(null)
        try {
            const displayName = await reverseGeocode(lat, lng)
            onPick({ displayName, lat, lng })
        } catch {
            setErr("Greška pri dohvaćanju adrese.")
        } finally {
            setBusy(false)
        }
    }

    return (
        <Box
            position="relative"
            h={height as any}
            minH={minH as any}
            rounded="md"
            overflow="hidden"
            borderWidth="1px"
            borderColor="border.subtle"
        >
            <MapContainer
                center={center}
                zoom={zoom}
                style={{ height: "100%", width: "100%" }}
                scrollWheelZoom={false}
            >
                <TileLayer
                    attribution='&copy; OpenStreetMap'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <ClickHandler onClick={handleClick} />
                {/* RecenterOnValue keeps the map's view in sync with the
                    pin position. Without this, react-leaflet only uses
                    `center`/`zoom` on first mount — picking a suggestion
                    from LocationAutocomplete would move the marker
                    off-screen and the user would have to pan manually
                    to find it. */}
                <RecenterOnValue value={value ?? null} />
                {value && (
                    <Marker
                        position={[value.lat, value.lng]}
                        icon={PICKER_PIN_ICON}
                    />
                )}
            </MapContainer>

            {/* Click-prompt overlay — small hint at the top so the user
                knows the map is interactive without crowding the tiles. */}
            <Box
                position="absolute"
                top="2"
                left="2"
                bg="bg"
                px="2"
                py="1"
                rounded="md"
                shadow="sm"
                fontSize="xs"
                color="fg.muted"
                pointerEvents="none"
                zIndex={400}
            >
                Klikni na kartu za odabir lokacije
            </Box>

            {busy && (
                <Box
                    position="absolute"
                    inset="0"
                    bg="blackAlpha.300"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    pointerEvents="none"
                    zIndex={500}
                >
                    <Text bg="bg" px="3" py="1" rounded="md" fontSize="sm" shadow="md">
                        Tražim adresu…
                    </Text>
                </Box>
            )}
            {err && (
                <Box
                    position="absolute"
                    bottom="2"
                    left="2"
                    right="2"
                    bg="red.subtle"
                    color="red.fg"
                    px="3"
                    py="1"
                    rounded="md"
                    fontSize="xs"
                    zIndex={500}
                >
                    {err}
                </Box>
            )}
        </Box>
    )
}

/**
 * Leaflet click listener. Has to be a child of <MapContainer> because
 * useMapEvents pulls from the map context; rendering it as a sibling
 * silently does nothing.
 */
function ClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
    useMapEvents({
        click(e) {
            onClick(e.latlng.lat, e.latlng.lng)
        },
    })
    return null
}

/**
 * Imperatively re-centres the map every time {@code value} changes. The
 * {@code <MapContainer>} `center` prop is only honoured on first mount
 * — react-leaflet specifically does NOT reactively call setView when
 * the prop updates, to avoid fighting with user-driven pans. We get
 * around that by reaching into the map instance via {@link useMap} and
 * calling {@code setView} ourselves whenever the picked location moves.
 *
 * <p>Triggers when:
 *   - user picks an autocomplete suggestion (parent updates pickedCoords),
 *   - user clicks the map (we already pan via the click handler's
 *     reverse-geocode flow; this just keeps the two paths consistent).
 *
 * <p>Zoom is bumped to 14 only when transitioning from "no pin" → "pin"
 * so a user who picks something halfway-zoomed-in doesn't get yanked
 * back to street-level after every drag.
 */
function RecenterOnValue({ value }: { value: { lat: number; lng: number } | null }) {
    const map = useMap()
    useEffect(() => {
        if (!value) return
        const currentZoom = map.getZoom()
        // Keep the user's current zoom unless they're at the default
        // "no pin yet" zoom level — then jump to a sensible street-level
        // view so the marker isn't a needle in a country-wide haystack.
        const targetZoom = currentZoom < 10 ? 14 : currentZoom
        map.setView([value.lat, value.lng], targetZoom, { animate: true })
    }, [map, value?.lat, value?.lng])
    return null
}

/**
 * Reverse geocode lat/lng to a Nominatim display_name. Matches the
 * forward-search Accept-Language + addressdetails so the resulting
 * string formats the same way as picks from {@link LocationAutocomplete}.
 *
 * <p>Nominatim's usage policy asks for ≤ 1 request/second per user. The
 * picker is throttled implicitly because the user has to click + wait
 * for the reverse geocode to resolve before they can click again, so
 * we don't need an explicit rate limiter.
 */
async function reverseGeocode(lat: number, lng: number): Promise<string> {
    const url =
        `https://nominatim.openstreetmap.org/reverse?format=json` +
        `&lat=${lat}&lon=${lng}` +
        `&accept-language=hr` +
        `&zoom=18&addressdetails=1`
    const res = await fetch(url, { headers: { Accept: "application/json" } })
    if (!res.ok) throw new Error(`Nominatim reverse ${res.status}`)
    const data = await res.json()
    return (data?.display_name as string) ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`
}
