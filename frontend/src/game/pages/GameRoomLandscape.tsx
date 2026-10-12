import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type Ref } from "react"
import { Link } from "react-router-dom"
import { Box, Flex, Grid, HStack, IconButton, Spinner, Text, Theme, VStack, chakra } from "@chakra-ui/react"
import { FiSettings, FiSmile, FiX } from "react-icons/fi"
import type { Card, PlayerView, Reaction, RoomState, Seat, Suit } from "@bela/protocol"
import type { Phase, TrickCard } from "@bela/engine"
import { useTranslation, usePlural } from "../../i18n"
import BiddingPanel from "../components/BiddingPanel"
import Hand from "../components/Hand"
import LayoutToggleButton from "../components/LayoutToggleButton"
import { LANDSCAPE_FAN_PLACEMENT, LANDSCAPE_RAIL, LANDSCAPE_SEAT_ANCHORS } from "../components/landscapeGeometry"
import ReactionsBar from "../components/ReactionsBar"
import type { SeatBubble } from "../components/reactionBubbles"
import { ReactionBubble, type SeatBid } from "../components/Seat"
import SpectatorPromo from "../components/SpectatorPromo"
import Table from "../components/Table"
import { PillButton, StatusChip } from "../components/TableHeader"
import TrumpBadge, { type TrumpGlyphState } from "../components/TrumpBadge"
import TurnPill, { type TurnTone } from "../components/TurnPill"
import TurnProgressBar from "../components/TurnProgressBar"
import { GLASS, INK, INK_MUTED, LANDSCAPE_FELT, TEAM, landscapeTableGeometry } from "../components/tableStyles"
import { useFanRect } from "../hooks/useFanRect"
import type { TurnCountdown } from "../hooks/useTurnCountdown"
import { useSettledScore } from "../hooks/useSettledScore"
import { occupantName, otherTeam, teamOf } from "../util/seats"

/* ──────────────────────────────────────────────────────────────────────────
   GameRoomLandscape — the table on a phone held sideways (2026-10-12,
   owner: "kao klasične bela aplikacije").

   `GameRoomPage` keeps every piece of state and every effect; this is ONLY
   the other arrangement of the same components, chosen when
   `useLandscapeTable()` is true (route `/igra/soba/*` + `LANDSCAPE_TABLE`).
   Nothing about the game is decided here — what the page hands in is what
   is drawn, and the handlers go straight back to it.

       ┌  MI  |  ONI ───────────────────────── [♥ Mimi] ⟳ ⚙ ✕ ┐
       │ 91 +40 |  37            [partner ▮▮▮▮]                 │
       │  439   |  157                                          │
       │ ZVANJA ŠTIHOVI                                         │
       │     [opp ▮▮▮]        ♠ ♥ trick            [▮▮▮ opp]   │
       │                                                        │
       │ ━━━━━━━━━                                              │
       │ Tvoj potez     ╲ ╲ ╲ ╲ │ │ ╱ ╱ ╱ ╱  (my fan)        ☺ │
       └─────────────────────────────────────────────────────────┘

   The whole screen is felt (`LANDSCAPE_FELT`): no card frame. The FOUR
   CORNERS carry the HUD (owner, third to fifth pass 2026-10-12):
   top-left the SCORE in three centred mono rows read like the portrait
   panel — `MI | ONI` labels, the deal points (bonus in the pair's colour),
   the match totals, muted — with the `|` on one axis, one tap target
   opening Pregled zvanja; the two tabs ("ZVANJA", "ŠTIHOVI": the same
   `PillButton` as the portrait header) centred on that axis right under it; top-right the trump pill
   `[♥ Mimi]` (`TrumpBadge inline`, where the trump flight lands) beside the
   layout switch (⟳, back to the ordinary layout — `LayoutToggleButton`),
   the gear and the X; bottom-left the turn block — the 180 × 8 clock capsule
   over the words, bold, centred under it; bottom-right the smile that opens
   the reactions as a COLUMN growing upward — or, for the four seconds of
   the opt-out window, the "Želiš li prijaviti zvanja?" card in its place
   (never both). The bidding row sits just above the fan, its bottom edge
   `BID_GAP` over the cards' top. The whole arrangement exists only while the TABLE is up
   (`landscapeTableStore`): the waiting room and the result dialog are the
   ordinary layout, however the phone is held. The seats are `Table` with its own anchor
   map (`LANDSCAPE_SEAT_ANCHORS`), each with a fan of card backs for the
   cards it still holds (`view.handSizes`); the trick is the same
   `TrickArea`, drawn at `md` and scaled by `--pile-k`; my hand is `Hand` in
   its `fan` layout, centred along the bottom edge. The bidding row sits ON
   the felt, over the (empty) trick, so the hand stays visible while I
   choose.

   NO 3D TILT IN THIS PASS (owner wants to compare). The hook point is the
   box marked `data-landscape-felt`: a `perspective` / `rotateX` belongs on
   it and nowhere else, because everything that measures viewport rects
   (the flights) is inside it and would follow.

   SAFE AREAS: the rail and the corner column pay `--safe-left` /
   `--safe-right` (the landscape cutout) themselves; the fan pays
   `--safe-bottom` (the home indicator). The felt itself runs to every edge.

   Forced DARK (`Theme appearance="dark"`): the felt is dark green in both
   colour modes, so the ink, the glass and the hairlines inside it take their
   dark-mode values whatever the page is set to. Portals (dialogs, flashes)
   render outside and keep the page's own mode.
   ────────────────────────────────────────────────────────────────────── */

