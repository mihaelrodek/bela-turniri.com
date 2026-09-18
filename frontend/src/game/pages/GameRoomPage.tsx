import { useEffect, useRef, useState } from "react"
import { CHAT_ENABLED } from "../chatEnabled"
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
import Chat, { ChatToggle } from "../components/Chat"
import DealSummary from "../components/DealSummary"
import DeclarationsReveal, { BelaFlash, BelotFlash } from "../components/DeclarationsReveal"
import GameOverDialog from "../components/GameOverDialog"
import GameSettingsSheet from "../components/GameSettingsSheet"
import Hand from "../components/Hand"
import JoinByCodeDialog from "../components/JoinByCodeDialog"
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
import { useTurnCountdown } from "../hooks/useTurnCountdown"
import { cardRank, cardSuit, makeCard } from "../util/cards"
import { occupantName, otherTeam, teamOf } from "../util/seats"
import { playHaptic } from "../util/haptics"
import { playSound, primeAudio } from "../util/sounds"

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

/** Nothing on the felt, and a stable identity so the sync effect below does
 *  not fire on every render while the player has no view yet. */
const NO_TRICK: TrickCard[] = []

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
    const { active, pending } = useEventQueue(socket.events, reducedMotion)
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

    const [chatOpen, setChatOpen] = useState(false)
    const [settingsOpen, setSettingsOpen] = useState(false)
    const [accessCodeOpen, setAccessCodeOpen] = useState(false)
    const joinedOnce = useRef(false)

    // Browsers block audio created outside a user gesture. Unlock Web Audio
    // on the first tap or keypress at the table, so the next card/event can
    // be heard without making a sound just for entering the room.
    useEffect(() => {
        const unlock = () => primeAudio()
        window.addEventListener("pointerdown", unlock, { once: true, passive: true })
        window.addEventListener("keydown", unlock, { once: true })
        return () => {
            window.removeEventListener("pointerdown", unlock)
            window.removeEventListener("keydown", unlock)
        }
    }, [])

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
       until HAND_COMPLETED itself reaches the front of that queue. Slicing
       the new eight-card, already-sorted hand here would temporarily replace
       cards before the talon was revealed. On a reconnect there is no event
       backlog to replay; an idle, already-playing view is therefore hydrated
       immediately. */
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
            active?.type === "HAND_COMPLETED"
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
    const [unread, setUnread] = useState(0)
    const seenChatRef = useRef(0)

    useDocumentHead({ title: t("game.room.metaTitle", { name: room?.name ?? "" }) })

    // ── event-driven overlays ────────────────────────────────────────────
    const trickWon = active !== null && active.type === "TRICK_WON" ? active : null
    const revealed = active !== null && active.type === "DECLARATIONS_REVEALED" ? active : null
    const bela = active !== null && active.type === "BELA" ? active : null
    const belot = active !== null && active.type === "BELOT" ? active : null

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

    // Declarations dismiss themselves after the queue's dwell; a tap closes
    // them sooner. Each new reveal starts visible again.
    const [declHidden, setDeclHidden] = useState(false)
    const [declarationsOpen, setDeclarationsOpen] = useState(false)
    useEffect(() => setDeclarationsOpen(false), [view?.dealNo])
    useEffect(() => setDeclHidden(false), [revealed])
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
        showError(t(`game.error.${socket.error.code}`))
        /* These refusals are terminal for this URL: there is nothing to wait
           for on the room screen, so go back to the list. ROOM_NOT_FOUND is
           especially important for old shared links, which otherwise leave
           the page spinning on "Ulazim u sobu…" forever. */
        if (socket.error.code === "ROOM_NOT_FOUND" ||
            socket.error.code === "SPECTATORS_DISABLED" ||
            socket.error.code === "ROOM_FULL") {
            navigate(`/igra${mock ? "?mock=1" : ""}`, { replace: true })
        }
        socket.clearError()
    }, [socket, t, navigate, mock])

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

    // Everything else rides the raw event stream, which is the only place a
    // zero-dwell event (a bid, GAME_OVER) is guaranteed to be seen at all.
    const soundCursor = useRef(-1)
    useEffect(() => {
        const events = socket.events
        if (events.length === 0) return
        if (soundCursor.current < 0) {
            // First batch after mount (or after a reconnect replay): catch up
            // silently, or a player rejoining mid-deal gets the whole deal
            // played back at them in one second.
            soundCursor.current = events[events.length - 1].id
            return
        }
        for (const item of events) {
            if (item.id <= soundCursor.current) continue
            soundCursor.current = item.id
            switch (item.event.type) {
                case "DEALT":
                    if (item.event.dealNo === 1) playSound("gameStart")
                    break
                case "GAME_OVER":
                    playSound(item.event.winner === myTeam ? "gameWon" : "gameLost")
                    playHaptic("gameOver")
                    break
                default: break
            }
        }
    }, [socket.events])

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
    const turnTimeoutMs = room?.turnTimeoutMs ?? 0
    useEffect(() => {
        if (mySeat === null || turn !== mySeat || turnDeadline === null || turnTimeoutMs <= 0) return
        const delay = turnDeadline - turnTimeoutMs * TURN_WARNING_FRACTION - Date.now()
        if (delay <= 0) return
        const id = setTimeout(() => playHaptic("turnWarning"), delay)
        return () => clearTimeout(id)
    }, [mySeat, turn, turnDeadline, turnTimeoutMs])

    // ── chat unread ──────────────────────────────────────────────────────
    useEffect(() => {
        if (chatOpen) {
            seenChatRef.current = socket.chat.length
            setUnread(0)
            return
        }
        setUnread(Math.max(0, socket.chat.length - seenChatRef.current))
    }, [socket.chat, chatOpen])

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
                <JoinByCodeDialog open={accessCodeOpen}
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

    /** Send the move, asking about the bela first when this card raises it. */
    const playCard = (card: Card) => {
        if (shouldAskBela(card)) {
            setBelaAsk(card)
            return
        }
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
        turnLabel = t(revealed ? "game.declarations.reviewing" : "game.declarations.calculating")
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
            maxW={{ base: "720px", md: "760px", lg: "840px", xl: "900px" }}
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
            css={
                inLobbyPhase
                    ? undefined
                    : {
                          // iOS honours touch-action before it starts its
                          // native rubber-band gesture. The table itself has
                          // no vertical pan affordance; sheets render in a
                          // portal and retain their own scroll when needed.
                          touchAction: "pan-x",
                          overscrollBehavior: "none",
                      }
            }
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
                            onStart={() => socket.send({ t: "room.start" })}
                            onLeave={leave}
                            onPrivacyChange={(value) => socket.send({ t: "room.setPrivate", private: value })}
                            onSettings={() => setSettingsOpen(true)}
                        />
                    </Box>
                    {CHAT_ENABLED ? (
                        <Box position="absolute" top="0" right="0" zIndex={11}>
                            {CHAT_ENABLED ? (
                                <ChatToggle
                                    open={chatOpen}
                                    unread={unread}
                                    onToggle={() => setChatOpen((v) => !v)}
                                />
                            ) : null}
                        </Box>
                    ) : null}
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
                                view={view}
                                seats={room.seats}
                                targetScore={room.targetScore}
                                header={
                                    <TableHeader
                                        targetScore={room.targetScore}
                                        gameEndRule={room.gameEndRule}
                                        chips={
                                            <>
                                                {mySeat === null && <StatusChip>{t("game.table.spectating")}</StatusChip>}
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
                                        chat={CHAT_ENABLED ? (
                                            <ChatToggle
                                                open={chatOpen}
                                                unread={unread}
                                                onToggle={() => setChatOpen((v) => !v)}
                                            />
                                        ) : null}
                                        declarationsEnabled={view.declarationsRevealed}
                                        declarationPoints={socket.declarationsPending || (revealed !== null && !declHidden)
                                            ? { us: 0, them: 0 }
                                            : {
                                                us: view.declarationPoints?.[myTeam] ?? 0,
                                                them: view.declarationPoints?.[otherTeam(myTeam)] ?? 0,
                                            }}
                                        onDeclarations={() => setDeclarationsOpen((value) => !value)}
                                        tricksEnabled={room.trickReview !== "off"}
                                        tricksPlayed={view.tricksWon.A + view.tricksWon.B}
                                        onTricks={() => setTricksOpen((value) => !value)}
                                    />
                                }
                                noDeclarations={room.noDeclarations}
                                allowBela={room.allowBela}
                            />
                        </Box>

                        {/* The table, pinned near the top of whatever height
                            is left instead of dead-centred (2026-09-18, user
                            request: the partner seat sat too far below the
                            score panel on a tall screen) — a small `pt`
                            keeps a little air between them without the
                            centring pushing the gap open further as the
                            screen gets taller. Leftover slack now collects
                            below the table instead of splitting around it. */}
                        <Flex flex="1" minH="0" direction="column" justify="flex-start" pt="2">
                            <Table
                                room={room}
                                view={view}
                                turnDeadline={socket.turnDeadline}
                                turnDurationMs={socket.turnDurationMs}
                                trickCards={trickCards}
                                holdingSeat={holdingSeat}
                                flyIn={flyIn}
                                collectTo={collectTo}
                                reducedMotion={reducedMotion}
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

                        {declarationsVisible && (
                            <DeclarationsReveal
                                perSeat={declarationsOpen ? view.declarations : revealed!.perSeat}
                                scoringTeam={declarationsOpen ? view.declarationsScoringTeam : revealed!.scoringTeam}
                                seats={room.seats}
                                mySeat={mySeat}
                                ownDeclarations={mySeat === null ? undefined : view.declarations[mySeat]}
                                declarationPoints={declarationsOpen ? view.declarationPoints : undefined}
                                belaDeclared={declarationsOpen ? view.belaDeclared : null}
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

                        {bela && <BelaFlash seats={room.seats} seat={bela.seat} />}
                        {belot && (
                            <BelotFlash
                                seats={room.seats}
                                seat={belot.seat}
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

                        {!isBotTurn && (
                            <TurnProgressBar
                                countdown={turnCountdown}
                                active={turnDeadline !== null && (socket.turnDurationMs ?? 0) > 0}
                                reducedMotion={reducedMotion}
                            />
                        )}

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
                            <TurnPill tone={tone} label={turnLabel} />
                            {view?.phase !== "BIDDING" && (
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
                            flexShrink={0}
                            css={{ paddingBottom: "calc(6px + env(safe-area-inset-bottom, 0px))" }}
                        >
                            <Hand
                                cards={displayedHand}
                                legal={view.legalMoves}
                                phase={displayedHandPhase}
                                disabled={busy || declarationsOpen || tricksOpen || belaAsk !== null || (!!revealed && !declHidden)}
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
                                    insetStart="5"
                                    // Align my seat with the first card's top
                                    // edge. Its reaction bubble grows upward,
                                    // into the clear strip above the hand,
                                    // instead of covering the cards below.
                                    top="4"
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
                                        isTurn={view.turn === mySeat}
                                        isDealer={view.dealer === mySeat}
                                        // Same medallion the felt's seats wear, so
                                        // "I called this deal" reads the same way
                                        // wherever the caller happens to be sitting.
                                        callerTrump={view.bidding.caller === mySeat ? view.bidding.trump : null}
                                        countdown={view.turn === mySeat ? turnCountdown : null}
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
                            pt="1.5"
                            flexShrink={0}
                            minH={ROW_H}
                            css={{ paddingBottom: "calc(6px + env(safe-area-inset-bottom, 0px))" }}
                        >
                            {isBidding ? (
                                <BiddingPanel
                                    view={view}
                                    busy={busy}
                                    onBid={(trump: Suit) => socket.send({ t: "game.bid", trump })}
                                    onPass={() => socket.send({ t: "game.pass" })}
                                />
                            ) : (
                                <Box css={{ [SHORT]: { display: "none" } }}>
                                    <ReactionsBar
                                        disabled={socket.status !== "open"}
                                        onReact={(reaction) => socket.sendReaction(reaction)}
                                    />
                                </Box>
                            )}
                        </Box>

                        {CHAT_ENABLED ? (
                            <Chat
                                open={chatOpen}
                                messages={socket.chat}
                                disabled={socket.status !== "open"}
                                onSend={(text) => socket.send({ t: "chat.send", text })}
                                onClose={() => setChatOpen(false)}
                            />
                        ) : null}

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

            {inLobbyPhase && (
                <Chat
                    open={chatOpen}
                    messages={socket.chat}
                    disabled={socket.status !== "open"}
                    onSend={(text) => socket.send({ t: "chat.send", text })}
                    onClose={() => setChatOpen(false)}
                />
            )}

            {view && (
                <GameOverDialog
                    open={view.phase === "GAME_OVER" && idle && !overDismissed}
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
