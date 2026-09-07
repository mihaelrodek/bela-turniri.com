import { useEffect, useMemo, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
    Box,
    Button,
    Heading,
    HStack,
    IconButton,
    Stack,
    Text,
    VStack,
} from "@chakra-ui/react"
import { Link as RouterLink } from "react-router-dom"
import { FiCalendar, FiChevronLeft, FiChevronRight, FiList, FiNavigation, FiGrid } from "react-icons/fi"
import { fetchTournaments } from "../api/tournaments"
import { qk } from "../queryClient"
import { formatDate } from "../utils/format"
import { haversineKm } from "../utils/distance"
import { useUserLocation } from "../hooks/useUserLocation"
import { useDocumentHead } from "../hooks/useDocumentHead"
import { showError } from "../toaster"
import { usePlural, useTranslation } from "../i18n"
import EmptyState from "../components/EmptyState"
import CalendarSubscribeButton from "../components/CalendarSubscribeButton"
import CalendarEventRow, { CalendarEventRowSkeleton } from "../components/CalendarEventRow"
import CalendarMonthGrid from "../components/CalendarMonthGrid"
import { CONTENT_STICKY_TOP } from "../components/navChrome"
import {
    MONTH_KEYS,
    buildMonthGrid,
    dateKey,
    dayIso,
    groupByDay,
    monthOrdinal,
    monthsWithEvents,
    nearestMonthWithEvents,
    startMs,
    startOfDayMs,
    type CalendarTournament,
} from "../components/calendarShared"

/* ──────────────────────────────────────────────────────────────────────────
   CalendarPage — agenda first, month grid second.

   WHY THIS SHAPE. The screen answers one question: "when is the next
   tournament near me". The data behind it is a handful of tournaments a
   month, sometimes none — so a seven-column month grid spent 95% of its
   pixels rendering nothing, pushed the one thing the user came for below the
   fold, and could not show anything past the end of the current month
   without repeated clicking. An agenda has none of those failure modes: it
   is exactly as tall as there is content, it reads top-to-bottom in the same
   order the question is asked, and it crosses month boundaries for free.

   The grid is not deleted, because it does answer a real second question —
   "which weekend does this fall on" — and it is the only way to reach past
   months from here. It is a toggle, it starts collapsed, and it now shrinks
   to fit its content (see CalendarMonthGrid).

   Everything still comes from the single `qk.calendar` TanStack Query entry
   the old page used; no second fetch path was added.
   ────────────────────────────────────────────────────────────────────── */

type View = "agenda" | "month"

/** Stable empty default for the query's `data` — a fresh `[]` literal would be
 *  a new reference on every render and bust the memos below. */
const EMPTY_TOURNAMENTS: CalendarTournament[] = []

/** How many upcoming months the agenda renders before asking for more. Keeps
 *  the first paint short on a season with a long tail; "prikaži još" raises
 *  it. Months, not rows, so a month is never cut in half. */
const AGENDA_MONTH_PAGE = 4

/** One month's worth of agenda rows. */
type AgendaGroup = {
    /** `year * 12 + month`, for keys and comparisons. */
    ordinal: number
    year: number
    month: number
    items: CalendarTournament[]
}