export interface LandscapeHand {
    cards: Card[]
    legal: Card[]
    phase: Phase
    layoutKey: string
    disabled: boolean
    hiddenCards: ReadonlySet<Card>
    onPlay: (card: Card) => void
    onInvalidPlay: (card: Card) => void
    rootRef: Ref<HTMLDivElement>
}

export interface GameRoomLandscapeProps {
    room: RoomState
    /** The view the HUD reads — the page's masked `shownView`. */
    view: PlayerView
    reducedMotion: boolean
    /** The socket is not open: a spinner chip beside the corner buttons. */
    connecting: boolean
    table: {
        turnDeadline: number | null
        turnDurationMs: number | null
        trickCards: TrickCard[]
        holdingSeat: Seat | null
        flyIn: Card | null
        collectTo: Seat | null
        showTurn: boolean
        bids: Partial<Record<Seat, SeatBid>>
        reactions: Partial<Record<Seat, SeatBubble>>
        /** The `DeclarationsOnTable` layer, built by the page with the
         *  landscape slot map. */
        declarations: ReactNode
    }
    turn: {
        tone: TurnTone
        label: string
        countdown: TurnCountdown
        /** A human clock is running. */
        clockActive: boolean
        /** What the pill shows beside its words (null = words only). */
        pillCountdown: TurnCountdown | null
        /** The pill is kept but invisible (an overlay says it). */
        pillHidden: boolean
    }
    score: {
        trumpGlyph: TrumpGlyphState
        /** `TrumpFlight`'s landing spot — the trump pill's mark. */
        trumpGlyphRef: Ref<HTMLDivElement>
    }
    /** Null for a spectator. */
    hand: LandscapeHand | null
    /** MY OWN quick phrase, if one is floating (`bubbles[mySeat]`). Portrait
     *  shows it on my corner avatar; there is no avatar for me here, so it
     *  floats over the fan's centre (2026-10-12, owner: a reaction I sent
     *  never appeared on my own screen). */
    myReaction: SeatBubble | null
    /** Null unless it is my deal to call. */
    bidding: {
        busy: boolean
        onBid: (trump: Suit) => void
        onPass: () => void
    } | null
    /** The "Želiš li prijaviti zvanja?" capsule, when the window is open. */
    declarePrompt: ReactNode
    /** Null while reactions are not offered (spectators, the reveal). */
    reactions: {
        disabled: boolean
        onReact: (reaction: Reaction) => void
    } | null
    actions: {
        declarationsEnabled: boolean
        /** False hides the declarations pill outright (2026-10-12, owner): a
         *  room without declarations has nothing to review until a bela is
         *  called, and none at all when bela is off too. */
        declarationsShown: boolean
        onDeclarations: () => void
        /** Null hides the tab (no trick yet, or the room forbids review). */
        tricksPlayed: number | null
        onTricks: () => void
        onSettings: () => void
        /** Where the X goes. A `Link`, so `GameRoomExitGuard` intercepts it
         *  during play exactly as it does every other way out. */
        leaveTo: string
    }
    /** The page's overlays: banners, flashes, prompts, flights, dialogs. */
    children?: ReactNode
}

