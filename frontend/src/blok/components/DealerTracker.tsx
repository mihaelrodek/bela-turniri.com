import { useState } from "react"
import { Button, Dialog, Grid, Icon, Portal, Text } from "@chakra-ui/react"
import { FiRotateCcw, FiRotateCw, FiUser } from "react-icons/fi"

import { useTranslation } from "../../i18n"
import { dealerAt, firstDealerFor } from "../dealer"
import type { BlokDealDirection, BlokDealerSeat, BlokDealerSetup } from "../types"

function dealerLabelKey(seat: BlokDealerSeat): string {
    return `blok.dealer.${seat}`
}

const SEAT_POSITION: Record<BlokDealerSeat, { gridColumn: string; gridRow: string }> = {
    partner: { gridColumn: "2", gridRow: "1" },
    leftOpponent: { gridColumn: "1", gridRow: "2" },
    rightOpponent: { gridColumn: "3", gridRow: "2" },
    self: { gridColumn: "2", gridRow: "3" },
}

/** Four seats around a table, matching how the scorekeeper sees the players. */
const VISUAL_SEATS: readonly BlokDealerSeat[] = ["partner", "leftOpponent", "rightOpponent", "self"]

/**
 * Compact dealer status above the score buttons. Tapping it opens a spatial
 * picker: people stay in their places around the table and the centre control
 * changes the direction, so correcting either setting never requires decoding
 * a dropdown list.
 *
 * The strip itself is OPTIONAL since 2026-09-08 — "Sljedeći dijeli" is a switch
 * in "Postavke" (BLOK.md §3.3.2). The page decides whether to render this at
 * all; nothing here knows about the switch.
 *
 * The direction is a table convention that lives on the game (`dealDirection`)
 * and has its own chips in "Postavke". The centre control here writes that SAME
 * field through `onDirectionChange` — one value, two doors, so the two can
 * never disagree — and the store, not this component, decides what a change
 * does to a hand-set dealer (`store.ts → setDealDirection`).
 */
