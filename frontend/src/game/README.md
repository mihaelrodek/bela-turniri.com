# `src/game` — online bela (UI)

React screens for playing bela in the browser. Everything that is **logic** —
rules, bots, rooms, the authoritative server — lives in the sibling `game/`
workspace and is the contract (`game/README.md`). This folder is only the
view: it renders a `PlayerView`, sends `ClientMessage`s and animates
`GameEvent`s.

Routes: `/igra` (lobby) and `/igra/soba/:roomId` (room → table). Both are
lazy chunks behind `RequireAuth` (`src/App.tsx`), and both hide
`MobileTabBar` / `SiteFooter` — the table owns the viewport the same way
`/turniri/novi` does.

## Layout

```
components/     PlayingCard, Hand, Seat, TrickArea, Table, BiddingPanel,
                ScoreBoard, DeclarationsReveal (+ BelaFlash), DealSummary,
                GameOverDialog, RoomPanel, Chat
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
- **Every string** goes through `t("game.…")`, counts through `usePlural()`.
  Croatian is the source of truth (`src/i18n/hr/game.ts`); a missing
  Slovenian key is a compile error.

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
bela, štiglja, pass/fall, the deal summary and game over all work.

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
Firebase ID token, re-`hello`s and re-joins its room on every reconnect, and
buffers anything the UI sends before the greeting is answered.
