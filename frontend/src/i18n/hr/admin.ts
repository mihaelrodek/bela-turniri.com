/* `admin` — admin-only screens and actions.

   Croatian is the source of truth: this file's shape defines what
   `src/i18n/sl/admin.ts` must provide, and a missing Slovenian key is a
   compile error. Keys are flat within the namespace (leaf names may contain
   dots; `t()` splits at the first dot only), and are addressed as
   `t("admin.someKey")`.

   Owned by ONE agent of the extraction pass — nobody else edits this file. */

export const admin = {
    /* ─── CjenikTab ─────────────────────────────────────────── */
    "cjenik.loading": "Učitavanje cjenika…",
    // Visitor-side empty state (someone who cannot edit). Informal second
    // person, like every other string in the app — this one said
    // "provjerite" while its Slovenian twin already said "preveri".
    "cjenik.empty.title": "Cjenik još nije napravljen",
    "cjenik.empty.description": "Organizator još radi na cjeniku — provjeri kasnije.",
    // Organiser-side empty state: they can fix it, so it says what to do.
    "cjenik.ownerEmpty.title": "Cjenik je još prazan",
    "cjenik.ownerEmpty.description": "Dodaj pića koja se toče na turniru — te cijene idu na račune po meču.",
    "cjenik.heading": "Cjenik pića",
    "cjenik.loadTemplateButton": "Učitaj predložak",
    "cjenik.saveAsTemplateButton": "Spremi kao predložak",
    "cjenik.templatesMenu": "Predlošci",
    "cjenik.templatesMenu.saveFirst": "Predložak se sprema iz spremljenog cjenika — prvo spremi promjene.",
    // "iz predloška" (genitive of `predložak`), not "iz predloške" — the
    // old copy declined it as if the noun were feminine.
    "cjenik.presetSection.heading": "Brzo dodaj iz predloška",
    "cjenik.presetSection.hint": "Klikni piće da ga dodaš, pa mu upiši cijenu.",
    "cjenik.presetSection.alreadyAdded": "Već je u cjeniku",
    "cjenik.nameInput.placeholder": "Naziv (npr. Pivo)",
    "cjenik.priceInput.placeholder": "Cijena",
    "cjenik.removeButton.aria": "Ukloni",
    // The leading "+" moved into a real icon on the button.
    "cjenik.addButton": "Dodaj piće",
    "cjenik.saveButton": "Spremi",
    "cjenik.discardButton": "Odbaci",
    "cjenik.unsavedBadge": "Nespremljeno",
    "cjenik.saveFailed": "Cjenik se nije mogao spremiti.",
    "cjenik.editButton": "Uredi",
    "cjenik.doneButton": "Gotovo",
    "cjenik.doneButton.dirtyHint": "Spremi ili odbaci promjene prije izlaska iz uređivanja.",
    // Unit only — the count itself is rendered beside it by CounterChip.
    "cjenik.drinkCount.one": "piće",
    "cjenik.drinkCount.two": "pića",
    "cjenik.drinkCount.few": "pića",
    "cjenik.drinkCount.other": "pića",

    /* ─── CjenikTab: Load Template Dialog ───────────────────── */
    "dialog.loadTemplate.title": "Učitaj predložak",
    "dialog.loadTemplate.loading": "Učitavanje predložaka…",
    "dialog.loadTemplate.empty": "Nemaš spremljenih predložaka. Idi na svoj profil pa stvori jedan, ili koristi \"Spremi kao predložak\" za trenutni cjenik.",
    "dialog.loadTemplate.closeButton": "Odustani",

    /* ─── CjenikTab: Save as Template Dialog ─────────────────── */
    "dialog.saveAsTemplate.title": "Spremi kao predložak",
    "dialog.saveAsTemplate.newTemplate.label": "Novi predložak:",
    "dialog.saveAsTemplate.newTemplate.placeholder": "npr. Pivo bar",
    "dialog.saveAsTemplate.newTemplate.createButton": "Stvori",
    "dialog.saveAsTemplate.newTemplate.alreadyExists": "Predložak s tim nazivom već postoji.",
    "dialog.saveAsTemplate.existingTemplates.label": "…ili prepiši postojeći:",
    "dialog.saveAsTemplate.existingTemplates.loading": "Učitavanje…",
    "dialog.saveAsTemplate.closeButton": "Odustani",

    /* ─── CjenikTab: Confirmation Dialogs ──────────────────── */
    "confirm.importTemplate.title": "Zamijeniti trenutni cjenik?",
    "confirm.importTemplate.description": "Učitavanje predloška „{templateName}“ zamijenit će sve stavke trenutnog cjenika.",
    "confirm.importTemplate.confirmButton": "Učitaj predložak",
    "confirm.overwriteTemplate.title": "Prepisati predložak?",
    "confirm.overwriteTemplate.description": "Predložak „{templateName}“ bit će prepisan trenutnim cjenikom.",
    "confirm.overwriteTemplate.confirmButton": "Prepiši",

    /* ─── AdminDashboardTab: Main Section ──────────────────── */
    "dashboard.heading": "Dashboard — pridruživanje parova",
    "dashboard.description": "Odaberi turnir, zatim klikni \"Pridruži korisniku\" pored para da bi ga vezao za registriranog igrača. Nakon pridruživanja par se pojavljuje na profilu odabranog korisnika i automatski se kreira Predlošci-zapis s tim imenom para.",
    "dashboard.tournament.label": "Turnir",
    "dashboard.tournament.placeholder": "Pretraži turnire po imenu, lokaciji ili slug-u…",
    "dashboard.tournament.noResults": "Nema rezultata.",
    "dashboard.tournament.owner": "Vlasnik: {owner}",
    "dashboard.tournament.ownerNameFallback": "(bez imena)",
    "dashboard.tournament.ownerLegacy": "— (legacy)",

    /* ─── AdminDashboardTab: Unclaimed Pairs Section ──────────── */
    "dashboard.pairs.heading": "Nepridruženi parovi · {tournamentName}",
    "dashboard.pairs.description": "Prikazani su samo parovi koji još nisu vezani za nijednog registriranog korisnika.",
    "dashboard.pairs.empty": "Nema nepridruženih parova u ovom turniru.",
    // Wins and losses decline independently, so each is its own plural family
    // and `record` only joins the two already-formatted halves.
    "dashboard.pairs.wins.one": "{n} pobjeda",
    "dashboard.pairs.wins.two": "{n} pobjede",
    "dashboard.pairs.wins.few": "{n} pobjede",
    "dashboard.pairs.wins.other": "{n} pobjeda",
    "dashboard.pairs.losses.one": "{n} poraz",
    "dashboard.pairs.losses.two": "{n} poraza",
    "dashboard.pairs.losses.few": "{n} poraza",
    "dashboard.pairs.losses.other": "{n} poraza",
    "dashboard.pairs.record": "{wins} · {losses}{eliminated}",
    "dashboard.pairs.record.eliminated": " · ispao",
    "dashboard.pairs.attachButton": "Pridruži korisniku",

    /* ─── AdminDashboardTab: Tournament Ownership Section ──────── */
    "dashboard.ownership.heading": "Vlasništvo turnira",
    "dashboard.ownership.description": "Prenesi turnir drugom registriranom korisniku — postaje vlasnik i može uređivati detalje, upravljati parovima, generirati kola, postavljati pobjednike itd.",
    "dashboard.ownership.currentLabel": "TRENUTNI VLASNIK",
    "dashboard.ownership.currentFallback": "(bez imena)",
    "dashboard.ownership.currentLegacy": "— (legacy / nema vlasnika)",
    "dashboard.ownership.uid": "UID: {uid}",
    "dashboard.ownership.transferButton": "Prenesi vlasništvo",

    /* ─── AdminDashboardTab: Tournament Status Section ──────────── */
    "dashboard.status.heading": "Status turnira (override)",
    "dashboard.status.description": "Ručno postavi status turnira. Koristi se za ispravak pogrešnih klikova (npr. slučajno \"Završi turnir\") ili za backfill turnira koji su završili izvan aplikacije (DRAFT → FINISHED). Status se mijenja bez provjere parova / kola. Vraćanje iz FINISHED briše pobjednika i podij — ne brišu se rundi/mečevi.",
    "dashboard.status.currentLabel": "TRENUTNI STATUS",
    "dashboard.status.unknown": "— (nepoznato)",
    "dashboard.status.buttonTitle": "Postavi status na {status}",
    "dashboard.status.buttonTitle.current": "Već u tom statusu",

    /* ─── AdminDashboardTab: Reset Tournament Section ──────────── */
    "dashboard.reset.heading": "Resetiraj turnir",
    "dashboard.reset.description": "Vraća turnir u stanje «nacrt» (DRAFT), briše sve runde i mečeve, ali zadržava parove (pobjede / porazi se nuliraju, ne briše se status «ima život»). Organizator može odmah dodavati / mijenjati parove i ponovno pokrenuti turnir. Pobjednik i podij se brišu.",
    "dashboard.reset.button": "Resetiraj turnir",
    "dashboard.reset.button.disabled": "Legacy turnir bez UUID-a — reset nije moguć",
    "dashboard.reset.button.title": "Resetiraj turnir u DRAFT i obriši runde",

    /* ─── AdminDashboardTab: Reset Confirmation Dialog ─────────── */
    "confirm.resetTournament.title": "Resetiraj turnir?",
    "confirm.resetTournament.tournamentLabel": "TURNIR",
    "confirm.resetTournament.delete.heading": "Briše se:",
    "confirm.resetTournament.delete.items": "• sve runde i mečevi\n• pobjednik (winnerName) i podij (2./3. mjesto)\n• pobjede / porazi parova (vraćaju se na 0)\n• status eliminacije parova (svi ponovo aktivni)",
    "confirm.resetTournament.keep.heading": "Zadržava se:",
    "confirm.resetTournament.keep.items": "• parovi (imena, kotizacija, «ima život» flag)\n• postavke turnira (cijene, lokacija, kontakt, plakat)",
    "confirm.resetTournament.cancelButton": "Odustani",
    "confirm.resetTournament.confirmButton": "Resetiraj",

    /* ─── AdminDashboardTab: Status Change Confirmation Dialog ──── */
    "confirm.statusChange.title": "Promjena statusa turnira",
    "confirm.statusChange.tournamentLabel": "TURNIR",
    "confirm.statusChange.fromFinished.heading": "Vraćanje iz FINISHED",
    "confirm.statusChange.fromFinished.message": "Briše se pobjednik (winnerName) i podij (2./3. mjesto). Rundi i mečevi ostaju netaknuti — za potpuni reset koristi \"Resetiraj turnir\" na stranici turnira.",
    "confirm.statusChange.toFinished.heading": "Postavljanje na FINISHED",
    "confirm.statusChange.toFinished.message": "Pobjednik se ne postavlja automatski. Otvori stranicu turnira pa postavi winnerName + podij ako su potrebni.",
    "confirm.statusChange.cancelButton": "Odustani",
    "confirm.statusChange.confirmButton": "Potvrdi",

    /* ─── AdminDashboardTab: Attach Pair Dialog ────────────────── */
    "dialog.attachPair.title": "Pridruži par korisniku",
    "dialog.attachPair.pairLabel": "PAR",
    "dialog.attachPair.userSearch.placeholder": "Pretraži po imenu i prezimenu…",
    "dialog.attachPair.userFallback": "(bez imena)",
    "dialog.attachPair.userProfile": "/profil/{slug}",
    "dialog.attachPair.attachButton": "Pridruži",
    "dialog.attachPair.closeButton": "Zatvori",

    /* ─── AdminDashboardTab: Transfer Tournament Dialog ─────────── */
    "dialog.transferTournament.title": "Prenesi vlasništvo turnira",
    "dialog.transferTournament.tournamentLabel": "TURNIR",
    "dialog.transferTournament.currentOwner": "Trenutni vlasnik: {owner}",
    "dialog.transferTournament.userSearch.placeholder": "Pretraži po imenu i prezimenu…",
    "dialog.transferTournament.userFallback": "(bez imena)",
    "dialog.transferTournament.userProfile": "/profil/{slug}",
    "dialog.transferTournament.ownerBadge": "vlasnik",
    "dialog.transferTournament.transferButton": "Prenesi",
    "dialog.transferTournament.transferButton.current": "Već vlasnik",
    "dialog.transferTournament.closeButton": "Zatvori",

    /* ─── AdminPlayersListTab ──────────────────────────────────── */
    "playersList.heading": "Popis igrača",
    "playersList.description": "Svi registrirani igrači — klikni \"Otvori profil\" za navigaciju na korisničku stranicu.",
    "playersList.search.placeholder": "Pretraži po imenu i prezimenu ili slug-u…",
    "playersList.loading.error": "Nije moguće učitati popis igrača.",
    "playersList.empty": "Nema rezultata.",
    "playersList.summary": "{filteredCount} od {totalCount} igrača",
    "playersList.summary.all": "Ukupno: {totalCount} igrača",
    "playersList.userFallback": "(bez imena)",
    "playersList.userProfile": "/profil/{slug}",
    "playersList.slugMissing": "Slug nije postavljen za ovog korisnika",
    "playersList.slugMissing.button": "Bez slug-a",
    "playersList.openProfileButton": "Otvori profil",

    /* ─── AdminContactMessagesTab ──────────────────────────────── */
    "contactMessages.heading": "Poruke",
    "contactMessages.description": "Poruke poslane putem kontakt obrasca. Odgovor ide ručno na e-mail pošiljatelja.",
    "contactMessages.filterOpen": "Neriješene",
    "contactMessages.filterAll": "Sve",
    "contactMessages.loading.error": "Nije moguće učitati poruke.",
    "contactMessages.empty": "Nema poruka.",
    "contactMessages.subjectFallback": "(bez naslova)",
    "contactMessages.mailSubjectPrefix": "Re: ",
    "contactMessages.statusHandled": "Riješeno",
    "contactMessages.statusOpen": "Otvoreno",
    "contactMessages.markHandled": "Označi riješeno",
    "contactMessages.unmarkHandled": "Vrati u neriješene",
    "contactMessages.toast.handled": "Poruka je označena kao riješena",
    "contactMessages.toast.unhandled": "Poruka je vraćena u neriješene",
    // Header badge — how many messages still need a reply.
    "contactMessages.unhandledCount.one": "{n} neriješena poruka",
    "contactMessages.unhandledCount.two": "{n} neriješene poruke",
    "contactMessages.unhandledCount.few": "{n} neriješene poruke",
    "contactMessages.unhandledCount.other": "{n} neriješenih poruka",
}

/** Contract every other locale's `admin` namespace must satisfy. */
export type AdminDict = typeof admin
