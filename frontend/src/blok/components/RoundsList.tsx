import { useCallback, useRef, useState, type MouseEvent, type PointerEvent } from "react"
import { Box, Grid, Text, VStack } from "@chakra-ui/react"

import SuitGlyph from "../../game/components/SuitGlyph"
import { suitKey } from "../../game/util/cards"
import { useTranslation } from "../../i18n"
import { BLOK_SIDES, type BlokRound, type BlokSide } from "../types"
import { sidePalette } from "./blokSide"
import DealScoreCell from "./DealScoreCell"

/* ──────────────────────────────────────────────────────────────────────────
   RoundsList — the played deals, oldest first, the way a paper blok reads.

   One row is: our points, the trump glyph, their points.
   The caller is marked with a filled dot beside their number rather than by
   tinting the row, because "who called" is the one fact you cannot recompute
   from the numbers and it has to survive a reader who cannot separate the two
   hues — a dot is either there or it isn't.

   ── Tap edits, long-press deletes — DECISION (2026-09-08) ─────────────────
   A plain tap opens the deal for editing directly: that is what happens to a
   row ninety-nine times out of a hundred, so it does not deserve an
   intermediate menu. Deleting moves behind a ~500 ms long press (plenty long
   that a scroll's initial touch never trips it, short enough to feel
   intentional), which still opens the SAME `ConfirmDialog` the page already
   owns via `onDelete` — a long press never deletes by itself. Deleting a deal
   is also reachable from inside the edit sheet (`RoundEntrySheet`'s
   `onDelete`, wired in `BlokPage`), which is what makes it reachable at all
   without a pointer: a long press has no keyboard or screen-reader
   equivalent.

   Pointer events, not a mouse/touch pair, drive the gesture, so it behaves
   the same on a phone and with a mouse. The press is cancelled — no delete,
   no visual — on `pointermove` past a small tolerance (a scroll of this very
   list must never fire a delete) and on `pointercancel`/`pointerleave`. The
   click the browser synthesizes right after a completed long press's
   pointerup is swallowed, or the editor would open underneath the delete
   confirmation it just triggered. The row visibly darkens while held, so the
   gesture is discoverable rather than a secret; the browser's own
   (right-click) context menu is left untouched — it is a different gesture
   and does not conflict with this one.
   ────────────────────────────────────────────────────────────────────── */

/** Long enough that a normal tap or the start of a scroll never triggers a
 *  delete; short enough that the gesture still reads as immediate. */
const LONG_PRESS_MS = 500
/** Pointer travel, in px, that cancels a pending long press. */
const LONG_PRESS_MOVE_TOLERANCE = 10

/** Sum of one side's individual declarations in a deal. */
function declSum(values: number[] | undefined): number {
    return (values ?? []).reduce((a, b) => a + b, 0)
}

/** One cell of the footer strip: the caption above, the figure below. The
 *  middle cell has no side, so it paints from `fg.ink` rather than a palette. */
function FooterCell({
    label,
    value,
    palette,
    gridColumn,
}: {
    label: string
    value: number
    palette?: string
    gridColumn?: string
}) {
    return (
        <VStack
            gap="0"
            gridColumn={gridColumn}
            colorPalette={palette}
            w="full"
            align="center"
            justifySelf="stretch"
            textAlign="center"
            overflow="visible"
            whiteSpace="nowrap"
        >
            <Text
                w="full"
                fontSize="2xs"
                color="fg.subtle"
                textAlign="center"
                textTransform="uppercase"
                letterSpacing="0.04em"
                whiteSpace="nowrap"
            >
                {label}
            </Text>
            <Text
                fontSize="sm"
                fontWeight="bold"
                lineHeight="1.15"
                color={palette ? "colorPalette.fg" : "fg.ink"}
                textAlign="center"
                css={{ fontVariantNumeric: "tabular-nums" }}
            >
                {value}
            </Text>
        </VStack>
    )
}

/** One deal row — its own component so the long-press bookkeeping (refs,
 *  timer, the pressed-visual state) is local per row rather than keyed by
 *  index in a shared map on the parent. */
