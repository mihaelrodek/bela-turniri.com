/* `profile` — public + own profile copy — settings, avatar, pair presets,
   participation history.

   Croatian is the source of truth: this file's shape defines what
   `src/i18n/sl/profile.ts` must provide, and a missing Slovenian key is a
   compile error. Keys are flat within the namespace (leaf names may contain
   dots; `t()` splits at the first dot only), and are addressed as
   `t("profile.someKey")`.

   Owned by ONE agent of the extraction pass — nobody else edits this file. */

export const profile = {
    // --- Document head / SEO (PublicProfilePage sets these) ----------------
    // `useDocumentHead` currently pins the tab title to a static string and
    // ignores `title`, but the page still passes one, so it is translated.
    "seo.title": "{name} — Bela igrač | bela-turniri.com",
    "seo.titleFallback": "Bela igrač — bela-turniri.com",
    "seo.description": "{name} — povijest nastupa na Bela turnirima. {tournaments}, {wins}.",
    "seo.ogDescription": "Povijest nastupa na Bela turnirima — {tournaments}, {wins}.",
    // Person/BreadcrumbList JSON-LD — read by humans in search results.
    "seo.knowsAboutCardGames": "Kartaške igre",
    "seo.breadcrumbPlayers": "Igrači",

    /* --- Counts ------------------------------------------------------------
       The pre-i18n code interpolated a single fixed noun form regardless of
       the number ("1 turnira"), and this extraction is a move, not a rewrite:
       every Croatian category below is therefore the SAME string the page
       renders today. Slovenian gets the grammatically correct four forms.
       See the extraction report — the Croatian `one` form is a real (pre-
       existing) grammar bug and wants a product decision, not a silent fix. */
    "tournamentsCount.one": "{n} turnir",
    "tournamentsCount.two": "{n} turnira",
    "tournamentsCount.few": "{n} turnira",
    "tournamentsCount.other": "{n} turnira",
    "winsCount.one": "{n} pobjeda",
    "winsCount.two": "{n} pobjede",
    "winsCount.few": "{n} pobjede",
    "winsCount.other": "{n} pobjeda",

    // --- Load / error states -----------------------------------------------
    notFound: "Profil nije pronađen.",
    loadFailed: "Greška pri dohvaćanju profila.",
    unavailable: "Profil nije dostupan.",
    back: "Natrag",
    toTournaments: "Na turnire",
    // bela.games has no tournaments — used instead of `toTournaments` there.
    toHome: "Na početnu",

    // --- Section nav (owner-only; admin sections gated on the role claim) ---
    // Rendered as a stacked list in the desktop sidebar card and as a wrapping
    // pill row in the collapsed card above the content on smaller screens.
    "tab.tournaments": "Turniri",
    "tab.presets": "Predlošci",
    "tab.invoices": "Računi",
    "tab.dashboard": "Dashboard",
    "tab.gameAnalytics": "Analitika igre",
    "tab.playersList": "Popis igrača",
    "tab.contactMessages": "Poruke",
    // bela.games only — replaces "tab.tournaments" (see sections.ts).
    "tab.gameStats": "Statistika",

    // --- Turniri tab (the one view visitors also get) ----------------------
    "tournaments.heading": "Turniri",
    // Visitor-facing wording — talks about "the player", not "you".
    "tournaments.emptyNoPairs": "Igrač nije odigrao niti jedan turnir.",
    "tournaments.partnerLabel": "Suvlasnik:",
    "tournaments.searchPlaceholder": "Pretraga: naziv turnira ili lokacija…",
    "tournaments.emptyFiltered": "Nema turnira za odabrane filtere.",

    // --- Profile header: avatar, name, phone -------------------------------
    "nav.sectionsAria": "Odjeljci profila",
    "avatar.alt": "Profilna slika",
    "avatar.change": "Promijeni profilnu sliku",
    "avatar.upload": "Učitaj profilnu sliku",
    "avatar.uploadFailed": "Neuspjelo učitavanje slike",
    "avatar.cropTitle": "Obreži profilnu sliku",
    "avatar.cropHint": "Povuci i promijeni veličinu okvira — krug pokazuje što će se vidjeti.",
    "avatar.cropConfirm": "Spremi",
    "avatar.remove": "Ukloni profilnu sliku",
    "avatar.removeConfirmTitle": "Ukloniti profilnu sliku?",
    "avatar.removeConfirmBody": "Tvoj profil će opet prikazivati inicijale.",
    "avatar.removeConfirmLabel": "Ukloni",
    unnamedPlayer: "Bezimeni igrač",
    // Shown to anonymous visitors only — the backend redacts the number.
    "phone.loginToSee": "Prijavi se da vidiš broj",
    "phone.loginHint": "(prijavi se)",

    // --- Postavke › Moji podaci (owner) ------------------------------------
    // The one place the owner's own record is edited: avatar, name, phone.
    // "Korisničko ime" is the profile slug — the /profil/{slug} address.
    "details.title": "Moji podaci",
    "details.description": "Profilna slika, ime, korisničko ime i broj telefona.",
    "details.edit": "Uredi",
    "details.nameLabel": "Ime",
    "details.usernameLabel": "Korisničko ime",
    "details.phoneLabel": "Broj telefona",
    "details.notSet": "Nije upisano",

    // --- Edit-profile dialog (owner) ---------------------------------------
    "edit.title": "Uredi profil",
    "edit.nameLabel": "Ime",
    "edit.namePlaceholder": "npr. Marko Marković",
    "edit.nameRequired": "Ime ne može biti prazno.",
    "edit.phoneLabel": "Broj telefona",
    "edit.phoneOptional": "(opcionalno)",
    /* ─── Avatari (likovi umjesto fotografije) ──────────────── */
    "avatar.pickerLabel": "Izaberi lik",
    "avatar.dialogTitle": "Profilna slika",
    "avatar.usePhotoAgain": "Koristi ovu fotografiju",
    "avatar.photoHint": "Uploadaj vlastitu sliku i izreži je u krug.",
    "avatar.chooseTitle": "Lik",
    "avatar.chooseHint": "Izaberi lik ili uploadaj vlastitu sliku.",
    "avatar.usePhoto": "Koristi sliku",
    "avatar.useCharacter": "Koristi lik",
    "avatar.name.kralj": "Kralj",
    "avatar.name.baba": "Baba",
    "avatar.name.decko": "Dečko",
    "avatar.name.dida": "Dida",
    "avatar.name.baka": "Baka",
    "avatar.name.gazda": "Gazda",
    "avatar.name.konobar": "Konobar",
    "avatar.name.cura": "Cura",
    "avatar.name.momak": "Momak",
    "avatar.name.kibic": "Kibic",
    "avatar.name.gospon": "Gospon",
    "avatar.name.sudac": "Sudac",
    "avatar.name.teta": "Teta",
    "avatar.name.profa": "Profa",
    "avatar.name.mornar": "Mornar",
    "avatar.name.seka": "Seka",
    // Photo always wins over a picked character while both exist
    // (AvatarPresetService.presetFor) — shown only when the user has a photo,
    // so a picked face that doesn't visibly apply isn't a silent no-op.
    "avatar.choosePhotoNotice": "Trenutačno prikazuješ fotografiju — ona ima prednost. Odabrani lik prikazat će se tek kad fotografiju ukloniš.",
    "avatar.pickFailed": "Spremanje lika nije uspjelo",
    // Bare wire code INVALID_AVATAR_PRESET (services/AvatarPresetService) —
    // unreachable from this picker (it only ever sends AVATAR_IDS), kept for
    // a stale client that still knows an id this backend no longer accepts.
    "avatar.invalidPreset": "Taj lik više ne postoji. Osvježi stranicu i pokušaj ponovno.",
    "edit.gameNameLabel": "Ime za igru",
    "edit.gameNameEmpty": "Nije postavljeno",
    "edit.gameNameHint": "Ime koje ostali igrači vide za stolom. Mijenja se u postavkama igre.",
    "edit.phonePlaceholder": "91 234 5678",
    "edit.saveFailed": "Greška pri spremanju.",

    // --- Pair chips ---------------------------------------------------------
    "pair.sharedTitle": "Podijeljeno s partnerom",

    // --- Tournament row: status badge + expanded match list -----------------
    "status.winner": "Pobjednik",
    "status.pendingApproval": "Čeka odobrenje",
    "status.eliminated": "Eliminiran",
    "status.active": "Aktivan",
    "status.finished": "Završen",
    "status.announced": "Najavljen",
    record: "{wins}W – {losses}L",
    extraLife: "Život",
    openTournament: "Otvori turnir",
    "matches.loadFailed": "Greška pri dohvaćanju mečeva.",
    "matches.empty": "Nema odigranih mečeva.",
    "match.bye": "Bye",
    "match.won": "Pobjeda",
    "match.lost": "Poraz",
    "match.resolved": "Riješeno",
    "match.inProgress": "U tijeku",
    "match.round": "Kolo {n}",
    "match.table": "Stol {n}",
    vs: "vs",

    // --- Predlošci tab › Moji parovi (owner) -------------------------------
    "pairs.title": "Moji parovi",
    "pairs.description": "Ovdje možeš spremiti svoje parove. Podijeli par sa partnerom da se par pojavi i na njegovom profilu ili ga sakrij od drugih ako ga ne želiš prikazivati javno.",
    "pairs.namePlaceholder": "npr. Marko & Pero",
    "pairs.add": "Dodaj",
    "pairs.empty": "Nemaš spremljenih parova.",
    "pairs.hidden": "Skriveno",
    "pairs.show": "Prikaži",
    "pairs.hide": "Sakrij",
    "pairs.showTitle": "Prikaži drugima",
    "pairs.hideTitle": "Sakrij od drugih",
    "pairs.edit": "Uredi",
    // Owner-side label for a preset the partner has already claimed.
    "pairs.roleCoOwnerLabel": "Suvlasnik:",
    "pairs.roleOwnerLabel": "Vlasnik:",
    "pairs.notShared": "Nije podijeljeno",
    "pairs.share": "Podijeli sa partnerom",
    "pairs.linkCopiedTitle": "Poveznica kopirana",
    "pairs.linkCopiedBody": "Pošalji ju partneru.",
    "pairs.copyFailedTitle": "Ne mogu kopirati u međuspremnik",
    "pairs.copyFailedBody": "Kopiraj ručno: {url}",
    // Archive (delete) request flow for a co-owned pair.
    "pairs.requestDeleteAria": "Pošalji zahtjev za brisanje",
    "pairs.requestDeleteTitle": "Pošalji zahtjev za brisanje partneru",
    "pairs.partnerRequestedDelete": "Partner traži brisanje",
    "pairs.accept": "Prihvati",
    "pairs.reject": "Odbij",
    "pairs.requestSent": "Zahtjev poslan — čeka odgovor",
    "pairs.cancelRequest": "Otkaži",
    "pairs.deleteRequestDialogTitle": "Pošalji zahtjev za brisanje?",
    "pairs.deleteRequestBody": "Par {name} je podijeljen s {partner}. Zahtjev će biti poslan partneru — par se briše tek kad ga prihvati.",
    "pairs.sendRequest": "Pošalji zahtjev",
    "pairs.deleteDialogTitle": "Obrisati par?",
    "pairs.deleteBody": "Sigurno želiš obrisati {name}? Ova radnja se ne može poništiti.",
    "pairs.deleted": "Par obrisan",
    "pairs.deleteBlockedTitle": "Ne može se obrisati",
    "pairs.deleteBlockedBody": "Pokušaj poslati zahtjev partneru.",
    "pairs.deleteFailed": "Brisanje nije uspjelo",
    "pairs.cancelFailed": "Otkazivanje nije uspjelo",
    "pairs.confirmFailed": "Greška pri potvrdi",
    "pairs.rejectFailed": "Odbijanje nije uspjelo",

    // --- Predlošci tab › Moji cjenici (owner) ------------------------------
    "templates.title": "Moji cjenici",
    "templates.description": "Organiziraš turnir? Spremi svoje cjenike pića koje možeš učitati na svom turniru jednim klikom.",
    "templates.empty": "Nemaš spremljenih predložaka.",
    "templates.newNamePlaceholder": "Naziv novog predloška",
    "templates.create": "Stvori",
    "templates.duplicateName": "Predložak s tim nazivom već postoji.",
    "templates.back": "Natrag",
    "templates.saveName": "Spremi naziv",
    "templates.rename": "Preimenuj",
    "templates.deleteAria": "Obriši predložak",
    "templates.quickAdd": "Brzo dodaj:",
    "templates.emptyRows": "Predložak je prazan. Dodaj pića ispod.",
    "templates.rowNamePlaceholder": "Naziv (npr. Pivo)",
    "templates.rowPricePlaceholder": "Cijena",
    "templates.rowRemove": "Ukloni",
    "templates.addRow": "Dodaj",
    "templates.save": "Spremi predložak",
    "templates.deleteDialogTitle": "Obrisati predložak?",
    "templates.deleteBody": "Predložak „{name}“ i sve njegove cijene bit će trajno obrisani.",

    // --- Postavke tab (owner) ----------------------------------------------
    "settings.title": "Postavke",
    "settings.description": "Personalizirane postavke aplikacije i tvog profila.",
    "settings.theme": "Tema",
    "settings.light": "Svijetla",
    "settings.dark": "Tamna",
    "settings.themeHint": "Odabir se sprema uz tvoj račun pa te prati na svim uređajima.",
    "settings.language": "Jezik",
    "settings.languageHint": "Mijenja jezik sučelja i poruka poslužitelja. Sprema se uz tvoj račun.",

    // --- Računi tab (owner) -------------------------------------------------
    "invoices.title": "Računi",
    "invoices.description": "Pregled računa po stolovima na turnirima na kojima si igrao.",
    "invoices.empty": "Nemaš još nijedan račun.",
    "invoices.round": "Runda {n}",
    "invoices.table": "Stol {n}",
    "invoices.paid": "Plaćeno",
    "invoices.yourBill": "Tvoj račun",
    "invoices.open": "Otvoreno",
    "invoices.win": "Pobjeda",
    "invoices.dialogTitleFallback": "Račun",
    "invoices.noDrinks": "Nema dodanih pića.",
    "invoices.total": "Ukupno",

    // --- Turniri tab › Statistika igranja (owner) -----------------------
    "gameStats.title": "Statistika igranja",
    "gameStats.loadFailed": "Greška pri dohvaćanju statistike.",
    "gameStats.emptyNoGames": "Još nema odigranih partija.",
    "gameStats.games.one": "{n} partija",
    "gameStats.games.two": "{n} partije",
    "gameStats.games.few": "{n} partije",
    "gameStats.games.other": "{n} partija",
    "gameStats.wins.one": "{n} pobjeda",
    "gameStats.wins.two": "{n} pobjede",
    "gameStats.wins.few": "{n} pobjede",
    "gameStats.wins.other": "{n} pobjeda",
    "gameStats.losses.one": "{n} poraz",
    "gameStats.losses.two": "{n} poraza",
    "gameStats.losses.few": "{n} poraza",
    "gameStats.losses.other": "{n} poraza",
    "gameStats.winRate": "Postotak pobjeda",
    "gameStats.karma": "Karma",
    "gameStats.karmaHint": "Svi kreću s {max}/{max}. Napuštena partija je −1, tri odigrane vraćaju +1.",
    "gameStats.abandons": "Napuštanja",
    "gameStats.categoryStats": "{wins}/{n} ({winRate}%)",
    "gameStats.targetScore.163": "Brza 163",
    "gameStats.targetScore.501": "Do 501",
    "gameStats.targetScore.701": "Do 701",
    "gameStats.targetScore.1001": "Do 1001",

    /* ═══════════════════════════════════════════════════════════════════
       BLOK TAB — privatna povijest odigranih blokova (BLOK-HISTORY.md §4)
       ═══════════════════════════════════════════════════════════════════
       Vidljivo samo vlasniku profila, isti mehanizam kao "predlosci" /
       "racuni" (v. pages/profile/sections.ts i PublicProfilePage.tsx).
       Pojmovi zvanja/štiglja/pad/adut/partija su iz `blok` namespacea
       (`blok.entry.*`, `blok.side.*`) — namjerno se ne dupliciraju ovdje. */
    "tab.blok": "Blok",
    "blok.title": "Blok",
    "blok.description": "Povijest odigranih blokova — serije partija spremljene s tvog uređaja.",
    "blok.loadFailed": "Greška pri dohvaćanju povijesti.",
    "blok.empty": "Još nema spremljenih serija.",
    "blok.emptyHint": "Serija se sprema kad na Bloku odabereš „Resetiraj”.",
    "blok.gamesCount.one": "{n} partija",
    "blok.gamesCount.two": "{n} partije",
    "blok.gamesCount.few": "{n} partije",
    "blok.gamesCount.other": "{n} partija",
    "blok.detailTitleFallback": "Serija",
    "blok.detailLoadFailed": "Greška pri dohvaćanju serije.",
    "blok.deleteDialogTitle": "Obrisati seriju?",
    "blok.deleteBody": "Sigurno želiš obrisati seriju {result}? Ova radnja se ne može poništiti.",
    "blok.deleted": "Serija obrisana",

    /* ═══════════════════════════════════════════════════════════════════
       REVIZIJA 2026-09-08 (druga) — „Do 1001 · prolaz”
       BLOK-HISTORY.md §5.5
       ═══════════════════════════════════════════════════════════════════
       Isti natpis kao na dijeljenom zapisniku i na kartici bloka: „Do” umjesto
       „Cilj”, i pravilo kraja partije uz cilj. Malo slovo jer je riječ usred
       retka, iza točke — čipovi u postavkama i dalje pišu „Dosta” / „Prolaz”
       (`blok.rule.*` u `blok` rječniku).

       Broj partija OSTAJE u ovom retku, za razliku od dijeljenog zapisnika:
       redak u popisu serija ne izlistava partije ispod sebe (one su u
       dijalogu, jedan dodir dalje), pa je ovo jedino mjesto gdje se broj
       kaže.

       U dijalogu `components/BlokGamesList.tsx` prikazuje rezultat serije
       nakon svake partije uz rezultat te partije.

       NADIĐENO: `blok.target` i `blok.gameHeading` više se nigdje ne
       pozivaju. */
    "blok.meta": "Do {target} · {rule}",
    "blok.rule.dosta": "dosta",
    "blok.rule.prolaz": "prolaz",

    /* ═══════════════════════════════════════════════════════════════════
       SIGURNOST KORISNIKA — prijava sadržaja, blokiranje, brisanje računa
       ═══════════════════════════════════════════════════════════════════
       Tri značajke koje App Store traži za aplikaciju s korisničkim
       sadržajem. Sve tri žive u ovom rječniku jer su jedna obitelj, iako se
       dijalog za prijavu otvara i sa stranice turnira — natpisi ULAZA
       („Prijavi turnir”, „Prijavi par”) su u `tournament`, sve ostalo ovdje.
       Strojni kodovi (`SPAM`, `CANNOT_REPORT_SELF`…) se nikad ne prevode;
       ključevi ispod samo daju čitljiv tekst za svaki od njih. */

    // --- Prijava sadržaja (components/ReportDialog.tsx) ---------------------
    "actions.more": "Više opcija",
    "report.title": "Prijavi sadržaj",
    "report.body": "Prijavljuješ: {target}. Prijavu pregledava administrator.",
    "report.profileItem": "Prijavi profil",
    "report.reason.SPAM": "Neželjeni sadržaj (spam)",
    "report.reason.OFFENSIVE": "Uvredljiv ili neprimjeren sadržaj",
    "report.reason.PERSONAL_DATA": "Tuđi osobni podaci",
    "report.reason.OTHER": "Nešto drugo",
    "report.messageLabel": "Opis (nije obavezno)",
    "report.messagePlaceholder": "Ukratko opiši što nije u redu…",
    "report.submit": "Pošalji prijavu",
    "report.success": "Hvala, prijava je zaprimljena.",
    "report.error.rateLimited": "Previše prijava, pokušaj kasnije",
    "report.error.self": "Ne možeš prijaviti vlastiti sadržaj",
    "report.error.notFound": "Sadržaj više ne postoji",
    "report.error.generic": "Slanje prijave nije uspjelo",

    // --- Blokiranje --------------------------------------------------------
    "blocks.blockItem": "Blokiraj korisnika",
    "blocks.confirmTitle": "Blokirati korisnika?",
    "blocks.confirmBody":
        "{name} više neće vidjeti tvoj profil, niti ti njegov. Turniri koje je taj korisnik organizirao nestaju s tvog popisa. Blokadu možeš poništiti u postavkama profila.",
    "blocks.blocked": "{name} je blokiran",
    "blocks.failed": "Blokiranje nije uspjelo",
    "blocks.heading": "Blokirani korisnici",
    "blocks.description": "Korisnici koje si blokirao — njihov profil i turniri su ti skriveni.",
    "blocks.loadFailed": "Nije moguće učitati popis blokiranih.",
    "blocks.empty": "Nemaš blokiranih korisnika.",
    "blocks.unblock": "Odblokiraj",
    "blocks.unblocked": "Blokada je uklonjena",

    // --- Brisanje računa (pages/profile/DeleteAccountCard.tsx) --------------
    /* Riječ koju korisnik mora upisati. VELIKIM SLOVIMA i bez dijakritike u
       usporedbi — tipkovnica na mobitelu sama piše veliko slovo, pa se
       uspoređuje neosjetljivo na velika/mala slova. */
    "deleteAccount.confirmWord": "OBRIŠI",
    "deleteAccount.heading": "Brisanje računa",
    "deleteAccount.what":
        "Brisanjem računa nestaju tvoj profil, profilna slika, broj telefona i sve postavke.",
    "deleteAccount.keeps":
        "Turniri koje si organizirao i rezultati koje su drugi odigrali ostaju, ali uz tvoje ime piše „Obrisani korisnik”.",
    "deleteAccount.button": "Obriši račun",
    "deleteAccount.dialogTitle": "Obrisati račun?",
    "deleteAccount.dialogBody": "Ova radnja se ne može poništiti.",
    "deleteAccount.typePrompt": "Za potvrdu upiši {word}:",
    "deleteAccount.confirmButton": "Obriši račun",
    "deleteAccount.done": "Račun je obrisan",
    "deleteAccount.failed": "Brisanje računa nije uspjelo",
    "deleteAccount.recentLogin": "Prijavi se ponovno pa pokušaj opet",
    /* Prikazuje se samo kad je opoziv Apple tokena pao (otkazana prijava,
       blokiran skočni prozor). Račun je u tom trenutku VEĆ obrisan, pa tekst
       govori što korisniku preostaje, a ne da je nešto propalo. */
    "deleteAccount.appleRevokeFailed":
        "Račun je obrisan, ali pristup Apple prijavi nismo uspjeli opozvati. Ukloni aplikaciju u Postavke → Apple ID → Prijava s Appleom.",
    "deleteAccount.moreInfo": "Detaljno: što se briše, a što ostaje",
}

/** Contract every other locale's `profile` namespace must satisfy. */
export type ProfileDict = typeof profile
