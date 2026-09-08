import { useEffect, useRef, useState, type ReactNode } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import { Box, Button, Flex, HStack, IconButton, Spinner, Text } from "@chakra-ui/react"
import { FiArrowLeft, FiSettings } from "react-icons/fi"
import type { Card, RoomState, Seat, Suit } from "@bela/protocol"
import { trickWinner } from "@bela/engine"
import type { Team, TrickCard } from "@bela/engine"
import { CONTENT_STICKY_TOP, NAVBAR_SAFE_TOP } from "../../components/navChrome"
import ConfirmDialog from "../../components/ConfirmDialog"
import { useDocumentHead } from "../../hooks/useDocumentHead"
import { useTranslation } from "../../i18n"
import { showError } from "../../toaster"
import BelaPrompt from "../components/BelaPrompt"
import BiddingPanel from "../components/BiddingPanel"
import Chat, { ChatToggle } from "../components/Chat"
import DealSummary from "../components/DealSummary"
import DeclarationsReveal, { BelaFlash } from "../components/DeclarationsReveal"
import GameOverDialog from "../components/GameOverDialog"
import GameSettingsSheet from "../components/GameSettingsSheet"
import Hand from "../components/Hand"
import JoinByCodeDialog from "../components/JoinByCodeDialog"
import MySeatBar from "../components/MySeatBar"
import ReactionsBar from "../components/ReactionsBar"
import ReconnectBanner from "../components/ReconnectBanner"
import RoomPanel from "../components/RoomPanel"
import ScoreBoard from "../components/ScoreBoard"
import type { SeatBid } from "../components/Seat"
import SuitGlyph from "../components/SuitGlyph"
import Table from "../components/Table"
import TrickHistory from "../components/TrickHistory"
import { COLLECT_MS } from "../components/TrickArea"
import { type TurnTone } from "../components/TurnPill"
import { useReactionBubbles } from "../components/reactionBubbles"
import { FELT, GLASS, INK, INK_MUTED, SHORT } from "../components/tableStyles"
import { useEventQueue } from "../hooks/useEventQueue"
import { useGamePrefs } from "../hooks/useGamePrefs"
import { useGameSocket } from "../hooks/useGameSocket"
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion"
import { cardRank, cardSuit, makeCard, suitKey } from "../util/cards"
import { teamOf } from "../util/seats"
import { playSound } from "../util/sounds"

/* ──────────────────────────────────────────────────────────────────────────
   GameRoomPage (/igra/soba/:roomId) — the room, and then the table.

   Two states behind one URL on purpose: a room and the game played in it are
   the same place, and bouncing the player to another route when the host
   presses Start would drop the socket mid-deal.

   LAYOUT (game/DESIGN.md §2.2, §2.11). ONE centred column of at most 720 px
   on every screen, desktop included — a bela table is a table, not a
   dashboard, and four seats scattered into the corners of a 27" monitor is
   nobody's idea of a card game. The column is exactly `100dvh - chrome`
   tall, the Container's own bottom padding cancelled by `mb="-24px"`, and
   NOTHING inside it scrolls. MobileTabBar and SiteFooter both hide on /igra
   (see their route lists), so nothing else is below us to account for.

   The column reads as THREE blocks, not seven rows: scoreboard, then the
   TABLE as one bounded group, then my bar + hand + reactions docked at the
   bottom. The slack of a tall phone goes to the room AROUND the table (which
   is centred in it), never inside it — spreading four seats to the corners of
   a 900 px screen is what made the old layout read as mostly empty green.

   Two surfaces, not one. The COLUMN is the room: `FELT`, dark in both themes,
   with the scoreboard and the hand tray as dark glass panels on it. The
   TABLE is an oval of lighter felt inside it (`TableSurface`), with the four
   seats overlapping its rim and the trick landing on its centre. Before, the
   column was the only surface there was, so the seats floated in a void and
   the trick landed in the middle of nothing.

   The screen renders from TWO sources: `PlayerView` for everything that is
   simply true right now, and the event queue for the things that have to be
   SEEN happening (a trick being collected, declarations being revealed, a
   "Bela!"). Where they disagree — the server clears the trick in the same
   frame it announces the winner — the event wins until its dwell is over.
   ────────────────────────────────────────────────────────────────────── */

/** Cards stay on the table this long before sliding to the winner. Counted
 *  from the moment TRICK_WON becomes the active event, i.e. AFTER the fourth
 *  card has had its own CARD_PLAYED dwell to land in. */
