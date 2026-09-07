import type { ReactNode } from "react"
import { HStack, Text, VStack } from "@chakra-ui/react"

/* ──────────────────────────────────────────────────────────────────────────
   rowPrimitives — the two pieces every tournament row is assembled from.

   `ListingRow` (the /turniri list view) and `CalendarEventRow` (the /kalendar
   agenda) are deliberately the same object rendered twice: date tile, then a
   two-line body, then the numbers. Each of them had shipped its own private
   `DateTile` and its own private `Meta`, and the two copies had already
   drifted — different `minW`, different weekday weight (bold vs semibold),
   different letter-spacing (`0.1em` vs `wider`), different day line-height,
   and only one of them coloured the day number differently from the rest of
   the tile. Side by side on two screens that show the same tournaments, that
   reads as two components rather than one.

   This is the union of the two, so both screens now share a single
   definition:
     · `minW` from the calendar copy (the wider one — a two-digit day plus a
       three-letter Croatian weekday needs it);
     · weekday/month set in `semibold` at `0.08em`, which is legible at 2xs
       without the shout of `bold` at `0.1em`;
     · the day number always in `fg.ink` / `brand.fg`, so it stays the loudest
       thing in the tile even when the tile itself is muted.

   Not shared: `ListingCard`'s date tile. That one is painted on top of a
   poster photograph, so its colours are fixed literals rather than surface
   tokens (see the SCRIM note there) — it is a different component that
   happens to show the same three lines.
   ────────────────────────────────────────────────────────────────────── */

/**
 * Left-hand date tile: weekday above, day number, optionally a month below.
 *
 * Takes already-localised strings rather than a Date: the two call sites
 * derive their parts differently (the listing has a shared `useDateParts`,
 * the calendar reads `WEEKDAY_KEYS` off the raw `startAt`), and keeping the
 * tile out of the formatting business means it can never disagree with
 * `utils/format.ts` about what locale is active.
 *
 * `month` is omitted by the calendar agenda on purpose — a sticky month
 * heading is always on screen above the row there, so repeating it would only
 * make the tile wider for no added information.
 */
export function DateTile({
    weekday,
    day,
    month,
    accent = false,
}: {
    weekday: string
    day: string
    month?: string
    /** Brand-tinted rather than quiet — the next tournament, or an upcoming
     *  one in a list whose finished rows are muted. */
    accent?: boolean
}) {
    return (
        <VStack
            gap="0"
            justify="center"
            minW={{ base: "48px", md: "56px" }}
            px="1"
            py="2"
            rounded="lg"
            bg={accent ? "brand.subtle" : "bg.subtle"}
            color={accent ? "brand.fg" : "fg.muted"}
            flexShrink="0"
        >
            <Text fontSize="2xs" fontWeight="semibold" letterSpacing="0.08em" lineHeight="1.35">
                {weekday}
            </Text>
            <Text
                fontSize={{ base: "lg", md: "xl" }}
                fontWeight="bold"
                lineHeight="1.1"
                color={accent ? "brand.fg" : "fg.ink"}
            >
                {day}
            </Text>
            {month ? (
                <Text fontSize="2xs" fontWeight="semibold" letterSpacing="0.08em" lineHeight="1.35">
                    {month}
                </Text>
            ) : null}
        </VStack>
    )
}

/** One meta item on a row's secondary line — icon + value.
 *
 *  `tone="near"` is the calendar's "this one is close to you" emphasis; the
 *  listing never passes it, which is why it defaults to muted. */
export function Meta({
    icon,
    children,
    tone = "muted",
}: {
    icon?: ReactNode
    children: ReactNode
    tone?: "muted" | "near"
}) {
    return (
        <HStack
            gap="1"
            color={tone === "near" ? "brand.fg" : "fg.muted"}
            fontWeight={tone === "near" ? "semibold" : "normal"}
            minW="0"
        >
            {icon}
            <Text truncate>{children}</Text>
        </HStack>
    )
}
