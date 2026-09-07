import { DEFAULTS } from "@bela/protocol"
import type {
    BotLevel,
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
    Phase,
    PlayerView,
    Seat,
    Suit,
    TargetScore,
    Team,
    TrickCard,
    TrickState,
    WonTrick,
} from "@bela/engine"
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

const BOT_THINK_MS = 850
const NETWORK_MS = 40

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
}

function summary(room: RoomState): RoomSummary {
    return {
        id: room.id,
        name: room.name,
        code: room.code,
        hostUid: room.hostUid,
        status: room.status,
        targetScore: room.targetScore,
        private: room.private,
        seatsTaken: room.seatsTaken,
        humans: room.humans,
        createdAt: room.createdAt,
    }
}

/* ─────────────────────────── the fake deal ─────────────────────────── */

class MockGame {
    readonly targetScore: TargetScore
    dealNo = 0
    dealer: Seat = 3
    phase: Phase = "BIDDING"
    hands: Record<Seat, Card[]> = { 0: [], 1: [], 2: [], 3: [] }
    stock: Card[] = []
    bidding: BiddingState = { turn: 0, passes: [], trump: null, caller: null }
    trick: TrickState = { leader: 0, turn: 0, cards: [] }
    declarations: Record<Seat, Declaration[]> = { 0: [], 1: [], 2: [], 3: [] }
    declarationsRevealed = false
    scoringTeam: Team | null = null
    belaDeclared: Team | null = null
    belaAnnounced = false
    tricks: WonTrick[] = []
    lastTrick: WonTrick | null = null
    dealScore: DealScore | null = null
    score: Record<Team, number> = { A: 0, B: 0 }
    history: DealScore[] = []
    winner: Team | null = null
    played: Card[] = []
    events: GameEvent[] = []

    constructor(targetScore: TargetScore) {
        this.targetScore = targetScore
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
        for (const seat of SEATS) this.declarations[seat] = findDeclarations(this.hands[seat])
        this.scoringTeam = declarationsScoringTeam(this.declarations, this.dealer)
        this.events.push({ type: "HAND_COMPLETED" })
        this.phase = "PLAYING"
        this.trick = { leader: nextSeat(this.dealer), turn: nextSeat(this.dealer), cards: [] }
    }

    legalFor(seat: Seat): Card[] {
        if (this.phase !== "PLAYING" || this.trick.turn !== seat) return []
        const trump = this.bidding.trump
        if (!trump) return []
        return legalMoves(this.hands[seat], this.trick.cards, trump, seat)
    }

