import React, { useEffect, useMemo, useRef, useState } from "react"
import { Box, chakra, HStack, Input, Spinner, Text, VStack } from "@chakra-ui/react"
import { FiMapPin } from "react-icons/fi"
import { useTranslation } from "../i18n"
import {
    googlePlacesEnabled,
    MIN_QUERY_CHARS,
    newSessionToken,
    resolveSuggestion,
    searchPlaces,
    type LocationSuggestion,
    type SearchOutcome,
    type SuggestionRow,
} from "../utils/places"

export type { LocationSuggestion }

const DEBOUNCE_MS = 350

/**
 * Free-form text input with location suggestions. Backed by Google Places
 * (New) when `VITE_GOOGLE_MAPS_API_KEY` is set and by OpenStreetMap Nominatim
 * otherwise — see `utils/places.ts`; this component only renders whatever rows
 * the provider returned. The user can either pick a suggestion (which fills
 * the input with the formatted address and reports lat/lng to the parent) or
 * keep typing freely and submit any string — picking is not required.
 *
 * <p>Props are unchanged from the Nominatim-only version, so
 * `CreateTournamentPage` and `DetailsEditForm` need no edit.
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
    const { t, locale } = useTranslation()
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [outcome, setOutcome] = useState<SearchOutcome>({ provider: "nominatim", rows: [] })
    const [activeIndex, setActiveIndex] = useState<number>(-1)

    const cache = useRef<Map<string, SearchOutcome>>(new Map())
    const wrapperRef = useRef<HTMLDivElement | null>(null)
    const abortRef = useRef<AbortController | null>(null)

    // One Places session token spans every keystroke plus the single details
    // call on pick — that is what makes Google bill the whole interaction as
    // ONE autocomplete session. It is minted lazily on the first query and
    // discarded right after the details call (see `pick`), because reusing a
    // spent token silently restarts per-request billing.
    const sessionRef = useRef<string | null>(null)

    // Keep the raw input in a ref so `pick` (called from an event handler that
    // may run after a re-render) always splices the house number the user
    // actually typed.
    const inputRef = useRef(value)
    inputRef.current = value

    const query = useMemo(() => value.trim(), [value])
    const rows = outcome.rows

    useEffect(() => {
        if (query.length < MIN_QUERY_CHARS) {
            setOutcome({ provider: "nominatim", rows: [] })
            setError(null)
            return
        }
        const key = `${locale}|${query.toLowerCase()}`
        const cached = cache.current.get(key)
        if (cached) {
            setOutcome(cached)
            setError(null)
            return
        }

        const handle = setTimeout(() => {
            abortRef.current?.abort()
            const controller = new AbortController()
            abortRef.current = controller

            if (!sessionRef.current) sessionRef.current = newSessionToken()

            setLoading(true)
            setError(null)

            searchPlaces({
                query,
                userInput: inputRef.current,
                locale,
                sessionToken: sessionRef.current,
                signal: controller.signal,
            })
                .then((result) => {
                    cache.current.set(key, result)
                    setOutcome(result)
                    setActiveIndex(-1)
                })
                .catch((e) => {
                    if (e?.name === "AbortError") return
                    setError(t("common.location.fetchError"))
                    setOutcome({ provider: "nominatim", rows: [] })
                })
                .finally(() => setLoading(false))
        }, DEBOUNCE_MS)

        return () => clearTimeout(handle)
        // `t` is a fresh closure every render (see i18n/index.ts) — depending on
        // it would re-fire the debounced fetch on every render, not just when
        // the query changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query, locale])

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

    function pick(row: SuggestionRow) {
        // Optimistically commit the label we already show, so the input never
        // sits empty while Google's details call is in flight; the resolved
        // string (which carries the full postal address) overwrites it.
        const optimistic = [row.primary, row.secondary].filter(Boolean).join(", ")
        onChange(optimistic)
        setOpen(false)

        const sessionToken = sessionRef.current ?? newSessionToken()
        // Spent: the details call closes the billing session.
        sessionRef.current = null

        resolveSuggestion(row, { userInput: inputRef.current, sessionToken })
            .then((picked) => {
                if (!picked) return
                onChange(picked.displayName)
                onPickSuggestion?.(picked)
            })
            .catch(() => setError(t("common.location.fetchError")))
    }

    function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (!open || rows.length === 0) return
        if (e.key === "ArrowDown") {
            e.preventDefault()
            setActiveIndex((i) => Math.min(rows.length - 1, i + 1))
        } else if (e.key === "ArrowUp") {
            e.preventDefault()
            setActiveIndex((i) => Math.max(0, i - 1))
        } else if (e.key === "Enter") {
            if (activeIndex >= 0 && activeIndex < rows.length) {
                e.preventDefault()
                pick(rows[activeIndex])
            }
        } else if (e.key === "Escape") {
            setOpen(false)
        }
    }

    const showDropdown =
        open &&
        query.length >= MIN_QUERY_CHARS &&
        (loading || rows.length > 0 || error)

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
                placeholder={placeholder ?? t("common.location.searchPlaceholder")}
                aria-label={placeholder ?? t("common.location.searchPlaceholder")}
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
                            <Text>{t("common.location.searching")}</Text>
                        </HStack>
                    )}

                    {!loading && error && (
                        <Text px="3" py="2" color="red.fg" fontSize="sm">{error}</Text>
                    )}

                    {!loading && !error && rows.length === 0 && (
                        <Text px="3" py="2" color="fg.muted" fontSize="sm">
                            {t("common.location.noResults")}
                        </Text>
                    )}

                    {!loading && !error && rows.length > 0 && (
                        <VStack align="stretch" gap="0">
                            {rows.map((r, i) => (
                                <chakra.button
                                    key={r.key}
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
                                                {r.primary}
                                            </Text>
                                            <Text
                                                fontSize="2xs"
                                                color="fg.muted"
                                                lineHeight="short"
                                                truncate
                                            >
                                                {r.secondary}
                                            </Text>
                                        </VStack>
                                    </HStack>
                                </chakra.button>
                            ))}
                        </VStack>
                    )}

                    {/* Google's Places ToS require a visible "Powered by Google"
                        credit whenever predictions are shown OUTSIDE a Google
                        map — which is exactly our case (Leaflet + CARTO tiles).
                        Only rendered when the rows actually came from Google. */}
                    {googlePlacesEnabled() && outcome.provider === "google" && rows.length > 0 && (
                        <Text
                            px="3"
                            py="1"
                            fontSize="2xs"
                            color="fg.muted"
                            textAlign="right"
                            borderTopWidth="1px"
                            borderColor="border.subtle"
                        >
                            {t("common.location.poweredByGoogle")}
                        </Text>
                    )}
                </Box>
            )}
        </Box>
    )
}
