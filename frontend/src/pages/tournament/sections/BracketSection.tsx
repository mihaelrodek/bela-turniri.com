import { useCallback, useEffect, useRef, useState } from "react"
import type { Dispatch, SetStateAction } from "react"
import {
    Badge,
    Box,
    Button,
    Card,
    Dialog,
    Heading,
    HStack,
    Icon,
    IconButton,
    Menu,
    Popover,
    Spinner,
    Switch,
    Text,
    VStack,
} from "@chakra-ui/react"
import {
    FiAward,
    FiCheckCircle,
    FiChevronDown,
    FiChevronRight,
    FiChevronUp,
    FiFlag,
    FiHelpCircle,
    FiLayers,
    FiMaximize2,
    FiMinimize2,
    FiMoreHorizontal,
    FiPlay,
    FiRefreshCw,
    FiRotateCcw,
    FiShuffle,
    FiX,
} from "react-icons/fi"

import MatchRow from "../bracket/MatchRow"
import FullscreenRoundBoard from "../bracket/FullscreenRoundBoard"
import { FS_SIZE_STORAGE_KEY, type FsSize, readStoredFsSize } from "../bracket/fullscreenSize"
import { useTranslation } from "../../../i18n"
import { canFinish, type MatchLocal, type RoundLocal } from "../../../utils/tournamentMatch"
import type { PairShort } from "../../../types/pairs"
import type { TournamentDetails } from "../../../types/tournaments"

export type BracketSectionProps = {
    t: TournamentDetails
    rounds: RoundLocal[]
    collapsedRounds: Record<number, boolean>
    setCollapsedRounds: Dispatch<SetStateAction<Record<number, boolean>>>
    sortedMatchesByRound: Map<number, MatchLocal[]>
    pairById: Map<number, PairShort>
    canEditTournament: boolean
    viewerUid?: string | null
    autoOpenBillId: number | null
    /* settings */
    allowRepeats: boolean
    savingPM: boolean
    onToggleAllowRepeats: (next: boolean) => void
    /* tournament lifecycle */
    tournamentStarted: boolean
    canStart: boolean
    startingTournament: boolean
    onStartTournament: () => void
    canFinishTournament: boolean
    finishingTournament: boolean
    onFinishTournament: () => void
    showResetTournament: boolean
    resettingTournament: boolean
    onOpenResetTournament: () => void
    /* rounds */
    canCreateRound: boolean
    creatingRound: boolean
    onCreateRound: () => void
    showManualRoundButton: boolean
    onClickManualRound: () => void
    finishingRoundId: number | null
    onFinishRound: (r: RoundLocal) => void
    hardResettingRound: boolean
    onRequestHardResetRound: (roundId: number) => void
    toggleRoundCollapsed: (id: number) => void
    /* matches */
    savingMatchId: number | null
    onSaveMatch: (roundId: number, m: MatchLocal) => void
    onSaveEditedMatch: (roundId: number, m: MatchLocal) => void
    onEnterEdit: (roundId: number, matchId: number) => void
    onCancelEdit: (roundId: number, matchId: number) => void
    onScoreChange: (roundId: number, matchId: number, which: "A" | "B", raw: string) => void
    onBillChange: (roundId: number, matchId: number, paidAt: string | null) => void
    /* the "at least two paid pairs" modal, opened by a 409 on start */
    unpaidOpen: boolean
    onCloseUnpaid: () => void
}

/**
 * "Ždrijeb" — the toolbar, the round list and the two overlays that belong to
 * it (the venue-display fullscreen board and the UNPAID_REQUIRED modal).
 *
 * Everything here is presentation plus local view state (which rounds are
 * collapsed lives on the page, because the poll seeds new round ids into it;
 * the fullscreen board's own size preference lives here, because nothing else
 * reads it). Every mutation arrives as a prop from `useTournamentRounds`.
 */
