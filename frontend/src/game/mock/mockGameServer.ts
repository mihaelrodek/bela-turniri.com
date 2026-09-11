import { DEFAULTS, LIMITS } from "@bela/protocol"
import { heuristicBot } from "../../../../game/packages/bots/src/heuristicBot"
import type {
    ChatMessage,
    ClientMessage,
    ClientMessageType,
    ErrorCode,
    RoomState,
    RoomSummary,
    SeatInfo,
    ServerMessage,
    UserInfo,
} from "@bela/protocol"
import type {
    BiddingState,
    Card,
    DealScore,
    Declaration,
    GameEvent,
    GameEndRule,
    Phase,
    PlayerView,
    Seat,
    Suit,
    TargetScore,
    Team,
    TrickCard,
    TrickReview,
    TrickState,
    WonTrick,
} from "@bela/engine"
import { isAvatarId } from "../../components/avatars/avatarArt"
import { t } from "../../i18n"
import { SUITS, cardRank, cardSuit, makeCard } from "../util/cards"
import { SEATS, nextSeat, teamOf } from "../util/seats"
import type { GameTransport, GameTransportHandlers } from "../types"
import {
    cardPoints,
    declarationTotal,
    declarationsScoringTeam,
    findDeclarations,
    fullDeck,
    legalMoves,
    shuffle,
    trickPoints,
    trickWinner,
} from "./mockRules"

/* ──────────────────────────────────────────────────────────────────────────
   In-browser fake game server — DEV ONLY, reached with `/igra?mock=1`.

   The real thing is a Node process (`game/packages/server`) written in
   parallel with this UI. Rather than block on it, `useGameSocket` can swap its
   transport for this module: it speaks the same `@bela/protocol` frames, in
   the same order, with the same latency-ish delays, so every screen — lobby,
   room, bidding, tricks, declarations, the deal summary, game over — can be
   built and demoed standalone.

   What it is NOT: authoritative, networked, or shared. One browser tab, one
   human (seat you sit on) and bots on the rest. `mockRules.ts` carries just
   enough of README §1 to make the deal believable. It is loaded through a
   dynamic `import()` so none of it reaches a production bundle.
   ────────────────────────────────────────────────────────────────────── */

const BOT_THINK_MS = 1200
const DECLARATIONS_MS = 5200
const NETWORK_MS = 40
/** The backend's `GameNameService.CHANGE_INTERVAL`, mirrored for the mock. */
const NAME_CHANGE_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000

/* Rooms and their games live at MODULE scope, not on the connection: the
   lobby page and the room page each own their own socket, so a room created
   on /igra and then navigated to on /igra/soba/{id} would otherwise be gone
   by the time the second connection asks for it. The module survives an
   in-SPA navigation; a reload starts fresh, which is exactly what a fake
   server should do. */
const rooms = new Map<string, RoomState>()
const games = new Map<string, MockGame>()
let seeded = false

function botUser(seat: Seat): string {
    return t("game.mock.botName", { n: seat + 1 })
}

/* Small stand-in for the real server's `roomNames.ts` (game/packages/server) —
   same "adjective-noun" shape, its own short lists since the mock has no
   access to the Node package. Used when `room.create.name` is absent/blank. */
const MOCK_ADJECTIVES = ["veseli", "brzi", "lukavi", "medeni", "stari", "zlatni", "divlji", "tihi"] as const
const MOCK_NOUNS = ["fakultet", "tigar", "vrana", "medvjed", "vuk", "sokol", "mlinar", "putnik"] as const

function randomMockRoomName(): string {
    const adj = MOCK_ADJECTIVES[Math.floor(Math.random() * MOCK_ADJECTIVES.length)]
    const noun = MOCK_NOUNS[Math.floor(Math.random() * MOCK_NOUNS.length)]
    return `${adj}-${noun}`
}

/** 4-digit join code, unique among the rooms this mock still has open. */
function allocateMockCode(): string {
    for (let i = 0; i < 50; i++) {
        const code = String(Math.floor(Math.random() * 10_000)).padStart(4, "0")
        if (![...rooms.values()].some((r) => r.code === code)) return code
    }
    return String(Math.floor(Math.random() * 10_000)).padStart(4, "0")
}

function emptySeatRow(): [SeatInfo, SeatInfo, SeatInfo, SeatInfo] {
    return [0, 1, 2, 3].map((s) => ({ seat: s as Seat, occupant: null })) as [
        SeatInfo, SeatInfo, SeatInfo, SeatInfo,
    ]
}

function countSeats(room: RoomState): void {
    room.seatsTaken = room.seats.filter((s) => s.occupant !== null).length
    room.humans = room.seats.filter((s) => s.occupant?.kind === "PLAYER").length
    room.occupants = room.seats.map((s) => {
        const o = s.occupant
        if (!o) return null
        if (o.kind === "BOT") return { kind: "BOT", name: o.name }
        return { kind: "PLAYER", name: o.user.name, connected: o.connected }
    }) as RoomState["occupants"]
    room.joinable = canAdmitNewcomer(room)
}

