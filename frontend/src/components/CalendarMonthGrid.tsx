import { Box, HStack, Text, VStack } from "@chakra-ui/react"
import { formatDate, formatTime } from "../utils/format"
import { useTranslation } from "../i18n"
import {
    NEAR_THRESHOLD_KM,
    WEEKDAY_KEYS,
    WEEKEND_COLUMNS,
    buildMonthGrid,
    dateKey,
    dayIso,
    isSameDay,
    startOfDayMs,
    type CalendarTournament,
} from "./calendarShared"

/* ──────────────────────────────────────────────────────────────────────────
   CalendarMonthGrid — the calendar's SECONDARY view.

   Two things were wrong with the old grid and both are fixed here.

   1. Every cell was 110–120px tall whether or not anything happened on that
      day, so a month with two tournaments was a 700px wall of empty boxes.
      Here the rows are `auto`: a day with nothing is a 44/56px tile holding
      just its number, so a whole week without a tournament collapses into a
      thin band and the grid shrinks to fit the month's actual content. A day
      WITH a tournament grows to fit chips that carry time, name and place —
      it earns the height it takes.

   2. Seven columns at 390px gives ~47px each, which cannot hold a legible
      chip. So the phone gets a different cell body — the day number plus up
      to three dots — and the detail moves into the selected-day panel the
      parent renders underneath. That is the standard phone-calendar shape
      (tap a day, read the day) rather than a desktop grid squeezed until it
      breaks.

   Interaction: the CELL is the button, and the chips inside it are inert
   summaries. Nesting real links inside a button is invalid, and giving each
   chip its own hit target at this size is a coin-flip on touch; selecting the
   day and letting the panel below carry the real links is one predictable
   target per day and identical behaviour on both breakpoints.
   ────────────────────────────────────────────────────────────────────── */

/** Chips shown inside one desktop cell before it collapses to "+N još". */
const MAX_CHIPS = 2

function DayChip({ item, past }: { item: CalendarTournament; past: boolean }) {
    const near = typeof item.distanceKm === "number" && item.distanceKm <= NEAR_THRESHOLD_KM
    return (
        <Box
            bg={past ? "bg.muted" : near ? "brand.muted" : "brand.subtle"}
            color={past ? "fg.muted" : "brand.fg"}
            borderLeftWidth="2px"
            borderLeftColor={past ? "border.strong" : "brand.solid"}
            rounded="sm"
            px="1.5"
            py="1"
            textAlign="left"
            minW="0"
        >
            <Text fontSize="2xs" fontWeight="bold" lineHeight="1.3">
                {formatTime(item.startAt, "")}
            </Text>
            <Text fontSize="2xs" fontWeight="semibold" lineHeight="1.3" truncate>
                {item.name}
            </Text>
            {item.location && (
                <Text fontSize="2xs" opacity={0.8} lineHeight="1.3" truncate>
                    {item.location}
                </Text>
            )}
        </Box>
    )
}

/** Phone cell body: one dot per tournament, capped at three. */
function DayDots({ count, past }: { count: number; past: boolean }) {
    return (
        <HStack gap="0.5" justify="center" mt="0.5">
            {Array.from({ length: Math.min(count, 3) }, (_, i) => (
                <Box
                    key={i}
                    boxSize="4px"
                    rounded="full"
                    bg={past ? "fg.subtle" : "brand.solid"}
                />
            ))}
        </HStack>
    )
}

