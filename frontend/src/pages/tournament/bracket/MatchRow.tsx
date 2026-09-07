import React from "react"
import { Badge, Box, HStack, IconButton, Input, Text } from "@chakra-ui/react"
import { FiAward, FiClock, FiEdit2, FiSave, FiX } from "react-icons/fi"

import MatchBillButton from "../../../components/MatchBillButton"
import { useTranslation } from "../../../i18n"
import {
    MATCH_ACTION_COL_W_OWNER,
    MATCH_ACTION_COL_W_OWNER_PHONE,
    MATCH_ACTION_COL_W_VIEWER,
    MATCH_SCORE_COL_W,
    MATCH_STATE_KEY,
    MATCH_STATE_PALETTE,
    MATCH_TABLE_COL_W,
    type MatchLocal,
    focusNextScoreInput,
    matchVisualState,
    winnerOf,
} from "../../../utils/tournamentMatch"
import type { PairShort } from "../../../types/pairs"

export type MatchRowProps = {
    /** Only the id and the completed flag are read — passing the whole round
     *  object would break memoisation, since the round list is a fresh array
     *  after every poll tick and every score keystroke. */
    roundId: number
    roundCompleted: boolean
    m: MatchLocal
    pairById: Map<number, PairShort>
    /** `uuid ?? slug ?? ""` — what the bill endpoints are addressed by. */
    tournamentRef: string
    tournamentFinished: boolean
    canEdit: boolean
    /** The signed-in viewer, for the "is this my bill" check. */
    viewerUid?: string | null
    /** `?bill=` deep link: MatchBillButton auto-opens when this is its id. */
    autoOpenBillId: number | null
    savingMatchId: number | null
    onSaveMatch: (roundId: number, m: MatchLocal) => void
    onSaveEditedMatch: (roundId: number, m: MatchLocal) => void
    onEnterEdit: (roundId: number, matchId: number) => void
    onCancelEdit: (roundId: number, matchId: number) => void
    onScoreChange: (roundId: number, matchId: number, which: "A" | "B", raw: string) => void
    onBillChange: (roundId: number, matchId: number, paidAt: string | null) => void
}

/**
 * One row of the ždrijeb — a single match, in both the mobile scoreboard
 * layout and the dense desktop grid.
 *
 * This used to be a `useCallback` returning 360 lines of JSX from inside the
 * bracket tab's render IIFE, which meant every closure inside it was
 * re-allocated on every keystroke in a score input, for every match in every
 * expanded round. It is a real memoised component now: a round of twelve
 * tables re-renders only the row whose score actually changed.
 */
