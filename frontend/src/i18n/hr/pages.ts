/* `pages` — page-level chrome that is not a form and not a tournament —
   home/calendar/map/404 headings, empty states, SEO titles, the guided tour.

   Croatian is the source of truth: this file's shape defines what
   `src/i18n/sl/pages.ts` must provide, and a missing Slovenian key is a
   compile error. Keys are flat within the namespace (leaf names may contain
   dots; `t()` splits at the first dot only), and are addressed as
   `t("pages.someKey")`.

   Owned by ONE agent of the extraction pass — nobody else edits this file.

   This pass covers TournamentsPage, CalendarPage, MapPage, FindPairPage.

   Plural families follow the pattern in `i18n/index.ts`: every family below
   defines `.one` / `.two` / `.few` / `.other` even where Croatian's own
   `pluralCategory()` never selects `.two` — Slovenian needs that slot to
   exist in the shared shape so it can carry its real dual form. Where the
   pre-extraction code used a single hardcoded template regardless of count
   (never doing real Croatian pluralisation), every hr category below is the
   SAME string the page already rendered — this is a move, not a grammar
   fix (matches the precedent set in `profile.ts`'s `tournamentsCount` /
   `winsCount` families). */

export const pages = {
    // ═══════════════════════ TournamentsPage ═══════════════════════
    "tournaments.badge.finished": "Završen",
    "tournaments.badge.full": "Mjesta puna",
    "tournaments.badge.upcoming": "Nadolazeći",
    "tournaments.noPoster": "Nema plakata",
    // Uvod u ime pobjedničkog para na kartici završenog turnira. Verzalom se
    // ispisuje u komponenti (CSS), pa ovdje ostaje normalno pisano.
    "tournaments.winnersLabel": "Pobjednik",

    // relativeDays: "Danas" / "Sutra" never disagree with count (they're not
    // count-driven at all); `inDays` covers the 2-14 day window and, in the
    // pre-extraction code, always rendered "Za N dana" regardless of N.
    "tournaments.relativeDays.today": "Danas",
    "tournaments.relativeDays.tomorrow": "Sutra",
    "tournaments.relativeDays.inDays.one": "Za {n} dana",
    "tournaments.relativeDays.inDays.two": "Za {n} dana",
    "tournaments.relativeDays.inDays.few": "Za {n} dana",
    "tournaments.relativeDays.inDays.other": "Za {n} dana",

    // --- Document head / SEO -------------------------------------------------
    // `useDocumentHead` currently pins the tab title to a static string and
    // ignores `title`, but the page still passes one, so it is translated.
    "tournaments.seo.title": "Bela turniri u Hrvatskoj — bela-turniri.com",
    "tournaments.seo.description":
        "Pregled svih nadolazećih i odigranih Bela turnira u Hrvatskoj i regiji. Pretraži po lokaciji, datumu i cijeni.",
    "tournaments.seo.ogTitle": "Bela turniri u Hrvatskoj",
    "tournaments.seo.ogDescription":
        "Pregled svih nadolazećih i odigranih Bela turnira u Hrvatskoj i regiji.",

    /* --- Distance filter -------------------------------------------------
       The listing's own control is now the "U krugu od" slider inside the
       filter panel; `nearMe.label` stays because CalendarPage still labels
       its own toggle with it. */
    "tournaments.nearMe.label": "U blizini",
    "tournaments.nearMe.deniedTitle": "Lokacija nije dostupna",
    "tournaments.nearMe.deniedDescription":
        "Dopusti pristup lokaciji u pregledniku da bi filter po udaljenosti radio.",
    "tournaments.nearMe.unsupported": "Preglednik ne podržava geolokaciju.",
    "tournaments.nearMe.enable": "Uključi",
    "tournaments.nearMe.denied": "Lokacija je odbijena u pregledniku.",

    // --- Search + filter toolbar -----------------------------------------------
    "tournaments.search.placeholder": "Pretraži po imenu turnira, gradu ili dvorani…",
    "tournaments.search.clearAria": "Očisti pretragu",
    "tournaments.filters.toggleShow": "Prikaži filtere",
    "tournaments.filters.toggleHide": "Sakrij filtere",
    "tournaments.filters.button": "Filteri",
    "tournaments.createCta": "Kreiraj turnir",
    "tournaments.filters.locationLabel": "Lokacija",
    "tournaments.filters.locationPlaceholder": "npr. Zagreb",
    "tournaments.filters.priceLabel": "Kotizacija (€)",
    "tournaments.filters.repassageLabel": "Repasaž (€)",
    "tournaments.filters.priceFromPlaceholder": "od",
    "tournaments.filters.priceToPlaceholder": "do",
    // Klizač koji je zamijenio prekidač „Blizu mene“ i tri čipa s radijusom.
    // Na krajnjoj desnoj poziciji („Sve“) filter po udaljenosti je isključen.
    "tournaments.filters.radiusLabel": "U krugu od:",
    "tournaments.filters.radiusAll": "Sve",
    "tournaments.filters.clearAll": "Očisti sve",
    "tournaments.filters.clearAllTitleActive": "Očisti sve filtere",
    "tournaments.filters.clearAllTitleInactive": "Nema aktivnih filtera",

    // --- Sortiranje ----------------------------------------------------------
    "tournaments.sort.label": "Sortiraj:",
    "tournaments.sort.dateAsc": "Najraniji prvi",
    "tournaments.sort.dateDesc": "Najkasniji prvi",
    "tournaments.sort.priceAsc": "Najjeftiniji prvi",
    "tournaments.sort.popular": "Najpopularniji",
    "tournaments.sort.nameAsc": "Abecedno",
    // Dostupno tek kad je lokacija poznata — bez nje je stavka onemogućena.
    "tournaments.sort.distanceAsc": "Najbliži prvi",

    // --- Prikaz: mreža kartica ↔ popis redaka --------------------------------
    "tournaments.view.label": "Prikaz turnira",
    "tournaments.view.grid": "Mreža",
    "tournaments.view.list": "Popis",

    // --- Kartica turnira -----------------------------------------------------
    "tournaments.card.fillLabel": "Popunjenost",
    "tournaments.card.entryFeeLabel": "kotizacija",
    "tournaments.card.repassageLabel": "repasaž",
    "tournaments.card.freeEntry": "Besplatno",
    "tournaments.card.noWinner": "Pobjednik nije upisan",

    // --- Empty / error states ----------------------------------------------
    "tournaments.empty.upcomingErrorTitle": "Nije moguće učitati turnire",
    "tournaments.empty.upcomingEmptyTitle": "Nema nadolazećih turnira",
    "tournaments.empty.upcomingEmptyDescription": "Kreiraj turnir i počni primati prijave parova.",
    "tournaments.empty.noneNearbyTitle": "Nema turnira u blizini",
    "tournaments.empty.noneNearbyDescription":
        "Nijedan nadolazeći turnir nije unutar {radius} km od tebe. Povećaj radijus ili prikaži sve udaljenosti.",
    "tournaments.empty.widenRadius": "Povećaj radijus",
    "tournaments.empty.disableNearMe": "Prikaži sve udaljenosti",
    "tournaments.empty.noResultsTitle": "Nema rezultata",
    "tournaments.empty.noResultsDescription": "Nijedan turnir ne odgovara odabranim filterima.",
    "tournaments.empty.clearFilters": "Očisti filtere",

    // Napomena ispod mreže kad je klizač „U krugu od“ užji od „Sve“: turniri
    // bez geokodiranih koordinata ne mogu se izmjeriti, pa se ne skrivaju
    // nijemo nego prebrajaju ovdje. (Filter se više ne zove „Blizu mene“ —
    // prekidač i tri čipa zamijenio je jedan klizač u panelu filtera.)
    "tournaments.missingLocation.one":
        "{n} turnir nema unesenu lokaciju pa nije prikazan u filtru udaljenosti.",
    "tournaments.missingLocation.two":
        "{n} turnira nema unesenu lokaciju pa nisu prikazani u filtru udaljenosti.",
    "tournaments.missingLocation.few":
        "{n} turnira nema unesenu lokaciju pa nisu prikazani u filtru udaljenosti.",
    "tournaments.missingLocation.other":
        "{n} turnira nema unesenu lokaciju pa nije prikazano u filtru udaljenosti.",

    "tournaments.finishedHeading": "Završeni turniri",
    "tournaments.empty.finishedErrorTitle": "Nije moguće učitati završene turnire",
    "tournaments.empty.finishedEmptyTitle": "Još nema završenih turnira",
    "tournaments.empty.finishedEmptyDescription": "Završeni turniri će se pojaviti ovdje.",
    "tournaments.loadMore": "Učitaj više ({count})",

    // "Završeni turniri" search group — a second, server-searched group that
    // appears under the upcoming results once the search box has 2+ chars,
    // for finished tournaments the client-side filter can't see (only the
    // first page of the finished list is ever loaded). Heading text is
    // deliberately the SAME as `finishedHeading` above (it's the same kind
    // of section, just search-scoped); `resultsCount` is the subtitle that
    // tells the two apart.
    "tournaments.searchFinished.resultsCount.one": "{n} rezultat",
    "tournaments.searchFinished.resultsCount.two": "{n} rezultata",
    "tournaments.searchFinished.resultsCount.few": "{n} rezultata",
    "tournaments.searchFinished.resultsCount.other": "{n} rezultata",
    "tournaments.searchFinished.showMore": "Prikaži još ({count})",

    // Fallback text for a raw JS Error with no message of its own. Kept
    // byte-identical to what the pre-extraction code hardcoded here — it
    // was already English in a Croatian app; flagged in the extraction
    // report rather than silently "fixed".
    "tournaments.loadErrorFallback": "Failed to load tournaments",
    "tournaments.loadFinishedErrorFallback": "Failed to load finished tournaments",

    // ═══════════════════════ CalendarPage ═══════════════════════
    "calendar.prevMonth": "Prethodni mjesec",
    "calendar.nextMonth": "Sljedeći mjesec",
    "calendar.today": "Danas",
    "calendar.moreCount": "+{n} još",

    "calendar.title": "Kalendar turnira",

    // --- Document head / SEO -------------------------------------------------
    "calendar.seo.title": "Kalendar Bela turnira — bela-turniri.com",
    "calendar.seo.description":
        "Kalendar svih nadolazećih Bela turnira u Hrvatskoj i regiji. Pretplati se i turniri stižu izravno u tvoj kalendar.",
    "calendar.seo.ogTitle": "Kalendar Bela turnira",
    "calendar.seo.ogDescription": "Svi nadolazeći Bela turniri na jednom mjestu.",

    // --- Prikaz: popis (agenda) ↔ mjesečna mreža -----------------------------
    "calendar.view.label": "Prikaz kalendara",
    "calendar.view.agenda": "Popis",
    "calendar.view.month": "Mjesec",

    // Broj nadolazećih turnira ispod naslova stranice.
    "calendar.upcomingCount.one": "{n} nadolazeći turnir",
    "calendar.upcomingCount.two": "{n} nadolazeća turnira",
    "calendar.upcomingCount.few": "{n} nadolazeća turnira",
    "calendar.upcomingCount.other": "{n} nadolazećih turnira",

    // Broj turnira u jednom mjesecu — uz naslov mjeseca u popisu i uz
    // zaglavlje mjesečne mreže.
    "calendar.monthCount.one": "{n} turnir",
    "calendar.monthCount.two": "{n} turnira",
    "calendar.monthCount.few": "{n} turnira",
    "calendar.monthCount.other": "{n} turnira",

    // "Prikaži još N mjeseci" — popis se učitava po mjesecima, ne po redcima,
    // da mjesec nikad ne bude prepolovljen.
    "calendar.moreMonths.one": "Prikaži još {n} mjesec",
    "calendar.moreMonths.two": "Prikaži još {n} mjeseca",
    "calendar.moreMonths.few": "Prikaži još {n} mjeseca",
    "calendar.moreMonths.other": "Prikaži još {n} mjeseci",

    // --- Prazna stanja -------------------------------------------------------
    "calendar.emptyAgenda.title": "Nema najavljenih turnira",
    "calendar.emptyAgenda.description":
        "Čim netko objavi novi turnir, pojavit će se ovdje. Pretplati se na kalendar i stiže ti automatski.",
    "calendar.emptyAgenda.cta": "Pogledaj sve turnire",

    // --- Dan u mjesečnoj mreži ----------------------------------------------
    "calendar.day.selectAria": "Prikaži turnire za {date}",
    "calendar.day.none": "Nema turnira na ovaj dan.",

    // --- Prečac na kartu (ikona na retku turnira) ---------------------------
    // Vodi na /karta?turnir=… — vlastitu kartu aplikacije s odabranim
    // turnirom, ne vanjsku aplikaciju za karte. `openOnMap` je tooltip,
    // `openOnMapAria` pristupačno ime (ikona nema vlastiti tekst).
    "calendar.openOnMap": "Prikaži na karti",
    "calendar.openOnMapAria": "Prikaži turnir {name} na karti",

    // Oznaka uz udaljenost kad je turnir unutar radijusa „blizu“ (50 km) —
    // isti prag koji koristi filter „Blizu mene“ na popisu turnira.
    "calendar.nearMe.nearBadge": "blizu",

    // Fallback text for a raw JS Error with no message of its own. Kept
    // byte-identical to what the pre-extraction code hardcoded here — same
    // precedent as tournaments.loadErrorFallback above.
    "calendar.loadErrorFallback": "Failed to load tournaments",

    // Month heading labels ("Siječanj 2026") and Mon-first weekday column
    // headers. Leaf names use English 3-letter codes as stable identifiers —
    // only the values are locale text.
    "calendar.month.jan": "Siječanj",
    "calendar.month.feb": "Veljača",
    "calendar.month.mar": "Ožujak",
    "calendar.month.apr": "Travanj",
    "calendar.month.may": "Svibanj",
    "calendar.month.jun": "Lipanj",
    "calendar.month.jul": "Srpanj",
    "calendar.month.aug": "Kolovoz",
    "calendar.month.sep": "Rujan",
    "calendar.month.oct": "Listopad",
    "calendar.month.nov": "Studeni",
    "calendar.month.dec": "Prosinac",
    "calendar.weekday.mon": "PON",
    "calendar.weekday.tue": "UTO",
    "calendar.weekday.wed": "SRI",
    "calendar.weekday.thu": "ČET",
    "calendar.weekday.fri": "PET",
    "calendar.weekday.sat": "SUB",
    "calendar.weekday.sun": "NED",

    // ═══════════════════════ MapPage ═══════════════════════
    // Fallback text for a raw JS Error with no message of its own. Kept
    // byte-identical to what the pre-extraction code hardcoded here — it
    // was already English in a Croatian app, same precedent as
    // tournaments.loadErrorFallback above.
    "map.loadErrorFallback": "Failed to load tournaments",

    // --- Document head / SEO -------------------------------------------------
    // /karta was the one routed page that never called `useDocumentHead`, so it
    // kept whatever title the previous route had left in the tab.
    "map.seo.title": "Karta Bela turnira — bela-turniri.com",
    "map.seo.description":
        "Karta svih nadolazećih Bela turnira u Hrvatskoj i regiji. Pronađi turnire u svojoj blizini i pogledaj koliko su daleko.",
    "map.seo.ogTitle": "Karta Bela turnira",
    "map.seo.ogDescription": "Nadolazeći Bela turniri na karti — pronađi one u svojoj blizini.",

    "map.radiusLabel": "U krugu od:",
    "map.radiusAll": "Sve",
    "map.hiddenByRadius": "({n} izvan kruga)",
    "map.hideLocation": "Sakrij moju lokaciju",
    "map.showLocation": "Prikaži moju lokaciju",
    "map.locationDenied": "Pristup lokaciji je odbijen. Možeš ga uključiti kasnije u postavkama preglednika.",
    "map.locationUnsupported": "Tvoj preglednik ne podržava geolokaciju.",
    "map.bucket.thisWeek": "Ovaj tjedan",
    "map.bucket.nextWeek": "Do sljedeće nedjelje",
    "map.bucket.beyond": "Uskoro",
    "map.popup.yourLocation": "Tvoja lokacija",
    "map.popup.entryPriceLabel": "Kotizacija:",
    "map.popup.repassagePriceLabel": "Repasaž:",
    "map.popup.moreDetails": "Više detalja →",

    // --- Tournament list beside the map (desktop sidebar / mobile list below) --
    "map.list.count.one": "{n} turnir na karti",
    "map.list.count.two": "{n} turnira na karti",
    "map.list.count.few": "{n} turnira na karti",
    "map.list.count.other": "{n} turnira na karti",
    "map.list.clearSelection": "Poništi odabir",
    "map.list.emptyNoResults": "Nijedan turnir nije u ovom krugu. Pokušaj povećati radijus.",
    "map.list.emptyNone": "Nema turnira s unesenom lokacijom.",
    "map.list.openDetailsAria": "Detalji turnira {name}",

    // ═══════════════════════ FindPairPage ═══════════════════════
    "findPair.tournamentLabel": "Turnir",
    // The primary action's label, and also the submit button inside the
    // dialog it opens — deliberately the same words in both places.
    "findPair.form.toggleShow": "Objavi zahtjev",
    "findPair.form.titleEdit": "Uredi zahtjev",
    "findPair.form.titleCreate": "Tražim para",
    "findPair.form.noUpcomingTournaments": "Nema nadolazećih turnira",
    "findPair.form.tournamentLockedHelp":
        "Turnir nije moguće promijeniti — obriši zahtjev i kreiraj novi za drugi turnir.",
    "findPair.form.nameLabel": "Tvoje ime",
    "findPair.form.namePlaceholder": "npr. Marko",
    "findPair.form.phoneLabel": "Broj telefona",
    "findPair.form.optional": "(opcionalno)",
    "findPair.form.phonePlaceholder": "91 234 5678",
    "findPair.form.phoneCountryAria": "Pozivni broj države",
    "findPair.form.phoneVisibilityHelp": "Broj vide samo prijavljeni igrači.",
    "findPair.form.noteLabel": "Napomena (opcionalno)",
    "findPair.form.notePlaceholder": "Iskustvo, način igranja, prijevoz...",
    "findPair.form.selectTournamentError": "Odaberi turnir.",
    "findPair.form.nameRequiredError": "Ime je obavezno.",
    "findPair.form.saveEditError": "Neuspjelo spremanje izmjena.",
    "findPair.form.createError": "Neuspjelo objavljivanje zahtjeva.",

    "findPair.toast.matchErrorTitle": "Neuspjelo označavanje",
    "findPair.toast.deleteErrorTitle": "Neuspjelo brisanje",

    "findPair.confirmDelete.title": "Obrisati zahtjev?",
    "findPair.confirmDelete.description": "Zahtjev za parom bit će trajno uklonjen s ploče.",

    // Toolbar — the same vocabulary as the tournament listing's, on purpose.
    "findPair.filters.button": "Filteri",
    "findPair.filters.toggleShow": "Prikaži filtere",
    "findPair.filters.toggleHide": "Sakrij filtere",
    "findPair.filters.searchPlaceholder": "Pretraži po imenu, turniru, lokaciji…",
    "findPair.filters.searchClearAria": "Očisti pretragu",
    "findPair.filters.searchShortcutTitle": "Tipkovni prečac za pretragu",
    "findPair.filters.statusLabel": "Status",
    "findPair.filters.statusOpen": "Aktivni",
    "findPair.filters.statusMatched": "Spareni",
    "findPair.filters.statusAll": "Svi",
    "findPair.filters.allTournaments": "Svi turniri",
    "findPair.filters.onlyMine": "Samo moji",
    "findPair.filters.clearAll": "Očisti sve",
    "findPair.filters.clearAllTitleActive": "Očisti sve filtere",
    "findPair.filters.clearAllTitleInactive": "Nema aktivnih filtera",

    // Count chips over the board. `count` = the visible count when nothing is
    // filtered out; `countOfTotal` when a filter narrowed it below the total.
    "findPair.stats.count.one": "{n} zahtjev",
    "findPair.stats.count.two": "{n} zahtjeva",
    "findPair.stats.count.few": "{n} zahtjeva",
    "findPair.stats.count.other": "{n} zahtjeva",
    // The noun agrees with `total`, not with `n` ("1 od 12 zahtjeva"), so
    // every category carries the same genitive plural on purpose.
    "findPair.stats.countOfTotal.one": "{n} od {total} zahtjeva",
    "findPair.stats.countOfTotal.two": "{n} od {total} zahtjeva",
    "findPair.stats.countOfTotal.few": "{n} od {total} zahtjeva",
    "findPair.stats.countOfTotal.other": "{n} od {total} zahtjeva",
    "findPair.stats.activeTotal.one": "{n} aktivan ukupno",
    "findPair.stats.activeTotal.two": "{n} aktivna ukupno",
    "findPair.stats.activeTotal.few": "{n} aktivna ukupno",
    "findPair.stats.activeTotal.other": "{n} aktivnih ukupno",

    // Two different empty states: nobody has posted (the fix is to post) vs.
    // the reader's own filters emptied a board that is not empty (the fix is
    // to clear them). Same words must never serve both.
    "findPair.empty.noRequestsTitle": "Još nitko ne traži para",
    "findPair.empty.noRequestsDescription":
        "Budi prvi — objavi zahtjev i igrači koji traže para vidjet će ga ovdje.",
    "findPair.empty.noRequestsAnonDescription":
        "Još nema objavljenih zahtjeva. Prijavi se i objavi prvi.",
    "findPair.empty.noResultsTitle": "Nema rezultata",
    "findPair.empty.noResultsDescription": "Nijedan zahtjev ne odgovara odabranim filterima.",
    "findPair.empty.clearFilters": "Očisti filtere",

    "findPair.anonNotice":
        "Kontakti su skriveni neprijavljenim posjetiteljima. Prijavi se da vidiš brojeve koje su igrači ostavili.",

    "findPair.badge.searching": "Tražim",
    "findPair.badge.matched": "Spareni",
    "findPair.card.matchAction": "Spareno",
    "findPair.card.editAria": "Uredi zahtjev",
    "findPair.card.deleteAria": "Obriši zahtjev",
    "findPair.card.openMapAria": "Prikaži turnir na karti",
    "findPair.card.postedAt": "Objavljeno {date}",
    "findPair.card.noPhone": "Bez broja",
    // Worded about the RULE, not about this poster: from a signed-out session
    // the list DTO cannot say whether a redacted row had a number at all.
    "findPair.card.phoneHiddenTitle": "Kontakti su vidljivi samo prijavljenim igračima",

    "findPair.loadRequestsError": "Greška pri dohvaćanju zahtjeva.",

    // ═══════════════════════ ContactPage (/kontakt) ═══════════════════════
    "contact.seo.title": "Kontakt — bela-turniri.com",
    "contact.seo.description": "Pošaljite nam poruku — pitanja, prijedlozi ili prijava problema s Bela turnirima.",
    "contact.seo.ogTitle": "Kontaktiraj nas — bela-turniri.com",
    "contact.seo.ogDescription": "Pošaljite nam poruku — pitanja, prijedlozi ili prijava problema.",

    "contact.title": "Kontaktiraj nas",
    "contact.intro":
        "Imaš pitanje, prijedlog ili si naišao/la na problem? Pošalji nam poruku i javit ćemo se na tvoju e-poštu.",

    "contact.nameLabel": "Ime",
    "contact.namePlaceholder": "Tvoje ime",
    "contact.emailLabel": "E-pošta",
    "contact.emailPlaceholder": "ime@primjer.com",
    "contact.subjectLabel": "Naslov",
    "contact.subjectOptional": "(neobavezno)",
    "contact.subjectPlaceholder": "Ukratko o čemu se radi",
    "contact.messageLabel": "Poruka",
    "contact.messagePlaceholder": "Opiši svoje pitanje ili problem…",
    "contact.submit": "Pošalji poruku",
    "contact.sending": "Šaljem…",

    "contact.validation.nameRequired": "Unesi svoje ime.",
    "contact.validation.emailInvalid": "Unesi ispravnu e-poštu.",
    "contact.validation.messageRequired": "Unesi poruku.",

    "contact.error.rateLimited": "Previše poruka poslano u kratkom vremenu — pokušaj ponovno za nekoliko minuta.",
    "contact.error.generic": "Slanje poruke nije uspjelo. Pokušaj ponovno.",

    "contact.success.title": "Poruka je poslana",
    "contact.success.description": "Hvala na poruci — javit ćemo se čim prije na navedenu e-poštu.",
    "contact.success.backLink": "Natrag na turnire",

    // ═══════════════════════ SharedBlokPage (/blok/z/{token}) ═══════════════════════
    // Public, read-only view of a shared "Bela blok" session (BLOK-HISTORY.md
    // §5.2) — no sign-in, opened straight from a chat-app link on a phone.
    // Domain vocabulary (partija, podjela, zvanja, štiglja, adut) reuses the
    // stable keys already established in the `blok` namespace (`blok.entry.*`,
    // `blok.side.*`) — see `components/BlokGamesList.tsx` — so it is not
    // duplicated here; this block only carries copy specific to this page.
    "blokShare.seo.title": "Zapisnik partije bele — bela-turniri.com",
    "blokShare.seo.description":
        "Podijeljeni zapisnik odigrane bele — rezultat serije, sve partije i podjele.",
    "blokShare.seo.ogTitle": "Zapisnik partije bele",
    "blokShare.seo.ogDescription": "{us} {gamesUs} : {gamesThem} {them} — pogledaj cijeli zapisnik.",

    // Trivial separator between the two side names in the headline — kept as
    // its own key (rather than reusing another namespace's) so this page
    // doesn't depend on copy another agent's file may change independently.
    "blokShare.vs": "vs",

    // The one state a recipient is most likely to hit: a revoked or mistyped
    // link. Calm, not an error page — BLOK-HISTORY.md is explicit that this
    // must never read as a crash or an empty page.
    "blokShare.notFoundTitle": "Ova poveznica više ne radi",
    "blokShare.notFoundDescription":
        "Zapisnik ne postoji ili je vlasnik prekinuo dijeljenje. Zamoli ga za novu poveznicu.",
    "blokShare.notFoundCta": "Otvori Bela blok",

    // Separate from the 404 above on purpose: a network blip or a backend
    // 5xx is NOT "the owner revoked this link" — that would tell someone on
    // a bad connection to give up on a link that is perfectly alive. This
    // state offers a retry instead of the "open Bela blok" dead end.
    "blokShare.fetchFailedTitle": "Zapisnik trenutno nije dostupan",
    "blokShare.fetchFailedDescription":
        "Nešto je pošlo po zlu prilikom dohvaćanja zapisnika. Provjeri internetsku vezu i pokušaj ponovno.",
    "blokShare.retry": "Pokušaj ponovno",

    /* ═══════════════════════════════════════════════════════════════════
       REVIZIJA 2026-09-08 (druga) — „DO 1001 · PROLAZ”
       BLOK-HISTORY.md §5.5
       ═══════════════════════════════════════════════════════════════════
       Redak ispod rezultata više ne govori „Cilj”, nego „DO”, i uz cilj nosi
       PRAVILO KRAJA PARTIJE. Bez pravila spremljeni pobjednik nije
       provjerljiv: iste podjele daju drugog pobjednika po „dosta” i po
       „prolaz”, pa pravilo mora stajati na ekranu, ne samo u zapisu.

       Broj partija je iz tog retka NESTAO — partije su izlistane odmah
       ispod, pa ih je brojati tu bilo isto rečeno dvaput.

       Vlastiti `rule.*` ključevi drže oznaku dijeljenog prikaza neovisnom o
       natpisima na čipovima u dijalogu s postavkama.

       NADIĐENO ovom revizijom, zadržano da ne razbije ničiji rad u tijeku:
       `blokShare.target`, `blokShare.gameHeading` i `blokShare.gamesCount.*`
       više nemaju nijedno pozivno mjesto. */
    "blokShare.meta": "DO {target} · {rule}",
    "blokShare.rule.dosta": "DOSTA",
    "blokShare.rule.prolaz": "PROLAZ",
}

/** Contract every other locale's `pages` namespace must satisfy. */
export type PagesDict = typeof pages