const GEOMETRY = landscapeTableGeometry()

/* ── everything at the fan's edges is placed against the MEASURED fan ──────
   (sixth pass, 2026-10-12, owner: the formula-derived placements of the
   fifth pass overlapped the cards on his 852 × 393 — rotated corners,
   rounding, padding). `useFanRect` publishes `--fan-top`, `--fan-left`,
   `--fan-right` and the two corners' inner edges `--corner-left` /
   `--corner-right` (px, in the felt root's coordinates); the blocks below
   are sized and placed from them, and a block whose corner has no room
   moves ABOVE the fan's end instead. Never over a card. */
/** The air between the bidding row's bottom edge and the highest card. */
const BID_GAP = 10
/** The air between a corner block and the fan's nearest card. */
const CORNER_GAP = 12
/** The air between a block lifted above the fan and the highest card. */
const ABOVE_GAP = 8
/** The declare card: its width, and the narrowest corner it will take. */
const DECLARE_W = 220
const DECLARE_MIN_W = 170
/** The turn block: its width, and the narrowest corner it will take. */
const TURN_W = 180
const TURN_MIN_W = 120
/** The reactions button's diameter. */
const SMILE_SIZE = 38
/** A block's `bottom` when lifted above the fan (felt-root coordinates). */
const ABOVE_FAN = `calc(100% - var(--fan-top) + ${ABOVE_GAP}px)`

