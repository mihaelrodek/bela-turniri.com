import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import { Box, Button, Flex, HStack, Spinner, Text, useBreakpointValue } from "@chakra-ui/react"
import { FiArrowLeft } from "react-icons/fi"
import type { Card, RoomState, Seat, Suit } from "@bela/protocol"
import { trickWinner } from "@bela/engine"
import type { Team, TrickCard } from "@bela/engine"
import { CONTENT_STICKY_TOP, NAVBAR_SAFE_TOP } from "../../components/navChrome"
import { useDocumentHead } from "../../hooks/useDocumentHead"
import { useTranslation } from "../../i18n"
import { showError, toaster } from "../../toaster"
import BelaPrompt from "../components/BelaPrompt"
import BiddingPanel, { ROW_H } from "../components/BiddingPanel"
import DealSummary from "../components/DealSummary"
import DeclarationsReveal, { BelaFlash, BelotFlash, TrumpFlash } from "../components/DeclarationsReveal"
import GameOverDialog from "../components/GameOverDialog"
import GameSettingsSheet from "../components/GameSettingsSheet"
import Hand from "../components/Hand"
import { HAND_CARD_SIZE, handRowWidth } from "../components/handLayout"
import JoinByCodeDialog from "../components/JoinByCodeDialog"
import MissedTurnDialog from "../components/MissedTurnDialog"
import ReactionsBar from "../components/ReactionsBar"
import ReconnectBanner from "../components/ReconnectBanner"
import RoomPanel from "../components/RoomPanel"
import ScoreBoard from "../components/ScoreBoard"
import { SeatAvatar, type SeatBid } from "../components/Seat"
import Table from "../components/Table"
import TableHeader, { StatusChip, TableActions } from "../components/TableHeader"
import TrickHistory from "../components/TrickHistory"
import { COLLECT_MS } from "../components/TrickArea"
import TurnPill, { type TurnTone } from "../components/TurnPill"
import TurnProgressBar from "../components/TurnProgressBar"
import { useReactionBubbles } from "../components/reactionBubbles"
import { PLAY_AREA, GLASS, INK, INK_MUTED, SHORT } from "../components/tableStyles"
import { useEventQueue } from "../hooks/useEventQueue"
import { useSlowConnection } from "../hooks/useSlowConnection"
import { useGamePrefs } from "../hooks/useGamePrefs"
import { useGameSocket } from "../hooks/useGameSocket"
import { useLiveActivity } from "../hooks/useLiveActivity"
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion"
import SpectatorIntro from "../components/SpectatorIntro"
import { useTurnCountdown } from "../hooks/useTurnCountdown"
import { preloadDeck } from "../cards/madjarice/preload"
import { cardRank, cardSuit, makeCard } from "../util/cards"
import { occupantName, otherTeam, teamOf } from "../util/seats"
import { playHaptic } from "../util/haptics"
import { installAudioUnlock, playSound, primeAudio } from "../util/sounds"
import { useKeepAwake } from "../hooks/useKeepAwake"
import { useTableScale } from "../hooks/useTableScale"

/* ──────────────────────────────────────────────────────────────────────────
   GameRoomPage (/igra/soba/:roomId) — the room, and then the table.

   Two states behind one URL on purpose: a room and the game played in it are
   the same place, and bouncing the player to another route when the host
   presses Start would drop the socket mid-deal.

   LAYOUT (game/DESIGN.md §2.2, §2.11, §6). ONE centred column on every
   screen, desktop included — a bela table is a table, not a dashboard, and
   four seats scattered into the corners of a 27" monitor is nobody's idea of
   a card game. It steps 760 / 840 / 900 px with the breakpoints rather than
   sitting at one width: a tablet and a laptop can hold a bigger table
   comfortably, and past ~900 px the seats stop being one glance apart, so it
   stops growing. The column is exactly `100dvh - chrome`
   tall, the Container's own bottom padding cancelled by `mb="-24px"`, and
   NOTHING inside it scrolls. MobileTabBar and SiteFooter both hide on /igra
   (see their route lists), so nothing else is below us to account for.

   The column reads as THREE blocks, not seven rows: scoreboard, then the
   TABLE as one bounded group, then my bar + hand + reactions docked at the
   bottom. The slack of a tall phone goes to the room AROUND the table (which
   is centred in it), never inside it — spreading four seats to the corners of
   a 900 px screen is what made the old layout read as mostly empty green.

   Transparent play area over the application background. Neutral panels
   group scores and controls; player positions and card slots stay stable.

   The screen renders from TWO sources: `PlayerView` for everything that is
   simply true right now, and the event queue for the things that have to be
   SEEN happening (a trick being collected, declarations being revealed, a
   "Bela!"). Where they disagree — the server clears the trick in the same
   frame it announces the winner — the event wins until its dwell is over.
   ────────────────────────────────────────────────────────────────────── */

/** Cards stay on the table this long before sliding to the winner. Counted
 *  from the moment TRICK_WON becomes the active event, i.e. AFTER the fourth
 *  card has had its own CARD_PLAYED dwell to land in. */
const TRICK_HOLD_MS = 950

/** The turn-clock haptic fires when this fraction of the turn is left — the
 *  same point `useTurnCountdown` flips `urgent` and the seat ring turns red,
 *  so the buzz and the visual warning arrive together. */
const TURN_WARNING_FRACTION = 0.25
/** "Požuri": one light tick at each of these many ms before MY turn runs out
 *  (2026-09-20, user request — the last three seconds). */
const TURN_HURRY_TICKS_MS = [3000, 2000, 1000] as const

/** How long the "X zove <adut>" beat stays on the felt. */
const TRUMP_FLASH_MS = 1500

/** Nothing on the felt, and a stable identity so the sync effect below does
 *  not fire on every render while the player has no view yet. */
const NO_TRICK: TrickCard[] = []

/** Masked `declarationPoints` while the reveal beat has not happened yet — a
 *  stable identity for the same reason as `NO_TRICK` above. */
const ZERO_DECLARATION_POINTS: Record<Team, number> = { A: 0, B: 0 }

function seatName(seats: RoomState["seats"], seat: Seat | null, fallback: string): string {
    if (seat === null) return fallback
    const occupant = seats[seat]?.occupant
    if (!occupant) return fallback
    return occupant.kind === "BOT" ? occupant.name : occupant.user.name
}

