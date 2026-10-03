import { useEffect, useMemo, useRef } from "react"
import { Link } from "react-router-dom"
import { Box, Button, Dialog, Flex, HStack, IconButton, Portal, Text, VStack } from "@chakra-ui/react"
import { FiHelpCircle, FiX } from "react-icons/fi"
import { LEARNER_SEAT } from "@bela/bots"
import type { RoomState, SeatInfo } from "@bela/protocol"
import type { DealScore, PlayerView, Seat, Team } from "@bela/engine"
import { useAuth } from "../../auth/authContextValue"
import { useTranslation } from "../../i18n"
import { gameLobbyPath } from "../../site"
import { CONTENT_STICKY_TOP, NAVBAR_SAFE_TOP } from "../../components/navChrome"
import BiddingPanel, { ROW_H } from "../components/BiddingPanel"
import DeclarationsReveal from "../components/DeclarationsReveal"
import ScoreBoard from "../components/ScoreBoard"
import Table from "../components/Table"
import TurnPill, { type TurnTone } from "../components/TurnPill"
import { INK_MUTED, PLAY_AREA } from "../components/tableStyles"
import { readGuest } from "../hooks/guestIdentity"
import { useTableScale } from "../hooks/useTableScale"
import { occupantName, teamOf } from "../util/seats"
import { playAdvice, useBidAdvice } from "./coachText"
import LessonFeedback, { type Feedback } from "./LessonFeedback"
import { learnIdentity, markLearnFinished } from "./learnStorage"
import PracticeHand from "./PracticeHand"
import { useCardNames } from "./useCardNames"
import { usePracticeGame } from "./usePracticeGame"

/* ──────────────────────────────────────────────────────────────────────────
   PracticeGame — the game after the lessons (2026-09-29).

   One real game, the learner and three bots, played in the browser by
   `usePracticeGame`. It is a "Brza 163": to 163 points or three deals.

   IT IS LAID OUT LIKE THE REAL TABLE (reworked 2026-09-29 after the owner
   tried the first version: the hand ran off the bottom of a desktop window,
   a phone's second row of cards sat under the tab bar, and the felt was a
   fixed box guessed from one screen width). The root is `GameRoomPage`'s
   own column, value for value:

     • height `100dvh` minus the navbar — the page never scrolls, the hand is
       docked on the bottom edge, and the last row pays for the safe area;
     • full-bleed on a phone, the same max widths from 48em;
     • `useTableScale` on the root: it measures the real box and sets
       `--hand-k` / `--pile-k`, the two factors the hand and the trick are
       drawn at — nothing here guesses a size;
     • the rows, top to bottom: `ScoreBoard`, the felt (`Table`, taking what
       height is left), the turn line, the hand, and the bidding row.

   `MobileTabBar` and `SiteFooter` hide on this route exactly as they do on
   `/igra/soba/*`. The top navbar stays, as it does in the real room.

   WHAT IS REAL: `ScoreBoard`, `Table` (seats, trick, bid chips, caller
   medallion), `BiddingPanel`, `DeclarationsReveal`, `TurnPill` — fed a room
   that exists only in this component and the learner's own engine view.

   WHAT IS DIFFERENT, on purpose. The hand (`PracticeHand`, same geometry as
   `Hand`) dims what may not be played. There is no turn timer. The deal
   summary waits for a tap. And there is a COACH, which costs no height: its
   button sits beside the turn line and its one line floats over the bottom
   of the felt.

     • "Savjet" shows what the heuristic bot would do from the learner's own
       view, with a one-line reason category (`@bela/bots` `tutor.ts`);
     • a forbidden card says which obligation it breaks;
     • otherwise the line says what the table is waiting for and who has to
       make their call.
   ────────────────────────────────────────────────────────────────────── */

/** The three bots. Croatian names, in the roster's own "Bot …" form. */
const BOT_NAMES: Record<Exclude<Seat, 0>, string> = { 1: "Bot Ivo", 2: "Bot Ana", 3: "Bot Mate" }