export default function GameRoomLandscape({
    room,
    view,
    reducedMotion,
    connecting,
    table,
    turn,
    score,
    hand,
    myReaction,
    bidding,
    declarePrompt,
    reactions,
    actions,
    children,
}: GameRoomLandscapeProps) {
    const { t } = useTranslation()
    const plural = usePlural()
    const [reactionsOpen, setReactionsOpen] = useState(false)
    const reactionsRef = useRef<HTMLDivElement | null>(null)
    // The popover never outlives the offer: a reveal or a disconnect that
    // withdraws the reactions closes it, and so does a new deal.
    useEffect(() => {
        if (reactions === null) setReactionsOpen(false)
    }, [reactions])
    useEffect(() => setReactionsOpen(false), [view.dealNo])
    // …and a tap anywhere else closes it, like the score history popover.
    useEffect(() => {
        if (!reactionsOpen) return
        const onPointerDown = (event: PointerEvent) => {
            const target = event.target as Node | null
            if (target && reactionsRef.current?.contains(target)) return
            setReactionsOpen(false)
        }
        document.addEventListener("pointerdown", onPointerDown, true)
        return () => document.removeEventListener("pointerdown", onPointerDown, true)
    }, [reactionsOpen])

    // Team colour is relative to the viewer; a spectator looks from seat 0.
    const myTeam = teamOf(view.seat ?? 0)
    const caller = view.bidding.caller

    /* The fan as it really is on screen (see `useFanRect` and the note
       above BID_GAP). Until the first measurement every block keeps its
       corner, and the CSS falls back with it. */
    const fanBox = useFanRect()
    const fan = fanBox.rect
    const fanVars = fan === null ? undefined : ({
        "--fan-top": `${fan.top}px`,
        "--fan-left": `${fan.left}px`,
        "--fan-right": `${fan.right}px`,
        "--corner-left": `${fan.cornerLeft}px`,
        "--corner-right": `${fan.cornerRight}px`,
    } as CSSProperties)
    const turnInCorner = fan === null || fan.left - fan.cornerLeft - CORNER_GAP >= TURN_MIN_W
    const declareInCorner = fan === null || fan.cornerRight - fan.right - CORNER_GAP >= DECLARE_MIN_W
    const smileInCorner = fan === null || fan.cornerRight - SMILE_SIZE - fan.right >= CORNER_GAP

    return (
        <Theme
            ref={fanBox.rootRef}
            style={fanVars}
            appearance="dark"
            hasBackground={false}
            // THE TILT HOOK (see the header): a `perspective` / `rotateX`
            // for a later pass goes on this box and nowhere else.
            data-landscape-felt
            display="flex"
            flexDirection="column"
            w="100%"
            h="100%"
            overflow="hidden"
            color={INK}
            css={LANDSCAPE_FELT}
        >
            {/* The two bottom corners' inner edges, for `useFanRect`: zero-
                size probes at exactly where a corner block starts, so the
                safe areas are measured, never re-derived. */}
            <Box ref={fanBox.leftProbeRef} aria-hidden="true" position="absolute" bottom="0" left="max(6px, var(--safe-left))" w="0" h="0" pointerEvents="none" />
            <Box ref={fanBox.rightProbeRef} aria-hidden="true" position="absolute" bottom="0" right="max(6px, var(--safe-right))" w="0" h="0" pointerEvents="none" />

            {/* ── top-left: the score, three rows, the tabs under it ── */}
            {/* `align="center"` (fifth pass): the score's two side columns
                are equal, so its `|` is the block's middle — and the pills
                centred on the same block sit on that same axis, whichever
                of the two is wider. */}
            <VStack
                position="absolute"
                top="1.5"
                left="max(8px, var(--safe-left))"
                align="center"
                gap="1"
                zIndex={20}
            >
                <ScoreLine view={view} myTeam={myTeam} targetScore={room.targetScore} onOpen={actions.declarationsEnabled && actions.declarationsShown ? actions.onDeclarations : undefined} />
                <HStack gap="1" justify="center">
                    {actions.declarationsShown && (
                        <PillButton
                            label={t("game.declarations.title")}
                            title={t("game.table.declarationsPill")}
                            badge={null}
                            badgeLabel={t("game.score.declarationBonus")}
                            disabled={!actions.declarationsEnabled}
                            onClick={actions.onDeclarations}
                        />
                    )}
                    {actions.tricksPlayed !== null && actions.tricksPlayed > 0 && (
                        <PillButton
                            label={t("game.tricks.title")}
                            title={t("game.tricks.open")}
                            badge={null}
                            badgeLabel={plural("game.table.trickCount", actions.tricksPlayed, { n: actions.tricksPlayed })}
                            ariaLabel={`${t("game.tricks.title")} — ${plural("game.table.trickCount", actions.tricksPlayed, { n: actions.tricksPlayed })}`}
                            onClick={actions.onTricks}
                        />
                    )}
                </HStack>
            </VStack>

            {/* ── bottom-left: the turn and its clock ────────────────── */}
            {/* In the corner, as wide as the gap to the fan's leftmost card
                allows (≤ 180 px); with less than `TURN_MIN_W` there, lifted
                above the fan's left end instead. */}
            <VStack
                position="absolute"
                left={turnInCorner ? "max(6px, var(--safe-left))" : "var(--fan-left)"}
                bottom={turnInCorner ? "calc(6px + var(--safe-bottom))" : ABOVE_FAN}
                align="stretch"
                gap="1"
                zIndex={20}
                w={turnInCorner
                    ? `min(${TURN_W}px, calc(var(--fan-left, 99999px) - var(--corner-left, 0px) - ${CORNER_GAP}px))`
                    : `${TURN_W}px`}
                pointerEvents="none"
            >
                <TurnProgressBar size="lg" countdown={turn.countdown} active={turn.clockActive} reducedMotion={reducedMotion} />
                <Box w="100%" visibility={turn.pillHidden ? "hidden" : undefined}>
                    <TurnPill
                        bold
                        tone={turn.tone}
                        label={turn.label}
                        countdown={turn.pillCountdown}
                        reducedMotion={reducedMotion}
                    />
                </Box>
            </VStack>

            {/* ── bottom-right: the opt-out question for its four seconds,
                   otherwise the reactions, a column growing upward ──────── */}
            {/* The declare card takes the corner when the gap to the fan's
                rightmost card holds ≥ `DECLARE_MIN_W` (it is then as wide as
                that gap, ≤ 220 px); otherwise it sits ABOVE the fan's right
                end, right-aligned to it, 220 px wide. The smile likewise. */}
            {declarePrompt !== null ? (
                <Box
                    position="absolute"
                    right={declareInCorner ? "max(6px, var(--safe-right))" : "calc(100% - var(--fan-right))"}
                    bottom={declareInCorner ? "calc(6px + var(--safe-bottom))" : ABOVE_FAN}
                    w={declareInCorner
                        ? `min(${DECLARE_W}px, calc(var(--corner-right, 99999px) - var(--fan-right, 0px) - ${CORNER_GAP}px))`
                        : `${DECLARE_W}px`}
                    zIndex={25}
                >
                    {declarePrompt}
                </Box>
            ) : reactions !== null && (
                <Box
                    ref={reactionsRef}
                    position="absolute"
                    right={smileInCorner ? "max(6px, var(--safe-right))" : "calc(100% - var(--fan-right))"}
                    bottom={smileInCorner ? "calc(6px + var(--safe-bottom))" : ABOVE_FAN}
                    zIndex={25}
                >
                    <chakra.button
                        type="button"
                        {...GLASS}
                        w={`${SMILE_SIZE}px`}
                        h={`${SMILE_SIZE}px`}
                        rounded="full"
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        fontSize="18px"
                        lineHeight="1"
                        color={reactionsOpen ? INK : INK_MUTED}
                        cursor="pointer"
                        _hover={{ bg: "bg.muted" }}
                        _active={{ bg: "bg.muted" }}
                        _focusVisible={{ outline: "2px solid", outlineColor: "brand.300", outlineOffset: "2px" }}
                        aria-label={t("game.table.reactionsToggle")}
                        aria-expanded={reactionsOpen}
                        onClick={() => setReactionsOpen((open) => !open)}
                    >
                        <FiSmile aria-hidden="true" />
                    </chakra.button>
                    {reactionsOpen && (
                        <Box position="absolute" right="-1px" bottom="calc(100% + 6px)">
                            <ReactionsBar
                                vertical
                                showToggle={false}
                                disabled={reactions.disabled}
                                onReact={(reaction) => {
                                    reactions.onReact(reaction)
                                    setReactionsOpen(false)
                                }}
                            />
                        </Box>
                    )}
                </Box>
            )}

            {/* Calling trump happens ON the felt (owner): the four suits and
                "Dalje" just above my six cards, so they stay in view while I
                decide. Sixth pass (2026-10-12): placed against the MEASURED
                fan — the row's bottom edge `BID_GAP` above the highest card
                corner (`--fan-top`), centred on the fan — after the fifth
                pass's derived offset landed on the cards. */}
            {bidding !== null && (
                <Flex
                    position="absolute"
                    bottom={`calc(100% - var(--fan-top, 70%) + ${BID_GAP}px)`}
                    left="calc((var(--fan-left, 50%) + var(--fan-right, 50%)) / 2)"
                    transform="translateX(-50%)"
                    zIndex={9}
                    pointerEvents="none"
                >
                    <Box pointerEvents="auto">
                        <BiddingPanel
                            view={view}
                            busy={bidding.busy}
                            onBid={bidding.onBid}
                            onPass={bidding.onPass}
                        />
                    </Box>
                </Flex>
            )}

            {/* ── the top-right corner ───────────────────────────────── */}
            <HStack
                position="absolute"
                top="1"
                right="max(4px, var(--safe-right))"
                gap="0.5"
                zIndex={20}
            >
                {connecting && (
                    <StatusChip tone="warn">
                        <Spinner size="xs" borderWidth="2px" aria-label={t("game.connection.connecting")} />
                    </StatusChip>
                )}
                {/* Trump + caller (third pass): the pill the flight lands
                    in; the fan silhouette until somebody calls. */}
                <Box mr="1">
                    <TrumpBadge
                        layout="inline"
                        trump={view.bidding.trump}
                        callerName={caller === null ? null : occupantName(room.seats[caller].occupant, t("game.seat.empty"))}
                        fallback={t("game.table.phaseBidding")}
                        glyph={score.trumpGlyph}
                        glyphRef={score.trumpGlyphRef}
                        callerTeam={caller === null ? null : teamOf(caller) === myTeam ? "us" : "them"}
                    />
                </Box>
                {/* Back to the ordinary layout (2026-10-12, owner): the
                    player's own choice, remembered per device. */}
                <LayoutToggleButton target="normal" size={36} />
                <IconButton
                    size="sm"
                    minW="36px"
                    minH="36px"
                    rounded="full"
                    variant="ghost"
                    color={INK}
                    _hover={{ bg: "bg.muted" }}
                    aria-label={t("game.table.settings")}
                    title={t("game.table.settings")}
                    onClick={actions.onSettings}
                >
                    <FiSettings />
                </IconButton>
                <IconButton
                    asChild
                    size="sm"
                    minW="36px"
                    minH="36px"
                    rounded="full"
                    variant="ghost"
                    color={INK}
                    _hover={{ bg: "bg.muted" }}
                    aria-label={t("game.room.leaveAria")}
                    title={t("game.exit.leave")}
                >
                    <Link to={actions.leaveTo}><FiX /></Link>
                </IconButton>
            </HStack>

            {/* ── the felt column: seats + trick, pill, my fan ───────── */}
            <Flex
                direction="column"
                flex="1"
                minH="0"
                position="relative"
                pl={`calc(${LANDSCAPE_RAIL} + max(0px, var(--safe-left)))`}
                pr={`calc(${LANDSCAPE_RAIL} + max(0px, var(--safe-right)))`}
            >
                <Box flex="1" minH="0" position="relative" pt="1">
                    <Table
                        room={room}
                        view={view}
                        turnDeadline={table.turnDeadline}
                        turnDurationMs={table.turnDurationMs}
                        trickCards={table.trickCards}
                        holdingSeat={table.holdingSeat}
                        flyIn={table.flyIn}
                        collectTo={table.collectTo}
                        reducedMotion={reducedMotion}
                        showTurn={table.showTurn}
                        bids={table.bids}
                        reactions={table.reactions}
                        declarations={table.declarations}
                        anchors={LANDSCAPE_SEAT_ANCHORS}
                        geometry={GEOMETRY}
                        pileSize="md"
                        pileFlat
                        seatCards={view.handSizes}
                        fanPlacement={LANDSCAPE_FAN_PLACEMENT}
                    />

                </Box>

                {/* My hand, the fan along the bottom edge. The LAST element
                    of the column, so it alone pays for the home indicator. */}
                <Box
                    ref={hand?.rootRef}
                    position="relative"
                    flexShrink={0}
                    css={{ paddingBottom: "var(--safe-bottom)" }}
                >
                    {/* My own speech bubble, 7 px above the fan's top edge,
                        centred — a zero-size anchor is all `center` needs.
                        Same pop in/out as the seats' bubbles (`key` on the
                        bubble id lives inside). */}
                    {hand !== null && (
                        <Box position="absolute" left="50%" top="0" w="0" h="0" zIndex={30} pointerEvents="none">
                            <ReactionBubble bubble={myReaction} align="center" frame={0} reducedMotion={reducedMotion} />
                        </Box>
                    )}
                    {hand === null ? (
                        <SpectatorPromo />
                    ) : (
                        // The box `useFanRect` measures the slots in.
                        <Box ref={fanBox.fanRef}>
                            <Hand
                                layout="fan"
                                cards={hand.cards}
                                legal={hand.legal}
                                phase={hand.phase}
                                layoutKey={hand.layoutKey}
                                disabled={hand.disabled}
                                hiddenCards={hand.hiddenCards}
                                onPlay={hand.onPlay}
                                onInvalidPlay={hand.onInvalidPlay}
                            />
                        </Box>
                    )}
                </Box>
            </Flex>

            {children}
        </Theme>
    )
}

