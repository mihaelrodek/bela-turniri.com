import React, { useEffect, useMemo, useRef, useState } from "react"
import { Box, chakra, HStack, Input, Spinner, Text, VStack } from "@chakra-ui/react"
import { FiMapPin } from "react-icons/fi"

type NominatimAddress = {
    house_number?: string
    road?: string
    village?: string
    hamlet?: string
    suburb?: string
    neighbourhood?: string
    town?: string
    city?: string
    municipality?: string
    county?: string
    state?: string
    country?: string
    postcode?: string
}

type NominatimResult = {
    place_id: number
    display_name: string
    lat: string
    lon: string
    type?: string
    addresstype?: string
    address?: NominatimAddress
}

export type LocationSuggestion = {
    displayName: string
    latitude: number
    longitude: number
}

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
const COUNTRY_CODES = "hr,ba,si,rs,me"
const MIN_CHARS = 3
const DEBOUNCE_MS = 350

/**
 * Build a short, human-friendly label from a Nominatim address. We deliberately
 * drop postcode, county, and country because:
 *  - Tournament locations are within HR/BA/SI/RS/ME (already filtered) so the
 *    country is redundant.
 *  - Postcodes and counties bloat the label without helping a player decide
 *    whether they want to attend ("Kamenica, Grad Lepoglava" is enough).
 *  - The same string ends up in WhatsApp shares (og:title), where length
 *    matters even more.
 *
 * Order of preference for the "place" part:
 *   village → hamlet → suburb → neighbourhood → town → city
 * Then we append the municipality (or city/town as fallback) when it's
 * different from the place itself.
 */
export function formatNominatimAddress(r: NominatimResult): string {
    const a = r.address
    if (!a) return r.display_name

    const place =
        a.village ?? a.hamlet ?? a.suburb ?? a.neighbourhood ?? a.town ?? a.city
    const region = a.municipality ?? a.city ?? a.town

    if (place && region && place.toLowerCase() !== region.toLowerCase()) {
        return `${place}, ${region}`
    }
    if (place) return place
    if (region) return region

    // No usable structured fields — fall back to the first 2 segments of
    // the long display_name, which still trims country/postcode tail.
    const parts = r.display_name.split(",").map((s) => s.trim()).filter(Boolean)
    return parts.slice(0, 2).join(", ") || r.display_name
}

/**
 * Pull a house number out of free-form user input.
 *
 * <p>Croatian addresses put the number after the street name
 * ("Soblinečka ulica 88"), so we take the LAST number-ish token in the
 * string. Handles plain numbers, letter suffixes ("88a") and slash
 * forms ("88/2"). Returns null when there's no number at all (the user
 * searched a bare street, a square, or a town).
 *
 * <p>Taking the *last* token is what makes "Ulica 8. svibnja 88" work —
 * the street name's own "8" is earlier in the string, the house number
 * "88" is last. The companion check in {@link spliceHouseNumber} guards
 * the remaining edge case (a bare "Ulica 8. svibnja" with no house
 * number) by refusing to append a token already present in the street.
 */
function extractHouseNumber(input: string): string | null {
    const matches = input.match(/\b\d+[a-zA-Z]?(?:\/\d+[a-zA-Z]?)?\b/g)
    if (!matches || matches.length === 0) return null
    return matches[matches.length - 1]
}

/**
 * Decide the address string to commit when the user picks a Nominatim
 * result.
 *
 * <p>The problem this solves: OpenStreetMap's house-number coverage in
 * Croatia is patchy — many streets are mapped as geometry only, with no
 * per-building address points. A search for "Ulica X 88" then resolves
 * to the street itself and the number the user typed is silently lost.
 *
 * <p>Fix: if Nominatim resolved a house number on its own, trust it and
 * use {@code display_name} untouched. Otherwise — when the result is a
 * plain street and the user typed a number — splice that number in
 * after the street name (the first comma-segment of display_name). The
 * coordinates remain street-level, which is accurate enough to drop a
 * tournament venue on the correct street.
 *
 * <p>Guard: if the typed number already appears in the street-name
 * segment (street names like "Ulica 8. svibnja" contain digits), we
 * leave the label alone so we don't double it up.
 */