function practiceRoom(name: string, avatarPreset: string | null, avatarUrl: string | null): RoomState {
    const bot = (seat: Exclude<Seat, 0>): SeatInfo => ({ seat, occupant: { kind: "BOT", name: BOT_NAMES[seat] } })
    const me: SeatInfo = {
        seat: LEARNER_SEAT,
        occupant: {
            kind: "PLAYER",
            user: { uid: "learner", name, avatarUrl, avatarPreset },
            ready: true,
            connected: true,
        },
    }
    return {
        id: "ucenje",
        name: "ucenje",
        code: "",
        status: "PLAYING",
        targetScore: 163,
        gameEndRule: "prolaz",
        noDeclarations: false,
        private: true,
        allowSpectators: false,
        minWinRatePercent: 0,
        seatsTaken: 4,
        humans: 1,
        occupants: [
            { kind: "PLAYER", name, connected: true, avatarPreset },
            { kind: "BOT", name: BOT_NAMES[1] },
            { kind: "BOT", name: BOT_NAMES[2] },
            { kind: "BOT", name: BOT_NAMES[3] },
        ],
        joinable: false,
        createdAt: 0,
        hostUid: "learner",
        allowBela: true,
        trickReview: "off",
        seats: [me, bot(1), bot(2), bot(3)],
        spectators: [],
        turnTimeoutMs: 0,
    }
}

const MY_TEAM: Team = teamOf(LEARNER_SEAT)
const THEIR_TEAM: Team = MY_TEAM === "A" ? "B" : "A"

function ScoreSide({ label, total, deal, align }: { label: string; total: number; deal: number; align: "start" | "end" }) {
    return (
        <VStack gap="0" align={align} flex="1" minW="0">
            <Text fontSize="2xs" fontWeight="bold" color="fg.muted" textTransform="uppercase" letterSpacing="wide">{label}</Text>
            <Text fontSize="2xl" lineHeight="1.1" fontFamily="mono" fontWeight="black" fontVariantNumeric="tabular-nums">{total}</Text>
            <Text fontSize="xs" fontFamily="mono" color="fg.muted" fontVariantNumeric="tabular-nums" minH="18px">
                {deal > 0 ? `+${deal}` : ""}
            </Text>
        </VStack>
    )
}

function Row({ label, us, them, strong = false }: { label: string; us: number; them: number; strong?: boolean }) {
    return (
        <HStack justify="space-between" gap="3">
            <Text fontSize="sm" fontWeight={strong ? "bold" : "normal"}>{label}</Text>
            <HStack gap="4" minW="110px" justify="end">
                <Text fontFamily="mono" fontSize="sm" minW="42px" textAlign="end" fontWeight={strong ? "bold" : "normal"}>{us}</Text>
                <Text fontFamily="mono" fontSize="sm" minW="42px" textAlign="end" color="fg.muted" fontWeight={strong ? "bold" : "normal"}>{them}</Text>
            </HStack>
        </HStack>
    )
}

/** The receipt of a deal — the table's lines, but it waits for the learner. */
function DealReceipt({ score, onNext }: { score: DealScore; onNext: () => void }) {
    const { t } = useTranslation()
    const weCalled = score.callerTeam === MY_TEAM
    const verdict = weCalled
        ? t(score.passed ? "game.deal.wePassed" : "game.deal.weFell")
        : t(score.passed ? "game.deal.theyPassed" : "game.deal.theyFell")
    return (
        <Dialog.Root open placement="center" closeOnInteractOutside={false} closeOnEscape={false}>
            <Portal>
                <Dialog.Backdrop backdropFilter="blur(4px)" />
                <Dialog.Positioner>
                    <Dialog.Content maxW={{ base: "92%", md: "400px" }} rounded="2xl">
                        <Dialog.Header>
                            <Dialog.Title fontFamily="heading">{t("game.deal.summaryTitle", { n: score.dealNo })}</Dialog.Title>
                        </Dialog.Header>
                        <Dialog.Body>
                            <VStack align="stretch" gap="2">
                                <Text fontWeight="bold" color={score.passed === weCalled ? "ok" : "live"}>{verdict}</Text>
                                <HStack justify="end" gap="4" minW="110px">
                                    <Text fontSize="2xs" fontWeight="bold" minW="42px" textAlign="end" textTransform="uppercase">{t("game.score.us")}</Text>
                                    <Text fontSize="2xs" fontWeight="bold" minW="42px" textAlign="end" textTransform="uppercase" color="fg.muted">{t("game.score.them")}</Text>
                                </HStack>
                                <Row label={t("game.deal.cardPoints")} us={score.cardPoints[MY_TEAM]} them={score.cardPoints[THEIR_TEAM]} />
                                <Row label={t("game.deal.declarationPoints")} us={score.declarationPoints[MY_TEAM]} them={score.declarationPoints[THEIR_TEAM]} />
                                <Box h="1px" bg="border.subtle" />
                                <Row strong label={t("game.deal.awarded")} us={score.total[MY_TEAM]} them={score.total[THEIR_TEAM]} />
                                {score.stiglja !== null && (
                                    <Text fontSize="sm" color="gold" fontWeight="semibold">
                                        {t(score.stiglja === MY_TEAM ? "game.deal.stigljaUs" : "game.deal.stigljaThem")}
                                    </Text>
                                )}
                                {!score.passed && <Text fontSize="sm" color="fg.muted">{t("game.deal.fallExplained")}</Text>}
                            </VStack>
                        </Dialog.Body>
                        <Dialog.Footer>
                            <Button colorPalette="brand" onClick={onNext}>{t("game.deal.next")}</Button>
                        </Dialog.Footer>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Portal>
        </Dialog.Root>
    )
}