/** The mock's copy of the server's `SEAT_FILL_ORDER` (game/README.md §3.3):
 *  0→2→1→3, so one pair fills before the other and the second arrival is the
 *  host's partner. Kept identical to `packages/server/src/room.ts` — a mock
 *  that seats people differently teaches the UI a table the server never
 *  builds. */
const SEAT_FILL_ORDER: readonly Seat[] = [0, 2, 1, 3]

/** The seat the next arrival gets, or null — the mock's copy of
 *  `Room.nextSeatForNewcomer`. */
function freeSeat(room: RoomState): Seat | null {
    return SEAT_FILL_ORDER.find((s) => room.seats[s].occupant === null) ?? null
}

/** `Room.canAdmitNewcomer`: a free seat in the lobby, or spectating allowed. */
function canAdmitNewcomer(room: RoomState): boolean {
    if (room.status === "PLAYING") return room.allowSpectators
    return freeSeat(room) !== null || room.allowSpectators
}

function summary(room: RoomState): RoomSummary {
    countSeats(room)
    return {
        id: room.id,
        name: room.name,
        // No uid and no private code on the public row — same redaction the
        // real server does in `Room.toSummary`.
        code: "",
        status: room.status,
        targetScore: room.targetScore,
        gameEndRule: room.gameEndRule,
        noDeclarations: room.noDeclarations,
        private: room.private,
        allowSpectators: room.allowSpectators,
        seatsTaken: room.seatsTaken,
        humans: room.humans,
        occupants: room.occupants,
        joinable: room.joinable,
        createdAt: room.createdAt,
    }
}

/* ─────────────────────────── the fake deal ─────────────────────────── */

class MockGame {
    readonly gameEndRule: GameEndRule
    readonly noDeclarations: boolean
    readonly allowBela: boolean
    /** "Gledanje štihova" (game/README.md §1.8) — redacted in `view()` exactly
     *  as the real engine's `viewFor` does it, so the mock cannot show the UI
     *  something the server would never send. */
    readonly trickReview: TrickReview
    readonly targetScore: TargetScore
    dealNo = 0
    dealer: Seat = 3
    phase: Phase = "BIDDING"
    hands: Record<Seat, Card[]> = { 0: [], 1: [], 2: [], 3: [] }
    stock: Card[] = []
    bidding: BiddingState = { turn: 0, passes: [], trump: null, caller: null }
    trick: TrickState = { leader: 0, turn: 0, cards: [] }
    declarations: Record<Seat, Declaration[]> = { 0: [], 1: [], 2: [], 3: [] }
    declarationsUntil = 0
    declarationsRevealed = false
    scoringTeam: Team | null = null
    belaDeclared: Team | null = null
    belaAnnounced = false
    /** The seat that DECLINED to announce bela this deal (engine
     *  `GameState.belaRefused`, README §1.4). Final for the deal, and never in
     *  `view()`: "seat 2 declined" says "seat 2 holds K+Q of trump". */
    belaRefused: Seat | null = null
    tricks: WonTrick[] = []
    lastTrick: WonTrick | null = null
    dealScore: DealScore | null = null
    score: Record<Team, number> = { A: 0, B: 0 }
    history: DealScore[] = []
    winner: Team | null = null
    played: Card[] = []
    events: GameEvent[] = []

    constructor(targetScore: TargetScore, gameEndRule: GameEndRule = "prolaz", noDeclarations = false, allowBela = true, trickReview: TrickReview = "off") {
        this.targetScore = targetScore
        this.gameEndRule = gameEndRule
        this.noDeclarations = noDeclarations
        this.allowBela = allowBela
        this.trickReview = trickReview
    }

    private rnd = () => Math.random()

    /** 6 cards each, 8 held back for after the bidding (README §1.2). */
    startDeal(): void {
        this.dealNo += 1
        this.dealer = this.dealNo === 1 ? 3 : nextSeat(this.dealer)
        const deck = shuffle(fullDeck(), this.rnd)
        this.hands = { 0: [], 1: [], 2: [], 3: [] }
        for (const seat of SEATS) this.hands[seat] = deck.splice(0, 6)
        this.stock = deck
        this.phase = "BIDDING"
        this.bidding = { turn: nextSeat(this.dealer), passes: [], trump: null, caller: null }
        this.trick = { leader: nextSeat(this.dealer), turn: nextSeat(this.dealer), cards: [] }
        this.declarations = { 0: [], 1: [], 2: [], 3: [] }
        this.declarationsRevealed = false
        this.scoringTeam = null
        this.belaDeclared = null
        this.belaAnnounced = false
        this.belaRefused = null
        this.tricks = []
        this.lastTrick = null
        this.dealScore = null
        this.played = []
        this.events.push({ type: "DEALT", dealNo: this.dealNo, dealer: this.dealer })
    }

    bid(seat: Seat, trump: Suit): void {
        if (this.phase !== "BIDDING" || this.bidding.turn !== seat) return
        const forced = this.bidding.passes.length === 3
        this.events.push({ type: "BID", seat, trump })
        this.bidding.trump = trump
        this.bidding.caller = seat
        this.events.push({ type: "TRUMP_SET", trump, caller: seat, forced })
        this.completeHands()
    }

