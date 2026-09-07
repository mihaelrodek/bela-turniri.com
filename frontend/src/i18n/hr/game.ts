/* `game` — online bela: predvorje, soba, stol, karte, bodovanje.

   Hrvatski je izvor istine: oblik ove datoteke definira što
   `src/i18n/sl/game.ts` mora imati, a nedostajući slovenski ključ je
   compile error. Ključevi su plosnati unutar namespacea (leaf smije
   sadržavati točke; `t()` dijeli samo na PRVOJ točki) i adresiraju se kao
   `t("game.nesto")`.

   Brojevi idu kroz `usePlural()` / `tPlural()` — obitelji `.one/.few/.other`
   ovdje, `.two` dodatno u slovenskom (dvojina). */

export const game = {
    /* ─── Navigacija ────────────────────────────────────────── */
    "nav.igraj": "Igraj",

    /* ─── Zajedničko ────────────────────────────────────────── */
    "common.cancel": "Odustani",

    /* ─── Stanje veze ───────────────────────────────────────── */
    "connection.connecting": "Spajanje…",
    "connection.open": "Povezano",
    "connection.closed": "Veza je prekinuta — pokušavam ponovno",

    /* ─── Boje i vrijednosti karata ─────────────────────────── */
    // Hrvatski nazivi boja; simboli (♥♦♠♣) su francuski i ne prevode se.
    "suit.HERC": "herc",
    "suit.KARA": "kara",
    "suit.PIK": "pik",
    "suit.TREF": "tref",

    "rank.7": "sedmica",
    "rank.8": "osmica",
    "rank.9": "devetka",
    "rank.10": "desetka",
    "rank.J": "dečko",
    "rank.Q": "dama",
    "rank.K": "kralj",
    "rank.A": "as",

    // Kratice na samoj karti. Iste u svim jezicima — to su oznake na
    // francuskom špilu, ne riječi.
    "rankShort.7": "7",
    "rankShort.8": "8",
    "rankShort.9": "9",
    "rankShort.10": "10",
    "rankShort.J": "J",
    "rankShort.Q": "Q",
    "rankShort.K": "K",
    "rankShort.A": "A",

    // Ono što čitač ekrana pročita na karti: "dečko herc".
    "card.aria": "{rank} {suit}",

    /* ─── Mađarice (Tell uzorak) ────────────────────────────── */
    // Isti engine `Suit`/`Rank`, druga imena — bela se igra mađaricama, pa
    // su ovo zadana imena na stolu (francuska `suit.*` / `rank.*` ostaju za
    // francuski špil iz postavki). Vidi game/DESIGN.md §2.1.
    "suitHu.HERC": "srce",
    "suitHu.KARA": "bundeva",
    "suitHu.PIK": "list",
    "suitHu.TREF": "žir",

    "rankHu.7": "sedmica",
    "rankHu.8": "osmica",
    "rankHu.9": "devetka",
    "rankHu.10": "desetka",
    "rankHu.J": "dolnji",
    "rankHu.Q": "gornji",
    "rankHu.K": "kralj",
    "rankHu.A": "as",

    // Godišnje doba na Tell asu — samo za aria-label asa.
    "season.HERC": "proljeće",
    "season.KARA": "ljeto",
    "season.PIK": "jesen",
    "season.TREF": "zima",

    "card.ariaAce": "as {suit} ({season})",

    /* ─── Predvorje (/igra) ─────────────────────────────────── */
    "lobby.metaTitle": "Igraj belu online — bela-turniri.com",
    "lobby.metaDescription": "Otvori sobu, pozovi ekipu ili dodaj botove i igraj belu u pregledniku.",
    "lobby.title": "Igraj belu",
    "lobby.subtitle": "Otvori sobu i pozovi ekipu — prazna sjedala popune botovi.",
    "lobby.createRoom": "Nova soba",
    "lobby.create": "Otvori sobu",
    "lobby.join": "Uđi",
    "lobby.target": "do {target}",
    "lobby.private": "Privatna",
    "lobby.seats": "{taken}/{total} sjedala",
    "lobby.status.LOBBY": "Čeka igrače",
    "lobby.status.PLAYING": "U tijeku",
    "lobby.status.FINISHED": "Gotovo",
    "lobby.empty.title": "Nema otvorenih soba",
    "lobby.empty.description": "Budi prvi — otvori sobu, dodaj botove i počni odmah.",
    "lobby.form.name": "Naziv sobe",
    "lobby.form.namePlaceholder": "npr. Petak navečer",
    "lobby.form.target": "Igra se do",
    "lobby.form.private": "Privatna soba",
    "lobby.form.privateHint": "Privatna soba se ne prikazuje u predvorju — ulazi se samo preko poveznice.",

    /* ─── Soba (/igra/soba/:id) ─────────────────────────────── */
    "room.metaTitle": "Soba {name} — bela",
    "room.joining": "Ulazim u sobu…",
    "room.backToLobby": "Natrag u predvorje",
    "room.leave": "Izađi",
    "room.invite": "Kopiraj poveznicu",
    "room.inviteCopied": "Poveznica je kopirana",
    "room.inviteCopyFailed": "Kopiranje nije uspjelo — evo poveznice",
    "room.sit": "Sjedni",
    "room.stand": "Ustani",
    "room.addBot": "Bot",
    "room.removeBot": "Ukloni bota",
    "room.ready": "Spreman",
    "room.readyOn": "Spreman si",
    "room.readyOff": "Označi da si spreman",
    "room.seatsTaken": "{taken}/{total} sjedala zauzeto",
    "room.start": "Počni igru",
    "room.waitingForHost": "Čeka se da domaćin pokrene igru.",
    "room.emptySeatsFilled": "Prazna sjedala popunit će botovi (srednje).",
    "room.spectators": "Gledatelji",

    /* ─── Predvorje/soba v2 (bela.fun redizajn, game/DESIGN.md §1/§2.9) ──
       Novi predvorje (traka pretrage, šifra sobe, dijalozi) i soba
       (redovi sjedala, šifra za ulaz). Stari ključevi gore ostaju —
       koriste ih Seat.tsx i GameRoomPage.tsx koje ne diramo. */
    "lobby.heading": "Igre",
    "lobby.searchPlaceholder": "Pretraži sobe…",
    "lobby.searchAria": "Pretraži sobe",
    "lobby.newGame": "Nova igra",
    "lobby.joinByCode": "Pridruži se šifrom",
    "lobby.privateAria": "Privatna soba",
    "lobby.enterAria": "Uđi u sobu {name}",
    "lobby.seatsAria": "{taken} od {total} mjesta zauzeto",
    "lobby.create.title": "Do koliko se igra?",
    "lobby.create.targetAria": "Igraj do {target} bodova",
    "lobby.create.private": "Privatna igra",
    "lobby.joinByCode.title": "Pridruži se šifrom",
    "lobby.joinByCode.description": "Upiši 4-znamenkastu šifru sobe.",
    "lobby.joinByCode.codeLabel": "Šifra sobe",
    "lobby.joinByCode.codeAria": "Šifra sobe, 4 znamenke",

    "room.label": "Ime igre",
    "room.codeLabel": "🔒 Šifra za ulaz: {code}",
    "room.copyCode": "Kopiraj šifru",
    "room.codeCopied": "Šifra je kopirana",
    "room.codeCopyFailed": "Kopiranje nije uspjelo — evo šifre",
    "room.leaveAria": "Izađi iz sobe",
    // Kao i francuski simboli na kartama, "vs" ostaje isto u oba jezika —
    // to je oznaka u UI-u, ne riječ.
    "room.vs": "vs",
    "room.waitingSeat": "čekam…",
    "room.addBotCta": "Dodaj bota",
    "room.launch": "Pokreni igru",
    "room.launchHint": "Čeka se da svi budu spremni.",

    /* ─── Sjedalo ───────────────────────────────────────────── */
    "seat.empty": "Prazno",
    "seat.dealer": "Djelitelj",
    "seat.dealerShort": "D",
    "seat.youSuffix": "{name} (ti)",
    "seat.disconnected": "Nije spojen",
    "seat.cardsInHand.one": "{n} karta u ruci",
    // `.two` je slovenska dvojina; hrvatski je nikad ne traži (vidi
    // `pluralCategory`), ali mora postojati jer `sl` tipizira ovu datoteku.
    "seat.cardsInHand.two": "{n} karte u ruci",
    "seat.cardsInHand.few": "{n} karte u ruci",
    "seat.cardsInHand.other": "{n} karata u ruci",

    /* ─── Botovi ────────────────────────────────────────────── */
    "bot.level.lako": "Lako",
    "bot.level.srednje": "Srednje",
    "bot.level.tesko": "Teško",

    /* ─── Zvanje aduta ──────────────────────────────────────── */
    "bidding.yourTurn": "Zovi aduta",
    "bidding.waitingFor": "{name} bira aduta",
    "bidding.passedSoFar": "Dalje: {names}",
    "bidding.callSuit": "Zovi {suit}",
    "bidding.pass": "Dalje",
    // Djelitelj govori zadnji i ne smije reći dalje ("mus").
    "bidding.mustCall": "Moraš zvati",

    /* ─── Stol ──────────────────────────────────────────────── */
    "table.caller": "zove",
    "table.trumpSet": "Adut je {suit}",
    "table.autoPlayed": "Bot je odigrao umjesto igrača",
    "table.settings": "Postavke igre",
    "table.secondsLeft.one": "{n} sekunda",
    "table.secondsLeft.two": "{n} sekunde",
    "table.secondsLeft.few": "{n} sekunde",
    "table.secondsLeft.other": "{n} sekundi",

    // Statusna pilula iznad ruke — tko je na potezu i što radi.
    "table.turnYou": "Tvoj potez",
    "table.turnOther": "{name} je na potezu",
    "table.turnCalling": "{name} zove",
    "table.turnYourCall": "Zovi aduta",
    "table.phaseBidding": "Zvanje aduta",
    "table.waiting": "Čekaj…",
    "table.spectating": "Gledaš igru",

    // Emoji reakcije (protokol `chat.react`).
    "table.reactions": "Reakcije",
    "table.sendReaction": "Pošalji reakciju {emoji}",

    "table.trickCount.one": "{n} štih",
    "table.trickCount.two": "{n} štiha",
    "table.trickCount.few": "{n} štiha",
    "table.trickCount.other": "{n} štihova",

    /* ─── Ruka ──────────────────────────────────────────────── */
    "hand.ariaLabel": "Tvoje karte",
    "hand.empty": "Nemaš više karata",

    /* ─── Rezultat ──────────────────────────────────────────── */
    "score.us": "Mi",
    "score.them": "Oni",
    "score.target": "do {target}",
    "score.dealNo": "{n}. podjela",
    "score.calledBy": "zove {name}",
    "score.tricks": "štihovi {us}:{them}",
    "score.history": "Povijest",
    "score.historyTitle": "Povijest podjela",
    // Gledatelj nema "svoj" tim, pa mu se timovi imenuju kako ih zove protokol.
    "score.teamA": "Tim A",
    "score.teamB": "Tim B",
    "score.col.deal": "#",
    "score.col.trump": "Adut",
    "score.col.caller": "Zvao",
    "score.col.result": "Ishod",

    /* ─── Zvanja ────────────────────────────────────────────── */
    "declarations.title": "Zvanja",
    "declarations.none": "Nitko nema zvanja.",
    "declarations.scores": "boduje",
    "declarations.lost": "propada",
    "declarations.weScore": "Naša zvanja se boduju.",
    "declarations.theyScore": "Njihova zvanja se boduju.",
    "declarations.tapToClose": "Dodirni za nastavak",
    "declaration.four": "četiri iste ({points})",
    "declaration.sequence.3": "terca (20)",
    "declaration.sequence.4": "kvarta (50)",
    "declaration.sequence.5": "niz od pet i više (100)",

    "bela.title": "Bela!",
    "bela.by": "zove {name}",

    /* ─── Kraj podjele ──────────────────────────────────────── */
    "deal.summaryTitle": "{n}. podjela",
    "deal.cardPoints": "Bodovi iz karata",
    "deal.declarationPoints": "Zvanja",
    "deal.awarded": "Upisano",
    "deal.passed": "Prošli",
    "deal.fell": "Pali",
    "deal.wePassed": "Prošli smo",
    "deal.weFell": "Pali smo",
    "deal.theyPassed": "Oni su prošli",
    "deal.theyFell": "Oni su pali",
    "deal.stigljaUs": "Štiglja za nas (+90)",
    "deal.stigljaThem": "Štiglja za njih (+90)",
    "deal.fallExplained": "Tim koji je zvao nije prošao, pa svi bodovi podjele idu protivnicima.",
    "deal.next": "Sljedeća podjela",
    "deal.waitingForNext": "Čeka se sljedeća podjela…",

    /* ─── Kraj igre ─────────────────────────────────────────── */
    "over.youWon": "Pobjeda!",
    "over.youLost": "Poraz",
    "over.description": "Igra je gotova. Možeš otvoriti novu sobu ili se pridružiti drugoj.",
    "over.backToLobby": "Natrag u predvorje",
    "over.newGame": "Nova igra",
    "over.finalScore": "Konačni rezultat",

    /* ─── Chat ──────────────────────────────────────────────── */
    "chat.title": "Chat",
    "chat.empty": "Još nema poruka.",
    "chat.placeholder": "Napiši poruku…",
    "chat.send": "Pošalji",
    "chat.open": "Otvori chat",
    "chat.close": "Zatvori chat",
    "chat.unread.one": "{n} nova poruka",
    "chat.unread.two": "{n} nove poruke",
    "chat.unread.few": "{n} nove poruke",
    "chat.unread.other": "{n} novih poruka",

    /* ─── Greške (kodovi iz @bela/protocol) ─────────────────── */
    "error.UNAUTHENTICATED": "Prijavi se da bi igrao.",
    "error.ROOM_NOT_FOUND": "Soba više ne postoji.",
    "error.ROOM_FULL": "Soba je puna.",
    "error.SEAT_TAKEN": "To je sjedalo zauzeto.",
    "error.NOT_HOST": "Samo domaćin može to napraviti.",
    "error.NOT_IN_ROOM": "Nisi u toj sobi.",
    "error.NOT_YOUR_TURN": "Nisi na potezu.",
    "error.ILLEGAL_MOVE": "Taj potez nije dopušten.",
    "error.RATE_LIMITED": "Presporo malo — previše poruka.",
    "error.BAD_REQUEST": "Nešto nije u redu sa zahtjevom.",
    "error.ALREADY_STARTED": "Igra je već počela.",
    "error.NOT_ENOUGH_PLAYERS": "Nema dovoljno igrača.",

    /* ─── Mock server (samo dev, /igra?mock=1) ──────────────── */
    "mock.youName": "Ti",
    "mock.otherName": "Domaćin",
    "mock.botName": "Bot {n}",
    "mock.roomName": "Demo soba",

    /* ─── Postavke igre (game/DESIGN.md §2.10) ──────────────── */
    "settings.title": "Postavke igre",
    "settings.sound": "Zvuk",
    "settings.reduceMotion": "Smanji animacije",
    "settings.reduceMotionHint": "Također slijedi sistemsku postavku za smanjene animacije.",
    "settings.deckType": "Vrsta karata",
    "settings.deck.madjarice": "Mađarice",
    "settings.deck.francuske": "Francuske",
    "settings.recommended": "Preporučeno",
    "common.close": "Zatvori",
}

/** Ugovor koji svaki drugi jezik mora zadovoljiti za `game`. */
export type GameDict = typeof game
