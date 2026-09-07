import { Badge, Box, HStack, IconButton, Text, VStack } from "@chakra-ui/react"
import { Link as RouterLink } from "react-router-dom"
import { FiClock, FiMap, FiMapPin, FiNavigation, FiUsers } from "react-icons/fi"
import { formatTime } from "../utils/format"
import { formatDistanceKm } from "../utils/distance"
import { hasMapCoordinates, mapLinkFor } from "../utils/mapLink"
import { DateTile, Meta } from "./rowPrimitives"
import { positiveAmount } from "./listingShared"
import { usePlural, useTranslation } from "../i18n"
import {
    NEAR_THRESHOLD_KM,
    WEEKDAY_KEYS,
    type CalendarTournament,
} from "./calendarShared"

/* ──────────────────────────────────────────────────────────────────────────
   CalendarEventRow — one tournament, rendered as a full-width agenda row.

   This is the unit the redesigned calendar is built out of. The old screen
   put a 2xs blue chip carrying a time and a truncated name inside a 110px
   grid cell; you could not tell from it where the tournament was, what it
   cost, whether it was full or whether it was anywhere near you, so every
   single one needed a click to evaluate. A row has the horizontal space to
   answer all of that at a glance, which is the whole reason the agenda —
   not the grid — is the calendar's primary view.

   Used in two places, hence `showDate`:
     - the agenda list, where each row carries its own date tile;
     - the month view's selected-day panel, where the date is already the
       panel's heading and repeating it on every row is noise.

   SHAPE. The row is a card holding TWO sibling links, not one link with
   something nested inside it. The big one — everything from the date tile to
   the capacity — opens the tournament; the small one at the right edge opens
   `/karta` focused on this tournament (see `utils/mapLink.ts`). Siblings
   rather than nesting because an <a> inside an <a> is invalid HTML, and
   because siblings need no `stopPropagation` gymnastics: neither click can
   swallow the other, each keeps real link semantics (middle-click, "open in
   new tab", keyboard focus in reading order), and the card around them still
   owns the hover state so the row lights up as one object.
   ────────────────────────────────────────────────────────────────────── */

/** Days from today to `iso`, or `null` when there is no usable date. */
function daysFromToday(iso?: string | null): number | null {
    if (!iso) return null
    const start = new Date(iso)
    if (Number.isNaN(start.getTime())) return null
    const startMs = start.setHours(0, 0, 0, 0)
    const todayMs = new Date().setHours(0, 0, 0, 0)
    return Math.round((startMs - todayMs) / (24 * 60 * 60 * 1000))
}

/**
 * Left-hand date tile for one calendar row.
 *
 * The tile itself is shared with the tournaments list — see
 * `components/rowPrimitives.tsx`. All this wrapper does is turn a
 * `CalendarTournament` into the two localised strings the tile wants.
 *
 * No `month`: in the agenda a sticky month heading is always on screen above
 * the row, and in the day panel the heading carries the full date, so
 * repeating it here would only make the tile wider for no added information.
 */
function CalendarDateTile({ item, accent }: { item: CalendarTournament; accent: boolean }) {
    const { t } = useTranslation()
    const when = item.startAt ? new Date(item.startAt) : null
    const valid = when && !Number.isNaN(when.getTime())
    // getDay(): 0=Sun..6=Sat → Mon-first index into WEEKDAY_KEYS.
    const weekday = valid ? t(`pages.calendar.weekday.${WEEKDAY_KEYS[(when.getDay() + 6) % 7]}`) : "—"

    return <DateTile weekday={weekday} day={valid ? String(when.getDate()) : "—"} accent={accent} />
}