/**
 * The top-left score (owner, fifth pass 2026-10-12): three CENTRED rows in
 * the portrait panel's reading order —
 *
 *     MI  |  ONI        the labels, team colours, small, letter-spaced
 *   33 +20 |  0         the DEAL points, bold (bonus in the pair's colour)
 *    439  |  157        the MATCH totals, muted, smaller
 *
 * — as one `1fr auto 1fr` grid. The two side tracks are both `1fr` in a
 * shrink-to-fit box, so they resolve to the same width (the wider of the
 * two cells' content) and the `|` column is the block's exact middle on
 * every row; each side cell is centred in its track. The view it reads is
 * the page's masked `shownView`, so the bonus never shows before the
 * reveal. ONE tap target: it opens the declarations read-back while there
 * is one to open.
 */
function ScoreLine({ view, myTeam, targetScore, onOpen }: { view: PlayerView; myTeam: ReturnType<typeof teamOf>; targetScore: number; onOpen?: () => void }) {
    const { t } = useTranslation()
    const spectator = view.seat === null
    const them = otherTeam(myTeam)
    // The same end-of-deal pour as the portrait panel (2026-10-12, owner):
    // the deal points run down into the match total.
    const settled = useSettledScore(view)
    const usLabel = spectator ? t("game.score.teamA") : t("game.score.us")
    const themLabel = spectator ? t("game.score.teamB") : t("game.score.them")
    // ONE tall rule down the middle instead of a "|" per row (2026-10-12,
    // owner), spanning all four rows.
    const delimiter = <Box gridColumn="2" gridRow="1 / 5" alignSelf="stretch" w="1px" my="0.5" bg={INK_MUTED} opacity={0.45} aria-hidden="true" />
    // Between the deal and the match total, the portrait panel's 2 px bar
    // running the total toward the target (2026-10-12, owner: "odvojiti
    // delimiterom kao kod normalnog prikaza").
    const bar = (side: "us" | "them", value: number, column: string) => {
        const progress = Math.max(0, Math.min(1, targetScore > 0 ? value / targetScore : 0))
        return (
            <Box
                gridColumn={column}
                gridRow="3"
                alignSelf="center"
                justifySelf="stretch"
                h="2px"
                my="1"
                rounded="full"
                bg="border.subtle"
                overflow="hidden"
                display="flex"
                flexDirection={side === "them" ? "row-reverse" : "row"}
                aria-hidden="true"
            >
                <Box h="100%" rounded="full" bg={TEAM[side]} style={{ width: `${progress * 100}%` }} transition="width 160ms ease-out" />
            </Box>
        )
    }
    const label = (text: string, side: "us" | "them") => (
        <Text as="span" color={TEAM[side]} fontWeight="bold" fontSize="10px" letterSpacing="widest" textAlign="center">
            {text.toUpperCase()}
        </Text>
    )
    // The "+N" hangs off the number's right edge instead of sitting beside it
    // in the flow (2026-10-12, owner: "116 +20" pushed the number off the
    // column's centre, so it no longer stood over "ONI" and "570"). The
    // columns' minimum width below leaves room for the widest bonus.
    const deal = (side: "us" | "them", points: number, bonus: number) => (
        <Box as="span" position="relative" display="inline-block">
            <Text as="span" color={INK} fontWeight="bold" fontSize="15px">{points}</Text>
            {bonus > 0 && (
                <Text
                    as="span"
                    position="absolute"
                    left="calc(100% + 3px)"
                    bottom="1px"
                    color={TEAM[side]}
                    fontWeight="bold"
                    fontSize="11px"
                    title={t("game.score.declarationBonus")}
                >
                    +{bonus}
                </Text>
            )}
        </Box>
    )
    const total = (value: number) => (
        <Text as="span" color={INK_MUTED} fontSize="11px" textAlign="center">{value}</Text>
    )
    return (
        <chakra.button
            type="button"
            display="block"
            px="2"
            py="0.5"
            rounded="l2"
            bg="transparent"
            fontFamily="mono"
            lineHeight="1.3"
            fontVariantNumeric="tabular-nums"
            whiteSpace="nowrap"
            cursor={onOpen ? "pointer" : "default"}
            disabled={!onOpen}
            _hover={onOpen ? { "@media (hover: hover)": { bg: "bg.muted" } } : undefined}
            _active={onOpen ? { bg: "bg.muted" } : undefined}
            _focusVisible={{ outline: "2px solid", outlineColor: "brand.300", outlineOffset: "2px" }}
            aria-label={`${usLabel} ${view.currentDealPoints[myTeam]} · ${view.score[myTeam]}, ${themLabel} ${view.currentDealPoints[them]} · ${view.score[them]}`}
            title={onOpen ? t("game.table.declarationsPill") : undefined}
            onClick={onOpen}
        >
            {/* Equal side columns with a floor: centred 3-digit deal points
                leave ~28 px each side, enough for "+150" plus the gap, so a
                bonus never reaches the delimiter. */}
            <Grid templateColumns="minmax(84px, 1fr) 1px minmax(84px, 1fr)" columnGap="3" rowGap="0" alignItems="baseline" justifyItems="center">
                {delimiter}
                <Box gridColumn="1" gridRow="1">{label(usLabel, "us")}</Box>
                <Box gridColumn="3" gridRow="1">{label(themLabel, "them")}</Box>
                <Box gridColumn="1" gridRow="2">{deal("us", settled.deal(myTeam), settled.declarations(myTeam))}</Box>
                <Box gridColumn="3" gridRow="2">{deal("them", settled.deal(them), settled.declarations(them))}</Box>
                {bar("us", settled.total(myTeam), "1")}
                {bar("them", settled.total(them), "3")}
                <Box gridColumn="1" gridRow="4">{total(settled.total(myTeam))}</Box>
                <Box gridColumn="3" gridRow="4">{total(settled.total(them))}</Box>
            </Grid>
        </chakra.button>
    )
}