    pass(seat: Seat): void {
        if (this.phase !== "BIDDING" || this.bidding.turn !== seat) return
        // "Mus": the dealer is the fourth to speak and may not pass.
        if (this.bidding.passes.length === 3) return
        this.bidding.passes.push(seat)
        this.events.push({ type: "PASS", seat })
        this.bidding.turn = nextSeat(seat)
    }

    /** Two more cards each, then the automatic declaration scan (README §1.4). */
    private completeHands(): void {
        for (const seat of SEATS) this.hands[seat] = [...this.hands[seat], ...this.stock.splice(0, 2)]
        this.stock = []
        if (!this.noDeclarations) {
            for (const seat of SEATS) this.declarations[seat] = findDeclarations(this.hands[seat])
        }
        this.scoringTeam = declarationsScoringTeam(this.declarations, this.dealer)
        this.events.push({ type: "HAND_COMPLETED" })
        this.declarationsRevealed = true
        if (!this.noDeclarations) {
            this.declarationsUntil = Date.now() + DECLARATIONS_MS
            // Only the SCORING pair, exactly as the engine does (README §1.4):
            // the real server broadcasts one events frame to the whole table.
            this.events.push({
                type: "DECLARATIONS_REVEALED",
                perSeat: this.scoringDeclarations(),
                scoringTeam: this.scoringTeam,
            })
        }
        this.phase = "PLAYING"
        this.trick = { leader: nextSeat(this.dealer), turn: nextSeat(this.dealer), cards: [] }
    }

    legalFor(seat: Seat): Card[] {
        if (Date.now() < this.declarationsUntil || this.phase !== "PLAYING" || this.trick.turn !== seat) return []
        const trump = this.bidding.trump
        if (!trump) return []
        return legalMoves(this.hands[seat], this.trick.cards, trump)
    }

    /** `bela` is the player's answer to "Zovi belu?" — same contract as the
     *  engine's `PLAY` action: absent/`true` announces, `false` declines for
     *  the whole deal, and a flag the hand does not back does nothing. */
    play(seat: Seat, card: Card, bela?: boolean): boolean {
        const trump = this.bidding.trump
        if (this.phase !== "PLAYING" || this.trick.turn !== seat || !trump) return false
        if (!this.legalFor(seat).includes(card)) return false

        this.hands[seat] = this.hands[seat].filter((c) => c !== card)
        this.trick.cards.push({ seat, card })
        this.played.push(card)
        this.events.push({ type: "CARD_PLAYED", seat, card })

        // Bela: K + Q of trump in one hand, DECIDED on the first of the two
        // (README §1.4). No answer announces — the mock's bots never send a
        // flag, exactly like the real server's.
        if ((!this.noDeclarations || this.allowBela) && !this.belaAnnounced && this.belaRefused === null && cardSuit(card) === trump && (cardRank(card) === "K" || cardRank(card) === "Q")) {
            const partner = cardRank(card) === "K" ? makeCard("Q", trump) : makeCard("K", trump)
            if (this.hands[seat].includes(partner)) {
                if (bela === false) {
                    this.belaRefused = seat
                } else {
                    this.belaAnnounced = true
                    this.belaDeclared = teamOf(seat)
                    this.events.push({ type: "BELA", seat })
                }
            }
        }

        if (this.trick.cards.length < 4) {
            this.trick.turn = nextSeat(seat)
            return true
        }
        this.resolveTrick(trump)
        return true
    }

    private resolveTrick(trump: Suit): void {
        const cards: TrickCard[] = this.trick.cards
        const winner = trickWinner(cards, trump)
        const isLast = this.hands[0].length === 0
        const points = trickPoints(cards, trump) + (isLast ? 10 : 0)
        const won: WonTrick = {
            no: this.tricks.length + 1,
            leader: this.trick.leader,
            winner,
            plays: cards.map((c) => ({ ...c })),
            cards: cards.map((c) => c.card),
        }
        this.tricks.push(won)
        this.lastTrick = won
        this.events.push({
            type: "TRICK_WON",
            winner,
            cards: [...cards],
            points,
            trickNo: this.tricks.length,
        })


        this.trick = { leader: winner, turn: winner, cards: [] }
        if (isLast) this.scoreDeal(trump)
    }