function spliceHouseNumber(r: NominatimResult, userInput: string): string {
    // Nominatim already gave us a building-level hit — nothing to do.
    if (r.address?.house_number) return r.display_name
    // Only streets get the splice; appending a number onto a city or
    // POI name would be nonsense.
    if (r.addresstype !== "road") return r.display_name

    const typedHn = extractHouseNumber(userInput)
    if (!typedHn) return r.display_name

    const segments = r.display_name.split(",").map((s) => s.trim()).filter(Boolean)
    if (segments.length === 0) return r.display_name

    const escaped = typedHn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    if (new RegExp(`(^|\\s)${escaped}(\\s|$)`).test(segments[0])) {
        // The number is part of the street name, not a house number.
        return r.display_name
    }

    segments[0] = `${segments[0]} ${typedHn}`
    return segments.join(", ")
}

/**
 * Headline label for a suggestion row in the dropdown.
 *
 * <p>For a plain place (village / town) this is the existing
 * place-then-region format. For a street result we headline the street
 * itself (with the house number that will be committed, typed or
 * OSM-resolved) — that's what the user is actually searching for, and
 * it makes the dropdown WYSIWYG with what {@link spliceHouseNumber}
 * commits on pick.
 */
function dropdownPrimary(r: NominatimResult, userInput: string): string {
    if (r.addresstype === "road" && r.address?.road) {
        // First comma-segment of the spliced address is "Road [number]".
        const firstSeg = spliceHouseNumber(r, userInput).split(",")[0]?.trim()
        const place =
            r.address.village ?? r.address.town ?? r.address.city
            ?? r.address.municipality ?? r.address.suburb
        if (firstSeg && place) return `${firstSeg}, ${place}`
        if (firstSeg) return firstSeg
    }
    return formatNominatimAddress(r)
}

/**
 * Free-form text input with location suggestions powered by OpenStreetMap
 * Nominatim. The user can either pick a suggestion (which fills the input
 * with the formatted address and reports lat/lng to the parent) or keep
 * typing freely and submit any string — picking is not required.
 */
