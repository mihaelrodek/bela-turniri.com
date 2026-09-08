import type { TournamentDict } from "../hr/tournament"

/* Slovenian `tournament`. Typed as the Croatian namespace, so a dropped or
   misspelled key fails `tsc` instead of silently falling back at runtime.
   Register: informal second person, matching the Croatian copy.

   Two places where the Croatian source slips into the formal plural
   ("Provjerite kasnije", "Unesite…") are mirrored here rather than quietly
   corrected — the copy move keeps both sides in step.

   Unlike Croatian, Slovenian kept the dual, so every plural family below
   really does use all four categories: 1 par, 2 para, 3-4 pari, 5+ parov. */

export const tournament: TournamentDict = {
    // ═══════════════════════ Page chrome ═══════════════════════
    backToList: "Nazaj na seznam",
    notFound: "Turnir ni bil najden.",
    loadFailed: "Turnirja ni bilo mogoče naložiti.",
    loadingAria: "Nalaganje turnirja",
    ok: "V redu",
    no: "Ne",
    expand: "Razširi",
    collapse: "Skrči",
    expandAll: "Razširi vse",
    collapseAll: "Skrči vse",
    fullscreen: "Celozaslonsko",
    winnersHeading: "Zmagovalci",

    // --- Status pill --------------------------------------------------------
    "status.draft": "Osnutek",
    "status.started": "V teku",
    "status.finished": "Zaključeno",

    // --- Tabs ---------------------------------------------------------------
    "tab.details": "Podrobnosti",
    "tab.pairs": "Pari",
    "tab.bracket": "Žreb",
    "tab.cjenik": "Cenik",

    "nav.sectionsAria": "Razdelki turnirja",

    "results.heading": "Rezultati",

    // --- Toolbar actions ----------------------------------------------------
    "actions.edit": "Uredi",
    "actions.more": "Več dejanj",
    "share.button": "Deli",
    "share.copied": "Kopirano!",
    "share.copyPrompt": "Kopiraj povezavo:",
    addToCalendar: "Dodaj v koledar",

    // --- Document head / SEO -------------------------------------------------
    "seo.title": "{name} — bela-turniri.com",
    "seo.titleWithLocation": "{name}, {location} — bela-turniri.com",
    "seo.titleFallback": "Turnir — bela-turniri.com",
    "seo.desc": "Turnir bele {name}",
    "seo.descWithLocation": "Turnir bele {name} v {location}",
    "seo.descWithDate": "Turnir bele {name} — {date}",
    "seo.descWithLocationAndDate": "Turnir bele {name} v {location} — {date}",

    // ═══════════════════════ Podrobnosti — read mode ═══════════════════════
    "tile.createdBy": "Ustvaril",
    "tile.date": "Datum",
    "tile.startTime": "Ura začetka",
    "tile.maxPairs": "Največ parov",
    "tile.unlimited": "Nedoločeno",
    "tile.location": "Lokacija",
    "tile.details": "Podrobnosti",
    "tile.entryPrice": "Kotizacija",
    "tile.repassage": "Repasaž",
    "tile.repassageSecond": "Drugi repasaž",
    "tile.repassageUntil": "Repasaž do",
    "tile.rewards": "Nagrade",
    "tile.additionalOptions": "Dodatne možnosti",

    "tile.pairs": "Pari",
    "tile.contact": "Kontakt",
    "tile.notSpecified": "Ni navedeno",

    "qr.cardTitle": "Koda QR",
    "qr.cardHint": "S skeniranjem se odpre stran tega turnirja. Prenesi jo in obesi na prizorišču.",

    openInGoogleMaps: "Odpri v Google Zemljevidih",
    openInMaps: "Odpri v zemljevidih",

    "repassageUntil.FINALS": "Finala",
    "repassageUntil.SEMIFINALS": "Polfinala",
    "repassageUntil.FIRST_ROUND": "Prvega kroga",

    "place.first": "1. mesto",
    "place.second": "2. mesto",
    "place.third": "3. mesto",

    "reward.fixed": "Fiksne",
    "reward.percentage": "Odstotek sklada",

    // ═══════════════════════ Podrobnosti — edit mode ═══════════════════════
    "edit.sectionBasic": "Osnovno",
    "edit.sectionFees": "Kotizacija in repasaž",
    "edit.sectionContact": "Kontakt organizatorja",
    "edit.name": "Ime turnirja",
    "edit.dateTime": "Datum in ura",
    "edit.timeCaption": "Ura",
    "edit.dateTimePlaceholder": "DD/MM/LLLL HH:MM",
    "edit.maxPairsHelp": "Pusti prazno za neomejeno število parov.",
    "edit.locationPlaceholder": "npr. Caffe bar Belot, Ljubljana",
    "edit.poster": "Plakat",
    "edit.optional": "(neobvezno)",
    "edit.optionalShort": "(neob.)",
    "edit.removePoster": "Odstrani plakat",
    "edit.changeImage": "Zamenjaj sliko",
    "edit.replacePoster": "Zamenjaj plakat",
    "edit.chooseImage": "Izberi sliko",
    "edit.posterWillBeRemoved": "Plakat bo odstranjen ob shranjevanju.",
    "edit.posterHint": "PNG, JPG ali WEBP, do {mb} MB.",
    "edit.perPair": "/par",
    "edit.perPlayer": "/igralec",
    "edit.repassageUntilLabel": "Repasaž mogoč do",
    "edit.repassageUntilHelp": "Zadnja runda, pred katero je mogoče kupiti dodatno življenje.",
    "edit.rewardFixed": "Fiksne (€)",
    "edit.rewardPercentage": "Odstotek sklada (%)",
    "edit.contactName": "Ime",
    "edit.contactNamePlaceholder": "Ime organizatorja",
    "edit.contactPhone": "Telefonska številka",
    /* Same example number as Croatian on purpose — see the note in hr. */
    "edit.contactPhonePlaceholder": "91 234 5678",
    "edit.saveChanges": "Shrani spremembe",
    "edit.readyToSave": "Pripravljeno za shranjevanje.",
    "edit.pastInline": "Datum in ura ne moreta biti v preteklosti.",
    "edit.missingInline": "Manjka: {fields}",

    "edit.required.name": "Ime",
    "edit.required.location": "Lokacija",
    "edit.required.date": "Datum",
    "edit.required.time": "Ura",
    "edit.required.rewards": "Nagrade",

    "edit.missingTitle": "Manjkajo obvezna polja",
    "edit.missingDescription": "Manjka: {fields}.",
    "edit.pastTitle": "Neveljaven termin",
    "edit.pastDescription": "Datum in ura turnirja ne moreta biti v preteklosti.",

    "poster.allowedTypes": "Dovoljeno: JPG, PNG ali WEBP.",
    "poster.maxSize": "Največja velikost je {mb} MB.",

    // ═══════════════════════ Pari ═══════════════════════
    "pairs.nameLabel": "Ime para",
    "pairs.matchHistory": "Zgodovina tekem",
    "pairs.submittedBy": "Prijavil:",
    "pairs.pendingApproval": "Čaka odobritev",
    /* W/L stays as in Croatian — it is the international shorthand there
       too, not a Croatian word. */
    "pairs.winLoss": "{wins}W – {losses}L",
    "pairs.hasLife": "Ima življenje",
    "pairs.noLife": "Nima življenja",
    "pairs.eliminated": "Izločen",
    "pairs.paid": "Plačano",
    "pairs.unpaid": "Ni plačano",
    "pairs.approve": "Odobri",
    "pairs.pay": "Plačaj",
    "pairs.markUnpaid": "Označi neplačano",
    "pairs.markPaidTitle": "Označi kot plačano",
    "pairs.markUnpaidTitle": "Označi kot neplačano",
    "pairs.removePair": "Odstrani par",
    "pairs.addPair": "Dodaj par",
    "pairs.addPairTitle": "Dodaj nov par",
    "pairs.atCapacityTitle": "Največje število parov ({max})",
    "pairs.registerPair": "Prijavi par na turnir",
    "pairs.registerAnother": "Prijavi še en par",
    "pairs.overCapacity": "+{n} čez zmogljivost",
    "pairs.eliminatedHeading": "Izločeni",
    "pairs.pendingHeading": "Čakajo odobritev",
    "pairs.emptyTitle": "Še ni parov",
    "pairs.emptyDescription": "Dodaj prvi par s klikom na \"Dodaj par\" zgoraj.",
    "pairs.emptyDescriptionReadonly": "Organizator še ni prijavil nobenega para.",
    "pairs.noName": "Brez imena",
    "pairs.backToList": "Nazaj na seznam parov",
    "pairs.detailEmptyTitle": "Izberi par",
    "pairs.detailEmptyDescription": "Klikni par na seznamu za njegov status in vsa dejanja.",

    "pairs.life.label": "Življenje",
    "pairs.life.buy": "Kupi življenje",
    "pairs.life.alreadyBought": "Že kupljeno",
    "pairs.life.saveFirst": "Najprej shrani",
    "pairs.life.unavailable": "Ni na voljo",

    "pairs.capacityOf.one": "par / {max}",
    "pairs.capacityOf.two": "para / {max}",
    "pairs.capacityOf.few": "pari / {max}",
    "pairs.capacityOf.other": "parov / {max}",
    "pairs.capacityUnlimited.one": "par / ∞",
    "pairs.capacityUnlimited.two": "para / ∞",
    "pairs.capacityUnlimited.few": "pari / ∞",
    "pairs.capacityUnlimited.other": "parov / ∞",
    "pairs.paidEntry.one": "je plačal kotizacijo",
    "pairs.paidEntry.two": "sta plačala kotizacijo",
    "pairs.paidEntry.few": "so plačali kotizacijo",
    "pairs.paidEntry.other": "je plačalo kotizacijo",
    "pairs.activeCount.one": "aktiven",
    "pairs.activeCount.two": "aktivna",
    "pairs.activeCount.few": "aktivni",
    "pairs.activeCount.other": "aktivnih",

    "pairs.groupCount.one": "{n} par",
    "pairs.groupCount.two": "{n} para",
    "pairs.groupCount.few": "{n} pari",
    "pairs.groupCount.other": "{n} parov",

    "pairs.notSavedTitle": "Pari niso shranjeni",
    "pairs.nameEmpty": "Ime para ne sme biti prazno.",
    "pairs.nameBeforePay": "Pred plačilom vnesi ime para.",

    // --- Open pair-finding requests -----------------------------------------
    "pairRequests.title": "Zahteve za partnerja",

    // --- Self-registration dialog -------------------------------------------
    "selfReg.savedPairs": "Tvoji shranjeni pari",
    "selfReg.namePlaceholder": "npr. Marko & Pero",
    "selfReg.submit": "Prijavi se",
    "selfReg.pendingNote.before": "Par bo označen",
    "selfReg.pendingNote.bold": "rumeno",
    "selfReg.pendingNote.after": "dokler ga organizator ne potrdi.",
    "selfReg.nameRequired": "Vnesi ime para.",
    "selfReg.alreadyStarted": "Turnir se je že začel.",
    "selfReg.alreadyRegistered": "Par s tem imenom si že prijavil.",
    "selfReg.error": "Napaka pri prijavi.",

    // ═══════════════════════ Žreb ═══════════════════════
    /* Kratka oblika — pill v stolpcu z mizami, glej hr. */
    "bracket.bye": "Prosti",
    "bracket.notStartedTitle": "Turnir se še ni začel",
    "bracket.notStartedOwner": "Klikni \"Zaženi turnir\" zgoraj, ko so vsi pari pripravljeni.",
    "bracket.notStartedViewer": "Organizator turnirja še ni zagnal. Preveri kasneje.",
    "bracket.noRoundsTitle": "Še ni rund",
    "bracket.noRoundsOwnerStarted": "Klikni \"Generiraj prvo rundo\" za začetek žreba.",
    "bracket.noRoundsOwnerDraft": "Najprej zaženi turnir, ko so vsi pari pripravljeni.",
    "bracket.noRoundsViewer": "Organizator še ni generiral parov. Preveri kasneje.",
    "bracket.moreActions": "Več dejanj za turnir",

    table: "Miza {n}",
    tableLabel: "Miza",

    "settings.allowRepeatsLabel": "Ponavljanje istih parov",
    "settings.allowRepeatsHint": "Dovoli, da isti pari igrajo znova",
    "settings.allowRepeatsHelp": "Kaj to pomeni?",

    // --- Round card ---------------------------------------------------------
    "round.heading": "Runda {n}",
    "round.completed": "Končano",
    "round.inProgress": "V teku",
    "round.expand": "Razširi rundo",
    "round.collapse": "Skrči rundo",
    "round.noMatches": "V tej rundi ni tekem.",
    "round.generate": "Generiraj rundo",
    "round.generateFirst": "Generiraj prvo rundo",
    "round.generateNextTitle": "Generiraj naslednjo rundo",
    "round.generateBlockedTitle": "Končaj trenutno rundo ali dodaj pare",
    "round.manualButton": "Ročno generiraj",
    "round.resetButton": "Ponastavi rundo",
    "round.resetTitle": "Izbriši tekme v rundi in povrni statistiko",
    "round.moreActions": "Več dejanj za rundo",
    "round.finishButton": "Končaj rundo",
    "round.finishTitle": "Končaj rundo",
    "round.finishBlockedTitle": "Najprej vnesi vse rezultate",
    "round.resetConfirmTitle": "Ponastaviti rundo?",
    "round.resetConfirmBody":
        "Vse tekme v tej rundi bodo izbrisane, statistika parov pa povrnjena na stanje pred rundo.",

    "round.notGeneratedTitle": "Kolo ni generirano",
    "round.notFinishedTitle": "Runda ni končana",
    "round.pendingOps":
        "Nekatere spremembe še čakajo na shranjevanje. Počakaj, da oznaka o čakajočih spremembah izgine.",
    "round.someScoresFailedTitle": "Nekateri rezultati niso shranjeni",
    "round.someScoresFailedDescription": "Mize: {tables}. Runda ni končana — poskusi znova.",
    "round.cannotResetTitle": "Runde ni mogoče ponastaviti",
    "round.notLoaded": "Turnir ni naložen.",
    "round.completedCannotReset": "Končane runde ni več mogoče razveljaviti.",

    // --- Match row ----------------------------------------------------------
    pendingSave: "Čaka shranjevanje",
    "match.editTitle": "Uredi rezultat tekme",
    "match.saveAria": "Shrani rezultat",
    "match.scoreAria": "Rezultat — {pair}",
    "match.stateOpen": "Brez rezultata",
    "match.stateLive": "Rezultat v teku",
    "match.stateUnsaved": "Neshranjeno",
    "match.stateEditing": "Urejanje rezultata",
    "match.stateFinished": "Tekma končana",
    "match.invalidScoreTitle": "Neveljaven rezultat",
    "match.invalidScoreDescription": "Vnesi pravilna rezultata za oba para (različni številki).",

    // --- Fullscreen round dialog -------------------------------------------
    fullscreenRoundTitle: "Runda {n} — Celozaslonsko",
    "fullscreen.sizeLabel": "Velikost kartic",
    "fullscreen.smaller": "Manjše",
    "fullscreen.larger": "Večje",
    "fullscreen.enterNative": "Skrij brskalnik (cel zaslon)",
    "fullscreen.exitNative": "Vrni brskalnik",

    // ═══════════════════════ Lifecycle actions ═══════════════════════
    "start.button": "Zaženi turnir",
    "start.startTitle": "Zaženi turnir",
    "start.needTwoPaid": "Za začetek sta potrebna vsaj 2 plačana para",
    "start.notStartedTitle": "Turnir ni zagnan",
    "start.cannotStartTitle": "Turnirja ni mogoče zagnati",
    "start.insufficientPairs": "Za zagon turnirja sta potrebna vsaj 2 plačana para.",

    "finish.button": "Končaj turnir",
    "finish.notFinishedTitle": "Turnir ni končan",
    "finish.cannotFinishTitle": "Turnirja ni mogoče končati",
    "finish.alreadyFinished": "Turnir je že končan.",
    "finish.roundInProgress": "Zadnja runda še ni končana.",

    "reset.button": "Ponastavi turnir",
    "reset.title": "Izbriši vse runde in vrni turnir v osnutek",
    "reset.notResetTitle": "Turnir ni ponastavljen",
    "reset.confirmTitle": "Ponastaviti turnir?",
    "reset.confirmBody":
        "Vse runde in tekme bodo izbrisane, turnir pa vrnjen v osnutek. Tega dejanja ni mogoče razveljaviti.",
    "reset.confirmYes": "Da, ponastavi",

    "unpaid.title": "Turnir se ne more začeti",
    "unpaid.body.before": "Turnirja ni mogoče zagnati, dokler vse ekipe nimajo označene",
    "unpaid.body.bold": "kotizacije",
    "unpaid.body.after": ". Prosimo, označite “Kotizacija” za vse pare, ki so plačali.",

    // --- Manual round confirmation -----------------------------------------
    "manualRound.confirmTitle": "Ročna generacija kola?",
    "manualRound.confirmBody":
        "Si prepričan, da želiš ročno izbrati pare za naslednje kolo? Ta korak zaobide samodejni žreb in postavi točno tak razpored, kot ga izbereš.",
    "manualRound.confirmYes": "Da, ročno",

    // --- Destructive confirmations -----------------------------------------
    "deleteTournament.title": "Izbrisati turnir?",
    "deleteTournament.before": "Izbrisati turnir",
    "deleteTournament.after":
        "? Turnir ne bo več viden v iskanju, na zemljevidu, v koledarju niti v profilih igralcev. Tega dejanja ni mogoče razveljaviti prek aplikacije.",
    "deleteTournament.confirm": "Da, izbriši",

    "deletePair.title": "Odstraniti par?",
    "deletePair.before": "Res odstraniti par",
    "deletePair.after": "s turnirja? Tega dejanja ni mogoče razveljaviti.",
    "deletePair.confirm": "Da, odstrani",

    // ═══════════════════════ Pair match-history dialog ═══════════════════════
    "history.played": "Odigrano",
    "history.wins": "Zmage",
    "history.losses": "Porazi",
    "history.status": "Status",
    "history.empty": "Par še ni odigral nobene tekme.",
    "history.roundShort": "R{n}",
    "history.vs": "vs {name}",
    "history.advanced": "Napredoval",
    "history.inProgress": "V teku",
    "history.win": "Zmaga",
    "history.loss": "Poraz",

    // ═══════════════════════ Drink bill (MatchBillButton) ═══════════════════════
    "bill.button": "Računi",
    "bill.paid": "Plačano",
    "bill.dialogTitle": "Računi za mizo",
    "bill.payer": "Plača:",
    "bill.noDrinks": "Ni dodanih pijač.",
    "bill.quantity": "× {n}",
    "bill.remove": "Odstrani",
    "bill.total": "Skupaj",
    "bill.addDrink": "Dodaj pijačo:",
    "bill.noCjenik": "Cenik ni nastavljen. Odpri zavihek “Cenik”, da dodaš cene pijač.",
    "bill.priceChip": "{name} · {price}",
    "bill.genericDrink": "Pijača",
    "bill.unpay": "Prekliči plačano",
    "bill.markPaid": "Označi plačano",
    "bill.paidByAt": "Poravnal/a {name}, {at}",
    "bill.paidAt": "Poravnano {at}",

    /* ═══════════════════ Natakarski dostop (Računi) ═══════════════════
       The URL token stays "racuni" in every locale — it is a route, not
       copy — so only the label below is translated. */
    "waiter.tab": "Računi",
    "waiter.actionFailed": "Dejanje ni uspelo.",
    "waiter.exit": "Odjavi se",

    // --- The code gate ------------------------------------------------------
    "waiter.gate.title": "Dostop za natakarje",
    "waiter.gate.description":
        "Vpiši štirimestno kodo, ki ti jo je dal organizator, in videl boš račune vseh miz tega turnirja.",
    "waiter.gate.codeLabel": "Koda",
    "waiter.gate.placeholder": "ABCD",
    "waiter.gate.submit": "Odpri račune",
    "waiter.gate.invalid": "Koda ni pravilna.",

    // --- Organiser: managing waiters ----------------------------------------
    "waiter.manage.heading": "Natakarji",
    "waiter.manage.description":
        "Povabi osebo in ji pošlji kodo ali povezavo. Vsak dobi svojo kodo — dostop mu lahko kadar koli odvzameš, posamično ali vsem naenkrat.",
    "waiter.manage.invite": "Povabi osebo",
    "waiter.manage.revokeAll": "Prekliči vsem",
    "waiter.manage.revokeAllTitle": "Prekličem dostop vsem?",
    "waiter.manage.revokeAllBody":
        "Vsak natakar takoj izgubi dostop do računov, njihove kode pa prenehajo veljati.",
    "waiter.manage.revokeAllConfirm": "Prekliči vsem",
    "waiter.manage.revokeAllFailed": "Dostopa ni bilo mogoče preklicati vsem.",
    "waiter.manage.revokeOne": "Prekliči dostop",
    "waiter.manage.revokeOneTitle": "Prekličem dostop ({name})?",
    "waiter.manage.revokeOneBody":
        "Koda takoj preneha veljati, naprave, kjer je bila vnesena, pa izgubijo dostop do računov.",
    "waiter.manage.revokeOneConfirm": "Prekliči",
    "waiter.manage.revokeFailed": "Dostopa ni bilo mogoče preklicati.",
    "waiter.manage.copyLink": "Kopiraj povezavo",
    "waiter.manage.linkCopied": "Povezava je kopirana",
    "waiter.manage.copyCode": "Kopiraj kodo",
    "waiter.manage.codeCopied": "Koda je kopirana",
    "waiter.manage.loadFailed": "Seznama natakarjev ni bilo mogoče naložiti.",
    "waiter.manage.emptyTitle": "Še ni natakarjev",
    "waiter.manage.emptyDescription": "Povabi prvo osebo in ji pošlji kodo ali povezavo.",
    "waiter.manage.headWaiterBadge": "Vodja",

    // --- Invite dialog -------------------------------------------------------
    "waiter.invite.title": "Povabi natakarja",
    "waiter.invite.nameLabel": "Ime",
    "waiter.invite.namePlaceholder": "npr. Ivan",
    "waiter.invite.submit": "Povabi",
    "waiter.invite.headWaiterLabel": "Vodja natakarjev",
    "waiter.invite.headWaiterHint": "Poleg računov lahko ta oseba ureja tudi cenik.",
    "waiter.invite.doneTitle": "Koda za {name} je pripravljena",
    "waiter.invite.doneDescription": "Deli kodo ali povezavo s to osebo. Veljata le zanjo.",
    "waiter.invite.done": "Končano",
    "waiter.invite.failed": "Povabilo ni uspelo.",

    // --- The bill list ------------------------------------------------------
    "waiter.list.unpaid": "Neplačano",
    "waiter.list.openBill": "Odpri račun",
    "waiter.list.versus": "{a} — {b}",
    "waiter.list.loadFailed": "Računov ni bilo mogoče naložiti.",
    "waiter.list.emptyTitle": "Računov še ni",
    "waiter.list.emptyDescription": "Računi se pojavijo takoj, ko je izžrebana prva runda.",
    "waiter.list.collapsePaid": "Strni plačan račun",
    "waiter.list.expandPaid": "Pokaži plačan račun",
    /* Slovenian keeps the dual, so both families really use all four
       categories: 1 račun, 2 računa, 3-4 računi, 5+ računov. */
    "waiter.chip.bills.one": "račun",
    "waiter.chip.bills.two": "računa",
    "waiter.chip.bills.few": "računi",
    "waiter.chip.bills.other": "računov",
    "waiter.chip.unpaid.one": "neplačan",
    "waiter.chip.unpaid.two": "neplačana",
    "waiter.chip.unpaid.few": "neplačani",
    "waiter.chip.unpaid.other": "neplačanih",

    // ═══════════════════════ Offline queue (SyncIndicator) ═══════════════════════
    "offline.description": "Ni povezave z internetom. Poveži se v omrežje in poskusi znova.",
    "sync.allSaved": "Vse je shranjeno",
    "sync.stuck": "Sinhronizacija se je zataknila",
    "sync.saving": "Shranjujem…",
    "sync.offline": "Ni povezave z internetom",
    "sync.offlineWithPending": "Ni povezave — {pending}",
    "sync.retry": "Poskusi znova",
    "sync.dropped.title": "Sprememba ni bila shranjena",
    "sync.dropped.description": "Strežnik je zavrnil: {what}. Preveri stanje in vnesi znova.",
    "sync.op.matchScore": "vnos rezultata",
    "sync.op.billAddDrink": "dodajanje pijače na račun",
    "sync.op.billRemoveDrink": "odstranjevanje pijače z računa",
    "sync.op.billPay": "označevanje računa kot plačanega",
    "sync.op.billUnpay": "preklic plačila računa",
    "sync.op.pairPaid": "sprememba prijavnine para",
    "sync.pending.one": "{n} sprememba čaka",
    "sync.pending.two": "{n} spremembi čakata",
    "sync.pending.few": "{n} spremembe čakajo",
    "sync.pending.other": "{n} sprememb čaka",

    // ═══════════════════════ "Poveži blok sa stolom" (BLOK-LINK.md §4) ═══════════════════════
    "blokLinks.pendingHeading": "Zahteve za povezavo",
    /* Dual kept, as everywhere else in this file: 1 zahteva, 2 zahtevi,
       3-4 zahteve, 5+ zahtev. */
    "blokLinks.pendingCount.one": "{n} zahteva",
    "blokLinks.pendingCount.two": "{n} zahtevi",
    "blokLinks.pendingCount.few": "{n} zahteve",
    "blokLinks.pendingCount.other": "{n} zahtev",
    "blokLinks.requestLine": "Runda {round} · Miza {table} · Par: {pair}",
    "blokLinks.approve": "Odobri",
    "blokLinks.reject": "Zavrni",
    "blokLinks.linkedBadge": "Blok povezan: {name}",
    "blokLinks.endLink": "Prekini povezavo z blokom",
    "blokLinks.rejectConfirmTitle": "Zavrniti zahtevo za povezavo?",
    "blokLinks.rejectConfirmBody": "{name} bo obveščen/a, da je zahteva zavrnjena.",
    "blokLinks.rejectConfirmYes": "Da, zavrni",
    "blokLinks.revokeConfirmTitle": "Prekiniti povezavo z blokom?",
    "blokLinks.revokeConfirmBody":
        "{name} ne bo več mogel/mogla pošiljati rezultata iz bloka za to mizo, dokler ne zaprosi za novo povezavo.",
    "blokLinks.revokeConfirmYes": "Da, prekini",
    "blokLinks.toast.approved": "Povezava z blokom odobrena",
    "blokLinks.toast.rejected": "Zahteva za povezavo zavrnjena",
    "blokLinks.toast.revoked": "Povezava z blokom prekinjena",

    /* ═══════════════════════════════════════════════════════════════════
       REVIZIJA 2026-09-08 — JAVNI ZAPISNIK POVEZANE MIZE
       BLOK-LINK.md §6.2
       ═══════════════════════════════════════════════════════════════════
       Vrstica tekme s povezanim blokom nosi povezavo na `/blok/z/{token}`.
       Napis je samostalnik, cel stavek o tem, da je javen, pa gre v `title`. */
    "blokLinks.logbook": "Zapisnik",
    "blokLinks.logbookTitle":
        "Odpri zapisnik povezanega bloka — javna povezava, odpre se v novem zavihku",
}