    private scoreDeal(trump: Suit): void {
        const caller = this.bidding.caller ?? this.dealer
        const callerTeam = teamOf(caller)
        const cardPointsPerTeam: Record<Team, number> = { A: 0, B: 0 }

        this.tricks.forEach((won, index) => {
            const team = teamOf(won.winner)
            cardPointsPerTeam[team] += won.cards.reduce((sum, c) => sum + cardPoints(c, trump), 0)
            if (index === this.tricks.length - 1) cardPointsPerTeam[team] += 10
        })

        const stigljaTeam = (["A", "B"] as Team[]).find(
            (team) => this.tricks.every((won) => teamOf(won.winner) === team),
        ) ?? null
        if (stigljaTeam) cardPointsPerTeam[stigljaTeam] += 90

        // The same figure the scoreboard has been showing all deal — one
        // derivation, so the summary can never contradict the "+x" chip.
        const declarationPoints = this.declarationPoints()

        const totals: Record<Team, number> = {
            A: cardPointsPerTeam.A + declarationPoints.A,
            B: cardPointsPerTeam.B + declarationPoints.B,
        }
        const opponents: Team = callerTeam === "A" ? "B" : "A"
        const passed = totals[callerTeam] > totals[opponents]
        const total: Record<Team, number> = passed
            ? { ...totals }
            : ({ [callerTeam]: 0, [opponents]: totals.A + totals.B } as Record<Team, number>)

        const dealScore: DealScore = {
            dealNo: this.dealNo,
            trump,
            caller,
            callerTeam,
            cardPoints: cardPointsPerTeam,
            declarationPoints,
            stiglja: stigljaTeam,
            passed,
            total,
        }
        this.dealScore = dealScore
        this.history = [...this.history, dealScore]
        this.score = { A: this.score.A + total.A, B: this.score.B + total.B }
        this.phase = "DEAL_DONE"
        this.events.push({ type: "DEAL_SCORED", dealScore })

        const dostaWinner = this.score.A >= this.targetScore || this.score.B >= this.targetScore
            ? (this.score.A > this.score.B ? "A" : this.score.B > this.score.A ? "B" : null)
            : null
        const prolazWinner = passed && this.score[callerTeam] >= this.targetScore && this.score[callerTeam] > this.score[opponents]
            ? callerTeam
            : null
        this.winner = this.gameEndRule === "dosta" ? dostaWinner : prolazWinner
        if (this.winner !== null) {
            this.phase = "GAME_OVER"
            this.events.push({ type: "GAME_OVER", winner: this.winner, score: { ...this.score } })
        }
    }

    nextDeal(): void {
        if (this.phase !== "DEAL_DONE") return
        this.startDeal()
    }

    turn(): Seat | null {
        if (this.phase === "BIDDING") return this.bidding.turn
        if (this.phase === "PLAYING") return this.trick.turn
        return null
    }

    /** README §1.8: `leaderPair` is the pair of the seat that LEADS the
     *  current trick, not the seat whose turn it is. */
    private mayReview(seat: Seat | null): boolean {
        if (this.trickReview === "all") return true
        if (this.trickReview === "off") return false
        if (seat === null) return false
        return teamOf(seat) === teamOf(this.trick.leader)
    }

    /** The declarations that may reach ANY recipient: the scoring pair's only
     *  (README §1.4). The losing pair's are lost and never transmitted. */
    private scoringDeclarations(): Partial<Record<Seat, Declaration[]>> {
        const out: Partial<Record<Seat, Declaration[]>> = {}
        if (this.scoringTeam === null) return out
        for (const s of SEATS) {
            if (teamOf(s) === this.scoringTeam) out[s] = this.declarations[s]
        }
        return out
    }

    /** The live declaration bonus per team — the scoreboard's "+150". Mirrors
     *  the engine's `declarationPoints`: the scoring pair's declarations plus
     *  20 for an announced bela, to whichever team announced it. */
    private declarationPoints(): Record<Team, number> {
        const points: Record<Team, number> = { A: 0, B: 0 }
        if (this.scoringTeam !== null) {
            points[this.scoringTeam] = SEATS
                .filter((s) => teamOf(s) === this.scoringTeam)
                .reduce<number>((sum, s) => sum + declarationTotal(this.declarations[s]), 0)
        }
        if (this.belaDeclared !== null) points[this.belaDeclared] += 20
        return points
    }

    view(seat: Seat | null): PlayerView {
        const declarations: Partial<Record<Seat, Declaration[]>> = {}
        if (seat !== null) declarations[seat] = this.declarations[seat]
        if (this.declarationsRevealed) {
            Object.assign(declarations, this.scoringDeclarations())
        }
        const tricksWon: Record<Team, number> = { A: 0, B: 0 }
        const currentDealPoints: Record<Team, number> = { A: 0, B: 0 }
        for (const won of this.tricks) tricksWon[teamOf(won.winner)] += 1
        const trump = this.bidding.trump
        if (trump !== null) {
            for (const won of this.tricks) {
                currentDealPoints[teamOf(won.winner)] += trickPoints(
                    won.cards.map((card, index) => ({ seat: index as Seat, card })),
                    trump,
                )
            }
        }

        return {
            seat,
            phase: this.phase,
            dealNo: this.dealNo,
            dealer: this.dealer,
            hand: seat === null ? [] : [...this.hands[seat]],
            handSizes: {
                0: this.hands[0].length,
                1: this.hands[1].length,
                2: this.hands[2].length,
                3: this.hands[3].length,
            },
            bidding: { ...this.bidding, passes: [...this.bidding.passes] },
            trick: { ...this.trick, cards: [...this.trick.cards] },
            tricksWon,
            currentDealPoints,
            lastTrick: this.lastTrick,
            trickHistory: this.mayReview(seat) ? this.tricks.map((won) => ({ ...won })) : null,
            declarations,
            declarationPoints: this.declarationPoints(),
            declarationsRevealed: this.declarationsRevealed,
            declarationsScoringTeam: this.declarationsRevealed ? this.scoringTeam : null,
            belaDeclared: this.belaDeclared,
            dealScore: this.dealScore,
            score: { ...this.score },
            history: [...this.history],
            winner: this.winner,
            turn: this.turn(),
            legalMoves: seat === null ? [] : this.legalFor(seat),
            legalBids:
                seat !== null && this.phase === "BIDDING" && this.bidding.turn === seat
                    ? { canPass: this.bidding.passes.length < 3, suits: [...SUITS] }
                    : null,
            played: this.tricks.flatMap((won) => won.cards),
        }
    }

