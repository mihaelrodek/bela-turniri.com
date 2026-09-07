import type { ReactNode } from "react"
import type { BoxProps } from "@chakra-ui/react"
import { Box, HStack, Text } from "@chakra-ui/react"

/**
 * Compact "tile" for a single labelled fact. Tiny uppercase muted label, a
 * prominent value — designed to fit several per row in a responsive grid.
 *
 * TWO LAYOUTS, because two pages had grown their own copy of this idea:
 *
 *   • `layout="stacked"` (default) — the tournament detail page's tile: the
 *     label sits on its own line above the value, so the value can be a whole
 *     block (a rewards breakdown, a multi-line description).
 *   • `layout="inline"` — the public profile page's "Moji podaci" row: icon,
 *     then label-over-value in a tight column beside it, for one short string.
 *
 * Three weights, because a date and a three-place prize breakdown do not
 * deserve the same amount of ink:
 *   • default — a quiet fill, no border, no shadow. The scannable facts.
 *   • `accent` — the same quiet fill with a brand hairline down its left
 *     edge. Used for the identity row (organiser, contact, date, time) so it
 *     reads as a header band above the neutral stats row without needing a
 *     heading of its own.
 *   • `emphasis` — a real panel with a hairline and the card shadow. Reserved
 *     for the tiles that carry a block of content of their own.
 */
export type DetailTileProps = {
    icon?: ReactNode
    label: string
    /** A string for the inline layout; any node for the stacked one. */
    value: ReactNode
    /** Responsive grid column span (e.g. {{ md: "span 2", lg: "span 3" }}). */
    span?: BoxProps["gridColumn"]
    /** Promote the tile to a bordered panel — see the note above. */
    emphasis?: boolean
    /** Draw the brand stripe down the left edge — see the note above. */
    accent?: boolean
    /** Label above the value (default) or beside the icon in one row. */
    layout?: "stacked" | "inline"
    /** Truncate the value to one line. Always on for the inline layout. */
    truncate?: boolean
}

export default function DetailTile({
    icon,
    label,
    value,
    span,
    emphasis,
    accent,
    layout = "stacked",
    truncate,
}: DetailTileProps) {
    if (layout === "inline") {
        return (
            <HStack
                gap="2.5"
                align="center"
                borderWidth="1px"
                borderColor="border.subtle"
                bg={emphasis ? "bg.panel" : "bg.subtle"}
                shadow={emphasis ? "card" : undefined}
                rounded="md"
                px="3"
                py="2.5"
                minW="0"
                gridColumn={span}
            >
                {icon && (
                    <Box color="fg.muted" display="flex" flexShrink={0}>
                        {icon}
                    </Box>
                )}
                <Box minW="0">
                    <Text
                        fontSize="2xs"
                        color="fg.muted"
                        textTransform="uppercase"
                        letterSpacing="wider"
                        fontWeight="bold"
                    >
                        {label}
                    </Text>
                    <Text fontSize="sm" fontWeight="medium" truncate={truncate ?? true}>
                        {value}
                    </Text>
                </Box>
            </HStack>
        )
    }

    return (
        <Box
            position="relative"
            overflow="hidden"
            borderWidth="1px"
            borderColor={emphasis ? "border.subtle" : "transparent"}
            rounded="lg"
            shadow={emphasis ? "card" : undefined}
            pl={accent ? "3.5" : "3"}
            pr="3"
            py="2.5"
            bg={emphasis ? "bg.panel" : "bg.subtle"}
            gridColumn={span}
            minW="0"
            colorPalette="brand"
        >
            {accent && (
                <Box
                    position="absolute"
                    insetStart="0"
                    top="0"
                    bottom="0"
                    w="3px"
                    bg="colorPalette.solid"
                />
            )}
            <HStack mb="1.5" gap="1.5">
                {icon && (
                    <Box color="fg.muted" display="flex" alignItems="center">
                        {icon}
                    </Box>
                )}
                <Text
                    fontSize="2xs"
                    fontWeight="semibold"
                    color="fg.muted"
                    letterSpacing="wider"
                    textTransform="uppercase"
                >
                    {label}
                </Text>
            </HStack>
            <Box fontSize="md" fontWeight="medium" truncate={truncate}>
                {value}
            </Box>
        </Box>
    )
}
