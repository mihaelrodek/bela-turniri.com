import { useEffect, useMemo, useState } from "react"
import {
    Badge,
    Box,
    Button,
    Card,
    Heading,
    HStack,
    IconButton,
    Image,
    Input,
    Skeleton,
    Slider,
    Stack,
    Text,
    VStack,
} from "@chakra-ui/react"
import { Link as RouterLink } from "react-router-dom"
import { FiCalendar, FiChevronDown, FiChevronUp, FiClock, FiFilter, FiNavigation, FiPlus, FiSearch, FiUsers, FiX } from "react-icons/fi"
import type { TournamentCard } from "../types/tournaments"
import { fetchTournaments, fetchTournamentsCount } from "../api/tournaments"
import { useUserLocation } from "../hooks/useUserLocation"
import { haversineKm } from "../utils/distance"
import { useDocumentHead } from "../hooks/useDocumentHead"

/** The list DTO now includes a public UUID you want to route with */
type TournamentCardWithUuid = TournamentCard & { uuid: string }

// ---------- formatters ----------
function formatDate(iso?: string | null) {
    if (!iso) return "—"
    const d = new Date(iso)
    return new Intl.DateTimeFormat("hr-HR", {
        weekday: "short",
        day: "2-digit",
        month: "short",
    }).format(d)
}
function formatTime(iso?: string | null) {
    if (!iso) return "—"
    const d = new Date(iso)
    return new Intl.DateTimeFormat("hr-HR", {
        hour: "2-digit",
        minute: "2-digit",
    }).format(d)
}
function fmtEuro(n?: number | null) {
    if (typeof n !== "number" || !isFinite(n)) return null
    const s = n.toFixed(2)
    const trimmed = s.endsWith(".00") ? s.slice(0, -3) : s
    return `${trimmed}€`
}

/** Compact "Danas" / "Sutra" / "Za N dana" relative label, hr-HR. */
function relativeDays(iso?: string | null): string | null {
    if (!iso) return null
    const startMs = new Date(iso).setHours(0, 0, 0, 0)
    const todayMs = new Date().setHours(0, 0, 0, 0)
    const diff = Math.round((startMs - todayMs) / (24 * 60 * 60 * 1000))
    if (diff === 0) return "Danas"
    if (diff === 1) return "Sutra"
    if (diff > 1 && diff <= 14) return `Za ${diff} dana`
    return null
}

// ---------- subcomponents ----------

/** Image area with status badge overlays. */
function CardBanner({
                        t,
                        variant,
                    }: {
    t: TournamentCardWithUuid
    variant: "upcoming" | "finished"
}) {
    const isFull =
        typeof t.registeredPairs === "number" &&
        typeof t.maxPairs === "number" &&
        t.registeredPairs >= t.maxPairs

    const relative = relativeDays(t.startAt)

    return (
        <Box
            position="relative"
            bg="bg.muted"
            h={{ base: "130px", md: "140px" }}
            overflow="hidden"
        >
            {t.bannerUrl ? (
                <Image
                    src={t.bannerUrl}
                    alt={t.name}
                    w="100%"
                    h="100%"
                    objectFit="cover"
                    objectPosition="top center"
                    draggable={false}
                    style={
                        variant === "finished"
                            ? { filter: "grayscale(0.6) brightness(0.92)" }
                            : undefined
                    }
                />
            ) : (
                <Box
                    w="100%"
                    h="100%"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                >
                    <Text color="fg.muted" fontSize="xs">Nema plakata</Text>
                </Box>
            )}

            {/* Top-right: date pill */}
            {t.startAt && (
                <Box
                    position="absolute"
                    top="2"
                    right="2"
                    bg="blackAlpha.700"
                    color="white"
                    px="2"
                    py="0.5"
                    rounded="md"
                    fontSize="xs"
                    fontWeight="medium"
                    backdropFilter="blur(4px)"
                >
                    {formatDate(t.startAt)}
                </Box>
            )}

            {/* Top-left: status badge */}
            <Box position="absolute" top="2" left="2">
                {variant === "finished" ? (
                    <Badge size="sm" colorPalette="gray" variant="solid">
                        Završen
                    </Badge>
                ) : isFull ? (
                    <Badge size="sm" colorPalette="orange" variant="solid">
                        Mjesta puna
                    </Badge>
                ) : relative ? (
                    <Badge size="sm" colorPalette="blue" variant="solid">
                        {relative}
                    </Badge>
                ) : (
                    <Badge size="sm" colorPalette="blue" variant="solid">
                        Nadolazeći
                    </Badge>
                )}
            </Box>
        </Box>
    )
}

