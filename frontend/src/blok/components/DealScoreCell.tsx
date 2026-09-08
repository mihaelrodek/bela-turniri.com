import { Box, Grid, Text } from "@chakra-ui/react"

import { useTranslation } from "../../i18n"
import type { BlokSide } from "../types"
import { sidePalette } from "./blokSide"

/** Shared score cell used by the live blok, local series history and shares. */
export default function DealScoreCell({
    side,
    name,
    points,
    runningTotal,
    called,
    declarations,
    belot = false,
    compact = false,
}: {
    side: BlokSide
    name: string
    points: number
    runningTotal: number
    called: boolean
    /** Sum of this side's declarations in the deal. */
    declarations: number
    /**
     * True when THIS side showed the belot in this deal (BLOK.md §1.2).
     *
     * It gets a word, not a colour and not merely a big number: the award is
     * the game's target, so the figure above it is already unlike any other
     * deal's — but "1001" alone does not say WHY, and this cell is the only
     * place a finished deal is ever read again (the live list, the series
     * panel, the profile history and the shared record all draw it). A deal
     * whose badge is missing here is a deal nobody can explain afterwards.
     */
    belot?: boolean
    compact?: boolean
}) {
    const { t } = useTranslation()
    const calledBy = t("blok.round.calledBy", { side: name })
    const declaration = declarations > 0 ? (
        <Text
            fontSize="2xs"
            color="fg.subtle"
            lineHeight="1"
            whiteSpace="nowrap"
            css={{ fontVariantNumeric: "tabular-nums" }}
        >
            +{declarations}
        </Text>
    ) : null
    const caller = called ? (
        <Box
            boxSize={compact ? "1.5" : "2"}
            rounded="full"
            bg="colorPalette.solid"
            flexShrink="0"
            role="img"
            aria-label={calledBy}
            title={calledBy}
        />
    ) : null

    /* The number sits in the MIDDLE track of a grid whose two side tracks are
       a FIXED width — not in a flex row beside its neighbours. That is the
       whole point: `+50` is wider than `+20`, and the caller dot is there or
       it is not, so an `HStack` moved the figure by a different amount on
       every row and the column stopped reading as a column. With fixed side
       tracks the digits land on the same centre line in every deal, whatever
       hangs off them, and the two sides line up with each other and with the
       trump between them. */
    const gutter = compact ? "2.25rem" : "2.75rem"

    return (
        <Box colorPalette={sidePalette(side)} minW="0" textAlign="center">
            <Grid
                templateColumns={`${gutter} auto ${gutter}`}
                alignItems="center"
                justifyContent="center"
                columnGap="1.5"
                minH={compact ? "5" : "6"}
            >
                {/* Pushed against the number so the pair still reads as one
                    unit; the track keeps its width when the cell is empty. */}
                <Box justifySelf="end" minW="0">{side === "us" ? declaration : caller}</Box>
                <Text
                    fontSize={compact ? "sm" : { base: "xl", md: "2xl" }}
                    fontWeight="semibold"
                    lineHeight="1.1"
                    color={points > 0 ? "colorPalette.fg" : "fg.subtle"}
                    /* The MIDDLE track is fixed too, wide enough for the
                       longest deal score (252). Otherwise an `auto` track is
                       as wide as its digits, so "0" and "141" put their `+20`
                       in different places down the column — which is what the
                       fixed gutters alone did not fix. */
                    minW={compact ? "2rem" : "2.75rem"}
                    textAlign="center"
                    css={{ fontVariantNumeric: "tabular-nums" }}
                >
                    {points}
                </Text>
                <Box justifySelf="start" minW="0">{side === "us" ? caller : declaration}</Box>
            </Grid>
            <Text
                fontSize="2xs"
                color="fg.muted"
                lineHeight="1.15"
                css={{ fontVariantNumeric: "tabular-nums" }}
            >
                Σ {runningTotal}
            </Text>
            {belot && (
                /* Under the running total rather than beside the figure: the
                   two side tracks of the grid above are a FIXED width that
                   keeps every deal's digits on one centre line, and a word
                   dropped into one of them would push this row's number off
                   that line. A belot happens once and ends the game, so the
                   one row that grows by a line is the one nobody is scanning
                   past. `solid`/`contrast` is the pair Chakra keeps legible in
                   both themes over either side's palette. */
                <Box
                    display="inline-block"
                    mt="0.5"
                    px="1.5"
                    rounded="full"
                    bg="colorPalette.solid"
                    color="colorPalette.contrast"
                    fontSize="2xs"
                    fontWeight="bold"
                    lineHeight="16px"
                    textTransform="uppercase"
                    letterSpacing="wide"
                >
                    {t("blok.entry.belot")}
                </Box>
            )}
        </Box>
    )
}
