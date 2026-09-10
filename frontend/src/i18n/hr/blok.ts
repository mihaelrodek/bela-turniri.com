/* `blok` — digitalni blok za pisanje bele za stolom uživo (v. `src/blok/BLOK.md`).

   Hrvatski je izvor istine: oblik ove datoteke definira što
   `src/i18n/sl/blok.ts` mora imati, a nedostajući slovenski ključ je
   compile error.

   Domenski pojmovi (bela igrača, ne standardni hrvatski): zvanja, štiglja,
   pad, podjela, adut, zvao — v. BLOK.md §1 i root CLAUDE.md i18n invarijante.
   Imena boja aduta i njihova ikona dolaze iz `game` namespacea (`suit.*` +
   `SuitGlyph`) — ne dupliciraj ih ovdje.

   Brojevi idu kroz `usePlural()` / `tPlural()` s `.one/.two/.few/.other`
   granama (`.two` postoji zbog slovenske dvojine; hrvatski ga nikad ne
   bira). Ovdje su to `entry.added` i `reset.games`. */

export const blok = {
    /* ─── Naslov, navigacija, SEO ───────────────────────────────────── */
    title: "Bela blok",
    nav: "Blok",
    "seo.title": "Blok za bodovanje bele — bela-turniri.com",
    "seo.description":
        "Digitalni blok za bodovanje bele za stolom — upisuj bodove, zvanja i štiglje bez prijave i bez interneta.",

    /* ─── Strane (MI / VI, preimenjivo) ─────────────────────────────── */
    "side.us": "MI",
    "side.them": "VI",
    "side.rename": "Preimenuj",
    "side.renameTitle": "Preimenuj strane",

    /* ─── Postavke igre (bodovi, igra se na, duljina serije) ──────────── */
    // Prvi dio retka iznad zbrojeva u kartici: „Do 1001 · prolaz”
    // (BLOK-HISTORY.md §5.5). Bio je „Cilj” do 2026-09-08.
    "target.label": "DO",
    // `target.custom` („Vlastiti broj”) je obrisan 2026-09-08 sa samim poljem:
    // u dijalogu su ostali samo čipovi 501 / 701 / 1001. Backend i dalje prima
    // bilo koji cilj — suzilo se sučelje, ne pravilo.
    // Naslov dijaloga. Bio je „Promijeni cilj” dok je u njemu bio samo jedan
    // broj; otkad drži i „dosta/prolaz” i „igra se do”, zove se onim što jest
    // (BLOK-HISTORY.md §5.3). Isti tekst nosi i stavka izbornika.
    "target.title": "Postavke",

    /* ─── Popis podjela (glavni zaslon) ──────────────────────────────── */
    "round.addFor": "Dodaj podjelu za {side}",
    // Puni oblik: naslov gumba MI/VI u zaglavlju lista i oznaka točkice u
    // popisu podjela. Sama riječ bez strane je `entry.caller` niže.
    "round.calledBy": "Zvao {side}",
    "round.runningTotal": "ukupno {points}",
    "round.toGo": "za van",
    "round.difference": "razlika",
    "dealer.first": "Prvi dijeli",
    "dealer.next": "Sljedeći dijeli",
    "dealer.self": "Ja",
    "dealer.rightOpponent": "Desni protivnik",
    "dealer.partner": "Partner",
    "dealer.leftOpponent": "Lijevi protivnik",
    // `dealer.clockwise` i `dealer.counterclockwise` su obrisani 2026-09-08:
    // smjer se više ne imenuje rotacijom nego onako kako se za stolom kaže —
    // „Desno” / „Lijevo” (`dealer.right` / `dealer.left` na kraju datoteke).
    // `round.empty` je obrisan 2026-09-08: prazan popis ispod dva očita gumba
    // „MI +” / „VI +” objašnjava sam sebe, pa prazno stanje više ne postoji.
    "round.edit": "Uredi podjelu",
    "round.delete": "Obriši podjelu",
    "round.undoLast": "Poništi zadnju rundu",
    // `.two` je slovenska dvojina; hrvatski je nikad ne traži (vidi
    // `pluralCategory`), ali mora postojati jer `sl` tipizira ovu datoteku.

    /* ─── Unos podjele (donji list) ──────────────────────────────────── */
    // `entry.cards` više nije natpis iznad tipkovnice (v. BLOK.md §3.2) —
    // ostaje kao njezino pristupačno ime (`role="group"`).
    "entry.cards": "Bodovi iz karata",
    // Naslov lista i natpis nad prekidačem MI/VI kojim se bira tko je zvao.
    // Sami gumbi kao pristupačno ime nose puni `round.calledBy` („Zvao MI”).
    "entry.caller": "Zvao",
    "entry.declarations": "Zvanja",
    "entry.stiglja": "Štiglja",
    // Belot — gumb je druga polovica „Štiglje” (BLOK.md §1.2), a ista riječ
    // je i značka na kartici u listu i u retku podjele. Hint je rečenica koja
    // objašnjava što gumb radi: ulazi u pristupačno ime gumba i ispisuje se
    // ispod velikog natpisa u čestitki.
    "entry.belot": "Belot",
    "entry.belotHint": "Osam istih karata — partija je gotova",
    "entry.fell": "PAD",
    // Vidljivo piše „Σ 297”; ova riječ je sr-only ime tog broja, jer čitač
    // ekrana inače pročita „n-ary summation” ili ništa.
    "entry.sum": "Ukupno",
    "entry.save": "Spremi",
    "entry.cancel": "Odustani",
    "entry.clearChip": "Ukloni zvanje {value}",
    // Koliko je puta zvanje dodano — ulazi u ime gumba jer je značka „×2”
    // samo znak. Plural, ne ternar (slovenski ima dvojinu).
    "entry.added.one": "dodano {n} put",
    "entry.added.two": "dodano {n} puta",
    "entry.added.few": "dodano {n} puta",
    "entry.added.other": "dodano {n} puta",
    "entry.clearAll": "Očisti",
    "entry.trump": "Adut",
    "entry.backspace": "Obriši zadnju znamenku",

    /* ─── Kraj igre ──────────────────────────────────────────────────── */
    "winner.us": "Mi smo pobijedili",
    "winner.them": "Vi ste pobijedili",
    // `winner.newGame` („Započni novu igru”) je obrisan 2026-09-08 uz §5.6:
    // riječi „nova igra” od tada pripadaju izborniku, koji ZATVARA seriju, pa
    // ih gumb koji seriju nastavlja ne smije nositi. Zamjenjuje ga
    // `winner.nextGame` („Sljedeća partija”) na kraju datoteke.

    /* ─── Sažetak (kraj igre) ────────────────────────────────────────── */
    "summary.total": "Ukupno",
    "summary.points": "Bodovi",
    "summary.declarations": "Zvanja",
    "summary.stiglje": "Štiglje",

    /* ─── Izbornik ───────────────────────────────────────────────────── */
    // Skraćen 2026-09-08 (BLOK-HISTORY.md §5.3). Obrisano jer je preseljeno,
    // ne ukinuto: `menu.rename` (olovka ispod svakog rezultata to već radi),
    // `menu.archive` (partije su sada u kartici, iza strelice — §5.4) i
    // `menu.share` (gumb u gornjem lijevom kutu kartice, i dijeli poveznicu
    // umjesto teksta — §5.2, ključevi `share.*` na kraju datoteke).
    "menu.title": "Izbornik",
    "menu.newGame": "Nova igra",
    "menu.target": "Postavke",
    "menu.delete": "Obriši igru",

    /* ─── Arhiva odigranih igara ─────────────────────────────────────── */
    // NIJE arhiva — to je profil. Ovdje su partije TEKUĆE serije: puni ih
    // „Nova igra”, a „Resetiraj” cijelu seriju spremi na profil i isprazni
    // ovaj popis. Dvije razine s istim imenom bile su zbunjujuće (2026-09-08).
    "archive.empty": "Još nema odigranih partija u ovoj seriji.",
    // Serije koje su zaključene, ali još nisu stigle na profil (offline, ili
    // korisnik tada nije bio prijavljen). Plural, ne ternar — slovenski dvojina.
    "archive.pending.one": "{n} ranija serija još čeka slanje na profil.",
    "archive.pending.two": "{n} ranije serije još čekaju slanje na profil.",
    "archive.pending.few": "{n} ranije serije još čekaju slanje na profil.",
    "archive.pending.other": "{n} ranijih serija još čeka slanje na profil.",
    // Serije koje je poslužitelj odbio i koje se VIŠE NE POKUŠAVAJU slati
    // (v. `store.ts → rejectSessionUpload`). Rečenica mora reći oboje: da nisu
    // spremljene i da su partije i dalje na uređaju — inače zvuči kao da je
    // večer nestala. Plural, ne ternar — slovenski ima dvojinu.
    "archive.rejected.one":
        "{n} serija nije spremljena na profil. Partije su ostale na uređaju.",
    "archive.rejected.two":
        "{n} serije nisu spremljene na profil. Partije su ostale na uređaju.",
    "archive.rejected.few":
        "{n} serije nisu spremljene na profil. Partije su ostale na uređaju.",
    "archive.rejected.other":
        "{n} serija nije spremljeno na profil. Partije su ostale na uređaju.",

    /* ─── Potvrde (ConfirmDialog, nikad confirm()) ──────────────────── */
    // `confirm.newGame` je obrisan 2026-09-08: „Nova igra” više nije potvrda
    // nego izbor između dvije radnje (`newGame.*` na kraju datoteke, §5.1).
    // `share.text` je obrisan s njim — dijeli se poveznica, ne rečenica (§5.2).
    "confirm.deleteRound": "Obrisati ovu podjelu? Ova radnja se ne može poništiti.",
    "confirm.deleteGame": "Obrisati ovu igru? Ova radnja se ne može poništiti.",

    /* ═══════════════════════════════════════════════════════════════════
       POVEZIVANJE SA STOLOM NA TURNIRU — `BLOK-LINK.md`
       ═══════════════════════════════════════════════════════════════════
       Jedini dio bloka koji uopće traži prijavu i jedini koji zove server.
       Blok bez veze radi točno kao i prije — zato ovdje nema nijednog
       natpisa koji bi se pojavio na neopovezanom bloku.

       Kodovi grešaka (`LINK_EXISTS`, `ROUND_COMPLETED`, …) su strojni i
       NIKAD se ne prevode (root CLAUDE.md); prevodi se rečenica koju
       korisnik vidi umjesto koda. Ključ nosi kod u imenu (`link.error.*`,
       `link.reason.*`) da se `hasTranslation()` može pitati postoji li
       rečenica za kod koji je server poslao, a ako ne postoji, ide opći
       tekst — nikad goli kod na ekranu. */

    /* ─── Ulaz (izbornik) i prijava ──────────────────────────────────── */
    "link.menu": "Poveži sa stolom",
    "link.title": "Poveži blok sa stolom",
    "link.signIn": "Prijavi se",

    /* ─── Tri koraka (turnir → stol → koja strana je koji par) ───────── */
    "link.step.tournament": "Odaberi turnir na kojem igraš.",
    "link.step.table": "Odaberi svoj stol u aktivnoj rundi.",
    "link.step.side": "Reci koji par ste vi — bez toga organizatoru stiže broj bez imena.",
    "link.noTournaments": "Nema turnira koji su u tijeku ili se pripremaju.",
    "link.noTables": "U aktivnoj rundi nema stola koji se može povezati.",
    "link.loadFailed": "Dohvaćanje nije uspjelo.",
    "link.retry": "Pokušaj ponovno",
    "link.back": "Natrag",
    "link.send": "Pošalji zahtjev",

    /* ─── Stol i runda (oznake, ne brojivi pojmovi) ──────────────────── */
    "link.round": "Runda {n}",
    "link.table": "Stol {n}",
    "link.tableUnknown": "Bez broja stola",

    /* ─── Mapiranje strana na parove ─────────────────────────────────── */
    "link.sideQuestion": "Koji par igra kao „{side}”?",
    // Isti ključ nosi i pregled u koraku 3 i redak u traci zaglavlja: obje
    // strane su imenovane vrijednostima (`{us}` / `{them}`), nikad tekstom u
    // rečenici — strane su preimenjive, pa bi zamrznuto „MI”/„VI” bilo krivo
    // čim ih netko nazove „Ivan i Marko”.
    "link.sideMapping": "{us} = {usPair} · {them} = {themPair}",

    /* ─── Traka stanja u zaglavlju ───────────────────────────────────── */
    "link.status.pending": "Čeka odobrenje organizatora",
    "link.status.approved": "Povezano sa stolom",
    "link.status.rejected": "Organizator je odbio povezivanje",
    "link.status.revoked": "Veza sa stolom je prekinuta",
    "link.pendingSend": "Zadnji rezultat još nije poslan — pokušat ćemo ponovno.",
    "link.unlink": "Prekini vezu",
    "link.dismiss": "Ukloni obavijest",
    "link.confirmUnlink": "Prekinuti vezu sa stolom? Rezultat više neće stizati organizatoru.",

    /* ─── Poruke uz uspješne radnje (toast) ──────────────────────────── */
    "link.requested": "Zahtjev je poslan organizatoru.",
    "link.unlinked": "Veza sa stolom je prekinuta.",

    /* ─── Zašto se stol ne može odabrati (`targets[].reason`) ────────── */
    "link.notLinkable": "Ovaj stol se ne može povezati.",
    "link.reason.MATCH_HAS_BYE": "Ovaj stol ima slobodan prolaz, nema protivnika.",
    "link.reason.LINK_EXISTS": "Netko je već zatražio ovaj stol.",

    /* ─── Zašto zahtjev nije prošao ──────────────────────────────────── */
    "link.error.generic": "Zahtjev nije poslan. Pokušaj ponovno.",
    "link.error.LINK_EXISTS": "Netko je već zatražio ovaj stol.",
    "link.error.MATCH_HAS_BYE": "Ovaj stol ima slobodan prolaz, nema protivnika.",
    "link.error.PAIR_NOT_IN_MATCH": "Odabrani par ne igra za ovim stolom.",
    "link.error.ROUND_COMPLETED": "Runda je u međuvremenu završena.",
    "link.error.TOURNAMENT_FINISHED": "Turnir je završen.",

    /* ─── Zašto je veza prestala (409 pri slanju rezultata) ──────────── */
    "link.ended.roundCompleted": "Runda je završena — veza sa stolom je prekinuta.",
    "link.ended.tournamentFinished": "Turnir je završen — veza sa stolom je prekinuta.",
    "link.ended.notApproved": "Veza sa stolom više nije odobrena.",

    /* ═══════════════════════════════════════════════════════════════════
       POVIJEST BLOKOVA NA PROFILU — `BLOK-HISTORY.md`
       ═══════════════════════════════════════════════════════════════════
       „Resetiraj” zatvara seriju: sve partije odigrane za istim stolom
       spremaju se na profil kao JEDAN zapis, pa se brišu s uređaja.

       CIJELI `reset.*` BLOK JE OBRISAN 2026-09-08 (BLOK-HISTORY.md §5.6):
       „Resetiraj” i „Nova igra” bile su dvije riječi za istu radnju, pa je
       stavka „Resetiraj” uklonjena, a njezino značenje je preuzela „Nova
       igra”. Otišli su `menu.reset`, `reset.title`, `reset.confirm`,
       `reset.games.*`, `reset.confirmSignedIn`, `reset.confirmSignedOut`,
       `reset.signedOutNote` i `reset.saved`; zamjenjuju ih `newGame.*` ključevi
       na kraju datoteke, gdje je i objašnjeno što koji kaže. */

    /* ═══════════════════════════════════════════════════════════════════
       SERIJA PARTIJA UNUTAR JEDNOG BLOKA — dodano 2026-09-08
       ═══════════════════════════════════════════════════════════════════
       Blok JEST serija: partije se nižu za istim stolom, rezultat ide
       1 : 0, 2 : 1, 3 : 1, i zatvara ga samo „Resetiraj”. Rezultat serije
       stoji u zaglavlju čim je prva partija gotova.

       ZADANO je otvorena serija — nema broja partija koji je završava.
       Neobavezno se u dijalogu „Promijeni cilj” može reći „igra se do 2” i
       tada serija ima kraj koji zna sama proglasiti.

       `series.games` je brojiva obitelj (`usePlural()`): 1 dobivena igra,
       2–4 dobivene igre, 5+ dobivenih igara. `.two` postoji zbog slovenske
       dvojine; hrvatski ga nikad ne bira. */
    // Natpis nad redom 501 / 701 / 1001 — otkad dijalog nosi DVA broja, svaki
    // od njih treba svoje ime, inače se ne zna koji je koji. Skraćeno s „Cilj
    // bodova” na „Bodovi” 2026-09-08 (zahtjev korisnika): riječ „cilj” je
    // nestala s ekrana zajedno s retkom „Cilj 1001”.
    "target.points": "Bodovi",
    // `series.title` („Serija”) je obrisan 2026-09-08: odjeljak se sada zove
    // „Igra se do” (`series.playTo` na kraju datoteke). `series.custom`
    // („Vlastiti broj igara”) je obrisan s poljem koje je imenovao — čipovi su
    // cijeli izbor (v. `TargetDialog`).
    "series.open": "Neograničeno",
    "series.games.one": "{n} dobivena igra",
    "series.games.two": "{n} dobivene igre",
    "series.games.few": "{n} dobivene igre",
    "series.games.other": "{n} dobivenih igara",
    // `series.hintOpen` je obrisan 2026-09-08 (zahtjev korisnika): rečenica je
    // objašnjavala gumb „Otvorena” koji je bio pritisnut točno iznad nje — isti
    // šum kao `rule.dostaHint` / `rule.prolazHint`. Pod „Otvorena” sada ispod
    // čipova nema ničega.
    // `badgeTarget` je sada dodatak u retku s ciljem u zaglavlju („Cilj 1001 ·
    // do 2 dobivene igre”). `series.score` i `series.scoreAria` su obrisani
    // 2026-09-08 zajedno s centriranom pilulom „SERIJA 2 : 1” — rezultat serije
    // su sada dva mala broja iznad zbrojeva (`series.sideAria` na kraju).
    "series.badgeTarget": "do {games}",
    "series.running": "Serija {usWins} : {themWins}",
    "series.progress": "Serija {usWins} : {themWins} — igra se do {games}",
    "series.won.us": "Mi smo dobili seriju",
    "series.won.them": "Vi ste dobili seriju",
    "series.finish": "Serija je gotova. „Nova igra” je sprema i čisti blok za sljedeću.",

    /* ═══════════════════════════════════════════════════════════════════
       KRAJ PARTIJE („dosta” / „prolaz”) I „IGRA SE DO” — dodano 2026-09-08
       ═══════════════════════════════════════════════════════════════════
       Dvije stvari koje se dogovore prije prve podjele, u istom dijalogu
       („Promijeni cilj”), i dvije različite razine:

       - `rule.*` opisuje kako završava JEDNA partija (do 1001). „Prolaz” je
         ZADANO od 2026-09-08 (odluka korisnika, BLOK-HISTORY.md §5.5): cilj
         mora prijeći strana koja je tu podjelu ZVALA i u njoj PROŠLA. „Dosta”
         (gotovo je čim netko prijeđe cilj) je sada izbor. `rule.dostaHint` i
         `rule.prolazHint` su obrisani 2026-09-08 (zahtjev korisnika): „igra se
         na prolaz” je rečenica koju za stolom svi već znaju, a odlomak ispod
         čipova ju je objašnjavao onima koji su je izgovorili.
       - `series.playTo` je natpis odjeljka o duljini serije; zamijenio je
         `series.title` („Serija”), koji nije govorio što se bira.

       `series.sideAria` je pristupačno ime malog broja iznad zbroja jedne
       strane — pilula „SERIJA 2 : 1” koja je to izgovarala je uklonjena, pa
       svaki broj sada sam kaže što je. Broj ide kroz `series.games`
       (`usePlural()`), nikad kao gola znamenka u rečenici. */
    "series.playTo": "Igra se do",
    "series.sideAria": "Serija — {side}: {games}",
    // Natpis nad čipovima Prolaz / Dosta. Bio je „Kraj partije”; sada se čita
    // kao rečenica koju čipovi dovršavaju („igra se na prolaz”).
    "rule.title": "Igra se na",
    "rule.dosta": "Dosta",
    "rule.prolaz": "Prolaz",

    /* ═══════════════════════════════════════════════════════════════════
       REVIZIJA 2026-09-08 — SPREMANJE, ODIGRANE PARTIJE, DIJELJENJE
       BLOK-HISTORY.md §5.1, §5.2, §5.4
       ═══════════════════════════════════════════════════════════════════
       Tri promjene iz korisnikovih riječi nakon što je blok koristio na
       telefonu:

       `newGame.*` — „Nova igra” više ne govori da se nešto „sprema u
       arhivu”, nego NUDI: spremi seriju na profil pa započni novu partiju u
       istoj seriji, ili započni bez spremanja. Neprijavljeni koji odabere
       spremanje ide na prijavu i vrati se dovršiti radnju; „bez spremanja”
       radi bez računa, uvijek. Zato ovdje nema nijedne rečenice koja tjera
       na prijavu — `newGame.signedOutNote` je konstatacija, ne poziv.

       `games.*` — strelica ispod crte u kartici s rezultatom i redak svake
       završene partije. Kratki natpisi za kontrolu, ne rečenice: kartica je
       zaslon na kojem svaki piksel drži broj. Popis koji se otvara koristi
       postojeće `archive.*` ključeve — oni su oduvijek govorili o partijama
       TEKUĆE serije, a to je točno ono što panel i pokazuje.

       `share.*` — dijeli se POVEZNICA na zapisnik (`/blok/z/{token}`), ne
       tekst s rezultatom, pa nema ni jednog natpisa s brojevima. Serija se
       prije toga spremi (isti put kao §5.1). „Prekini dijeljenje” je jedina
       nepovratna radnja ovdje i zato ide kroz `ConfirmDialog` i stoji u
       izborniku, a ne uz gumb koji poveznicu izdaje. */
    // `newGame.body`, `newGame.saveAndStart`, `newGame.startOnly` i
    // `newGame.saveFailed` su obrisani 2026-09-08 (§5.6): dijaloga s tri ishoda
    // više nema — „Nova igra” zatvara seriju i pita se kroz `ConfirmDialog`.
    // `newGame.saved` i `newGame.signedOutNote` su preseljeni na kraj datoteke,
    // uz ostale ključeve te radnje.

    "games.show": "Prikaži odigrane partije",
    "games.hide": "Sakrij odigrane partije",
    "games.showDeals": "Prikaži podjele ove partije",
    "games.hideDeals": "Sakrij podjele ove partije",

    "share.action": "Podijeli zapisnik",
    // Kad poveznica već postoji: isti gumb, ali je jasno da se ne izdaje nova.
    "share.again": "Podijeli zapisnik (poveznica je aktivna)",
    // Dijeli se ZAPIS, a zapis ne smije sadržavati pola partije (§5.6) — pa
    // dok nijedna partija nije dovršena, nema se što podijeliti.
    "share.nothing": "Nema još nijedne dovršene partije za dijeljenje.",
    "share.failed": "Poveznica nije izdana. Pokušaj ponovno.",
    // `share.stop` i `share.confirmStop` su obrisani 2026-09-08 (zahtjev
    // korisnika): stavka izbornika „Prekini dijeljenje” je zamijenjena
    // prekidačem „Omogući dijeljenje” u „Postavke” (`share.enable` na kraju
    // datoteke). Gašenje prekidača poništava token, a potvrda je `Spremi` u
    // samom dijalogu — zato nema zasebne rečenice za potvrdu.
    "share.stopped": "Dijeljenje je prekinuto.",
    "share.stopFailed": "Prekid dijeljenja nije uspio. Pokušaj ponovno.",

    /* ═══════════════════════════════════════════════════════════════════
       REVIZIJA 2026-09-08 (druga) — „DO 1001 · PROLAZ”
       BLOK-HISTORY.md §5.5
       ═══════════════════════════════════════════════════════════════════
       Redak iznad zbrojeva više ne piše „Cilj 1001” nego „DO 1001”, i uz
       njega UVIJEK stoji pravilo kraja partije — ne samo kad nije zadano.
       Razlog je što se iz istih podjela dobiva različit pobjednik ovisno o
       pravilu: redak koji kaže do koliko se igra mora reći i po čemu.

       Zasebni ključevi `rule.prolazInline` / `rule.dostaInline` drže ovaj
       sažetak neovisnim o natpisima čipova u dijalogu. */
    "rule.prolazInline": "PROLAZ",
    "rule.dostaInline": "DOSTA",

    /* ═══════════════════════════════════════════════════════════════════
       REVIZIJA 2026-09-08 — POVEZIVANJE ZNAČI JAVAN ZAPISNIK
       BLOK-LINK.md §6.2
       ═══════════════════════════════════════════════════════════════════
       Stoji u zadnjem koraku dijaloga, IZNAD gumba koji šalje zahtjev, jer
       je to jedina točka na kojoj se pristanak još može ne dati. Poslije
       toga zapisnik ove serije stoji uz meč u ždrijebu i otvara ga svatko
       tko dobije poveznicu. */
    "link.publicNote":
        "Povezivanjem pristaješ da zapisnik ove serije bude javan: organizator ga vidi uz stol u ždrijebu, a otvoriti ga može svatko tko dobije poveznicu — i nakon turnira.",

    /* ═══════════════════════════════════════════════════════════════════
       REVIZIJA 2026-09-08 (druga) — POVEZIVANJE VIŠE NE TRAŽI PRIJAVU
       BLOK-LINK.md §7
       ═══════════════════════════════════════════════════════════════════
       Dijalog se otvara ravno u izbor turnira. Zid s prijavom je maknut, pa
       su `link.signInTitle` i `link.signInBody` iznad ostali bez pozivatelja
       — namjerno se ne brišu ovdje jer se isti datoteci istovremeno dodaju
       ključevi za „belu”; brisanje ide u zasebnom prolazu.

       Tri nove stvari koje korisnik vidi:
         1. rečenica na vrhu — ovo je alat za turnir, ne za stol kod kuće.
            Bez nje je stavka izbornika obećanje koje se ne može ispuniti;
         2. ime, kad nema računa. Organizator odobrava OSOBU, a „netko za
            nekim stolom” nije osoba (§7.1);
         3. što prijava još donosi — javni zapisnik i poveznica u ždrijebu
            (§7.2). Rečeno jednom, kao dobitak, uz sporednu radnju. */
    "link.tournamentsOnly":
        "Ovo se koristi samo na turnirima: blok se veže na stol u aktivnoj rundi i rezultat ide organizatoru.",
    "link.nameLabel": "Tvoje ime",
    "link.namePlaceholder": "Ime i prezime",
    "link.nameHelp": "Organizator odobrava osobu, pa mora vidjeti tko traži stol.",
    "link.nameTooShort": "Upiši ime, barem dva znaka.",
    // Server odbija zahtjev bez potpisa (400 `NAME_REQUIRED`). Ključ nosi kod
    // u imenu jer `codeMessage()` traži rečenicu upravo po njemu.
    "link.error.NAME_REQUIRED": "Upiši ime — organizator ne može odobriti zahtjev bez potpisa.",
    "link.signedOutGain":
        "Rezultat stiže organizatoru i bez prijave. S prijavom uz njega ide i javni zapisnik serije, s poveznicom u ždrijebu.",

    /* ═══════════════════════════════════════════════════════════════════
       REVIZIJA 2026-09-08 (treća) — BLOK SAM PONUDI STOL
       BLOK-LINK.md §8
       ═══════════════════════════════════════════════════════════════════
       Traka na vrhu, kad server prepozna da prijavljeni igrač sjedi za
       stolom u aktivnoj rundi. Ponuda, ne obavijest: zato „Vodi zapisnik?”
       i dvije radnje, a odbijanje se pamti za taj meč.

       `offer.pairs` imenuje obje strane vrijednostima — par se ne sklanja u
       rečenici, a i turnirska imena parova su vlastita imena. */
    "link.offer.title": "Igraš na turniru {tournament}",
    "link.offer.pairs": "{pair} protiv {opponent}",
    "link.offer.action": "Vodi zapisnik",
    "link.offer.dismiss": "Ne, hvala",

    /* ═══════════════════════════════════════════════════════════════════
       POSTAVKE: DOGOVORI O DIJELJENJU KARATA — 2026-09-08, zahtjev korisnika
       BLOK.md §3.3.2
       ═══════════════════════════════════════════════════════════════════
       Dvije nove stavke u dijalogu „Postavke”, uz bodovni cilj, „igra se na”
       i „igra se do”:

         1. prekidač „Sljedeći dijeli” — traka iznad gumba MI/VI postaje
            neobavezna. Natpis prekidača NE dobiva vlastiti ključ: nosi ga
            `dealer.next`, isti onaj koji piše na samoj traci, pa se postavka
            i ono što ona pali ne mogu prozvati različitim imenima;
         2. „Smjer kartanja” — na koju stranu ide dijeljenje oko stola.

       Smjer se imenuje onako kako se za stolom kaže („dijeli se u desno”), a
       ne rotacijom: `dealer.clockwise` / `dealer.counterclockwise` su zato
       obrisani. Ista dva ključa nose i čipovi u dijalogu i sredinji gumb u
       listu djelitelja — jedna vrijednost, jedno ime. */
    "dealer.direction": "Smjer kartanja",
    /* Tko miješa PRVU podjelu SLJEDEĆE partije — BLOK.md §3.3.4. Ne dira
       podjele UNUTAR partije; one i dalje idu po `dealer.direction`.
       „Sljedeći” = rotacija ide dalje oko stola; „Pobjednik” = rotacija ide
       dalje istim smjerom, ali preskače par koji je izgubio. */
    /* Dvije upute na kartici sažetka partije — strelica pokazuje na ono što je
       već na ekranu (partije serije gore iza chevrona, gumb dolje). */
    /* Kad je ekipa upisala svoje ime, zove se njime; MI/VI je ono na što se
       vraća bezimena strana. */
    "winner.named": "{name} su pobijedili",
    "series.wonNamed": "{name} su dobili seriju",
    "summary.reviewGames": "pogledaj prethodne partije",
    "summary.startNextGame": "započni novu igru",
    "summary.startNewSeries": "započni novu seriju",
    "dealer.newGame": "Novu partiju miješa",
    "dealer.newGameNext": "Sljedeći",
    "dealer.newGameWinner": "Pobjednik",
    "dealer.right": "Desno",
    "dealer.left": "Lijevo",

    /* ═══════════════════════════════════════════════════════════════════
       REVIZIJA 2026-09-08 (treća) — „NOVA IGRA” ZATVARA SERIJU
       BLOK-HISTORY.md §5.6, i prekidač „Omogući dijeljenje”
       ═══════════════════════════════════════════════════════════════════
       Korisnik: „Nova igra bi trebalo staviti rezultate na 0:0 i one trenutne
       igre spremiti (osim ako partija nije dovršena onda se ona ne sprema)”.

       Tri natpisa i tri radnje, i svaki mora reći koja je koja:

         `menu.newGame`      izbornik — ZATVARA seriju: dovršene partije idu na
                             profil, rezultat serije se vraća na 0:0, blok
                             ostaje prazan;
         `winner.nextGame`   sažetak, ispod dobivene partije — SLJEDEĆA
                             PARTIJA unutar iste serije, tekući 2 : 1 se
                             nastavlja. Zato „partija”, a ne „igra”: ista bi
                             riječ vratila zbrku koju je ova revizija maknula;
         `menu.delete`       „Obriši igru” — baci podjele tekuće partije,
                             serija ostaje. Nepromijenjeno.

       Potvrda za „Novu igru” ide kroz `ConfirmDialog` i mora reći OBOJE: što
       se sprema i da rezultat serije ide na 0:0. Tri rečenice umjesto jedne s
       ogradom, jer se stvarno razlikuju: prijavljenom se serija sprema
       (`confirmSignedIn`), neprijavljenom se samo briše (`confirmSignedOut`),
       a kad nijedna partija nije dovršena nema se što spremiti
       (`confirmNothing`) — „serija (0 partija) sprema se…” bila bi laž koju
       piše predložak. `confirmUnfinished` se dodaje kao zasebna rečenica kad
       uz dovršene partije stoji i nedovršena tekuća: spajaju se razmakom, pa
       se ništa gramatički ne sastavlja ni u jednom jeziku.

       `newGame.games` je brojiva obitelj (`usePlural()`): 1 dovršena partija,
       2–4 dovršene partije, 5+ dovršenih partija. `.two` postoji zbog
       slovenske dvojine; hrvatski ga nikad ne bira.

       `share.enable` je prekidač u „Postavke” koji je zamijenio stavku
       izbornika „Prekini dijeljenje” — zadano UKLJUČEN. Ugašen: gumb za
       dijeljenje se ne nudi, a token koji je korisnik sam izdao se poništava.
       `share.linkedNote` je jedina iznimka i piše samo dok veza sa stolom
       postoji: taj zapisnik organizator otvara iz ždrijeba (BLOK-LINK.md
       §6.2) i ostaje javan bez obzira na prekidač. */
    "winner.nextGame": "Sljedeća partija",
    "newGame.games.one": "{n} dovršena partija",
    "newGame.games.two": "{n} dovršene partije",
    "newGame.games.few": "{n} dovršene partije",
    "newGame.games.other": "{n} dovršenih partija",
    "newGame.confirmSignedIn":
        "Serija ({games}) sprema se u Blok na tvom profilu, a rezultat serije se vraća na 0:0.",
    "newGame.confirmSignedOut":
        "Serija ({games}) briše se s ovog uređaja, a rezultat serije se vraća na 0:0. Povijest se čuva samo prijavljenim igračima.",
    "newGame.confirmNothing":
        "Nijedna partija nije dovršena, pa se ništa ne sprema. Blok se prazni i rezultat serije se vraća na 0:0.",
    "newGame.confirmUnfinished": "Tekuća partija nije dovršena i ne sprema se.",
    "newGame.signedOutNote": "Povijest blokova čuva se samo prijavljenim igračima.",
    "newGame.saved": "Serija je spremljena u Blok na tvom profilu.",
    "share.enable": "Omogući dijeljenje partije poveznicom",
    "share.linkedNote":
        "Zapisnik povezanog stola ostaje javan — organizator ga otvara iz ždrijeba.",
}

/** Ugovor koji svaki drugi jezik mora zadovoljiti za `blok`. */
export type BlokDict = typeof blok
