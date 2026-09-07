import { useEffect, useRef, useState, type ReactNode } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import { Box, Button, Flex, HStack, IconButton, Spinner, Text } from "@chakra-ui/react"
import { FiArrowLeft, FiSettings } from "react-icons/fi"
import type { Card, RoomState, Seat, Suit } from "@bela/protocol"
import type { Team, TrickCard } from "@bela/engine"
import { CONTENT_STICKY_TOP } from "../../components/navChrome"
import { useDocumentHead } from "../../hooks/useDocumentHead"
import { useTranslation } from "../../i18n"
import { showError } from "../../toaster"
import BiddingPanel from "../components/BiddingPanel"
import Chat, { ChatToggle } from "../components/Chat"
import DealSummary from "../components/DealSummary"
import DeclarationsReveal, { BelaFlash } from "../components/DeclarationsReveal"
import GameOverDialog from "../components/GameOverDialog"
import GameSettingsSheet from "../components/GameSettingsSheet"
import Hand from "../components/Hand"
import ReactionsBar from "../components/ReactionsBar"
import RoomPanel from "../components/RoomPanel"
import ScoreBoard from "../components/ScoreBoard"
import type { SeatBid } from "../components/Seat"
import SuitGlyph from "../components/SuitGlyph"
import Table from "../components/Table"
import TurnPill, { type TurnTone } from "../components/TurnPill"
import { useReactionBubbles } from "../components/reactionBubbles"
import { FELT, GLASS, INK, INK_MUTED, SHORT } from "../components/tableStyles"
import { useEventQueue } from "../hooks/useEventQueue"
import { useGamePrefs } from "../hooks/useGamePrefs"
import { useGameSocket } from "../hooks/useGameSocket"
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion"
import { suitKey } from "../util/cards"
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
   NOTHING inside it scrolls: scoreboard, felt, hand tray and reaction row
   are one flex column that gives its slack to the felt. MobileTabBar and
   SiteFooter both hide on /igra (see their route lists), so nothing else is
   below us to account for.

   The felt is ONE surface for the whole column — the scoreboard and the
   hand tray are dark glass panels ON it, not neighbours of it — and it is
   dark in both themes, because a card table has its own colour and only the
   chrome around it follows the theme.

   The screen renders from TWO sources: `PlayerView` for everything that is
   simply true right now, and the event queue for the things that have to be
   SEEN happening (a trick being collected, declarations being revealed, a
   "Bela!"). Where they disagree — the server clears the trick in the same
   frame it announces the winner — the event wins until its dwell is over.
   ────────────────────────────────────────────────────────────────────── */

