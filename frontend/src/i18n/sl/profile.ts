import type { ProfileDict } from "../hr/profile"

/* Slovenian `profile`. Typed as the Croatian namespace, so a dropped or
   misspelled key fails `tsc` instead of silently falling back at runtime.
   Register: informal second person, matching the Croatian copy.

   Machine-assisted translation — a native speaker should review it before
   release. Notes for that review are in the extraction report; the ones worth
   repeating here: the count families below carry the Slovenian dual, the
   Croatian original does not decline them at all, and `record` renders the
   win/loss shorthand as Z/P where Croatian uses W/L. */

export const profile: ProfileDict = {
    // --- Document head / SEO -----------------------------------------------
    "seo.title": "{name} — igralec Bele | bela-turniri.com",
    "seo.titleFallback": "Igralec Bele — bela-turniri.com",
    "seo.description": "{name} — zgodovina nastopov na turnirjih Bele. {tournaments}, {wins}.",
    "seo.ogDescription": "Zgodovina nastopov na turnirjih Bele — {tournaments}, {wins}.",
    "seo.knowsAboutCardGames": "Igre s kartami",
    "seo.breadcrumbPlayers": "Igralci",

    // --- Counts (dual kept: 1 turnir, 2 turnirja, 3-4 turnirji, 5+ turnirjev)
    "tournamentsCount.one": "{n} turnir",
    "tournamentsCount.two": "{n} turnirja",
    "tournamentsCount.few": "{n} turnirji",
    "tournamentsCount.other": "{n} turnirjev",
    "winsCount.one": "{n} zmaga",
    "winsCount.two": "{n} zmagi",
    "winsCount.few": "{n} zmage",
    "winsCount.other": "{n} zmag",

    // --- Load / error states -----------------------------------------------
    notFound: "Profila ni bilo mogoče najti.",
    loadFailed: "Napaka pri pridobivanju profila.",
    unavailable: "Profil ni na voljo.",
    back: "Nazaj",
    toTournaments: "Na turnirje",

    // --- Section nav --------------------------------------------------------
    "tab.tournaments": "Turnirji",
    "tab.presets": "Predloge",
    "tab.invoices": "Računi",
    "tab.dashboard": "Dashboard",
    "tab.playersList": "Seznam igralcev",
    "tab.contactMessages": "Sporočila",

    // --- Turniri tab --------------------------------------------------------
    "tournaments.heading": "Turnirji",
    "tournaments.emptyNoPairs": "Igralec ni odigral nobenega turnirja.",
    "tournaments.partnerLabel": "Solastnik:",
    "tournaments.searchPlaceholder": "Iskanje: ime turnirja ali lokacija…",
    "tournaments.emptyFiltered": "Ni turnirjev za izbrane filtre.",

    // --- Profile header -----------------------------------------------------
    "nav.sectionsAria": "Razdelki profila",
    "avatar.alt": "Profilna slika",
    "avatar.change": "Zamenjaj profilno sliko",
    "avatar.upload": "Naloži profilno sliko",
    "avatar.uploadFailed": "Nalaganje slike ni uspelo",
    "avatar.cropTitle": "Obreži profilno sliko",
    "avatar.cropHint": "Povleci in spremeni velikost okvira — krog kaže, kaj bo vidno.",
    "avatar.cropConfirm": "Shrani",
    "avatar.remove": "Odstrani profilno sliko",
    "avatar.removeConfirmTitle": "Odstraniti profilno sliko?",
    "avatar.removeConfirmBody": "Tvoj profil bo spet prikazoval začetnice.",
    "avatar.removeConfirmLabel": "Odstrani",
    unnamedPlayer: "Neimenovani igralec",
    "phone.loginToSee": "Prijavi se, da vidiš številko",
    "phone.loginHint": "(prijavi se)",

    // --- Nastavitve › Moji podatki ------------------------------------------
    "details.title": "Moji podatki",
    "details.description": "Profilna slika, ime, uporabniško ime in telefonska številka.",
    "details.edit": "Uredi",
    "details.nameLabel": "Ime",
    "details.usernameLabel": "Uporabniško ime",
    "details.phoneLabel": "Telefonska številka",
    "details.notSet": "Ni vpisano",

    // --- Edit-profile dialog ------------------------------------------------
    "edit.title": "Uredi profil",
    "edit.nameLabel": "Ime",
    "edit.namePlaceholder": "npr. Janez Novak",
    "edit.nameRequired": "Ime ne sme biti prazno.",
    "edit.phoneLabel": "Telefonska številka",
    "edit.phoneOptional": "(neobvezno)",
    /* ─── Avatarji (liki namesto fotografije) ───────────────── */
    "avatar.pickerLabel": "Izberi lik",
    "avatar.dialogTitle": "Profilna slika",
    "avatar.usePhotoAgain": "Uporabi to fotografijo",
    "avatar.photoHint": "Naloži svojo sliko in jo izreži v krog.",
    "avatar.chooseTitle": "Lik",
    "avatar.chooseHint": "Izberi lik ali naloži svojo sliko.",
    "avatar.usePhoto": "Uporabi sliko",
    "avatar.useCharacter": "Uporabi lik",
    "avatar.name.kralj": "Kralj",
    "avatar.name.baba": "Baba",
    "avatar.name.decko": "Fant",
    "avatar.name.dida": "Dedek",
    "avatar.name.baka": "Babica",
    "avatar.name.gazda": "Gazda",
    "avatar.name.konobar": "Natakar",
    "avatar.name.cura": "Dekle",
    "avatar.name.momak": "Fant s kapo",
    "avatar.name.kibic": "Kibic",
    "avatar.name.gospon": "Gospod",
    "avatar.name.sudac": "Sodnik",
    "avatar.name.teta": "Teta",
    "avatar.name.profa": "Profesor",
    "avatar.name.mornar": "Mornar",
    "avatar.name.seka": "Sestrica",
    "avatar.choosePhotoNotice": "Trenutno prikazuješ fotografijo — ta ima prednost. Izbrani lik se bo prikazal šele, ko fotografijo odstraniš.",
    "avatar.pickFailed": "Shranjevanje lika ni uspelo",
    "avatar.invalidPreset": "Ta lik ne obstaja več. Osveži stran in poskusi znova.",
    "edit.gameNameLabel": "Ime za igro",
    "edit.gameNameEmpty": "Ni nastavljeno",
    "edit.gameNameHint": "Ime, ki ga drugi igralci vidijo za mizo. Spremeniš ga v nastavitvah igre.",
    "edit.phonePlaceholder": "31 234 567",
    "edit.saveFailed": "Napaka pri shranjevanju.",

    // --- Pair chips ---------------------------------------------------------
    "pair.sharedTitle": "Deljeno s partnerjem",

    // --- Tournament row -----------------------------------------------------
    "status.winner": "Zmagovalec",
    "status.pendingApproval": "Čaka odobritev",
    "status.eliminated": "Izločen",
    "status.active": "Aktiven",
    "status.finished": "Zaključen",
    "status.announced": "Napovedan",
    record: "{wins}Z – {losses}P",
    extraLife: "Življenje",
    openTournament: "Odpri turnir",
    "matches.loadFailed": "Napaka pri pridobivanju tekem.",
    "matches.empty": "Ni odigranih tekem.",
    "match.bye": "Bye",
    "match.won": "Zmaga",
    "match.lost": "Poraz",
    "match.resolved": "Rešeno",
    "match.inProgress": "V teku",
    "match.round": "Krog {n}",
    "match.table": "Miza {n}",
    vs: "vs",

    // --- Predloge tab › Moji pari -------------------------------------------
    "pairs.title": "Moji pari",
    "pairs.description": "Tukaj lahko shraniš svoje pare. Deli par s partnerjem, da se par pojavi tudi na njegovem profilu, ali ga skrij pred drugimi, če ga ne želiš prikazovati javno.",
    "pairs.namePlaceholder": "npr. Janez & Peter",
    "pairs.add": "Dodaj",
    "pairs.empty": "Nimaš shranjenih parov.",
    "pairs.hidden": "Skrito",
    "pairs.show": "Prikaži",
    "pairs.hide": "Skrij",
    "pairs.showTitle": "Prikaži drugim",
    "pairs.hideTitle": "Skrij pred drugimi",
    "pairs.edit": "Uredi",
    "pairs.roleCoOwnerLabel": "Solastnik:",
    "pairs.roleOwnerLabel": "Lastnik:",
    "pairs.notShared": "Ni deljeno",
    "pairs.share": "Deli s partnerjem",
    "pairs.linkCopiedTitle": "Povezava kopirana",
    "pairs.linkCopiedBody": "Pošlji jo partnerju.",
    "pairs.copyFailedTitle": "Kopiranje v odložišče ni mogoče",
    "pairs.copyFailedBody": "Kopiraj ročno: {url}",
    "pairs.requestDeleteAria": "Pošlji zahtevo za brisanje",
    "pairs.requestDeleteTitle": "Pošlji partnerju zahtevo za brisanje",
    "pairs.partnerRequestedDelete": "Partner zahteva brisanje",
    "pairs.accept": "Sprejmi",
    "pairs.reject": "Zavrni",
    "pairs.requestSent": "Zahteva poslana — čaka odgovor",
    "pairs.cancelRequest": "Prekliči",
    "pairs.deleteRequestDialogTitle": "Poslati zahtevo za brisanje?",
    "pairs.deleteRequestBody": "Par {name} je deljen s {partner}. Zahteva bo poslana partnerju — par se izbriše šele, ko jo sprejme.",
    "pairs.sendRequest": "Pošlji zahtevo",
    "pairs.deleteDialogTitle": "Izbrisati par?",
    "pairs.deleteBody": "Res želiš izbrisati {name}? Tega dejanja ni mogoče razveljaviti.",
    "pairs.deleted": "Par izbrisan",
    "pairs.deleteBlockedTitle": "Ni mogoče izbrisati",
    "pairs.deleteBlockedBody": "Poskusi poslati zahtevo partnerju.",
    "pairs.deleteFailed": "Brisanje ni uspelo",
    "pairs.cancelFailed": "Preklic ni uspel",
    "pairs.confirmFailed": "Napaka pri potrditvi",
    "pairs.rejectFailed": "Zavrnitev ni uspela",

    // --- Predloge tab › Moji ceniki -----------------------------------------
    "templates.title": "Moji ceniki",
    "templates.description": "Organiziraš turnir? Shrani svoje cenike pijač, ki jih lahko z enim klikom naložiš na svojem turnirju.",
    "templates.empty": "Nimaš shranjenih predlog.",
    "templates.newNamePlaceholder": "Ime nove predloge",
    "templates.create": "Ustvari",
    "templates.duplicateName": "Predloga s tem imenom že obstaja.",
    "templates.back": "Nazaj",
    "templates.saveName": "Shrani ime",
    "templates.rename": "Preimenuj",
    "templates.deleteAria": "Izbriši predlogo",
    "templates.quickAdd": "Hitro dodaj:",
    "templates.emptyRows": "Predloga je prazna. Dodaj pijače spodaj.",
    "templates.rowNamePlaceholder": "Ime (npr. Pivo)",
    "templates.rowPricePlaceholder": "Cena",
    "templates.rowRemove": "Odstrani",
    "templates.addRow": "Dodaj",
    "templates.save": "Shrani predlogo",
    "templates.deleteDialogTitle": "Izbrisati predlogo?",
    "templates.deleteBody": "Predloga „{name}“ in vse njene cene bodo trajno izbrisane.",

    // --- Nastavitve tab -----------------------------------------------------
    "settings.title": "Nastavitve",
    "settings.description": "Prilagojene nastavitve aplikacije in tvojega profila.",
    "settings.theme": "Tema",
    "settings.light": "Svetla",
    "settings.dark": "Temna",
    "settings.themeHint": "Izbira se shrani ob tvojem računu, zato te spremlja na vseh napravah.",
    "settings.language": "Jezik",
    "settings.languageHint": "Spremeni jezik vmesnika in sporočil strežnika. Shrani se ob tvojem računu.",

    // --- Računi tab ---------------------------------------------------------
    "invoices.title": "Računi",
    "invoices.description": "Pregled računov po mizah na turnirjih, na katerih si igral.",
    "invoices.empty": "Nimaš še nobenega računa.",
    "invoices.round": "Krog {n}",
    "invoices.table": "Miza {n}",
    "invoices.paid": "Plačano",
    "invoices.yourBill": "Tvoj račun",
    "invoices.open": "Odprto",
    "invoices.win": "Zmaga",
    "invoices.dialogTitleFallback": "Račun",
    "invoices.noDrinks": "Ni dodanih pijač.",
    "invoices.total": "Skupaj",

    // --- Turnirji tab › Statistika igranja -----------------------------------
    "gameStats.title": "Statistika igranja",
    "gameStats.loadFailed": "Napaka pri pridobivanju statistike.",
    "gameStats.emptyNoGames": "Še ni odigranih partij.",
    "gameStats.games.one": "{n} partija",
    "gameStats.games.two": "{n} partiji",
    "gameStats.games.few": "{n} partije",
    "gameStats.games.other": "{n} partij",
    "gameStats.wins.one": "{n} zmaga",
    "gameStats.wins.two": "{n} zmagi",
    "gameStats.wins.few": "{n} zmage",
    "gameStats.wins.other": "{n} zmag",
    "gameStats.losses.one": "{n} poraz",
    "gameStats.losses.two": "{n} poraza",
    "gameStats.losses.few": "{n} porazi",
    "gameStats.losses.other": "{n} porazov",
    "gameStats.winRate": "Procent zmag",
    "gameStats.categoryStats": "{wins}/{n} ({winRate}%)",
    "gameStats.targetScore.501": "Do 501",
    "gameStats.targetScore.701": "Do 701",
    "gameStats.targetScore.1001": "Do 1001",

    /* ═══════════════════════════════════════════════════════════════════
       ZAVIHEK BLOK — zasebna zgodovina odigranih blokov (BLOK-HISTORY.md §4)
       ═══════════════════════════════════════════════════════════════════
       Viden samo lastniku profila, enak mehanizem kot "predlosci" /
       "racuni". Izrazi napovedi/štiglja/padli/adut/partija prihajajo iz
       `blok` namespacea (`blok.entry.*`, `blok.side.*`) — tu se namenoma
       ne podvajajo. Slovenščina ima dvojino, zato `.two` obstaja tudi kjer
       ga hrvaščina nikoli ne izbere. */
    "tab.blok": "Blok",
    "blok.title": "Blok",
    "blok.description": "Zgodovina odigranih blokov — serije partij, shranjene z naprave.",
    "blok.loadFailed": "Napaka pri pridobivanju zgodovine.",
    "blok.empty": "Še ni shranjenih serij.",
    "blok.emptyHint": "Serija se shrani, ko na Bloku izbereš „Ponastavi”.",
    "blok.gamesCount.one": "{n} partija",
    "blok.gamesCount.two": "{n} partiji",
    "blok.gamesCount.few": "{n} partije",
    "blok.gamesCount.other": "{n} partij",
    "blok.detailTitleFallback": "Serija",
    "blok.detailLoadFailed": "Napaka pri pridobivanju serije.",
    "blok.deleteDialogTitle": "Izbrisati serijo?",
    "blok.deleteBody": "Res želiš izbrisati serijo {result}? Tega dejanja ni mogoče razveljaviti.",
    "blok.deleted": "Serija izbrisana",

    /* REVIZIJA 2026-09-08 (druga) — „Do 1001 · skozi” (BLOK-HISTORY.md §5.5).
       Pravilo konca igre gre v vrstico pod rezultatom; število partij tu
       OSTANE, ker vrstica v seznamu serij partij pod sabo ne našteva (te so v
       pogovornem oknu). Besedi sta iste kot na čipih v nastavitvah, le z malo
       začetnico sredi stavka. */
    "blok.meta": "Do {target} · {rule}",
    "blok.rule.dosta": "dovolj",
    "blok.rule.prolaz": "skozi",
}