function MatchRow({
    roundId,
    roundCompleted,
    m,
    pairById,
    tournamentRef,
    tournamentFinished,
    canEdit,
    viewerUid,
    autoOpenBillId,
    savingMatchId,
    onSaveMatch,
    onSaveEditedMatch,
    onEnterEdit,
    onCancelEdit,
    onScoreChange,
    onBillChange,
}: MatchRowProps) {
    const { t: tr } = useTranslation()

    const a = m.pair1Name ?? (m.pair1Id ? pairById.get(m.pair1Id)?.name : undefined) ?? "—"
    const b = m.pair2Name ?? (m.pair2Id ? pairById.get(m.pair2Id)?.name : undefined) ?? (m.pair2Id ? "—" : "-")
    const isFinished = m.status === "FINISHED"
    const editing = !!m._editing
    const canEditNow = !tournamentFinished && !!m.pair1Id && !!m.pair2Id
    const inputsEnabled =
        !!m.pair1Id && !!m.pair2Id &&
        ((!roundCompleted && !isFinished) || (isFinished && editing))

    const winnerSide = winnerOf(m) // null | pair1Id | pair2Id
    const aIsWinner = isFinished && winnerSide != null && winnerSide === m.pair1Id
    const bIsWinner = isFinished && winnerSide != null && winnerSide === m.pair2Id

    /* One palette per state (see MATCH_STATE_PALETTE). The rail is the only
       place colour is spent — the row body stays on the panel surface so a
       score input never sits on a tint that changes colour under the caret
       while it is being typed into. */
    const state = matchVisualState(m)
    const palette = MATCH_STATE_PALETTE[state]
    const stateLabel = tr(MATCH_STATE_KEY[state])
    const shellProps = {
        borderWidth: "1px",
        borderColor: palette ? `${palette}.muted` : "border.emphasized",
        borderLeftWidth: "3px",
        borderLeftColor: palette ? `${palette}.solid` : "border.emphasized",
        rounded: "md",
        bg: "bg.panel",
    } as const

    const actionColW = canEdit ? MATCH_ACTION_COL_W_OWNER : MATCH_ACTION_COL_W_VIEWER
    /* The phone layout gives the same slot more room: its controls are 44px
       tap targets, not the desktop grid's xs icons. */
    const actionColWPhone = canEdit ? MATCH_ACTION_COL_W_OWNER_PHONE : MATCH_ACTION_COL_W_VIEWER

    // Bye — same shell, same rail, same table/action geometry as a real match
    // so it lines up in the list instead of interrupting it.
    if (!m.pair2Id) {
        return (
            <Box
                {...shellProps}
                px="2.5"
                py="2"
                display="flex"
                alignItems="center"
                gap="3"
                role="group"
                aria-label={`${a} — ${stateLabel}`}
            >
                {/* No Stol N chip — the pair doesn't play on a table. The
                    reserved table column carries the bye pill instead: it sits
                    on the same x as every "Stol N" chip above it, so the left
                    edge of the round reads as one column of "where this pair
                    is", and the pair name still starts where every other row's
                    does. */}
                <Box w={MATCH_TABLE_COL_W} flexShrink={0}>
                    <Badge variant="subtle" colorPalette="blue" size="sm" w="full" justifyContent="center">
                        {tr("tournament.bracket.bye")}
                    </Badge>
                </Box>
                <Text
                    fontWeight="semibold"
                    fontSize="sm"
                    flex="1"
                    minW="0"
                    overflow="hidden"
                    textOverflow="ellipsis"
                    whiteSpace="nowrap"
                >
                    {a}
                </Text>
            </Box>
        )
    }

    /* The trailing control. Every arm below is ONE icon-sized control (or two,
       while editing), so the slot it sits in has a constant width and the
       row's geometry can't move with its state.

       The save control STAYS. The score inputs carry an `onChange` and nothing
       else — it writes `_score1`/`_score2` and `_dirty: true` into state and
       stops there. The only three paths that ever reach the server are
       `saveMatch` (this button), `saveEditedMatch` (the edit-mode twin) and
       `finishWholeRound`, which flushes whatever is still `_dirty`. There is
       no blur handler and no debounce, so a score typed without pressing this
       is lost on reload. It is a floppy icon rather than the word "Spremi"
       only so the slot stays the same width as the pencil and the pending
       clock — and it keeps a real name through aria-label + title.

       SIZE: `md` with a 44px floor on the phone layout, `xs` from md up. The
       controls are pressed at the table, one-handed, and an xs icon button is
       a ~24px target — under every tap-target guideline there is. The desktop
       grid keeps the dense original. */
    const tapSize: { base: "md"; md: "xs" } = { base: "md", md: "xs" }
    const tapBox = { minW: { base: "44px", md: "auto" }, minH: { base: "44px", md: "auto" } }

    const actionEl = (
        canEdit && editing ? (
            <HStack gap="1">
                <IconButton
                    aria-label={tr("tournament.match.saveAria")}
                    title={tr("tournament.match.saveAria")}
                    size={tapSize}
                    {...tapBox}
                    variant="solid"
                    colorPalette="orange"
                    loading={savingMatchId === m.id}
                    disabled={savingMatchId != null}
                    onClick={() => onSaveEditedMatch(roundId, m)}
                >
                    <FiSave />
                </IconButton>
                <IconButton
                    aria-label={tr("common.cancel")}
                    title={tr("common.cancel")}
                    size={tapSize}
                    {...tapBox}
                    variant="ghost"
                    disabled={savingMatchId != null}
                    onClick={() => onCancelEdit(roundId, m.id)}
                >
                    <FiX />
                </IconButton>
            </HStack>
        ) : canEdit && m._pending ? (
            // Saved into the offline queue, not yet acknowledged. The score is
            // already on screen; this only says it hasn't landed. It clears
            // itself when the op confirms. An icon, not the old text badge, so
            // it occupies the same slot the save button did and the row
            // doesn't reflow when it saves.
            <Box
                role="img"
                aria-label={tr("tournament.pendingSave")}
                title={tr("tournament.pendingSave")}
                color="orange.fg"
                px="1.5"
                display="flex"
                alignItems="center"
            >
                <FiClock size={15} />
            </Box>
        ) : canEdit && !isFinished && !roundCompleted ? (
            <IconButton
                aria-label={tr("tournament.match.saveAria")}
                title={tr("tournament.match.saveAria")}
                size={tapSize}
                {...tapBox}
                variant="solid"
                colorPalette="orange"
                onClick={() => onSaveMatch(roundId, m)}
                loading={savingMatchId === m.id}
                disabled={!m._dirty || savingMatchId != null}
            >
                <FiSave />
            </IconButton>
        ) : canEdit && isFinished && canEditNow ? (
            <IconButton
                aria-label={tr("tournament.match.editTitle")}
                title={tr("tournament.match.editTitle")}
                size={tapSize}
                {...tapBox}
                variant="ghost"
                onClick={() => onEnterEdit(roundId, m.id)}
            >
                <FiEdit2 />
            </IconButton>
        ) : null
    )

    // Per-match drink-bill button.
    //   Owner: always sees it (acts as bartender).
    //   Players in this match: see it too (their bill).
    //   Everyone else: rendered as null — bills are private.
    const p1Uid = m.pair1Id ? pairById.get(m.pair1Id)?.submittedByUid : null
    const p2Uid = m.pair2Id ? pairById.get(m.pair2Id)?.submittedByUid : null
    const isParticipant = !!viewerUid && (viewerUid === p1Uid || viewerUid === p2Uid)
    const billEl = (
        <MatchBillButton
            tournamentRef={tournamentRef}
            matchId={m.id}
            isBye={!m.pair2Id}
            isFinished={isFinished}
            paidAt={m.paidAt}
            canEdit={canEdit}
            isParticipant={isParticipant}
            autoOpenBillId={autoOpenBillId}
            onChange={(paidAt) => onBillChange(roundId, m.id, paidAt)}
        />
    )

    /* Fixed-width reservation for the bill chip + the trailing control.
       Right-aligned, so the control itself sits on the same x on every row of
       the round whatever state each row is in. */
    const actionSlot = (
        <Box
            w={{ base: actionColWPhone, md: actionColW }}
            flexShrink={0}
            display="flex"
            alignItems="center"
            justifyContent="flex-end"
            gap="1.5"
        >
            {billEl}
            {actionEl}
        </Box>
    )

    const tableBadge = (
        <Box w={MATCH_TABLE_COL_W} flexShrink={0}>
            <Badge variant="subtle" colorPalette="gray" size="sm" w="full" justifyContent="center">
                {tr("tournament.table", { n: m.tableNo })}
            </Badge>
        </Box>
    )

    /* Both sides get the SAME treatment: same container, same bounded width,
       same truncation. The winner is a small award icon, not a
       differently-shaped box — the old build gave pair 1 a filled panel and
       left pair 2 as bare text, so the row read as "one highlighted thing,
       then some text" instead of "A vs B". */
    const pairCell = (name: string, isWinner: boolean, align: "start" | "end") => (
        <HStack
            gap="1.5"
            minW="0"
            justifyContent={align === "end" ? "flex-end" : "flex-start"}
        >
            {align === "start" && isWinner && (
                <Box color="green.fg" flexShrink={0} aria-hidden="true">
                    <FiAward size={13} />
                </Box>
            )}
            <Text
                fontWeight={isWinner ? "semibold" : "normal"}
                color={isWinner ? "fg.ink" : "fg.soft"}
                fontSize="sm"
                overflow="hidden"
                textOverflow="ellipsis"
                whiteSpace="nowrap"
                textAlign={align === "end" ? "right" : "left"}
                minW="0"
            >
                {name}
            </Text>
            {align === "end" && isWinner && (
                <Box color="green.fg" flexShrink={0} aria-hidden="true">
                    <FiAward size={13} />
                </Box>
            )}
        </HStack>
    )

    /* The hot path of the whole screen: scores typed pitchside, on a phone,
       one-handed. Big targets, numeric keypad, and Enter walks to the next box
       so a round is one continuous entry run. */
    const scoreBox = (which: "A" | "B", value: string, size: "sm" | "md", w: string) => (
        <Input
            data-score-input={which}
            size={size}
            type="text"
            inputMode="numeric"
            enterKeyHint="next"
            aria-label={
                which === "A"
                    ? tr("tournament.match.scoreAria", { pair: a })
                    : tr("tournament.match.scoreAria", { pair: b })
            }
            w={w}
            textAlign="center"
            fontWeight="bold"
            value={value}
            onChange={(e) => onScoreChange(roundId, m.id, which, e.target.value)}
            onKeyDown={(e) => {
                if (e.key !== "Enter") return
                e.preventDefault()
                focusNextScoreInput(e.currentTarget)
            }}
            disabled={!inputsEnabled}
        />
    )

    return (
        <Box
            id={`match-${m.id}`}
            role="group"
            /* The accessible half of the colour channel. Deliberately NOT a
               `title`: a native tooltip on the row fires over the score inputs
               too, which is the last place anything should pop up while a
               result is being typed. */
            aria-label={`${a} — ${b} · ${stateLabel}`}
            {...shellProps}
            px="2.5"
            py="2"
        >
            {/* Phone layout — scoreboard style. One pair per line with its own
                score box at the right edge, and a header bar carrying the table
                chip and the same fixed action slot the desktop grid uses. */}
            <Box display={{ base: "flex", md: "none" }} flexDirection="column" gap="1.5">
                <HStack justify="space-between" align="center">
                    {tableBadge}
                    {actionSlot}
                </HStack>
                <HStack gap="2">
                    <Box flex="1" minW="0">{pairCell(a, !!aIsWinner, "start")}</Box>
                    {scoreBox("A", m._score1 ?? "", "md", "64px")}
                </HStack>
                <HStack gap="2">
                    <Box flex="1" minW="0">{pairCell(b, !!bIsWinner, "start")}</Box>
                    {scoreBox("B", m._score2 ?? "", "md", "64px")}
                </HStack>
            </Box>

            {/* Desktop grid. Every column but the two name columns is a FIXED
                width, so the names start and the score boxes sit on the same x
                on every row of the round — a row with a saved result and a row
                still waiting for one are the same shape. */}
            <Box
                display={{ base: "none", md: "grid" }}
                gridTemplateColumns={`${MATCH_TABLE_COL_W} minmax(0, 1fr) ${MATCH_SCORE_COL_W} minmax(0, 1fr) ${actionColW}`}
                alignItems="center"
                gap="2"
            >
                <Badge variant="subtle" colorPalette="gray" size="sm" w="full" justifyContent="center" justifySelf="stretch">
                    {tr("tournament.table", { n: m.tableNo })}
                </Badge>

                {pairCell(a, !!aIsWinner, "start")}

                <HStack gap="1.5" justify="center" flexShrink={0}>
                    {scoreBox("A", m._score1 ?? "", "sm", "48px")}
                    <Text fontSize="sm" fontWeight="bold" color="fg.subtle">:</Text>
                    {scoreBox("B", m._score2 ?? "", "sm", "48px")}
                </HStack>

                {pairCell(b, !!bIsWinner, "end")}

                {actionSlot}
            </Box>
        </Box>
    )
}

export default React.memo(MatchRow)