function RoundRow({
    round,
    index,
    total,
    runningTotal,
    names,
    onEdit,
    onDelete,
}: {
    round: BlokRound
    index: number
    total: Record<BlokSide, number>
    runningTotal: Record<BlokSide, number>
    names: Record<BlokSide, string>
    onEdit: (round: BlokRound) => void
    onDelete: (round: BlokRound) => void
}) {
    const { t } = useTranslation()

    const [pressed, setPressed] = useState(false)
    const timerRef = useRef<number | null>(null)
    const originRef = useRef<{ x: number; y: number } | null>(null)
    /** Set when the long-press timer fires, so the `click` the browser
     *  synthesizes right after the matching `pointerup` can be swallowed
     *  instead of also opening the editor. */
    const firedRef = useRef(false)

    const clearTimer = useCallback(() => {
        if (timerRef.current !== null) {
            window.clearTimeout(timerRef.current)
            timerRef.current = null
        }
    }, [])

    const cancelPress = useCallback(() => {
        clearTimer()
        originRef.current = null
        setPressed(false)
    }, [clearTimer])

    function handlePointerDown(e: PointerEvent<HTMLDivElement>) {
        // Only the primary pointer starts the gesture — a mouse right-click
        // is a different, unrelated gesture and keeps its own context menu.
        if (e.button !== 0) return
        originRef.current = { x: e.clientX, y: e.clientY }
        setPressed(true)
        clearTimer()
        timerRef.current = window.setTimeout(() => {
            firedRef.current = true
            setPressed(false)
            onDelete(round)
        }, LONG_PRESS_MS)
    }

    function handlePointerMove(e: PointerEvent<HTMLDivElement>) {
        const origin = originRef.current
        if (!origin) return
        const dx = e.clientX - origin.x
        const dy = e.clientY - origin.y
        if (Math.hypot(dx, dy) > LONG_PRESS_MOVE_TOLERANCE) cancelPress()
    }

    function handlePointerUp() {
        // If the timer already fired, this pointerup belongs to the long
        // press that already ran — nothing left to cancel.
        if (!firedRef.current) cancelPress()
    }

    function handleClick(e: MouseEvent<HTMLDivElement>) {
        if (firedRef.current) {
            e.preventDefault()
            e.stopPropagation()
            firedRef.current = false
            return
        }
        onEdit(round)
    }

    return (
        <Box
            as="button"
            w="100%"
            textAlign="left"
            display="grid"
            gridTemplateColumns="1fr 2.5rem 1fr"
            alignItems="center"
            gap="2"
            px={{ base: "3", md: "4" }}
            py={{ base: "2", md: "2.5" }}
            borderBottomWidth="1px"
            borderColor="border.subtle"
            _last={{ borderBottomWidth: 0 }}
            bg={pressed ? "bg.muted" : undefined}
            transition="background-color 120ms"
            _hover={{ bg: pressed ? "bg.muted" : "bg.subtle" }}
            _focusVisible={{
                outline: "2px solid",
                outlineColor: "brand.focusRing",
                outlineOffset: "-2px",
            }}
            // Long press already replaces the touch-and-hold callout on iOS;
            // `manipulation` also kills the double-tap-to-zoom delay a plain
            // tap would otherwise carry.
            css={{ WebkitTouchCallout: "none", touchAction: "manipulation" }}
            aria-label={`${index + 1}. ${names.us} ${total.us}, ${t("blok.round.runningTotal", { points: runningTotal.us })} — ${names.them} ${total.them}, ${t("blok.round.runningTotal", { points: runningTotal.them })}`}
            title={t("blok.round.edit")}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={cancelPress}
            onPointerLeave={cancelPress}
            onClick={handleClick}
        >
            <DealScoreCell
                side="us"
                name={names.us}
                points={total.us}
                runningTotal={runningTotal.us}
                called={round.caller === "us"}
                declarations={declSum(round.declarations?.us)}
                belot={round.belot === "us"}
            />

            {/* SuitGlyph is decorative (aria-hidden) by design, so the suit's
                NAME is carried by the wrapper — an icon-only trump column must
                not be silent. Names come from the existing `game.suit.*`
                keys, not new blok ones. */}
            <Box
                display="flex"
                justifyContent="center"
                alignItems="center"
                minH="6"
                {...(round.trump
                    ? {
                        role: "img",
                        "aria-label": t(suitKey(round.trump)),
                        title: t(suitKey(round.trump)),
                    }
                    : { "aria-hidden": "true" as const })}
            >
                {round.trump ? (
                    <SuitGlyph suit={round.trump} size={20} />
                ) : (
                    <Box boxSize="1" rounded="full" bg="border.strong" />
                )}
            </Box>

            <DealScoreCell
                side="them"
                name={names.them}
                points={total.them}
                runningTotal={runningTotal.them}
                called={round.caller === "them"}
                declarations={declSum(round.declarations?.them)}
                belot={round.belot === "them"}
            />

        </Box>
    )
}