export default function CalendarPage() {
    const { t } = useTranslation()
    const plural = usePlural()

    useDocumentHead({
        title: t("pages.calendar.seo.title"),
        description: t("pages.calendar.seo.description"),
        ogTitle: t("pages.calendar.seo.ogTitle"),
        ogDescription: t("pages.calendar.seo.ogDescription"),
        ogType: "website",
        canonical: "https://bela-turniri.com/kalendar",
    })

    const today = useMemo(() => new Date(), [])
    const todayMs = startOfDayMs(today)

    const [view, setView] = useState<View>("agenda")
    const [cursor, setCursor] = useState<{ year: number; month: number }>({
        year: today.getFullYear(),
        month: today.getMonth(),
    })
    const [selectedKey, setSelectedKey] = useState<string | null>(null)
    const [visibleMonths, setVisibleMonths] = useState(AGENDA_MONTH_PAGE)

    /* ── Data ────────────────────────────────────────────────────────────
       Unchanged from the previous implementation on purpose: one cache entry
       under `qk.calendar` holding both buckets, so navigating away and back
       inside the staleTime window repaints instantly instead of re-firing
       two requests.
       ──────────────────────────────────────────────────────────────────── */
    const {
        data: tournaments = EMPTY_TOURNAMENTS,
        isPending: loading,
        error: queryError,
    } = useQuery<CalendarTournament[]>({
        queryKey: qk.calendar,
        queryFn: async () => {
            const [up, fin] = await Promise.all([
                fetchTournaments("upcoming"),
                fetchTournaments("finished"),
            ])
            return [...up, ...fin] as CalendarTournament[]
        },
    })
    const error = queryError ? (queryError.message || t("pages.calendar.loadErrorFallback")) : null

    /* ── "Blizu mene" ────────────────────────────────────────────────────
       Same hook, same opt-in-then-toast-on-denial flow as the tournaments
       list — one geolocation permission story for the whole app. The
       calendar only ANNOTATES with the distance, it never filters: hiding
       tournaments from a calendar would silently make the answer to "when is
       the next one" wrong.
       ──────────────────────────────────────────────────────────────────── */
    const [nearMeEnabled, setNearMeEnabled] = useState(false)
    const { pos: userPos, status: geoStatus, request: requestLocation } = useUserLocation()

    // Tracks a request() this page triggered, so the denial toast fires once
    // for that user action and never as a side effect of an unrelated render.
    const awaitingPermissionRef = useRef(false)
    useEffect(() => {
        if (!awaitingPermissionRef.current) return
        if (geoStatus === "asking") return
        awaitingPermissionRef.current = false
        if (geoStatus === "denied") {
            setNearMeEnabled(false)
            showError(
                t("pages.tournaments.nearMe.deniedTitle"),
                t("pages.tournaments.nearMe.deniedDescription"),
            )
        }
        // `t` is recreated on every language switch; re-running then would
        // re-toast a denial the user has already dismissed.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [geoStatus])

    function toggleNearMe() {
        if (nearMeEnabled) {
            setNearMeEnabled(false)
            return
        }
        setNearMeEnabled(true)
        if (!userPos) {
            awaitingPermissionRef.current = true
            requestLocation()
        }
    }

    /** Tournaments with `distanceKm` attached while the toggle is on. */
    const decorated = useMemo<CalendarTournament[]>(() => {
        const me = nearMeEnabled && userPos ? { lat: userPos[0], lng: userPos[1] } : null
        if (!me) return tournaments
        return tournaments.map((item) => {
            if (typeof item.latitude !== "number" || typeof item.longitude !== "number") return item
            return { ...item, distanceKm: haversineKm(me, { lat: item.latitude, lng: item.longitude }) }
        })
    }, [tournaments, nearMeEnabled, userPos])

    const byDay = useMemo(() => groupByDay(decorated), [decorated])
    const eventMonths = useMemo(() => monthsWithEvents(decorated), [decorated])

    /** Everything from today onward, ascending — the agenda's whole payload. */
    const upcoming = useMemo(
        () =>
            decorated
                .filter((item) => item.startAt && startOfDayMs(new Date(item.startAt)) >= todayMs)
                .sort((a, b) => startMs(a) - startMs(b)),
        [decorated, todayMs],
    )

    /** Upcoming rows bucketed into month groups, in order. */
    const agendaGroups = useMemo<AgendaGroup[]>(() => {
        const groups: AgendaGroup[] = []
        for (const item of upcoming) {
            const when = new Date(item.startAt as string)
            const ordinal = monthOrdinal(when.getFullYear(), when.getMonth())
            const last = groups[groups.length - 1]
            if (last && last.ordinal === ordinal) last.items.push(item)
            else groups.push({ ordinal, year: when.getFullYear(), month: when.getMonth(), items: [item] })
        }
        return groups
    }, [upcoming])

    const shownGroups = agendaGroups.slice(0, visibleMonths)
    const hiddenGroupCount = agendaGroups.length - shownGroups.length

    /* ── Month view state ────────────────────────────────────────────── */
    const cursorOrdinal = monthOrdinal(cursor.year, cursor.month)
    const monthItems = useMemo(
        () =>
            decorated
                .filter((item) => {
                    if (!item.startAt) return false
                    const when = new Date(item.startAt)
                    if (Number.isNaN(when.getTime())) return false
                    return when.getFullYear() === cursor.year && when.getMonth() === cursor.month
                })
                .sort((a, b) => startMs(a) - startMs(b)),
        [decorated, cursor.year, cursor.month],
    )
    const monthIsEmpty = !loading && monthItems.length === 0
    const jumpTarget = useMemo(
        () => (monthIsEmpty ? nearestMonthWithEvents(eventMonths, cursorOrdinal) : null),
        [monthIsEmpty, eventMonths, cursorOrdinal],
    )

    /* The selected day resets whenever the visible month changes. Preference
       order: today (only when something is actually on it), then the month's
       first day that has something, then today anyway as an orientation
       anchor. Landing on a day that HAS tournaments is the point — a panel
       whose default state is "nothing on this day" wastes the space it just
       claimed. */
    useEffect(() => {
        const todayInView = today.getFullYear() === cursor.year && today.getMonth() === cursor.month
        if (todayInView && (byDay.get(dateKey(today))?.length ?? 0) > 0) {
            setSelectedKey(dateKey(today))
            return
        }
        const daysWithEvents = buildMonthGrid(cursor.year, cursor.month)
            .flat()
            .filter((d) => d.getMonth() === cursor.month && (byDay.get(dateKey(d))?.length ?? 0) > 0)
        // Prefer the first day that has not happened yet — landing on a
        // tournament that finished three weeks ago answers nobody's question.
        const pick = daysWithEvents.find((d) => startOfDayMs(d) >= todayMs) ?? daysWithEvents[0]
        if (pick) setSelectedKey(dateKey(pick))
        else setSelectedKey(todayInView ? dateKey(today) : null)
    }, [cursor.year, cursor.month, byDay, today, todayMs])

    const selectedDate = useMemo(() => {
        if (!selectedKey) return null
        const [y, m, d] = selectedKey.split("-").map(Number)
        return new Date(y, (m ?? 1) - 1, d ?? 1)
    }, [selectedKey])
    const selectedItems = selectedKey ? byDay.get(selectedKey) ?? [] : []

    function stepMonth(delta: number) {
        setCursor(({ year, month }) => {
            const next = month + delta
            if (next < 0) return { year: year - 1, month: 11 }
            if (next > 11) return { year: year + 1, month: 0 }
            return { year, month: next }
        })
    }

    const monthLabel = `${t(`pages.calendar.month.${MONTH_KEYS[cursor.month]}`)} ${cursor.year}`

    /* ── Render ──────────────────────────────────────────────────────── */
    return (
        <VStack align="stretch" gap="5">
            {/* Page header: what this is, how much of it there is, and the two
                actions that apply to the whole screen. */}
            <Stack
                direction={{ base: "column", md: "row" }}
                justify="space-between"
                align={{ base: "stretch", md: "center" }}
                gap="3"
            >
                <Box>
                    <Heading size="lg">{t("pages.calendar.title")}</Heading>
                    <Text fontSize="sm" color="fg.muted" mt="0.5">
                        {loading ? " " : plural("pages.calendar.upcomingCount", upcoming.length)}
                    </Text>
                </Box>
                <HStack gap="2" wrap="wrap">
                    <ViewToggle value={view} onChange={setView} />
                    {/* Distance opt-in. Deliberately one button rather than the
                        tournaments list's full filter panel — the calendar shows
                        everything and only labels what is close. */}
                    {geoStatus !== "unsupported" && (
                        <Button
                            size="sm"
                            variant={nearMeEnabled ? "solid" : "outline"}
                            colorPalette="brand"
                            onClick={toggleNearMe}
                            disabled={geoStatus === "asking"}
                            loading={geoStatus === "asking"}
                        >
                            <FiNavigation /> {t("pages.tournaments.nearMe.label")}
                        </Button>
                    )}
                    <CalendarSubscribeButton />
                </HStack>
            </Stack>

            {geoStatus === "denied" && (
                <Text fontSize="xs" color="fg.muted">
                    {t("pages.tournaments.nearMe.denied")}
                </Text>
            )}

            {error && (
                <Box borderWidth="1px" borderColor="red.muted" bg="red.subtle" rounded="md" p="3">
                    <Text color="red.fg" fontSize="sm">{error}</Text>
                </Box>
            )}

            {view === "agenda" ? (
                <VStack align="stretch" gap="4">
                    {loading ? (
                        <VStack align="stretch" gap="2">
                            <CalendarEventRowSkeleton />
                            <CalendarEventRowSkeleton />
                            <CalendarEventRowSkeleton />
                        </VStack>
                    ) : agendaGroups.length === 0 ? (
                        <Box borderWidth="1px" borderStyle="dashed" borderColor="border.emphasized" rounded="xl">
                            <EmptyState
                                icon={FiCalendar}
                                title={t("pages.calendar.emptyAgenda.title")}
                                description={t("pages.calendar.emptyAgenda.description")}
                                action={
                                    <Button size="sm" colorPalette="brand" asChild>
                                        <RouterLink to="/turniri">
                                            {t("pages.calendar.emptyAgenda.cta")}
                                        </RouterLink>
                                    </Button>
                                }
                            />
                        </Box>
                    ) : (
                        <>
                            {shownGroups.map((group, groupIndex) => (
                                <VStack key={group.ordinal} align="stretch" gap="2">
                                    {/* Sticky so the month you are reading stays
                                        named while you scroll. The offset comes
                                        from navChrome, never a literal. */}
                                    <Box
                                        position="sticky"
                                        top={CONTENT_STICKY_TOP}
                                        zIndex="1"
                                        layerStyle="glass.bar"
                                        py="1.5"
                                    >
                                        <HStack justify="space-between" align="baseline" gap="2">
                                            <Heading size="sm" color="fg.soft">
                                                {`${t(`pages.calendar.month.${MONTH_KEYS[group.month]}`)} ${group.year}`}
                                            </Heading>
                                            <Text fontSize="xs" color="fg.muted">
                                                {plural("pages.calendar.monthCount", group.items.length)}
                                            </Text>
                                        </HStack>
                                        <Box h="1px" bg="border.subtle" mt="1.5" />
                                    </Box>
                                    {group.items.map((item, itemIndex) => (
                                        <CalendarEventRow
                                            key={item.uuid}
                                            item={item}
                                            highlight={groupIndex === 0 && itemIndex === 0}
                                        />
                                    ))}
                                </VStack>
                            ))}
                            {hiddenGroupCount > 0 && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    alignSelf="center"
                                    onClick={() => setVisibleMonths((n) => n + AGENDA_MONTH_PAGE)}
                                >
                                    {plural("pages.calendar.moreMonths", hiddenGroupCount)}
                                </Button>
                            )}
                        </>
                    )}
                </VStack>
            ) : (
                <VStack align="stretch" gap="3">
                    {/* Month toolbar */}
                    <HStack justify="space-between" gap="2" wrap="wrap">
                        <HStack gap="1">
                            <IconButton
                                aria-label={t("pages.calendar.prevMonth")}
                                size="sm"
                                variant="outline"
                                onClick={() => stepMonth(-1)}
                            >
                                <FiChevronLeft />
                            </IconButton>
                            <IconButton
                                aria-label={t("pages.calendar.nextMonth")}
                                size="sm"
                                variant="outline"
                                onClick={() => stepMonth(1)}
                            >
                                <FiChevronRight />
                            </IconButton>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setCursor({ year: today.getFullYear(), month: today.getMonth() })}
                            >
                                {t("pages.calendar.today")}
                            </Button>
                        </HStack>
                        <VStack gap="0" align={{ base: "start", sm: "end" }}>
                            <Heading size="md" textTransform="capitalize">{monthLabel}</Heading>
                            <Text fontSize="xs" color="fg.muted">
                                {plural("pages.calendar.monthCount", monthItems.length)}
                            </Text>
                        </VStack>
                    </HStack>

                    <CalendarMonthGrid
                        year={cursor.year}
                        month={cursor.month}
                        byDay={byDay}
                        today={today}
                        selectedKey={selectedKey}
                        onSelectDay={(day) => setSelectedKey(dateKey(day))}
                    />

                    {/* Everything below the grid is the detail the cells cannot
                        hold: on the phone it is the ONLY place the detail
                        lives, on desktop it is where the real links are. */}
                    {monthIsEmpty ? (
                        <Box borderWidth="1px" borderStyle="dashed" borderColor="border.emphasized" rounded="xl">
                            <EmptyState
                                compact
                                icon={FiCalendar}
                                title={t("pages.calendar.emptyMonth.title")}
                                description={
                                    jumpTarget
                                        ? t("pages.calendar.emptyMonth.description")
                                        : t("pages.calendar.emptyMonth.noneAhead")
                                }
                                action={
                                    jumpTarget ? (
                                        <Button
                                            size="sm"
                                            colorPalette="brand"
                                            onClick={() => setCursor(jumpTarget)}
                                        >
                                            {t("pages.calendar.emptyMonth.jump", {
                                                month: `${t(`pages.calendar.month.${MONTH_KEYS[jumpTarget.month]}`)} ${jumpTarget.year}`,
                                            })}
                                        </Button>
                                    ) : undefined
                                }
                            />
                        </Box>
                    ) : selectedDate ? (
                        <VStack align="stretch" gap="2" pt="1">
                            <Text fontSize="sm" fontWeight="semibold" color="fg.soft">
                                {formatDate(dayIso(selectedDate))}
                            </Text>
                            {selectedItems.length === 0 ? (
                                <Text fontSize="sm" color="fg.muted">
                                    {t("pages.calendar.day.none")}
                                </Text>
                            ) : (
                                selectedItems.map((item) => (
                                    <CalendarEventRow key={item.uuid} item={item} showDate={false} />
                                ))
                            )}
                        </VStack>
                    ) : null}
                </VStack>
            )}
        </VStack>
    )
}

/**
 * Two-state segmented control. Hand-rolled rather than a Chakra Tabs root
 * because it switches an entire page region, not a tab panel, and the
 * agenda/month choice has to keep working when the region below it is an
 * empty state.
 */
function ViewToggle({ value, onChange }: { value: View; onChange: (v: View) => void }) {
    const { t } = useTranslation()
    const options: { id: View; label: string; icon: typeof FiList }[] = [
        { id: "agenda", label: t("pages.calendar.view.agenda"), icon: FiList },
        { id: "month", label: t("pages.calendar.view.month"), icon: FiGrid },
    ]
    return (
        <HStack
            gap="1"
            p="1"
            bg="bg.subtle"
            rounded="lg"
            borderWidth="1px"
            borderColor="border.subtle"
            role="group"
            aria-label={t("pages.calendar.view.label")}
        >
            {options.map(({ id, label, icon: Icon }) => {
                const active = value === id
                return (
                    <Button
                        key={id}
                        size="xs"
                        variant={active ? "solid" : "ghost"}
                        colorPalette={active ? "brand" : "gray"}
                        aria-pressed={active}
                        onClick={() => onChange(id)}
                    >
                        <Icon /> {label}
                    </Button>
                )
            })}
        </HStack>
    )
}
