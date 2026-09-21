import type { GameDict } from "../hr/game"

/* English `game`. Typed against the Croatian namespace, so a missing or
   mistyped key fails `tsc` rather than showing up at runtime.

   Register: informal second person, same as `sl`. English has only one
   plural category, so every counted family collapses to `.one` (singular)
   and `.two`/`.few`/`.other` all carrying the identical plural text. */

export const game: GameDict = {
    "room.privateGame": "Private game",
    "room.allowSpectators": "Allow spectators",
    "room.spectatorsAllowed": "Spectators allowed",
    "room.spectatorsDisabled": "No spectators",
    "guest.title": "Play Bela",
    "guest.name": "Player name",
    "guest.nameHint": "Enter the name you'll use at the table. We'll remember it in this browser.",
    "guest.avatarHint": "Pick an avatar to represent you at the table.",
    "guest.play": "Play as guest",
    "guest.statsHint": "Sign in to save your stats across devices.",
    "guest.chooseHint": "How do you want to play?",
    "guest.loginOrRegister": "Sign in or create an account",
    "guest.playAsGuest": "Play as guest",
    "guest.back": "Back",
    "guest.heroTitle": "Play Bela right now",
    "guest.heroSubtitle": "No account, no install. Pick a name and an avatar, then take a seat.",
    "guest.playNow": "Play now as guest",
    "guest.youBadge": "You",
    "guest.perk.noAccount": "No sign-up",
    "guest.perk.free": "Free",
    "guest.perk.bots": "With people or bots",
    "guest.or": "or",
    "guest.loginInline": "Sign in",
    "guest.statsHintSuffix": "to save your stats across devices.",
    "guest.nameOffensive": "That name isn't allowed. Choose another one.",
    "declarations.calculating": "Working out declarations…",
    "declarations.starting": "Game starting…",

    "lobby.heroLabel": "Bela Online",
    "lobby.heroTitle": "Your table. Your crew.",
    "lobby.heroDescription": "Find an open table or gather your crew for a new game of Bela.",
    "room.visibility": "Game visibility",
    "room.private": "Private",
    "room.public": "Public",
    "room.waitingReady": "Not ready",
    "room.statsOverall": "Overall {wins}–{losses} · {percent}%",
    "room.statsTitle": "Overall",
    /* Karma = player reliability, 0..10. Short badge next to the seat in the lobby. */
    "room.karma": "Karma {value}/{max}",
    "karma.explain": "Karma is a reliability score from 0 to {max}. Everyone starts at {max}. If you leave a game that's in progress and don't return within the return window, you lose 1 point (it doesn't count if the table was only bots). The point comes back on its own after {window}. Karma can't be repaired by playing. Players sharing your room can see your karma.",
    "karma.abandonedLine": "Abandoned {abandoned} of {games} in {window}",
    "karma.noAbandonsLine": "No abandoned games in {window}",
    "karma.totalAbandonsLine": "Total abandoned games: {count}",
    "karma.gamesOf.one": "{n} game",
    "karma.gamesOf.two": "{n} games",
    "karma.gamesOf.few": "{n} games",
    "karma.gamesOf.other": "{n} games",
    "karma.lastDays.one": "last {n} day",
    "karma.lastDays.two": "last {n} days",
    "karma.lastDays.few": "last {n} days",
    "karma.lastDays.other": "last {n} days",
    "karma.daysDuration.one": "{n} day",
    "karma.daysDuration.two": "{n} days",
    "karma.daysDuration.few": "{n} days",
    "karma.daysDuration.other": "{n} days",
    "room.statsTarget": "{target} {wins}–{losses} · {percent}%",
    "bot.label": "Bot",
    "rules.title": "Deal rules",
    "rules.noDeclarations": "No declarations",
    "rules.withDeclarations": "With declarations",
    "rules.allowBela": "Bela allowed",
    "rules.noBela": "No bela",
    "settings.gameName": "Name for the game",
    "settings.gameNameHint": "The name other players see at the table. You can change it once every seven days.",
    "settings.gameNameSaved": "Name saved.",
    "settings.gameNameNext": "You can change your name again on {date}.",
    "settings.gameNameOffensive": "That name isn't allowed. Choose another one.",
    "settings.avatar": "Avatar",
    "settings.avatarHint": "The avatar other players see at the table.",
    "settings.alwaysReady": "Always ready",
    "settings.alwaysReadyHint": "Automatically mark yourself ready.",
    /* ─── Shared ─────────────────────────────────────────────── */
    "common.cancel": "Cancel",
    "common.save": "Save",

    /* ─── Connection state ──────────────────────────────────── */
    "connection.connecting": "Connecting…",
    "connection.open": "Connected",
    "connection.closed": "Connection lost — retrying",
    "connection.slow": "Connection is slow — trying to connect",

    /* ─── Suits and card values ─────────────────────────────── */
    // Spoken suit names; the symbols (♥♦♠♣) are French and not translated.
    "suit.HERC": "hearts",
    "suit.KARA": "diamonds",
    "suit.PIK": "spades",
    "suit.TREF": "clubs",

    "rank.7": "seven",
    "rank.8": "eight",
    "rank.9": "nine",
    "rank.10": "ten",
    "rank.J": "jack",
    "rank.Q": "queen",
    "rank.K": "king",
    "rank.A": "ace",

    // The mark printed on the card itself. Identical in every language — these
    // are French-deck marks, not words.
    "rankShort.7": "7",
    "rankShort.8": "8",
    "rankShort.9": "9",
    "rankShort.10": "10",
    "rankShort.J": "J",
    "rankShort.Q": "Q",
    "rankShort.K": "K",
    "rankShort.A": "A",

    // What a screen reader reads on the card: "jack of hearts".
    "card.aria": "{rank} of {suit}",

    /* ─── Mađarice (Tell pattern) ───────────────────────────── */
    // Same engine `Suit`/`Rank`, different names — Bela is played with the
    // mađarice deck, so these are the default names at the table (the French
    // `suit.*`/`rank.*` stay for the French deck in settings). See game/DESIGN.md §2.1.
    "suitHu.HERC": "hearts",
    "suitHu.KARA": "bells",
    "suitHu.PIK": "leaves",
    "suitHu.TREF": "acorns",

    "rankHu.7": "seven",
    "rankHu.8": "eight",
    "rankHu.9": "nine",
    "rankHu.10": "ten",
    "rankHu.J": "jack",
    "rankHu.Q": "queen",
    "rankHu.K": "king",
    "rankHu.A": "ace",

    // Season shown on the Tell ace — aria label for the ace only.
    "season.HERC": "spring",
    "season.KARA": "summer",
    "season.PIK": "fall",
    "season.TREF": "winter",

    "card.ariaAce": "ace of {suit} ({season})",

    /* ─── Lobby (/igra) ─────────────────────────────────────── */
    "lobby.metaTitle": "Play Bela online — bela-turniri.com",
    "lobby.metaDescription": "Open a room, invite your crew or add bots, and play Bela right in your browser.",
    "lobby.title": "Play Bela",
    "lobby.subtitle": "Open a room and invite your crew — bots fill any empty seats.",
    "lobby.createRoom": "New room",
    "lobby.create": "Open room",
    "lobby.join": "Join",
    "lobby.target": "{target}",
    "lobby.playing": "In progress",
    "lobby.finishMode.prolaz": "Play out",
    "lobby.finishMode.dosta": "Cutoff",
    "lobby.private": "Private",
    "lobby.seats": "{taken}/{total} seats",
    "lobby.status.LOBBY": "Waiting for players",
    "lobby.status.PLAYING": "In progress",
    "lobby.status.FINISHED": "Finished",
    "lobby.empty.title": "No open rooms",
    "lobby.empty.description": "Be the first — open a room and start right away.",
    "lobby.form.name": "Room name",
    "lobby.form.namePlaceholder": "e.g. Friday night",
    "lobby.form.target": "Play to",
    "lobby.form.endRule": "End rule",
    "lobby.form.endRule.prolaz": "Play out",
    "lobby.form.endRule.dosta": "Cutoff",
    "lobby.form.private": "Private room",
    "lobby.form.minWinRate": "Win rate",
    "lobby.form.minWinRateNone": "No requirement",
    "lobby.form.moreOptions": "More options",
    "room.minWinRate": "At least {percent}% wins",
    "room.minWinRateShort": "≥ {percent}% wins",

    /* ─── Room (/igra/soba/:id) ─────────────────────────────── */
    "room.metaTitle": "Room {name} — Bela",
    "room.joining": "Joining room…",
    "room.backToLobby": "Back to lobby",
    "room.invite": "Copy link",
    "room.inviteCopied": "Link copied",
    "room.inviteCopyFailed": "Copy failed — here's the link",
    "room.sit": "Sit",
    "room.stand": "Stand",
    "room.addBot": "Bot",
    "room.removeBot": "Remove bot",
    "room.ready": "Ready",
    "room.readyOn": "Ready",
    "room.readyOff": "Ready",
    "room.seatsTaken": "{taken}/{total} seats taken",
    "room.start": "Start game",
    "room.waitingForHost": "Waiting for the host to start the game.",
    "room.emptySeatsFilled": "Bots will fill any empty seats.",
    "room.spectators": "Spectators",

    /* ─── Lobby/room v2 (bela.fun redesign, game/DESIGN.md §1/§2.9) ──
       New lobby (search bar, room code, dialogs) and room (seat rows, entry
       code). The old keys above stay — Seat.tsx and GameRoomPage.tsx still
       use them and we don't touch those. */
    "lobby.heading": "Games",
    "lobby.searchPlaceholder": "Search rooms…",
    "lobby.searchAria": "Search rooms",
    "lobby.newGame": "New game",
    "lobby.joinByCode": "Join with a code",
    "lobby.privateAria": "Private room",
    "lobby.enterAria": "Enter room {name}",
    "lobby.seatsAria": "{taken} of {total} seats taken",
    "lobby.create.title": "Set up your table",
    "lobby.create.targetAria": "Play to {target} points",
    "lobby.create.private": "Private game",
    "create.quick.name": "Quick 163",
    "create.quick.title": "Quick game",
    "create.quick.description": "Up to 3 deals, first dealer picked at random. The first pair to 163 points wins — if neither gets there, whoever has more after the third deal wins.",
    // Short label for the quick-play (163) discipline in tight stat pills —
    // the bare number "163" alone would not read as a discipline name the
    // way "501"/"701"/"1001" do, so it gets a word instead.
    "stats.quickLabel": "Quick",
    "lobby.joinByCode.title": "Join with a code",
    "lobby.joinByCode.description": "Enter the room's 4-digit code.",
    "lobby.joinByCode.privateTitle": "Enter game {name}",
    "lobby.joinByCode.privateDescription": "This game is private. Enter the code your friend sent you.",
    "lobby.joinByCode.codeLabel": "Room code",
    "lobby.joinByCode.codeAria": "Room code, 4 digits",
    "lobby.joinByCode.clearAria": "Clear all digits",
    "lobby.joinByCode.backspaceAria": "Delete last digit",
    "lobby.joinByCode.enteredAria": "Entered {count} of {total} digits",

    "room.label": "Game name",
    "room.codeLabel": "🔒 Entry code: {code}",
    "room.copyCode": "Copy code",
    "room.codeCopied": "Code copied",
    "room.codeCopyFailed": "Copy failed — here's the code",
    "room.leaveAria": "Leave the room",
    // Like the French symbols on the cards, "vs" stays the same in both
    // languages — it's a UI mark, not a word.
    "room.vs": "vs",
    "room.waitingSeat": "Open seat",
    // The "US"/"THEM" headings above the pairs are gone (sides are tied to
    // the host, same on every screen), so the grouping is now purely visual
    // — this gives it back to screen readers. Pair 1 is always the host's.
    "room.pairAria": "Pair {n}",
    "room.addBotCta": "Add bot",
    "room.launch": "Launch game",

    /* ─── Seat ──────────────────────────────────────────────── */
    "seat.empty": "Empty",
    "seat.dealer": "Dealer",
    "seat.dealerShort": "D",
    "seat.youSuffix": "{name} (you)",
    "seat.disconnected": "Disconnected",
    "seat.cardsInHand.one": "{n} card in hand",
    // `.two` is the Slovenian dual; Croatian never selects it, but it must
    // exist because `sl` types this file.
    "seat.cardsInHand.two": "{n} cards in hand",
    "seat.cardsInHand.few": "{n} cards in hand",
    "seat.cardsInHand.other": "{n} cards in hand",

    /* ─── Seat redesign (2026-09-08) ─────────────────────────────────────
       One seat anatomy on all four sides: an avatar with corner badges, a
       name pill, then one status chip. These three strings feed that chip
       and badge. "{n} s" is a seconds abbreviation (a unit, not a countable
       noun), so it deliberately has no plural. */
    "seat.onTurn": "On turn",
    "seat.secondsShort": "{n} s",
    "seat.calledTrump": "Calls trump: {suit}",

    /* ─── Trump call ────────────────────────────────────────── */
    "bidding.yourTurn": "Call trump",
    "bidding.waitingFor": "{name} is picking trump",
    "bidding.passedSoFar": "Passed: {names}",
    "bidding.callSuit": "Call {suit}",
    "bidding.pass": "Pass",
    // The dealer speaks last and can't pass ("forced call").
    "bidding.mustCall": "You must call",

    /* ─── Table ─────────────────────────────────────────────── */
    "table.caller": "calls",
    "table.holdsTrick": "Holds the trick",
    "table.trumpSet": "Trump is {suit}",
    "table.settings": "Game settings",
    "table.secondsLeft.one": "{n} second",
    "table.secondsLeft.two": "{n} seconds",
    "table.secondsLeft.few": "{n} seconds",
    "table.secondsLeft.other": "{n} seconds",
    "table.turnTimeLeft": "Time left to move: {seconds} s",

    // Status pill above the hand — who's on turn and what they're doing.
    "table.turnYou": "Your turn",
    "table.turnOther": "{name}'s turn",
    "table.turnCalling": "{name} is calling",
    "table.turnYourCall": "Call trump",
    "table.phaseBidding": "Trump call",
    "table.waiting": "Wait…",
    "table.spectatingIntro": "You're watching",
    "table.spectatorCount": "Spectators: {count}",

    // Quick reactions at the table (`chat.react` protocol).
    "table.reactions": "Reactions",
    "table.reactionsToggle": "Show reactions",
    "table.sendReaction": "Send reaction: {reaction}",
    "table.reaction.nicePlay": "Nicely played!",
    "table.reaction.lucky": "Fortune favors the bold!",
    "table.reaction.mistake": "Ohhh noo!",
    "table.reaction.angry": "Grrrrr!",
    "table.reaction.hurry": "Any slower? 🙄",
    "table.reaction.goodGame": "Good game, well played!",

    "table.trickCount.one": "{n} trick",
    "table.trickCount.two": "{n} tricks",
    "table.trickCount.few": "{n} tricks",
    "table.trickCount.other": "{n} tricks",

    /* ─── Hand ──────────────────────────────────────────────── */
    "hand.ariaLabel": "Your cards",
    "hand.empty": "You have no cards left",
    "hand.illegalPlay": "You can't play that card right now.",

    /* ─── Score ─────────────────────────────────────────────── */
    "score.us": "Us",
    "score.them": "Them",
    "score.target": "to {target}",
    "score.currentDeal": "+{points} points · {tricks}",
    "score.calledBy": "{name} calls",
    "score.history": "History",
    "score.historyTitle": "Deal history",
    // A spectator has no "own" team, so teams get whatever the protocol calls them.
    "score.teamA": "Team A",
    "score.teamB": "Team B",
    "score.col.deal": "#",
    "score.col.trump": "Trump",
    "score.col.caller": "Caller",
    "score.col.result": "Result",
    // Title on the small "+150" next to the deal's big number — tooltip/aria
    // only, the number itself carries the meaning. Includes bela (README §2).
    "score.declarationBonus": "Declarations",

    /* ─── Declarations ──────────────────────────────────────── */
    "declarations.title": "Declarations",
    "declarations.none": "No one has declarations.",
    // Empty tab when US/THEM is tapped for a pair with no declarations
    // (2026-09-20, user request: separate tabs per pair instead of mixed rows).
    "declarations.noneForTeam": "No declarations",
    "declarations.bela": "Bela +20",

    "bela.title": "Bela!",
    "bela.by": "{name} calls",
    "trump.calledBy": "{name} calls {suit}",
    // Calling bela is a CHOICE (game/README.md §1.4): asked once, when the
    // first K/Q of trump is played. Declining holds for the whole deal.
    "bela.ask": "Call bela?",
    "bela.askYes": "Yes",
    "bela.askNo": "No",

    "belot.title": "BELOT!",

    "belot.congrats": "Congratulations!",
    "belot.by": "All eight cards — {suit}",
    "belot.wins": "The game is won instantly",

    /* ─── End of deal ───────────────────────────────────────── */
    "deal.summaryTitle": "Deal {n}",
    "deal.cardPoints": "Points from cards",
    "deal.declarationPoints": "Declarations",
    "deal.awarded": "Awarded",
    "deal.passed": "Made it",
    "deal.fell": "Fell",
    "deal.wePassed": "We made it",
    "deal.weFell": "We went down",
    "deal.theyPassed": "They made it",
    "deal.theyFell": "They went down",
    "deal.stigljaUs": "Capot for us (+90)",
    "deal.stigljaThem": "Capot for them (+90)",
    "deal.fallExplained": "The team that called didn't make it, so all the deal's points go to their opponents.",
    "deal.next": "Next deal",
    "deal.waitingForNext": "Waiting for the next deal…",

    /* ─── End of game ───────────────────────────────────────── */
    "over.youWon": "You won!",
    "over.youLost": "Defeat",
    "over.wonDescription": "Nice, looks like you're a true Bela master!",
    "over.lostDescription": "Better luck next time!",
    "over.finished": "The game has ended.",
    "over.belotDescription": "{name} took all eight cards of one suit and won the game instantly.",
    "over.backToLobby": "Back to lobby",
    "over.newGame": "New game",
    "over.finalScore": "Final score",

    /* ─── Chat ──────────────────────────────────────────────── */

    /* ─── Errors (codes from @bela/protocol) ────────────────── */
    "error.UNAUTHENTICATED": "Sign in to play.",
    "error.ROOM_NOT_FOUND": "This room no longer exists.",
    "error.ROOM_FULL": "The room is full.",
    "error.WIN_RATE_TOO_LOW": "Joining requires at least {percent}% wins.",
    "error.ROOM_CODE_REQUIRED": "A code is required to join a private room.",
    "error.SPECTATORS_DISABLED": "This game doesn't allow spectators.",
    "error.SEAT_TAKEN": "That seat is taken.",
    "error.NOT_HOST": "Only the host can do that.",
    "error.NOT_IN_ROOM": "You're not in that room.",
    "error.NOT_YOUR_TURN": "It's not your turn.",
    "error.ILLEGAL_MOVE": "That move isn't allowed.",
    "error.RATE_LIMITED": "Slow down a bit — too many messages.",
    "error.BAD_REQUEST": "Something's wrong with the request.",
    "error.ALREADY_STARTED": "The game has already started.",
    "error.NOT_ENOUGH_PLAYERS": "Not enough players.",

    /* ─── Mock server (dev only, /igra?mock=1) ──────────────── */
    "mock.youName": "You",
    "mock.otherName": "Host",
    "mock.botName": "Bot {n}",
    "mock.roomName": "Demo room",

    /* ─── Game settings (game/DESIGN.md §2.10) ──────────────── */
    /* Title of the block at the top of "Game settings": ROOM settings,
       editable until the game starts and only by the host (game/README.md §3). */
    "settings.thisGame": "This game's settings",
    "settings.title": "Game settings",
    "settings.sound": "Sound",
    "settings.reduceMotion": "Reduce animations",
    "settings.reduceMotionHint": "Also follows your system's reduced-motion setting.",
    "settings.keepAwake": "Keep screen on",
    "settings.deckType": "Card deck",
    /* Four decks (2026-09-20): three are mađarice and differ only in
       artwork — the registry is in game/util/cards.ts, the ids are what's
       stored in localStorage. */
    "settings.deck.klasicne": "Classic",
    "settings.deck.moderne": "Modern",
    "settings.deck.vektorske": "Vector",
    "settings.deck.francuske": "French",
    "settings.recommended": "Recommended",
    "common.close": "Close",

    /* ─── Room rules — unmissable badges + confirmation (RoomPanel/CreateGameDialog) ──
       "No declarations" / "No bela" have to be clear to everyone at the
       table, not just the host, and the host must see a summary of the
       choices before creating the room. */
    "room.spectatingFull": "All seats are taken — you're watching until one opens up.",

    /* ─── Seat hold, active room, return (game/README.md §3) ──────────────
       ADDED AT THE END — don't move or delete the keys above. */
    "active.holdLeft": "Your seat is held for {time} more",
    "active.holdNone": "Your seat is still yours.",
    "active.resume": "Return to the game",
    "active.leave": "Leave the game",
    "active.leaveNow": "Leave",
    "active.leaveConfirm.title": "Leave the game?",
    "active.leaveConfirm.body": "You immediately lose your seat, a bot takes over, and you can't return to this game. You also lose 1 karma point (unless only bots were left at the table).",
    "active.leaveConfirm.confirm": "Leave the game",
    "active.leaveConfirm.cancel": "Stay",
    "active.seatBadge": "Your seat",
    "active.status.LOBBY": "Waiting to start",
    "active.status.PLAYING": "Game in progress",
    "active.status.FINISHED": "Finished",

    "reconnect.title": "Connection lost",
    "reconnect.hold": "Your seat is held for {time} more",
    "reconnect.retrying": "Trying to reconnect…",
    "reconnect.restored": "You're reconnected and back at the table",
    "phase.dealt": "The first six cards have been dealt",
    "phase.dealtHint": "Check your cards before calling trump",
    "phase.declarations": "Checking declarations",

    "exit.title": "Leave the table?",
    "exit.description": "If you stay, you keep playing. If you leave, a two-minute countdown starts; you can return before it runs out. If you don't return, a bot takes your seat and you lose 1 karma point.",
    "exit.descriptionLobby": "If you leave, you exit the room immediately and your seat is freed.",
    "exit.stay": "Stay in the room",
    "exit.leave": "Leave the room",

    "missedTurn.title": "You missed your turn",
    "missedTurn.body": "Time ran out, so the move was played for you.",
    "missedTurn.back": "Return to the game",

    "widget.title": "Active room",
    "widget.return": "Return",
    "widget.leave": "Leave",
    "widget.collapse": "Collapse",
    "widget.expand": "Expand",
    "widget.dismiss": "Dismiss",

    /* ─── Compact "Private game" + "Ready" row (RoomPanel, mobile layout) ──
       ADDED AT THE END — don't move or delete the keys above. */
    "room.privateGameShort": "Private",

    /* ─── Scoreboard facing the right way + one dialog at game end ────────
       (game/README.md §1.7, §2 — the big number is the current deal's
       points, the match total sits a little below)
       ADDED AT THE END — don't move or delete the keys above. */
    "score.matchTotal": "total {total}",
    "over.dismiss": "OK",

    /* ─── Trick review (game/README.md §1.8) ─────────────────────────────
       A THREE-state room setting, chosen when the room is opened and
       applying to the whole room. The middle state is the pair LEADING the
       trick — never "whoever is on turn".
       ADDED AT THE END — don't move or delete the keys above. */
    "rules.trickReview": "Trick review",
    "rules.trickReview.off": "Off",
    "rules.trickReview.leaderPair": "Pair on lead",
    "rules.trickReview.all": "Everyone",
    /* Faces of the three-way switch in "New game" — the full sentence above
       remains each button's accessible name, this is just what fits on the row. */
    "rules.trickReviewShort.off": "No",
    "rules.trickReviewShort.leaderPair": "On lead",
    "rules.trickReviewShort.all": "All",
    "rules.trickReviewBadge.off": "No trick review",
    "rules.trickReviewBadge.leaderPair": "Trick review for the pair on lead",
    "rules.trickReviewBadge.all": "Trick review for everyone",

    "tricks.title": "Tricks",
    "tricks.open": "View played tricks",
    "tricks.trickNo": "Trick {n}",
    "tricks.ledBy": "Led by {name}",
    "tricks.wonBy": "Won by {name}",
    "tricks.empty": "No tricks played yet.",
    "tricks.hiddenOff": "Trick review is off in this room.",
    "tricks.hiddenLeaderPair": "Only the pair that led the current trick can review it.",

    /* ─── One game at a time (game/README.md §3.2) ───────────────────────── */
    "error.ALREADY_IN_GAME": "You already have a seat in another game. Return to the table or leave it.",
    "lobby.blockedByActive": "You already have a game in progress. Return to the table or wait for the countdown to end.",
    "lobby.blockedRoom": "You can't join — you already have an active game.",

    /* ─── "Coming soon" (src/game/GameComingSoonPage.tsx) ─────────────────
       What /igra shows while the production kill switch is off
       (ops/toggle-game.sh). "Play" is now always in the nav, so this page
       has to explain on its own why there's no game yet. No countdown and
       no date — we don't know when the switch flips.
       ADDED AT THE END — don't move or delete the keys above. */
    "comingSoon.metaTitle": "Play Bela — coming soon — bela-turniri.com",
    "comingSoon.metaDescription": "Bela Online is in the works. Tournaments, the calendar, the map and the score pad work as usual.",
    "comingSoon.label": "Bela Online",
    "comingSoon.title": "Play Bela — coming soon",
    "comingSoon.description": "We're still working on Bela Online. Until it's ready, everything else works as usual — tournaments, the calendar, the map and the score pad.",
    "comingSoon.backToTournaments": "Go to tournaments",
    "comingSoon.openBlok": "Open the score pad",

    /* ─── Who's in the room + full room (game/README.md §3 "Lobby", §3.2) ──
       The lobby row now shows the actual occupants (`RoomSummary.occupants`),
       and a room with no open seat and no spectators refuses entry up front
       (`RoomSummary.joinable`) instead of quietly turning you into a
       spectator.
       ADDED AT THE END — don't move or delete the keys above. */
    "lobby.full": "Full",
    "lobby.fullBlocked": "The room is full — no open seats.",
    "lobby.emptySeat": "Open seat",
    "lobby.occupantsAria": "At the table: {names}",
    "lobby.freeSeats.one": "{n} seat left",
    // `.two` is the Slovenian dual; Croatian never selects it, but it must
    // exist because `sl` types this file.
    "lobby.freeSeats.two": "{n} seats left",
    "lobby.freeSeats.few": "{n} seats left",
    "lobby.freeSeats.other": "{n} seats left",
    "lobby.spectateHint": "All seats are taken — you can watch.",
    "room.sitHere": "Sit here",

    /* ─── HUD v3 at the table (game/DESIGN.md §6) ─────────────────────────
       The scoreboard now has a progress bar toward the game's target; that
       bar also carries the "to 1001", so the old footer line is gone. The
       bar is only 2 px tall, so it needs a speakable version — this key is
       its `aria-label`, never visible text.
       ADDED AT THE END — don't move or delete the keys above. */
    "score.progress": "Total {total} of {target}",

    /* ─── Lobby filters (2026-09-21, user request) ────────────────────────
       The search bar shares a row with chips: "Has seats" (only rooms
       waiting for players with an open seat) and the target point count.
       The number itself (501/701/1001) isn't a word so it isn't translated
       — only what the screen reader reads is translated.
       ADDED AT THE END — don't move or delete the keys above. */
    "lobby.filter.hasSeats": "Has seats",
    "lobby.filter.targetAria": "Show only games to {target} points",
    "lobby.filter.public": "Public",
}