export default function RoundsList({
    rounds,
    outcomes,
    names,
    target,
    onEdit,
    onDelete,
}: {
    rounds: BlokRound[]
    /** `useBlok().perRound` — same order and length as `rounds`. */
    outcomes: { total: Record<BlokSide, number>; fell: boolean }[]
    names: Record<BlokSide, string>
    target: number
    onEdit: (round: BlokRound) => void
    onDelete: (round: BlokRound) => void
}) {
    const { t } = useTranslation()

    /* NO EMPTY STATE — DECISION 2026-09-08. A first-run panel saying "no deals
       yet" sat directly under two full-width `MI +` / `VI +` buttons, which
       is the same sentence written twice: an empty list under an obvious way
       to fill it explains itself. Rendering nothing also means the scoreboard
       and those buttons start the game closer together on a phone. The
       `round.empty` key is deleted from both dictionaries with this. */
    if (rounds.length === 0) return null

    let runningUs = 0
    let runningThem = 0
    const rows = rounds.map((round, index) => {
        const outcome = outcomes[index]
        const total = outcome?.total ?? { us: 0, them: 0 }
        runningUs += total.us
        runningThem += total.them
        return {
            round,
            total,
            runningTotal: { us: runningUs, them: runningThem },
        }
    })
    const remaining = {
        us: Math.max(0, target - runningUs),
        them: Math.max(0, target - runningThem),
    }
    const difference = Math.abs(runningUs - runningThem)

    return (
        <Box
            borderWidth="1px"
            borderColor="border.subtle"
            rounded="xl"
            bg="bg.panel"
            overflow="hidden"
        >
            {/* Column header — the names again, so a reader who scrolled the
                scoreboard off the top still knows which column is whose. */}
            <Grid
                templateColumns="1fr 2.5rem 1fr"
                alignItems="center"
                gap="2"
                px={{ base: "3", md: "4" }}
                py="2"
                borderBottomWidth="1px"
                borderColor="border.subtle"
                bg="bg.subtle"
            >
                {BLOK_SIDES.map((side, i) => (
                    <Box key={side} gridColumn={i === 0 ? 1 : 3} w="full" textAlign="center">
                        <Text
                            fontSize="2xs"
                            fontWeight="bold"
                            textTransform="uppercase"
                            letterSpacing="0.08em"
                            color="fg.subtle"
                            truncate
                        >
                            {names[side]}
                        </Text>
                    </Box>
                ))}
            </Grid>

            {rows.map(({ round, total, runningTotal }, index) => {
                return (
                    <RoundRow
                        key={round.id}
                        round={round}
                        index={index}
                        total={total}
                        runningTotal={runningTotal}
                        names={names}
                        onEdit={onEdit}
                        onDelete={onDelete}
                    />
                )
            })}

            <Grid
                templateColumns="1fr 2.5rem 1fr"
                alignItems="start"
                gap="2"
                px={{ base: "3", md: "4" }}
                py="1"
                borderColor="border.subtle"
                bg="bg.subtle"
            >
                {/* LABEL ON TOP, FIGURE UNDER IT — 2026-09-08. Side by side,
                    three word+number pairs on one line read as one long
                    sentence and the three numbers never lined up with each
                    other. Stacked, the numbers share a baseline across the
                    row, which is how a column of figures is meant to be
                    scanned. */}
                <FooterCell
                    label={t("blok.round.toGo")}
                    value={remaining.us}
                    palette={sidePalette("us")}
                />
                <FooterCell
                    label={t("blok.round.difference")}
                    value={difference}
                    gridColumn="2"
                />
                <FooterCell
                    label={t("blok.round.toGo")}
                    value={remaining.them}
                    palette={sidePalette("them")}
                    gridColumn="3"
                />
            </Grid>
        </Box>
    )
}
