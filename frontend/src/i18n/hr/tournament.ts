/* `tournament` — tournament list/detail/organiser console copy — cards, statuses,
   rounds, matches, pairs, drink bills, repassage.

   Croatian is the source of truth: this file's shape defines what
   `src/i18n/sl/tournament.ts` must provide, and a missing Slovenian key is a
   compile error. Keys are flat within the namespace (leaf names may contain
   dots; `t()` splits at the first dot only), and are addressed as
   `t("tournament.someKey")`.

   Owned by ONE agent of the extraction pass — nobody else edits this file.

   This pass covers TournamentDetailsPage, MatchBillButton and SyncIndicator.

   Two conventions worth knowing before editing:

   1. Plural families follow `i18n/index.ts`: every family defines
      `.one` / `.two` / `.few` / `.other` even though Croatian's own
      `pluralCategory()` never selects `.two` — Slovenian needs that slot to
      exist in the shared shape so it can carry its real dual form. Where the
      pre-extraction code rendered ONE hardcoded string regardless of count
      (`parova / 12`, `platilo kotizaciju`, `aktivnih`), every Croatian
      category below is that same string: this is a move, not a grammar fix.
      Same precedent as `pages.ts` / `profile.ts`.

   2. Sentences that wrap a bold run of text are split into
      `.before` / `.bold` / `.after` leaves rather than smuggling markup into
      a value. Concatenation of DATA, by contrast, is always one key with
      `{placeholders}`. */