/** Cards stay on the table this long before sliding to the winner. */
const TRICK_HOLD_MS = 700

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
    const busy = pending > 0 || socket.status !== "open"
    const idle = active === null && pending === 0

    const [chatOpen, setChatOpen] = useState(false)
    const [settingsOpen, setSettingsOpen] = useState(false)
    const [unread, setUnread] = useState(0)
    const seenChatRef = useRef(0)

    useDocumentHead({ title: t("game.room.metaTitle", { name: room?.name ?? "" }) })

    // ── event-driven overlays ────────────────────────────────────────────
    const trickWon = active !== null && active.type === "TRICK_WON" ? active : null
    const revealed = active !== null && active.type === "DECLARATIONS_REVEALED" ? active : null
    const bela = active !== null && active.type === "BELA" ? active : null
    const trumpSet = active !== null && active.type === "TRUMP_SET" ? active : null

    const [collectTo, setCollectTo] = useState<Seat | null>(null)
    useEffect(() => {
        if (!trickWon) {
            setCollectTo(null)
            return
        }
        setCollectTo(null)
        const id = setTimeout(() => setCollectTo(trickWon.winner), reducedMotion ? 60 : TRICK_HOLD_MS)
        return () => clearTimeout(id)
    }, [trickWon, reducedMotion])

    // Declarations dismiss themselves after the queue's dwell; a tap closes
    // them sooner. Each new reveal starts visible again.
    const [declHidden, setDeclHidden] = useState(false)
    useEffect(() => setDeclHidden(false), [revealed])

    useEffect(() => {
        if (!socket.error) return
        showError(t(`game.error.${socket.error.code}`))
        socket.clearError()
    }, [socket, t])

    // ── sound ────────────────────────────────────────────────────────────
    // Driven off the raw event stream rather than the animation queue: a
    // CARD_PLAYED has no dwell, so it can pass through `active` inside one
    // React batch and never be rendered.
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
                case "CARD_PLAYED": playSound("card"); break
                case "TRICK_WON": playSound("trick"); break
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
        socket.send({ t: "room.leave" })
        navigate(`/igra${mock ? "?mock=1" : ""}`)
    }

    if (!room) {
        return (
            <Flex direction="column" align="center" justify="center" minH="50vh" gap="3">
                {socket.status === "closed" ? (
                    <>
                        <Text color="fg.muted">{t("game.connection.closed")}</Text>
                        <Button size="sm" variant="outline" onClick={() => navigate("/igra")}>
                            <FiArrowLeft /> {t("game.room.backToLobby")}
                        </Button>
                    </>
                ) : (
                    <>
                        <Spinner />
                        <Text color="fg.muted">{t("game.room.joining")}</Text>
                    </>
                )}
            </Flex>
        )
    }

    const inLobbyPhase = room.status === "LOBBY" || !view

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

    /* Bid chips beside the seats: who has said "Dalje" this deal. The
       caller's own chip is the "zove" badge the seat already carries. */
    const bids: Partial<Record<Seat, SeatBid>> = {}
    if (view && view.phase === "BIDDING") {
        for (const seat of view.bidding.passes) bids[seat] = { kind: "pass" }
    }

    const trickIndex = view ? view.tricksWon.A + view.tricksWon.B : 0

    return (
        <Flex
            direction="column"
            position="relative"
            w="100%"
            maxW="720px"
            mx="auto"
            h={{
                base: `calc(100dvh - ${CONTENT_STICKY_TOP.base})`,
                md: `calc(100dvh - ${CONTENT_STICKY_TOP.md})`,
            }}
            mb="-24px"
            overflow="hidden"
        >
            {inLobbyPhase ? (
                <>
                    <Box flex="1" overflowY="auto">
                        <RoomPanel
                            room={room}
                            mySeat={socket.yourSeat}
                            myUid={socket.me?.uid ?? null}
                            disabled={socket.status !== "open"}
                            onSit={(seat) => socket.send({ t: "room.sit", seat })}
                            onStand={() => socket.send({ t: "room.stand" })}
                            onAddBot={(seat, level) => socket.send({ t: "room.addBot", seat, level })}
                            onRemoveBot={(seat) => socket.send({ t: "room.removeBot", seat })}
                            onReady={(ready) => socket.send({ t: "room.ready", ready })}
                            onStart={() => socket.send({ t: "room.start" })}
                            onLeave={leave}
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
                        rounded="l3"
                        borderWidth="1px"
                        borderColor="brand.950"
                        boxShadow="inset 0 0 70px rgba(0,0,0,0.45)"
                        {...FELT}
                    >
                        {/* Header: leave, room, state, chat, settings. */}
                        <HStack gap="1" px="2" pt="2" pb="1" flexShrink={0}>
                            <IconButton
                                size="xs"
                                variant="ghost"
                                color={INK}
                                _hover={{ bg: "brand.700" }}
                                aria-label={t("game.room.leave")}
                                title={t("game.room.leave")}
                                onClick={leave}
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

                        <Box px="2" flexShrink={0}>
                            <ScoreBoard view={view} seats={room.seats} targetScore={room.targetScore} />
                        </Box>

                        <Table
                            room={room}
                            view={view}
                            turnDeadline={socket.turnDeadline}
                            trickCards={(trickWon ? trickWon.cards : view.trick.cards) as TrickCard[]}
                            trickIndex={trickIndex}
                            collectTo={collectTo}
                            reducedMotion={reducedMotion}
                            bids={bids}
                            reactions={bubbles}
                        >
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

                            {revealed && !declHidden && (
                                <DeclarationsReveal
                                    perSeat={revealed.perSeat}
                                    scoringTeam={revealed.scoringTeam}
                                    seats={room.seats}
                                    mySeat={mySeat}
                                    onDismiss={() => setDeclHidden(true)}
                                />
                            )}

                            {bela && <BelaFlash seats={room.seats} seat={bela.seat} />}
                        </Table>

                        {/* Status pill above the tray; on a landscape phone it
                            shares its row with the reactions to buy the felt
                            another 30 px. */}
                        <Flex
                            justify="center"
                            align="center"
                            gap="2"
                            px="2"
                            pb="1"
                            flexShrink={0}
                        >
                            <TurnPill tone={tone} label={turnLabel} />
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
                                trump={view.bidding.trump}
                                disabled={busy}
                                onPlay={(card: Card) => socket.send({ t: "game.play", card })}
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

                        <GameOverDialog
                            open={view.phase === "GAME_OVER" && idle}
                            winner={view.winner}
                            score={view.score}
                            myTeam={myTeam}
                            onBackToLobby={leave}
                            onNewGame={leave}
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

            <GameSettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
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