    /**
     * The view a BOT decides from: the same one a person in that seat gets,
     * except that the completed tricks are always there. The room's
     * `trickReview` setting governs what a PERSON may look at on screen; a bot
     * is stateless, so without this it would forget every trick and none of
     * the signalling in game/BOT.md could work. The server does exactly this
     * (`viewFor(state, seat, { recallTricks: true })`) and the mock has to
     * match it, or the bots play differently here than in a real room.
     */
    private botView(seat: Seat): PlayerView {
        return { ...this.view(seat), trickHistory: this.tricks.map((won) => ({ ...won })) }
    }

    botBid(seat: Seat): void {
        // The real bot, not a copy of it. This used to be a hand-rolled
        // re-implementation of "README §5's bidding heuristic, roughly", which
        // meant the mock's bots called on a different rule from the server's —
        // and it silently stopped tracking the real one (game/BOT.md §1).
        const legal = { canPass: this.bidding.passes.length < 3, suits: [...SUITS] }
        const choice = heuristicBot.chooseBid(this.botView(seat), legal, this.rnd)
        if (choice === "PASS" && legal.canPass) this.pass(seat)
        else this.bid(seat, choice === "PASS" ? (SUITS[0] as Suit) : choice)
    }

    botPlay(seat: Seat): void {
        const legal = this.legalFor(seat)
        if (legal.length === 0) return
        this.play(seat, heuristicBot.chooseCard(this.botView(seat), legal, this.rnd))
    }
}

/* ─────────────────────────── the fake server ─────────────────────────── */

class MockServer {
    private readonly handlers: GameTransportHandlers
    private readonly timers = new Set<ReturnType<typeof setTimeout>>()
    private disposed = false
    private me: UserInfo
    /** When the in-game name was last changed in THIS mock session, or null. */
    private nameChangedAt: number | null = null
    private roomId: string | null = null
    private mySeat: Seat | null = null
    private chatSeq = 0

    constructor(handlers: GameTransportHandlers) {
        this.handlers = handlers
        this.me = { uid: "mock-me", name: t("game.mock.youName"), avatarUrl: null }
        if (!seeded) {
            seeded = true
            this.seedRooms()
        }
        this.later(() => this.handlers.onOpen(), 60)
    }

    /** The game attached to the room this connection is in, if it has one. */
    private get game(): MockGame | null {
        return this.roomId ? games.get(this.roomId) ?? null : null
    }

    dispose(): void {
        this.disposed = true
        for (const id of this.timers) clearTimeout(id)
        this.timers.clear()
        this.handlers.onClose()
    }

    private later(fn: () => void, ms: number): void {
        const id = setTimeout(() => {
            this.timers.delete(id)
            if (!this.disposed) fn()
        }, ms)
        this.timers.add(id)
    }

    private emit(msg: ServerMessage, ms = NETWORK_MS): void {
        this.later(() => this.handlers.onMessage(msg), ms)
    }

    private seedRooms(): void {
        const now = Date.now()
        const demo = this.makeRoom(t("game.mock.roomName"), 1001, false, "mock-host")
        demo.createdAt = now - 120_000
        demo.seats[1] = { seat: 1, occupant: { kind: "BOT", name: botUser(1) } }
        demo.seats[2] = {
            seat: 2,
            occupant: {
                kind: "PLAYER",
                user: { uid: "mock-host", name: t("game.mock.otherName"), avatarUrl: null },
                ready: true,
                connected: true,
            },
        }
        countSeats(demo)
        rooms.set(demo.id, demo)
    }

    private makeRoom(name: string | undefined, targetScore: TargetScore, isPrivate: boolean, hostUid: string): RoomState {
        const id = `mock-${Math.random().toString(36).slice(2, 8)}`
        return {
            id,
            // The real server generates a two-word Croatian name when the
            // client sends none (protocol `room.create.name?`).
            name: name?.trim() || randomMockRoomName(),
            code: allocateMockCode(),
            hostUid,
            status: "LOBBY",
            targetScore,
            gameEndRule: "prolaz",
            private: isPrivate,
            allowSpectators: false,
            noDeclarations: false,
            allowBela: true,
            trickReview: "off",
            seatsTaken: 0,
            humans: 0,
            // Recomputed by `countSeats` on every push, like `seatsTaken`.
            occupants: [null, null, null, null],
            joinable: true,
            createdAt: Date.now(),
            seats: emptySeatRow(),
            spectators: [],
            turnTimeoutMs: DEFAULTS.turnTimeoutMs,
        }
    }

    private room(): RoomState | null {
        return this.roomId ? rooms.get(this.roomId) ?? null : null
    }