/** Single tournament card. Whole card is the link, no nested links inside. */
function TournamentCardView({
                                t,
                                variant,
                            }: {
    t: TournamentCardWithUuid
    variant: "upcoming" | "finished"
}) {
    const price = fmtEuro(t.entryPrice)
    const rep = fmtEuro(t.repassagePrice)
    const priceBlock = price ? (rep ? `${price} + ${rep}` : price) : null

    const winner = (t.winnerName ?? "").trim()

    return (
        <RouterLink
            to={`/turniri/${t.slug ?? t.uuid}`}
            style={{ display: "block", textDecoration: "none", color: "inherit" }}
        >
            <Box
                borderWidth="1px"
                borderColor="border.emphasized"
                rounded="xl"
                overflow="hidden"
                bg="bg"
                shadow="sm"
                transition="transform .15s ease, box-shadow .15s ease, border-color .15s ease"
                _hover={{
                    shadow: "md",
                    transform: "translateY(-2px)",
                    borderColor: "border.emphasized",
                }}
                h="full"
                display="flex"
                flexDirection="column"
            >
                <CardBanner t={t} variant={variant} />

                <VStack align="stretch" gap="2" p="3" flex="1">
                    <Text
                        fontWeight="semibold"
                        fontSize={{ base: "sm", md: "md" }}
                        lineHeight="short"
                    >
                        {t.name}
                    </Text>

                    {variant === "finished" && winner && (
                        <HStack gap="1.5" align="center">
                            <Text fontSize="xs" color="fg.muted">Pobjednici -</Text>
                            <Badge size="sm" colorPalette="yellow" variant="subtle">
                                {winner}
                            </Badge>
                        </HStack>
                    )}

                    <HStack
                        gap="3"
                        rowGap="1"
                        wrap="wrap"
                        fontSize="xs"
                        color="fg.muted"
                        mt="auto"
                    >
                        {t.startAt && (
                            <HStack gap="1">
                                <FiClock />
                                <Text>{formatTime(t.startAt)}</Text>
                            </HStack>
                        )}
                        {priceBlock && <Text>{priceBlock}</Text>}
                        {typeof t.registeredPairs === "number" && (
                            <HStack gap="1">
                                <FiUsers />
                                <Text>
                                    {t.registeredPairs}
                                    {typeof t.maxPairs === "number" ? ` / ${t.maxPairs}` : ""}
                                </Text>
                            </HStack>
                        )}
                    </HStack>
                </VStack>
            </Box>
        </RouterLink>
    )
}

/** Loading skeleton matching the card shape. */
function CardSkeleton() {
    return (
        <Box
            borderWidth="1px"
            borderColor="border.emphasized"
            rounded="xl"
            overflow="hidden"
        >
            <Skeleton h={{ base: "130px", md: "140px" }} />
            <VStack align="stretch" gap="2" p="3">
                <Skeleton h="4" w="70%" />
                <Skeleton h="3" w="50%" />
            </VStack>
        </Box>
    )
}

/** Empty state with optional CTA. */
function EmptyState({
                        title,
                        description,
                        cta,
                    }: {
    title: string
    description?: string
    cta?: React.ReactNode
}) {
    return (
        <Box
            borderWidth="1px"
            borderColor="border.emphasized"
            borderStyle="dashed"
            rounded="xl"
            py="10"
            px="6"
        >
            <VStack gap="2">
                <Box color="fg.muted">
                    <FiCalendar size={24} />
                </Box>
                <Text fontWeight="medium">{title}</Text>
                {description && (
                    <Text color="fg.muted" fontSize="sm" textAlign="center">
                        {description}
                    </Text>
                )}
                {cta && <Box mt="2">{cta}</Box>}
            </VStack>
        </Box>
    )
}

