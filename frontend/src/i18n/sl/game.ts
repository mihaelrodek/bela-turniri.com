import type { GameDict } from "../hr/game"

/* Slovenski `game`. Tipiziran kot hrvaški namespace, tako da izpuščen ali
   napačno zapisan ključ pade na `tsc` in ne šele v teku.

   Register: neformalna druga oseba, kot v ostalih namespacih. Slovenščina
   ima dvojino, zato imajo števne družine tu tudi `.two` — hrvaščina je nima
   in pade nazaj na `.other` po zasnovi (glej `translatePlural`). */

export const game: GameDict = {
    /* ─── Navigacija ────────────────────────────────────────── */
    "nav.igraj": "Igraj",

    /* ─── Skupno ────────────────────────────────────────────── */
    "common.cancel": "Prekliči",

    /* ─── Stanje povezave ───────────────────────────────────── */
    "connection.connecting": "Povezovanje…",
    "connection.open": "Povezano",
    "connection.closed": "Povezava je prekinjena — poskušam znova",

    /* ─── Barve in vrednosti kart ───────────────────────────── */
    "suit.HERC": "srce",
    "suit.KARA": "karo",
    "suit.PIK": "pik",
    "suit.TREF": "križ",

    "rank.7": "sedmica",
    "rank.8": "osmica",
    "rank.9": "devetka",
    "rank.10": "desetka",
    "rank.J": "fant",
    "rank.Q": "dama",
    "rank.K": "kralj",
    "rank.A": "as",

    "rankShort.7": "7",
    "rankShort.8": "8",
    "rankShort.9": "9",
    "rankShort.10": "10",
    "rankShort.J": "J",
    "rankShort.Q": "Q",
    "rankShort.K": "K",
    "rankShort.A": "A",

    "card.aria": "{rank} {suit}",

    /* ─── Madžarske karte (Tell vzorec) ─────────────────────── */
    "suitHu.HERC": "srce",
    "suitHu.KARA": "zvonec",
    "suitHu.PIK": "zelena",
    "suitHu.TREF": "želod",

    "rankHu.7": "sedmica",
    "rankHu.8": "osmica",
    "rankHu.9": "devetka",
    "rankHu.10": "desetka",
    "rankHu.J": "spodnji",
    "rankHu.Q": "zgornji",
    "rankHu.K": "kralj",
    "rankHu.A": "as",

    "season.HERC": "pomlad",
    "season.KARA": "poletje",
    "season.PIK": "jesen",
    "season.TREF": "zima",

    "card.ariaAce": "as {suit} ({season})",

    /* ─── Predsoba (/igra) ──────────────────────────────────── */
    "lobby.metaTitle": "Igraj belo online — bela-turniri.com",
    "lobby.metaDescription": "Odpri sobo, povabi ekipo ali dodaj bote in igraj belo kar v brskalniku.",
    "lobby.title": "Igraj belo",
    "lobby.subtitle": "Odpri sobo in povabi ekipo — prazne sedeže zapolnijo boti.",
    "lobby.createRoom": "Nova soba",
    "lobby.create": "Odpri sobo",
    "lobby.join": "Vstopi",
    "lobby.target": "do {target}",
    "lobby.private": "Zasebna",
    "lobby.seats": "{taken}/{total} sedežev",
    "lobby.status.LOBBY": "Čaka igralce",
    "lobby.status.PLAYING": "V teku",
    "lobby.status.FINISHED": "Končano",
    "lobby.empty.title": "Ni odprtih sob",
    "lobby.empty.description": "Bodi prvi — odpri sobo, dodaj bote in začni takoj.",
    "lobby.form.name": "Ime sobe",
    "lobby.form.namePlaceholder": "npr. Petek zvečer",
    "lobby.form.target": "Igra se do",
    "lobby.form.private": "Zasebna soba",
    "lobby.form.privateHint": "Zasebna soba ni prikazana v predsobi — vstopi se le prek povezave.",

    /* ─── Soba (/igra/soba/:id) ─────────────────────────────── */
    "room.metaTitle": "Soba {name} — bela",
    "room.joining": "Vstopam v sobo…",
    "room.backToLobby": "Nazaj v predsobo",
    "room.leave": "Izstopi",
    "room.invite": "Kopiraj povezavo",
    "room.inviteCopied": "Povezava je kopirana",
    "room.inviteCopyFailed": "Kopiranje ni uspelo — tukaj je povezava",
    "room.sit": "Sedi",
    "room.stand": "Vstani",
    "room.addBot": "Bot",
    "room.removeBot": "Odstrani bota",
    "room.ready": "Pripravljen",
    "room.readyOn": "Pripravljen si",
    "room.readyOff": "Označi, da si pripravljen",
    "room.seatsTaken": "{taken}/{total} sedežev zasedenih",
    "room.start": "Začni igro",
    "room.waitingForHost": "Čaka se, da gostitelj zažene igro.",
    "room.emptySeatsFilled": "Prazne sedeže bodo zapolnili boti (srednje).",
    "room.spectators": "Gledalci",

    /* ─── Predsoba/soba v2 (bela.fun redizajn, game/DESIGN.md §1/§2.9) ─── */
    "lobby.heading": "Igre",
    "lobby.searchPlaceholder": "Išči sobe…",
    "lobby.searchAria": "Išči sobe",
    "lobby.newGame": "Nova igra",
    "lobby.joinByCode": "Pridruži se s kodo",
    "lobby.privateAria": "Zasebna soba",
    "lobby.enterAria": "Vstopi v sobo {name}",
    "lobby.seatsAria": "{taken} od {total} mest zasedenih",
    "lobby.create.title": "Do koliko se igra?",
    "lobby.create.targetAria": "Igraj do {target} točk",
    "lobby.create.private": "Zasebna igra",
    "lobby.joinByCode.title": "Pridruži se s kodo",
    "lobby.joinByCode.description": "Vpiši 4-mestno kodo sobe.",
    "lobby.joinByCode.codeLabel": "Koda sobe",
    "lobby.joinByCode.codeAria": "Koda sobe, 4 mesta",

    "room.label": "Ime igre",
    "room.codeLabel": "🔒 Koda za vstop: {code}",
    "room.copyCode": "Kopiraj kodo",
    "room.codeCopied": "Koda je kopirana",
    "room.codeCopyFailed": "Kopiranje ni uspelo — tukaj je koda",
    "room.leaveAria": "Zapusti sobo",
    "room.vs": "vs",
    "room.waitingSeat": "čakam…",
    "room.addBotCta": "Dodaj bota",
    "room.launch": "Zaženi igro",
    "room.launchHint": "Čaka se, da so vsi pripravljeni.",

    /* ─── Sedež ─────────────────────────────────────────────── */
    "seat.empty": "Prazno",
    "seat.dealer": "Delilec",
    "seat.dealerShort": "D",
    "seat.youSuffix": "{name} (ti)",
    "seat.disconnected": "Ni povezan",
    "seat.cardsInHand.one": "{n} karta v roki",
    "seat.cardsInHand.two": "{n} karti v roki",
    "seat.cardsInHand.few": "{n} karte v roki",
    "seat.cardsInHand.other": "{n} kart v roki",

    /* ─── Boti ──────────────────────────────────────────────── */
    "bot.level.lako": "Lahko",
    "bot.level.srednje": "Srednje",
    "bot.level.tesko": "Težko",

    /* ─── Klicanje aduta ────────────────────────────────────── */
    "bidding.yourTurn": "Kliči adut",
    "bidding.waitingFor": "{name} izbira adut",
    "bidding.passedSoFar": "Naprej: {names}",
    "bidding.callSuit": "Kliči {suit}",
    "bidding.pass": "Naprej",
    "bidding.mustCall": "Moraš klicati",

    /* ─── Miza ──────────────────────────────────────────────── */
    "table.caller": "kliče",
    "table.trumpSet": "Adut je {suit}",
    "table.autoPlayed": "Bot je odigral namesto igralca",
    "table.settings": "Nastavitve igre",
    "table.secondsLeft.one": "{n} sekunda",
    "table.secondsLeft.two": "{n} sekundi",
    "table.secondsLeft.few": "{n} sekunde",
    "table.secondsLeft.other": "{n} sekund",

    // Statusna tablica nad roko — kdo je na vrsti in kaj počne.
    "table.turnYou": "Ti si na vrsti",
    "table.turnOther": "{name} je na vrsti",
    "table.turnCalling": "{name} kliče",
    "table.turnYourCall": "Kliči adut",
    "table.phaseBidding": "Klicanje aduta",
    "table.waiting": "Počakaj…",
    "table.spectating": "Gledaš igro",

    // Emoji reakcije (protokol `chat.react`).
    "table.reactions": "Reakcije",
    "table.sendReaction": "Pošlji reakcijo {emoji}",

    "table.trickCount.one": "{n} štih",
    "table.trickCount.two": "{n} štiha",
    "table.trickCount.few": "{n} štihi",
    "table.trickCount.other": "{n} štihov",

    /* ─── Roka ──────────────────────────────────────────────── */
    "hand.ariaLabel": "Tvoje karte",
    "hand.empty": "Nimaš več kart",

    /* ─── Rezultat ──────────────────────────────────────────── */
    "score.us": "Mi",
    "score.them": "Oni",
    "score.target": "do {target}",
    "score.dealNo": "{n}. delitev",
    "score.calledBy": "kliče {name}",
    "score.tricks": "štihi {us}:{them}",
    "score.history": "Zgodovina",
    "score.historyTitle": "Zgodovina delitev",
    // Gledalec nima "svoje" ekipe, zato ekipi poimenujemo kot v protokolu.
    "score.teamA": "Ekipa A",
    "score.teamB": "Ekipa B",
    "score.col.deal": "#",
    "score.col.trump": "Adut",
    "score.col.caller": "Klical",
    "score.col.result": "Izid",

    /* ─── Napovedi ──────────────────────────────────────────── */
    "declarations.title": "Napovedi",
    "declarations.none": "Nihče nima napovedi.",
    "declarations.scores": "šteje",
    "declarations.lost": "propade",
    "declarations.weScore": "Naše napovedi štejejo.",
    "declarations.theyScore": "Njihove napovedi štejejo.",
    "declarations.tapToClose": "Dotakni se za nadaljevanje",
    "declaration.four": "štiri enake ({points})",
    "declaration.sequence.3": "terca (20)",
    "declaration.sequence.4": "kvarta (50)",
    "declaration.sequence.5": "zaporedje petih ali več (100)",

    "bela.title": "Bela!",
    "bela.by": "kliče {name}",

    /* ─── Konec delitve ─────────────────────────────────────── */
    "deal.summaryTitle": "{n}. delitev",
    "deal.cardPoints": "Točke iz kart",
    "deal.declarationPoints": "Napovedi",
    "deal.awarded": "Vpisano",
    "deal.passed": "Šli skozi",
    "deal.fell": "Padli",
    "deal.wePassed": "Šli smo skozi",
    "deal.weFell": "Padli smo",
    "deal.theyPassed": "Oni so šli skozi",
    "deal.theyFell": "Oni so padli",
    "deal.stigljaUs": "Štiglja za nas (+90)",
    "deal.stigljaThem": "Štiglja za njih (+90)",
    "deal.fallExplained": "Ekipa, ki je klicala, ni šla skozi, zato vse točke delitve dobijo nasprotniki.",
    "deal.next": "Naslednja delitev",
    "deal.waitingForNext": "Čaka se naslednja delitev…",

    /* ─── Konec igre ────────────────────────────────────────── */
    "over.youWon": "Zmaga!",
    "over.youLost": "Poraz",
    "over.description": "Igra je končana. Lahko odpreš novo sobo ali se pridružiš drugi.",
    "over.backToLobby": "Nazaj v predsobo",
    "over.newGame": "Nova igra",
    "over.finalScore": "Končni izid",

    /* ─── Klepet ────────────────────────────────────────────── */
    "chat.title": "Klepet",
    "chat.empty": "Še ni sporočil.",
    "chat.placeholder": "Napiši sporočilo…",
    "chat.send": "Pošlji",
    "chat.open": "Odpri klepet",
    "chat.close": "Zapri klepet",
    "chat.unread.one": "{n} novo sporočilo",
    "chat.unread.two": "{n} novi sporočili",
    "chat.unread.few": "{n} nova sporočila",
    "chat.unread.other": "{n} novih sporočil",

    /* ─── Napake (kode iz @bela/protocol) ───────────────────── */
    "error.UNAUTHENTICATED": "Prijavi se, da lahko igraš.",
    "error.ROOM_NOT_FOUND": "Soba ne obstaja več.",
    "error.ROOM_FULL": "Soba je polna.",
    "error.SEAT_TAKEN": "Ta sedež je zaseden.",
    "error.NOT_HOST": "To lahko naredi samo gostitelj.",
    "error.NOT_IN_ROOM": "Nisi v tej sobi.",
    "error.NOT_YOUR_TURN": "Nisi na vrsti.",
    "error.ILLEGAL_MOVE": "Ta poteza ni dovoljena.",
    "error.RATE_LIMITED": "Malo počasneje — preveč sporočil.",
    "error.BAD_REQUEST": "Nekaj ni v redu z zahtevo.",
    "error.ALREADY_STARTED": "Igra se je že začela.",
    "error.NOT_ENOUGH_PLAYERS": "Ni dovolj igralcev.",

    /* ─── Mock strežnik (samo dev, /igra?mock=1) ────────────── */
    "mock.youName": "Ti",
    "mock.otherName": "Gostitelj",
    "mock.botName": "Bot {n}",
    "mock.roomName": "Demo soba",

    /* ─── Nastavitve igre (game/DESIGN.md §2.10) ───────────── */
    "settings.title": "Nastavitve igre",
    "settings.sound": "Zvok",
    "settings.reduceMotion": "Zmanjšaj animacije",
    "settings.reduceMotionHint": "Sledi tudi sistemski nastavitvi za zmanjšane animacije.",
    "settings.deckType": "Vrsta kart",
    "settings.deck.madjarice": "Madžarske",
    "settings.deck.francuske": "Francoske",
    "settings.recommended": "Priporočeno",
    "common.close": "Zapri",
}