export default function BracketSection(props: BracketSectionProps) {
    const {
        t,
        rounds,
        setCollapsedRounds,
        collapsedRounds,
        sortedMatchesByRound,
        pairById,
        canEditTournament,
        viewerUid,
        autoOpenBillId,
        allowRepeats,
        savingPM,
        onToggleAllowRepeats,
        tournamentStarted,
        canStart,
        startingTournament,
        onStartTournament,
        canFinishTournament,
        finishingTournament,
        onFinishTournament,
        showResetTournament,
        resettingTournament,
        onOpenResetTournament,
        canCreateRound,
        creatingRound,
        onCreateRound,
        showManualRoundButton,
        onClickManualRound,
        finishingRoundId,
        onFinishRound,
        hardResettingRound,
        onRequestHardResetRound,
        toggleRoundCollapsed,
        savingMatchId,
        onSaveMatch,
        onSaveEditedMatch,
        onEnterEdit,
        onCancelEdit,
        onScoreChange,
        onBillChange,
        unpaidOpen,
        onCloseUnpaid,
    } = props

    const { t: tr } = useTranslation()

    const [fullscreenRound, setFullscreenRound] = useState<number | null>(null)
    /* Card size on the fullscreen board. Persisted so the organiser sets it
       once for the room they are in and it survives closing and reopening the
       overlay — same sessionStorage lifetime as the tournaments list's
       grid/list preference. */
    const [fsSize, setFsSize] = useState<FsSize>(readStoredFsSize)
    useEffect(() => {
        try {
            window.sessionStorage.setItem(FS_SIZE_STORAGE_KEY, fsSize)
        } catch {
            /* private mode — the choice just doesn't survive the reload */
        }
    }, [fsSize])

    /* ---- Real (browser) fullscreen, on top of the overlay ----
       The overlay itself is a Chakra Dialog, not `requestFullscreen()`: the
       dialog is what gives Escape, the focus trap, the scroll lock and an
       accessible name for free, and it is the only thing that works on an
       iPhone, where `Element.requestFullscreen` does not exist at all. But a
       venue display genuinely wants the address bar and the tab strip gone,
       so the browser's own fullscreen is offered ON the dialog content as an
       extra, from a real click (transient activation is required, so this
       cannot be auto-requested reliably on open) and only where the browser
       says it is available. */
    const fsContentRef = useRef<HTMLDivElement | null>(null)
    const [nativeFs, setNativeFs] = useState(false)
    useEffect(() => {
        const sync = () => setNativeFs(document.fullscreenElement != null)
        document.addEventListener("fullscreenchange", sync)
        return () => document.removeEventListener("fullscreenchange", sync)
    }, [])
    const toggleNativeFs = useCallback(() => {
        if (document.fullscreenElement) {
            void document.exitFullscreen().catch(() => {})
            return
        }
        const el = fsContentRef.current
        // Optional-call: Safari on iOS has no element-level fullscreen.
        void el?.requestFullscreen?.().catch(() => {})
    }, [])
    /* Closing the overlay must not leave the tab in browser fullscreen with
       the ordinary page underneath it. */
    const closeFullscreenRound = useCallback(() => {
        if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
        setFullscreenRound(null)
    }, [])

    const allCollapsed = rounds.length > 0 && rounds.every((r) => collapsedRounds[r.id])
    const activeRoundId = rounds.find((r) => r.status !== "COMPLETED")?.id
    const tournamentFinished = t.status === "FINISHED"
    const tournamentRef = t.uuid ?? t.slug ?? ""

    /* ===== Pre-start ===== */
    // The ždrijeb gets a single friendly "Turnir još nije započeo" card. The
    // organiser also sees the toolbar above it so they can hit "Startaj
    // turnir"; everyone else just sees the message.
    if (!tournamentStarted) {
        return (
            <VStack align="stretch" gap="4">
                {canEditTournament && (
                    <Card.Root variant="outline" rounded="xl" borderColor="border.emphasized" shadow="sm">
                        <Card.Body py="3" px={{ base: "3", md: "4" }}>
                            <HStack gap="2" wrap="wrap" justify="flex-end">
                                <Button
                                    size="sm"
                                    variant="solid"
                                    colorPalette="orange"
                                    onClick={onStartTournament}
                                    loading={startingTournament}
                                    disabled={!canStart || startingTournament}
                                    title={
                                        !canStart
                                            ? tr("tournament.start.needTwoPaid")
                                            : tr("tournament.start.startTitle")
                                    }
                                >
                                    <FiPlay /> {tr("tournament.start.button")}
                                </Button>
                            </HStack>
                        </Card.Body>
                    </Card.Root>
                )}
                <Box
                    borderWidth="1px"
                    borderColor="border.emphasized"
                    borderStyle="dashed"
                    rounded="xl"
                    py="12"
                    px="6"
                >
                    <VStack gap="2">
                        <Box color="fg.muted"><FiLayers size={28} /></Box>
                        <Text fontWeight="medium">{tr("tournament.bracket.notStartedTitle")}</Text>
                        <Text color="fg.muted" fontSize="sm" textAlign="center">
                            {canEditTournament
                                ? tr("tournament.bracket.notStartedOwner")
                                : tr("tournament.bracket.notStartedViewer")}
                        </Text>
                    </VStack>
                </Box>
            </VStack>
        )
    }

    /* Tournament has started — show the toolbar. It hosts owner-only settings
       (repeats switch) and owner-only actions (Generiraj / Završi / Resetiraj
       turnir) plus the Sažmi/Proširi sve toggle which everyone benefits from.
       The toolbar renders inside a bordered Card.Root ONLY when the organiser
       has settings/actions to show; for non-owners (or after the tournament is
       finished) the Sažmi sve button stands alone in a slim flex row without
       the heavy card frame. */
    const ownerToolbar = canEditTournament && !tournamentFinished
    const showToolbar = ownerToolbar || rounds.length > 0
    const showRepeatsSetting = ownerToolbar
    const toolbarTwoColumn = showRepeatsSetting
    /* The demoted half of the toolbar. `ownerToolbar` carries the canEdit +
       not-finished gates; `tournamentStarted` is guaranteed by the early
       return above. */
    const showOverflowMenu = ownerToolbar && (showManualRoundButton || showResetTournament)

    /* The toolbar's contents, built once. It used to be rendered through a
       `const ToolbarShell = ownerToolbar ? Card.Root : Box` component
       variable — which made the props objects untyped and hid the fact that
       the two shells are genuinely different elements. Now the two wrappers
       are written out and only the CONTENT is shared. */
    const toolbarInner = (
        <Box
            display="grid"
            gridTemplateColumns={toolbarTwoColumn
                ? { base: "1fr", lg: "auto 1fr" }
                : "1fr"}
            gap={{ base: "3", lg: "6" }}
            alignItems="center"
        >
            {/* Settings — owner only AND only while the tournament isn't
                finished. Once it's over the matchmaking rule can't be changed
                anymore and the toggle just clutters the results screen. */}
            {showRepeatsSetting && (
                /* Compact: switch + short label on one line. The two-line
                   explanation that used to sit under the label cost the
                   toolbar a whole strip on a screen where the toolbar is the
                   least-used thing on it; it now lives behind the "?" — a
                   popover rather than a `title`, because a native tooltip is
                   unreachable on the phone this screen is actually used on. */
                <HStack
                    gap="2"
                    align="center"
                    borderRightWidth={{ base: "0", lg: "1px" }}
                    borderRightColor="border.subtle"
                    pr={{ base: "0", lg: "5" }}
                >
                    <Switch.Root
                        checked={allowRepeats}
                        onCheckedChange={(e) => onToggleAllowRepeats(e.checked)}
                        colorPalette={allowRepeats ? "green" : "gray"}
                        disabled={savingPM}
                    >
                        <Switch.HiddenInput />
                        <Switch.Control cursor={savingPM ? "not-allowed" : "pointer"}>
                            <Switch.Thumb />
                        </Switch.Control>
                        <Switch.Label fontSize="sm" fontWeight="medium">
                            {tr("tournament.settings.allowRepeatsLabel")}
                        </Switch.Label>
                    </Switch.Root>
                    <Popover.Root positioning={{ placement: "bottom-start" }}>
                        <Popover.Trigger asChild>
                            <IconButton
                                aria-label={tr("tournament.settings.allowRepeatsHelp")}
                                title={tr("tournament.settings.allowRepeatsHelp")}
                                size="2xs"
                                variant="ghost"
                                color="fg.muted"
                            >
                                <FiHelpCircle />
                            </IconButton>
                        </Popover.Trigger>
                        <Popover.Positioner>
                            <Popover.Content maxW="264px">
                                <Popover.Body fontSize="sm" color="fg.soft">
                                    {tr("tournament.settings.allowRepeatsHint")}
                                </Popover.Body>
                            </Popover.Content>
                        </Popover.Positioner>
                    </Popover.Root>
                    {savingPM && <Spinner size="xs" />}
                </HStack>
            )}

            {/* Actions */}
            <HStack gap="2" wrap="wrap" justify={{ base: "flex-start", lg: "flex-end" }}>
                {rounds.length > 0 && (
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                            setCollapsedRounds((prev) => {
                                const target = !(rounds.length > 0 && rounds.every((r) => prev[r.id]))
                                const next: Record<number, boolean> = {}
                                rounds.forEach((r) => { next[r.id] = target })
                                return next
                            })
                        }
                    >
                        {allCollapsed
                            ? <><FiChevronDown /> {tr("tournament.expandAll")}</>
                            : <><FiChevronUp /> {tr("tournament.collapseAll")}</>}
                    </Button>
                )}
                {!tournamentStarted && canEditTournament && (
                    <Button
                        size="sm"
                        variant="solid"
                        colorPalette="orange"
                        onClick={onStartTournament}
                        loading={startingTournament}
                        disabled={!canStart || startingTournament}
                        title={
                            !canStart
                                ? tr("tournament.start.needTwoPaid")
                                : tr("tournament.start.startTitle")
                        }
                    >
                        <FiPlay /> {tr("tournament.start.button")}
                    </Button>
                )}
                {tournamentStarted && !tournamentFinished && canEditTournament && (
                    <Button
                        size="sm"
                        variant="solid"
                        colorPalette="blue"
                        onClick={onCreateRound}
                        loading={creatingRound}
                        disabled={!canCreateRound || creatingRound}
                        title={canCreateRound ? tr("tournament.round.generateNextTitle") : tr("tournament.round.generateBlockedTitle")}
                    >
                        <Icon as={FiShuffle} />{" "}
                        {rounds.length === 0
                            ? tr("tournament.round.generateFirst")
                            : tr("tournament.round.generate")}
                    </Button>
                )}
                {canFinishTournament && (
                    <Button
                        size="sm"
                        variant="solid"
                        colorPalette="green"
                        onClick={onFinishTournament}
                        loading={finishingTournament}
                        disabled={finishingTournament}
                    >
                        <FiFlag /> {tr("tournament.finish.button")}
                    </Button>
                )}
                {/* Everything that is NOT the next thing you press.
                    "Resetiraj turnir" wipes every round in the tournament and
                    used to sit one slip away from "Generiraj rundu", the single
                    most-pressed button on the screen, on a phone, in a hall, in
                    a hurry. It is behind this menu now: two deliberate taps,
                    then the ConfirmDialog it always routed through. Manual
                    generation rides along — rare, and it was crowding the
                    primary row for no benefit. */}
                {showOverflowMenu && (
                    <Menu.Root>
                        <Menu.Trigger asChild>
                            <IconButton
                                aria-label={tr("tournament.bracket.moreActions")}
                                title={tr("tournament.bracket.moreActions")}
                                size="sm"
                                variant="ghost"
                                ml="1"
                            >
                                <FiMoreHorizontal />
                            </IconButton>
                        </Menu.Trigger>
                        <Menu.Positioner>
                            <Menu.Content minW="230px">
                                {showManualRoundButton && (
                                    <Menu.Item
                                        value="manual-round"
                                        onSelect={onClickManualRound}
                                    >
                                        <FiShuffle /> {tr("tournament.round.manualButton")}
                                    </Menu.Item>
                                )}
                                {showResetTournament && (
                                    <Menu.Item
                                        value="reset-tournament"
                                        color="red.fg"
                                        title={tr("tournament.reset.title")}
                                        disabled={resettingTournament}
                                        onSelect={onOpenResetTournament}
                                    >
                                        <FiRefreshCw /> {tr("tournament.reset.button")}
                                    </Menu.Item>
                                )}
                            </Menu.Content>
                        </Menu.Positioner>
                    </Menu.Root>
                )}
            </HStack>
        </Box>
    )

    const fsRound = fullscreenRound != null
        ? rounds.find((r) => r.id === fullscreenRound) ?? null
        : null
    const fsMatches = fullscreenRound != null
        ? sortedMatchesByRound.get(fullscreenRound) ?? []
        : []
    /* False inside an iframe without `allowfullscreen`, and on iOS Safari —
       hide the control rather than offer one that does nothing. */
    const canGoNative = typeof document !== "undefined" && document.fullscreenEnabled

    return (
        <>
            {/* One column, capped on purpose. Rounds side by side were
                considered and rejected: App.tsx wraps the whole app in
                `Container maxW="6xl"` (1152px) and the sidebar takes a fixed
                244px, so this column tops out around 880px — two columns would
                be ~430px each, which cannot hold a match row (table chip, two
                pair names, two score boxes, the action slot) without truncating
                the names to nothing. */}
            <VStack align="stretch" gap="4" maxW="56rem">
                {/* ===== Toolbar ===== */}
                {showToolbar && (
                    ownerToolbar ? (
                        <Card.Root variant="outline" rounded="xl" borderColor="border.emphasized" shadow="sm">
                            <Card.Body py="3" px={{ base: "3", md: "4" }}>
                                {toolbarInner}
                            </Card.Body>
                        </Card.Root>
                    ) : (
                        <Box>
                            <Box py="0" px="0">
                                {toolbarInner}
                            </Box>
                        </Box>
                    )
                )}

                {/* ===== Rounds ===== */}
                {rounds.length === 0 ? (
                    <Box
                        borderWidth="1px"
                        borderColor="border.emphasized"
                        borderStyle="dashed"
                        rounded="xl"
                        py="12"
                        px="6"
                    >
                        <VStack gap="2">
                            <Box color="fg.muted"><FiLayers size={28} /></Box>
                            <Text fontWeight="medium">{tr("tournament.bracket.noRoundsTitle")}</Text>
                            <Text color="fg.muted" fontSize="sm" textAlign="center">
                                {/* Only the organiser sees the actionable
                                    instructions — for everyone else that text is
                                    misleading because they have no buttons to
                                    act on. They get a neutral "waiting" message
                                    instead. */}
                                {canEditTournament
                                    ? tournamentStarted
                                        ? tr("tournament.bracket.noRoundsOwnerStarted")
                                        : tr("tournament.bracket.noRoundsOwnerDraft")
                                    : tr("tournament.bracket.noRoundsViewer")}
                            </Text>
                        </VStack>
                    </Box>
                ) : (
                    <VStack align="stretch" gap="3">
                        {rounds.map((r, rIdx) => {
                            const collapsed = !!collapsedRounds[r.id]
                            const isActive = r.id === activeRoundId
                            const completed = r.status === "COMPLETED"
                            const finishable = canFinish(r) && !completed

                            return (
                                <Card.Root
                                    key={r.id}
                                    // Tour anchor on the first round so the
                                    // "proširi / fullscreen" step has a
                                    // concrete element to point at.
                                    data-tour={rIdx === 0 ? "detail-first-round" : undefined}
                                    variant="outline"
                                    rounded="xl"
                                    borderColor={isActive ? "blue.muted" : "border.emphasized"}
                                    borderLeftWidth={isActive ? "4px" : "1px"}
                                    borderLeftColor={isActive ? "blue.solid" : "border.emphasized"}
                                    opacity={completed ? 0.92 : 1}
                                    shadow="sm"
                                >
                                    {/* Header */}
                                    <Card.Header py="3" px={{ base: "3", md: "4" }}>
                                        <HStack justify="space-between" wrap="wrap" gap="2">
                                            <HStack gap="2" align="center">
                                                {/* Round collapse toggle. size="sm",
                                                    not "xs": the xs icon-button
                                                    shrinks the chevron to
                                                    near-invisible on some browsers;
                                                    the explicit `size={18}` on the
                                                    SVG overrides any inherited
                                                    font-size quirks. */}
                                                <IconButton
                                                    aria-label={collapsed ? tr("tournament.round.expand") : tr("tournament.round.collapse")}
                                                    title={collapsed ? tr("tournament.round.expand") : tr("tournament.round.collapse")}
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => toggleRoundCollapsed(r.id)}
                                                >
                                                    {collapsed ? <FiChevronRight size={18} /> : <FiChevronDown size={18} />}
                                                </IconButton>
                                                <Heading size="sm">{tr("tournament.round.heading", { n: r.number })}</Heading>
                                                <Badge
                                                    variant="subtle"
                                                    colorPalette={completed ? "green" : "yellow"}
                                                    size="sm"
                                                >
                                                    {completed ? (
                                                        <HStack gap="1"><FiCheckCircle size={11} /> {tr("tournament.round.completed")}</HStack>
                                                    ) : (
                                                        tr("tournament.round.inProgress")
                                                    )}
                                                </Badge>
                                            </HStack>
                                            <HStack gap="1.5" wrap="wrap" justify="flex-end">
                                                <IconButton
                                                    aria-label={tr("tournament.fullscreen")}
                                                    title={tr("tournament.fullscreen")}
                                                    size="xs"
                                                    variant="ghost"
                                                    onClick={() => setFullscreenRound(r.id)}
                                                >
                                                    <FiMaximize2 />
                                                </IconButton>
                                                {/* Round-level mutations are
                                                    owner/admin only. Hide the
                                                    buttons for everyone else so the
                                                    round card is a clean read-only
                                                    view. */}
                                                {!completed && canEditTournament && (
                                                    <Button
                                                        size="xs"
                                                        variant="solid"
                                                        colorPalette="green"
                                                        onClick={() => onFinishRound(r)}
                                                        loading={finishingRoundId === r.id}
                                                        disabled={!finishable || finishingRoundId != null}
                                                        title={finishable ? tr("tournament.round.finishTitle") : tr("tournament.round.finishBlockedTitle")}
                                                    >
                                                        <FiFlag /> {tr("tournament.round.finishButton")}
                                                    </Button>
                                                )}
                                                {/* "Resetiraj rundu" deletes every
                                                    match in the round and rolls the
                                                    pair statistics back. It used to
                                                    be the button immediately left of
                                                    "Završi rundu" — the two most
                                                    consequential controls in the
                                                    header, adjacent, same size, one
                                                    of them undoable and one of them
                                                    not. It is behind the overflow
                                                    now, and still goes through the
                                                    ConfirmDialog. */}
                                                {!completed && canEditTournament && (
                                                    <Menu.Root>
                                                        <Menu.Trigger asChild>
                                                            <IconButton
                                                                aria-label={tr("tournament.round.moreActions")}
                                                                title={tr("tournament.round.moreActions")}
                                                                size="xs"
                                                                variant="ghost"
                                                                ml="1"
                                                            >
                                                                <FiMoreHorizontal />
                                                            </IconButton>
                                                        </Menu.Trigger>
                                                        <Menu.Positioner>
                                                            <Menu.Content minW="230px">
                                                                <Menu.Item
                                                                    value="reset-round"
                                                                    color="red.fg"
                                                                    title={tr("tournament.round.resetTitle")}
                                                                    disabled={hardResettingRound}
                                                                    onSelect={() => onRequestHardResetRound(r.id)}
                                                                >
                                                                    <FiRotateCcw /> {tr("tournament.round.resetButton")}
                                                                </Menu.Item>
                                                            </Menu.Content>
                                                        </Menu.Positioner>
                                                    </Menu.Root>
                                                )}
                                            </HStack>
                                        </HStack>
                                    </Card.Header>

                                    {/* Body */}
                                    {!collapsed && (
                                        <Card.Body pt="0" pb="3" px={{ base: "3", md: "4" }}>
                                            {r.matches.length === 0 ? (
                                                <Box borderWidth="1px" rounded="md" p="4">
                                                    <Text color="fg.muted" fontSize="sm">
                                                        {tr("tournament.round.noMatches")}
                                                    </Text>
                                                </Box>
                                            ) : (
                                                <VStack align="stretch" gap="2">
                                                    {(sortedMatchesByRound.get(r.id) ?? r.matches).map((m) => (
                                                        <MatchRow
                                                            key={m.id}
                                                            roundId={r.id}
                                                            roundCompleted={completed}
                                                            m={m}
                                                            pairById={pairById}
                                                            tournamentRef={tournamentRef}
                                                            tournamentFinished={tournamentFinished}
                                                            canEdit={canEditTournament}
                                                            viewerUid={viewerUid}
                                                            autoOpenBillId={autoOpenBillId}
                                                            savingMatchId={savingMatchId}
                                                            onSaveMatch={onSaveMatch}
                                                            onSaveEditedMatch={onSaveEditedMatch}
                                                            onEnterEdit={onEnterEdit}
                                                            onCancelEdit={onCancelEdit}
                                                            onScoreChange={onScoreChange}
                                                            onBillChange={onBillChange}
                                                        />
                                                    ))}
                                                </VStack>
                                            )}
                                        </Card.Body>
                                    )}
                                </Card.Root>
                            )
                        })}
                    </VStack>
                )}
            </VStack>

            {/* ===== Winner banner — celebratory =====
                Phones and tablets only: from lg up the sidebar's results card
                is permanently on screen, so the big golden band here would be
                the same news twice. */}
            {tournamentFinished && t.winnerName && (
                <Card.Root
                    display={{ base: "flex", lg: "none" }}
                    mt="6"
                    variant="outline"
                    rounded="xl"
                    borderColor="yellow.muted"
                    bg="yellow.subtle"
                    overflow="hidden"
                >
                    <Card.Body py={{ base: "8", md: "10" }} px="6">
                        <VStack gap="3">
                            <Box color="yellow.fg" fontSize={{ base: "5xl", md: "6xl" }}>
                                <FiAward />
                            </Box>
                            <Text
                                fontSize="sm"
                                color="fg.muted"
                                letterSpacing="wider"
                                textTransform="uppercase"
                                fontWeight="semibold"
                            >
                                {tr("tournament.winnersHeading")}
                            </Text>
                            <Heading
                                size={{ base: "xl", md: "2xl" }}
                                textAlign="center"
                                color="yellow.fg"
                            >
                                {t.winnerName}
                            </Heading>
                        </VStack>
                    </Card.Body>
                </Card.Root>
            )}

            {/* ===== Fullscreen round board =====
                A Chakra Dialog rather than `requestFullscreen()` as the
                container: it brings Escape, the focus trap, the scroll lock
                and an accessible name, and it is the only option that works on
                an iPhone. The browser's own fullscreen is offered on top of it
                (the maximise button below), which is what a venue display
                actually wants. */}
            <Dialog.Root
                open={fullscreenRound !== null}
                onOpenChange={(e) => {
                    if (!e.open) closeFullscreenRound()
                }}
            >
                <Dialog.Backdrop />
                <Dialog.Positioner p="0">
                    <Dialog.Content
                        ref={fsContentRef}
                        /* `100%` of the (inset-0, unpadded) positioner rather
                           than `100vw`, which on a classic-scrollbar desktop is
                           wider than the space actually there. `bg` +
                           `backdropFilter: none` opt out of the theme's glass
                           dialog surface: frosted glass over the page is right
                           for a small modal and wrong for a board meant to be
                           read from the far side of a room. */
                        w="100%"
                        maxW="100%"
                        h="100dvh"
                        maxH="100dvh"
                        m="0"
                        p="0"
                        rounded="none"
                        bg="bg.canvas"
                        backdropFilter="none"
                        display="flex"
                        flexDirection="column"
                        overflow="hidden"
                    >
                        {/* One thin bar. Everything else on the screen belongs
                            to the round. */}
                        <HStack
                            justify="space-between"
                            align="center"
                            gap="2"
                            flexShrink={0}
                            px={{ base: "2", md: "4" }}
                            py="2"
                            borderBottomWidth="1px"
                            borderColor="border.subtle"
                            bg="bg.panel"
                        >
                            <Dialog.Title
                                fontSize={{ base: "sm", md: "md" }}
                                fontWeight="bold"
                                minW="0"
                                overflow="hidden"
                                textOverflow="ellipsis"
                                whiteSpace="nowrap"
                            >
                                {fsRound
                                    ? tr("tournament.fullscreenRoundTitle", {
                                        // String(), not `?? …`: the template
                                        // literal this replaced rendered the
                                        // same thing for a round id that is no
                                        // longer in the list.
                                        n: String(fsRound.number),
                                    })
                                    : tr("tournament.fullscreen")}
                            </Dialog.Title>

                            <HStack gap={{ base: "1", md: "2" }} flexShrink={0}>
                                {/* Exactly two sizes. Both are always visible,
                                    so the current one is readable as a state
                                    and not just as a toggle. */}
                                <HStack
                                    gap="1"
                                    role="group"
                                    aria-label={tr("tournament.fullscreen.sizeLabel")}
                                >
                                    <Button
                                        size="xs"
                                        variant={fsSize === "smaller" ? "solid" : "outline"}
                                        aria-pressed={fsSize === "smaller"}
                                        onClick={() => setFsSize("smaller")}
                                    >
                                        {tr("tournament.fullscreen.smaller")}
                                    </Button>
                                    <Button
                                        size="xs"
                                        variant={fsSize === "larger" ? "solid" : "outline"}
                                        aria-pressed={fsSize === "larger"}
                                        onClick={() => setFsSize("larger")}
                                    >
                                        {tr("tournament.fullscreen.larger")}
                                    </Button>
                                </HStack>

                                {canGoNative && (
                                    <IconButton
                                        aria-label={nativeFs
                                            ? tr("tournament.fullscreen.exitNative")
                                            : tr("tournament.fullscreen.enterNative")}
                                        title={nativeFs
                                            ? tr("tournament.fullscreen.exitNative")
                                            : tr("tournament.fullscreen.enterNative")}
                                        size="sm"
                                        variant="ghost"
                                        onClick={toggleNativeFs}
                                    >
                                        {nativeFs ? <FiMinimize2 /> : <FiMaximize2 />}
                                    </IconButton>
                                )}

                                <IconButton
                                    aria-label={tr("common.close")}
                                    title={tr("common.close")}
                                    size="sm"
                                    variant="ghost"
                                    onClick={closeFullscreenRound}
                                >
                                    <FiX />
                                </IconButton>
                            </HStack>
                        </HStack>

                        <Box
                            flex="1"
                            minH="0"
                            overflow="auto"
                            p={{ base: "2", md: "4" }}
                        >
                            {fsMatches.length ? (
                                <FullscreenRoundBoard
                                    matches={fsMatches}
                                    pairById={pairById}
                                    size={fsSize}
                                />
                            ) : (
                                <Box
                                    borderWidth="1px"
                                    borderColor="border.emphasized"
                                    rounded="xl"
                                    p="6"
                                >
                                    <Text color="fg.muted">
                                        {tr("tournament.round.noMatches")}
                                    </Text>
                                </Box>
                            )}
                        </Box>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Dialog.Root>

            <Dialog.Root
                open={unpaidOpen}
                onOpenChange={(e) => { if (!e.open) onCloseUnpaid() }}
            >
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content maxW="sm">
                        <Dialog.Header>{tr("tournament.unpaid.title")}</Dialog.Header>
                        <Dialog.Body>
                            <Text>
                                {tr("tournament.unpaid.body.before")} <b>{tr("tournament.unpaid.body.bold")}</b>{tr("tournament.unpaid.body.after")}
                            </Text>
                        </Dialog.Body>
                        <Dialog.Footer>
                            <Button onClick={onCloseUnpaid} colorPalette="red" variant="solid">
                                {tr("tournament.ok")}
                            </Button>
                        </Dialog.Footer>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Dialog.Root>
        </>
    )
}
