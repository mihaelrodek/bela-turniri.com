import type { TournamentDict } from "../hr/tournament"

/* English `tournament`. Typed as the Croatian namespace, so a dropped or
   misspelled key fails `tsc` instead of silently falling back at runtime.
   Register: plain, friendly, informal ("you"), US spelling. See
   EN-CONTRACT.md for the full voice guide and glossary.

   Two conventions worth knowing before editing:

   1. Plural families follow `i18n/index.ts`: every family defines
      `.one` / `.two` / `.few` / `.other` even though English only ever
      selects `.one` (singular) or `.other` (plural) at runtime — `.two`
      and `.few` simply repeat the `.other` text so the shared shape stays
      intact across all three locales. Where the Croatian source used ONE
      hardcoded string regardless of count (`parova / 12`, `platilo
      kotizaciju`, `aktivnih`), the English text is likewise identical
      across all four categories — that was a move, not a grammar fix, and
      the same is true here.

   2. Sentences that wrap a bold run of text are split into
      `.before` / `.bold` / `.after` leaves rather than smuggling markup into
      a value. Concatenation of DATA, by contrast, is always one key with
      `{placeholders}`. */

export const tournament: TournamentDict = {
    // ═══════════════════════ Page chrome ═══════════════════════
    backToList: "Back to list",
    notFound: "Tournament not found.",
    loadFailed: "The tournament couldn't be loaded.",
    loadingAria: "Loading tournament",
    ok: "OK",
    no: "No",
    expand: "Expand",
    collapse: "Collapse",
    expandAll: "Expand all",
    collapseAll: "Collapse all",
    fullscreen: "Fullscreen",
    winnersHeading: "Winners",

    // --- Status pill --------------------------------------------------------
    "status.draft": "Upcoming",
    "status.started": "In progress",
    "status.finished": "Finished",

    // --- Tabs ---------------------------------------------------------------
    "tab.details": "Details",
    "tab.pairs": "Pairs",
    "tab.bracket": "Draw",
    "tab.cjenik": "Price list",

    "nav.sectionsAria": "Tournament sections",

    "results.heading": "Results",

    // --- Toolbar actions ----------------------------------------------------
    "actions.edit": "Edit",
    "actions.more": "More actions",
    "share.button": "Share",
    "share.copied": "Copied!",
    "share.copyPrompt": "Copy link:",
    addToCalendar: "Add to calendar",

    // --- Document head / SEO -------------------------------------------------
    "seo.title": "{name} — bela-turniri.com",
    "seo.titleWithLocation": "{name}, {location} — bela-turniri.com",
    "seo.titleFallback": "Tournament — bela-turniri.com",
    "seo.desc": "Bela tournament {name}",
    "seo.descWithLocation": "Bela tournament {name} in {location}",
    "seo.descWithDate": "Bela tournament {name} — {date}",
    "seo.descWithLocationAndDate": "Bela tournament {name} in {location} — {date}",

    // ═══════════════════════ Details tab — read mode ═══════════════════════
    "tile.createdBy": "Created by",
    "tile.date": "Date",
    "tile.startTime": "Start time",
    "tile.maxPairs": "Max pairs",
    "tile.unlimited": "Unlimited",
    "tile.location": "Location",
    "tile.details": "Details",
    "tile.entryPrice": "Entry fee",
    "tile.repassage": "Re-entry",
    "tile.repassageSecond": "Second re-entry",
    "tile.repassageUntil": "Re-entry until",
    "tile.gameRules": "Game rules",
    "tile.targetScore": "Target score",
    "tile.gameEndRule": "End rule",
    "tile.dealDirection": "Deal direction",
    "tile.declarations": "Declarations",
    "tile.allowBela": "Bela",
    "tile.rewards": "Prizes",
    "tile.additionalOptions": "Additional options",

    "tile.pairs": "Pairs",
    "tile.contact": "Contact",
    "tile.notSpecified": "Not specified",

    "qr.cardTitle": "QR code",
    "qr.cardHint": "Scanning it opens this tournament's pair list. Download the code and put it up at the venue.",

    openInGoogleMaps: "Open in Google Maps",
    openInMaps: "Open in Maps",

    "repassageUntil.FINALS": "Finals",
    "repassageUntil.SEMIFINALS": "Semifinals",
    "repassageUntil.FIRST_ROUND": "First round",

    "place.first": "1st place",
    "place.second": "2nd place",
    "place.third": "3rd place",

    "reward.fixed": "Fixed",
    "reward.percentage": "Percentage of the pool",

    "rule.end.prolaz": "Play out",
    "rule.end.dosta": "Cutoff",
    "rule.direction.right": "Right",
    "rule.direction.left": "Left",
    "rule.declarations.enabled": "Allowed",
    "rule.declarations.disabled": "No declarations",
    "rule.yes": "Yes",
    "rule.no": "No",

    // ═══════════════════════ Details tab — edit mode ═══════════════════════
    "edit.sectionBasic": "Basics",
    "edit.sectionFees": "Entry fee and re-entry",
    "edit.gameRules": "Game rules",
    "edit.targetScore": "Target score",
    "edit.gameEndRule": "End rule",
    "edit.dealDirection": "Deal direction",
    "edit.declarations": "Declarations",
    "edit.allowBela": "Bela is allowed",
    "edit.sectionContact": "Organizer contact",
    "edit.name": "Tournament name",
    "edit.dateTime": "Date and time",
    "edit.timeCaption": "Time",
    "edit.dateTimePlaceholder": "DD/MM/YYYY HH:MM",
    "edit.maxPairsHelp": "Leave empty for an unlimited number of pairs.",
    "edit.locationPlaceholder": "e.g. Caffe bar Belot, Zagreb",
    "edit.poster": "Poster",
    "edit.optional": "(optional)",
    "edit.optionalShort": "(opt.)",
    "edit.removePoster": "Remove poster",
    "edit.changeImage": "Change image",
    "edit.replacePoster": "Replace poster",
    "edit.chooseImage": "Choose image",
    "edit.posterWillBeRemoved": "The poster will be removed when you save.",
    "edit.posterHint": "PNG, JPG or WEBP, up to {mb} MB.",
    /* The "12.00€/pair • 6.00€/player" helper under each price input. The
       amounts and the € / • punctuation stay in the JSX; only the two unit
       suffixes are copy. */
    "edit.perPair": "/pair",
    "edit.perPlayer": "/player",
    "edit.repassageUntilLabel": "Re-entry possible until",
    "edit.repassageUntilHelp": "The last round before which an extra life can be bought.",
    "edit.rewardFixed": "Fixed (€)",
    "edit.rewardPercentage": "Percentage of the pool (%)",
    "edit.contactName": "Name",
    "edit.contactNamePlaceholder": "Organizer's name",
    "edit.contactPhone": "Phone number",
    /* Same example local number as Croatian, deliberately not swapped — the
       country prefix beside it is picked from PHONE_COUNTRIES, so a
       locale-swapped example would only ever agree with one of them. */
    "edit.contactPhonePlaceholder": "91 234 5678",
    "edit.saveChanges": "Save changes",
    "edit.readyToSave": "Ready to save.",
    "edit.pastInline": "Date and time can't be in the past.",
    "edit.missingInline": "Missing: {fields}",

    /* Required-field names, joined into the two messages above. */
    "edit.required.name": "Name",
    "edit.required.location": "Location",
    "edit.required.date": "Date",
    "edit.required.time": "Time",
    "edit.required.rewards": "Prizes",

    "edit.missingTitle": "Missing required fields",
    "edit.missingDescription": "Missing: {fields}.",
    "edit.pastTitle": "Invalid date/time",
    "edit.pastDescription": "The tournament's date and time can't be in the past.",

    "poster.allowedTypes": "Allowed: JPG, PNG or WEBP.",
    "poster.maxSize": "Maximum size is {mb} MB.",

    // ═══════════════════════ Pairs tab ═══════════════════════
    "pairs.nameLabel": "Pair name",
    "pairs.matchHistory": "Match history",
    "pairs.submittedBy": "Registered by:",
    "pairs.contactPhone": "Contact:",
    "pairs.pendingApproval": "Awaiting approval",
    "pairs.winLoss": "{wins}W – {losses}L",
    "pairs.hasLife": "Has a life",
    "pairs.noLife": "No life left",
    "pairs.eliminated": "Eliminated",
    "pairs.paid": "Paid",
    "pairs.unpaid": "Not paid",
    "pairs.approve": "Approve",
    "pairs.pay": "Pay",
    "pairs.markUnpaid": "Mark unpaid",
    "pairs.markPaidTitle": "Mark as paid",
    "pairs.markUnpaidTitle": "Mark as unpaid",
    "pairs.removePair": "Remove pair",
    "pairs.addPair": "Add pair",
    "pairs.addPairTitle": "Add a new pair",
    "pairs.atCapacityTitle": "Maximum number of pairs ({max})",
    "pairs.registerPair": "Register a pair for the tournament",
    "pairs.registerAnother": "Register another pair",
    "pairs.overCapacity": "+{n} over capacity",
    "pairs.eliminatedHeading": "Eliminated",
    "pairs.pendingHeading": "Awaiting approval",
    "pairs.emptyTitle": "No pairs yet",
    "pairs.emptyDescription": "Add the first pair with \"Add pair\" above.",
    "pairs.emptyDescriptionReadonly": "The organizer hasn't registered any pairs yet.",
    "pairs.finishedEmptyTitle": "Tournament wasn't played",
    "pairs.finishedEmptyDescription": "The tournament finished without any matches played.",
    /* Master/detail: the list column, and the panel beside it. */
    "pairs.noName": "No name",
    "pairs.backToList": "Back to pair list",
    "pairs.detailEmptyTitle": "Select a pair",
    "pairs.detailEmptyDescription": "Click a pair in the list to see its status and all its actions.",

    /* The extra-life ("Život") button: one label, four tooltips. */
    "pairs.life.label": "Life",
    "pairs.life.buy": "Buy a life",
    "pairs.life.alreadyBought": "Already bought",
    "pairs.life.saveFirst": "Save first",
    "pairs.life.unavailable": "Not available",

    /* Counters in the Pairs header card. The number itself is rendered in a
       separate element; these are the units that follow it, so they go
       through `usePlural` with that same count — every category is the
       same text here, exactly like the pre-extraction code that rendered
       one hardcoded string regardless of count. */
    "pairs.capacityOf.one": "pairs / {max}",
    "pairs.capacityOf.two": "pairs / {max}",
    "pairs.capacityOf.few": "pairs / {max}",
    "pairs.capacityOf.other": "pairs / {max}",
    "pairs.capacityUnlimited.one": "pairs / ∞",
    "pairs.capacityUnlimited.two": "pairs / ∞",
    "pairs.capacityUnlimited.few": "pairs / ∞",
    "pairs.capacityUnlimited.other": "pairs / ∞",
    "pairs.paidEntry.one": "paid the entry fee",
    "pairs.paidEntry.two": "paid the entry fee",
    "pairs.paidEntry.few": "paid the entry fee",
    "pairs.paidEntry.other": "paid the entry fee",
    "pairs.activeCount.one": "active",
    "pairs.activeCount.two": "active",
    "pairs.activeCount.few": "active",
    "pairs.activeCount.other": "active",

    /* Count next to a group heading in the pair list ("ELIMINATED · 4
       pairs"). Unlike the header-card counters above, the number is INSIDE
       the string here, so `{n}` carries it — a real singular/plural family. */
    "pairs.groupCount.one": "{n} pair",
    "pairs.groupCount.two": "{n} pairs",
    "pairs.groupCount.few": "{n} pairs",
    "pairs.groupCount.other": "{n} pairs",

    /* Failures raised by the bulk pair editor. */
    "pairs.notSavedTitle": "Pairs weren't saved",
    "pairs.nameEmpty": "Pair name can't be empty.",
    "pairs.nameBeforePay": "Enter the pair's name before marking it paid.",

    // --- Open pair-finding requests -----------------------------------------
    "pairRequests.title": "Partner requests",

    // --- Self-registration dialog -------------------------------------------
    "selfReg.savedPairs": "Your saved pairs",
    "selfReg.namePlaceholder": "e.g. Marko & Pero",
    "selfReg.submit": "Register",
    "selfReg.pendingNote.before": "The pair will be marked",
    "selfReg.pendingNote.bold": "yellow",
    "selfReg.pendingNote.after": "until the organizer confirms it.",
    "selfReg.nameRequired": "Enter the pair's name.",
    "selfReg.alreadyStarted": "The tournament has already started.",
    "selfReg.alreadyRegistered": "You've already registered a pair with that name.",
    "selfReg.error": "Error while registering.",
    "selfReg.rateLimited": "Too many registrations from this device. Try again in an hour.",

    // Registration without an account — nudge, phone number and claim link.
    "selfReg.nudge.title": "Sign in or continue without an account",
    "selfReg.nudge.intro": "You can register a pair without an account, but it's easier with one:",
    "selfReg.nudge.benefitList": "See all your registrations in one place.",
    "selfReg.nudge.benefitEdit": "Edit or withdraw your registration.",
    "selfReg.nudge.benefitNotify": "Get notified when the organizer confirms you.",
    "selfReg.nudge.signIn": "Sign in",
    "selfReg.nudge.continueAnonymously": "Continue without signing in",
    "selfReg.phoneLabel": "Phone number",
    "selfReg.phoneCountryLabel": "Country code",
    "selfReg.phonePlaceholder": "91 234 5678",
    "selfReg.phoneHint": "The organizer will contact you on this number.",
    "selfReg.phoneRequired": "Enter your phone number.",
    "selfReg.claim.title": "Registration sent",
    "selfReg.claim.pending": "The pair “{name}” is waiting for the organizer's approval.",
    "selfReg.claim.saveLink": "Save this link — you can use it later to claim the registration into your account.",
    "selfReg.claim.copy": "Copy link",
    "selfReg.claim.copied": "Copied!",

    // ═══════════════════════ Draw tab ═══════════════════════
    /* Short on purpose. It is a PILL that sits in the 76px table column of a
       match row — the same column that carries "Table 7" on every other row —
       so it has to read at a glance and fit next to the table numbers above
       it. The long form ("Bye — no opponent") did neither. */
    "bracket.bye": "Bye",
    "bracket.notStartedTitle": "Tournament hasn't started yet",
    "bracket.notStartedOwner": "Click \"Start tournament\" above once all pairs are ready.",
    "bracket.notStartedViewer": "The organizer hasn't started the tournament yet. Check back later.",
    "bracket.finishedWithoutPlayTitle": "Tournament wasn't played",
    "bracket.finishedWithoutPlayDescription": "The tournament finished without any matches played.",
    "bracket.noRoundsTitle": "No rounds yet",
    "bracket.noRoundsOwnerStarted": "Click \"Generate first round\" to start the draw.",
    "bracket.noRoundsOwnerDraft": "Start the tournament first once all pairs are ready.",
    "bracket.noRoundsViewer": "The organizer hasn't generated pairings yet. Check back later.",
    /* Overflow menu in the draw toolbar. Holds the rare and the
       destructive — manual generation and tournament reset — so neither sits
       next to "Generate round". */
    "bracket.moreActions": "More tournament actions",

    /* "Table 7" is a table NUMBER, not a count of tables — no plural family. */
    table: "Table {n}",
    tableLabel: "Table",

    "settings.allowRepeatsLabel": "Repeat pairings",
    /* The hint is no longer printed under the switch — it costs the toolbar a
       whole strip — it lives behind the "?" next to it. */
    "settings.allowRepeatsHint": "Allow the same pairs to play each other again",
    "settings.allowRepeatsHelp": "What does this mean?",

    // --- Round card ---------------------------------------------------------
    "round.heading": "Round {n}",
    "round.completed": "Completed",
    "round.inProgress": "In progress",
    "round.expand": "Expand round",
    "round.collapse": "Collapse round",
    "round.noMatches": "No matches in this round.",
    "round.generate": "Generate round",
    "round.generateFirst": "Generate first round",
    "round.generateNextTitle": "Generate next round",
    "round.generateBlockedTitle": "Finish the current round or add pairs",
    "round.manualButton": "Generate manually",
    /* Reads as a full action, not a bare verb: it is a menu item now, not a
       button sitting next to "Finish round" whose noun it could borrow. */
    "round.resetButton": "Reset round",
    "round.resetTitle": "Delete the round's matches and restore stats",
    "round.moreActions": "More round actions",
    "round.finishButton": "Finish round",
    "round.finishTitle": "Finish round",
    "round.finishBlockedTitle": "Enter all results first",
    "round.resetConfirmTitle": "Reset the round?",
    "round.resetConfirmBody":
        "All matches in this round will be deleted and pair stats restored to how they were before the round.",

    /* Round-level failures. The titles double as the `requireOnlineFor`
       heading, which is why they read as outcomes ("Round not finished")
       rather than as actions. */
    "round.notGeneratedTitle": "Round not generated",
    "round.notFinishedTitle": "Round not finished",
    "round.pendingOps":
        "Some changes are still waiting to be saved. Wait for the pending-changes indicator to disappear.",
    "round.someScoresFailedTitle": "Some results weren't saved",
    "round.someScoresFailedDescription": "Tables: {tables}. The round wasn't finished — try again.",
    "round.cannotResetTitle": "Round can't be reset",
    "round.notLoaded": "Tournament not loaded.",
    "round.completedCannotReset": "A completed round can no longer be undone.",

    // --- Match row ----------------------------------------------------------
    pendingSave: "Waiting to save",
    "match.editTitle": "Edit match result",
    /* The per-row save control is a floppy icon, so this is its only name —
       it is both the aria-label and the tooltip. */
    "match.saveAria": "Save result",
    "match.scoreAria": "Result — {pair}",
    /* Row state. Color carries it visually; these carry it to a screen
       reader and to anyone hovering the row. */
    "match.stateOpen": "No result",
    "match.stateLive": "Result in progress",
    "match.stateUnsaved": "Unsaved",
    "match.stateEditing": "Editing result",
    "match.stateFinished": "Match finished",
    "match.invalidScoreTitle": "Invalid result",
    "match.invalidScoreDescription": "Enter valid results for both pairs (different numbers).",

    // --- Fullscreen round dialog -------------------------------------------
    fullscreenRoundTitle: "Round {n} — Fullscreen",
    /* The board is meant for a laptop or TV at the venue, so it has exactly
       two sizes: fewer + bigger cards, or more + smaller ones. Deliberately
       not a slider or a zoom percentage — the organizer picks one of two
       once and walks away from the machine. */
    "fullscreen.sizeLabel": "Card size",
    "fullscreen.smaller": "Smaller",
    "fullscreen.larger": "Larger",
    /* The browser's OWN fullscreen (F11), on top of the overlay — it drops
       the address bar and the tab strip, which is the difference between a
       usable wall display and a wall display with the browser's chrome on
       it. Named so it can't be confused with "Fullscreen", which opens the
       overlay in the first place. */
    "fullscreen.enterNative": "Hide browser (fullscreen)",
    "fullscreen.exitNative": "Show browser",

    // ═══════════════════════ Lifecycle actions ═══════════════════════
    "start.button": "Start tournament",
    "start.startTitle": "Start tournament",
    "start.needTwoPaid": "Needs at least 2 paid pairs to start",
    "start.notStartedTitle": "Tournament not started",
    "start.cannotStartTitle": "Tournament can't be started",
    "start.insufficientPairs": "At least 2 paid pairs are needed to start the tournament.",

    "finish.button": "Finish tournament",
    "finish.notFinishedTitle": "Tournament not finished",
    "finish.cannotFinishTitle": "Tournament can't be finished",
    "finish.alreadyFinished": "The tournament is already finished.",
    "finish.roundInProgress": "The last round isn't finished yet.",

    "reset.button": "Reset tournament",
    "reset.title": "Delete all rounds and return the tournament to draft",
    "reset.notResetTitle": "Tournament not reset",
    "reset.confirmTitle": "Reset the tournament?",
    "reset.confirmBody":
        "All rounds and matches will be deleted and the tournament returned to draft. This action can't be undone.",
    "reset.confirmYes": "Yes, reset",

    /* The UNPAID_REQUIRED 409 modal. The bare code is what the SPA switches
       on; this is the sentence it shows because of it. */
    "unpaid.title": "Tournament can't start",
    "unpaid.body.before": "The tournament can't start until every pair has their",
    "unpaid.body.bold": "entry fee",
    "unpaid.body.after": " marked. Please mark “Entry fee” for every pair that has paid.",

    // --- Manual round confirmation -----------------------------------------
    "manualRound.confirmTitle": "Manual round generation?",
    "manualRound.confirmBody":
        "Are you sure you want to manually choose the pairings for the next round? This step bypasses the automatic draw and sets exactly the schedule you pick.",
    "manualRound.confirmYes": "Yes, manually",

    // --- Destructive confirmations -----------------------------------------
    "deleteTournament.title": "Delete the tournament?",
    "deleteTournament.before": "Delete the tournament",
    "deleteTournament.after":
        "? The tournament will no longer be visible in search, on the map, in the calendar or in player profiles. This action can't be undone through the app.",
    "deleteTournament.confirm": "Yes, delete",

    "deletePair.title": "Remove pair?",
    "deletePair.before": "Really remove the pair",
    "deletePair.after": "from the tournament? This action can't be undone.",
    "deletePair.confirm": "Yes, remove",

    // ═══════════════════════ Pair match-history dialog ═══════════════════════
    "history.played": "Played",
    "history.wins": "Wins",
    "history.losses": "Losses",
    "history.status": "Status",
    "history.empty": "This pair hasn't played any matches yet.",
    "history.roundShort": "R{n}",
    "history.vs": "vs {name}",
    "history.advanced": "Advanced",
    "history.inProgress": "In progress",
    "history.win": "Win",
    "history.loss": "Loss",

    // ═══════════════════════ Drink bill (MatchBillButton) ═══════════════════════
    "bill.button": "Bills",
    "bill.paid": "Paid",
    "bill.dialogTitle": "Table bill",
    "bill.payer": "Paying:",
    "bill.noDrinks": "No drinks added.",
    "bill.quantity": "× {n}",
    "bill.remove": "Remove",
    "bill.total": "Total",
    "bill.addDrink": "Add drink:",
    "bill.noCjenik": "No price list set. Open the “Price list” tab to add drink prices.",
    "bill.priceChip": "{name} · {price}",
    /* Name shown on an optimistic drink row whose price row could not be
       resolved locally — the server's answer replaces it moments later. */
    "bill.genericDrink": "Drink",
    "bill.unpay": "Undo paid",
    "bill.markPaid": "Mark paid",
    "bill.paidByAt": "Settled by {name}, {at}",
    "bill.paidAt": "Settled {at}",

    /* ═══════════════════ Waiter access (Bills) ═══════════════════
       The waiter surface: a four-letter code an organizer hands to the bar
       staff, and the bill list it unlocks. `waiter.tab` is the section's
       LABEL — its URL token ("racuni") is a route, not copy, and lives in
       TournamentDetailsPage's SECTION_SLUG map alongside detalji/parovi/
       zdrijeb/cjenik, deliberately outside these dictionaries. */
    "waiter.tab": "Bills",
    /* Toast title for any failed waiter write. The server's own sentence
       becomes the description when it sent one. */
    "waiter.actionFailed": "The action failed.",
    "waiter.exit": "Sign out",

    // --- The code gate ------------------------------------------------------
    "waiter.gate.title": "Waiter access",
    "waiter.gate.description":
        "Enter the four-letter code the organizer gave you and you'll see the bills for every table at this tournament.",
    "waiter.gate.codeLabel": "Code",
    "waiter.gate.placeholder": "ABCD",
    "waiter.gate.submit": "Open bills",
    /* Fallback only — the backend answers a wrong code with its own message
       in the reader's language, and that one is shown as-is. */
    "waiter.gate.invalid": "The code isn't valid.",

    // --- Organizer: managing waiters ----------------------------------------
    /* Several named waiters per tournament now, not one shared code — see
       `WaiterAccessService`. This panel lists them; the invite flow lives in
       its own `waiter.invite.*` block below. */
    "waiter.manage.heading": "Waiters",
    "waiter.manage.description":
        "Invite someone and send them a code or a link. Everyone gets their own code — you can revoke access at any time, one at a time or all at once.",
    "waiter.manage.invite": "Invite someone",
    "waiter.manage.revokeAll": "Revoke all",
    "waiter.manage.revokeAllTitle": "Revoke access for everyone?",
    "waiter.manage.revokeAllBody":
        "Every waiter immediately loses access to the bills, and their codes stop working.",
    "waiter.manage.revokeAllConfirm": "Revoke all",
    "waiter.manage.revokeAllFailed": "Access couldn't be revoked for everyone.",
    "waiter.manage.revokeOne": "Revoke access",
    "waiter.manage.revokeOneTitle": "Revoke access ({name})?",
    "waiter.manage.revokeOneBody":
        "The code stops working immediately, and any devices it was entered on lose access to the bills.",
    "waiter.manage.revokeOneConfirm": "Revoke",
    "waiter.manage.revokeFailed": "Access couldn't be revoked.",
    "waiter.manage.copyLink": "Copy link",
    "waiter.manage.linkCopied": "Link copied",
    "waiter.manage.copyCode": "Copy code",
    "waiter.manage.codeCopied": "Code copied",
    "waiter.manage.loadFailed": "The waiter list couldn't be loaded.",
    "waiter.manage.emptyTitle": "No waiters yet",
    "waiter.manage.emptyDescription": "Invite the first person and send them a code or a link.",
    "waiter.manage.headWaiterBadge": "Head waiter",

    // --- Invite dialog -------------------------------------------------------
    "waiter.invite.title": "Invite a waiter",
    "waiter.invite.nameLabel": "Name",
    "waiter.invite.namePlaceholder": "e.g. Ivan",
    "waiter.invite.submit": "Invite",
    "waiter.invite.headWaiterLabel": "Head waiter",
    "waiter.invite.headWaiterHint": "Besides bills, this person can also edit the price list.",
    "waiter.invite.doneTitle": "Code for {name} is ready",
    "waiter.invite.doneDescription": "Share the code or the link with them. They only work for that person.",
    "waiter.invite.done": "Done",
    "waiter.invite.failed": "The invite failed.",

    // --- The bill list ------------------------------------------------------
    "waiter.list.unpaid": "Unpaid",
    "waiter.list.openBill": "Open bill",
    /* Two pair names on one row. One key, not a `join`, so the separator is
       a translator's choice. */
    "waiter.list.versus": "{a} — {b}",
    "waiter.list.loadFailed": "The bills couldn't be loaded.",
    "waiter.list.emptyTitle": "No bills yet",
    "waiter.list.emptyDescription": "Bills appear as soon as the first round is drawn.",
    /* A settled bill collapses to one line by default — see
       `RacuniSection`'s per-row expand state. */
    "waiter.list.collapsePaid": "Collapse paid bill",
    "waiter.list.expandPaid": "Show paid bill",
    /* Counter chips above the list. English has no grammatical plural for
       either word here, so every category carries the same text. */
    "waiter.chip.bills.one": "bill",
    "waiter.chip.bills.two": "bills",
    "waiter.chip.bills.few": "bills",
    "waiter.chip.bills.other": "bills",
    "waiter.chip.unpaid.one": "unpaid",
    "waiter.chip.unpaid.two": "unpaid",
    "waiter.chip.unpaid.few": "unpaid",
    "waiter.chip.unpaid.other": "unpaid",

    // ═══════════════════════ Offline queue (SyncIndicator) ═══════════════════════
    "offline.description": "No internet connection. Connect to a network and try again.",
    "sync.allSaved": "Everything is saved",
    "sync.stuck": "Sync is stuck",
    "sync.saving": "Saving…",
    "sync.offline": "No internet connection",
    "sync.offlineWithPending": "No connection — {pending}",
    "sync.retry": "Try again",
    "sync.dropped.title": "Change wasn't saved",
    "sync.dropped.description": "The server rejected it: {what}. Check the state and enter it again.",
    "sync.op.matchScore": "entering the result",
    "sync.op.billAddDrink": "adding a drink to the bill",
    "sync.op.billRemoveDrink": "removing a drink from the bill",
    "sync.op.billPay": "marking the bill paid",
    "sync.op.billUnpay": "undoing the bill payment",
    "sync.op.pairPaid": "changing the pair's entry fee status",
    /* A real singular/plural family — this replaces a hand-rolled helper in
       SyncIndicator.tsx. */
    "sync.pending.one": "{n} change pending",
    "sync.pending.two": "{n} changes pending",
    "sync.pending.few": "{n} changes pending",
    "sync.pending.other": "{n} changes pending",

    // ═══════════════════════ "Link score pad to table" (BLOK-LINK.md §4) ═══════════════════════
    // Organiser's side, in Draw: pending link requests and the approved
    // link shown on a match row. Appended at the end of the file on purpose —
    // see the task note that added this block.
    "blokLinks.pendingHeading": "Link requests",
    "blokLinks.pendingCount.one": "{n} request",
    "blokLinks.pendingCount.two": "{n} requests",
    "blokLinks.pendingCount.few": "{n} requests",
    "blokLinks.pendingCount.other": "{n} requests",
    "blokLinks.requestLine": "Round {round} · Table {table} · Pair: {pair}",
    "blokLinks.approve": "Approve",
    "blokLinks.reject": "Reject",
    /* Shown on the match row itself once a link is APPROVED. */
    "blokLinks.linkedBadge": "Score pad linked: {name}",
    "blokLinks.endLink": "End the score pad link",
    "blokLinks.rejectConfirmTitle": "Reject the link request?",
    "blokLinks.rejectConfirmBody": "{name} will be notified that the request was rejected.",
    "blokLinks.rejectConfirmYes": "Yes, reject",
    "blokLinks.revokeConfirmTitle": "End the score pad link?",
    "blokLinks.revokeConfirmBody":
        "{name} will no longer be able to send results from their score pad to this table until they request a new link.",
    "blokLinks.revokeConfirmYes": "Yes, end it",
    "blokLinks.toast.approved": "Score pad link approved",
    "blokLinks.toast.rejected": "Link request rejected",
    "blokLinks.toast.revoked": "Score pad link ended",

    /* ═══════════════════════════════════════════════════════════════════
       REVISION 2026-09-08 — PUBLIC LOG FOR A LINKED TABLE
       BLOK-LINK.md §6.2
       ═══════════════════════════════════════════════════════════════════
       A match row with a linked score pad carries a link to
       `/blok/z/{token}`: every deal behind the score, exactly as the player
       entered it.

       The label is a noun ("Log"), not a command: it links to a thing, not
       a button that does something. The full sentence about what it opens
       and that it's public goes in `title`, where it doesn't cost the row's
       width — the same row the scores are entered on. */
    "blokLinks.logbook": "Log",
    "blokLinks.logbookTitle":
        "Open the linked score pad's log — public link, opens in a new tab",

    /* ═══════════════════════════════════════════════════════════════════
       CONTENT REPORTING — entry points from the tournament page
       ═══════════════════════════════════════════════════════════════════
       Just two labels: a menu item in the tournament header and a button in
       the pair panel. The dialog itself (reasons, message, error copy) is in
       the `profile` dictionary — the same component opens from a player
       profile too, so its text must not be split across two places. */
    "report.tournamentItem": "Report tournament",
    "report.pairItem": "Report pair",
}
