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
import { useTranslation } from "../i18n"
import { mapTiles } from "../utils/mapTiles"
import { reverseGeocode } from "../utils/places"

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
 *
 * <p>The colours are literal hexes on purpose: this markup is handed to
 * Leaflet, i.e. it never passes through Chakra's style engine, and the pin
 * sits on map tiles rather than an app surface, so it must not follow the
 * light/dark flip.
 */
const PICKER_PIN_ICON = L.divIcon({
    html: `<svg width="28" height="38" viewBox="0 0 28 38" xmlns="http://www.w3.org/2000/svg">
             <path d="M14 0C6.27 0 0 6.27 0 14c0 9.5 13 22.5 13.5 23a1 1 0 0 0 1 0C15 36.5 28 23.5 28 14c0-7.73-6.27-14-14-14z"
                   fill="#227342" stroke="white" stroke-width="2"/>
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
 * <p>Reverse geocoding stays on OSM Nominatim (`utils/places.ts`) even when
 * the forward autocomplete runs on Google: Google reverse geocoding is a
 * separate, pricier API and a map click is rare next to typing. The shared
 * formatter there gives a click the same "Name, Street 1, 12345 City" shape a
 * typed pick commits, so the two paths remain indistinguishable downstream.
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
    const { t } = useTranslation()
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
            setErr(t("common.location.reverseGeocodeError"))
        } finally {
            setBusy(false)
        }
    }

    return (
        <Box
            position="relative"
            h={height}
            minH={minH}
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
                {/* Basemap comes from utils/mapTiles.ts so both this picker
                    and /karta follow the same (env-overridable) provider. */}
                <TileLayer
                    attribution={mapTiles.attribution}
                    url={mapTiles.url}
                    maxZoom={mapTiles.maxZoom}
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

            {/* Click-prompt overlay — top RIGHT, not left: Leaflet renders its
                zoom control at the top left with a higher z-index, so a hint
                anchored there is partly hidden behind the +/- buttons. */}
            <Box
                position="absolute"
                top="2"
                right="2"
                maxW="calc(100% - 5rem)"
                textAlign="right"
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
                {t("common.location.clickHint")}
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
                        {t("common.location.searchingAddress")}
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
