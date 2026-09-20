import type { GameDict } from "../hr/game"

/* Slovenski `game`. Tipiziran kot hrvaški namespace, tako da izpuščen ali
   napačno zapisan ključ pade na `tsc` in ne šele v teku.

   Register: neformalna druga oseba, kot v ostalih namespacih. Slovenščina
   ima dvojino, zato imajo števne družine tu tudi `.two` — hrvaščina je nima
   in pade nazaj na `.other` po zasnovi (glej `translatePlural`). */

export const game: GameDict = {
    "room.privateGame": "Zasebna igra",
    "room.allowSpectators": "Omogoči gledalce",
    "room.spectatorsAllowed": "Gledalci omogočeni",
    "room.spectatorsDisabled": "Brez gledalcev",
    "guest.title": "Zaigraj belo",
    "guest.name": "Ime igralca",
    "guest.nameHint": "Vnesi ime za mizo. Zapomnili si ga bomo v tem brskalniku.",
    "guest.avatarHint": "Izberi lik, ki te predstavlja za mizo.",
    "guest.play": "Igraj kot gost",
    "guest.statsHint": "Prijavi se za shranjevanje statistike v vseh napravah.",
    "guest.login": "Prijava",
    "guest.loginInline": "Prijavi se",
    "guest.statsHintSuffix": "za shranjevanje statistike v vseh napravah.",
    "declarations.calculating": "Igra računa napovedi…",
    "declarations.starting": "Igra se začenja…",

    "lobby.heroLabel": "Bela na spletu",
    "lobby.heroTitle": "Tvoja miza. Tvoja ekipa.",
    "lobby.heroDescription": "Poišči prosto mizo ali zberi svojo ekipo za novo partijo bele.",
    "room.visibility": "Vidnost igre",
    "room.private": "Zasebna",
    "room.public": "Javna",
    "room.waitingReady": "Čaka na pripravljenost",
    "room.statsOverall": "Vse {wins}–{losses} · {percent}%",
    "room.statsTitle": "Skupaj",
    "room.karma": "Karma {value}/{max}",
    "karma.explain": "Karma kaže, koliko se lahko zaneseš na igralca. Vsi začnejo z {max}/{max}. Zapustitev partije, ki teče, ob vsaj še enem igralcu odvzame 1 točko (ko poteče čas za vrnitev za mizo), vsake {recovery} končane partije pa vrnejo 1 točko. Karmo vidijo drugi igralci v sobi.",
    "room.statsTarget": "{target} {wins}–{losses} · {percent}%",
    "bot.label": "Bot",
    "rules.title": "Pravila delitve",
    "rules.noDeclarations": "Brez napovedi",
    "rules.withDeclarations": "Z napovedmi",
    "rules.allowBela": "Bela je dovoljena",
    "rules.noBela": "Brez bele",
    "settings.gameName": "Ime za igro",
    "settings.gameNameHint": "Ime, ki ga drugi igralci vidijo za mizo. Spremeniš ga lahko enkrat na sedem dni.",
    "settings.gameNameSaved": "Ime je shranjeno.",
    "settings.gameNameNext": "Ime lahko znova spremeniš {date}.",
    "settings.avatar": "Lik",
    "settings.avatarHint": "Lik, ki ga drugi igralci vidijo za mizo.",
    "settings.alwaysReady": "Vedno pripravljen",
    "settings.alwaysReadyHint": "Samodejno bodi pripravljen.",
    /* ─── Skupno ────────────────────────────────────────────── */
    "common.cancel": "Prekliči",
    "common.save": "Shrani",

    /* ─── Stanje povezave ───────────────────────────────────── */
    "connection.connecting": "Povezovanje…",
    "connection.open": "Povezano",
    "connection.closed": "Povezava je prekinjena — poskušam znova",
    "connection.slow": "Povezava je počasna — poskušam se povezati",

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
    "lobby.target": "{target}",
    "lobby.playing": "Igra poteka",
    "lobby.finishMode.prolaz": "Skozi",
    "lobby.finishMode.dosta": "Dovolj",
    "lobby.private": "Zasebna",
    "lobby.seats": "{taken}/{total} sedežev",
    "lobby.status.LOBBY": "Čaka igralce",
    "lobby.status.PLAYING": "V teku",
    "lobby.status.FINISHED": "Končano",
    "lobby.empty.title": "Ni odprtih sob",
    "lobby.empty.description": "Bodi prvi — odpri sobo in začni takoj.",
    "lobby.form.name": "Ime sobe",
    "lobby.form.namePlaceholder": "npr. Petek zvečer",
    "lobby.form.target": "Igra se do",
    "lobby.form.endRule": "Igra se na",
    "lobby.form.endRule.prolaz": "Skozi",
    "lobby.form.endRule.dosta": "Dovolj",
    "lobby.form.private": "Zasebna soba",
    "lobby.form.minWinRate": "Odstotek zmag",
    "lobby.form.minWinRateNone": "Brez pogoja",
    "lobby.form.moreOptions": "Dodatne možnosti",
    "room.minWinRate": "Najmanj {percent}% zmag",
    "room.minWinRateShort": "≥ {percent}% zmag",

    /* ─── Soba (/igra/soba/:id) ─────────────────────────────── */
    "room.metaTitle": "Soba {name} — bela",
    "room.joining": "Vstopam v sobo…",
    "room.backToLobby": "Nazaj v predsobo",
    "room.invite": "Kopiraj povezavo",
    "room.inviteCopied": "Povezava je kopirana",
    "room.inviteCopyFailed": "Kopiranje ni uspelo — tukaj je povezava",
    "room.sit": "Sedi",
    "room.stand": "Vstani",
    "room.addBot": "Bot",
    "room.removeBot": "Odstrani bota",
    "room.ready": "Pripravljen",
    "room.readyOn": "Pripravljen",
    "room.readyOff": "Pripravljen",
    "room.seatsTaken": "{taken}/{total} sedežev zasedenih",
    "room.start": "Začni igro",
    "room.waitingForHost": "Čaka se, da gostitelj zažene igro.",
    "room.emptySeatsFilled": "Prazne sedeže bodo zapolnili boti.",
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
    "lobby.create.title": "Nastavi svojo mizo",
    "lobby.create.targetAria": "Igraj do {target} točk",
    "lobby.create.private": "Zasebna igra",
    "create.quick.name": "Hitra 163",
    "create.quick.title": "Hitra igra",
    "create.quick.description": "Največ 3 deljenja, prvi delivec je naključen. Zmaga prvi par s 163 točkami, če jih nihče ne doseže, pa tisti z več točkami po tretjem deljenju.",
    "stats.quickLabel": "Hitra",
    "lobby.joinByCode.title": "Pridruži se s kodo",
    "lobby.joinByCode.description": "Vpiši 4-mestno kodo sobe.",
    "lobby.joinByCode.privateTitle": "Vstopi v igro {name}",
    "lobby.joinByCode.privateDescription": "Ta igra je zasebna. Vnesi kodo, ki ti jo je poslal prijatelj.",
    "lobby.joinByCode.codeLabel": "Koda sobe",
    "lobby.joinByCode.codeAria": "Koda sobe, 4 mesta",
    "lobby.joinByCode.clearAria": "Izbriši vse števke",
    "lobby.joinByCode.backspaceAria": "Izbriši zadnjo števko",
    "lobby.joinByCode.enteredAria": "Vnesenih {count} od {total} števk",

    "room.label": "Ime igre",
    "room.codeLabel": "🔒 Koda za vstop: {code}",
    "room.copyCode": "Kopiraj kodo",
    "room.codeCopied": "Koda je kopirana",
    "room.codeCopyFailed": "Kopiranje ni uspelo — tukaj je koda",
    "room.leaveAria": "Zapusti sobo",
    "room.vs": "vs",
    "room.waitingSeat": "Prosto mesto",
    "room.pairAria": "Par {n}",
    "room.addBotCta": "Dodaj bota",
    "room.launch": "Zaženi igro",

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

    /* ─── NOVO (redizajn sedežev, 2026-09-08) ───────────────────────────
       Sedež ima eno samo anatomijo na vseh štirih straneh: avatar z
       oznakami v kotih, tablica z imenom in en status-čip. "{n} s" je
       okrajšava za sekunde (merska enota, ne števna samostalnik), zato
       namenoma nima množinskih oblik. */
    "seat.onTurn": "Na vrsti",
    "seat.secondsShort": "{n} s",
    "seat.calledTrump": "Kliče adut: {suit}",

    /* ─── Klicanje aduta ────────────────────────────────────── */
    "bidding.yourTurn": "Kliči adut",
    "bidding.waitingFor": "{name} izbira adut",
    "bidding.passedSoFar": "Naprej: {names}",
    "bidding.callSuit": "Kliči {suit}",
    "bidding.pass": "Naprej",
    "bidding.mustCall": "Moraš klicati",

    /* ─── Miza ──────────────────────────────────────────────── */
    "table.caller": "kliče",
    "table.holdsTrick": "Drži štih",
    "table.trumpSet": "Adut je {suit}",
    "table.settings": "Nastavitve igre",
    "table.secondsLeft.one": "{n} sekunda",
    "table.secondsLeft.two": "{n} sekundi",
    "table.secondsLeft.few": "{n} sekunde",
    "table.secondsLeft.other": "{n} sekund",
    "table.turnTimeLeft": "Preostali čas za potezo: {seconds} s",

    // Statusna tablica nad roko — kdo je na vrsti in kaj počne.
    "table.turnYou": "Ti si na vrsti",
    "table.turnOther": "{name} je na vrsti",
    "table.turnCalling": "{name} kliče",
    "table.turnYourCall": "Kliči adut",
    "table.phaseBidding": "Klicanje aduta",
    "table.waiting": "Počakaj…",
    "table.spectating": "Gledaš igro",
    "table.spectatorCount": "Gledalci: {count}",

    // Hitri odzivi za mizo (protokol `chat.react`).
    "table.reactions": "Reakcije",
    "table.reactionsToggle": "Prikaži odzive",
    "table.sendReaction": "Pošlji odziv: {reaction}",
    "table.reaction.nicePlay": "Bravo, mojster!",
    "table.reaction.lucky": "Sreča spremlja pogumne!",
    "table.reaction.mistake": "Joj, kaj sem to vrgel?!",
    "table.reaction.angry": "Grrrrr!",
    "table.reaction.hurry": "Dajmo, odigraj že enkrat!",
    "table.reaction.goodGame": "Dobra igra, vse čestitke!",

    "table.trickCount.one": "{n} štih",
    "table.trickCount.two": "{n} štiha",
    "table.trickCount.few": "{n} štihi",
    "table.trickCount.other": "{n} štihov",

    /* ─── Roka ──────────────────────────────────────────────── */
    "hand.ariaLabel": "Tvoje karte",
    "hand.empty": "Nimaš več kart",
    "hand.illegalPlay": "Te karte trenutno ne moreš odigrati.",

    /* ─── Rezultat ──────────────────────────────────────────── */
    "score.us": "Mi",
    "score.them": "Oni",
    "score.target": "do {target}",
    "score.currentDeal": "+{points} točk · {tricks}",
    "score.calledBy": "kliče {name}",
    "score.history": "Zgodovina",
    "score.historyTitle": "Zgodovina delitev",
    // Gledalec nima "svoje" ekipe, zato ekipi poimenujemo kot v protokolu.
    "score.teamA": "Ekipa A",
    "score.teamB": "Ekipa B",
    "score.col.deal": "#",
    "score.col.trump": "Adut",
    "score.col.caller": "Klical",
    "score.col.result": "Izid",
    "score.declarationBonus": "Napovedi",

    /* ─── Napovedi ──────────────────────────────────────────── */
    "declarations.title": "Napovedi",
    "declarations.none": "Nihče nima napovedi.",
    "declarations.noneForTeam": "Ni napovedi",
    "declarations.bela": "Bela +20",

    "bela.title": "Bela!",
    "bela.by": "kliče {name}",
    "trump.calledBy": "{name} kliče {suit}",
    // Klic bele je IZBIRA (game/README.md §1.4): vprašamo enkrat, ko igralec
    // vrže prvo od K/Q aduta. Zavrnitev velja za celotno delitev.
    "bela.ask": "Kličeš belo?",
    "bela.askYes": "Da",
    "bela.askNo": "Ne",

    "belot.title": "BELOT!",

    "belot.congrats": "Čestitamo!",
    "belot.by": "Vseh osem kart — {suit}",
    "belot.wins": "Igra je takoj dobljena",

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
    "over.wonDescription": "Bravo, videti je, da si pravi mojster bele!",
    "over.lostDescription": "Več sreče prihodnjič!",
    "over.finished": "Igra je končana.",
    "over.belotDescription": "{name} je dobil vseh osem kart iste barve in takoj osvojil igro.",
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
    "error.WIN_RATE_TOO_LOW": "Za vstop potrebuješ najmanj {percent}% zmag.",
    "error.ROOM_CODE_REQUIRED": "Za vstop v zasebno sobo je potrebna koda.",
    "error.SPECTATORS_DISABLED": "Ta igra ne dovoljuje gledalcev.",
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
    /* Naslov bloka na vrhu „Postavke igre”: postavke SOBE, uređive dok se
       partija nije počela i samo domaćinu (game/README.md §3). */
    "settings.thisGame": "Nastavitve te igre",
    "settings.title": "Nastavitve igre",
    "settings.sound": "Zvok",
    "settings.reduceMotion": "Zmanjšaj animacije",
    "settings.reduceMotionHint": "Sledi tudi sistemski nastavitvi za zmanjšane animacije.",
    "settings.keepAwake": "Naj zaslon ostane prižgan",
    "settings.deckType": "Vrsta kart",
    "settings.deck.klasicne": "Klasične",
    "settings.deck.moderne": "Moderne",
    "settings.deck.vektorske": "Vektorske",
    "settings.deck.francuske": "Francoske",
    "settings.recommended": "Priporočeno",
    "common.close": "Zapri",

    /* ─── Pravila sobe — vidne značke + potrditev (RoomPanel/CreateGameDialog) ── */
    "room.spectatingFull": "Vsa mesta so zasedena — igro gledaš, dokler se eno ne sprosti.",

    /* ─── Hranjenje sedeža, aktivna soba, vrnitev (game/README.md §3) ─────
       DODANO NA KONEC — ne premikaj in ne briši ključev zgoraj. */
    "active.holdLeft": "Sedež ti hranimo še {time}",
    "active.holdNone": "Sedež je še vedno tvoj.",
    "active.resume": "Vrni se v igro",
    "active.leave": "Zapusti igro",
    "active.seatBadge": "Tvoj sedež",
    "active.status.LOBBY": "Čaka na začetek",
    "active.status.PLAYING": "Igra poteka",
    "active.status.FINISHED": "Končano",

    "reconnect.title": "Povezava je prekinjena",
    "reconnect.hold": "Sedež ti hranimo še {time}",
    "reconnect.retrying": "Poskušam se znova povezati…",
    "reconnect.restored": "Znova si povezan in vrnjen za mizo",
    "phase.dealt": "Razdeljenih je prvih šest kart",
    "phase.dealtHint": "Poglej karte pred klicanjem aduta",
    "phase.declarations": "Preverjajo se napovedi",

    "exit.title": "Zapustiti mizo?",
    "exit.description": "Če ostaneš, igraš naprej. Če izstopiš, se začne dvominutno odštevanje; do izteka se lahko vrneš, nato tvoje mesto prevzame bot.",
    "exit.stay": "Ostani v sobi",
    "exit.leave": "Izstopi iz sobe",

    "missedTurn.title": "Zamudil si potezo",
    "missedTurn.body": "Čas je potekel, zato je bila poteza odigrana namesto tebe.",
    "missedTurn.back": "Nazaj v igro",

    "widget.title": "Aktivna soba",
    "widget.return": "Vrni se",
    "widget.leave": "Izstopi",
    "widget.collapse": "Skrči",
    "widget.expand": "Razširi",
    "widget.dismiss": "Skrij",

    /* ─── Kompakten prostor "Privatna igra" + "Pripravljen" (RoomPanel, mobilna postavitev) ──
       DODANO NA KONEC — ne premikaj in ne briši ključev zgoraj. */
    "room.privateGameShort": "Zasebna",

    /* ─── Semafor, obrnjen prav + eno samo okno ob koncu partije ─────────
       (game/README.md §1.7, §2 — velika številka so točke tekoče deljitve,
       skupni izid partije gre majhen podnjo)
       DODANO NA KONEC — ne premikaj in ne briši ključev zgoraj. */
    "score.matchTotal": "skupaj {total}",
    "over.dismiss": "V redu",

    /* ─── Gledanje štihov (game/README.md §1.8) ──────────────────────────
       Nastavitev sobe s TREMI stanji, izbrana ob odprtju sobe in veljavna za
       vso sobo. Srednje stanje je par igralca, ki ZAČNE štih — nikoli
       "kdo je na potezi".
       DODANO NA KONEC — ne premikaj in ne briši ključev zgoraj. */
    "rules.trickReview": "Gledanje štihov",
    "rules.trickReview.off": "Izklopljeno",
    "rules.trickReview.leaderPair": "Par, ki je na vrsti",
    "rules.trickReview.all": "Vsi",
    "rules.trickReviewShort.off": "Ne",
    "rules.trickReviewShort.leaderPair": "Na vrsti",
    "rules.trickReviewShort.all": "Vsi",
    "rules.trickReviewBadge.off": "Brez gledanja štihov",
    "rules.trickReviewBadge.leaderPair": "Štihe gleda par, ki je na vrsti",
    "rules.trickReviewBadge.all": "Štihe gledajo vsi",

    "tricks.title": "Štihi",
    "tricks.open": "Poglej odigrane štihe",
    "tricks.trickNo": "{n}. štih",
    "tricks.ledBy": "začne {name}",
    "tricks.wonBy": "pobral {name}",
    "tricks.empty": "Odigranih štihov še ni.",
    "tricks.hiddenOff": "Gledanje štihov je v tej sobi izklopljeno.",
    "tricks.hiddenLeaderPair": "Štihe lahko pregleda samo par, ki je začel trenutni štih.",

    /* ─── Ena igra naenkrat (game/README.md §3.2) ───────────────────────── */
    "error.ALREADY_IN_GAME": "Sedež imaš že v drugi igri. Vrni se za mizo ali jo zapusti.",
    "lobby.blockedByActive": "Igra ti že teče. Vrni se za mizo ali počakaj, da se odštevanje izteče.",
    "lobby.blockedRoom": "Vstop ni mogoč — igra ti že teče.",

    /* ─── "Kmalu" (src/game/GameComingSoonPage.tsx) ──────────────────────
       Kar /igra prikaže, dokler je produkcijsko stikalo izklopljeno
       (ops/toggle-game.sh). "Igraj" je odslej vedno v meniju, zato mora ta
       stran sama pojasniti, zakaj igre še ni. Brez odštevanja in brez
       datuma — ne vemo, kdaj se stikalo prižge.
       DODANO NA KONEC — ne premikaj in ne briši ključev zgoraj. */
    "comingSoon.metaTitle": "Igranje bele — kmalu — bela-turniri.com",
    "comingSoon.metaDescription": "Spletna bela je v pripravi. Turnirji, koledar, zemljevid in bela blok delujejo kot doslej.",
    "comingSoon.label": "Bela online",
    "comingSoon.title": "Igranje bele — kmalu",
    "comingSoon.description": "Spletno belo še pripravljamo. Dokler ne bo pripravljena, vse ostalo deluje kot doslej — turnirji, koledar, zemljevid in bela blok.",
    "comingSoon.backToTournaments": "Pojdi na turnirje",
    "comingSoon.openBlok": "Odpri bela blok",

    /* ─── Kdo je v sobi + polna soba (game/README.md §3 "Lobby", §3.2) ────
       Vrstica v predverju zdaj kaže dejanske soigralce (`RoomSummary.occupants`),
       soba brez prostega sedeža in brez gledalcev pa vstop zavrne vnaprej
       (`RoomSummary.joinable`), namesto da bi te tiho spremenila v gledalca.
       Števna družina ima tu tudi dvojino.
       DODANO NA KONEC — ne premikaj in ne briši ključev zgoraj. */
    "lobby.full": "Polna",
    "lobby.fullBlocked": "Soba je polna — ni prostega sedeža.",
    "lobby.emptySeat": "Prost sedež",
    "lobby.occupantsAria": "Za mizo: {names}",
    "lobby.freeSeats.one": "še {n} prost sedež",
    "lobby.freeSeats.two": "še {n} prosta sedeža",
    "lobby.freeSeats.few": "še {n} prosti sedeži",
    "lobby.freeSeats.other": "še {n} prostih sedežev",
    "lobby.spectateHint": "Vsi sedeži so zasedeni — lahko gledaš.",
    "room.sitHere": "Sedi sem",

    /* ─── HUD v3 za mizo (game/DESIGN.md §6) ─────────────────────────────
       Semafor ima zdaj črto napredka proti cilju partije; ta nosi tudi „do
       1001”, zato je stara noga izginila. Črta je visoka le 2 px, zato
       potrebuje izgovorljivo različico — ta ključ je njen `aria-label`,
       nikoli viden tekst.
       DODANO NA KONEC — ne premikaj in ne briši ključev zgoraj. */
    "score.progress": "Skupaj {total} od {target}",
}
