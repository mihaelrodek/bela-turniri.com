# `src/game` — online bela (UI)

React screens for playing bela in the browser. Everything that is **logic** —
rules, bots, rooms, the authoritative server — lives in the sibling `game/`
workspace and is the contract (`game/README.md`). This folder is only the
view: it renders a `PlayerView`, sends `ClientMessage`s and animates
`GameEvent`s.

Routes: `/igra` (lobby) and `/igra/soba/:roomId` (room → table). Both are
lazy chunks behind `GameIdentityGate` (`src/App.tsx`), and both hide
`MobileTabBar` / `SiteFooter` — the table owns the viewport the same way
`/turniri/novi` does.

## Layout

```
components/     PlayingCard, Hand, Seat, TrickArea, Table, BiddingPanel,
                ScoreBoard, DeclarationsReveal (+ BelaFlash), BelaPrompt,
                DealSummary, RoomPanel, Chat
hooks/          useGameSocket      one WS per page: hello → room → play
                useEventQueue      plays game.events back one at a time
                useTurnCountdown   turnDeadline → a draining ring
                usePrefersReducedMotion
mock/           mockGameServer.ts  in-browser fake server (DEV ONLY)
                mockRules.ts       just enough of README §1 to fake a deal
pages/          GameLobbyPage, GameRoomPage
util/           cards.ts (card id parsing + card metrics), seats.ts (table
                geometry: who sits where, which way play runs)
types.ts        the transport interface the socket and the mock share
```

## Why it looks the way it does

- **My seat is always at the bottom**, and the others run counter-clockwise
  from it: the player who acts after me sits on my **right**, as at a real
  table. `util/seats.ts` owns that rotation; nothing else may re-derive it.
- **The engine's runtime is not imported.** Only its *types* are (erased at
  build time). The server is authoritative and every legal move already
  arrives in `PlayerView.legalMoves`, so the browser has no business carrying
  a second copy of the rules. The handful of pure helpers the UI genuinely
  needs — parsing `"10PIK"`, suit colour, display sort — are re-implemented in
  `util/cards.ts`.
- **Two sources of truth on screen.** `PlayerView` says what is true *now*;
  the event queue says what has to be *seen happening*. They disagree exactly
  once — the server clears the trick in the same frame it announces the
  winner — and there the event wins until its dwell is over
  (`hooks/useEventQueue.ts`).
