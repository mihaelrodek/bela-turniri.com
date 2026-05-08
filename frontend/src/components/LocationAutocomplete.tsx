import React, { useEffect, useMemo, useRef, useState } from "react"
import { Box, chakra, HStack, Input, Spinner, Text, VStack } from "@chakra-ui/react"
import { FiMapPin } from "react-icons/fi"

type NominatimResult = {
    place_id: number
    display_name: string
    lat: string
    lon: string
    type?: string
    addresstype?: string
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
 * Free-form text input with location suggestions powered by OpenStreetMap
 * Nominatim. The user can either pick a suggestion (which fills the input
 * with the formatted address and reports lat/lng to the parent) or keep
 * typing freely and submit any string — picking is not required.
 *
 * Nominatim usage policy compliance:
 *   - debounced 350ms so we don't fire one request per keystroke
 *   - response cache keyed by lowercased query keeps repeats free
 *   - results limited to 5 entries and to local-region country codes
 *   - browser sets a User-Agent automatically (the Referer is also fine
 *     per their policy for browser apps)
 */
export function LocationAutocomplete({
    value,
    onChange,
    onPickSuggestion,
    placeholder,
    disabled,
}: {
    value: string
    /** Called on every keystroke and when a suggestion is picked. */
    onChange: (value: string) => void
    /** Called when the user actually picks a suggestion (gives lat/lng). */
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

    // Debounced fetch
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

            const url =
                `${NOMINATIM_URL}?format=json&limit=5` +
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

    // Close on outside click
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
        onChange(r.display_name)
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
            onPickSuggestion?.({ displayName: r.display_name, latitude: lat, longitude: lng })
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
                    zIndex={50}
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
                                        <Text fontSize="sm" lineHeight="short">
                                            {r.display_name}
                                        </Text>
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