export default function CalendarMonthGrid({
    year,
    month,
    byDay,
    today,
    selectedKey,
    onSelectDay,
}: {
    year: number
    month: number
    /** Day bucket map from `groupByDay` — keyed `yyyy-mm-dd`. */
    byDay: Map<string, CalendarTournament[]>
    today: Date
    selectedKey: string | null
    onSelectDay: (day: Date) => void
}) {
    const { t } = useTranslation()
    const grid = buildMonthGrid(year, month)
    const todayMs = startOfDayMs(today)

    return (
        <VStack align="stretch" gap="1.5">
            {/* Weekday header. Sat/Sun are tinted because in this sport the
                weekend IS the calendar — a user scanning for "which Saturday"
                should not have to count columns. */}
            <Box display="grid" gridTemplateColumns="repeat(7, minmax(0, 1fr))" gap={{ base: "1", md: "2" }}>
                {WEEKDAY_KEYS.map((key, col) => (
                    <Text
                        key={key}
                        fontSize="2xs"
                        fontWeight="bold"
                        letterSpacing="wider"
                        textAlign="center"
                        color={WEEKEND_COLUMNS.has(col) ? "brand.fg" : "fg.muted"}
                    >
                        {t(`pages.calendar.weekday.${key}`)}
                    </Text>
                ))}
            </Box>

            <Box
                display="grid"
                gridTemplateColumns="repeat(7, minmax(0, 1fr))"
                gridAutoRows="auto"
                gap={{ base: "1", md: "2" }}
            >
                {grid.flat().map((day, index) => {
                    const key = dateKey(day)
                    const items = byDay.get(key) ?? []
                    const inMonth = day.getMonth() === month
                    const isToday = isSameDay(day, today)
                    const isSelected = selectedKey === key
                    const isPast = startOfDayMs(day) < todayMs
                    const hasItems = items.length > 0
                    const isWeekend = WEEKEND_COLUMNS.has(index % 7)

                    return (
                        <Box
                            as="button"
                            key={key}
                            onClick={() => onSelectDay(day)}
                            aria-pressed={isSelected}
                            aria-label={t("pages.calendar.day.selectAria", { date: formatDate(dayIso(day)) })}
                            textAlign="left"
                            display="flex"
                            flexDirection="column"
                            gap="1"
                            minW="0"
                            minH={hasItems ? { base: "48px", md: "76px" } : { base: "40px", md: "52px" }}
                            p={{ base: "1", md: "1.5" }}
                            rounded="md"
                            cursor="pointer"
                            borderWidth={isToday ? "2px" : "1px"}
                            borderColor={
                                isToday
                                    ? "brand.solid"
                                    : hasItems
                                        ? "brand.emphasized"
                                        : "border.subtle"
                            }
                            // A day with something on it is a panel; an empty
                            // day is barely there. That contrast is what makes
                            // a sparse month readable at a glance.
                            bg={hasItems ? "bg.panel" : isWeekend ? "bg.subtle" : "transparent"}
                            opacity={inMonth ? 1 : 0.4}
                            outlineWidth={isSelected ? "2px" : "0"}
                            outlineStyle="solid"
                            outlineColor="brand.solid"
                            outlineOffset="1px"
                            transition="border-color .12s ease, background .12s ease"
                            _hover={{ borderColor: "brand.emphasized", bg: hasItems ? "bg.panel" : "bg.muted" }}
                        >
                            <Text
                                fontSize="xs"
                                fontWeight={isToday ? "bold" : hasItems ? "semibold" : "normal"}
                                color={isToday ? "brand.fg" : hasItems ? "fg.ink" : "fg.muted"}
                                px="0.5"
                            >
                                {day.getDate()}
                            </Text>

                            {hasItems && (
                                <>
                                    {/* Phone: dots only — 47px of column cannot
                                        hold a chip anyone can read. */}
                                    <Box display={{ base: "block", md: "none" }}>
                                        <DayDots count={items.length} past={isPast} />
                                    </Box>

                                    <VStack
                                        align="stretch"
                                        gap="1"
                                        display={{ base: "none", md: "flex" }}
                                        minW="0"
                                    >
                                        {items.slice(0, MAX_CHIPS).map((item) => (
                                            <DayChip key={item.uuid} item={item} past={isPast} />
                                        ))}
                                        {items.length > MAX_CHIPS && (
                                            <Text fontSize="2xs" color="fg.muted" fontWeight="medium">
                                                {t("pages.calendar.moreCount", { n: items.length - MAX_CHIPS })}
                                            </Text>
                                        )}
                                    </VStack>
                                </>
                            )}
                        </Box>
                    )
                })}
            </Box>
        </VStack>
    )
}