    /** Shared tail of `room.join` / `room.joinByCode`, mirroring the real
     *  server (game/README.md §3.2): a free seat is TAKEN, and a newcomer who
     *  can neither sit nor watch is refused rather than parked as a spectator. */
    private joinRoom(room: RoomState, codeProvided = false): void {
        const ref: ClientMessageType = codeProvided ? "room.joinByCode" : "room.join"
        const returning = room.seats.some((s) => s.occupant?.kind === "PLAYER" && s.occupant.user.uid === this.me.uid)
        if (room.private && !codeProvided && !returning) {
            this.error("ROOM_CODE_REQUIRED", ref)
            return
        }
        if (!returning && !canAdmitNewcomer(room)) {
            this.error(room.status === "PLAYING" ? "SPECTATORS_DISABLED" : "ROOM_FULL", ref)
            return
        }
        this.roomId = room.id
        this.mySeat = room.seats.find((s) => s.occupant?.kind === "PLAYER" && s.occupant.user.uid === this.me.uid)?.seat ?? null
        if (this.mySeat === null && room.status === "LOBBY") {
            const free = freeSeat(room)
            if (free !== null) {
                room.seats[free] = {
                    seat: free,
                    occupant: { kind: "PLAYER", user: this.me, ready: false, connected: true },
                }
                this.mySeat = free
            }
        }
        if (this.mySeat === null && !room.spectators.some((u) => u.uid === this.me.uid)) {
            room.spectators = [...room.spectators, this.me]
        }
        this.pushRoom(true)
        this.pushLobby()
        if (this.game) this.pushGame()
    }

    private pushLobby(): void {
        this.emit({ t: "lobby.rooms", rooms: [...rooms.values()].map(summary) })
    }

    private pushRoom(joined = false): void {
        const room = this.room()
        if (!room) return
        countSeats(room)
        this.emit({ t: joined ? "room.joined" : "room.state", room: { ...room, code: room.private ? room.code : "" }, yourSeat: this.mySeat })
    }

    /** The real server sends a Croatian sentence here; the client renders the
     *  CODE through the dictionary anyway, so echoing it is enough. */
    private error(code: ErrorCode, ref?: ClientMessageType): void {
        this.emit({ t: "error", code, message: code, ref })
    }