function PracticeOver({ view, onAgain, onLessons }: { view: PlayerView; onAgain: () => void; onLessons: () => void }) {
    const { t } = useTranslation()
    const won = view.winner === MY_TEAM
    return (
        <Dialog.Root open placement="center" closeOnInteractOutside={false} closeOnEscape={false}>
            <Portal>
                <Dialog.Backdrop backdropFilter="blur(4px)" />
                <Dialog.Positioner>
                    <Dialog.Content maxW={{ base: "92%", md: "420px" }} rounded="2xl">
                        <Dialog.Header>
                            <Dialog.Title fontFamily="heading" fontSize="2xl">
                                {t(won ? "game.over.youWon" : "game.over.youLost")}
                            </Dialog.Title>
                        </Dialog.Header>
                        <Dialog.Body>
                            <VStack align="stretch" gap="3">
                                <HStack justify="center" gap="6">
                                    <ScoreSide label={t("game.score.us")} total={view.score[MY_TEAM]} deal={0} align="end" />
                                    <Text fontSize="2xl" color="fg.subtle" aria-hidden="true">:</Text>
                                    <ScoreSide label={t("game.score.them")} total={view.score[THEIR_TEAM]} deal={0} align="start" />
                                </HStack>
                                <Text color="fg.muted" textAlign="center">{t("game.learn.practice.over")}</Text>
                            </VStack>
                        </Dialog.Body>
                        <Dialog.Footer flexWrap="wrap" gap="2" justifyContent="center">
                            <Button variant="ghost" onClick={onLessons}>{t("game.learn.practice.lessons")}</Button>
                            <Button variant="outline" colorPalette="brand" onClick={onAgain}>{t("game.learn.practice.again")}</Button>
                            <Button asChild colorPalette="brand">
                                <Link to={gameLobbyPath}>{t("game.learn.practice.playOnline")}</Link>
                            </Button>
                        </Dialog.Footer>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Portal>
        </Dialog.Root>
    )
}

