import { isNative } from "../platform"
import { useEffect, useMemo, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
    Box,
    Button,
    Heading,
    HStack,
    Text,
    VisuallyHidden,
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
import { useTranslation } from "../i18n"
import EmptyState from "../components/EmptyState"
import CalendarSubscribeButton from "../components/CalendarSubscribeButton"
import CalendarEventRow from "../components/CalendarEventRow"
import { CalendarEventRowSkeleton } from "../components/CalendarPageSkeleton"
import CalendarMonthGrid from "../components/CalendarMonthGrid"
import {
    MONTH_KEYS,
    buildMonthGrid,
    dateKey,
    dayIso,
    groupByDay,
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

export default function CalendarPage() {
    const { t } = useTranslation()

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
                t(isNative ? "pages.tournaments.nearMe.deniedDescriptionNative" : "pages.tournaments.nearMe.deniedDescription"),
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

    /** Everything from today onward, ascending — the agenda's whole payload. */
    const upcoming = useMemo(
        () =>
            decorated
                .filter((item) => item.startAt && startOfDayMs(new Date(item.startAt)) >= todayMs)
                .sort((a, b) => startMs(a) - startMs(b)),
        [decorated, todayMs],
    )

    /* ── Selected month ──────────────────────────────────────────────── */
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
    const prevMonthLabel = t(`pages.calendar.month.${MONTH_KEYS[(cursor.month + 11) % 12]}`)
    const nextMonthLabel = t(`pages.calendar.month.${MONTH_KEYS[(cursor.month + 1) % 12]}`)

    /* ── Render ──────────────────────────────────────────────────────── */
    return (
        <VStack align="stretch" gap="5">
            {/* One toolbar, both views (2026-09-29, owner): the view toggle on
                the left, the month and its neighbours in the CENTRE, the two
                actions on the right. On a phone the month row goes first,
                centred, and toggle + actions share the row under it. The old title + "N nadolazećih turnira" line and the
                separate month row under it are gone — the month IS the
                heading of this page. The h1 stays for screen readers and SEO.
                Wraps to two rows when the width runs out. */}
            <VisuallyHidden asChild><h1>{t("pages.calendar.title")}</h1></VisuallyHidden>
            <Box
                display="grid"
                gridTemplateColumns={{ base: "auto 1fr", lg: "1fr auto 1fr" }}
                gridTemplateAreas={{ base: `"nav nav" "view actions"`, lg: `"view nav actions"` }}
                alignItems="center"
                gap="3"
            >
                <Box gridArea="view" justifySelf="start">
                    <ViewToggle value={view} onChange={setView} />
                </Box>
                <Box gridArea="nav" justifySelf="center" minW="0">
                    <MonthNavigation
                        monthLabel={monthLabel}
                        prevLabel={prevMonthLabel}
                        nextLabel={nextMonthLabel}
                        onPrevious={() => stepMonth(-1)}
                        onNext={() => stepMonth(1)}
                        onToday={() => setCursor({ year: today.getFullYear(), month: today.getMonth() })}
                    />
                </Box>
                <HStack gridArea="actions" justifySelf="end" gap="2" wrap="nowrap" flexShrink="0">
                    {/* Distance opt-in. Deliberately one button rather than the
                        tournaments list's full filter panel — the calendar shows
                        everything and only labels what is close. */}
                    {geoStatus !== "unsupported" && (
                        <Button
                            size="sm"
                            h={TOOLBAR_H}
                            variant={nearMeEnabled ? "solid" : "outline"}
                            colorPalette="brand"
                            px={{ base: "2", md: "4" }}
                            onClick={toggleNearMe}
                            disabled={geoStatus === "asking"}
                            loading={geoStatus === "asking"}
                            whiteSpace="nowrap"
                        >
                            <FiNavigation />
                            {t("pages.tournaments.nearMe.label")}
                        </Button>
                    )}
                    <CalendarSubscribeButton />
                </HStack>
            </Box>

            {geoStatus === "denied" && (
                <Text fontSize="xs" color="fg.muted">
                    {t(isNative ? "pages.tournaments.nearMe.deniedNative" : "pages.tournaments.nearMe.denied")}
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
                    ) : monthItems.length === 0 ? (
                        <Box borderWidth="1px" borderStyle="dashed" borderColor="border.emphasized" rounded="xl">
                            <EmptyState
                                icon={FiCalendar}
                                title={tournaments.length === 0
                                    ? t("pages.calendar.emptyAgenda.title")
                                    : t("pages.calendar.emptyMonth.title")}
                                description={tournaments.length === 0
                                    ? t("pages.calendar.emptyAgenda.description")
                                    : t("pages.calendar.emptyMonth.description")}
                                action={tournaments.length === 0 ? (
                                    <Button size="sm" colorPalette="brand" asChild>
                                        <RouterLink to="/">
                                            {t("pages.calendar.emptyAgenda.cta")}
                                        </RouterLink>
                                    </Button>
                                ) : undefined}
                            />
                        </Box>
                    ) : (
                        monthItems.map((item) => (
                            <CalendarEventRow
                                key={item.uuid}
                                item={item}
                                highlight={item.uuid === upcoming[0]?.uuid}
                            />
                        ))
                    )}
                </VStack>
            ) : (
                <VStack align="stretch" gap="3">
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
                        lives, on desktop it is where the real links are. The
                        grid itself already shows when an empty month has
                        nothing in it, so there is no separate empty-month
                        block here any more. */}
                    {selectedDate ? (
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
 * Previous / current / next month in one compact group. The neighbours are
 * named ("‹ Kolovoz", "Listopad ›") so a click says where it goes; on a phone
 * the names drop and the arrows remain.
 */
/** One height for every control in the toolbar (2026-09-29, owner): the
 *  view toggle's outer box (2px padding + 1px border around 34px buttons)
 *  comes to the same 40px. */
const TOOLBAR_H = "40px"
/** Previous/next month slot: arrow + the longest month name ("September"). */
const NEIGHBOUR_W = "124px"

function MonthNavigation({
    monthLabel,
    prevLabel,
    nextLabel,
    onPrevious,
    onNext,
    onToday,
}: {
    monthLabel: string
    prevLabel: string
    nextLabel: string
    onPrevious: () => void
    onNext: () => void
    onToday: () => void
}) {
    const { t } = useTranslation()

    // One box, like the view toggle beside it (2026-09-29, owner): the
    // arrows, the month and "Danas" read as a single control, 40px tall.
    // Every slot has a FIXED width sized for the longest name in any locale
    // ("Prosinac", "September 2026"): with content-sized slots the whole
    // group resized and the arrows moved under the pointer on every click.
    return (
        <HStack
            gap="0.5"
            p="0.5"
            minW="0"
            bg="bg.subtle"
            rounded="lg"
            borderWidth="1px"
            borderColor="border.subtle"
            role="group"
        >
            <Button
                aria-label={`${t("pages.calendar.prevMonth")}: ${prevLabel}`}
                size="sm"
                h="34px"
                variant="ghost"
                color="fg.muted"
                w={{ base: "34px", md: NEIGHBOUR_W }}
                px={{ base: "0", md: "3" }}
                justifyContent={{ base: "center", md: "flex-start" }}
                onClick={onPrevious}
            >
                <FiChevronLeft />
                <Box as="span" display={{ base: "none", md: "inline" }} truncate>{prevLabel}</Box>
            </Button>
            <Heading
                as="h2"
                size="md"
                textTransform="capitalize"
                textAlign="center"
                whiteSpace="nowrap"
                w={{ base: "150px", md: "176px" }}
                flexShrink={0}
                px="2"
                h="34px"
                display="flex"
                alignItems="center"
                justifyContent="center"
                bg="bg.panel"
                rounded="md"
                boxShadow="xs"
            >
                {monthLabel}
            </Heading>
            <Button
                aria-label={`${t("pages.calendar.nextMonth")}: ${nextLabel}`}
                size="sm"
                h="34px"
                variant="ghost"
                color="fg.muted"
                w={{ base: "34px", md: NEIGHBOUR_W }}
                px={{ base: "0", md: "3" }}
                justifyContent={{ base: "center", md: "flex-end" }}
                onClick={onNext}
            >
                <Box as="span" display={{ base: "none", md: "inline" }} truncate>{nextLabel}</Box>
                <FiChevronRight />
            </Button>
            <Box w="1px" h="20px" bg="border" mx="0.5" aria-hidden="true" />
            <Button size="sm" h="34px" variant="ghost" onClick={onToday}>
                {t("pages.calendar.today")}
            </Button>
        </HStack>
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
            p="0.5"
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
                        size="sm"
                        h="34px"
                        px={{ base: "2", md: "4" }}
                        variant={active ? "solid" : "ghost"}
                        colorPalette={active ? "brand" : "gray"}
                        aria-pressed={active}
                        aria-label={label}
                        title={label}
                        onClick={() => onChange(id)}
                    >
                        <Icon />
                        <Box as="span" display={{ base: "none", md: "inline" }}>
                            {label}
                        </Box>
                    </Button>
                )
            })}
        </HStack>
    )
}