    handle(msg: ClientMessage): void {
        if (this.disposed) return
        switch (msg.t) {
            case "hello":
                if (msg.guest) this.me = { uid: `mock-guest:${msg.guest.secret.slice(0, 12)}`, name: msg.guest.name, avatarUrl: null, guest: true }
                this.emit({ t: "hello.ok", user: this.me, v: msg.v }, 30)
                return
            case "ping":
                this.emit({ t: "pong" }, 5)
                return
            case "lobby.subscribe":
                this.pushLobby()
                return
            case "lobby.unsubscribe":
                return
            case "room.create": {
                const room = this.makeRoom(msg.name, msg.targetScore, msg.private, this.me.uid)
                room.gameEndRule = msg.gameEndRule ?? "prolaz"
                room.noDeclarations = msg.noDeclarations === true
                room.allowBela = !room.noDeclarations || msg.allowBela !== false
                room.allowSpectators = msg.allowSpectators === true
                room.trickReview = msg.trickReview ?? "off"
                room.seats[0] = {
                    seat: 0,
                    occupant: { kind: "PLAYER", user: this.me, ready: false, connected: true },
                }
                rooms.set(room.id, room)
                this.roomId = room.id
                this.mySeat = 0
                this.pushRoom(true)
                this.pushLobby()
                return
            }
            case "room.join": {
                const room = rooms.get(msg.roomId)
                if (!room) {
                    this.error("ROOM_NOT_FOUND", msg.t)
                    return
                }
                this.joinRoom(room)
                return
            }
            case "room.joinByCode": {
                const room = [...rooms.values()].find((r) => r.private && r.code === msg.code)
                if (!room) {
                    this.error("ROOM_NOT_FOUND", msg.t)
                    return
                }
                this.joinRoom(room, true)
                return
            }
            case "room.leave": {
                const room = this.room()
                if (room) {
                    if (this.mySeat !== null) room.seats[this.mySeat] = { seat: this.mySeat, occupant: null }
                    room.spectators = room.spectators.filter((u) => u.uid !== this.me.uid)
                    countSeats(room)
                    const hasHuman = room.seats.some((slot) => slot.occupant?.kind === "PLAYER")
                    if (room.status === "LOBBY" && !hasHuman && room.spectators.length === 0) {
                        rooms.delete(room.id)
                        games.delete(room.id)
                    }
                }
                this.roomId = null
                this.mySeat = null
                this.emit({ t: "room.left" })
                this.pushLobby()
                return
            }
            case "room.sit": {
                const room = this.room()
                if (!room) return
                if (room.seats[msg.seat].occupant) {
                    this.error("SEAT_TAKEN", msg.t)
                    return
                }
                if (this.mySeat !== null) room.seats[this.mySeat] = { seat: this.mySeat, occupant: null }
                room.seats[msg.seat] = {
                    seat: msg.seat,
                    occupant: { kind: "PLAYER", user: this.me, ready: false, connected: true },
                }
                room.spectators = room.spectators.filter((u) => u.uid !== this.me.uid)
                this.mySeat = msg.seat
                this.pushRoom()
                return
            }
            case "room.stand": {
                const room = this.room()
                if (!room || this.mySeat === null) return
                // Standing up makes you a spectator, so a room without them
                // refuses it (server `Room.stand`).
                if (!room.allowSpectators) { this.error("SPECTATORS_DISABLED", msg.t); return }
                room.seats[this.mySeat] = { seat: this.mySeat, occupant: null }
                room.spectators = [...room.spectators, this.me]
                this.mySeat = null
                this.pushRoom()
                return
            }
            case "room.addBot": {
                const room = this.room()
                if (!room) return
                if (room.seats[msg.seat].occupant) {
                    this.error("SEAT_TAKEN", msg.t)
                    return
                }
                room.seats[msg.seat] = {
                    seat: msg.seat,
                    occupant: { kind: "BOT", name: botUser(msg.seat) },
                }
                this.pushRoom()
                return
            }
            case "room.removeBot": {
                const room = this.room()
                if (!room) return
                if (room.seats[msg.seat].occupant?.kind !== "BOT") return
                room.seats[msg.seat] = { seat: msg.seat, occupant: null }
                this.pushRoom()
                return
            }
            case "room.setPrivate": {
                const room = this.room()
                if (!room) return
                if (room.hostUid !== this.me.uid) { this.error("NOT_HOST", msg.t); return }
                room.private = msg.private
                this.pushRoom()
                this.pushLobby()
                return
            }
            case "profile.setName": {
                /* The in-game name (protocol `profile.setName`). The real
                   server hands the write to the backend, which owns the
                   once-a-week clock; the mock keeps that clock in memory so
                   `/igra?mock=1` shows the refusal too — a second change in
                   the same session is exactly how the limit is met in real
                   life. */
                const name = typeof msg.name === "string" ? msg.name.trim() : ""
                if (name.length === 0 || name.length > LIMITS.playerNameMax) { this.error("BAD_REQUEST", msg.t); return }
                if (this.nameChangedAt !== null) {
                    const nextChangeAt = this.nameChangedAt + NAME_CHANGE_INTERVAL_MS
                    this.emit({ t: "profile.name", name: this.me.name, nextChangeAt })
                    this.error("NAME_RATE_LIMITED", msg.t)
                    return
                }
                this.nameChangedAt = Date.now()
                this.me = { ...this.me, name }
                const room = this.room()
                if (room) {
                    for (const seat of room.seats) {
                        const occupant = seat.occupant
                        if (occupant?.kind === "PLAYER" && occupant.user.uid === this.me.uid) occupant.user = this.me
                    }
                }
                this.emit({ t: "profile.name", name, nextChangeAt: this.nameChangedAt + NAME_CHANGE_INTERVAL_MS })
                if (room) { this.pushRoom(); this.pushLobby() }
                return
            }
            case "profile.setAvatar": {
                /* The picked face (protocol `profile.setAvatar`). The real
                   server validates against the same 16 ids and, having no
                   internal write for the avatar, keeps the change on the
                   connection; the mock has no backend at all, so "in memory"
                   is the faithful behaviour here rather than a shortcut. */
                if (!isAvatarId(msg.preset)) { this.error("BAD_REQUEST", msg.t); return }
                this.me = { ...this.me, avatarPreset: msg.preset }
                const avatarRoom = this.room()
                if (avatarRoom) {
                    for (const seat of avatarRoom.seats) {
                        const occupant = seat.occupant
                        if (occupant?.kind === "PLAYER" && occupant.user.uid === this.me.uid) occupant.user = this.me
                    }
                }
                this.emit({ t: "profile.avatar", preset: msg.preset })
                if (avatarRoom) this.pushRoom()
                return
            }
            case "room.setOptions": {
                // The mock mirrors the server's guards (game/README.md §3):
                // host only, lobby only, absent fields left alone, and the
                // bela follows the declarations exactly as `room.create` sets
                // it. A mock that accepts what the server refuses teaches the
                // UI a room the server never builds.
                const room = this.room()
                if (!room) return
                if (room.hostUid !== this.me.uid) { this.error("NOT_HOST", msg.t); return }
                // Same code the real server sends (`Room.requireLobby`).
                if (room.status === "PLAYING") { this.error("ALREADY_STARTED", msg.t); return }
                if (msg.targetScore !== undefined) room.targetScore = msg.targetScore
                if (msg.gameEndRule !== undefined) room.gameEndRule = msg.gameEndRule
                if (msg.allowSpectators !== undefined) room.allowSpectators = msg.allowSpectators
                if (msg.noDeclarations !== undefined) room.noDeclarations = msg.noDeclarations
                if (msg.allowBela !== undefined) room.allowBela = msg.allowBela
                if (msg.trickReview !== undefined) room.trickReview = msg.trickReview
                if (!room.noDeclarations) room.allowBela = true
                this.pushRoom()
                this.pushLobby()
                return
            }
            case "room.ready": {
                const room = this.room()
                if (!room || this.mySeat === null) return
                const occupant = room.seats[this.mySeat].occupant
                if (occupant?.kind === "PLAYER") {
                    room.seats[this.mySeat] = {
                        seat: this.mySeat,
                        occupant: { ...occupant, ready: msg.ready },
                    }
                }
                this.pushRoom()
                return
            }
            case "room.start": {
                const room = this.room()
                if (!room) return
                if (this.mySeat === null) {
                    this.error("BAD_REQUEST", msg.t)
                    return
                }
                const humans = room.seats
                    .map((seat) => seat.occupant)
                    .filter((occupant) => occupant?.kind === "PLAYER")
                if (humans.length === 0 || humans.some((occupant) => !occupant.ready)) {
                    this.error("BAD_REQUEST", msg.t)
                    return
                }
                if (room.seats.some((seat) => seat.occupant === null)) {
                    this.error("NOT_ENOUGH_PLAYERS", msg.t)
                    return
                }
                room.status = "PLAYING"
                const game = new MockGame(room.targetScore, room.gameEndRule, room.noDeclarations, room.allowBela, room.trickReview)
                game.startDeal()
                games.set(room.id, game)
                this.pushRoom()
                this.pushLobby()
                this.pushGame(300)
                this.scheduleBot()
                return
            }
            case "game.bid": {
                if (!this.game || this.mySeat === null) return
                if (this.game.turn() !== this.mySeat) {
                    this.error("NOT_YOUR_TURN", msg.t)
                    return
                }
                this.game.bid(this.mySeat, msg.trump)
                this.pushGame()
                this.scheduleBot()
                return
            }
            case "game.pass": {
                if (!this.game || this.mySeat === null) return
                if (this.game.turn() !== this.mySeat) {
                    this.error("NOT_YOUR_TURN", msg.t)
                    return
                }
                this.game.pass(this.mySeat)
                this.pushGame()
                this.scheduleBot()
                return
            }
            case "game.play": {
                if (!this.game || this.mySeat === null) return
                if (this.game.turn() !== this.mySeat) {
                    this.error("NOT_YOUR_TURN", msg.t)
                    return
                }
                if (!this.game.play(this.mySeat, msg.card, msg.bela)) {
                    this.error("ILLEGAL_MOVE", msg.t)
                    return
                }
                this.pushGame()
                this.scheduleBot()
                return
            }
            case "game.nextDeal": {
                if (!this.game) return
                this.game.nextDeal()
                this.pushGame()
                this.scheduleBot()
                return
            }
            case "chat.react": {
                // Echoed straight back so `/igra?mock=1` can demo the seat
                // bubbles; the real server also fans it out to the room and
                // enforces `LIMITS.reactionCooldownMs`.
                this.emit({
                    t: "chat.reaction",
                    from: this.me,
                    seat: this.mySeat,
                    reaction: msg.reaction,
                    at: Date.now(),
                })
                return
            }
            case "chat.send": {
                this.chatSeq += 1
                const chat: ChatMessage = {
                    id: `mock-chat-${this.chatSeq}`,
                    from: this.me,
                    text: msg.text.slice(0, 300),
                    at: Date.now(),
                }
                this.emit({ t: "chat.msg", msg: chat })
                return
            }
        }
    }