const TRICK_HOLD_MS = 700

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
    const { active, pending } = useEventQueue(socket.events, reducedMotion)
    const bubbles = useReactionBubbles(socket.reactions)

    const room = socket.room
    const view = socket.view
    const mySeat: Seat | null = view?.seat ?? socket.yourSeat
    const myTeam: Team = mySeat === null ? "A" : teamOf(mySeat)
    const busy = pending > 0 || socket.declarationsPending || socket.status !== "open"
    const idle = active === null && pending === 0

    const [chatOpen, setChatOpen] = useState(false)
    const [settingsOpen, setSettingsOpen] = useState(false)
    const [exitOpen, setExitOpen] = useState(false)
    const [accessCodeOpen, setAccessCodeOpen] = useState(false)
    const joinedOnce = useRef(false)

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
    const trumpSet = active !== null && active.type === "TRUMP_SET" ? active : null

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

    /* The seed for the trick's scatter (`cardScatter`). It may only change
       while the felt is EMPTY: the view increments `tricksWon` in the same
       frame the fourth card is played, so seeding straight off the running
       count made the three cards already lying there jump to new angles the
       instant the last one landed. */
    const tricksPlayed = view ? view.tricksWon.A + view.tricksWon.B : 0
    const [trickIndex, setTrickIndex] = useState(0)
    useEffect(() => {
        if (trickCards.length !== 0) return
        setTrickIndex(tricksPlayed)
    }, [trickCards.length, tricksPlayed])

    /* ── hydration: the felt after a (re)join ─────────────────────────────
       Cards played before this client was listening exist ONLY in the view.
       `game.state` carries the whole `trick` (the server's `sendStateTo`
       sends it on every join, rejoin and reconnect) but the event stream
       never repeats a `CARD_PLAYED`, so nothing would ever hand those cards
       to the queue. Seed it straight from the view once per connected
       session — on mount, and again after every reconnect — instead of
       waiting for the queue to fall idle. The scatter seed is taken from the
       same view, or a trick joined in progress would be drawn with trick 0's
       angles. */
    const hydratedRef = useRef(false)
    useEffect(() => {
        if (socket.status !== "open") {
            hydratedRef.current = false
            return
        }
        if (hydratedRef.current || !view) return
        hydratedRef.current = true
        setQueuedTrick(view.trick.cards as TrickCard[])
        setTrickIndex(view.tricksWon.A + view.tricksWon.B)
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
        // four cards sailing home 400 ms after being won.
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
       turn moved on (the 20 s clock expired and the server's bot played for
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
        /* Both refusals mean "this room is not going to let you in": there is
           nothing to wait for on the room screen, so go back to the list. */
        if (socket.error.code === "SPECTATORS_DISABLED" || socket.error.code === "ROOM_FULL") {
            navigate(`/igra${mock ? "?mock=1" : ""}`, { replace: true })
        }
        socket.clearError()
    }, [socket, t, navigate, mock])

    useEffect(() => {
        if (room) setAccessCodeOpen(false)
    }, [room])

    // ── sound ────────────────────────────────────────────────────────────
    // The two events the queue PACES are voiced when it releases them, so the
    // click lands with the card rather than with the frame that carried it.
    useEffect(() => {
        if (active === null) return
        if (active.type === "CARD_PLAYED") playSound("card")
        else if (active.type === "TRICK_WON") playSound("trick")
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
                case "DEALT": playSound("deal"); break
                case "BELA": playSound("bela"); break
                case "GAME_OVER": playSound(item.event.winner === myTeam ? "win" : "lose"); break
                default: break
            }
        }
    }, [socket.events, myTeam])

    const wasMyTurn = useRef(false)
    const turn = view?.turn ?? null
    useEffect(() => {
        const mine = mySeat !== null && turn === mySeat
        if (mine && !wasMyTurn.current) playSound("yourTurn")
        wasMyTurn.current = mine
    }, [turn, mySeat])

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
        setExitOpen(false)
        socket.send({ t: "room.leave" })
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

    /* Bid chips under the seats: who has said "Dalje" this deal. The caller
       needs no chip — the moment they name a suit it becomes the trump
       medallion on their avatar, and that one stays for the whole deal. */
    const bids: Partial<Record<Seat, SeatBid>> = {}
    if (view && view.phase === "BIDDING") {
        for (const seat of view.bidding.passes) bids[seat] = { kind: "pass" }
    }

    return (
        <Flex
            direction="column"
            position="relative"
            w={{ base: inLobbyPhase ? "100%" : "calc(100% + 32px)", md: "100%" }}
            maxW="720px"
            mx={{ base: inLobbyPhase ? "auto" : "-16px", md: "auto" }}
            mt={{ base: inLobbyPhase ? "0" : "-24px", md: "0" }}
            h={{
                base: inLobbyPhase
                    ? `calc(100dvh - ${CONTENT_STICKY_TOP.base})`
                    : `calc(100dvh - ${NAVBAR_SAFE_TOP.base})`,
                md: `calc(100dvh - ${CONTENT_STICKY_TOP.md})`,
            }}
            mb="-24px"
            overflow="hidden"
        >
            {inLobbyPhase ? (
                <>
                    <Box flex="1" overflowY="auto">
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
                    <Box position="absolute" top="0" right="0" zIndex={11}>
                        <ChatToggle
                            open={chatOpen}
                            unread={unread}
                            onToggle={() => setChatOpen((v) => !v)}
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
                        borderWidth={{ base: "0", md: "1px" }}
                        borderColor="brand.950"
                        boxShadow="inset 0 0 70px rgba(0,0,0,0.45)"
                        {...FELT}
                    >
                        {/* Header: leave, room, state, chat, settings. */}
                        <HStack gap="1" px="2" pt="1.5" pb="1" flexShrink={0}>
                            <IconButton
                                size="xs"
                                variant="ghost"
                                color={INK}
                                _hover={{ bg: "brand.700" }}
                                aria-label={t("game.room.leave")}
                                title={t("game.room.leave")}
                                onClick={() => setExitOpen(true)}
                            >
                                <FiArrowLeft />
                            </IconButton>

                            <Text fontSize="xs" color={INK_MUTED} lineClamp={1} flex="1">
                                {room.name}
                            </Text>

                            {mySeat === null && (
                                <StatusChip>{t("game.table.spectating")}</StatusChip>
                            )}
                            {socket.status !== "open" && (
                                <StatusChip tone="warn">{t(`game.connection.${socket.status}`)}</StatusChip>
                            )}
                            {socket.autoPlayed && (
                                <StatusChip>{t("game.table.autoPlayed")}</StatusChip>
                            )}

                            <Button size="xs" variant="ghost" color={INK} disabled={!view.declarationsRevealed}
                                onClick={() => setDeclarationsOpen((value) => !value)}>{t("game.declarations.title")}</Button>
                            {room.trickReview !== "off" && (
                                <Button size="xs" variant="ghost" color={INK}
                                    aria-label={t("game.tricks.open")} title={t("game.tricks.open")}
                                    onClick={() => setTricksOpen((value) => !value)}>{t("game.tricks.title")}</Button>
                            )}
                            <ChatToggle
                                open={chatOpen}
                                unread={unread}
                                onToggle={() => setChatOpen((v) => !v)}
                            />
                            <IconButton
                                size="xs"
                                variant="ghost"
                                color={INK}
                                _hover={{ bg: "brand.700" }}
                                aria-label={t("game.table.settings")}
                                title={t("game.table.settings")}
                                onClick={() => setSettingsOpen(true)}
                            >
                                <FiSettings />
                            </IconButton>
                        </HStack>

                        {/* "Veza je pala" strip: top of the felt, under the
                            header. Renders null unless a seat hold is
                            running, so it costs no height the rest of the
                            time — the wrapper is here to keep it out of the
                            flex column's shrinking. */}
                        <Box px="2" flexShrink={0}>
                            <ReconnectBanner />
                        </Box>

                        <Box px="2" flexShrink={0}>
                            <ScoreBoard
                                view={view}
                                seats={room.seats}
                                targetScore={room.targetScore}
                                noDeclarations={room.noDeclarations}
                                allowBela={room.allowBela}
                            />
                        </Box>

                        {/* The table, centred in whatever height is left. It
                            has a bounded height of its own (`tableGeometry`),
                            so a tall screen gets room around the table rather
                            than a void inside it. */}
                        <Flex flex="1" minH="0" direction="column" justify="center">
                            <Table
                                room={room}
                                view={view}
                                turnDeadline={socket.turnDeadline}
                                trickCards={trickCards}
                                trickIndex={trickIndex}
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
                        {trumpSet && (
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
                                    <SuitGlyph suit={trumpSet.trump} size={20} />
                                    <Text fontSize="sm" fontWeight="bold" color={INK}>
                                        {t("game.table.trumpSet", { suit: t(suitKey(trumpSet.trump)) })}
                                    </Text>
                                </HStack>
                            </Flex>
                        )}

                        {(declarationsOpen || (revealed && !declHidden)) && (
                            <DeclarationsReveal
                                perSeat={declarationsOpen ? view.declarations : revealed!.perSeat}
                                scoringTeam={declarationsOpen ? view.declarationsScoringTeam : revealed!.scoringTeam}
                                seats={room.seats}
                                mySeat={mySeat}
                                ownDeclarations={mySeat === null ? undefined : view.declarations[mySeat]}
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

                        {/* The question, over the hand tray and nothing else.
                            `BelaFlash` above is the answer landing: it is what
                            confirms to the whole table that the choice took. */}
                        {belaAsk !== null && (
                            <BelaPrompt
                                onDeclare={() => answerBela(true)}
                                onDecline={() => answerBela(false)}
                            />
                        )}

                        {/* My seat AND the status pill, one row: the avatar
                            keeps the turn ring and the dealer's "D", the pill
                            says whose move it is, and my own name is not
                            repeated back at me. On a landscape phone the
                            reactions join the same row to buy the felt
                            another 30 px. */}
                        <Flex
                            justify="center"
                            align="center"
                            gap="2"
                            px="2"
                            py="1"
                            flexShrink={0}
                        >
                            <MySeatBar
                                info={mySeat === null ? null : room.seats[mySeat]}
                                isTurn={mySeat !== null && view.turn === mySeat}
                                isDealer={mySeat !== null && view.dealer === mySeat}
                                // Same medallion the felt's seats wear, so
                                // "I called this deal" reads the same way
                                // wherever the caller happens to be sitting.
                                callerTrump={mySeat !== null && view.bidding.caller === mySeat
                                    ? view.bidding.trump
                                    : null}
                                turnDeadline={socket.turnDeadline}
                                turnTimeoutMs={room.turnTimeoutMs}
                                reaction={mySeat === null ? null : bubbles[mySeat] ?? null}
                                reducedMotion={reducedMotion}
                                tone={tone}
                                label={turnLabel}
                            />
                            <Box display="none" css={{ [SHORT]: { display: "block" } }}>
                                <ReactionsBar
                                    disabled={socket.status !== "open"}
                                    onReact={(reaction) => socket.sendReaction(reaction)}
                                />
                            </Box>
                        </Flex>

                        {view.phase === "BIDDING" && (
                            <Box px="2" pb="1" flexShrink={0}>
                                <BiddingPanel
                                    view={view}
                                    busy={busy}
                                    onBid={(trump: Suit) => socket.send({ t: "game.bid", trump })}
                                    onPass={() => socket.send({ t: "game.pass" })}
                                />
                            </Box>
                        )}

                        <Box flexShrink={0} px="2">
                            <Hand
                                cards={view.hand}
                                legal={view.legalMoves}
                                disabled={busy || declarationsOpen || tricksOpen || belaAsk !== null || (!!revealed && !declHidden)}
                                onPlay={playCard}
                            />
                        </Box>

                        <Box
                            flexShrink={0}
                            pt="1.5"
                            css={{
                                paddingBottom: "calc(6px + env(safe-area-inset-bottom, 0px))",
                                [SHORT]: { display: "none" },
                            }}
                        >
                            <ReactionsBar
                                disabled={socket.status !== "open"}
                                onReact={(reaction) => socket.sendReaction(reaction)}
                            />
                        </Box>

                        <Chat
                            open={chatOpen}
                            messages={socket.chat}
                            disabled={socket.status !== "open"}
                            onSend={(text) => socket.send({ t: "chat.send", text })}
                            onClose={() => setChatOpen(false)}
                        />

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
                    onDismiss={() => setOverDismissed(true)}
                />
            )}

            <GameSettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />

            <ConfirmDialog
                open={exitOpen}
                title={t("game.exit.title")}
                description={t("game.exit.description")}
                confirmLabel={t("game.exit.leave")}
                cancelLabel={t("game.exit.stay")}
                destructive
                onConfirm={leave}
                onCancel={() => setExitOpen(false)}
            />
        </Flex>
    )
}

/** The header's little state chips — connection, autoplay, spectating. */
function StatusChip({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "warn" }) {
    return (
        <Flex
            align="center"
            px="1.5"
            py="0.5"
            rounded="full"
            flexShrink={0}
            bg={tone === "warn" ? "orange.400" : "brand.950/62"}
            color={tone === "warn" ? "brand.950" : INK_MUTED}
            borderWidth="1px"
            borderColor={tone === "warn" ? "orange.400" : "brand.700/70"}
            fontSize="9px"
            fontWeight="bold"
            textTransform="uppercase"
            letterSpacing="wide"
            whiteSpace="nowrap"
        >
            {children}
        </Flex>
    )
}
