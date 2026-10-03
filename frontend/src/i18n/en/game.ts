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
    "karma.explain": "Karma shows how often you leave games and how much your table-mates can count on you to play a game to the end. It runs from 0 to {max}; everyone starts at {max}. Each time you abandon a running game (you do not come back within the return time, and the table was not just bots) costs 1 point for {window}, then it drops off by itself. Playing does not raise karma — not leaving is enough. Karma is visible to the players you sit with.",
    "karma.tier.good": "Reliable",
    "karma.tier.fair": "Sometimes leaves",
    "karma.tier.poor": "Often leaves",
    "karma.tierHint.good": "Almost always plays a game to the end. Table-mates can count on you.",
    "karma.tierHint.fair": "Has left a few games recently. Table-mates can see that — play to the end and the score recovers by itself.",
    "karma.tierHint.poor": "Often leaves running games. Hard for table-mates to rely on; the score recovers by itself once games are played to the end.",
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
    // Promo instead of a spectator's empty hand (2026-09-29, user request).
    "table.spectatorPromoTitle": "Play your own bela",
    "table.spectatorPromoSubtitle": "Free, online, with friends or with bots.",
    "table.spectatorPromoCta": "Play Bela",

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
    "exit.description": "If you leave, you lose your seat at once — a bot takes it and you can't come back to this game. You also lose 1 karma point (unless only bots are left at the table).",
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

    /* ─── Banner pointing at bela.games (2026-09-23) ───────────────────────
       ADDED AT THE END — don't move or delete the keys above. */
    "gamesSite.title": "Bela Online has its own site",
    "gamesSite.titleShort": "Play online at bela.games",
    "gamesSite.subtitle":
        "Play Bela online with friends or bots at bela.games — no account needed, in the browser and on your phone.",
    "gamesSite.cta": "Switch to bela.games",
    "gamesSite.ctaShort": "bela.games",

    /* ─── "Learn to play Bela" (2026-09-29) ───────────────────────────────
       Lessons and the practice game at /igra/ucenje. Card and suit names
       arrive as parameters — see the Croatian source for the rules.
       APPENDED AT THE END. */
    "learn.title": "Learn to play Bela",
    "learn.metaTitle": "Learn to play Bela — lessons and a practice game",
    "learn.metaDescription": "Learn Bela step by step: suits, card strength, trump, declarations and scoring, then play a practice game against bots.",
    "learn.settingsRow": "Learn to play Bela",
    "learn.settingsRowHint": "Short lessons and a practice game against bots.",
    "learn.prompt.title": "Do you know how to play Bela?",
    "learn.prompt.body": "If not, we'll teach you in a few minutes, and then there's a practice game against bots.",
    "learn.prompt.learn": "I want to learn",
    "learn.prompt.knows": "I know, let's play",
    "learn.prompt.later": "The lessons are always there in the game settings.",
    "learn.progress": "Lesson {n} of {total}",
    "learn.back": "Back",
    "learn.next": "Next",
    "learn.toPractice": "Practice game",
    "learn.skipToPractice": "Skip to the game",
    "learn.exit": "Leave the tutorial",
    "learn.nextTask": "Next task",
    "learn.check": "Check",
    "learn.trumpIs": "Trump",
    "learn.strongestFirst": "Strongest to weakest",
    "learn.seat.you": "You",
    "learn.seat.partner": "Partner",
    "learn.seat.right": "Right opponent",
    "learn.seat.left": "Left opponent",
    "learn.points.one": "{n} point",
    "learn.points.two": "{n} points",
    "learn.points.few": "{n} points",
    "learn.points.other": "{n} points",
    "learn.suits.title": "The four suits",
    "learn.suits.intro": "Bela is played with 32 cards: four suits of eight. Each suit goes by two names.",
    "learn.suits.start": "Try it",
    "learn.suits.task": "Tap: {suit}",
    "learn.suits.right": "Right, that's {suit}.",
    "learn.suits.wrong": "That's {tapped}. We're looking for: {target}.",
    "learn.suits.done": "You know all four suits.",
    "learn.plain.title": "Card strength in an ordinary suit",
    "learn.plain.intro": "The cards are in number order. Sort them by strength in an ordinary suit — one that isn't trump.",
    "learn.plain.natural": "By number",
    "learn.plain.sort": "Sort by strength",
    "learn.plain.ordered": "Ordinary suit: the strongest card is the {ace} ({acePoints}), then the {ten} ({tenPoints}). In trump the order is different — that's the next lesson.",
    "learn.trick.task": "Which card takes the trick?",
    "learn.trick.wrongOffSuit": "That card isn't in the suit that was led, so it can't take the trick.",
    "learn.trick.wrongTrumpWins": "A trump beats any card of another suit.",
    "learn.trick.wrongWeaker": "There's a stronger card of the same suit on the table.",
    "learn.trump.title": "Card strength in trump",
    "learn.trump.intro": "The same cards, ordered as an ordinary suit. Watch what happens when that suit becomes trump.",
    "learn.trump.makeTrump": "Make it trump",
    "learn.trump.ordered": "In trump the {jack} ({jackPoints}) and the {nine} ({ninePoints}) jump to the top. The rest keep their order.",
    "learn.follow.title": "What you may play",
    "learn.legal.task": "Which cards may you play?",
    "learn.legal.more": "Right. There are more cards you may play.",
    "learn.follow.rule.suit": "You hold the suit that was led — you must follow it.",
    "learn.follow.rule.over": "You hold a stronger card of that suit — you must beat the one on the table.",
    "learn.follow.rule.trump": "You have none of that suit but you do hold a trump — you must trump.",
    "learn.follow.rule.overtrump": "A trump is already on the table — you must play a higher one if you have it.",
    "learn.follow.rule.free": "You have neither the suit nor a trump — you may throw anything.",
    "learn.illegal.followSuit": "You must follow suit.",
    "learn.illegal.mustOvertake": "You hold a stronger card of that suit — you must beat the one on the table.",
    "learn.illegal.mustTrump": "You have none of that suit — you must trump.",
    "learn.illegal.mustOvertrump": "You must play a higher trump.",
    "learn.bid.title": "Calling trump",
    "learn.bid.step.first": "You hold six cards and speak first.",
    "learn.bid.step.weak": "The player before you passed. Now it's your call.",
    "learn.bid.step.forced": "Everyone passed and you are the dealer. That's the forced call: you must name a suit.",
    "learn.bid.task": "What do you say?",
    "learn.bid.other": "That works too. Tip: {advice}",
    "learn.bid.forcedAny": "Forced call made. Tip: {advice}",
    "learn.bidWhy.pass": "Pass: the bot would not call on these cards.",
    "learn.bidWhy.forced": "Forced — you must call.",
    "learn.bidWhy.jackAndNine": "Call {suit}: you hold the jack and the nine, the two strongest trumps.",
    "learn.bidWhy.jack": "Call {suit}: you hold the jack, the strongest trump.",
    "learn.bidWhy.nine": "Call {suit}: you hold the nine, the second strongest trump.",
    "learn.bidWhy.length": "Call {suit}: you hold at least three cards of it.",
    "learn.bidWhy.plain": "Call {suit} — that's the suit the bot would call.",
    "learn.play.onlyCard": "The only card you may play.",
    "learn.play.leadTrump": "Lead a trump — draw the trumps.",
    "learn.play.leadAce": "Lead the ace.",
    "learn.play.leadLow": "Lead a small card that is worth no points.",
    "learn.play.lead": "Lead this card.",
    "learn.play.ruff": "Trump it and take the trick.",
    "learn.play.takeCheap": "Take the trick with the weakest card that wins it.",
    "learn.play.take": "Take the trick.",
    "learn.play.feedPartner": "Your partner takes the trick: load it with points.",
    "learn.play.partnerHolds": "Your partner holds the trick — no need to take it over.",
    "learn.play.cantWinLow": "You can't take the trick — throw the card worth the least.",
    "learn.play.cantWin": "You can't take this trick.",
    "learn.play.saveStrong": "Let this trick go — the card that would win it stays in your hand.",
    "learn.note.bid": "Call trump or pass.",
    "learn.note.forced": "Forced call: everyone passed, you must name a suit.",
    "learn.note.lead": "You lead the trick — any card may be played.",
    "learn.note.limited": "Dimmed cards can't be played. Tap one to see why.",
    "learn.note.free": "You may play any card.",
    "learn.note.weCalled": "Your pair called: you must collect more points than the opponents.",
    "learn.note.theyCalled": "The opponents called: they go down if you collect at least as much as they do.",
    "learn.note.belaUs": "Bela (king and queen of trump): 20 points for you.",
    "learn.note.belaThem": "Bela (king and queen of trump): 20 points for the opponents.",
    "learn.note.ownLost": "Your declaration doesn't count — the opponents hold a stronger one.",
    "learn.decl.title": "Declarations",
    "learn.decl.intro": "A run goes 7, 8, 9, 10, {jack}, {queen}, {king}, {ace}. Only the pair with the strongest declaration scores.",
    "learn.decl.value.seq3": "Three in a row",
    "learn.decl.value.seq4": "Four in a row",
    "learn.decl.value.seq5": "Five or more in a row",
    "learn.decl.value.four": "Four of a kind: {ace}, {ten}, {king} or {queen}",
    "learn.decl.value.fourNines": "Four of a kind: {nine}",
    "learn.decl.value.fourJacks": "Four of a kind: {jack}",
    "learn.decl.value.bela": "Bela: {king} and {queen} of trump",
    "learn.decl.task.find": "Find the declaration in this hand",
    "learn.decl.task.compare": "Which declaration is stronger?",
    "learn.decl.task.bela": "Find the bela",
    "learn.decl.found": "{name} — {points}.",
    "learn.decl.name.seq3": "Three in a row",
    "learn.decl.name.seq4": "Four in a row",
    "learn.decl.name.seq5": "Five or more in a row",
    "learn.decl.name.four": "Four of a kind",
    "learn.decl.hintSeq.one": "Look for {n} card of one suit in a row.",
    "learn.decl.hintSeq.two": "Look for {n} cards of one suit in a row.",
    "learn.decl.hintSeq.few": "Look for {n} cards of one suit in a row.",
    "learn.decl.hintSeq.other": "Look for {n} cards of one suit in a row.",
    "learn.decl.hintFour": "Look for four of a kind, one from each suit.",
    "learn.decl.why.points": "The declaration worth more points is stronger.",
    "learn.decl.why.four": "At equal points, four of a kind beats a run.",
    "learn.decl.why.higher": "Between equal runs, the one reaching the higher card is stronger.",
    "learn.decl.belaFound": "Bela: the king and queen of trump — 20 points, whoever holds the stronger declarations.",
    "learn.decl.belaHint": "The bela is the {king} and the {queen} of the trump suit.",
    "learn.score.title": "Scoring",
    "learn.score.intro": "Points are counted from the cards in the tricks you win. The pair that called trump must collect MORE than the opponents.",
    "learn.score.q.fall": "Your pair called trump. This is what the tricks brought.",
    "learn.score.q.declaration": "Your pair called. The tricks brought less, but you also hold a declaration.",
    "learn.score.q.stiglja": "Your pair took all eight tricks — a capot.",
    "learn.score.withDeclaration": "cards {cards} + declaration {points}",
    "learn.score.task.verdict": "Did you make it or go down?",
    "learn.score.compare": "Compare the totals: the pair that called must have more than the opponents.",
    "learn.score.fell": "You went down: {us} is not more than {them}, so all {total} go to the opponents.",
    "learn.score.passed": "You made it: the declaration counts with the cards. The score is {us} : {them}.",
    "learn.score.stigljaHint": "The cards bring {deal}. A capot adds its bonus on top.",
    "learn.practice.title": "Practice game",
    "learn.practice.deal": "Deal {n} of {max}",
    "learn.practice.hint": "Hint",
    "learn.practice.over": "That was a whole game of Bela. A real table is waiting.",
    "learn.practice.again": "Play again",
    "learn.practice.lessons": "Lessons from the start",
    "learn.practice.playOnline": "Play online",

    /* Rework 2026-09-29 (owner tried the first version): every lesson shows
       worked examples before it asks; suits carry both names; ranks are the
       plain words (dečko, dama, kralj, as), never the deck's. */
    "learn.suitShort.HERC": "hearts",
    "learn.suitShort.KARA": "diamonds",
    "learn.suitShort.PIK": "spades",
    "learn.suitShort.TREF": "clubs",
    "learn.suitBoth.HERC": "Hearts",
    "learn.suitBoth.KARA": "Diamonds or bells",
    "learn.suitBoth.PIK": "Spades or leaves",
    "learn.suitBoth.TREF": "Clubs or acorns",
    "learn.exampleOf": "Example {n} of {total}",
    "learn.taskOf": "Task {n} of {total}",
    "learn.nextExample": "Next example",
    "learn.prevExample": "Previous",
    "learn.toTasks": "On to the tasks",
    "learn.review": "See the examples again",
    "learn.trump.asPlain": "As an ordinary suit",
    "learn.compare.line": "Stronger: {strong} ({strongPoints}). Weaker: {weak} ({weakPoints}).",
    "learn.pair.task": "Which card is stronger?",
    "learn.pair.answer": "The stronger card is the {card}.",
    "learn.worth.task": "How many points is this card worth?",
    "learn.worth.right": "{card}: {points}.",
    "learn.worth.less": "Less than that. Try again.",
    "learn.worth.more": "More than that. Try again.",
    "learn.trick.title": "The trick",
    "learn.trick.intro": "A trick: everyone plays one card. The first card sets the suit. The strongest card of that suit takes it — or a trump.",
    "learn.trickWhy.highestOfLed": "The {card} takes it: the strongest card of the suit led ({suit}).",
    "learn.trickWhy.trumpBeats": "The {card} takes it: a trump beats every other suit.",
    "learn.trickWhy.highestTrump": "The {card} takes it: trump was led and this is the strongest trump on the table.",
    "learn.trickWhy.stray": "A card of another suit cannot take the trick, however big it is.",
    "learn.table.led": "Suit led",
    "learn.table.first": "First",
    "learn.table.firstCard": "The first card of the trick.",
    "learn.table.aria": "Cards on the table",
    "learn.follow.intro": "Once a trick is led you can't throw just anything. The lit cards are the ones you may play.",
    "learn.legal.yourHand": "Your cards",
    "learn.bid.intro": "Whoever calls a suit first sets trump — and their pair must then collect more points than the opponents.",
    "learn.bid.whatToCall": "Call the suit where you hold the jack and the nine, or several cards. Aces in other suits help.",
    "learn.bid.call": "Call",
    "learn.bidWhy.passNoTop": "Pass: you hold neither a jack nor a nine.",
    "learn.bidWhy.passShort": "Pass: your jack or nine has too few cards of its suit beside it.",
    "learn.bidWhy.count.one": "You hold {n} card of that suit.",
    "learn.bidWhy.count.two": "You hold {n} cards of that suit.",
    "learn.bidWhy.count.few": "You hold {n} cards of that suit.",
    "learn.bidWhy.count.other": "You hold {n} cards of that suit.",
    "learn.play.signalDiscard": "Throw from the suit where you hold nothing; keep your aces for your own tricks.",
    "learn.score.weCalled": "Your pair called trump.",
    "learn.score.row.allCards": "Points in all the cards",
    "learn.score.row.lastTrick": "Last trick",
    "learn.score.row.deal": "Total in a deal",
    "learn.score.row.cards": "Cards (us : them)",
    "learn.score.row.declaration": "Our declaration",
    "learn.score.row.collected": "Collected",
    "learn.score.row.stiglja": "Capot",
    "learn.score.row.written": "Written down",
    "learn.score.ex.total": "Every deal is worth {total} points. Declarations are added on top.",
    "learn.score.ex.passed": "{us} is more than {them}: you made it. Each pair writes down what it collected.",
    "learn.score.ex.equal": "{us} : {them} is not enough, it takes MORE than the opponents. You go down: all {total} go to them.",
    "learn.score.ex.declaration": "A declaration is added to the cards: {us} is more than {them}, you made it.",
    "learn.score.ex.stiglja": "A capot is all eight tricks: the cards bring {deal}, the capot adds {bonus}. {total} is written down.",
    "learn.score.task.written": "How much is written down for a capot?",
}
