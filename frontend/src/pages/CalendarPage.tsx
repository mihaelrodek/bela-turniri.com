import { useEffect, useMemo, useState } from "react"
import {
    Box,
    Heading,
    HStack,
    IconButton,
    Skeleton,
    Text,
    VStack,
} from "@chakra-ui/react"
import { Link as RouterLink } from "react-router-dom"
import { FiChevronLeft, FiChevronRight } from "react-icons/fi"
import type { TournamentCard } from "../types/tournaments"
import { fetchTournaments } from "../api/tournaments"

type TournamentCardWithUuid = TournamentCard & { uuid: string }

// Croatian short month + weekday labels
const HR_MONTHS = [
    "Siječanj", "Veljača", "Ožujak", "Travanj", "Svibanj", "Lipanj",
    "Srpanj", "Kolovoz", "Rujan", "Listopad", "Studeni", "Prosinac",
]
// Calendar columns: Mon, Tue, Wed, Thu, Fri, Sat, Sun (hr-HR convention)
const HR_WEEKDAYS = ["PON", "UTO", "SRI", "ČET", "PET", "SUB", "NED"]

function pad2(n: number) {
    return String(n).padStart(2, "0")
}
function dateKey(d: Date): string {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}
function startOfMonth(year: number, month: number): Date {
    return new Date(year, month, 1)
}
function isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear()
        && a.getMonth() === b.getMonth()
        && a.getDate() === b.getDate()
}

/**
 * Build a Mon-first grid of dates that fully covers the given month.
 * Includes leading days from the prior month so the first row aligns with
 * Monday, and trailing days from the next month only as needed to finish
 * the week containing the last day of the month — never an extra full row.
 */
function buildMonthGrid(year: number, month: number): Date[][] {
    const first = startOfMonth(year, month)
    // JS getDay(): 0=Sun..6=Sat. We want Monday=0..Sunday=6
    const monIndex = (first.getDay() + 6) % 7
    const gridStart = new Date(year, month, 1 - monIndex)

    // Days in the target month
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    // Total cells = leading days + days-in-month, rounded up to a full week
    const usedCells = monIndex + daysInMonth
    const numRows = Math.ceil(usedCells / 7)

    const rows: Date[][] = []
    for (let r = 0; r < numRows; r++) {
        const row: Date[] = []
        for (let c = 0; c < 7; c++) {
            const d = new Date(gridStart)
            d.setDate(gridStart.getDate() + r * 7 + c)
            row.push(d)
        }
        rows.push(row)
    }
    return rows
}

function formatTime(iso?: string | null): string {
    if (!iso) return ""
    const d = new Date(iso)
    return new Intl.DateTimeFormat("hr-HR", {
        hour: "2-digit",
        minute: "2-digit",
    }).format(d)
}