export default function GameRoomPage() {
    const { roomId } = useParams()
    const [params] = useSearchParams()
    const navigate = useNavigate()
    const { t } = useTranslation()
    const mock = import.meta.env.DEV && params.get("mock") === "1"
    const systemReducedMotion = usePrefersReducedMotion()
    const [prefs] = useGamePrefs()
    // The OS preference and the in-game "Smanji animacije" toggle are two
    // ways of saying the same thing; either one is enough.
    const reducedMotion = systemReducedMotion || prefs.reduceMotion

    const socket = useGameSocket({ roomId, mock })
    const slowConnection = useSlowConnection(socket.status)
    const { active, pending, companion, settled } = useEventQueue(socket.events, reducedMotion)
    const bubbles = useReactionBubbles(socket.reactions)

    const room = socket.room
    const view = socket.view
    const mySeat: Seat | null = view?.seat ?? socket.yourSeat
    const myTeam: Team = mySeat === null ? "A" : teamOf(mySeat)
    const busy = pending > 0 || socket.declarationsPending || socket.status !== "open"
    const idle = active === null && pending === 0

    // Lock-screen game state on the native apps; a no-op on the web.
    useLiveActivity({
        room,
        view,
        yourSeat: socket.yourSeat,
        turnDeadline: socket.turnDeadline,
        send: socket.send,
    })

    const [settingsOpen, setSettingsOpen] = useState(false)
    const [accessCodeOpen, setAccessCodeOpen] = useState(false)
    const joinedOnce = useRef(false)

    /* Warm the chosen deck once, at idle. Every face this client has decoded
       renders on its first paint (cards/madjarice/preload.ts), so the first
       card an OPPONENT throws is the artwork rather than the SVG fallback
       swapping itself out a moment later. The lobby warms the same pack on
       entry (2026-09-20), so this is usually already done; a deck changed in
       the settings sheet mid-session warms here. Drawn decks (vektorske,
       francuske) have nothing to fetch and return immediately. */
    useEffect(() => {
        preloadDeck(prefs.deck)
    }, [prefs.deck])

    // Browsers block audio created outside a user gesture, and iOS suspends
    // the context again on every trip to the background — so the unlock is
    // not a one-off (see `installAudioUnlock`). Entering the room still makes
    // no sound of its own.
    useEffect(() => installAudioUnlock(), [])

    // The table is a fixed game surface, not a document the player should be
    // able to scroll or pull down to refresh. Lock the page while this room is
    // mounted; dialog content remains independently scrollable through its
    // portal, and the lobby keeps its normal scrolling behaviour.
    useEffect(() => {
        const html = document.documentElement
        const body = document.body
        const previous = {
            htmlOverflow: html.style.overflow,
            htmlOverscrollBehavior: html.style.overscrollBehavior,
            bodyOverflow: body.style.overflow,
            bodyOverscrollBehavior: body.style.overscrollBehavior,
        }

        html.style.overflow = "hidden"
        html.style.overscrollBehavior = "none"
        body.style.overflow = "hidden"
        body.style.overscrollBehavior = "none"

        return () => {
            html.style.overflow = previous.htmlOverflow
            html.style.overscrollBehavior = previous.htmlOverscrollBehavior
            body.style.overflow = previous.bodyOverflow
            body.style.overscrollBehavior = previous.bodyOverscrollBehavior
        }
    }, [])

    /* The engine completes the hand in the same state update that settles
       trump. The event queue intentionally presents those as separate human
       moments, so retain the actual six-card hand from bidding plus two backs
       until the CALL itself reaches the front of that queue. Slicing
       the new eight-card, already-sorted hand here would temporarily replace
       cards before the talon was revealed. On a reconnect there is no event
       backlog to replay; an idle, already-playing view is therefore hydrated
       immediately.

       Which event is "the call"? Until 2026-09-20 this waited for
       HAND_COMPLETED, which sits behind the calling BID (800 ms) and the
       TRUMP_SET popup (1600 ms): the two talon cards appeared 1.6–2.4 s after
       the table had already been told what the trump is, and a player who
       called it themselves sat looking at six cards for most of that
       ("kad se odazove adut stavi da se odmah vide dodatne 2 karte" — user
       request). The talon is now released by the FIRST event that shows the
       call, i.e. the calling BID, with TRUMP_SET kept as a belt-and-braces
       second trigger (the forced "mus" path, and any future frame where a
       trump is set without a BID of its own). Keying it on the QUEUE and not
       on `view.bidding.trump` is what keeps it honest: other players' PASS
       chips still play back first, exactly as before, and the dwell budget
       (BID 800 + TRUMP_SET 1600 + HAND_COMPLETED 1600 + DECLARATIONS 4000 =
       the server's 8000 ms `declarationsMs`) is untouched. */
    const [talonRevealedDeal, setTalonRevealedDeal] = useState<number | null>(() =>
        view && view.phase !== "BIDDING" ? view.dealNo : null,
    )
    const hydrateTalonAfterConnect = useRef(socket.status !== "open")
    const observedDeal = useRef<number | null>(view?.dealNo ?? null)
    const biddingHand = useRef<{ dealNo: number; cards: Card[] } | null>(null)
    if (view?.phase === "BIDDING" && view.hand.length === 6 && biddingHand.current?.dealNo !== view.dealNo) {
        biddingHand.current = { dealNo: view.dealNo, cards: view.hand.slice() }
    }
    useEffect(() => {
        if (socket.status !== "open") {
            hydrateTalonAfterConnect.current = true
            return
        }
        if (!view) return
        const firstViewForDeal = observedDeal.current !== view.dealNo
        observedDeal.current = view.dealNo
        if (view.phase === "BIDDING") {
            setTalonRevealedDeal(null)
            hydrateTalonAfterConnect.current = false
            return
        }
        if (
            // The call, as the queue shows it (2026-09-20): BID is the moment
            // a suit is named, TRUMP_SET its popup, HAND_COMPLETED the old
            // trigger — kept so a queue that somehow starts mid-sequence
            // (a frame whose earlier events were trimmed from the ring
            // buffer) still ends up with eight cards.
            active?.type === "BID"
            || active?.type === "TRUMP_SET"
            || active?.type === "HAND_COMPLETED"
            || hydrateTalonAfterConnect.current
            || (firstViewForDeal && active === null)
        ) {
            setTalonRevealedDeal(view.dealNo)
            hydrateTalonAfterConnect.current = false
        }
    }, [view, active, socket.status])

    /* When another player's exit dissolves the room, the server sends every
       remaining member `room.left`. Do not strand them on a permanent
       "Ulazim u sobu…" screen for a room that no longer exists. */
    useEffect(() => {
        if (room) {
            joinedOnce.current = true
            return
        }
        if (joinedOnce.current && socket.status === "open") {
            navigate(`/igra${mock ? "?mock=1" : ""}`, { replace: true })
        }
    }, [room, socket.status, navigate, mock])

    const autoReadyKey = useRef<string | null>(null)
    useEffect(() => {
        if (!prefs.alwaysReady || mySeat === null || room?.status !== "LOBBY") {
            autoReadyKey.current = null
            return
        }
        if (socket.status !== "open") return
        const key = `${room.id}:${mySeat}`
        if (autoReadyKey.current === key) return
        autoReadyKey.current = key
        const occupant = room.seats[mySeat].occupant
        if (occupant?.kind === "PLAYER" && !occupant.ready) socket.send({ t: "room.ready", ready: true })
    }, [prefs.alwaysReady, mySeat, room, socket])

    useDocumentHead({ title: t("game.room.metaTitle", { name: room?.name ?? "" }) })

    // ── event-driven overlays ────────────────────────────────────────────
    const trickWon = active !== null && active.type === "TRICK_WON" ? active : null
    const revealed = active !== null && active.type === "DECLARATIONS_REVEALED" ? active : null
    const bela = companion ?? (active !== null && active.type === "BELA" ? active : null)
    const belot = active !== null && active.type === "BELOT" ? active : null
    const trumpSet = active !== null && active.type === "TRUMP_SET" ? active : null

    // "X zove žir": a quick beat, not a dialog (2026-09-20, user request). It
    // leaves long before TRUMP_SET's own dwell is over.
    /* The trump MARKS (score panel, caller's medallion) appear with that beat,
       not before it. `view.bidding.trump` is set in the frame the bid lands,
       but the queue still has the BID's own dwell to play before TRUMP_SET,
       so following the view showed the trump at the top ~1 s before the popup
       announced it (2026-09-20, user report). Same shape as the talon above:
       revealed by the event, or at once when there is no event to wait for
       (a reconnect, a rejoin mid-deal). */
    const [trumpShownDeal, setTrumpShownDeal] = useState<number | null>(null)
    const trumpDeal = view && view.bidding.trump !== null ? view.dealNo : null
    useEffect(() => {
        if (trumpDeal === null) return
        if (trumpSet !== null || settled) setTrumpShownDeal(trumpDeal)
    }, [trumpDeal, trumpSet, settled])
    const trumpHidden = trumpDeal !== null && trumpShownDeal !== trumpDeal && trumpSet === null

    /* The declaration NUMBERS — ScoreBoard's "+40" and the Zvanja button's
       badge — wait for the same beat as the POPUP that explains them
       (`DeclarationsReveal`, driven by the `DECLARATIONS_REVEALED` event
       below). The engine settles declarations in the very state update that
       sets trump, so `view.declarationPoints` is already the final number
       three events early — TRUMP_SET, then HAND_COMPLETED, then
       DECLARATIONS_REVEALED itself each have their own dwell — and following
       `view` put the score panel's "+40" on screen before either the popup
       or the button's badge (2026-09-20, user report). Same shape as the
       trump mark above: shown when the event becomes active, or at once when
       there is none to wait for (a reconnect, a rejoin mid-deal, a
       `noDeclarations` room where `DECLARATIONS_REVEALED` never fires at
       all — `settled` still goes true once TRUMP_SET/HAND_COMPLETED drain).

       The three are made to appear TOGETHER, not the popup first and the
       numbers after it closes: the popup already shows the same numbers, so
       there is nothing left to protect once it is up. */
    const [declShownDeal, setDeclShownDeal] = useState<number | null>(null)
    const declDeal = view && view.declarationsRevealed ? view.dealNo : null
    useEffect(() => {
        if (declDeal === null) return
        if (revealed !== null || settled) setDeclShownDeal(declDeal)
    }, [declDeal, revealed, settled])
    const declNumbersHidden = declDeal !== null && declShownDeal !== declDeal && revealed === null

    /* Both "shown for deal N" marks are keyed by a bare deal number, and deal
       numbers restart at 1 with every new game in the same room (this page
       does not remount for a rematch). A game that ended on its first deal —
       a belot, or "dosta" on declarations — would leave N = 1 behind and the
       rematch's first deal would skip both reveals. Every deal passes through
       BIDDING before it has a trump, so that is where they are forgotten. */
    const biddingNow = view?.phase === "BIDDING"
    useEffect(() => {
        if (!biddingNow) return
        setTrumpShownDeal(null)
        setDeclShownDeal(null)
    }, [biddingNow, view?.dealNo])

    const shownView = useMemo(() => {
        if (!view) return view
        if (!trumpHidden && !declNumbersHidden) return view
        return {
            ...view,
            ...(trumpHidden ? { bidding: { ...view.bidding, trump: null, caller: null } } : null),
            ...(declNumbersHidden ? { declarationPoints: ZERO_DECLARATION_POINTS } : null),
        }
    }, [view, trumpHidden, declNumbersHidden])

    const [trumpFlash, setTrumpFlash] = useState(false)
    useEffect(() => {
        if (!trumpSet) {
            setTrumpFlash(false)
            return
        }
        setTrumpFlash(true)
        const id = setTimeout(() => setTrumpFlash(false), TRUMP_FLASH_MS)
        return () => clearTimeout(id)
    }, [trumpSet])

    /* ── the trick, as the QUEUE has released it ──────────────────────────
       `view.trick` is the truth but it is not a sequence: the server can put
       several plays in one frame, and it clears the trick in the very frame
       that announces a winner. Rendering it directly is why a card used to
       appear and disappear inside one paint. So while the queue is playing,
       the felt shows what the queue has handed over — one card per
       CARD_PLAYED dwell — and the moment it goes idle the view is the truth
       again. A client that (re)joins mid-trick is NOT covered by that: it
       never receives the `CARD_PLAYED`s for cards thrown before it connected,
       so the queue could not build the pile even if it wanted to. The
       hydration effect further down seeds it from the view instead. */
    const liveTrick = (view?.trick.cards ?? NO_TRICK) as TrickCard[]
    const [queuedTrick, setQueuedTrick] = useState<TrickCard[]>(NO_TRICK)
    const queueBusy = active !== null

    useEffect(() => {
        if (active === null) return
        if (active.type === "CARD_PLAYED") {
            const played: TrickCard = { seat: active.seat, card: active.card }
            setQueuedTrick((prev) => {
                // A fifth card means the previous trick is still on screen:
                // start the new pile rather than growing that one.
                const base = prev.length >= 4 ? [] : prev
                return base.some((entry) => entry.card === played.card) ? base : [...base, played]
            })
        } else if (active.type === "TRICK_WON") {
            setQueuedTrick(active.cards as TrickCard[])
        } else if (active.type === "DEALT") {
            setQueuedTrick(NO_TRICK)
        }
    }, [active])

    useEffect(() => {
        if (queueBusy) return
        setQueuedTrick(liveTrick)
    }, [queueBusy, liveTrick])

    const trickCards = queueBusy ? queuedTrick : liveTrick

    /* The turn marker waits for the trick to leave. The server names the
       winner as next to play in the same frame as the fourth card, so
       following `view.turn` lit their seat while the fourth card was still
       landing and the pile was still on the felt (2026-09-20, user report). */
    const turnShown = !(
        (active !== null && active.type === "TRICK_WON")
        || (active !== null && active.type === "CARD_PLAYED" && trickCards.length >= 4)
    )

    /* ── who is holding the trick right now ──────────────────────────────
       Computed with the ENGINE's own `trickWinner`, deliberately, rather
       than a second comparison written here: "which card is winning" is a
       rule (trump beats the led suit, §1.3/§1.5), and a client-side copy of
       a rule is a copy that drifts. It reads `trickCards` — what is actually
       on the felt — not `view.trick`, so the marker can never point at a
       card the player cannot see while the queue is mid-play.

       Why it exists at all: a bot that is void in the led suit and whose
       PARTNER is winning may legally discard anything, trump included in
       hand — and that looked to the user like the bot ignoring the
       trump-obligation rule. The rule was right; the table just never said
       whose side was holding the trick. */
    const trumpSuit = view?.bidding.trump ?? null
    const holdingSeat = trumpSuit !== null && trickCards.length > 0
        ? trickWinner(trickCards, trumpSuit)
        : null

    /* ── hydration: the felt after a (re)join ─────────────────────────────
       Cards played before this client was listening exist ONLY in the view.
       `game.state` carries the whole `trick` (the server's `sendStateTo`
       sends it on every join, rejoin and reconnect) but the event stream
       never repeats a `CARD_PLAYED`, so nothing would ever hand those cards
       to the queue. Seed it straight from the view once per connected
       session — on mount, and again after every reconnect — instead of
       waiting for the queue to fall idle. */
    const hydratedRef = useRef(false)
    useEffect(() => {
        if (socket.status !== "open") {
            hydratedRef.current = false
            return
        }
        if (hydratedRef.current || !view) return
        hydratedRef.current = true
        setQueuedTrick(view.trick.cards as TrickCard[])
    }, [socket.status, view])

    /* Which card is FLYING IN right now — the one the queue has just
       released. Everything else on the felt was already there, so a mid-trick
       arrival paints its cards at rest instead of sailing three of them in as
       if they had all been thrown at once. */
    const flyIn: Card | null = active !== null && active.type === "CARD_PLAYED" ? active.card : null

    const [collectTo, setCollectTo] = useState<Seat | null>(null)
    useEffect(() => {
        if (!trickWon) return
        setCollectTo(null)
        const hold = reducedMotion ? 60 : TRICK_HOLD_MS
        const sweep = reducedMotion ? 40 : COLLECT_MS
        const start = setTimeout(() => setCollectTo(trickWon.winner), hold)
        // The felt is cleared when the SWEEP finishes, not when the event
        // does. Leaving the four cards in place for the tail of the dwell put
        // them back in the middle the moment `collectTo` went null again —
        // four cards sailing home after being won.
        const done = setTimeout(() => {
            setQueuedTrick(NO_TRICK)
            setCollectTo(null)
        }, hold + sweep)
        return () => {
            clearTimeout(start)
            clearTimeout(done)
        }
    }, [trickWon, reducedMotion])

    /* The end of the game, announced once. The dialog waits for the queue so
       the last trick is collected first, and it is dismissable: what is
       behind it is the room, ready for another game with the same seats. A
       new game (any phase that is not GAME_OVER) arms it again. */
    const [overDismissed, setOverDismissed] = useState(false)
    const phase = view?.phase ?? null
    useEffect(() => {
        if (phase !== "GAME_OVER") setOverDismissed(false)
    }, [phase])
    const gameOverOpen = phase === "GAME_OVER" && idle && !overDismissed

    /* "Drži zaslon uključenim" (2026-09-20, user request). Only while a deal
       is actually running: the lobby is a page like any other and a finished
       game is a dialog, neither of which should stop the phone locking. The
       switch lives in the game settings and defaults to on; a browser without
       the Wake Lock API simply gets nothing (see `useKeepAwake`). */
    useKeepAwake(phase !== null && phase !== "GAME_OVER")

    /* Hand and trick sizes on a phone come from the room's measured box, not
       from breakpoints (2026-09-20) — see `useTableScale`. */
    const tableScale = useTableScale(socket.yourSeat !== null)

    /* ── "Propustio si potez" (2026-09-20, user request) ──────────────────
       When a human's 15 s turn clock expires the server's bot plays exactly
       ONE move for that seat and the `game.state` of that transition carries
       `autoPlayed: true` (game/packages/server/src/gameRoom.ts, `actForSeat`).
       The flag names no seat, so attribution comes from the events: the
       server broadcasts `game.events` BEFORE the `game.state` they produced
       and one `apply()` is one action, so the acting seat is the seat on the
       last BID / PASS / CARD_PLAYED of the frame that just landed. (TRICK_WON
       carries a winner, not an actor; DEALT and DECLARATIONS_REVEALED carry
       nobody — which is also what keeps the auto-advanced NEXT_DEAL, whose
       state is `autoPlayed: true` as well, from ever being mistaken for a
       missed move.)

       Deliberately narrow: never for another seat's timeout, never for a
       spectator, never for the backlog a (re)joining client is handed — the
       cursor skips whatever was already buffered, exactly like the sound
       cursor above, and a reconnect's `game.state` describes an action from
       before the gap, so attribution is dropped whenever the socket is not
       open. It is purely informational: it blocks nothing, it does not pause
       the queue, and it closes itself the moment the player acts again. */
    const [missedTurn, setMissedTurn] = useState(false)
    /** Seat that acted in the newest `game.events` frame, waiting for the
     *  `game.state` behind it to say whether the server played it for them. */
    const pendingActorRef = useRef<Seat | null>(null)
    const autoCursorRef = useRef(-1)
    const lastViewRef = useRef(socket.view)
    useEffect(() => {
        if (phase === "GAME_OVER") setMissedTurn(false)
    }, [phase])
    useEffect(() => {
        if (socket.status !== "open") {
            pendingActorRef.current = null
            lastViewRef.current = socket.view
            autoCursorRef.current = -1
            return
        }
        const events = socket.events
        if (autoCursorRef.current < 0 && events.length > 0) {
            autoCursorRef.current = events[events.length - 1].id
            lastViewRef.current = socket.view
            return
        }
        for (const item of events) {
            if (item.id <= autoCursorRef.current) continue
            autoCursorRef.current = item.id
            const event = item.event
            if (event.type === "BID" || event.type === "PASS" || event.type === "CARD_PLAYED") {
                pendingActorRef.current = event.seat
            }
        }
        /* Every `game.state` carries a freshly decoded `view`, so a changed
           object identity is exactly "one more state frame arrived" — the
           `autoPlayed` flag itself cannot be used as the trigger, because two
           timeouts in a row never change its value. */
        const stateArrived = lastViewRef.current !== socket.view
        lastViewRef.current = socket.view
        if (!stateArrived) return
        const actor = pendingActorRef.current
        pendingActorRef.current = null
        if (!socket.autoPlayed || actor === null || mySeat === null || actor !== mySeat) return
        if (socket.view?.phase === "GAME_OVER") return
        // Already open (a second timeout before the player came back): it
        // simply stays open rather than flashing.
        setMissedTurn(true)
        playHaptic("turnWarning")
    }, [socket.events, socket.view, socket.autoPlayed, socket.status, mySeat])

    // Declarations dismiss themselves after the queue's dwell; a tap closes
    // them sooner. Each new reveal starts visible again.
    const [declHidden, setDeclHidden] = useState(false)
    const [declarationsOpen, setDeclarationsOpen] = useState(false)
    useEffect(() => setDeclarationsOpen(false), [view?.dealNo])
    useEffect(() => setDeclHidden(false), [revealed])
    // The overlay never outlives the server's no-play window: the moment play
    // opens, it opens for everybody, popup or not.
    const declPending = socket.declarationsPending
    useEffect(() => {
        if (!declPending) setDeclHidden(true)
    }, [declPending])
    const declarationsVisible = declarationsOpen || (revealed !== null && !declHidden)

    /* "Gledanje štihova" (game/README.md §1.8). Whether we may look at all is
       the SERVER's answer: `view.trickHistory` is null when the room's rule
       excludes this seat, and then the tricks were never sent. The button is
       offered only when the room allows reviewing at all, so it does not
       flicker in and out as the lead changes hands under "par koji započinje
       štih"; opening it then explains why there is nothing to see. It closes
       itself when a new deal starts. */
    const [tricksOpen, setTricksOpen] = useState(false)
    useEffect(() => setTricksOpen(false), [view?.dealNo])

    /* "Zovi belu?" (game/README.md §1.4). Announcing bela is the holder's
       CHOICE, not an automatism: on a deal we are going to lose, every point
       of it goes to the opponents, so a bela is 20 points handed to them.

       The question is asked HERE, on the client, before the move goes out —
       the answer travels as a flag on the same `game.play`, so the server sees
       one ordinary play and the table never waits on anybody. `belaAsk` holds
       the card whose tap is being held back; the panel below resolves it.

       It clears itself the moment the question stops being ours to answer: the
       turn moved on (the 15 s clock expired and the server's bot played for
       us), the deal ended, or the card is somehow no longer in hand. Without
       that the panel would sit there offering to play a card we cannot play. */
    const [belaAsk, setBelaAsk] = useState<Card | null>(null)
    useEffect(() => {
        if (belaAsk === null) return
        const stillOurs =
            view !== null &&
            view.phase === "PLAYING" &&
            mySeat !== null &&
            view.turn === mySeat &&
            view.hand.includes(belaAsk)
        if (!stillOurs) setBelaAsk(null)
    }, [belaAsk, view, mySeat])

    useEffect(() => {
        if (!socket.error) return
        if (socket.error.code === "ROOM_CODE_REQUIRED") {
            setAccessCodeOpen(true)
            socket.clearError()
            return
        }
        // BAD_REQUEST while declarations are on screen is the harmless
        // "Pričekajte prikaz zvanja." race in gameRoom.ts's play() — a card
        // played the instant declarations finish can beat the server's own
        // reveal. Swallow it silently rather than alarming the player with a
        // toast for something that resolves itself a moment later.
        if (socket.error.code === "BAD_REQUEST" && (socket.declarationsPending || revealed !== null)) {
            socket.clearError()
            return
        }
        // Schedule the imperative toaster after React has finished this
        // lifecycle, same as GameLobbyPage's own error effect: Chakra's
        // toaster flushes synchronously, and calling it straight from inside
        // the effect body produced React's "flushSync inside a lifecycle"
        // warning (and, in the middle of the leave/navigate/unmount this
        // effect can fire during, occasionally swallowed the toast outright).
        const errorCode = socket.error.code
        const errorRef = socket.error.ref
        queueMicrotask(() => showError(t(`game.error.${errorCode}`)))
        /* These refusals are terminal for this URL: there is nothing to wait
           for on the room screen, so go back to the list. ROOM_NOT_FOUND is
           especially important for old shared links, which otherwise leave
           the page spinning on "Ulazim u sobu…" forever.

           NOT when the refusal is the answer to a code just typed into the
           access-code dial pad (`ref: "room.joinByCode"`, `accessCodeOpen`):
           that is a wrong/full/spectator-blocked code, not a dead room, and
           `JoinByCodeDialog` already clears its digits so the player can try
           another one in place — mirroring `GameLobbyPage`, which never
           navigates away from its own join-by-code dialog either. */
        if ((errorCode === "ROOM_NOT_FOUND" ||
            errorCode === "SPECTATORS_DISABLED" ||
            errorCode === "ROOM_FULL") &&
            !(accessCodeOpen && errorRef === "room.joinByCode")) {
            navigate(`/igra${mock ? "?mock=1" : ""}`, { replace: true })
        }
        socket.clearError()
    }, [socket, t, navigate, mock, revealed, accessCodeOpen])

    useEffect(() => {
        if (room) setAccessCodeOpen(false)
    }, [room])

    // ── sound + haptics ──────────────────────────────────────────────────

    // The two events the queue PACES are voiced when it releases them, so the
    // click lands with the card rather than with the frame that carried it.
    useEffect(() => {
        if (active === null) return
        if (active.type === "CARD_PLAYED") playSound("card")
    }, [active])

    /* Somebody took a chair (2026-09-20, user request): a player who joined
       the room or a bot that was added. Read off `room.seats` rather than the
       event stream, because seating is room state and has no `game.events` of
       its own.

       Leaving has its own cue (`seatLeave`, 2026-09-20, user request): a
       chair emptied — a player left, or a bot was removed — or a player's
       chair went to somebody else. A departure wins over an arrival in the
       same frame, so a leaver replaced by a bot is ONE falling cue, not two.
       A dropped connection is neither: the seat is held for the reconnect
       grace, its occupant does not change.

       Two things it deliberately does NOT do. The FIRST room frame is
       silent — that is the table as it already was when we walked in, not
       four people arriving. And one frame makes at most ONE sound however
       many seats changed in it, so "fill the table" never chimes four times
       over each other. */
    const seatedRef = useRef<string[] | null>(null)
    useEffect(() => {
        if (!room) {
            seatedRef.current = null
            return
        }
        const occupants = room.seats.map((seat) => {
            const o = seat.occupant
            if (!o) return ""
            return o.kind === "BOT" ? `bot:${o.name}` : `player:${o.user.uid}`
        })
        const before = seatedRef.current
        seatedRef.current = occupants
        if (before === null) return
        // A chair emptied, or a PLAYER's chair changed hands (a leaver
        // replaced by a bot mid-game is a departure, not an arrival).
        const departed = occupants.some((who, i) => {
            const was = before[i] ?? ""
            return was !== "" && who !== was && (who === "" || was.startsWith("player:"))
        })
        const arrived = occupants.some((who, i) => who !== "" && who !== (before[i] ?? ""))
        if (departed) playSound("seatLeave")
        else if (arrived) playSound("seatJoin")
    }, [room])

    // Everything else rides the raw event stream, which is the only place a
    // zero-dwell event (a bid, GAME_OVER) is guaranteed to be seen at all.
    const soundCursor = useRef(-1)
    /** The end-of-game fanfare, waiting for the dialog it belongs to. */
    const overSound = useRef<"gameWon" | "gameLost" | null>(null)
    useEffect(() => {
        const events = socket.events
        if (events.length === 0) return
        if (soundCursor.current < 0) {
            // First batch after mount (or after a reconnect replay): catch up
            // silently, or a player rejoining mid-deal gets the whole deal
            // played back at them in one second.
            //
            // With ONE exception (2026-09-20, user report: "card-shuffle.wav
            // se ne igra"): if the newest event in that first batch is the
            // DEALT of a fresh deal, we did not walk in on a game in progress
            // — the deal is starting right now and the shuffle belongs to it.
            // That is the ordinary first deal of every game: the table mounts
            // and the first frame it is handed already contains DEALT, so the
            // catch-up was swallowing the one cue it was never meant to skip.
            const newest = events[events.length - 1]
            soundCursor.current = newest.id
            if (newest.event.type === "DEALT") playSound("gameStart")
            return
        }
        for (const item of events) {
            if (item.id <= soundCursor.current) continue
            soundCursor.current = item.id
            switch (item.event.type) {
                case "DEALT":
                    /* EVERY deal, not only the first (2026-09-20, user
                       request): the riffle is what says the previous deal is
                       finished and the next eight cards are on their way. It
                       rides the raw stream, so it lands while the queue is
                       still playing the last hand out — i.e. just before the
                       new cards appear, which is where a shuffle belongs. */
                    playSound("gameStart")
                    break
                case "GAME_OVER":
                    /* NOT voiced here (2026-09-20, user request): the event
                       lands with the last card, while the queue is still
                       collecting the final trick, so the fanfare went off
                       seconds before the "Pobjeda!" dialog appeared. The
                       winner is parked and the effect below plays it the
                       moment that dialog opens. Parking it here — rather
                       than reading `view.winner` when the dialog opens —
                       keeps the existing rule that a client joining a
                       finished game hears nothing: the cursor skips whatever
                       was already buffered. */
                    overSound.current = item.event.winner === myTeam ? "gameWon" : "gameLost"
                    break
                default: break
            }
        }
    }, [socket.events])

    /* …and the fanfare itself, on the frame the end-of-game dialog opens
       (2026-09-20, user request: "zvuk se odmah cuje cim je zadnja karta
       bacena, al trebao bi se cuti tek kad se pojavi ekran"). `overSound` is
       consumed, so re-opening the dialog after a dismissal stays quiet. */
    useEffect(() => {
        if (!gameOverOpen) return
        const which = overSound.current
        if (which === null) return
        overSound.current = null
        playSound(which)
        playHaptic("gameOver")
    }, [gameOverOpen])

    /* The turn clock entering its urgent quarter. Armed as one timeout per
       turn, from the server's absolute deadline; a turn that is already
       inside that quarter when we see it (a rejoin) stays quiet rather than
       buzzing out of nowhere. */
    const turnDeadline = socket.turnDeadline
    const turn = view?.turn ?? null
    const isBotTurn = turn !== null && room?.seats[turn]?.occupant?.kind === "BOT"
    // One server-synchronised clock drives both the active avatar ring and
    // the straight progress bar between the felt and the turn label. A bot's
    // think pause intentionally starts no client-side clock at all.
    const turnCountdown = useTurnCountdown(
        isBotTurn ? null : turnDeadline,
        isBotTurn ? 0 : (socket.turnDurationMs ?? 0),
    )
    // Bigger on web (2026-09-18, user request) — a phone's avatar has to
    // stay small enough to leave room for the cards, a wide screen does not.
    const myAvatarSize = useBreakpointValue<number>({ base: 34, md: 44 }) ?? 34
    // From 48em the hand is one row and my avatar docks right against its
    // left edge (2026-09-20, user request) instead of at a fixed inset from
    // the column's edge, which on a wide column left it stranded.
    const handRow = handRowWidth(useBreakpointValue(HAND_CARD_SIZE) ?? "sm")
    const turnTimeoutMs = room?.turnTimeoutMs ?? 0
    useEffect(() => {
        if (mySeat === null || turn !== mySeat || turnDeadline === null || turnTimeoutMs <= 0) return
        const now = Date.now()
        const ids: ReturnType<typeof setTimeout>[] = []
        // The urgent-quarter warning, unless it would land on top of the
        // hurry ticks below (a short turn clock): then the ticks say it all.
        const warningLeft = turnTimeoutMs * TURN_WARNING_FRACTION
        const warningDelay = turnDeadline - warningLeft - now
        if (warningDelay > 0 && warningLeft > TURN_HURRY_TICKS_MS[0] + 500) {
            ids.push(setTimeout(() => playHaptic("turnWarning"), warningDelay))
        }
        // The last three seconds: tick, tick, tick. Playing the card changes
        // `turn`, the cleanup clears what is left, and the phone goes quiet.
        // A tick whose moment has already passed (a rejoin) is skipped.
        for (const left of TURN_HURRY_TICKS_MS) {
            const delay = turnDeadline - left - now
            if (delay <= 0) continue
            // The tick is what an iOS PWA gets instead of the buzz (Safari
            // has no Vibration API); everywhere else the two arrive together.
            const last = left === TURN_HURRY_TICKS_MS[TURN_HURRY_TICKS_MS.length - 1]
            ids.push(setTimeout(() => {
                playHaptic("turnHurry")
                playSound(last ? "turnTickLast" : "turnTick")
            }, delay))
        }
        return () => ids.forEach(clearTimeout)
    }, [mySeat, turn, turnDeadline, turnTimeoutMs])

    const leave = () => {
        // Clear sticky membership immediately as well as notifying the
        // server. Sending the frame directly left a short window in which the
        // lobby could try to rejoin a room that the server had just dissolved.
        socket.leaveRoom()
        navigate(`/igra${mock ? "?mock=1" : ""}`)
    }

    if (!room) {
        return (
            <>
                <Flex direction="column" align="center" justify="center" minH="50vh" gap="3">
                    {socket.status === "closed" ? (
                        <>
                            <Text color="fg.muted">{t("game.connection.closed")}</Text>
                            <Button size="sm" variant="outline" onClick={() => navigate("/igra")}>
                                <FiArrowLeft /> {t("game.room.backToLobby")}
                            </Button>
                        </>
                    ) : !accessCodeOpen ? (
                        <>
                            <Spinner />
                            <Text color="fg.muted">{t("game.room.joining")}</Text>
                            {slowConnection && <Text fontSize="sm" color="orange.600">{t("game.connection.slow")}</Text>}
                        </>
                    ) : null}
                </Flex>
                <JoinByCodeDialog open={accessCodeOpen} error={socket.error}
                    onOpenChange={(open) => {
                        setAccessCodeOpen(open)
                        if (!open) navigate(`/igra${mock ? "?mock=1" : ""}`, { replace: true })
                    }}
                    onSubmit={(code) => socket.send({ t: "room.joinByCode", code })} />
            </>
        )
    }

    /* Room screen or table? The room's own status decides — with one wait:
       the LAST trick of a game arrives BEFORE the felt is allowed to go.
       The server marks the room LOBBY the moment the engine settles the
       deciding deal (README §1.7), and that `room.state` overtakes the
       `game.events` describing the trick that just ended it. Swapping to the
       room panel on the spot would yank the felt out from under the fourth
       card. So the table stays until the event queue has played the ending
       out; then the room appears, with the result dialog over it. */
    const inLobbyPhase = !view || (room.status === "LOBBY" && idle)

    /* Does throwing this card put the "Zovi belu?" question to me?
       Only when it is the FIRST of trump K/Q out of a hand holding both, and
       only while a bela could still score at all — `room.allowBela` is the
       server's own normalised answer to the room's rules, so a table that
       plays without bela is never asked. (`view.belaDeclared` cannot already
       be set while I hold both halves; it is checked anyway, cheaply.)

       This is a UI gate, not a rule: the engine re-derives all of it from the
       hand, and a flag it cannot back changes nothing. */
    const shouldAskBela = (card: Card): boolean => {
        if (!view || !room.allowBela || view.belaDeclared !== null) return false
        const trump = view.bidding.trump
        if (trump === null || cardSuit(card) !== trump) return false
        const rank = cardRank(card)
        if (rank !== "K" && rank !== "Q") return false
        return view.hand.includes(makeCard("K", trump)) && view.hand.includes(makeCard("Q", trump))
    }

    /* Acting myself answers the "Propustio si potez" notice better than any
       button does, so every outgoing move closes it (2026-09-20). Kept as one
       helper rather than four `setMissedTurn(false)` calls so a future move
       type cannot forget it. */
    const clearMissedTurn = () => setMissedTurn(false)

    /** Send the move, asking about the bela first when this card raises it. */
    const playCard = (card: Card) => {
        if (shouldAskBela(card)) {
            setBelaAsk(card)
            return
        }
        clearMissedTurn()
        socket.send({ t: "game.play", card })
    }

    const rejectCard = () => {
        const id = "game-illegal-card"
        const toast = {
            // Warning has an opaque orange surface and an icon in the shared
            // toaster. The former info surface inherited the translucent
            // panel colour and disappeared into the mobile header.
            type: "warning" as const,
            title: t("game.hand.illegalPlay"),
            duration: 3200,
            closable: true,
        }
        if (toaster.isVisible(id)) toaster.update(id, toast)
        else toaster.create({ id, ...toast })
    }

    const answerBela = (bela: boolean) => {
        if (belaAsk === null) return
        clearMissedTurn()
        socket.send({ t: "game.play", card: belaAsk, bela })
        setBelaAsk(null)
    }

    /* ── the status pill: what is the table waiting for? ───────────────── */
    let tone: TurnTone = "idle"
    let turnLabel = t("game.table.waiting")
    if (view) {
        const name = seatName(room.seats, view.turn, t("game.seat.empty"))
        if (view.phase === "BIDDING") {
            tone = view.turn === mySeat && mySeat !== null ? "you" : "call"
            turnLabel = view.turn === mySeat && mySeat !== null
                ? t("game.table.turnYourCall")
                : t("game.table.turnCalling", { name })
        } else if (view.phase === "PLAYING") {
            tone = view.turn === mySeat && mySeat !== null ? "you" : "other"
            turnLabel = view.turn === mySeat && mySeat !== null
                ? t("game.table.turnYou")
                : t("game.table.turnOther", { name })
        }
    }

    if (socket.declarationsPending) {
        tone = "idle"
        // "Igra računa zvanja…" only until they have been SHOWN. Once the
        // reveal has happened (popup up, or already closed) the wait that is
        // left is the server's common start line, and saying the game is
        // still calculating what is on screen was simply wrong
        // (2026-09-20, user report).
        const declSeen = revealed !== null || (view !== null && declShownDeal === view.dealNo)
        turnLabel = t(declSeen ? "game.declarations.starting" : "game.declarations.calculating")
    }

    const talonVisible = view !== null
        && view.phase !== "BIDDING"
        && talonRevealedDeal === view.dealNo
    const storedBiddingHand = biddingHand.current
    const retainedBiddingHand = storedBiddingHand !== null && storedBiddingHand.dealNo === view?.dealNo
        ? storedBiddingHand.cards
        : null
    const displayedHand = view === null || view.phase === "BIDDING" || talonVisible
        ? view?.hand ?? []
        : retainedBiddingHand ?? view.hand.slice(0, 6)
    const displayedHandPhase = view !== null && talonVisible ? view.phase : "BIDDING"

    /* Short, visible milestones occupy the table as overlays, so explaining
       a phase never inserts a row and moves the hand or the seats. The same
       text is a polite live region for screen-reader users. */
    let phaseNotice: { title: string; hint?: string } | null = null
    if (active === null && socket.declarationsPending && !revealed) {
        phaseNotice = { title: t("game.phase.declarations") }
    }

    /* Bid chips under the seats: who has said "Dalje" this deal. The caller
       needs no chip — the moment they name a suit it becomes the trump
       medallion on their avatar, and that one stays for the whole deal. */
    const bids: Partial<Record<Seat, SeatBid>> = {}
    if (view && view.phase === "BIDDING") {
        for (const seat of view.bidding.passes) bids[seat] = { kind: "pass" }
    }
    const isBidding = view?.phase === "BIDDING" && mySeat !== null

    return (
        <Flex
            ref={tableScale.ref}
            style={tableScale.style}
            className="fold-game-board"
            direction="column"
            position="relative"
            // The room lobby needs the same mobile bleed as the felt. The
            // app container already owns a 16 px inset; keeping it *and* the
            // room panel's inset made a narrow phone spend over 50 px on
            // empty margins before a chair could begin.
            w={{ base: "calc(100% + 32px)", md: "100%" }}
            // The column widens with the screen now (DESIGN §6): 720 px was
            // one number for a phone, a tablet and a 27-inch monitor, and on
            // the last two it left the table marooned in the middle of a wide
            // window. The steps are deliberately small — a card table read
            // from one seat has a natural size, and past ~900 px the seats
            // stop being one glance apart.
            maxW={{ base: "720px", md: "760px", lg: "880px", xl: "900px" }}
            mx={{ base: "-16px", md: "auto" }}
            mt={{ base: inLobbyPhase ? "0" : "-24px", md: "0" }}
            h={{
                base: inLobbyPhase
                    ? `calc(100dvh - ${CONTENT_STICKY_TOP.base})`
                    : `calc(100dvh - ${NAVBAR_SAFE_TOP.base})`,
                md: `calc(100dvh - ${CONTENT_STICKY_TOP.md})`,
            }}
            mb="-24px"
            overflow="hidden"
            css={{
                /* NOTHING ON THE TABLE IS TEXT TO SELECT (2026-09-20, user
                   report: a long press on a card or a name brought up iOS's
                   selection handles and the magnifier mid-deal). The cards,
                   the names and the status lines are a game surface, so the
                   whole room opts out of selection and out of the iOS
                   long-press callout. Real inputs keep both — the only ones
                   here are in dialogs, and a field you cannot select text in
                   is broken. */
                userSelect: "none",
                WebkitUserSelect: "none",
                WebkitTouchCallout: "none",
                "& input, & textarea, & [contenteditable='true']": {
                    userSelect: "text",
                    WebkitUserSelect: "text",
                },
                ...(inLobbyPhase
                    ? {}
                    : {
                          // iOS honours touch-action before it starts its
                          // native rubber-band gesture. The table itself has
                          // no vertical pan affordance; sheets render in a
                          // portal and retain their own scroll when needed.
                          touchAction: "pan-x",
                          overscrollBehavior: "none",
                      }),
            }}
        >
            {inLobbyPhase ? (
                <>
                    {/* `display: flex` so the panel can fill this box and put
                        its controls on the floor of it (2026-09-09, user
                        request): "Privatna", "Spreman" and "Pokreni igru"
                        belong at the bottom of the screen, under the four
                        seats, not floating halfway up with a screen of empty
                        room beneath them. */}
                    <Box flex="1" overflowY="auto" display="flex" flexDirection="column">
                        {/* No end-of-game strip above the room. A finished
                            game is announced ONCE, in the middle of the
                            screen (GameOverDialog, rendered below for both
                            branches); after that the room — seats, rules,
                            "Spreman" — is what is on screen, undisturbed. */}
                        <RoomPanel
                            room={room}
                            mySeat={socket.yourSeat}
                            myUid={socket.me?.uid ?? null}
                            disabled={socket.status !== "open"}
                            onSit={(seat) => socket.send({ t: "room.sit", seat })}
                            onAddBot={(seat) => socket.send({ t: "room.addBot", seat })}
                            onRemoveBot={(seat) => socket.send({ t: "room.removeBot", seat })}
                            onReady={(ready) => socket.send({ t: "room.ready", ready })}
                            /* The launch cue is voiced on the TAP, not on the
                               server's answer (2026-09-20, user request):
                               `primeAudio` first, because on iOS the audio
                               context may only be unlocked inside a user
                               gesture and for most players this tap is the
                               first one of the session. */
                            onStart={() => {
                                primeAudio()
                                playSound("gameLaunch")
                                socket.send({ t: "room.start" })
                            }}
                            onLeave={leave}
                            onPrivacyChange={(value) => socket.send({ t: "room.setPrivate", private: value })}
                            onSettings={() => setSettingsOpen(true)}
                        />
                    </Box>
                </>
            ) : (
                view && (
                    <Flex
                        direction="column"
                        flex="1"
                        minH="0"
                        position="relative"
                        overflow="hidden"
                        rounded={{ base: "0", md: "l3" }}
                        borderWidth="0"
                        boxShadow="none"
                        {...PLAY_AREA}
                    >
                        {/* "Veza je pala" strip: top of the felt, under the
                            header. Renders null unless a seat hold is
                            running, so it costs no height the rest of the
                            time — the wrapper is here to keep it out of the
                            flex column's shrinking. */}
                        <Box px="2" flexShrink={0}>
                            <ReconnectBanner holdUntil={socket.holdUntil} status={socket.status} />
                        </Box>

                        {/* No horizontal padding on this wrapper: the score
                            panel's bottom hairline is the delimiter between
                            the score and the playing surface, and a delimiter
                            that stops 8 px short of both edges reads as the
                            underline of a box rather than a divider. The
                            panel keeps its own inner `px` for the content. */}
                        <Box flexShrink={0}>
                            <ScoreBoard
                                view={shownView ?? view}
                                seats={room.seats}
                                targetScore={room.targetScore}
                                onBackgroundClick={view.declarationsRevealed ? () => setDeclarationsOpen((value) => !value) : undefined}
                                header={
                                    <TableHeader
                                        targetScore={room.targetScore}
                                        gameEndRule={room.gameEndRule}
                                        chips={
                                            <>
                                                {socket.status !== "open" && (
                                                    <StatusChip tone="warn">{slowConnection ? t("game.connection.slow") : t(`game.connection.${socket.status}`)}</StatusChip>
                                                )}
                                            </>
                                        }
                                        onSettings={() => setSettingsOpen(true)}
                                    />
                                }
                                actions={
                                    <TableActions
                                        declarationsEnabled={view.declarationsRevealed}
                                        // Same masked figure the score panel reads
                                        // above (`shownView`) — one shared rule, so
                                        // the badge and the "+40" can never disagree
                                        // about whether the reveal has happened yet.
                                        declarationPoints={{
                                            us: (shownView ?? view).declarationPoints?.[myTeam] ?? 0,
                                            them: (shownView ?? view).declarationPoints?.[otherTeam(myTeam)] ?? 0,
                                        }}
                                        onDeclarations={() => setDeclarationsOpen((value) => !value)}
                                        tricksEnabled={room.trickReview !== "off"}
                                        tricksPlayed={view.tricksWon.A + view.tricksWon.B}
                                        onTricks={() => setTricksOpen((value) => !value)}
                                        spectators={room.allowSpectators ? room.spectators.length : null}
                                    />
                                }
                                noDeclarations={room.noDeclarations}
                                allowBela={room.allowBela}
                            />
                        </Box>

                        {/* The table takes the height left between the score
                            panel and the turn pill, and what it does not claim
                            is slack this row has to put somewhere.

                            IT GOES UNDER THE BLOCK, ON EVERY WIDTH (2026-09-20,
                            user request twice: first the gap between the
                            header and the seats on a phone, then the same on
                            the web — "bot karlo/suigrac neka sjedi jos gore,
                            blize boxu sa bodovima"). Splitting it evenly
                            (`center`) left the partner a visible band below
                            the score panel on any tall window. */}
                        <Flex flex="1" minH="0" direction="column"
                            justify="flex-start" pt="1">
                            <Table
                                room={room}
                                view={shownView ?? view}
                                turnDeadline={socket.turnDeadline}
                                turnDurationMs={socket.turnDurationMs}
                                trickCards={trickCards}
                                holdingSeat={holdingSeat}
                                flyIn={flyIn}
                                collectTo={collectTo}
                                reducedMotion={reducedMotion}
                                showTurn={turnShown}
                                bids={bids}
                                reactions={bubbles}
                            />
                        </Flex>

                        {/* Overlays sit on the WHOLE felt, not inside the
                            seats block: that block is deliberately bounded
                            now, and a declarations list is taller than it. */}
                        {phaseNotice && (
                            <Flex
                                position="absolute"
                                inset="0"
                                align="center"
                                justify="center"
                                pointerEvents="none"
                                zIndex={7}
                            >
                                <HStack
                                    {...GLASS}
                                    borderColor="brand.300"
                                    rounded="full"
                                    px="4"
                                    py="2"
                                    gap="2"
                                    boxShadow="0 0 30px rgba(0,0,0,0.5)"
                                >
                                    <Box role="status" aria-live="polite" aria-atomic="true">
                                        <Text fontSize="sm" fontWeight="bold" color={INK} textAlign="center">
                                            {phaseNotice.title}
                                        </Text>
                                        {phaseNotice.hint && (
                                            <Text fontSize="xs" color={INK_MUTED} textAlign="center">
                                                {phaseNotice.hint}
                                            </Text>
                                        )}
                                    </Box>
                                </HStack>
                            </Flex>
                        )}

                        {/* Keyed by the room: walking into ANOTHER game as a
                            spectator greets again, a re-render does not. */}
                        {mySeat === null && <SpectatorIntro key={room.id} reducedMotion={reducedMotion} />}

                        {declarationsVisible && (
                            <DeclarationsReveal
                                perSeat={declarationsOpen ? view.declarations : revealed!.perSeat}
                                scoringTeam={declarationsOpen ? view.declarationsScoringTeam : revealed!.scoringTeam}
                                seats={room.seats}
                                mySeat={mySeat}
                                declarationPoints={declarationsOpen ? view.declarationPoints : undefined}
                                belaDeclared={declarationsOpen ? view.belaDeclared : null}
                                trumpSuit={declarationsOpen ? trumpSuit : null}
                                onDismiss={() => { setDeclHidden(true); setDeclarationsOpen(false) }}
                            />
                        )}

                        {tricksOpen && (
                            <TrickHistory
                                tricks={view.trickHistory ?? null}
                                trickReview={room.trickReview}
                                seats={room.seats}
                                mySeat={mySeat}
                                onDismiss={() => setTricksOpen(false)}
                            />
                        )}

                        {trumpFlash && trumpSet && (
                            <TrumpFlash seats={room.seats} seat={trumpSet.caller} suit={trumpSet.trump} />
                        )}
                        {bela && <BelaFlash seats={room.seats} seat={bela.seat} />}
                        {belot && (
                            <BelotFlash
                                seats={room.seats}
                                seat={belot.seat}
                                mySeat={mySeat}
                                suit={belot.suit}
                                reducedMotion={reducedMotion}
                            />
                        )}

                        {/* The question, over the hand tray and nothing else.
                            `BelaFlash` above is the answer landing: it is what
                            confirms to the whole table that the choice took. */}
                        {belaAsk !== null && (
                            <BelaPrompt
                                onDeclare={() => answerBela(true)}
                                onDecline={() => answerBela(false)}
                            />
                        )}

                        {/* Always mounted, never conditionally on `isBotTurn`
                            (2026-09-20, user report): the bar is a fixed
                            `minH="6px"` row, and mounting/unmounting it as
                            the turn moved between me, an opponent and a bot
                            shifted everything below it by that row's height
                            every single turn. `useTurnCountdown` already
                            returns an idle, zero-fraction countdown when
                            there is no deadline, so folding `isBotTurn` into
                            `active` alone (instead of the whole element) just
                            draws the bar empty on a bot's turn. */}
                        <TurnProgressBar
                            countdown={turnCountdown}
                            active={!isBotTurn && turnDeadline !== null && (socket.turnDurationMs ?? 0) > 0}
                            reducedMotion={reducedMotion}
                        />

                        {/* Just the status pill now, centred over the hand:
                            "did I move" is what a glance up asks, and my own
                            name/avatar answer a different question (DESIGN
                            change 2026-09-18 — the avatar moved to the
                            bottom-left corner, see below). On a landscape
                            phone the reactions join this row to buy the felt
                            another 30 px. */}
                        <Flex
                            justify="center"
                            align="center"
                            gap="2"
                            px="2"
                            py="0"
                            flexShrink={0}
                        >
                            {/* Hidden, not removed, while the declarations overlay
                                is up: the overlay already says what is going
                                on, and the row must keep its height. */}
                            <Box visibility={declarationsVisible || !turnShown ? "hidden" : undefined}>
                                <TurnPill tone={tone} label={turnLabel} />
                            </Box>
                            {view?.phase !== "BIDDING" && mySeat !== null && (
                                <Box display="none" css={{ [SHORT]: { display: "block" } }}>
                                    <ReactionsBar
                                        disabled={socket.status !== "open"}
                                        onReact={(reaction) => socket.sendReaction(reaction)}
                                    />
                                </Box>
                            )}
                        </Flex>

                        {/* The hand, dead-centre of the row: reactions live
                            in their own slot below (back at the bottom,
                            2026-09-18), so nothing narrows the box the hand
                            centres itself in. The avatar DOES dock to this
                            box (below), vertically centred on the hand's own
                            left edge. */}
                        <Box
                            position="relative"
                            px="2"
                            pt="0"
                            pb="0"
                            flexShrink={0}
                        >
                            <Hand
                                cards={displayedHand}
                                legal={view.legalMoves}
                                phase={displayedHandPhase}
                                layoutKey={mySeat === null ? null : `${room.id}:${view.dealNo}:${mySeat}`}
                                // `!turnShown`: the trick I just won is still being
                                // held and swept. The server already made it my
                                // lead, so a tap went through — and the card
                                // left my hand but could not land on the felt
                                // until the sweep finished: for a second it was
                                // nowhere (2026-09-20, user report).
                                disabled={busy || !turnShown || declarationsOpen || tricksOpen || belaAsk !== null || (!!revealed && !declHidden)}
                                onPlay={playCard}
                                onInvalidPlay={rejectCard}
                            />

                            {/* My own avatar — turn ring, dealer's "D", caller
                                medallion, reaction bubble — docked left of
                                the hand, vertically centred on it, on every
                                width (2026-09-18, user request: same left
                                position on mobile and web, not the bottom
                                corner it started in; bigger on web via
                                `myAvatarSize`). A spectator has no seat, so
                                they get nothing here.

                                `insetStart="5"`: a fixed inset, not a
                                calc-to-the-grid's-edge one. Widening the hand
                                (2026-09-18, "prosiri velicinu karta") left as
                                little as ~15 px of margin around the grid at
                                the wide breakpoint — less than the avatar's
                                own frame — so no inset value can hug the
                                grid's true edge there without overlapping the
                                first card; a fixed, known-safe inset (the
                                same value that already clears the
                                caller-trump medallion's overhang, see below)
                                is the robust choice over a formula that
                                breaks every time the card size changes. */}
                            {mySeat !== null && (
                                <Box
                                    position="absolute"
                                    {...(handRow === null
                                        // 12 px on a phone (was 20): the hand is
                                        // centred on the page again and needs the
                                        // 8 px (2026-09-20). Still clears the
                                        // caller medallion's ~9 px overhang.
                                        ? { insetStart: "3" }
                                        : { right: `calc(50% + ${handRow / 2 + 10}px)` })}
                                    // Align my seat with the first card's top
                                    // edge. Its reaction bubble grows upward,
                                    // into the clear strip above the hand,
                                    // instead of covering the cards below.
                                    // Follows `Hand`'s own top padding, which
                                    // is smaller on a phone.
                                    top={{ base: "2", md: "4" }}
                                    // The hand avatar used to sit in a higher
                                    // compositing layer than the declarations
                                    // backdrop on iOS, leaving it sharp while
                                    // the rest of the table blurred. Keep it
                                    // physically below the overlay too.
                                    zIndex={declarationsVisible ? 0 : 8}
                                    filter={declarationsVisible ? "blur(2px)" : undefined}
                                    opacity={declarationsVisible ? 0.65 : undefined}
                                >
                                    <SeatAvatar
                                        occupant={room.seats[mySeat].occupant}
                                        name={occupantName(room.seats[mySeat].occupant, t("game.seat.empty"))}
                                        size={myAvatarSize}
                                        isTurn={turnShown && view.turn === mySeat}
                                        isDealer={view.dealer === mySeat}
                                        // Same medallion the felt's seats wear, so
                                        // "I called this deal" reads the same way
                                        // wherever the caller happens to be sitting.
                                        callerTrump={!trumpHidden && view.bidding.caller === mySeat ? view.bidding.trump : null}
                                        countdown={turnShown && view.turn === mySeat ? turnCountdown : null}
                                        reaction={bubbles[mySeat] ?? null}
                                        // Same convention as the felt's own left-flank
                                        // seat (Table.tsx): pins the bubble's LEFT edge
                                        // to the avatar so it grows rightward — the
                                        // default "center" ran it half off the left
                                        // edge of the screen (bug reported 2026-09-18).
                                        reactionAlign="left"
                                        reducedMotion={reducedMotion}
                                    />
                                </Box>
                            )}
                        </Box>

                        {/* Reactions back at the bottom (2026-09-18, user
                            request — reverted the brief side-rail detour):
                            this slot stays in the flow, reserving
                            BiddingPanel's own row height, whether or not it
                            is actually my bid. Letting it collapse to nothing
                            the instant a suit is called shrinks the column's
                            fixed height, and the felt's `flex="1"` block
                            above grows to fill the gap, visibly shifting
                            every seat down (2026-09-18, user-reported jump).
                            The two are mutually exclusive and close enough in
                            height (46 px vs 44 px) that swapping one for the
                            other never triggers that jump on its own. */}
                        <Box
                            px="2"
                            pt="1"
                            flexShrink={0}
                            minH={ROW_H}
                            // The LAST element of the column, and therefore
                            // the only one that pays for the iPhone home
                            // indicator. `Hand` and the hand's own wrapper
                            // used to add the same inset again (2026-09-20):
                            // in a standalone PWA that is ~70 px of dead
                            // space sitting between the cards and this row.
                            css={{ paddingBottom: "calc(4px + var(--safe-bottom))" }}
                        >
                            {isBidding ? (
                                <BiddingPanel
                                    view={view}
                                    busy={busy}
                                    onBid={(trump: Suit) => {
                                        clearMissedTurn()
                                        socket.send({ t: "game.bid", trump })
                                    }}
                                    onPass={() => {
                                        clearMissedTurn()
                                        socket.send({ t: "game.pass" })
                                    }}
                                />
                            ) : mySeat === null ? null : (
                                <Box css={{ [SHORT]: { display: "none" } }}>
                                    <ReactionsBar
                                        disabled={socket.status !== "open"}
                                        onReact={(reaction) => socket.sendReaction(reaction)}
                                    />
                                </Box>
                            )}
                        </Box>

                        <DealSummary
                            open={view.phase === "DEAL_DONE" && idle}
                            dealScore={view.dealScore}
                            myTeam={myTeam}
                            busy={busy}
                            canContinue={mySeat !== null}
                            onNextDeal={() => socket.send({ t: "game.nextDeal" })}
                        />

                    </Flex>
                )
            )}

            {/* Informational only, and never stacked on the end-of-game
                dialog: the game being over says everything a missed move
                would have. */}
            <MissedTurnDialog
                open={missedTurn && view?.phase !== "GAME_OVER"}
                onClose={() => setMissedTurn(false)}
            />

            {view && (
                <GameOverDialog
                    open={gameOverOpen}
                    winner={view.winner}
                    score={view.score}
                    myTeam={myTeam}
                    spectator={mySeat === null}
                    belotName={view.belotSeat == null || !room
                        ? null
                        : seatName(room.seats, view.belotSeat, t("game.seat.empty"))}
                    onDismiss={() => setOverDismissed(true)}
                />
            )}

            <GameSettingsSheet
                open={settingsOpen}
                onClose={() => setSettingsOpen(false)}
                /* The room's own settings ride at the top of the sheet while
                   it is still a lobby (game/README.md §3). The sheet decides
                   whether to draw them; this only supplies the facts. */
                room={room}
                isHost={socket.me?.uid != null && room?.hostUid === socket.me.uid}
                onChangeOptions={(patch) => socket.send({ t: "room.setOptions", ...patch })}
            />
        </Flex>
    )
}

/* `StatusChip` moved to `TableHeader.tsx` with the rest of the header's
   vocabulary — it is imported above and used in the `chips` slot. */