export default function PracticeGame({ reducedMotion, onLessons }: {
    reducedMotion: boolean
    /** Back to the first lesson. */
    onLessons: () => void
}) {
    const { t } = useTranslation()
    const { user } = useAuth()
    const names = useCardNames()
    const advise = useBidAdvice()
    /* Hand and trick sizes come from the measured box, as in the real room.
       `false`: no avatar is docked beside this hand, so the grid may use the
       width the real table reserves for it. */
    const tableScale = useTableScale(false)
    const game = usePracticeGame(reducedMotion)
    const { view, state } = game

    // Who the learner is, for the seat that says "you": the account's name,
    // the guest's, or plain "Ti" for somebody who opened the link directly.
    const room = useMemo(() => {
        const guest = user ? null : readGuest()
        const name = user?.displayName?.trim() || guest?.name || t("game.guest.youBadge")
        return practiceRoom(name, guest?.avatar ?? null, user?.photoURL ?? null)
    }, [user, t])

    const over = state.phase === "GAME_OVER" && !game.busy
    const dealDone = state.phase === "DEAL_DONE" && !game.busy

    // Finishing the practice game is remembered once per game, for whoever
    // is playing — see `markLearnFinished`.
    const identity = learnIdentity(user?.uid)
    const recorded = useRef<string | null>(null)
    useEffect(() => {
        if (!over || recorded.current === state.config.seed) return
        recorded.current = state.config.seed
        markLearnFinished(identity)
    }, [over, identity, state.config.seed])

    const turn = view.turn
    const turnName = turn === null ? "" : occupantName(room.seats[turn].occupant, t("game.seat.empty"))
    const bidding = view.phase === "BIDDING"
    const waiting = game.busy || game.reveal !== null || turn === null
    const tone: TurnTone = waiting ? "idle" : game.myTurn ? "you" : bidding ? "call" : "other"
    const turnLabel = waiting
        ? t("game.table.waiting")
        : game.myTurn
          ? t(bidding ? "game.table.turnYourCall" : "game.table.turnYou")
          : t(bidding ? "game.table.turnCalling" : "game.table.turnOther", { name: turnName })

    const caller = view.bidding.caller

    /* The coach's one line. A forbidden tap outranks a suggestion, a
       suggestion outranks the standing note about the table. */
    const line: Feedback | null = (() => {
        if (game.illegal !== null) {
            return {
                tone: "wrong",
                text: t(game.illegal.reason !== null ? `game.learn.illegal.${game.illegal.reason}` : "game.hand.illegalPlay"),
            }
        }
        if (game.playHint !== null) return { tone: "info", text: playAdvice(t, game.playHint) }
        if (game.bidHint !== null) return { tone: "info", text: advise(game.bidHint) }
        if (game.bela !== null) {
            return {
                tone: "right",
                text: t(teamOf(game.bela) === MY_TEAM ? "game.learn.note.belaUs" : "game.learn.note.belaThem", names.rankParams),
            }
        }
        if (waiting && game.reveal === null && !game.busy) return null
        if (game.myTurn && bidding) {
            return { tone: "info", text: t(view.legalBids?.canPass === false ? "game.learn.note.forced" : "game.learn.note.bid") }
        }
        if (game.myTurn && view.phase === "PLAYING") {
            const key =
                view.trick.cards.length === 0
                    ? "game.learn.note.lead"
                    : view.legalMoves.length < view.hand.length
                      ? "game.learn.note.limited"
                      : "game.learn.note.free"
            return { tone: "info", text: t(key) }
        }
        if (view.phase === "PLAYING" && caller !== null) {
            return { tone: "info", text: t(teamOf(caller) === MY_TEAM ? "game.learn.note.weCalled" : "game.learn.note.theyCalled") }
        }
        return null
    })()

    const ownDeclarations = view.declarations[LEARNER_SEAT] ?? []
    const ownLost = ownDeclarations.length > 0 && view.declarationsRevealed && view.declarationsScoringTeam !== MY_TEAM

    return (
        <Flex
            ref={tableScale.ref}
            style={tableScale.style}
            className="fold-game-board"
            direction="column"
            position="relative"
            // `GameRoomPage`'s root, value for value: the app container owns
            // a 16 px inset and 24 px of vertical padding, which a phone's
            // table takes back; the height is the viewport minus the navbar.
            w={{ base: "calc(100% + 32px)", md: "100%" }}
            maxW={{ base: "720px", md: "760px", lg: "880px", xl: "900px" }}
            mx={{ base: "-16px", md: "auto" }}
            mt={{ base: "-24px", md: "0" }}
            h={{
                base: `calc(100dvh - ${NAVBAR_SAFE_TOP.base})`,
                md: `calc(100dvh - ${CONTENT_STICKY_TOP.md})`,
            }}
            mb="-24px"
            overflow="hidden"
            css={{
                userSelect: "none",
                WebkitUserSelect: "none",
                WebkitTouchCallout: "none",
                touchAction: "pan-x",
                overscrollBehavior: "none",
            }}
        >
            <Flex direction="column" flex="1" minH="0" position="relative" overflow="hidden"
                rounded={{ base: "0", md: "l3" }} {...PLAY_AREA}>
                <Box flexShrink={0}>
                    <ScoreBoard
                        view={view}
                        seats={room.seats}
                        targetScore={room.targetScore}
                        header={
                            <Flex position="relative" align="center" justify="center" minH="32px" px="9">
                                <Text fontSize="xs" fontWeight="bold" color={INK_MUTED} textTransform="uppercase"
                                    letterSpacing="wider" lineClamp={1}>
                                    {t("game.learn.practice.title")}
                                    {" · "}
                                    {t("game.learn.practice.deal", { n: view.dealNo, max: view.maxDeals ?? view.dealNo })}
                                </Text>
                                <IconButton asChild position="absolute" insetEnd="0" top="0" size="xs" minW="32px" minH="32px"
                                    rounded="full" variant="ghost" color={INK_MUTED}
                                    aria-label={t("game.learn.exit")} title={t("game.learn.exit")}>
                                    <Link to={gameLobbyPath}><FiX /></Link>
                                </IconButton>
                            </Flex>
                        }
                    />
                </Box>

                {/* The felt takes the height left over, and what it does
                    not claim collects UNDER the ring — as in the real room. */}
                <Flex flex="1" minH="0" direction="column" justify="flex-start" pt="1" position="relative">
                    <Table
                        room={room}
                        view={view}
                        turnDeadline={null}
                        turnDurationMs={0}
                        trickCards={game.felt.cards}
                        flyIn={game.felt.flyIn}
                        collectTo={game.felt.collectTo}
                        reducedMotion={reducedMotion}
                        showTurn={!game.busy && game.reveal === null}
                        bids={game.bids}
                    />
                    {/* The coach's line, over the bottom of the felt: it
                        explains without inserting a row, so the hand never
                        moves when it speaks. */}
                    <Box position="absolute" left="2" right="2" bottom="0" zIndex={7} pointerEvents="none">
                        <LessonFeedback feedback={line} pulse={game.illegal?.n ?? 0} reducedMotion={reducedMotion} />
                    </Box>
                </Flex>

                <Flex justify="center" align="center" gap="2" px="2" flexShrink={0} minH="32px">
                    <TurnPill tone={tone} label={turnLabel} />
                    <Button
                        size="xs"
                        rounded="full"
                        variant={game.playHint !== null || game.bidHint !== null ? "subtle" : "outline"}
                        colorPalette="yellow"
                        disabled={!game.myTurn}
                        onClick={game.askHint}
                    >
                        <FiHelpCircle /> {t("game.learn.practice.hint")}
                    </Button>
                </Flex>

                <Box position="relative" px="2" flexShrink={0}>
                    <PracticeHand
                        view={view}
                        myTurn={game.myTurn}
                        hinted={game.playHint?.card ?? null}
                        illegal={game.illegal}
                        reducedMotion={reducedMotion}
                        onPlay={game.play}
                    />
                </Box>

                {/* The LAST row, and therefore the only one that pays for
                    the iPhone home indicator — same rule as the real room.
                    It keeps the bidding row's height while nobody bids, so
                    calling trump never shifts the felt. */}
                <Box px="2" pt="1" flexShrink={0} minH={ROW_H}
                    css={{ paddingBottom: "calc(4px + var(--safe-bottom))" }}>
                    {bidding ? (
                        <BiddingPanel view={view} busy={!game.myTurn} onBid={game.bid} onPass={game.pass} />
                    ) : ownLost ? (
                        <Text fontSize="xs" color={INK_MUTED} textAlign="center" lineHeight={ROW_H}>
                            {t("game.learn.note.ownLost")}
                        </Text>
                    ) : null}
                </Box>
            </Flex>

            {game.reveal !== null && (
                <DeclarationsReveal
                    perSeat={game.reveal.perSeat}
                    scoringTeam={game.reveal.scoringTeam}
                    seats={room.seats}
                    mySeat={LEARNER_SEAT}
                    belaDeclared={null}
                    onDismiss={game.dismissReveal}
                />
            )}

            {dealDone && state.dealScore !== null && <DealReceipt score={state.dealScore} onNext={game.nextDeal} />}
            {over && <PracticeOver view={view} onAgain={game.restart} onLessons={onLessons} />}
        </Flex>
    )
}