export function LocationAutocomplete({
    value,
    onChange,
    onPickSuggestion,
    placeholder,
    disabled,
}: {
    value: string
    onChange: (value: string) => void
    onPickSuggestion?: (s: LocationSuggestion) => void
    placeholder?: string
    disabled?: boolean
}) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [results, setResults] = useState<NominatimResult[]>([])
    const [activeIndex, setActiveIndex] = useState<number>(-1)

    const cache = useRef<Map<string, NominatimResult[]>>(new Map())
    const wrapperRef = useRef<HTMLDivElement | null>(null)
    const abortRef = useRef<AbortController | null>(null)

    const query = useMemo(() => value.trim(), [value])

    useEffect(() => {
        if (query.length < MIN_CHARS) {
            setResults([])
            setError(null)
            return
        }
        const key = query.toLowerCase()
        const cached = cache.current.get(key)
        if (cached) {
            setResults(cached)
            setError(null)
            return
        }

        const handle = setTimeout(() => {
            abortRef.current?.abort()
            const controller = new AbortController()
            abortRef.current = controller

            setLoading(true)
            setError(null)

            // limit=10 (was 5): a free-form query like a café name or a
            // street + house number is often ranked below more generic
            // city/village hits, so a 5-result cap was silently dropping
            // the exact venue the organiser was looking for. dedupe=1
            // collapses near-identical OSM entries (same place mapped as
            // both a node and a way) so the extra slots show genuinely
            // different places, not duplicates.
            const url =
                `${NOMINATIM_URL}?format=json&limit=10&dedupe=1` +
                `&addressdetails=1` +
                `&countrycodes=${encodeURIComponent(COUNTRY_CODES)}` +
                `&accept-language=hr` +
                `&q=${encodeURIComponent(query)}`

            fetch(url, {
                signal: controller.signal,
                headers: { "Accept": "application/json" },
            })
                .then((r) => {
                    if (!r.ok) throw new Error(`Nominatim ${r.status}`)
                    return r.json() as Promise<NominatimResult[]>
                })
                .then((data) => {
                    cache.current.set(key, data)
                    setResults(data)
                    setActiveIndex(-1)
                })
                .catch((e) => {
                    if (e?.name === "AbortError") return
                    setError("Greška pri dohvaćanju prijedloga.")
                    setResults([])
                })
                .finally(() => setLoading(false))
        }, DEBOUNCE_MS)

        return () => clearTimeout(handle)
    }, [query])

    useEffect(() => {
        function onDocClick(e: MouseEvent) {
            if (!wrapperRef.current) return
            if (!wrapperRef.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener("mousedown", onDocClick)
        return () => document.removeEventListener("mousedown", onDocClick)
    }, [])

    function pick(r: NominatimResult) {
        const lat = parseFloat(r.lat)
        const lng = parseFloat(r.lon)
        // Fill the input with Nominatim's full display_name — postcode,
        // county, country and all. The verbose form gives WhatsApp shares
        // and the map pin enough context to be unambiguous, and the user
        // can always trim it manually afterwards.
        //
        // spliceHouseNumber keeps the house number the user typed when
        // OSM only had street-level data (common for Croatian addresses
        // — see the helper's docstring). `value` is the current raw
        // input, so whatever number the user typed before clicking is
        // preserved in the committed address.
        const displayName = spliceHouseNumber(r, value)
        onChange(displayName)
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
            onPickSuggestion?.({ displayName, latitude: lat, longitude: lng })
        }
        setOpen(false)
    }

    function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (!open || results.length === 0) return
        if (e.key === "ArrowDown") {
            e.preventDefault()
            setActiveIndex((i) => Math.min(results.length - 1, i + 1))
        } else if (e.key === "ArrowUp") {
            e.preventDefault()
            setActiveIndex((i) => Math.max(0, i - 1))
        } else if (e.key === "Enter") {
            if (activeIndex >= 0 && activeIndex < results.length) {
                e.preventDefault()
                pick(results[activeIndex])
            }
        } else if (e.key === "Escape") {
            setOpen(false)
        }
    }

    const showDropdown =
        open &&
        query.length >= MIN_CHARS &&
        (loading || results.length > 0 || error)

    return (
        <Box position="relative" ref={wrapperRef} w="full">
            <Input
                value={value}
                onChange={(e) => {
                    onChange(e.target.value)
                    setOpen(true)
                }}
                onFocus={() => setOpen(true)}
                onKeyDown={onKeyDown}
                placeholder={placeholder}
                disabled={disabled}
                autoComplete="off"
            />

            {showDropdown && (
                <Box
                    position="absolute"
                    top="calc(100% + 4px)"
                    left="0"
                    right="0"
                    // Must beat Leaflet's internal pane stack (controls go
                    // up to 1000) so the suggestions dropdown floats over
                    // the map picker that sits next to this input on the
                    // create-tournament form. 1100 also keeps us under any
                    // application-level modal (Chakra Dialog uses ~1400),
                    // so a dialog opened from within the form still wins.
                    zIndex={1100}
                    bg="bg"
                    borderWidth="1px"
                    borderColor="border.emphasized"
                    rounded="md"
                    shadow="lg"
                    maxH="280px"
                    overflowY="auto"
                >
                    {loading && (
                        <HStack px="3" py="2" gap="2" color="fg.muted" fontSize="sm">
                            <Spinner size="xs" />
                            <Text>Tražim…</Text>
                        </HStack>
                    )}

                    {!loading && error && (
                        <Text px="3" py="2" color="red.fg" fontSize="sm">{error}</Text>
                    )}

                    {!loading && !error && results.length === 0 && (
                        <Text px="3" py="2" color="fg.muted" fontSize="sm">
                            Nema rezultata.
                        </Text>
                    )}

                    {!loading && !error && results.length > 0 && (
                        <VStack align="stretch" gap="0">
                            {results.map((r, i) => (
                                <chakra.button
                                    key={r.place_id}
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => pick(r)}
                                    onMouseEnter={() => setActiveIndex(i)}
                                    px="3"
                                    py="2"
                                    textAlign="left"
                                    width="full"
                                    bg={i === activeIndex ? "bg.muted" : "transparent"}
                                    cursor="pointer"
                                    borderTopWidth={i === 0 ? "0" : "1px"}
                                    borderColor="border.subtle"
                                    _hover={{ bg: "bg.muted" }}
                                >
                                    <HStack gap="2" align="start">
                                        <Box color="fg.muted" mt="0.5" flexShrink={0}>
                                            <FiMapPin size={12} />
                                        </Box>
                                        <VStack gap="0" align="stretch" flex="1" minW="0">
                                            <Text fontSize="sm" lineHeight="short">
                                                {dropdownPrimary(r, value)}
                                            </Text>
                                            <Text
                                                fontSize="2xs"
                                                color="fg.muted"
                                                lineHeight="short"
                                                truncate
                                            >
                                                {spliceHouseNumber(r, value)}
                                            </Text>
                                        </VStack>
                                    </HStack>
                                </chakra.button>
                            ))}
                        </VStack>
                    )}
                </Box>
            )}
        </Box>
    )
}