export default function CalendarPage() {
    const today = useMemo(() => new Date(), [])
    const [cursor, setCursor] = useState<{ year: number; month: number }>({
        year: today.getFullYear(),
        month: today.getMonth(),
    })

    const [tournaments, setTournaments] = useState<TournamentCardWithUuid[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false
        ;(async () => {
            try {
                setLoading(true)
                setError(null)
                // Both buckets so the calendar shows past + future tournaments
                const [up, fin] = await Promise.all([
                    fetchTournaments("upcoming"),
                    fetchTournaments("finished"),
                ])
                if (!cancelled) {
                    setTournaments([...up, ...fin] as TournamentCardWithUuid[])
                }
            } catch (e: any) {
                if (!cancelled) setError(e?.message ?? "Failed to load tournaments")
            } finally {
                if (!cancelled) setLoading(false)
            }
        })()
        return () => { cancelled = true }
    }, [])

    // Bucket tournaments by their start date (yyyy-mm-dd)
    const byDate = useMemo(() => {
        const map = new Map<string, TournamentCardWithUuid[]>()
        for (const t of tournaments) {
            if (!t.startAt) continue
            const k = dateKey(new Date(t.startAt))
            const arr = map.get(k) ?? []
            arr.push(t)
            map.set(k, arr)
        }
        // Sort each day's tournaments by start time
        for (const arr of map.values()) {
            arr.sort((a, b) => {
                const ta = a.startAt ? new Date(a.startAt).getTime() : 0
                const tb = b.startAt ? new Date(b.startAt).getTime() : 0
                return ta - tb
            })
        }
        return map
    }, [tournaments])

    const grid = useMemo(
        () => buildMonthGrid(cursor.year, cursor.month),
        [cursor.year, cursor.month],
    )

    function goPrevMonth() {
        setCursor(({ year, month }) => {
            const m = month - 1
            return m < 0 ? { year: year - 1, month: 11 } : { year, month: m }
        })
    }
    function goNextMonth() {
        setCursor(({ year, month }) => {
            const m = month + 1
            return m > 11 ? { year: year + 1, month: 0 } : { year, month: m }
        })
    }
    function goToday() {
        setCursor({ year: today.getFullYear(), month: today.getMonth() })
    }

    const monthLabel = `${HR_MONTHS[cursor.month]} ${cursor.year}`

    return (
        <VStack align="stretch" gap="4">
            {/* Header with prev/next + month label + today */}
            <HStack justify="space-between" gap="3" wrap="wrap">
                <HStack gap="2">
                    <IconButton
                        aria-label="Prethodni mjesec"
                        size="sm"
                        variant="outline"
                        onClick={goPrevMonth}
                    >
                        <FiChevronLeft />
                    </IconButton>
                    <IconButton
                        aria-label="Sljedeći mjesec"
                        size="sm"
                        variant="outline"
                        onClick={goNextMonth}
                    >
                        <FiChevronRight />
                    </IconButton>
                    <Box
                        as="button"
                        onClick={goToday}
                        px="3"
                        py="1.5"
                        rounded="md"
                        borderWidth="1px"
                        borderColor="border.emphasized"
                        fontSize="sm"
                        fontWeight="medium"
                        cursor="pointer"
                        _hover={{ bg: "bg.muted" }}
                    >
                        Danas
                    </Box>
                </HStack>
                <Heading size="lg" textTransform="capitalize">{monthLabel}</Heading>
                <Box w={{ base: "0", md: "180px" }} />
            </HStack>

            {error && (
                <Box
                    borderWidth="1px"
                    borderColor="red.muted"
                    bg="red.subtle"
                    rounded="md"
                    p="3"
                >
                    <Text color="red.fg" fontSize="sm">{error}</Text>
                </Box>
            )}

            {/* Weekday header row */}
            <Box
                display="grid"
                gridTemplateColumns="repeat(7, minmax(0, 1fr))"
                gap={{ base: "1", md: "2" }}
                px="1"
            >
                {HR_WEEKDAYS.map((label) => (
                    <Text
                        key={label}
                        fontSize="xs"
                        fontWeight="semibold"
                        color="fg.muted"
                        letterSpacing="wider"
                        textAlign="center"
                    >
                        {label}
                    </Text>
                ))}
            </Box>

            {/* Calendar grid */}
            <Box
                display="grid"
                gridTemplateColumns="repeat(7, minmax(0, 1fr))"
                gap={{ base: "1", md: "2" }}
            >
                {grid.flat().map((d) => {
                    const inMonth = d.getMonth() === cursor.month
                    const isToday = isSameDay(d, today)
                    const k = dateKey(d)
                    const items = byDate.get(k) ?? []
                    // Past days (before today) → events on them are "ended"
                    const isPast = d.getTime() < today.setHours(0, 0, 0, 0)

                    return (
                        <Box
                            key={k}
                            borderWidth={isToday ? "2px" : "1px"}
                            borderColor={isToday ? "blue.solid" : "border.emphasized"}
                            rounded="md"
                            bg={inMonth ? "bg" : "bg.subtle"}
                            opacity={inMonth ? 1 : 0.5}
                            minH={{ base: "70px", md: "110px", lg: "120px" }}
                            minW="0"
                            p={{ base: "1", md: "1.5" }}
                            display="flex"
                            flexDirection="column"
                            gap="1"
                            shadow={isToday ? "sm" : undefined}
                            position="relative"
                            overflow="hidden"
                        >
                            <Text
                                fontSize="xs"
                                fontWeight={isToday ? "bold" : "medium"}
                                color={isToday ? "blue.fg" : inMonth ? "fg" : "fg.muted"}
                                px="1"
                            >
                                {d.getDate()}
                            </Text>

                            {loading ? (
                                <Skeleton h="3" w="80%" />
                            ) : (
                                <VStack align="stretch" gap="1" flex="1" overflow="hidden">
                                    {items.slice(0, 4).map((t) => (
                                        <RouterLink
                                            key={t.uuid}
                                            to={`/turniri/${t.slug ?? t.uuid}`}
                                            style={{ textDecoration: "none" }}
                                        >
                                            <Box
                                                bg={isPast ? "gray.solid" : "blue.solid"}
                                                color="white"
                                                rounded="sm"
                                                px="1.5"
                                                py="0.5"
                                                fontSize="2xs"
                                                lineHeight="short"
                                                cursor="pointer"
                                                opacity={isPast ? 0.7 : 1}
                                                _hover={{ bg: isPast ? "gray.emphasized" : "blue.emphasized" }}
                                                transition="background 0.1s ease"
                                            >
                                                <Text
                                                    fontSize="2xs"
                                                    opacity={0.85}
                                                    fontWeight="medium"
                                                    display={{ base: "none", md: "block" }}
                                                >
                                                    {formatTime(t.startAt)}
                                                </Text>
                                                <Text
                                                    fontSize="2xs"
                                                    fontWeight="semibold"
                                                    overflow="hidden"
                                                    textOverflow="ellipsis"
                                                    whiteSpace="nowrap"
                                                >
                                                    {t.name}
                                                </Text>
                                            </Box>
                                        </RouterLink>
                                    ))}
                                    {items.length > 4 && (
                                        <Text
                                            fontSize="2xs"
                                            color="fg.muted"
                                            fontWeight="medium"
                                            textAlign="center"
                                            mt="auto"
                                        >
                                            +{items.length - 4} još
                                        </Text>
                                    )}
                                </VStack>
                            )}
                        </Box>
                    )
                })}
            </Box>
        </VStack>
    )
}
