/* `game` — online bela: predvorje, soba, stol, karte, bodovanje.

   Hrvatski je izvor istine: oblik ove datoteke definira što
   `src/i18n/sl/game.ts` mora imati, a nedostajući slovenski ključ je
   compile error. Ključevi su plosnati unutar namespacea (leaf smije
   sadržavati točke; `t()` dijeli samo na PRVOJ točki) i adresiraju se kao
   `t("game.nesto")`.

   Brojevi idu kroz `usePlural()` / `tPlural()` — obitelji `.one/.few/.other`
   ovdje, `.two` dodatno u slovenskom (dvojina). */

export const game = {
    "room.privateGame": "Privatna igra",
    "room.allowSpectators": "Omogući gledatelje",
    "room.spectatorsAllowed": "Gledatelji omogućeni",
    "room.spectatorsDisabled": "Bez gledatelja",
    "guest.title": "Zaigraj belu",
    "guest.name": "Ime igrača",
    "guest.nameHint": "Unesi ime za stolom. Zapamtit ćemo ga u ovom pregledniku.",
    "guest.avatarHint": "Izaberi lik koji te predstavlja za stolom.",
    "guest.play": "Igraj kao gost",
    "guest.statsHint": "Prijavi se za spremanje statistike na svim uređajima.",
    "guest.login": "Prijava",
    "guest.loginInline": "Prijavi se",
    "guest.statsHintSuffix": "za spremanje statistike na svim uređajima.",
    "guest.nameOffensive": "To ime nije dopušteno. Odaberi drugo.",
    "declarations.calculating": "Igra računa zvanja…",
    "declarations.starting": "Igra počinje…",

    "lobby.heroLabel": "Bela online",
    "lobby.heroTitle": "Tvoj stol. Tvoja ekipa.",
    "lobby.heroDescription": "Pronađi slobodan stol ili okupi svoju ekipu za novu partiju bele.",
    "room.visibility": "Vidljivost igre",
    "room.private": "Privatna",
    "room.public": "Javna",
    "room.waitingReady": "Nije spreman",
    "room.statsOverall": "Sve {wins}–{losses} · {percent}%",
    /* Naslov ukupne pločice u redu statistike (lobby header, 2026-09-20).
       Stari ključ `statsOverallLabel` ("Sve") ostao je bez čitača kad je
       RoomPanel prešao na `SeatStatPill` — `GameStatsPills.tsx` je posegnuo
       za istim imenom prije nego što je ikad postojao u ovom obliku, pa se
       u nastalom razmaku prikazivao sirovi ključ. Preimenovan i s novim
       tekstom po korisnikovu zahtjevu. */
    "room.statsTitle": "Ukupno",
    /* Karma = pouzdanost igrača, 0..10. Kratica uz sjedalo u lobiju. */
    "room.karma": "Karma {value}/{max}",
    "karma.explain": "Karma pokazuje koliko se na igrača možeš osloniti. Svi kreću s {max}/{max}. Napuštanje partije koja je u tijeku, uz još barem jednog igrača, oduzima 1 bod (nakon što istekne vrijeme za povratak za stol), a svake {recovery} završene partije vraćaju 1 bod. Karmu vide ostali igrači u sobi.",
    "room.statsTarget": "{target} {wins}–{losses} · {percent}%",
    "bot.label": "Bot",
    "rules.title": "Pravila podjele",
    "rules.noDeclarations": "Bez zvanja",
    "rules.withDeclarations": "Sa zvanjima",
    "rules.allowBela": "Bela je dopuštena",
    "rules.noBela": "Bez bele",
    "settings.gameName": "Ime za igru",
    "settings.gameNameHint": "Ime koje ostali igrači vide za stolom. Možeš ga promijeniti jednom u sedam dana.",
    "settings.gameNameSaved": "Ime je spremljeno.",
    "settings.gameNameNext": "Ime možeš ponovno promijeniti {date}.",
    "settings.gameNameOffensive": "To ime nije dopušteno. Odaberi drugo.",
    "settings.avatar": "Lik",
    "settings.avatarHint": "Lik koji ostali igrači vide za stolom.",
    "settings.alwaysReady": "Uvijek spreman",
    "settings.alwaysReadyHint": "Automatski budi spreman.",
    /* ─── Zajedničko ────────────────────────────────────────── */
    "common.cancel": "Odustani",
    "common.save": "Spremi",

    /* ─── Stanje veze ───────────────────────────────────────── */
    "connection.connecting": "Spajanje…",
    "connection.open": "Povezano",
    "connection.closed": "Veza je prekinuta — pokušavam ponovno",
    "connection.slow": "Veza je spora — pokušavam se spojiti",

    /* ─── Boje i vrijednosti karata ─────────────────────────── */
    // Hrvatski nazivi boja; simboli (♥♦♠♣) su francuski i ne prevode se.
    "suit.HERC": "herc",
    "suit.KARA": "kara",
    "suit.PIK": "pik",
    "suit.TREF": "žir",

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
    "lobby.target": "{target}",
    "lobby.playing": "Igra se",
    "lobby.finishMode.prolaz": "Prolaz",
    "lobby.finishMode.dosta": "Dosta",
    "lobby.private": "Privatna",
    "lobby.seats": "{taken}/{total} sjedala",
    "lobby.status.LOBBY": "Čeka igrače",
    "lobby.status.PLAYING": "U tijeku",
    "lobby.status.FINISHED": "Gotovo",
    "lobby.empty.title": "Nema otvorenih soba",
    "lobby.empty.description": "Budi prvi — otvori sobu i počni odmah.",
    "lobby.form.name": "Naziv sobe",
    "lobby.form.namePlaceholder": "npr. Petak navečer",
    "lobby.form.target": "Igra se do",
    "lobby.form.endRule": "Igra se na",
    "lobby.form.endRule.prolaz": "Prolaz",
    "lobby.form.endRule.dosta": "Dosta",
    "lobby.form.private": "Privatna soba",
    "lobby.form.minWinRate": "Postotak pobjeda",
    "lobby.form.minWinRateNone": "Bez uvjeta",
    "lobby.form.moreOptions": "Dodatne opcije",
    "room.minWinRate": "Najmanje {percent}% pobjeda",
    "room.minWinRateShort": "≥ {percent}% pobjeda",

    /* ─── Soba (/igra/soba/:id) ─────────────────────────────── */
    "room.metaTitle": "Soba {name} — bela",
    "room.joining": "Ulazim u sobu…",
    "room.backToLobby": "Natrag u predvorje",
    "room.invite": "Kopiraj poveznicu",
    "room.inviteCopied": "Poveznica je kopirana",
    "room.inviteCopyFailed": "Kopiranje nije uspjelo — evo poveznice",
    "room.sit": "Sjedni",
    "room.stand": "Ustani",
    "room.addBot": "Bot",
    "room.removeBot": "Ukloni bota",
    "room.ready": "Spreman",
    "room.readyOn": "Spreman",
    "room.readyOff": "Spreman",
    "room.seatsTaken": "{taken}/{total} sjedala zauzeto",
    "room.start": "Počni igru",
    "room.waitingForHost": "Čeka se da domaćin pokrene igru.",
    "room.emptySeatsFilled": "Prazna sjedala popunit će botovi.",
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
    "lobby.create.title": "Postavi svoj stol",
    "lobby.create.targetAria": "Igraj do {target} bodova",
    "lobby.create.private": "Privatna igra",
    "create.quick.name": "Brza 163",
    "create.quick.title": "Brza igra",
    "create.quick.description": "Najviše 3 dijeljenja, nasumičan prvi djelitelj. Pobjeđuje prvi par sa 163 boda, a ako nitko ne stigne, onaj s više bodova nakon trećeg dijeljenja.",
    // Short label for the quick-play (163) discipline in tight stat pills —
    // the bare number "163" alone would not read as a discipline name the
    // way "501"/"701"/"1001" do, so it gets a word instead.
    "stats.quickLabel": "Brza",
    "lobby.joinByCode.title": "Pridruži se šifrom",
    "lobby.joinByCode.description": "Upiši 4-znamenkastu šifru sobe.",
    "lobby.joinByCode.privateTitle": "Uđi u igru {name}",
    "lobby.joinByCode.privateDescription": "Ova igra je privatna. Unesi šifru koju ti je prijatelj poslao.",
    "lobby.joinByCode.codeLabel": "Šifra sobe",
    "lobby.joinByCode.codeAria": "Šifra sobe, 4 znamenke",
    "lobby.joinByCode.clearAria": "Obriši sve znamenke",
    "lobby.joinByCode.backspaceAria": "Obriši zadnju znamenku",
    "lobby.joinByCode.enteredAria": "Uneseno {count} od {total} znamenki",

    "room.label": "Ime igre",
    "room.codeLabel": "🔒 Šifra za ulaz: {code}",
    "room.copyCode": "Kopiraj šifru",
    "room.codeCopied": "Šifra je kopirana",
    "room.codeCopyFailed": "Kopiranje nije uspjelo — evo šifre",
    "room.leaveAria": "Izađi iz sobe",
    // Kao i francuski simboli na kartama, "vs" ostaje isto u oba jezika —
    // to je oznaka u UI-u, ne riječ.
    "room.vs": "vs",
    "room.waitingSeat": "Slobodno mjesto",
    // Naslovi "MI"/"ONI" nad parovima su maknuti (strane su vezane uz
    // domaćina, iste su na svakom ekranu), pa grupiranje ostaje samo vizualno
    // — ovo ga vraća čitaču ekrana. Par 1 je uvijek domaćinov.
    "room.pairAria": "Par {n}",
    "room.addBotCta": "Dodaj bota",
    "room.launch": "Pokreni igru",

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

    /* ─── NOVO (redizajn sjedala, 2026-09-08) ───────────────────────────
       Sjedalo ima jednu anatomiju na sve četiri strane: avatar s oznakama u
       kutovima, pilula s imenom, pa jedan status-čip. Ovo su tri stringa
       koje taj čip odnosno oznaka trebaju. "{n} s" je kratica za sekunde
       (mjerna jedinica, ne brojiva imenica) pa namjerno nema množinu. */
    "seat.onTurn": "Na potezu",
    "seat.secondsShort": "{n} s",
    "seat.calledTrump": "Zove aduta: {suit}",

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
    "table.holdsTrick": "Drži štih",
    "table.trumpSet": "Adut je {suit}",
    "table.settings": "Postavke igre",
    "table.secondsLeft.one": "{n} sekunda",
    "table.secondsLeft.two": "{n} sekunde",
    "table.secondsLeft.few": "{n} sekunde",
    "table.secondsLeft.other": "{n} sekundi",
    "table.turnTimeLeft": "Preostalo vrijeme za potez: {seconds} s",

    // Statusna pilula iznad ruke — tko je na potezu i što radi.
    "table.turnYou": "Tvoj potez",
    "table.turnOther": "{name} je na potezu",
    "table.turnCalling": "{name} zove",
    "table.turnYourCall": "Zovi aduta",
    "table.phaseBidding": "Zvanje aduta",
    "table.waiting": "Čekaj…",
    "table.spectating": "Gledaš igru",
    "table.spectatorCount": "Gledatelji: {count}",

    // Brze reakcije za stolom (protokol `chat.react`).
    "table.reactions": "Reakcije",
    "table.reactionsToggle": "Prikaži reakcije",
    "table.sendReaction": "Pošalji reakciju: {reaction}",
    "table.reaction.nicePlay": "Bravo, majstore!",
    "table.reaction.lucky": "Sreća prati hrabre!",
    "table.reaction.mistake": "Ajoooooj!",
    "table.reaction.angry": "Grrrrr!",
    "table.reaction.hurry": "Može li to sporije? 🙄",
    "table.reaction.goodGame": "Dobra igra, svaka čast!",

    "table.trickCount.one": "{n} štih",
    "table.trickCount.two": "{n} štiha",
    "table.trickCount.few": "{n} štiha",
    "table.trickCount.other": "{n} štihova",

    /* ─── Ruka ──────────────────────────────────────────────── */
    "hand.ariaLabel": "Tvoje karte",
    "hand.empty": "Nemaš više karata",
    "hand.illegalPlay": "Tu kartu trenutno ne možeš odigrati.",

    /* ─── Rezultat ──────────────────────────────────────────── */
    "score.us": "Mi",
    "score.them": "Oni",
    "score.target": "do {target}",
    "score.currentDeal": "+{points} bodova · {tricks}",
    "score.calledBy": "zove {name}",
    "score.history": "Povijest",
    "score.historyTitle": "Povijest podjela",
    // Gledatelj nema "svoj" tim, pa mu se timovi imenuju kako ih zove protokol.
    "score.teamA": "Tim A",
    "score.teamB": "Tim B",
    "score.col.deal": "#",
    "score.col.trump": "Adut",
    "score.col.caller": "Zvao",
    "score.col.result": "Ishod",
    // Naslov malog "+150" uz veliki broj podjele — samo tooltip/aria, sam
    // broj nosi značenje. Uključuje i belu (README §2).
    "score.declarationBonus": "Zvanja",

    /* ─── Zvanja ────────────────────────────────────────────── */
    "declarations.title": "Zvanja",
    "declarations.none": "Nitko nema zvanja.",
    // Prazan tab kad se klikne MI/ONI za par koji ništa nije zvao (2026-09-20,
    // user request: odvojeni tabovi po paru umjesto pomiješanih redaka).
    "declarations.noneForTeam": "Nema zvanja",
    "declarations.bela": "Bela +20",

    "bela.title": "Bela!",
    "bela.by": "zove {name}",
    "trump.calledBy": "{name} zove {suit}",
    // Zvanje bele je IZBOR (game/README.md §1.4): pitamo jednom, kad se baca
    // prva od K/Q aduta. Odbijanje vrijedi za cijelu podjelu.
    "bela.ask": "Zovi belu?",
    "bela.askYes": "Da",
    "bela.askNo": "Ne",

    "belot.title": "BELOT!",

    "belot.congrats": "Čestitamo!",
    "belot.by": "Svih osam karata — {suit}",
    "belot.wins": "Partija je osvojena odmah",

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
    "over.wonDescription": "Bravo, izgleda da si pravi bela majstor!",
    "over.lostDescription": "Više sreće drugi put!",
    "over.finished": "Partija je završena.",
    "over.belotDescription": "{name} je dobio svih osam karata iste boje i odmah osvojio partiju.",
    "over.backToLobby": "Natrag u predvorje",
    "over.newGame": "Nova igra",
    "over.finalScore": "Konačni rezultat",

    /* ─── Chat ──────────────────────────────────────────────── */

    /* ─── Greške (kodovi iz @bela/protocol) ─────────────────── */
    "error.UNAUTHENTICATED": "Prijavi se da bi igrao.",
    "error.ROOM_NOT_FOUND": "Soba više ne postoji.",
    "error.ROOM_FULL": "Soba je puna.",
    "error.WIN_RATE_TOO_LOW": "Za ulaz je potrebno najmanje {percent}% pobjeda.",
    "error.ROOM_CODE_REQUIRED": "Za ulaz u privatnu sobu potrebna je šifra.",
    "error.SPECTATORS_DISABLED": "Ova igra ne dopušta gledatelje.",
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
    /* Naslov bloka na vrhu „Postavke igre”: postavke SOBE, uređive dok se
       partija nije počela i samo domaćinu (game/README.md §3). */
    "settings.thisGame": "Postavke ove igre",
    "settings.title": "Postavke igre",
    "settings.sound": "Zvuk",
    "settings.reduceMotion": "Smanji animacije",
    "settings.reduceMotionHint": "Također slijedi sistemsku postavku za smanjene animacije.",
    "settings.keepAwake": "Drži zaslon uključenim",
    "settings.deckType": "Vrsta karata",
    /* Četiri špila (2026-09-20): tri su mađarice i razlikuju se samo po
       crtežu — registar je u game/util/cards.ts, id-evi su ono što se pamti
       u localStorageu. */
    "settings.deck.klasicne": "Klasične",
    "settings.deck.moderne": "Moderne",
    "settings.deck.vektorske": "Vektorske",
    "settings.deck.francuske": "Francuske",
    "settings.recommended": "Preporučeno",
    "common.close": "Zatvori",

    /* ─── Pravila sobe — unmissable badges + potvrda (RoomPanel/CreateGameDialog) ──
       "Bez zvanja" / "Bez bele" moraju biti jasne svima za stolom, ne samo
       domaćinu, i host mora vidjeti sažetak izbora prije nego stvori sobu. */
    "room.spectatingFull": "Sva su mjesta zauzeta — gledaš igru dok se neko mjesto ne oslobodi.",

    /* ─── Čuvanje sjedala, aktivna soba, povratak (game/README.md §3) ─────
       DODANO NA KRAJ — ne premještaj i ne briši ključeve iznad. */
    "active.holdLeft": "Sjedalo ti se čuva još {time}",
    "active.holdNone": "Sjedalo je i dalje tvoje.",
    "active.resume": "Vrati se u igru",
    "active.leave": "Napusti igru",
    "active.seatBadge": "Tvoje sjedalo",
    "active.status.LOBBY": "Čeka početak",
    "active.status.PLAYING": "Igra u tijeku",
    "active.status.FINISHED": "Završeno",

    "reconnect.title": "Veza je prekinuta",
    "reconnect.hold": "Sjedalo ti se čuva još {time}",
    "reconnect.retrying": "Pokušavam se ponovno spojiti…",
    "reconnect.restored": "Ponovno si spojen i vraćen za stol",
    "phase.dealt": "Podijeljeno je prvih šest karata",
    "phase.dealtHint": "Pogledaj karte prije zvanja aduta",
    "phase.declarations": "Provjeravaju se zvanja",

    "exit.title": "Napustiti stol?",
    "exit.description": "Ako ostaneš, nastavljaš igrati. Ako izađeš, počinje odbrojavanje od dvije minute; do isteka se možeš vratiti, a zatim tvoje mjesto preuzima bot.",
    "exit.descriptionLobby": "Ako izađeš, odmah napuštaš sobu i tvoje mjesto za stolom se oslobađa.",
    "exit.stay": "Ostani u sobi",
    "exit.leave": "Izađi iz sobe",

    "missedTurn.title": "Propustio si potez",
    "missedTurn.body": "Vrijeme je isteklo pa je potez odigran umjesto tebe.",
    "missedTurn.back": "Vrati se u igru",

    "widget.title": "Aktivna soba",
    "widget.return": "Vrati se",
    "widget.leave": "Izađi",
    "widget.collapse": "Sažmi",
    "widget.expand": "Proširi",
    "widget.dismiss": "Sakrij",

    /* ─── Kompaktan red "Privatna igra" + "Spreman" (RoomPanel, mobilni layout) ──
       DODANO NA KRAJ — ne premještaj i ne briši ključeve iznad. */
    "room.privateGameShort": "Privatna",

    /* ─── Semafor okrenut kako treba + jedan dijalog na kraju partije ────
       (game/README.md §1.7, §2 — veliki broj su bodovi tekuće podjele,
       ukupni rezultat partije ide malo ispod)
       DODANO NA KRAJ — ne premještaj i ne briši ključeve iznad. */
    "score.matchTotal": "ukupno {total}",
    "over.dismiss": "U redu",

    /* ─── Gledanje štihova (game/README.md §1.8) ─────────────────────────
       Postavka sobe s TRI stanja, bira se pri otvaranju sobe i vrijedi za
       cijelu sobu. Srednje stanje je par igrača koji ZAPOČINJE štih — nikad
       "tko je na potezu".
       DODANO NA KRAJ — ne premještaj i ne briši ključeve iznad. */
    "rules.trickReview": "Gledanje štihova",
    "rules.trickReview.off": "Isključeno",
    "rules.trickReview.leaderPair": "Par koji je na redu",
    "rules.trickReview.all": "Svi",
    /* Lica trostrukog prekidača u „Nova igra” — puna rečenica iznad ostaje
       pristupačno ime svakog gumba, ovo je samo ono što stane u redak. */
    "rules.trickReviewShort.off": "Ne",
    "rules.trickReviewShort.leaderPair": "Na redu",
    "rules.trickReviewShort.all": "Svi",
    "rules.trickReviewBadge.off": "Bez gledanja štihova",
    "rules.trickReviewBadge.leaderPair": "Štihove gleda par koji je na redu",
    "rules.trickReviewBadge.all": "Štihove gledaju svi",

    "tricks.title": "Štihovi",
    "tricks.open": "Pogledaj odigrane štihove",
    "tricks.trickNo": "{n}. štih",
    "tricks.ledBy": "otvara {name}",
    "tricks.wonBy": "uzeo {name}",
    "tricks.empty": "Još nema odigranih štihova.",
    "tricks.hiddenOff": "Gledanje štihova je isključeno u ovoj sobi.",
    "tricks.hiddenLeaderPair": "Štihove pregledava samo par koji je započeo trenutni štih.",

    /* ─── Jedna igra odjednom (game/README.md §3.2) ─────────────────────── */
    "error.ALREADY_IN_GAME": "Već imaš sjedalo u drugoj igri. Vrati se za stol ili je napusti.",
    "lobby.blockedByActive": "Već imaš igru u tijeku. Vrati se za stol ili pričekaj istek odbrojavanja.",
    "lobby.blockedRoom": "Ne možeš ući — već imaš aktivnu igru.",

    /* ─── "Dolazi uskoro" (src/game/GameComingSoonPage.tsx) ───────────────
       Ono što /igra prikazuje dok je produkcijski prekidač isključen
       (ops/toggle-game.sh). "Igraj" je od sada uvijek u izborniku, pa ova
       stranica mora sama objasniti zašto igre još nema. Bez odbrojavanja i
       bez datuma — ne znamo kada se prekidač pali.
       DODANO NA KRAJ — ne premještaj i ne briši ključeve iznad. */
    "comingSoon.metaTitle": "Igranje bele — uskoro — bela-turniri.com",
    "comingSoon.metaDescription": "Bela online je u pripremi. Turniri, kalendar, karta i bela blok rade kao i dosad.",
    "comingSoon.label": "Bela online",
    "comingSoon.title": "Igranje bele — dolazi uskoro",
    "comingSoon.description": "Još radimo na online beli. Dok ne bude spremna, sve ostalo radi kao i dosad — turniri, kalendar, karta i bela blok.",
    "comingSoon.backToTournaments": "Idi na turnire",
    "comingSoon.openBlok": "Otvori bela blok",

    /* ─── Tko je u sobi + puna soba (game/README.md §3 "Lobby", §3.2) ─────
       Redak u predvorju sada pokazuje stvarne suigrače (`RoomSummary.occupants`),
       a soba bez slobodnog sjedala i bez gledatelja odbija ulaz unaprijed
       (`RoomSummary.joinable`) umjesto da te tiho pretvori u gledatelja.
       DODANO NA KRAJ — ne premještaj i ne briši ključeve iznad. */
    "lobby.full": "Puna",
    "lobby.fullBlocked": "Soba je puna — nema slobodnog sjedala.",
    "lobby.emptySeat": "Slobodno sjedalo",
    "lobby.occupantsAria": "Za stolom: {names}",
    "lobby.freeSeats.one": "još {n} slobodno sjedalo",
    // `.two` je slovenska dvojina; hrvatski je nikad ne traži, ali mora
    // postojati jer `sl` tipizira ovu datoteku.
    "lobby.freeSeats.two": "još {n} slobodna sjedala",
    "lobby.freeSeats.few": "još {n} slobodna sjedala",
    "lobby.freeSeats.other": "još {n} slobodnih sjedala",
    "lobby.spectateHint": "Sva sjedala su zauzeta — možeš gledati.",
    "room.sitHere": "Sjedni ovdje",

    /* ─── HUD v3 za stolom (game/DESIGN.md §6) ───────────────────────────
       Semafor je dobio traku napretka prema cilju partije; ona nosi i „do
       1001”, pa je stari podnožni redak nestao. Traka je samo 2 px visoka,
       zato joj treba izgovoriva verzija — ovaj ključ je `aria-label` trake,
       nikad vidljivi tekst.
       DODANO NA KRAJ — ne premještaj i ne briši ključeve iznad. */
    "score.progress": "Ukupno {total} od {target}",
}

/** Ugovor koji svaki drugi jezik mora zadovoljiti za `game`. */
export type GameDict = typeof game