export const tournament = {
    // ═══════════════════════ Page chrome ═══════════════════════
    backToList: "Natrag na popis",
    notFound: "Turnir nije pronađen.",
    loadFailed: "Turnir se nije mogao učitati.",
    loadingAria: "Učitavanje turnira",
    ok: "U redu",
    no: "Ne",
    expand: "Proširi",
    collapse: "Sažmi",
    expandAll: "Proširi sve",
    collapseAll: "Sažmi sve",
    fullscreen: "Puni zaslon",
    winnersHeading: "Pobjednici",

    /* --- Status pill --------------------------------------------------------
       Shown under the tournament name in the detail screen's sidebar (lg+)
       and in its compact mobile header. The enum VALUES (DRAFT / STARTED /
       FINISHED) cross the wire and never change; only these labels do. */
    "status.draft": "Nadolazeći",
    "status.started": "U tijeku",
    "status.finished": "Završeno",

    // --- Tabs ---------------------------------------------------------------
    "tab.details": "Detalji",
    "tab.pairs": "Parovi",
    "tab.bracket": "Ždrijeb",
    "tab.cjenik": "Cjenik",

    /* Accessible name of the horizontally scrollable section switcher that
       replaces the sidebar nav on phones. */
    "nav.sectionsAria": "Odjeljci turnira",

    /* Heading of the podium card that appears once a tournament is finished —
       in the sidebar on lg+, in the content column on phones. */
    "results.heading": "Rezultati",

    // --- Toolbar actions ----------------------------------------------------
    "actions.edit": "Uredi",
    /* Label of the "⋯" overflow menu holding the secondary actions on phones,
       where there is no room for the sidebar's action rows. */
    "actions.more": "Više radnji",
    "share.button": "Podijeli",
    "share.copied": "Kopirano!",
    /* window.prompt fallback when the clipboard API is unavailable. */
    "share.copyPrompt": "Kopiraj link:",
    addToCalendar: "Dodaj u kalendar",

    /* --- Document head / SEO -------------------------------------------------
       `headTitle` has two shapes depending on whether the tournament carries a
       location, and `headDesc` four depending on which of location / start
       date the organiser filled in — one key per shape rather than gluing
       fragments together, so a translator can reorder them freely.
       NOT translated (and deliberately so): the Event / BreadcrumbList JSON-LD
       further down the page. That block must stay byte-for-byte what the
       backend SSR preview controller emits for crawlers, or Search Console
       sees two conflicting structured-data variants of the same URL. */
    "seo.title": "{name} — bela-turniri.com",
    "seo.titleWithLocation": "{name}, {location} — bela-turniri.com",
    "seo.titleFallback": "Turnir — bela-turniri.com",
    "seo.desc": "Bela turnir {name}",
    "seo.descWithLocation": "Bela turnir {name} u {location}",
    "seo.descWithDate": "Bela turnir {name} — {date}",
    "seo.descWithLocationAndDate": "Bela turnir {name} u {location} — {date}",

    // ═══════════════════════ Detalji tab — read mode ═══════════════════════
    "tile.createdBy": "Kreirao",
    "tile.date": "Datum",
    "tile.startTime": "Vrijeme početka",
    "tile.maxPairs": "Max parova",
    "tile.unlimited": "Neodređeno",
    "tile.location": "Lokacija",
    "tile.details": "Detalji",
    "tile.entryPrice": "Kotizacija",
    "tile.repassage": "Repasaž",
    "tile.repassageSecond": "Drugi repasaž",
    "tile.repassageUntil": "Repasaž do",
    "tile.rewards": "Nagrade",
    "tile.additionalOptions": "Dodatne opcije",

    "tile.pairs": "Parovi",
    "tile.contact": "Kontakt",
    /* Placeholder in a tile whose field the organiser left empty — the
       organiser tile and the contact tile are always rendered so the identity
       row keeps its four-across rhythm, so both need something to say. */
    "tile.notSpecified": "Nije navedeno",

    /* --- QR card (components/TournamentQrCard.tsx) --------------------------
       The QR code as a card on the Detalji view. Its alt text and the
       "Preuzmi QR" button label are shared with the dialog and live in
       `common.qr.*`; only the card's own heading and hint are here. */
    "qr.cardTitle": "QR kod",
    "qr.cardHint": "Skeniranjem se otvara stranica ovog turnira. Preuzmi ga i objesi na mjestu održavanja.",

    openInGoogleMaps: "Otvori u Google Maps",
    openInMaps: "Otvori u kartama",

    /* Labels for the RepassageUntil enum. The enum VALUE (FINALS /
       SEMIFINALS / FIRST_ROUND) is what crosses the wire and never changes;
       only these display strings do. */
    "repassageUntil.FINALS": "Finala",
    "repassageUntil.SEMIFINALS": "Polufinala",
    "repassageUntil.FIRST_ROUND": "Prvog kruga",

    "place.first": "1. mjesto",
    "place.second": "2. mjesto",
    "place.third": "3. mjesto",

    /* Same idea for RewardType (FIXED / PERCENTAGE). */
    "reward.fixed": "Fiksne",
    "reward.percentage": "Postotak fonda",

    // ═══════════════════════ Detalji tab — edit mode ═══════════════════════
    "edit.sectionBasic": "Osnovno",
    "edit.sectionFees": "Kotizacija i repasaž",
    "edit.sectionContact": "Kontakt organizatora",
    "edit.name": "Ime turnira",
    "edit.dateTime": "Datum i vrijeme",
    "edit.timeCaption": "Vrijeme",
    "edit.dateTimePlaceholder": "DD/MM/GGGG HH:MM",
    "edit.maxPairsHelp": "Ostavi prazno za neograničen broj parova.",
    "edit.locationPlaceholder": "npr. Caffe bar Belot, Zagreb",
    "edit.poster": "Plakat",
    "edit.optional": "(opcionalno)",
    "edit.optionalShort": "(opc.)",
    "edit.removePoster": "Ukloni plakat",
    "edit.changeImage": "Promijeni sliku",
    "edit.replacePoster": "Zamijeni plakat",
    "edit.chooseImage": "Odaberi sliku",
    "edit.posterWillBeRemoved": "Plakat će biti uklonjen pri spremanju.",
    "edit.posterHint": "PNG, JPG ili WEBP, do {mb} MB.",
    /* The "12,00€/par • 6,00€/igrač" helper under each price input. The
       amounts and the € / • punctuation stay in the JSX; only the two unit
       suffixes are copy. */
    "edit.perPair": "/par",
    "edit.perPlayer": "/igrač",
    "edit.repassageUntilLabel": "Repasaž moguć do",
    "edit.repassageUntilHelp": "Zadnja runda prije koje je moguće kupiti dodatni život.",
    "edit.rewardFixed": "Fiksne (€)",
    "edit.rewardPercentage": "Postotak fonda (%)",
    "edit.contactName": "Ime",
    "edit.contactNamePlaceholder": "Ime organizatora",
    "edit.contactPhone": "Broj telefona",
    /* An example local number, not prose. Left as-is in every locale: the
       country prefix beside it is picked from PHONE_COUNTRIES, so a
       locale-swapped example would only ever agree with one of them. */
    "edit.contactPhonePlaceholder": "91 234 5678",
    "edit.saveChanges": "Spremi izmjene",
    "edit.readyToSave": "Spremno za spremanje.",
    "edit.pastInline": "Datum i vrijeme ne mogu biti u prošlosti.",
    "edit.missingInline": "Nedostaje: {fields}",

    /* Required-field names, joined into the two messages above. */
    "edit.required.name": "Ime",
    "edit.required.location": "Lokacija",
    "edit.required.date": "Datum",
    "edit.required.time": "Vrijeme",
    "edit.required.rewards": "Nagrade",

    "edit.missingTitle": "Nedostaju obavezna polja",
    "edit.missingDescription": "Nedostaje: {fields}.",
    "edit.pastTitle": "Neispravan termin",
    "edit.pastDescription": "Datum i vrijeme turnira ne mogu biti u prošlosti.",

    "poster.allowedTypes": "Dozvoljeno: JPG, PNG ili WEBP.",
    "poster.maxSize": "Maksimalna veličina je {mb} MB.",

    // ═══════════════════════ Parovi tab ═══════════════════════
    "pairs.nameLabel": "Ime para",
    "pairs.matchHistory": "Povijest mečeva",
    "pairs.submittedBy": "Prijavio:",
    "pairs.pendingApproval": "Čeka odobrenje",
    "pairs.winLoss": "{wins}W – {losses}L",
    "pairs.hasLife": "Ima život",
    "pairs.noLife": "Nema život",
    "pairs.eliminated": "Eliminiran",
    "pairs.paid": "Plaćeno",
    "pairs.unpaid": "Nije plaćeno",
    "pairs.approve": "Odobri",
    "pairs.pay": "Plati",
    "pairs.markUnpaid": "Označi neplaćeno",
    "pairs.markPaidTitle": "Označi kao plaćeno",
    "pairs.markUnpaidTitle": "Označi kao neplaćeno",
    "pairs.removePair": "Ukloni par",
    "pairs.addPair": "Dodaj par",
    "pairs.addPairTitle": "Dodaj novi par",
    "pairs.atCapacityTitle": "Maksimalan broj parova ({max})",
    "pairs.registerPair": "Prijavi par za turnir",
    "pairs.registerAnother": "Prijavi još jedan par",
    "pairs.overCapacity": "+{n} preko kapaciteta",
    "pairs.eliminatedHeading": "Eliminirani",
    "pairs.pendingHeading": "Čekaju odobrenje",
    "pairs.emptyTitle": "Još nema parova",
    "pairs.emptyDescription": "Dodaj prvi par klikom na \"Dodaj par\" iznad.",
    "pairs.emptyDescriptionReadonly": "Organizator još nije prijavio nijedan par.",
    /* Master/detail: the list column, and the panel beside it. */
    "pairs.noName": "Bez imena",
    "pairs.backToList": "Natrag na popis parova",
    "pairs.detailEmptyTitle": "Odaberi par",
    "pairs.detailEmptyDescription": "Klikni par s popisa da vidiš njegov status i sve radnje.",

    /* The extra-life ("Život") button: one label, four tooltips. */
    "pairs.life.label": "Život",
    "pairs.life.buy": "Kupi život",
    "pairs.life.alreadyBought": "Već kupljeno",
    "pairs.life.saveFirst": "Spremi prvo",
    "pairs.life.unavailable": "Nije dostupno",

    /* Counters in the Parovi header card. The number itself is rendered in a
       separate element; these are the units that follow it, so they go
       through `usePlural` with that same count — Croatian keeps one form
       (exactly what the page rendered before), Slovenian gets its four. */
    "pairs.capacityOf.one": "parova / {max}",
    "pairs.capacityOf.two": "parova / {max}",
    "pairs.capacityOf.few": "parova / {max}",
    "pairs.capacityOf.other": "parova / {max}",
    "pairs.capacityUnlimited.one": "parova / ∞",
    "pairs.capacityUnlimited.two": "parova / ∞",
    "pairs.capacityUnlimited.few": "parova / ∞",
    "pairs.capacityUnlimited.other": "parova / ∞",
    "pairs.paidEntry.one": "platilo kotizaciju",
    "pairs.paidEntry.two": "platilo kotizaciju",
    "pairs.paidEntry.few": "platilo kotizaciju",
    "pairs.paidEntry.other": "platilo kotizaciju",
    "pairs.activeCount.one": "aktivnih",
    "pairs.activeCount.two": "aktivnih",
    "pairs.activeCount.few": "aktivnih",
    "pairs.activeCount.other": "aktivnih",

    /* Count next to a group heading in the pair list ("ELIMINIRANI · 4 para").
       Unlike the header-card counters above, the number is INSIDE the string
       here, so `{n}` carries it. */
    "pairs.groupCount.one": "{n} par",
    "pairs.groupCount.two": "{n} para",
    "pairs.groupCount.few": "{n} para",
    "pairs.groupCount.other": "{n} parova",

    /* Failures raised by the bulk pair editor. */
    "pairs.notSavedTitle": "Parovi nisu spremljeni",
    "pairs.nameEmpty": "Ime para ne može biti prazno.",
    "pairs.nameBeforePay": "Unesi ime para prije plaćanja.",

    // --- Open pair-finding requests -----------------------------------------
    "pairRequests.title": "Zahtjevi za partnera",

    // --- Self-registration dialog -------------------------------------------
    "selfReg.savedPairs": "Tvoji spremljeni parovi",
    "selfReg.namePlaceholder": "npr. Marko & Pero",
    "selfReg.submit": "Prijavi se",
    "selfReg.pendingNote.before": "Par će biti označen",
    "selfReg.pendingNote.bold": "žuto",
    "selfReg.pendingNote.after": "dok ga organizator ne potvrdi.",
    "selfReg.nameRequired": "Unesi ime para.",
    "selfReg.alreadyStarted": "Turnir je već započeo.",
    "selfReg.alreadyRegistered": "Već si prijavio par s tim imenom.",
    "selfReg.error": "Greška pri prijavi.",

    // ═══════════════════════ Ždrijeb tab ═══════════════════════
    /* Short on purpose. It is a PILL that sits in the 76px table column of a
       match row — the same column that carries "Stol 7" on every other row —
       so it has to read at a glance and fit next to the table numbers above
       it. The long form ("Slobodan prolaz") did neither. */
    "bracket.bye": "Slobodni",
    "bracket.notStartedTitle": "Turnir još nije započeo",
    "bracket.notStartedOwner": "Klikni \"Startaj turnir\" iznad kad su svi parovi spremni.",
    "bracket.notStartedViewer": "Organizator još nije pokrenuo turnir. Provjeri kasnije.",
    "bracket.noRoundsTitle": "Još nema rundi",
    "bracket.noRoundsOwnerStarted": "Klikni \"Generiraj prvu rundu\" da započneš ždrijeb.",
    "bracket.noRoundsOwnerDraft": "Prvo startaj turnir kad su svi parovi spremni.",
    "bracket.noRoundsViewer": "Organizator još nije generirao parove. Provjeri kasnije.",
    /* Overflow menu in the ždrijeb toolbar. Holds the rare and the
       destructive — ručno generiranje i reset turnira — so neither sits next
       to "Generiraj rundu". */
    "bracket.moreActions": "Više radnji za turnir",

    /* "Stol 7" is a table NUMBER, not a count of tables — no plural family. */
    table: "Stol {n}",
    tableLabel: "Stol",

    "settings.allowRepeatsLabel": "Ponavljanje istih parova",
    /* The hint is no longer printed under the switch — it costs the toolbar a
       whole strip — it lives behind the "?" next to it. */
    "settings.allowRepeatsHint": "Dopusti da isti parovi igraju ponovno",
    "settings.allowRepeatsHelp": "Što ovo znači?",

    // --- Round card ---------------------------------------------------------
    "round.heading": "Runda {n}",
    "round.completed": "Završeno",
    "round.inProgress": "Igra se",
    "round.expand": "Proširi rundu",
    "round.collapse": "Sažmi rundu",
    "round.noMatches": "Nema mečeva u ovoj rundi.",
    "round.generate": "Generiraj rundu",
    "round.generateFirst": "Generiraj prvu rundu",
    "round.generateNextTitle": "Generiraj sljedeću rundu",
    "round.generateBlockedTitle": "Završi trenutnu rundu ili dodaj parove",
    "round.manualButton": "Ručno generiraj",
    /* Reads as a full action, not a bare verb: it is a menu item now, not a
       button sitting next to "Završi rundu" whose noun it could borrow. */
    "round.resetButton": "Resetiraj rundu",
    "round.resetTitle": "Obriši mečeve u rundi i vrati statistiku",
    "round.moreActions": "Više radnji za rundu",
    "round.finishButton": "Završi rundu",
    "round.finishTitle": "Završi rundu",
    "round.finishBlockedTitle": "Unesi sve rezultate prvo",
    "round.resetConfirmTitle": "Resetirati rundu?",
    "round.resetConfirmBody":
        "Svi mečevi u ovoj rundi bit će obrisani, a statistika parova vraćena na stanje prije runde.",

    /* Round-level failures. The titles double as the `requireOnlineFor`
       heading, which is why they read as outcomes ("Runda nije završena")
       rather than as actions. */
    "round.notGeneratedTitle": "Kolo nije generirano",
    "round.notFinishedTitle": "Runda nije završena",
    "round.pendingOps":
        "Neke promjene još čekaju spremanje. Pričekaj da nestane oznaka o promjenama koje čekaju.",
    "round.someScoresFailedTitle": "Neki rezultati nisu spremljeni",
    "round.someScoresFailedDescription": "Stolovi: {tables}. Runda nije završena — pokušaj ponovno.",
    "round.cannotResetTitle": "Runda se ne može resetirati",
    "round.notLoaded": "Turnir nije učitan.",
    "round.completedCannotReset": "Završena runda se više ne može poništiti.",

    // --- Match row ----------------------------------------------------------
    pendingSave: "Čeka spremanje",
    "match.editTitle": "Uredi rezultat meča",
    /* The per-row save control is a floppy icon, so this is its only name —
       it is both the aria-label and the tooltip. */
    "match.saveAria": "Spremi rezultat",
    "match.scoreAria": "Rezultat — {pair}",
    /* Row state. Colour carries it visually; these carry it to a screen
       reader and to anyone hovering the row. */
    "match.stateOpen": "Bez rezultata",
    "match.stateLive": "Rezultat u tijeku",
    "match.stateUnsaved": "Nespremljeno",
    "match.stateEditing": "Uređivanje rezultata",
    "match.stateFinished": "Meč završen",
    "match.invalidScoreTitle": "Neispravan rezultat",
    "match.invalidScoreDescription": "Unesi ispravne rezultate za oba para (različiti brojevi).",

    // --- Fullscreen round dialog -------------------------------------------
    fullscreenRoundTitle: "Runda {n} — Puni zaslon",
    /* The board is meant for a laptop or TV at the venue, so it has exactly
       two sizes: fewer + bigger cards, or more + smaller ones. Deliberately
       not a slider or a zoom percentage — the organiser picks one of two
       once and walks away from the machine. */
    "fullscreen.sizeLabel": "Veličina kartica",
    "fullscreen.smaller": "Manje",
    "fullscreen.larger": "Veće",
    /* The browser's OWN fullscreen (F11), on top of the overlay — it drops
       the address bar and the tab strip, which is the difference between a
       usable wall display and a wall display with Chrome's chrome on it.
       Named so it can't be confused with "Puni zaslon", which opens the
       overlay in the first place. */
    "fullscreen.enterNative": "Sakrij preglednik (cijeli zaslon)",
    "fullscreen.exitNative": "Vrati preglednik",

    // ═══════════════════════ Lifecycle actions ═══════════════════════
    "start.button": "Startaj turnir",
    "start.startTitle": "Pokreni turnir",
    "start.needTwoPaid": "Treba najmanje 2 plaćena para za start",
    "start.notStartedTitle": "Turnir nije pokrenut",
    "start.cannotStartTitle": "Turnir se ne može pokrenuti",
    "start.insufficientPairs": "Treba najmanje 2 plaćena para da bi se turnir mogao pokrenuti.",

    "finish.button": "Završi turnir",
    "finish.notFinishedTitle": "Turnir nije završen",
    "finish.cannotFinishTitle": "Turnir se ne može završiti",
    "finish.alreadyFinished": "Turnir je već završen.",
    "finish.roundInProgress": "Zadnja runda još nije završena.",

    "reset.button": "Resetiraj turnir",
    "reset.title": "Obriši sve runde i vrati turnir u nacrt",
    "reset.notResetTitle": "Turnir nije resetiran",
    "reset.confirmTitle": "Resetirati turnir?",
    "reset.confirmBody":
        "Sve runde i mečevi bit će obrisani, a turnir vraćen u nacrt. Ova radnja se ne može poništiti.",
    "reset.confirmYes": "Da, resetiraj",

    /* The UNPAID_REQUIRED 409 modal. The bare code is what the SPA switches
       on; this is the sentence it shows because of it. */
    "unpaid.title": "Turnir ne može početi",
    "unpaid.body.before": "Turnir se ne može startati dok sve ekipe nemaju označenu",
    "unpaid.body.bold": "kotizaciju",
    "unpaid.body.after": ". Molim označite “Kotizacija” za sve parove koji su platili.",

    // --- Manual round confirmation -----------------------------------------
    "manualRound.confirmTitle": "Ručna generacija kola?",
    "manualRound.confirmBody":
        "Sigurno želiš ručno odabrati parove za sljedeće kolo? Ovaj korak zaobilazi automatski ždrijeb i postavlja točno onaj raspored koji odabereš.",
    "manualRound.confirmYes": "Da, ručno",

    // --- Destructive confirmations -----------------------------------------
    "deleteTournament.title": "Obriši turnir?",
    "deleteTournament.before": "Obrisati turnir",
    "deleteTournament.after":
        "? Turnir više neće biti vidljiv u pretrazi, na karti, kalendaru ni u profilima igrača. Ova radnja se ne poništava kroz aplikaciju.",
    "deleteTournament.confirm": "Da, obriši",

    "deletePair.title": "Ukloni par?",
    "deletePair.before": "Stvarno ukloniti par",
    "deletePair.after": "iz turnira? Ova radnja se ne može poništiti.",
    "deletePair.confirm": "Da, ukloni",

    // ═══════════════════════ Pair match-history dialog ═══════════════════════
    "history.played": "Odigrano",
    "history.wins": "Pobjede",
    "history.losses": "Porazi",
    "history.status": "Status",
    "history.empty": "Par još nije odigrao niti jedan meč.",
    "history.roundShort": "R{n}",
    "history.vs": "vs {name}",
    "history.advanced": "Prošao",
    "history.inProgress": "U tijeku",
    "history.win": "Pobjeda",
    "history.loss": "Poraz",

    // ═══════════════════════ Drink bill (MatchBillButton) ═══════════════════════
    "bill.button": "Računi",
    "bill.paid": "Plaćeno",
    "bill.dialogTitle": "Računi za stol",
    "bill.payer": "Plaća:",
    "bill.noDrinks": "Nema dodanih pića.",
    "bill.quantity": "× {n}",
    "bill.remove": "Ukloni",
    "bill.total": "Ukupno",
    "bill.addDrink": "Dodaj piće:",
    "bill.noCjenik": "Cjenik nije postavljen. Otvori tab “Cjenik” da dodaš cijene pića.",
    "bill.priceChip": "{name} · {price}",
    /* Name shown on an optimistic drink row whose price row could not be
       resolved locally — the server's answer replaces it moments later. */
    "bill.genericDrink": "Piće",
    "bill.unpay": "Poništi plaćeno",
    "bill.markPaid": "Označi plaćeno",
    "bill.paidByAt": "Naplatio/la {name}, {at}",
    "bill.paidAt": "Naplaćeno {at}",

    /* ═══════════════════ Konobarski pristup (Računi) ═══════════════════
       The waiter surface: a four-letter code an organiser hands to the bar
       staff, and the bill list it unlocks. `waiter.tab` is the section's
       LABEL — its URL token ("racuni") is a route, not copy, and lives in
       TournamentDetailsPage's SECTION_SLUG map alongside detalji/parovi/
       zdrijeb/cjenik, deliberately outside these dictionaries. */
    "waiter.tab": "Računi",
    /* Toast title for any failed waiter write. The server's own sentence
       becomes the description when it sent one. */
    "waiter.actionFailed": "Radnja nije uspjela.",
    "waiter.exit": "Odjavi se",

    // --- The code gate ------------------------------------------------------
    "waiter.gate.title": "Pristup za konobare",
    "waiter.gate.description":
        "Upiši četveroslovni kod koji ti je dao organizator i vidjet ćeš račune svih stolova ovog turnira.",
    "waiter.gate.codeLabel": "Kod",
    "waiter.gate.placeholder": "ABCD",
    "waiter.gate.submit": "Otvori račune",
    /* Fallback only — the backend answers a wrong code with its own message
       in the reader's jeziku, and that one is shown as-is. */
    "waiter.gate.invalid": "Kod nije ispravan.",

    // --- Organiser: managing waiters ----------------------------------------
    /* Several named waiters per tournament now, not one shared code — see
       `WaiterAccessService`. This panel lists them; the invite flow lives in
       its own `waiter.invite.*` block below. */
    "waiter.manage.heading": "Konobari",
    "waiter.manage.description":
        "Pozovi osobu i pošalji joj kod ili poveznicu. Svatko dobiva svoj kod — pristup mu možeš oduzeti u bilo kojem trenutku, zasebno ili svima odjednom.",
    "waiter.manage.invite": "Pozovi osobu",
    "waiter.manage.revokeAll": "Opozovi sve",
    "waiter.manage.revokeAllTitle": "Opozvati pristup svima?",
    "waiter.manage.revokeAllBody":
        "Svaki konobar odmah gubi pristup računima, a njihovi kodovi prestaju vrijediti.",
    "waiter.manage.revokeAllConfirm": "Opozovi sve",
    "waiter.manage.revokeAllFailed": "Pristup se nije mogao opozvati svima.",
    "waiter.manage.revokeOne": "Opozovi pristup",
    "waiter.manage.revokeOneTitle": "Opozvati pristup ({name})?",
    "waiter.manage.revokeOneBody":
        "Kod odmah prestaje vrijediti, a uređaji na kojima je unesen gube pristup računima.",
    "waiter.manage.revokeOneConfirm": "Opozovi",
    "waiter.manage.revokeFailed": "Pristup se nije mogao opozvati.",
    "waiter.manage.copyLink": "Kopiraj poveznicu",
    "waiter.manage.linkCopied": "Poveznica je kopirana",
    "waiter.manage.copyCode": "Kopiraj kod",
    "waiter.manage.codeCopied": "Kod je kopiran",
    "waiter.manage.loadFailed": "Popis konobara se nije mogao učitati.",
    "waiter.manage.emptyTitle": "Još nema konobara",
    "waiter.manage.emptyDescription": "Pozovi prvu osobu i pošalji joj kod ili poveznicu.",
    "waiter.manage.headWaiterBadge": "Gazda",

    // --- Invite dialog -------------------------------------------------------
    "waiter.invite.title": "Pozovi konobara",
    "waiter.invite.nameLabel": "Ime",
    "waiter.invite.namePlaceholder": "npr. Ivan",
    "waiter.invite.submit": "Pozovi",
    "waiter.invite.headWaiterLabel": "Gazda konobara",
    "waiter.invite.headWaiterHint": "Uz račune, ova osoba može uređivati i cjenik.",
    "waiter.invite.doneTitle": "Kod za {name} je spreman",
    "waiter.invite.doneDescription": "Podijeli kod ili poveznicu s tom osobom. Vrijede samo za nju.",
    "waiter.invite.done": "Gotovo",
    "waiter.invite.failed": "Poziv nije uspio.",

    // --- The bill list ------------------------------------------------------
    "waiter.list.unpaid": "Neplaćeno",
    "waiter.list.openBill": "Otvori račun",
    /* Two pair names on one row. One key, not a `join`, so the separator is
       a translator's choice. */
    "waiter.list.versus": "{a} — {b}",
    "waiter.list.loadFailed": "Računi se nisu mogli učitati.",
    "waiter.list.emptyTitle": "Još nema računa",
    "waiter.list.emptyDescription": "Računi se pojavljuju čim se izvuče prva runda.",
    /* A settled bill collapses to one line by default — see
       `RacuniSection`'s per-row expand state. */
    "waiter.list.collapsePaid": "Sažmi plaćeni račun",
    "waiter.list.expandPaid": "Prikaži plaćeni račun",
    /* Counter chips above the list. Read at a glance on a phone, so both
       are real plural families — see the `.two` note at the top of the file. */
    "waiter.chip.bills.one": "račun",
    "waiter.chip.bills.two": "računa",
    "waiter.chip.bills.few": "računa",
    "waiter.chip.bills.other": "računa",
    "waiter.chip.unpaid.one": "neplaćen",
    "waiter.chip.unpaid.two": "neplaćena",
    "waiter.chip.unpaid.few": "neplaćena",
    "waiter.chip.unpaid.other": "neplaćenih",

    // ═══════════════════════ Offline queue (SyncIndicator) ═══════════════════════
    "offline.description": "Nema veze s internetom. Spoji se na mrežu pa pokušaj ponovno.",
    "sync.allSaved": "Sve je spremljeno",
    "sync.stuck": "Sinkronizacija je zapela",
    "sync.saving": "Spremam…",
    "sync.offline": "Nema veze s internetom",
    "sync.offlineWithPending": "Nema veze — {pending}",
    "sync.retry": "Pokušaj ponovno",
    "sync.dropped.title": "Promjena nije spremljena",
    "sync.dropped.description": "Poslužitelj je odbio: {what}. Provjeri stanje i unesi ponovno.",
    "sync.op.matchScore": "unos rezultata",
    "sync.op.billAddDrink": "dodavanje pića na račun",
    "sync.op.billRemoveDrink": "uklanjanje pića s računa",
    "sync.op.billPay": "označavanje računa plaćenim",
    "sync.op.billUnpay": "poništavanje plaćanja računa",
    "sync.op.pairPaid": "promjena kotizacije para",
    /* Read at a glance on a phone, so it really is pluralised: 1/21/31 take
       the singular, 2-4/22-24 the paucal, everything else (11-14 included)
       the plural. This replaces a hand-rolled helper in SyncIndicator.tsx. */
    "sync.pending.one": "{n} promjena čeka",
    "sync.pending.two": "{n} promjene čekaju",
    "sync.pending.few": "{n} promjene čekaju",
    "sync.pending.other": "{n} promjena čeka",
}

/** Contract every other locale's `tournament` namespace must satisfy. */
export type TournamentDict = typeof tournament