    play(seat: Seat, card: Card): boolean {
        const trump = this.bidding.trump
        if (this.phase !== "PLAYING" || this.trick.turn !== seat || !trump) return false
        if (!this.legalFor(seat).includes(card)) return false

        this.hands[seat] = this.hands[seat].filter((c) => c !== card)
        this.trick.cards.push({ seat, card })
        this.played.push(card)
        this.events.push({ type: "CARD_PLAYED", seat, card })

        // Bela: K + Q of trump in one hand, announced on the first of the two.
        if (!this.belaAnnounced && cardSuit(card) === trump && (cardRank(card) === "K" || cardRank(card) === "Q")) {
            const partner = cardRank(card) === "K" ? makeCard("Q", trump) : makeCard("K", trump)
            if (this.hands[seat].includes(partner)) {
                this.belaAnnounced = true
                this.belaDeclared = teamOf(seat)
                this.events.push({ type: "BELA", seat })
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
        const won: WonTrick = { winner, cards: cards.map((c) => c.card) }
        this.tricks.push(won)
        this.lastTrick = won
        this.events.push({
            type: "TRICK_WON",
            winner,
            cards: [...cards],
            points,
            trickNo: this.tricks.length,
        })

        if (this.tricks.length === 1) {
            this.declarationsRevealed = true
            this.events.push({
                type: "DECLARATIONS_REVEALED",
                perSeat: { ...this.declarations },
                scoringTeam: this.scoringTeam,
            })
        }

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

        const declarationPoints: Record<Team, number> = { A: 0, B: 0 }
        if (this.scoringTeam) {
            declarationPoints[this.scoringTeam] = SEATS
                .filter((s) => teamOf(s) === this.scoringTeam)
                .reduce<number>((sum, s) => sum + declarationTotal(this.declarations[s]), 0)
        }
        if (this.belaDeclared) declarationPoints[this.belaDeclared] += 20

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

        const reached = this.score.A >= this.targetScore || this.score.B >= this.targetScore
        if (reached && this.score.A !== this.score.B) {
            this.winner = this.score.A > this.score.B ? "A" : "B"
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

    view(seat: Seat | null): PlayerView {
        const declarations: Partial<Record<Seat, Declaration[]>> = {}
        if (this.declarationsRevealed) {
            for (const s of SEATS) declarations[s] = this.declarations[s]
        } else if (seat !== null) {
            declarations[seat] = this.declarations[seat]
        }
        const tricksWon: Record<Team, number> = { A: 0, B: 0 }
        for (const won of this.tricks) tricksWon[teamOf(won.winner)] += 1

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
            lastTrick: this.lastTrick,
            declarations,
            declarationsRevealed: this.declarationsRevealed,
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
            played: [...this.played],
        }
    }

    /** README §5's `srednje` bidding heuristic, roughly. */
    botBid(seat: Seat): void {
        const hand = this.hands[seat]
        let bestSuit: Suit = "HERC"
        let bestScore = -1
        for (const suit of SUITS) {
            const cards = hand.filter((c) => cardSuit(c) === suit)
            let score = 0
            for (const card of cards) {
                const rank = cardRank(card)
                if (rank === "J") score += 4
                else if (rank === "9") score += 3
                else if (rank === "A") score += 1.5
                else if (rank === "10") score += 1
                score += 0.5
            }
            if (score > bestScore) {
                bestScore = score
                bestSuit = suit
            }
        }
        const mustBid = this.bidding.passes.length === 3
        if (mustBid || bestScore >= 5.5) this.bid(seat, bestSuit)
        else this.pass(seat)
    }

    botPlay(seat: Seat): void {
        const legal = this.legalFor(seat)
        if (legal.length === 0) return
        this.play(seat, legal[Math.floor(this.rnd() * legal.length)])
    }
}

/* ─────────────────────────── the fake server ─────────────────────────── */

class MockServer {
    private readonly handlers: GameTransportHandlers
    private readonly timers = new Set<ReturnType<typeof setTimeout>>()
    private disposed = false
    private readonly me: UserInfo
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
        demo.seats[1] = { seat: 1, occupant: { kind: "BOT", level: "srednje", name: botUser(1) } }
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
            private: isPrivate,
            seatsTaken: 0,
            humans: 0,
            createdAt: Date.now(),
            seats: emptySeatRow(),
            spectators: [],
            turnTimeoutMs: DEFAULTS.turnTimeoutMs,
        }
    }

    private room(): RoomState | null {
        return this.roomId ? rooms.get(this.roomId) ?? null : null
    }

    /** Shared tail of `room.join` / `room.joinByCode`: attach as a spectator
     *  unless we already hold a seat there. */
    private joinRoom(room: RoomState): void {
        this.roomId = room.id
        this.mySeat = room.seats.find((s) => s.occupant?.kind === "PLAYER" && s.occupant.user.uid === this.me.uid)?.seat ?? null
        if (this.mySeat === null && !room.spectators.some((u) => u.uid === this.me.uid)) {
            room.spectators = [...room.spectators, this.me]
        }
        this.pushRoom(true)
        if (this.game) this.pushGame()
    }

    private pushLobby(): void {
        this.emit({ t: "lobby.rooms", rooms: [...rooms.values()].filter((r) => !r.private).map(summary) })
    }

    private pushRoom(joined = false): void {
        const room = this.room()
        if (!room) return
        countSeats(room)
        this.emit({ t: joined ? "room.joined" : "room.state", room: { ...room }, yourSeat: this.mySeat })
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
                const room = [...rooms.values()].find((r) => r.code === msg.code)
                if (!room) {
                    this.error("ROOM_NOT_FOUND", msg.t)
                    return
                }
                this.joinRoom(room)
                return
            }
            case "room.leave": {
                const room = this.room()
                if (room) {
                    if (this.mySeat !== null) room.seats[this.mySeat] = { seat: this.mySeat, occupant: null }
                    room.spectators = room.spectators.filter((u) => u.uid !== this.me.uid)
                    countSeats(room)
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
                    occupant: { kind: "BOT", level: msg.level, name: botUser(msg.seat) },
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
                if (room.hostUid !== this.me.uid) {
                    this.error("NOT_HOST", msg.t)
                    return
                }
                const level: BotLevel = "srednje"
                for (const seat of SEATS) {
                    if (!room.seats[seat].occupant) {
                        room.seats[seat] = { seat, occupant: { kind: "BOT", level, name: botUser(seat) } }
                    }
                }
                room.status = "PLAYING"
                const game = new MockGame(room.targetScore)
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
                if (!this.game.play(this.mySeat, msg.card)) {
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
        const events = game.events
        game.events = []
        const deadline = game.turn() === null ? null : Date.now() + DEFAULTS.turnTimeoutMs
        this.emit({ t: "game.state", view: game.view(this.mySeat), turnDeadline: deadline, autoPlayed: false }, ms)
        if (events.length > 0) this.emit({ t: "game.events", events }, ms)
    }

    /** Bots think for a beat so the table doesn't snap through a whole deal. */
    private scheduleBot(): void {
        const game = this.game
        if (!game) return
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
