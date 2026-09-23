import type { PagesDict } from "../hr/pages"

/* English `pages`. Typed as the Croatian namespace, so a dropped or
   misspelled key fails `tsc` instead of silently falling back at runtime.
   Register: plain, friendly, informal ("you"), US spelling. See
   EN-CONTRACT.md for the full voice guide and glossary.

   Plural families follow the pattern in `i18n/index.ts`: every family below
   defines `.one` / `.two` / `.few` / `.other` even though English only ever
   selects `.one` (singular) or `.other` (plural) at runtime — `.two` and
   `.few` simply repeat the `.other` text. Where the Croatian source used a
   single hardcoded template regardless of count (never doing real Croatian
   pluralisation), the English text below is likewise identical across all
   four categories — that was a move, not a grammar fix, and the same is
   true here. */

export const pages: PagesDict = {
    // ═══════════════════════ TournamentsPage ═══════════════════════
    "tournaments.badge.finished": "Finished",
    "tournaments.badge.full": "Full",
    "tournaments.badge.upcoming": "Upcoming",
    "tournaments.noPoster": "No poster",
    // Intro to the winning pair's name on a finished tournament's card. It's
    // rendered in caps by the component (CSS), so it stays normal case here.
    "tournaments.winnersLabel": "Winner",

    // relativeDays: "Today" / "Tomorrow" never disagree with count (they're
    // not count-driven at all); `inDays` covers the 2-14 day window and, in
    // the pre-extraction code, always rendered "In N days" regardless of N.
    "tournaments.relativeDays.today": "Today",
    "tournaments.relativeDays.tomorrow": "Tomorrow",
    "tournaments.relativeDays.inDays.one": "In {n} day",
    "tournaments.relativeDays.inDays.two": "In {n} days",
    "tournaments.relativeDays.inDays.few": "In {n} days",
    "tournaments.relativeDays.inDays.other": "In {n} days",

    // --- Document head / SEO -------------------------------------------------
    // `useDocumentHead` currently pins the tab title to a static string and
    // ignores `title`, but the page still passes one, so it is translated.
    "tournaments.seo.title": "Bela tournaments in Croatia — bela-turniri.com",
    "tournaments.seo.description":
        "Browse all upcoming and finished Bela tournaments in Croatia and the region. Search by location, date and price.",
    "tournaments.seo.ogTitle": "Bela tournaments in Croatia",
    "tournaments.seo.ogDescription":
        "Browse all upcoming and finished Bela tournaments in Croatia and the region.",

    /* --- Distance filter -------------------------------------------------
       The listing's own control is now the "Within" slider inside the
       filter panel; `nearMe.label` stays because CalendarPage still labels
       its own toggle with it. */
    "tournaments.nearMe.label": "Nearby",
    "tournaments.nearMe.deniedTitle": "Location not available",
    "tournaments.nearMe.deniedDescription":
        "Allow location access in your browser for the distance filter to work.",
    "tournaments.nearMe.unsupported": "Your browser doesn't support geolocation.",
    "tournaments.nearMe.enable": "Enable",
    "tournaments.nearMe.denied": "Location access was denied in the browser.",

    // --- Search + filter toolbar -----------------------------------------------
    "tournaments.search.placeholder": "Search by tournament name, city or venue…",
    "tournaments.search.clearAria": "Clear search",
    "tournaments.filters.toggleShow": "Show filters",
    "tournaments.filters.toggleHide": "Hide filters",
    "tournaments.filters.button": "Filters",
    "tournaments.createCta": "Create tournament",
    "tournaments.filters.locationLabel": "Location",
    "tournaments.filters.locationPlaceholder": "e.g. Zagreb",
    "tournaments.filters.priceLabel": "Entry fee (€)",
    "tournaments.filters.repassageLabel": "Re-entry (€)",
    "tournaments.filters.priceFromPlaceholder": "from",
    "tournaments.filters.priceToPlaceholder": "to",
    // The slider that replaced the "Near me" toggle and its three radius
    // chips. At the far-right position ("All") the distance filter is off.
    "tournaments.filters.radiusLabel": "Within:",
    "tournaments.filters.radiusAll": "All",
    // "Target score" chips (501/701/1001, multi-select) and the
    // "Declarations" tri-state (any / allowed / no declarations) — 2026-09-22.
    "tournaments.filters.targetScoreLabel": "Target score",
    "tournaments.filters.declarationsLabel": "Declarations",
    "tournaments.filters.declarationsAll": "Any",
    "tournaments.filters.declarationsEnabled": "Allowed",
    "tournaments.filters.declarationsDisabled": "No declarations",
    "tournaments.filters.clearAll": "Clear all",
    "tournaments.filters.clearAllTitleActive": "Clear all filters",
    "tournaments.filters.clearAllTitleInactive": "No active filters",

    // --- Sorting ----------------------------------------------------------
    "tournaments.sort.label": "Sort:",
    "tournaments.sort.dateAsc": "Earliest first",
    "tournaments.sort.dateDesc": "Latest first",
    "tournaments.sort.priceAsc": "Cheapest first",
    "tournaments.sort.popular": "Most popular",
    "tournaments.sort.nameAsc": "Alphabetical",
    // Only available once a location is known — without it the item is disabled.
    "tournaments.sort.distanceAsc": "Nearest first",

    // --- View: card grid ↔ row list --------------------------------
    "tournaments.view.label": "Tournament view",
    "tournaments.view.grid": "Grid",
    "tournaments.view.list": "List",

    // --- Tournament card -----------------------------------------------------
    "tournaments.card.fillLabel": "Filled",
    "tournaments.card.entryFeeLabel": "entry fee",
    "tournaments.card.repassageLabel": "re-entry",
    "tournaments.card.freeEntry": "Free",
    "tournaments.card.noWinner": "No winner recorded",

    // --- Empty / error states ----------------------------------------------
    "tournaments.empty.upcomingErrorTitle": "Couldn't load tournaments",
    "tournaments.empty.upcomingEmptyTitle": "No upcoming tournaments",
    "tournaments.empty.upcomingEmptyDescription": "Create a tournament and start receiving pair registrations.",
    "tournaments.empty.noneNearbyTitle": "No nearby tournaments",
    "tournaments.empty.noneNearbyDescription":
        "No upcoming tournament is within {radius} km of you. Increase the radius or show all distances.",
    "tournaments.empty.widenRadius": "Increase radius",
    "tournaments.empty.disableNearMe": "Show all distances",
    "tournaments.empty.noResultsTitle": "No results",
    "tournaments.empty.noResultsDescription": "No tournament matches the selected filters.",
    "tournaments.empty.clearFilters": "Clear filters",

    // Note under the grid when the "Within" slider is narrower than "All":
    // tournaments without geocoded coordinates can't be measured, so they
    // aren't silently hidden but counted here instead. (The filter is no
    // longer called "Near me" — a single slider in the filter panel replaced
    // the toggle and its three chips.)
    "tournaments.missingLocation.one":
        "{n} tournament has no location set, so it isn't shown in the distance filter.",
    "tournaments.missingLocation.two":
        "{n} tournaments have no location set, so they aren't shown in the distance filter.",
    "tournaments.missingLocation.few":
        "{n} tournaments have no location set, so they aren't shown in the distance filter.",
    "tournaments.missingLocation.other":
        "{n} tournaments have no location set, so they aren't shown in the distance filter.",

    "tournaments.finishedHeading": "Finished tournaments",
    "tournaments.empty.finishedErrorTitle": "Couldn't load finished tournaments",
    "tournaments.empty.finishedEmptyTitle": "No finished tournaments yet",
    "tournaments.empty.finishedEmptyDescription": "Finished tournaments will appear here.",
    "tournaments.loadMore": "Load more ({count})",

    // "Finished tournaments" search group — a second, server-searched group
    // that appears under the upcoming results once the search box has 2+
    // chars, for finished tournaments the client-side filter can't see (only
    // the first page of the finished list is ever loaded). Heading text is
    // deliberately the SAME as `finishedHeading` above (it's the same kind
    // of section, just search-scoped); `resultsCount` is the subtitle that
    // tells the two apart.
    "tournaments.searchFinished.resultsCount.one": "{n} result",
    "tournaments.searchFinished.resultsCount.two": "{n} results",
    "tournaments.searchFinished.resultsCount.few": "{n} results",
    "tournaments.searchFinished.resultsCount.other": "{n} results",
    "tournaments.searchFinished.showMore": "Show more ({count})",

    // Fallback text for a raw JS Error with no message of its own. In hr
    // this was kept byte-identical to what the pre-extraction code hardcoded
    // there — it was already English in a Croatian app. Here it's simply
    // correct as-is.
    "tournaments.loadErrorFallback": "Failed to load tournaments",
    "tournaments.loadFinishedErrorFallback": "Failed to load finished tournaments",

    // ═══════════════════════ CalendarPage ═══════════════════════
    "calendar.prevMonth": "Previous month",
    "calendar.nextMonth": "Next month",
    "calendar.today": "Today",
    "calendar.moreCount": "+{n} more",

    "calendar.title": "Tournament calendar",

    // --- Document head / SEO -------------------------------------------------
    "calendar.seo.title": "Bela tournament calendar — bela-turniri.com",
    "calendar.seo.description":
        "Calendar of all upcoming Bela tournaments in Croatia and the region. Subscribe and tournaments land straight in your calendar.",
    "calendar.seo.ogTitle": "Bela tournament calendar",
    "calendar.seo.ogDescription": "All upcoming Bela tournaments in one place.",

    // --- View: agenda list ↔ month grid -----------------------------
    "calendar.view.label": "Calendar view",
    "calendar.view.agenda": "List",
    "calendar.view.month": "Month",

    // Number of upcoming tournaments under the page title.
    "calendar.upcomingCount.one": "{n} upcoming tournament",
    "calendar.upcomingCount.two": "{n} upcoming tournaments",
    "calendar.upcomingCount.few": "{n} upcoming tournaments",
    "calendar.upcomingCount.other": "{n} upcoming tournaments",

    // Number of tournaments in one month — next to the month heading in the
    // list and next to the month grid's header.
    "calendar.monthCount.one": "{n} tournament",
    "calendar.monthCount.two": "{n} tournaments",
    "calendar.monthCount.few": "{n} tournaments",
    "calendar.monthCount.other": "{n} tournaments",

    // "Show N more months" — the list loads month by month, not row by row,
    // so a month is never cut in half.
    "calendar.moreMonths.one": "Show {n} more month",
    "calendar.moreMonths.two": "Show {n} more months",
    "calendar.moreMonths.few": "Show {n} more months",
    "calendar.moreMonths.other": "Show {n} more months",

    // --- Empty states -------------------------------------------------------
    "calendar.emptyAgenda.title": "No tournaments announced",
    "calendar.emptyAgenda.description":
        "As soon as someone publishes a new tournament, it'll show up here. Subscribe to the calendar and it arrives automatically.",
    "calendar.emptyAgenda.cta": "View all tournaments",
    "calendar.emptyMonth.title": "No tournaments this month",
    "calendar.emptyMonth.description": "Choose another month or go back to today.",

    // --- Day in the month grid ----------------------------------------------
    "calendar.day.selectAria": "Show tournaments for {date}",
    "calendar.day.none": "No tournaments on this day.",

    // --- Map shortcut (icon on the tournament row) ---------------------------
    // Leads to /karta?turnir=… — the app's own map with that tournament
    // selected, not an external map app. `openOnMap` is the tooltip,
    // `openOnMapAria` the accessible name (the icon has no text of its own).
    "calendar.openOnMap": "Show on map",
    "calendar.openOnMapAria": "Show tournament {name} on the map",

    // Badge next to the distance when a tournament is within the "near"
    // radius (50 km) — the same threshold the "Near me" filter on the
    // tournament list uses.
    "calendar.nearMe.nearBadge": "nearby",

    // Fallback text for a raw JS Error with no message of its own. Same
    // precedent as tournaments.loadErrorFallback above.
    "calendar.loadErrorFallback": "Failed to load tournaments",

    // Month heading labels ("January 2026") and Mon-first weekday column
    // headers. Leaf names use English 3-letter codes as stable identifiers —
    // only the values are locale text.
    "calendar.month.jan": "January",
    "calendar.month.feb": "February",
    "calendar.month.mar": "March",
    "calendar.month.apr": "April",
    "calendar.month.may": "May",
    "calendar.month.jun": "June",
    "calendar.month.jul": "July",
    "calendar.month.aug": "August",
    "calendar.month.sep": "September",
    "calendar.month.oct": "October",
    "calendar.month.nov": "November",
    "calendar.month.dec": "December",
    "calendar.weekday.mon": "MON",
    "calendar.weekday.tue": "TUE",
    "calendar.weekday.wed": "WED",
    "calendar.weekday.thu": "THU",
    "calendar.weekday.fri": "FRI",
    "calendar.weekday.sat": "SAT",
    "calendar.weekday.sun": "SUN",

    // ═══════════════════════ MapPage ═══════════════════════
    // Fallback text for a raw JS Error with no message of its own. Same
    // precedent as tournaments.loadErrorFallback above.
    "map.loadErrorFallback": "Failed to load tournaments",

    // --- Document head / SEO -------------------------------------------------
    // /karta was the one routed page that never called `useDocumentHead`, so it
    // kept whatever title the previous route had left in the tab.
    "map.seo.title": "Bela tournament map — bela-turniri.com",
    "map.seo.description":
        "Map of all upcoming Bela tournaments in Croatia and the region. Find tournaments near you and see how far away they are.",
    "map.seo.ogTitle": "Bela tournament map",
    "map.seo.ogDescription": "Upcoming Bela tournaments on the map — find the ones near you.",

    "map.radiusLabel": "Within:",
    "map.radiusAll": "All",
    "map.hiddenByRadius": "({n} outside the radius)",
    "map.hideLocation": "Hide my location",
    "map.showLocation": "Show my location",
    "map.locationDenied": "Location access was denied. You can turn it on later in your browser settings.",
    "map.locationUnsupported": "Your browser doesn't support geolocation.",
    "map.bucket.thisWeek": "This week",
    "map.bucket.nextWeek": "By next Sunday",
    "map.bucket.beyond": "Coming up",
    "map.popup.yourLocation": "Your location",
    "map.popup.entryPriceLabel": "Entry fee:",
    "map.popup.repassagePriceLabel": "Re-entry:",
    "map.popup.moreDetails": "More details →",

    // --- Tournament list beside the map (desktop sidebar / mobile list below) --
    "map.list.count.one": "{n} tournament on the map",
    "map.list.count.two": "{n} tournaments on the map",
    "map.list.count.few": "{n} tournaments on the map",
    "map.list.count.other": "{n} tournaments on the map",
    "map.list.clearSelection": "Clear selection",
    "map.list.emptyNoResults": "No tournament is within this radius. Try increasing it.",
    "map.list.emptyNone": "No tournaments have a location set.",
    "map.list.openDetailsAria": "Details for tournament {name}",

    // ═══════════════════════ FindPairPage ═══════════════════════
    "findPair.tournamentLabel": "Tournament",
    // The primary action's label, and also the submit button inside the
    // dialog it opens — deliberately the same words in both places.
    "findPair.form.toggleShow": "Post a request",
    "findPair.form.titleEdit": "Edit request",
    "findPair.form.titleCreate": "Looking for a partner",
    "findPair.form.noUpcomingTournaments": "No upcoming tournaments",
    "findPair.form.tournamentLockedHelp":
        "The tournament can't be changed — delete the request and create a new one for a different tournament.",
    "findPair.form.nameLabel": "Your name",
    "findPair.form.namePlaceholder": "e.g. Marko",
    "findPair.form.phoneLabel": "Phone number",
    "findPair.form.optional": "(optional)",
    "findPair.form.phonePlaceholder": "91 234 5678",
    "findPair.form.phoneCountryAria": "Country calling code",
    "findPair.form.phoneVisibilityHelp": "The number is visible only to signed-in players.",
    "findPair.form.noteLabel": "Note (optional)",
    "findPair.form.notePlaceholder": "Experience, playing style, transport...",
    "findPair.form.selectTournamentError": "Select a tournament.",
    "findPair.form.nameRequiredError": "Name is required.",
    "findPair.form.saveEditError": "Failed to save changes.",
    "findPair.form.createError": "Failed to post the request.",

    "findPair.toast.matchErrorTitle": "Failed to mark",
    "findPair.toast.deleteErrorTitle": "Failed to delete",

    "findPair.confirmDelete.title": "Delete the request?",
    "findPair.confirmDelete.description": "The partner request will be permanently removed from the board.",

    // Toolbar — the same vocabulary as the tournament listing's, on purpose.
    "findPair.filters.button": "Filters",
    "findPair.filters.toggleShow": "Show filters",
    "findPair.filters.toggleHide": "Hide filters",
    "findPair.filters.searchPlaceholder": "Search by name, tournament, location…",
    "findPair.filters.searchClearAria": "Clear search",
    "findPair.filters.searchShortcutTitle": "Keyboard shortcut for search",
    "findPair.filters.statusLabel": "Status",
    "findPair.filters.statusOpen": "Active",
    "findPair.filters.statusMatched": "Matched",
    "findPair.filters.statusAll": "All",
    "findPair.filters.allTournaments": "All tournaments",
    "findPair.filters.onlyMine": "Only mine",
    "findPair.filters.clearAll": "Clear all",
    "findPair.filters.clearAllTitleActive": "Clear all filters",
    "findPair.filters.clearAllTitleInactive": "No active filters",

    // Count chips over the board. `count` = the visible count when nothing is
    // filtered out; `countOfTotal` when a filter narrowed it below the total.
    "findPair.stats.count.one": "{n} request",
    "findPair.stats.count.two": "{n} requests",
    "findPair.stats.count.few": "{n} requests",
    "findPair.stats.count.other": "{n} requests",
    // The text agrees with `total`, not with `n` ("1 of 12 requests"), so
    // every category carries the same phrase on purpose.
    "findPair.stats.countOfTotal.one": "{n} of {total} requests",
    "findPair.stats.countOfTotal.two": "{n} of {total} requests",
    "findPair.stats.countOfTotal.few": "{n} of {total} requests",
    "findPair.stats.countOfTotal.other": "{n} of {total} requests",
    "findPair.stats.activeTotal.one": "{n} active total",
    "findPair.stats.activeTotal.two": "{n} active total",
    "findPair.stats.activeTotal.few": "{n} active total",
    "findPair.stats.activeTotal.other": "{n} active total",

    // Two different empty states: nobody has posted (the fix is to post) vs.
    // the reader's own filters emptied a board that is not empty (the fix is
    // to clear them). Same words must never serve both.
    "findPair.empty.noRequestsTitle": "No one's looking for a partner yet",
    "findPair.empty.noRequestsDescription":
        "Be the first — post a request and players looking for a partner will see it here.",
    "findPair.empty.noRequestsAnonDescription":
        "No requests posted yet. Sign in and post the first one.",
    "findPair.empty.noResultsTitle": "No results",
    "findPair.empty.noResultsDescription": "No request matches the selected filters.",
    "findPair.empty.clearFilters": "Clear filters",

    "findPair.anonNotice":
        "Contact details are hidden from signed-out visitors. Sign in to see the numbers players left.",

    "findPair.badge.searching": "Looking",
    "findPair.badge.matched": "Matched",
    "findPair.card.matchAction": "Matched",
    "findPair.card.editAria": "Edit request",
    "findPair.card.deleteAria": "Delete request",
    "findPair.card.openMapAria": "Show tournament on the map",
    "findPair.card.postedAt": "Posted {date}",
    "findPair.card.noPhone": "No number",
    // Worded about the RULE, not about this poster: from a signed-out session
    // the list DTO cannot say whether a redacted row had a number at all.
    "findPair.card.phoneHiddenTitle": "Contact details are visible only to signed-in players",

    "findPair.loadRequestsError": "Error fetching requests.",

    // ═══════════════════════ ContactPage (/kontakt) ═══════════════════════
    "contact.seo.title": "Contact — bela-turniri.com",
    "contact.seo.description": "Send us a message — questions, suggestions or an issue with Bela tournaments.",
    "contact.seo.ogTitle": "Contact us — bela-turniri.com",
    "contact.seo.ogDescription": "Send us a message — questions, suggestions or an issue to report.",

    "contact.title": "Contact us",
    "contact.intro":
        "Have a question, a suggestion, or run into a problem? Send us a message and we'll get back to you by email.",

    "contact.nameLabel": "Name",
    "contact.namePlaceholder": "Your name",
    "contact.emailLabel": "Email",
    "contact.emailPlaceholder": "name@example.com",
    "contact.subjectLabel": "Subject",
    "contact.subjectOptional": "(optional)",
    "contact.subjectPlaceholder": "A short summary",
    "contact.messageLabel": "Message",
    "contact.messagePlaceholder": "Describe your question or problem…",
    "contact.submit": "Send message",
    "contact.sending": "Sending…",

    "contact.validation.nameRequired": "Enter your name.",
    "contact.validation.emailInvalid": "Enter a valid email address.",
    "contact.validation.messageRequired": "Enter a message.",

    "contact.error.rateLimited": "Too many messages sent in a short time — try again in a few minutes.",
    "contact.error.generic": "Failed to send the message. Try again.",

    "contact.success.title": "Message sent",
    "contact.success.description": "Thanks for your message — we'll get back to you at the email you provided as soon as we can.",
    "contact.success.backLink": "Back to tournaments",
    // bela.games has no tournaments — used instead of `backLink` there.
    "contact.success.backLinkHome": "Back to home",

    // ═══════════════════════ SharedBlokPage (/blok/z/{token}) ═══════════════════════
    // Public, read-only view of a shared "Bela score pad" session
    // (BLOK-HISTORY.md §5.2) — no sign-in, opened straight from a chat-app
    // link on a phone. Domain vocabulary (game, deal, declarations, capot,
    // trump) reuses the stable keys already established in the `blok`
    // namespace (`blok.entry.*`, `blok.side.*`) — see
    // `components/BlokGamesList.tsx` — so it is not duplicated here; this
    // block only carries copy specific to this page.
    "blokShare.seo.title": "Bela game log — bela-turniri.com",
    "blokShare.seo.description":
        "A shared log of a played Bela session — the series score, every game and every deal.",
    "blokShare.seo.ogTitle": "Bela game log",
    "blokShare.seo.ogDescription": "{us} {gamesUs} : {gamesThem} {them} — see the full log.",

    // Trivial separator between the two side names in the headline — kept as
    // its own key (rather than reusing another namespace's) so this page
    // doesn't depend on copy another agent's file may change independently.
    "blokShare.vs": "vs",

    // The one state a recipient is most likely to hit: a revoked or mistyped
    // link. Calm, not an error page — BLOK-HISTORY.md is explicit that this
    // must never read as a crash or an empty page.
    "blokShare.notFoundTitle": "This link no longer works",
    "blokShare.notFoundDescription":
        "The log doesn't exist, or the owner stopped sharing it. Ask them for a new link.",
    "blokShare.notFoundCta": "Open Bela score pad",

    // Separate from the 404 above on purpose: a network blip or a backend
    // 5xx is NOT "the owner revoked this link" — that would tell someone on
    // a bad connection to give up on a link that is perfectly alive. This
    // state offers a retry instead of the "open Bela score pad" dead end.
    "blokShare.fetchFailedTitle": "The log isn't available right now",
    "blokShare.fetchFailedDescription":
        "Something went wrong while fetching the log. Check your internet connection and try again.",
    "blokShare.retry": "Try again",

    /* ═══════════════════════════════════════════════════════════════════
       REVISION 2026-09-08 (second) — "TO 1001 · PLAY OUT"
       BLOK-HISTORY.md §5.5
       ═══════════════════════════════════════════════════════════════════
       The line under the score no longer says "Target", it says "TO", and
       next to the target it carries the GAME-END RULE. Without the rule the
       stored winner isn't verifiable: the same deals give a different
       winner under "stop at target" than under "play it out", so the rule
       has to be on screen, not only in the record.

       The game COUNT has been REMOVED from that line — the games are
       listed right below it, so counting them there said the same thing
       twice.

       Dedicated `rule.*` keys keep the shared view's label independent from
       the chip labels in the settings dialog.

       SUPERSEDED by this revision, kept so it doesn't break anyone's work in
       progress: `blokShare.target`, `blokShare.gameHeading` and
       `blokShare.gamesCount.*` have no call sites left. */
    "blokShare.meta": "TO {target} · {rule}",
    "blokShare.rule.dosta": "CUTOFF",
    "blokShare.rule.prolaz": "PLAY OUT",
}