export default function CalendarEventRow({
    item,
    showDate = true,
    /** Marks the very next tournament so the agenda has one obvious focal point. */
    highlight = false,
}: {
    item: CalendarTournament
    showDate?: boolean
    highlight?: boolean
}) {
    const { t } = useTranslation()
    const plural = usePlural()

    const diff = daysFromToday(item.startAt)
    const isPast = diff !== null && diff < 0
    const price = positiveAmount(item.entryPrice)
    const repassage = positiveAmount(item.repassagePrice)
    const priceBlock = price ? (repassage ? `${price} + ${repassage}` : price) : null

    // Same "Danas / Sutra / Za N dana" vocabulary the tournaments list uses —
    // the keys live in the same namespace, so the two screens can never drift
    // into two different ways of saying the same thing.
    const relative =
        diff === null || diff < 0 || diff > 14
            ? null
            : diff === 0
                ? t("pages.tournaments.relativeDays.today")
                : diff === 1
                    ? t("pages.tournaments.relativeDays.tomorrow")
                    : plural("pages.tournaments.relativeDays.inDays", diff)

    const near = typeof item.distanceKm === "number" && item.distanceKm <= NEAR_THRESHOLD_KM

    /* The map shortcut is shown only when it can actually land on something.
       Two ways it cannot:
         · no coordinates — geocoding is lazy, so a fresh or unlocatable
           tournament has no pin; and
         · already finished — /karta plots the "upcoming" bucket only, so a
           past tournament would open a map with no pin for it.
       In both cases the control is hidden rather than disabled: a dead button
       on every second row teaches people not to trust the live ones. */
    const canOpenOnMap = !isPast && hasMapCoordinates(item)

    return (
        <HStack
            align="stretch"
            gap="0"
            rounded="xl"
            borderWidth="1px"
            borderColor={highlight ? "brand.emphasized" : "border.subtle"}
            bg="bg.panel"
            shadow={highlight ? "sm" : undefined}
            opacity={isPast ? 0.62 : 1}
            transition="border-color .15s ease, box-shadow .15s ease, transform .15s ease"
            _hover={{ borderColor: "brand.emphasized", shadow: "md", transform: "translateY(-1px)" }}
        >
            <RouterLink
                to={`/turniri/${item.slug ?? item.uuid}`}
                style={{
                    display: "block",
                    // The padding lives on the link, not on the card, so the
                    // whole padded area is part of the tournament's hit target
                    // and only the map button's own box is not.
                    flex: "1 1 auto",
                    minWidth: 0,
                    textDecoration: "none",
                    color: "inherit",
                }}
            >
                <HStack align="stretch" gap="3" p="3">
                    {showDate && <CalendarDateTile item={item} accent={highlight} />}

                    <VStack align="stretch" gap="1.5" flex="1" minW="0">
                        <HStack gap="2" align="start">
                            <Text
                                fontWeight="semibold"
                                fontSize={{ base: "sm", md: "md" }}
                                lineHeight="short"
                                flex="1"
                                minW="0"
                            >
                                {item.name}
                            </Text>
                            {isPast ? (
                                <Badge size="sm" variant="subtle" colorPalette="gray" flexShrink="0">
                                    {t("pages.tournaments.badge.finished")}
                                </Badge>
                            ) : relative ? (
                                <Badge
                                    size="sm"
                                    variant={highlight ? "solid" : "subtle"}
                                    colorPalette="brand"
                                    flexShrink="0"
                                >
                                    {relative}
                                </Badge>
                            ) : null}
                        </HStack>

                        <HStack gap="3" rowGap="1" wrap="wrap" fontSize="xs" minW="0">
                            {item.startAt && (
                                <Meta icon={<FiClock />}>{formatTime(item.startAt)}</Meta>
                            )}
                            {item.location && (
                                <Meta icon={<FiMapPin />}>{item.location}</Meta>
                            )}
                            {typeof item.distanceKm === "number" && (
                                <Meta icon={<FiNavigation />} tone={near ? "near" : "muted"}>
                                    {near
                                        ? `${formatDistanceKm(item.distanceKm)} · ${t("pages.calendar.nearMe.nearBadge")}`
                                        : formatDistanceKm(item.distanceKm)}
                                </Meta>
                            )}
                        </HStack>

                        {/* Phone: price and capacity wrap onto their own line under
                            the location. There is no horizontal room to put them
                            anywhere else, and they are the second thing you look
                            at, not the first. */}
                        {(priceBlock || typeof item.registeredPairs === "number") && (
                            <HStack
                                gap="3"
                                rowGap="1"
                                wrap="wrap"
                                fontSize="xs"
                                minW="0"
                                display={{ base: "flex", md: "none" }}
                            >
                                {priceBlock && <Meta>{priceBlock}</Meta>}
                                {typeof item.registeredPairs === "number" && (
                                    <Meta icon={<FiUsers />}>
                                        {item.registeredPairs}
                                        {typeof item.maxPairs === "number" ? ` / ${item.maxPairs}` : " / ∞"}
                                    </Meta>
                                )}
                            </HStack>
                        )}
                    </VStack>

                    {/* Desktop: the same two facts pinned to the right edge. A row
                        this wide with everything crammed left reads as a broken
                        layout; anchoring price + capacity opposite the title turns
                        the whitespace into a column you can scan down. */}
                    {(priceBlock || typeof item.registeredPairs === "number") && (
                        <VStack
                            align="end"
                            justify="center"
                            gap="1"
                            fontSize="xs"
                            flexShrink="0"
                            pl="2"
                            display={{ base: "none", md: "flex" }}
                        >
                            {priceBlock && (
                                <Text fontWeight="semibold" color="fg.soft">{priceBlock}</Text>
                            )}
                            {typeof item.registeredPairs === "number" && (
                                <Meta icon={<FiUsers />}>
                                    {item.registeredPairs}
                                    {typeof item.maxPairs === "number" ? ` / ${item.maxPairs}` : " / ∞"}
                                </Meta>
                            )}
                        </VStack>
                    )}
                </HStack>
            </RouterLink>

            {/* Map shortcut. Its own column at the card's right edge rather
                than a nested control, so it never competes with the row's
                own click target. On a phone this is the only thing occupying
                that edge — the price/capacity column beside it is desktop
                only — so it costs the already-tight 390px row nothing but its
                own box, and gets a 40px touch target for it. */}
            {canOpenOnMap && (
                <HStack pl={{ base: "1", md: "2" }} pr="3" flexShrink="0">
                    <IconButton
                        asChild
                        aria-label={t("pages.calendar.openOnMapAria", { name: item.name })}
                        title={t("pages.calendar.openOnMap")}
                        size="sm"
                        variant="ghost"
                        colorPalette="brand"
                        minW={{ base: "40px", md: "32px" }}
                        h={{ base: "40px", md: "32px" }}
                    >
                        <RouterLink to={mapLinkFor(item)}>
                            <FiMap />
                        </RouterLink>
                    </IconButton>
                </HStack>
            )}
        </HStack>
    )
}

/** Skeleton with the row's silhouette, so the agenda doesn't jump on load. */
export function CalendarEventRowSkeleton() {
    return (
        <Box
            h={{ base: "88px", md: "96px" }}
            rounded="xl"
            borderWidth="1px"
            borderColor="border.subtle"
            bg="bg.subtle"
        />
    )
}