- **A (re)join reads the view, never the event log.** The socket is a module
  singleton, so its event ring buffer outlives the table page; a queue mounted
  in front of a backlog must *skip* it (`startedRef` in `useEventQueue`) —
  replaying it shows tricks that are long over and its `DEALT` wipes the felt.
  Cards played before we connected exist only in `game.state` (the server's
  `sendStateTo` sends the whole `trick` on every join, rejoin and reconnect
  and replays no events — `packages/server/test/rejoinTrick.test.ts`), so
  `GameRoomPage` seeds the felt from the view once per connected session.
  Those hydrated cards do **not** fly in: only the card of the CARD_PLAYED the
  queue has just released does (`TrickArea`'s `flyIn`).
- **The scoreboard's big number is THIS DEAL.** `PlayerView.currentDealPoints`
  — the card points of completed tricks — is what a player is doing
  arithmetic with while the deal runs, so it gets the largest type; the
  running match total (`score`) sits small underneath and the trick count,
  deal number and target share a thin footer row. Declarations, bela, the
  last-trick 10, a štiglja and a fall are NOT in the big number: they are
  settled at the end of the deal and appear in the summary and in the total.
- **A finished deal, and a finished game, are each announced exactly once, in
  the middle of the screen.** `DealSummary` for a deal, `GameOverDialog` for
  the game — no banner above the room. A deal that reaches the target ends
  the game where it is scored (`game/README.md` §1.7), so it has no summary
  and asks for no next deal; the table waits for the event queue to collect
  that last trick before the room screen takes over.
- **Every string** goes through `t("game.…")`, counts through `usePlural()`.
  Croatian is the source of truth (`src/i18n/hr/game.ts`); a missing
  Slovenian key is a compile error.

## Room options and preferences

Finished games return the same room to `LOBBY`, retaining seats, bots and
rules. The final score is announced once, in `GameOverDialog`; dismissing it
leaves the room screen alone. Human readiness is reset; Always ready can
re-enable it. Restarting creates a fresh game with
zero scores and an empty history.

New rooms are public, use declarations and disallow spectators by default.
Hosts can switch public/private visibility from the room before or during a
game. Private rooms remain listed in the lobby as locked rooms, but their code
is disclosed only inside the room; selecting one opens the code prompt.
Disabling declarations exposes a separate option to allow bela;
these rules are fixed when the room is created and apply to every deal.

**Joining takes a seat** (`game/README.md` §3.3). The server seats every
joiner in the first free chair, so `RoomPanel` shows "Sva su mjesta zauzeta"
only when the four seats really are taken — and offers "Sjedni ovdje" if a
seatless member ever finds an empty one. "Omogući gledatelje" applies the whole
time, not just once play starts: a room without spectators refuses anyone it
cannot seat (`ROOM_FULL` in the lobby, `SPECTATORS_DISABLED` mid-game) rather
than parking them as a watcher, and `GameRoomPage` sends both refusals back to
the lobby. `RoomListItem` renders the room's `occupants` — players by name,
bots as bots, empty chairs dashed — and refuses the click when the summary's
`joinable` is false, which is the server's own admission answer rather than a
guess from the counts. The lobby summary carries no uid and no private code.

**"Zovi belu?"** (`game/README.md` §1.4). Announcing bela is the holder's
choice, not an automatism: on a deal we are going to lose, every point of it
goes to the opponents, so declaring hands them 20. `GameRoomPage` holds the tap
back when the card is the first of trump K/Q out of a hand holding both — and
only while the room allows bela at all — and `BelaPrompt` asks, anchored over
the hand tray so the trick stays visible. The answer rides out on the same
`game.play` as a `bela` flag; there is no extra round trip and nothing at the
table waits. Refusing is silent and final for the deal (the engine keeps it in
`belaRefused`, which never reaches a client); declaring is confirmed to
everybody by the existing `BelaFlash`. If the 20 s clock wins instead, the
server's bot plays and the bela IS announced — silence declares.

**Reviewing past tricks** ("gledanje štihova", `game/README.md` §1.8) is a
third room rule with three states, off by default: nobody, the pair that
*starts* the current trick, or everybody. `TrickHistory` renders
`PlayerView.trickHistory` — completed tricks with the seat behind every card —
and renders nothing else, because a seat the room excludes never receives that
field at all. The redaction is `viewFor`'s, on the server; the "Štihovi"
button only appears when the room allows reviewing at all, so it does not
blink in and out as the lead changes hands.

**One game at a time** (§3.2). While `game.active` says a room still holds a
seat for us, "Nova igra", "Pridruži se šifrom" and every room row but our own
are disabled, with one line saying why: the server refuses those requests
(`ALREADY_IN_GAME`) rather than forfeiting the old seat as it used to. Getting
out is deliberate — back to the table, or "Napusti igru" on the active-game
card.

An explicit exit dissolves the room immediately when it leaves fewer than two
human players. This covers both a solo game against three bots and a two-person
game with two bots. Every remaining member is returned to the lobby, so a
bot-only or one-person room can never remain advertised as a live game.

All room bots use the strongest strategy, including automatic seat filling.
The readiness switch keeps the same label in both states. “Always ready” is
saved in this browser and marks the player ready when taking a seat; a manual
change to unready remains respected until they take a seat again.

## Running the mock

The Node game server (`game/packages/server`, port 8285) is a separate
process. To work on the UI without it:

```
npm run dev            # in frontend/
open http://localhost:5185/igra?mock=1
```

`?mock=1` (dev builds only) swaps `useGameSocket`'s transport for
`mock/mockGameServer.ts`, which speaks the same `@bela/protocol` frames with
the same ordering and a fake network delay. Create a room, sit down, add
bots, press Start and play a real deal — bidding, tricks, declarations,
bela (including the "Zovi belu?" choice and its refusal), štiglja, pass/fall,
the deal summary and game over all work.

Carry the flag along when you navigate by hand: `/igra/soba/{id}?mock=1`
(the pages do it for you when you click through). Rooms live at module scope,
so they survive an in-SPA navigation and disappear on reload.

The mock is behind a dynamic `import()` guarded by `import.meta.env.DEV`, so
Rollup drops it entirely from a production build — verified: no `mock` chunk
in `dist/assets`.

## Against the real server

`/ws/game` is the public path. The Vite dev proxy forwards it to
`localhost:8285` (entry placed **above** the generic `/ws` one, which
rewrites to Quarkus), and Caddy does the same in production. The socket
greets with `{ t: "hello", v: PROTOCOL_VERSION, token }` where `token` is a
Firebase ID token (guests instead send a saved name and random browser secret), re-`hello`s and re-joins its room on every reconnect, and
buffers anything the UI sends before the greeting is answered.
