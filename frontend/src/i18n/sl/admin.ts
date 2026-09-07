import type { AdminDict } from "../hr/admin"

/* Slovenian `admin`. Typed as the Croatian namespace, so a dropped or
   misspelled key fails `tsc` instead of silently falling back at runtime.
   Register: informal second person, matching the Croatian copy. */

export const admin: AdminDict = {
    /* ─── CjenikTab ─────────────────────────────────────────── */
    "cjenik.loading": "Nalaganje cenika…",
    "cjenik.empty.title": "Cenik še ni pripravljen",
    "cjenik.empty.description": "Organizator še dela na ceniku — preveri kasneje.",
    "cjenik.ownerEmpty.title": "Cenik je še prazen",
    "cjenik.ownerEmpty.description": "Dodaj pijače, ki se točijo na turnirju — te cene gredo na račune po tekmi.",
    "cjenik.heading": "Cenik za pijače",
    "cjenik.loadTemplateButton": "Naloži predlogo",
    "cjenik.saveAsTemplateButton": "Shrani kot predlogo",
    "cjenik.templatesMenu": "Predloge",
    "cjenik.templatesMenu.saveFirst": "Predloga se shrani iz shranjenega cenika — najprej shrani spremembe.",
    "cjenik.presetSection.heading": "Hitro dodaj iz predloge",
    "cjenik.presetSection.hint": "Klikni pijačo, da jo dodaš, in ji vpiši ceno.",
    "cjenik.presetSection.alreadyAdded": "Je že v ceniku",
    "cjenik.nameInput.placeholder": "Naziv (npr. Pivo)",
    "cjenik.priceInput.placeholder": "Cena",
    "cjenik.removeButton.aria": "Odstrani",
    "cjenik.addButton": "Dodaj pijačo",
    "cjenik.saveButton": "Shrani",
    "cjenik.discardButton": "Zavrzi",
    "cjenik.unsavedBadge": "Neshranjeno",
    "cjenik.saveFailed": "Cenika ni bilo mogoče shraniti.",
    "cjenik.editButton": "Uredi",
    "cjenik.doneButton": "Končano",
    "cjenik.doneButton.dirtyHint": "Pred izhodom iz urejanja shrani ali zavrzi spremembe.",
    // Slovenian keeps the dual, so `.two` is a form of its own here.
    "cjenik.drinkCount.one": "pijača",
    "cjenik.drinkCount.two": "pijači",
    "cjenik.drinkCount.few": "pijače",
    "cjenik.drinkCount.other": "pijač",

    /* ─── CjenikTab: Load Template Dialog ───────────────────── */
    "dialog.loadTemplate.title": "Naloži predlogo",
    "dialog.loadTemplate.loading": "Nalaganje predlog…",
    "dialog.loadTemplate.empty": "Nimaš shranjenih predlog. Pojdi na svoj profil in ustvari eno, ali uporabi \"Shrani kot predlogo\" za trenutni cenik.",
    "dialog.loadTemplate.closeButton": "Prekliči",

    /* ─── CjenikTab: Save as Template Dialog ─────────────────── */
    "dialog.saveAsTemplate.title": "Shrani kot predlogo",
    "dialog.saveAsTemplate.newTemplate.label": "Nova predloga:",
    "dialog.saveAsTemplate.newTemplate.placeholder": "npr. Pivovnica",
    "dialog.saveAsTemplate.newTemplate.createButton": "Ustvari",
    "dialog.saveAsTemplate.newTemplate.alreadyExists": "Predloga s tem imenom že obstaja.",
    "dialog.saveAsTemplate.existingTemplates.label": "…ali prepiši obstoječo:",
    "dialog.saveAsTemplate.existingTemplates.loading": "Nalaganje…",
    "dialog.saveAsTemplate.closeButton": "Prekliči",

    /* ─── CjenikTab: Confirmation Dialogs ──────────────────── */
    "confirm.importTemplate.title": "Zamenjati trenutni cenik?",
    "confirm.importTemplate.description": "Nalaganje predloge „{templateName}“ bo zamenjalo vse postavke trenutnega cenika.",
    "confirm.importTemplate.confirmButton": "Naloži predlogo",
    "confirm.overwriteTemplate.title": "Prepisati predlogo?",
    "confirm.overwriteTemplate.description": "Predloga „{templateName}“ bo prepisana s trenutnim cenikom.",
    "confirm.overwriteTemplate.confirmButton": "Prepiši",

    /* ─── AdminDashboardTab: Main Section ──────────────────── */
    "dashboard.heading": "Nadzorna plošča — dodelitev parov",
    "dashboard.description": "Izberi turnir, nato klikni \"Dodeli igralcu\" poleg para, da ga veže na registriranega igralca. Po dodelitvi se par pojavi na profilu izbrane osebe in se samodejno ustvari vnos Predlog s tem imenom para.",
    "dashboard.tournament.label": "Turnir",
    "dashboard.tournament.placeholder": "Išči turnirje po imenu, lokaciji ali slug-u…",
    "dashboard.tournament.noResults": "Ni rezultatov.",
    "dashboard.tournament.owner": "Lastnik: {owner}",
    "dashboard.tournament.ownerNameFallback": "(brez imena)",
    "dashboard.tournament.ownerLegacy": "— (legacy)",

    /* ─── AdminDashboardTab: Unclaimed Pairs Section ──────────── */
    "dashboard.pairs.heading": "Nedodeljeni parovi · {tournamentName}",
    "dashboard.pairs.description": "Prikazani so samo parovi, ki še niso vezani na nobenega registriranega uporabnika.",
    "dashboard.pairs.empty": "V tem turnirju ni nedodeljenih parov.",
    "dashboard.pairs.wins.one": "{n} zmaga",
    "dashboard.pairs.wins.two": "{n} zmagi",
    "dashboard.pairs.wins.few": "{n} zmage",
    "dashboard.pairs.wins.other": "{n} zmag",
    "dashboard.pairs.losses.one": "{n} poraz",
    "dashboard.pairs.losses.two": "{n} poraza",
    "dashboard.pairs.losses.few": "{n} porazi",
    "dashboard.pairs.losses.other": "{n} porazov",
    "dashboard.pairs.record": "{wins} · {losses}{eliminated}",
    "dashboard.pairs.record.eliminated": " · izpadel",
    "dashboard.pairs.attachButton": "Dodeli igralcu",

    /* ─── AdminDashboardTab: Tournament Ownership Section ──────── */
    "dashboard.ownership.heading": "Lastništvo turnirja",
    "dashboard.ownership.description": "Prenesi turnir drugemu registriranemu uporabniku — postane lastnik in lahko ureja podrobnosti, upravlja parove, generira kola, postavlja zmagovalce itd.",
    "dashboard.ownership.currentLabel": "TRENUTNI LASTNIK",
    "dashboard.ownership.currentFallback": "(brez imena)",
    "dashboard.ownership.currentLegacy": "— (legacy / brez lastnika)",
    "dashboard.ownership.uid": "UID: {uid}",
    "dashboard.ownership.transferButton": "Prenesi lastništvo",

    /* ─── AdminDashboardTab: Tournament Status Section ──────────── */
    "dashboard.status.heading": "Status turnirja (preglasitev)",
    "dashboard.status.description": "Ročno nastavi status turnirja. Uporablja se za popravo napačnih klikov (npr. naključni \"Zaključi turnir\") ali za zapolnitev turnirjev, ki so se zaključili izven aplikacije (DRAFT → FINISHED). Status se spremeni brez preverjanja parov / kol. Vrnitev iz FINISHED izbriše zmagovalca in lestvico — kola in tekme se ne brišejo.",
    "dashboard.status.currentLabel": "TRENUTNI STATUS",
    "dashboard.status.unknown": "— (neznano)",
    "dashboard.status.buttonTitle": "Nastavi status na {status}",
    "dashboard.status.buttonTitle.current": "Že v tem statusu",

    /* ─── AdminDashboardTab: Reset Tournament Section ──────────── */
    "dashboard.reset.heading": "Ponastavi turnir",
    "dashboard.reset.description": "Vrne turnir v stanje »osnutek« (DRAFT), izbriše vsa kola in tekme, vendar ohrani parove (zmage / porazi se ničlirajo, status »ima življenja« se ne briše). Organizator lahko takoj dodaja / spreminja parove in ponovno zažene turnir. Zmagovalec in lestvica se brišejo.",
    "dashboard.reset.button": "Ponastavi turnir",
    "dashboard.reset.button.disabled": "Legacy turnir brez UUID-ja — ponastavitev ni mogoča",
    "dashboard.reset.button.title": "Ponastavi turnir v DRAFT in izbriši kola",

    /* ─── AdminDashboardTab: Reset Confirmation Dialog ─────────── */
    "confirm.resetTournament.title": "Ponastavi turnir?",
    "confirm.resetTournament.tournamentLabel": "TURNIR",
    "confirm.resetTournament.delete.heading": "Briše se:",
    "confirm.resetTournament.delete.items": "• vsa kola in tekme\n• zmagovalec (winnerName) in lestvica (2./3. mesto)\n• zmage / porazi parov (vrnejo se na 0)\n• status odprave parov (vsi spet aktivni)",
    "confirm.resetTournament.keep.heading": "Ohrani se:",
    "confirm.resetTournament.keep.items": "• parovi (imena, kotizacija, »ima življenja« flag)\n• nastavitve turnirja (cene, lokacija, stik, plakat)",
    "confirm.resetTournament.cancelButton": "Prekliči",
    "confirm.resetTournament.confirmButton": "Ponastavi",

    /* ─── AdminDashboardTab: Status Change Confirmation Dialog ──── */
    "confirm.statusChange.title": "Sprememba statusa turnirja",
    "confirm.statusChange.tournamentLabel": "TURNIR",
    "confirm.statusChange.fromFinished.heading": "Vrnitev iz FINISHED",
    "confirm.statusChange.fromFinished.message": "Izbriše se zmagovalec (winnerName) in lestvica (2./3. mesto). Kola in tekme ostanejo nespremenjena — za popolno ponastavitev uporabi \"Ponastavi turnir\" na strani turnirja.",
    "confirm.statusChange.toFinished.heading": "Postavitev na FINISHED",
    "confirm.statusChange.toFinished.message": "Zmagovalec se ne nastavi samodejno. Odpri stran turnirja in nastavi winnerName + lestvico, če je potrebno.",
    "confirm.statusChange.cancelButton": "Prekliči",
    "confirm.statusChange.confirmButton": "Potrdi",

    /* ─── AdminDashboardTab: Attach Pair Dialog ────────────────── */
    "dialog.attachPair.title": "Dodeli par uporabniku",
    "dialog.attachPair.pairLabel": "PAR",
    "dialog.attachPair.userSearch.placeholder": "Išči po imenu in priimku…",
    "dialog.attachPair.userFallback": "(brez imena)",
    "dialog.attachPair.userProfile": "/profil/{slug}",
    "dialog.attachPair.attachButton": "Dodeli",
    "dialog.attachPair.closeButton": "Zapri",

    /* ─── AdminDashboardTab: Transfer Tournament Dialog ─────────── */
    "dialog.transferTournament.title": "Prenesi lastništvo turnirja",
    "dialog.transferTournament.tournamentLabel": "TURNIR",
    "dialog.transferTournament.currentOwner": "Trenutni lastnik: {owner}",
    "dialog.transferTournament.userSearch.placeholder": "Išči po imenu in priimku…",
    "dialog.transferTournament.userFallback": "(brez imena)",
    "dialog.transferTournament.userProfile": "/profil/{slug}",
    "dialog.transferTournament.ownerBadge": "lastnik",
    "dialog.transferTournament.transferButton": "Prenesi",
    "dialog.transferTournament.transferButton.current": "Že lastnik",
    "dialog.transferTournament.closeButton": "Zapri",

    /* ─── AdminPlayersListTab ──────────────────────────────────── */
    "playersList.heading": "Popis igralcev",
    "playersList.description": "Vsi registrirani igralci — klikni \"Odpri profil\" za navigacijo na stran uporabnika.",
    "playersList.search.placeholder": "Išči po imenu in priimku ali slug-u…",
    "playersList.loading.error": "Ni mogoče naložiti popisa igralcev.",
    "playersList.empty": "Ni rezultatov.",
    "playersList.summary": "{filteredCount} od {totalCount} igralcev",
    "playersList.summary.all": "Skupaj: {totalCount} igralcev",
    "playersList.userFallback": "(brez imena)",
    "playersList.userProfile": "/profil/{slug}",
    "playersList.slugMissing": "Slug ni nastavljen za tega uporabnika",
    "playersList.slugMissing.button": "Brez slug-a",
    "playersList.openProfileButton": "Odpri profil",

    /* ─── AdminContactMessagesTab ──────────────────────────────── */
    "contactMessages.heading": "Sporočila",
    "contactMessages.description": "Sporočila, poslana prek kontaktnega obrazca. Odgovor gre ročno na e-pošto pošiljatelja.",
    "contactMessages.filterOpen": "Nerešena",
    "contactMessages.filterAll": "Vsa",
    "contactMessages.loading.error": "Sporočil ni mogoče naložiti.",
    "contactMessages.empty": "Ni sporočil.",
    "contactMessages.subjectFallback": "(brez naslova)",
    "contactMessages.mailSubjectPrefix": "Re: ",
    "contactMessages.statusHandled": "Rešeno",
    "contactMessages.statusOpen": "Odprto",
    "contactMessages.markHandled": "Označi kot rešeno",
    "contactMessages.unmarkHandled": "Vrni med nerešena",
    "contactMessages.toast.handled": "Sporočilo je označeno kot rešeno",
    "contactMessages.toast.unhandled": "Sporočilo je vrnjeno med nerešena",
    // Slovenian keeps the dual, so `.two` is its own form here.
    "contactMessages.unhandledCount.one": "{n} nerešeno sporočilo",
    "contactMessages.unhandledCount.two": "{n} nerešeni sporočili",
    "contactMessages.unhandledCount.few": "{n} nerešena sporočila",
    "contactMessages.unhandledCount.other": "{n} nerešenih sporočil",
}