    /** One `game.state` + one `game.events` frame, exactly like the server. */
    private pushGame(ms = NETWORK_MS): void {
        const game = this.game
        if (!game) return
        const room = this.room()
        if (game.phase === "GAME_OVER" && room?.status === "PLAYING") {
            room.status = "LOBBY"
            for (const slot of room.seats) {
                if (slot.occupant?.kind === "PLAYER") slot.occupant.ready = false
            }
            this.pushRoom()
            this.pushLobby()
        }
        const events = game.events
        game.events = []
        const deadline = game.turn() === null || game.declarationsUntil > Date.now() ? null : Date.now() + DEFAULTS.turnTimeoutMs
        this.emit({ t: "game.state", view: game.view(this.mySeat), declarationsPending: game.declarationsUntil > Date.now(), turnDeadline: deadline, autoPlayed: false }, ms)
        if (events.length > 0) this.emit({ t: "game.events", events }, ms)
    }

    /** Bots think for a beat so the table doesn't snap through a whole deal. */
    private scheduleBot(): void {
        const game = this.game
        if (!game) return
        if (game.declarationsUntil > Date.now()) {
            this.later(() => { if (this.game !== game) return; this.pushGame(); this.scheduleBot() }, game.declarationsUntil - Date.now() + 5)
            return
        }
        const turn = game.turn()
        if (turn === null || turn === this.mySeat) return
        this.later(() => {
            if (!this.game || this.game !== game) return
            if (game.phase === "BIDDING") game.botBid(turn)
            else game.botPlay(turn)
            this.pushGame()
            this.scheduleBot()
        }, BOT_THINK_MS)
    }
}

/** Transport factory `useGameSocket` swaps in for `?mock=1`. */
export function createMockTransport(handlers: GameTransportHandlers): GameTransport {
    const server = new MockServer(handlers)
    return {
        send: (msg) => server.handle(msg),
        close: () => server.dispose(),
    }
}