// ---------- page ----------
const FINISHED_PREVIEW_LIMIT = 6

export default function TournamentsPage() {
    useDocumentHead({
        title: "Bela turniri u Hrvatskoj — bela-turniri.com",
        description:
            "Pregled svih nadolazećih i odigranih Bela turnira u Hrvatskoj i regiji. Pretraži po lokaciji, datumu i cijeni.",
        ogTitle: "Bela turniri u Hrvatskoj",
        ogDescription:
            "Pregled svih nadolazećih i odigranih Bela turnira u Hrvatskoj i regiji.",
        ogType: "website",
        canonical: "https://bela-turniri.com/turniri",
    })

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const [loadingFinished, setLoadingFinished] = useState(true)
    const [errorFinished, setErrorFinished] = useState<string | null>(null)

    const [upcoming, setUpcoming] = useState<TournamentCardWithUuid[]>([])
    const [finished, setFinished] = useState<TournamentCardWithUuid[]>([])
    // Finished list is paginated server-side — the initial fetch returns
    // FINISHED_PAGE_SIZE rows; "Učitaj više" appends the next page until
    // every finished tournament is loaded. finishedTotal lets us know when
    // there's nothing more to fetch.
    const [finishedTotal, setFinishedTotal] = useState(0)
    const [loadingMoreFinished, setLoadingMoreFinished] = useState(false)

    // ---- Search + filters (apply to upcoming) ----
    const [filtersOpen, setFiltersOpen] = useState(false) // not expanded by default
    const [search, setSearch] = useState("")
    const [locationFilter, setLocationFilter] = useState("")
    const [priceMin, setPriceMin] = useState("")
    const [priceMax, setPriceMax] = useState("")
    // Distance filter — always a number, applied when location is on.
    // The slider goes 1–500 km so the upper bound effectively means
    // "everywhere in Croatia + neighbours". Default 100 is a sane
    // middle-ground that surfaces a comfortable handful of tournaments
    // without hiding nearby ones.
    const [radiusKm, setRadiusKm] = useState<number>(100)

    // User location (for nearby filter) — silently restored if previously granted
    const {
        pos: userPos,
        status: geoStatus,
        request: requestLocation,
    } = useUserLocation()

    const sanitizeNum = (s: string) => s.replace(/[^\d.,]/g, "").replace(",", ".")
    const parseNum = (s: string): number | null => {
        if (!s.trim()) return null
        const n = parseFloat(s)
        return Number.isFinite(n) ? n : null
    }
    // 500 km effectively means "show all" — don't count it as an active
    // filter chip when the user is at the slider's max.
    const activeFilterCount =
        (locationFilter.trim() ? 1 : 0) +
        (priceMin.trim() ? 1 : 0) +
        (priceMax.trim() ? 1 : 0) +
        (userPos && radiusKm < 500 ? 1 : 0)
    const resetFilters = () => {
        setSearch("")
        setLocationFilter("")
        setPriceMin("")
        setPriceMax("")
        setRadiusKm(500)
    }

    useEffect(() => {
        let cancelled = false
        ;(async () => {
            try {
                setLoading(true); setError(null)
                setLoadingFinished(true); setErrorFinished(null)

                // Fetch upcoming (no pagination — typically small), the
                // first page of finished, and the total finished count
                // (so we know whether to show the "Učitaj više" button).
                const [dataUpcoming, dataFinishedPage, finishedTotalCount] = await Promise.all([
                    fetchTournaments("upcoming"),
                    fetchTournaments("finished", { offset: 0, limit: FINISHED_PREVIEW_LIMIT }),
                    fetchTournamentsCount("finished"),
                ])

                if (!cancelled) {
                    setUpcoming(dataUpcoming as TournamentCardWithUuid[])
                    setFinished(dataFinishedPage as TournamentCardWithUuid[])
                    setFinishedTotal(finishedTotalCount)
                }
            } catch (e: any) {
                if (!cancelled) {
                    setError(e?.message ?? "Failed to load tournaments")
                    setErrorFinished(e?.message ?? "Failed to load finished tournaments")
                    setUpcoming([])
                    setFinished([])
                    setFinishedTotal(0)
                }
            } finally {
                if (!cancelled) {
                    setLoading(false)
                    setLoadingFinished(false)
                }
            }
        })()
        return () => { cancelled = true }
    }, [])

    /**
     * Append the next page of finished tournaments. Idempotent — re-clicking
     * "Učitaj više" while a fetch is in-flight is a no-op thanks to
     * loadingMoreFinished. We use the current length as the offset so the
     * server returns rows we don't already have.
     */
    async function loadMoreFinished() {
        if (loadingMoreFinished) return
        if (finished.length >= finishedTotal) return
        setLoadingMoreFinished(true)
        try {
            const next = await fetchTournaments("finished", {
                offset: finished.length,
                limit: FINISHED_PREVIEW_LIMIT,
            })
            setFinished((prev) => [...prev, ...(next as TournamentCardWithUuid[])])
        } catch {
            // Toast surfaces the error; no extra UI needed.
        } finally {
            setLoadingMoreFinished(false)
        }
    }

    const finishedHasMore = finished.length < finishedTotal

    // Apply search + filters to upcoming
    const filteredUpcoming = useMemo(() => {
        const q = search.trim().toLowerCase()
        const loc = locationFilter.trim().toLowerCase()
        const min = parseNum(priceMin)
        const max = parseNum(priceMax)
        const me = userPos ? { lat: userPos[0], lng: userPos[1] } : null
        return upcoming.filter((t) => {
            if (q && !t.name.toLowerCase().includes(q)) return false
            if (loc && !(t.location ?? "").toLowerCase().includes(loc)) return false
            if (typeof t.entryPrice === "number") {
                if (min != null && t.entryPrice < min) return false
                if (max != null && t.entryPrice > max) return false
            } else {
                // tournaments without a known entryPrice are filtered out only when a price filter is active
                if (min != null || max != null) return false
            }
            // Nearby filter. Always active when the user has their
            // location enabled — the slider just controls how wide the
            // circle is. 500 km is effectively "everywhere" in Croatia
            // + neighbours, so dragging to max disables the filter
            // visually. Tournaments without geocoded coords are excluded
            // when the filter is active because we can't know if they're
            // in range.
            if (me) {
                if (typeof t.latitude !== "number" || typeof t.longitude !== "number") {
                    if (radiusKm < 500) return false
                } else if (haversineKm(me, { lat: t.latitude, lng: t.longitude }) > radiusKm) {
                    return false
                }
            }
            return true
        })
    }, [upcoming, search, locationFilter, priceMin, priceMax, userPos, radiusKm])

    const isFiltering =
        search.trim().length > 0 || activeFilterCount > 0

    const gridCols = { base: "1fr", md: "1fr 1fr", lg: "1fr 1fr 1fr" }

    return (
        <VStack align="stretch" gap="8">
            {/* ===================== Upcoming ===================== */}
            <Box>
                {/* Single rounded card holding search, filter toggle, AND the
                    create-tournament CTA. Putting the button INSIDE the card
                    (instead of beside it) means on mobile all three controls
                    can sit on the same row when there's room, and the page
                    saves the visual height of the previously-separate button
                    block. */}
                {!loading && upcoming.length > 0 && (
                    <Card.Root
                        variant="outline"
                        rounded="xl"
                        borderColor="border.emphasized"
                        shadow="sm"
                        mb="4"
                    >
                        <Card.Body py="3" px={{ base: "3", md: "4" }}>
                            {/* Mobile: search on its own row; below it Filteri,
                                Očisti sve, and Kreiraj turnir share a flex row
                                so the create CTA never disappears below the
                                fold. Desktop: everything inline. */}
                            <Stack
                                direction={{ base: "column", md: "row" }}
                                gap="2"
                                align="stretch"
                            >
                                <Box position="relative" flex="1" minW={{ base: "100%", md: "260px" }}>
                                    <Box
                                        position="absolute"
                                        left="3"
                                        top="50%"
                                        style={{ transform: "translateY(-50%)" }}
                                        color="fg.muted"
                                        pointerEvents="none"
                                    >
                                        <FiSearch />
                                    </Box>
                                    <Input
                                        size={{ base: "md", md: "sm" }}
                                        pl="9"
                                        pr={search ? "9" : "3"}
                                        placeholder="Pretraži po imenu turnira…"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                    />
                                    {search && (
                                        <IconButton
                                            aria-label="Očisti pretragu"
                                            size="xs"
                                            variant="ghost"
                                            position="absolute"
                                            right="2"
                                            top="50%"
                                            style={{ transform: "translateY(-50%)" }}
                                            onClick={() => setSearch("")}
                                        >
                                            <FiX />
                                        </IconButton>
                                    )}
                                </Box>
                                <HStack gap="2" wrap="wrap">
                                    <Button
                                        size={{ base: "md", md: "sm" }}
                                        variant={activeFilterCount > 0 ? "solid" : "outline"}
                                        colorPalette={activeFilterCount > 0 ? "blue" : "gray"}
                                        onClick={() => setFiltersOpen((v) => !v)}
                                        aria-expanded={filtersOpen}
                                        title={filtersOpen ? "Sakrij filtere" : "Prikaži filtere"}
                                        flex={{ base: "1", md: "none" }}
                                    >
                                        <FiFilter /> Filteri
                                        {activeFilterCount > 0 && (
                                            <Badge ml="1" colorPalette="blue" variant="solid" size="sm">
                                                {activeFilterCount}
                                            </Badge>
                                        )}
                                        {filtersOpen ? <FiChevronUp /> : <FiChevronDown />}
                                    </Button>
                                    {isFiltering && (
                                        <Button
                                            size={{ base: "md", md: "sm" }}
                                            variant="ghost"
                                            onClick={resetFilters}
                                            flex={{ base: "1", md: "none" }}
                                        >
                                            Očisti sve
                                        </Button>
                                    )}
                                    {/* Create-tournament CTA — sits inline with
                                        the filter controls. Solid blue so the
                                        primary action stays visually distinct
                                        from the outlined Filteri button. */}
                                    <Button
                                        asChild
                                        size={{ base: "md", md: "sm" }}
                                        variant="solid"
                                        colorPalette="blue"
                                        flex={{ base: "1", md: "none" }}
                                    >
                                        <RouterLink to="/turniri/novi">
                                            <FiPlus /> Kreiraj turnir
                                        </RouterLink>
                                    </Button>
                                </HStack>
                            </Stack>

                            {filtersOpen && (
                                <>
                                    <Box
                                        mt="3"
                                        pt="3"
                                        borderTopWidth="1px"
                                        borderColor="border.emphasized"
                                        display="grid"
                                        gridTemplateColumns={{ base: "1fr", md: "1fr 1fr" }}
                                        gap="3"
                                    >
                                        <Box>
                                            <Text fontSize="xs" fontWeight="medium" color="fg.muted" mb="1">
                                                Lokacija
                                            </Text>
                                            <Input
                                                size="sm"
                                                placeholder="npr. Zagreb"
                                                value={locationFilter}
                                                onChange={(e) => setLocationFilter(e.target.value)}
                                            />
                                        </Box>
                                        <Box>
                                            <Text fontSize="xs" fontWeight="medium" color="fg.muted" mb="1">
                                                Kotizacija (€)
                                            </Text>
                                            <HStack gap="2">
                                                <Input
                                                    size="sm"
                                                    inputMode="decimal"
                                                    placeholder="od"
                                                    value={priceMin}
                                                    onChange={(e) => setPriceMin(sanitizeNum(e.target.value))}
                                                />
                                                <Text color="fg.muted">–</Text>
                                                <Input
                                                    size="sm"
                                                    inputMode="decimal"
                                                    placeholder="do"
                                                    value={priceMax}
                                                    onChange={(e) => setPriceMax(sanitizeNum(e.target.value))}
                                                />
                                            </HStack>
                                        </Box>
                                    </Box>

                                    {/* Nearby radius — draggable 1–500 km. Auto-applies
                                        on change. 500 means "show all" (covers all of
                                        Croatia + neighbours). Disabled until the user
                                        enables location. */}
                                    <Box mt="3">
                                        <HStack gap="2" mb="1.5" align="center" wrap="wrap">
                                            <Text fontSize="xs" fontWeight="medium" color="fg.muted">
                                                U krugu od:
                                            </Text>
                                            <Text fontSize="xs" fontWeight="semibold" color="blue.fg">
                                                {userPos
                                                    ? (radiusKm >= 500 ? "Sve" : `${radiusKm} km`)
                                                    : "—"}
                                            </Text>
                                            {!userPos && (
                                                <Button
                                                    size="xs"
                                                    variant="ghost"
                                                    colorPalette="blue"
                                                    onClick={requestLocation}
                                                    disabled={geoStatus === "asking" || geoStatus === "unsupported"}
                                                    loading={geoStatus === "asking"}
                                                >
                                                    <FiNavigation /> Uključi lokaciju
                                                </Button>
                                            )}
                                            {geoStatus === "denied" && (
                                                <Text fontSize="xs" color="fg.muted">
                                                    Lokacija je odbijena u pregledniku.
                                                </Text>
                                            )}
                                        </HStack>
                                        <Slider.Root
                                            min={1}
                                            max={500}
                                            step={1}
                                            value={[radiusKm]}
                                            onValueChange={(e) => setRadiusKm(e.value[0])}
                                            disabled={!userPos}
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
                                </>
                            )}
                        </Card.Body>
                    </Card.Root>
                )}

                {/* When upcoming.length === 0, no separate create button is
                    rendered here — the empty state below has its own inline
                    CTA so we don't double up. */}

                {loading ? (
                    <Box display="grid" gridTemplateColumns={gridCols} gap="4">
                        <CardSkeleton />
                        <CardSkeleton />
                        <CardSkeleton />
                    </Box>
                ) : upcoming.length === 0 ? (
                    <EmptyState
                        title={error ? "Nije moguće učitati turnire" : "Nema nadolazećih turnira"}
                        description={
                            error
                                ? error
                                : "Kreiraj turnir i počni primati prijave parova."
                        }
                        cta={
                            !error && (
                                <Button asChild size="sm" colorPalette="blue">
                                    <RouterLink to="/turniri/novi">
                                        <FiPlus /> Kreiraj turnir
                                    </RouterLink>
                                </Button>
                            )
                        }
                    />
                ) : filteredUpcoming.length === 0 ? (
                    <EmptyState
                        title="Nema rezultata"
                        description="Nijedan turnir ne odgovara odabranim filterima."
                        cta={
                            <Button size="sm" variant="outline" onClick={resetFilters}>
                                Očisti filtere
                            </Button>
                        }
                    />
                ) : (
                    <Box display="grid" gridTemplateColumns={gridCols} gap="4">
                        {filteredUpcoming.map((t) => (
                            <TournamentCardView key={t.uuid} t={t} variant="upcoming" />
                        ))}
                    </Box>
                )}
            </Box>

            {/* ===================== Finished ===================== */}
            <Box>
                <Heading size="lg" mb="4">Završeni turniri</Heading>

                {loadingFinished ? (
                    <Box display="grid" gridTemplateColumns={gridCols} gap="4">
                        <CardSkeleton />
                        <CardSkeleton />
                        <CardSkeleton />
                    </Box>
                ) : finished.length === 0 ? (
                    <EmptyState
                        title={
                            errorFinished
                                ? "Nije moguće učitati završene turnire"
                                : "Još nema završenih turnira"
                        }
                        description={
                            errorFinished
                                ? errorFinished
                                : "Završeni turniri će se pojaviti ovdje."
                        }
                    />
                ) : (
                    <>
                        <Box display="grid" gridTemplateColumns={gridCols} gap="4">
                            {finished.map((t) => (
                                <TournamentCardView key={t.uuid} t={t} variant="finished" />
                            ))}
                        </Box>
                        {/* Učitaj više — fetches the next page from the backend
                            and appends it. Hidden when we've already loaded all
                            finished tournaments. Shows a loading state on the
                            button itself so the user gets immediate feedback. */}
                        {finishedHasMore && (
                            <HStack justify="center" mt="4">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    colorPalette="blue"
                                    onClick={loadMoreFinished}
                                    loading={loadingMoreFinished}
                                >
                                    Učitaj više ({finishedTotal - finished.length})
                                </Button>
                            </HStack>
                        )}
                    </>
                )}
            </Box>
        </VStack>
    )
}