export default function DealerTracker({
    setup,
    direction,
    roundCount,
    onChange,
    onDirectionChange,
}: {
    setup: BlokDealerSetup
    /** Which way the deal goes round the table — `game.dealDirection`. */
    direction: BlokDealDirection
    roundCount: number
    onChange: (setup: BlokDealerSetup) => void
    onDirectionChange: (direction: BlokDealDirection) => void
}) {
    const { t } = useTranslation()
    const [open, setOpen] = useState(false)
    const choosing = roundCount === 0
    const dealer = dealerAt(setup.first, direction, roundCount)
    const dealsRight = direction === "right"
    const directionLabel = t(dealsRight ? "blok.dealer.right" : "blok.dealer.left")
    /* Dealing to the RIGHT traces counter-clockwise on a table drawn from the
       scorekeeper's own seat at the bottom, so the arrow follows the seats and
       the word follows the table. */
    const DirectionIcon = dealsRight ? FiRotateCcw : FiRotateCw

    function changeDirection() {
        /* One field, written in one place. Whether the seat showing right now
           stays put is `setDealDirection`'s call, because it is the only thing
           that knows whether anybody NAMED that seat. */
        onDirectionChange(dealsRight ? "left" : "right")
    }

    function changeDealer(nextDealer: BlokDealerSeat) {
        onChange({
            first: firstDealerFor(nextDealer, direction, roundCount),
            // Somebody has now said who deals. From here on a change of
            // "Smjer kartanja" keeps this seat instead of re-deriving it.
            chosen: true,
        })
    }

    return (
        <>
            <Button
                w="full"
                minH="2.75rem"
                h="auto"
                px="3"
                py="1.5"
                display="grid"
                gridTemplateColumns="minmax(0, 1fr) auto minmax(0, 1fr)"
                alignItems="center"
                gap="2"
                variant="outline"
                borderColor="border.subtle"
                bg="bg.panel"
                onClick={() => setOpen(true)}
            >
                <Text fontSize="2xs" fontWeight="semibold" color="fg.muted" textAlign="end">
                    {t(choosing ? "blok.dealer.first" : "blok.dealer.next")}
                </Text>
                <Icon boxSize="5" color="fg.ink">
                    <DirectionIcon />
                </Icon>
                <Text fontSize="xs" color="fg.ink" textAlign="start" truncate>
                    {t(dealerLabelKey(dealer))}
                </Text>
            </Button>

            <Dialog.Root open={open} onOpenChange={(e) => setOpen(e.open)} placement="center">
                <Portal>
                    <Dialog.Backdrop />
                    <Dialog.Positioner>
                        <Dialog.Content maxW={{ base: "92%", md: "sm" }}>
                            <Dialog.Header pb="1">
                                <Dialog.Title textAlign="center">
                                    {t(choosing ? "blok.dealer.first" : "blok.dealer.next")}: {t(dealerLabelKey(dealer))}
                                </Dialog.Title>
                            </Dialog.Header>

                            <Dialog.Body px={{ base: "3", md: "6" }}>
                                <Grid
                                    templateColumns="minmax(0, 1fr) 6.5rem minmax(0, 1fr)"
                                    templateRows="auto 6.5rem auto"
                                    alignItems="center"
                                    gap={{ base: "2", md: "3" }}
                                    p={{ base: "3", md: "4" }}
                                    rounded="2xl"
                                    borderWidth="1px"
                                    borderColor="border.subtle"
                                    bg="bg.subtle"
                                >
                                    {VISUAL_SEATS.map((seat) => {
                                        const selected = dealer === seat
                                        return (
                                            <Button
                                                key={seat}
                                                {...SEAT_POSITION[seat]}
                                                minW="0"
                                                h={{ base: "4.75rem", md: "5.25rem" }}
                                                px="2"
                                                display="flex"
                                                flexDirection="column"
                                                gap="1"
                                                variant={selected ? "solid" : "outline"}
                                                colorPalette={selected ? "brand" : undefined}
                                                borderColor={selected ? undefined : "border.strong"}
                                                aria-pressed={selected}
                                                onClick={() => changeDealer(seat)}
                                            >
                                                <FiUser />
                                                <Text
                                                    as="span"
                                                    minW="0"
                                                    maxW="full"
                                                    fontSize="2xs"
                                                    lineHeight="1.15"
                                                    whiteSpace="normal"
                                                    textAlign="center"
                                                >
                                                    {t(dealerLabelKey(seat))}
                                                </Text>
                                            </Button>
                                        )
                                    })}

                                    <Button
                                        gridColumn="2"
                                        gridRow="2"
                                        w="6.5rem"
                                        h="6.5rem"
                                        px="2"
                                        display="flex"
                                        flexDirection="column"
                                        gap="1.5"
                                        rounded="2xl"
                                        colorPalette="brand"
                                        variant="subtle"
                                        // The face is one word ("Desno"); what
                                        // it names is the setting, and the
                                        // accessible name has to say both.
                                        aria-label={`${t("blok.dealer.direction")}: ${directionLabel}`}
                                        title={`${t("blok.dealer.direction")}: ${directionLabel}`}
                                        onClick={changeDirection}
                                    >
                                        <DirectionIcon size={30} />
                                        <Text
                                            as="span"
                                            fontSize="2xs"
                                            lineHeight="1.15"
                                            textAlign="center"
                                            whiteSpace="normal"
                                        >
                                            {directionLabel}
                                        </Text>
                                    </Button>
                                </Grid>
                            </Dialog.Body>

                            <Dialog.Footer>
                                <Button colorPalette="brand" onClick={() => setOpen(false)}>
                                    {t("common.close")}
                                </Button>
                            </Dialog.Footer>
                        </Dialog.Content>
                    </Dialog.Positioner>
                </Portal>
            </Dialog.Root>
        </>
    )
}
