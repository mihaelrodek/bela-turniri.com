import type { CommonDict } from "../hr/common"

/* English `common`. Typed as the Croatian namespace, so dropping or
   misspelling a key fails `tsc` rather than silently falling back at runtime.

   Register: plain, friendly international English, US spelling, informal
   "you", sentence case for buttons and headings.

   One deliberate divergence from a literal translation: the Croatian HTTP
   fallbacks below use the FORMAL second person ("Niste prijavljeni.") because
   that is what the pre-i18n table said. English has no T–V distinction, so
   those strings simply read as the app's neutral voice. */

export const common: CommonDict = {
    // --- Actions -----------------------------------------------------------
    save: "Save",
    /* The two words that replaced the on/off switches in settings
       (2026-09-09, user request): a switch makes you work out which side is
       "on", while "No / Yes" spells it out. */
    no: "No",
    yes: "Yes",
    cancel: "Cancel",
    confirm: "Confirm",
    delete: "Delete",
    close: "Close",
    loading: "Loading…",

    // --- Generic feedback --------------------------------------------------
    saved: "Saved.",
    sessionExpired: "Your session has expired, please sign in again.",
    appUpdating: "The app is updating, try again in a minute.",

    // --- SEO defaults (fallback <meta name="description">) ------------------
    "meta.defaultDescription":
        "Bela Turniri — organize and follow Bela (Belot) tournaments. Search upcoming tournaments, join a pair and follow the results.",

    // --- HTTP error fallbacks ----------------------------------------------
    "error.network": "Network error.",
    "error.http.unknown": "Error (HTTP {status}).",
    "error.http.400": "Invalid request.",
    "error.http.401": "You are not signed in.",
    "error.http.403": "You are not allowed to do this.",
    "error.http.404": "Resource not found.",
    "error.http.409": "Conflict — try refreshing the page.",
    "error.http.413": "The file is too large.",
    "error.http.422": "Invalid data.",
    "error.http.429": "Too many requests — try again in a few seconds.",
    "error.http.500": "Server error.",
    "error.http.502": "Server unavailable.",
    "error.http.503": "Service temporarily unavailable.",

    // --- Language switcher -------------------------------------------------
    "language.label": "Language",

    // --- Navigation ----------------------------------------------------------
    "nav.brandAriaLabel": "{site} — home",
    "nav.brandName": "Bela Turniri",
    "nav.turniri": "Tournaments",
    "nav.kalendar": "Calendar",
    "nav.kreirajTurnir": "Create tournament",
    "nav.karta": "Map",
    "nav.pronadjiPara": "Find a partner",
    "nav.login": "Sign in",
    "nav.profil": "Profile",
    "nav.novosti": "What's new",
    "nav.igraj": "Play",
    "nav.new": "New",
    "nav.blok": "Score pad",
    "nav.logout": "Sign out",
    "nav.profileMenuAriaLabel": "Profile menu",
    "nav.avatarAlt": "Profile picture",
    "nav.themeLabel": "Theme",
    "nav.menuAriaLabel": "Menu",
    "mobileNav.ariaLabel": "Mobile navigation",
    "mobileNav.kreiraj": "Create",

    // --- Auth loading state ---------------------------------------------------
    "checkingAuth": "Checking your sign-in…",

    // --- Guided tour chrome (react-joyride locale) ----------------------------
    "tour.nav.back": "Back",
    "tour.nav.last": "Finish",
    "tour.nav.next": "Next",
    "tour.nav.skip": "Skip",
    "tour.nav.open": "Open",
    "tour.nav.nextWithProgress": "Next ({step}/{steps})",

    // --- Guided tour copy — /turniri list tour --------------------------------
    "tour.list.welcome.title": "Welcome to Bela Turniri!",
    "tour.list.welcome.content":
        "Let's start with a quick look around — where the tournaments are, how to search them and what you can find on a single tournament's page. Click \"Next\" to start, or \"Skip\" if you'd rather look around on your own.",
    "tour.list.navItems.title": "Main menu",
    "tour.list.navItems.content":
        "This is the main menu. From here you can reach the tournament list, the calendar, the tournament map and the tool for finding a partner for a tournament.",
    "tour.list.navAuth.title": "Sign in",
    "tour.list.navAuth.content":
        "Sign in for extra features - your own profile, statistics, tournament history and organizing your own tournaments.",
    "tour.list.upcoming.title": "Upcoming tournaments",
    "tour.list.upcoming.content":
        "Here are all the tournaments that have not started yet or are under way. They are sorted by date — the closest one is at the top.",
    "tour.list.finished.title": "Finished tournaments",
    "tour.list.finished.content":
        "Below the upcoming tournaments are the finished ones, which you can open to review the draw and the winners.",
    "tour.list.filters.title": "Search filters",
    "tour.list.filters.content":
        "Here you can search tournaments by name. Clicking 'Filters' opens more options — filter by location, price and distance from you.",
    "tour.list.demoCard.title": "Let's look at a tournament",
    "tour.list.demoCard.content":
        "Click \"Next\" — this finished tournament will open so you can see its details.",

    // --- Guided tour copy — /turniri/{slug} detail tour -----------------------
    "tour.detail.details.title": "The \"Details\" tab",
    "tour.detail.details.content":
        "We start with the \"Details\" tab. It holds all the basic information about the tournament — location, date, entry fee, prizes and the organizer's contact.",
    "tour.detail.pairs.title": "The \"Pairs\" tab",
    "tour.detail.pairs.content":
        "In the \"Pairs\" tab you see every registered pair and its status in the tournament.",
    "tour.detail.firstPair.title": "Pair card",
    "tour.detail.firstPair.content":
        "Each card shows the pair's name, its wins and losses, and who registered it. Click the card to open the history of all its matches in the tournament.",
    "tour.detail.cjenik.title": "The \"Price list\" tab",
    "tour.detail.cjenik.content":
        "The \"Price list\" tab is for organizers. Here the organizer can set drink prices and later add them to a given table's bill.",
    "tour.detail.bracket.title": "The \"Draw\" tab",
    "tour.detail.bracket.content":
        "The \"Draw\" tab shows every round of the tournament, each match and its score. Every round is its own card that you can expand to see all the matches and results.",
    "tour.detail.firstRound.title": "Expanding and full screen",
    "tour.detail.firstRound.content":
        "An expanded round shows each match separately. Click the full-screen icon next to the draw for a large view — use it when you show the results to the room or on a big screen in the bar.",
    "tour.detail.endState.title": "End of the tournament",
    "tour.detail.endState.content":
        "When the tournament finishes, this is where the whole draw, every round with its results and the final winner are shown. Finished tournaments stay visible afterwards for reference.",
    "tour.detail.helpInstall.title": "Help and installing",
    "tour.detail.helpInstall.content":
        "You can always restart this tour by clicking the question mark (?), or install the app on your device by clicking the arrow (↓). Both buttons are always there in the menu.",
    "tour.detail.farewell.title": "That's it!",
    "tour.detail.farewell.content":
        "Thanks for taking this short tour of the site. Now go ahead and explore — create your own tournament, join an existing one or just follow the results. Good luck!",

    // --- Install prompts -------------------------------------------------------
    "install.title": "Install {site}",
    "install.iosSubtitle": "Add the app to your iPhone in 3 steps:",
    "install.genericSubtitle":
        "Save {site} as an app and open it with one tap from your home screen.",
    "install.dismissIos": "Got it",
    "install.dismissLater": "Maybe later",
    "install.installButton": "Install",
    "install.installAppLabel": "Install the app",

    // --- iOS "Add to Home Screen" walkthrough -----------------------------------
    "install.ios.intro": "Open the site in the Safari browser, then:",
    "install.ios.step1.action": "Tap the icon",
    "install.ios.step1.share": "Share",
    "install.ios.step1.location": "at the bottom of Safari.",
    "install.ios.step2.action": "Scroll down and choose",
    "install.ios.step2.addToHome": "Add to Home Screen",
    "install.ios.step3.action": "Confirm with",
    "install.ios.step3.confirm": "Add",
    "install.ios.step3.location": "in the top right corner.",
    "install.ios.footer":
        "Once added, the app icon appears on your home screen and opens as a standalone app.",

    // --- Crash fallback ----------------------------------------------------------
    "errorBoundary.title": "Something went wrong",
    "errorBoundary.description": "An unexpected error occurred. Refresh the page and try again.",
    "errorBoundary.home": "Back to home",
    "errorBoundary.refresh": "Refresh the page",

    // --- Offline: the page is not on the device ------------------------------
    "offline.title": "No internet connection",
    "offline.description":
        "This page needs the internet. The score pad works offline too — everything you write stays on your device.",
    "offline.descriptionBlok":
        "This page needs the internet and is not saved on your device. Try again once you are back online.",
    "offline.retry": "Try again",
    "offline.blok": "Open score pad",

    // --- Podium editor -------------------------------------------------------------
    "podium.title": "Podium",
    "podium.description":
        "Pick the pairs that finished second and third. They will appear at the top of the list with silver and bronze badges.",
    "podium.second": "2nd place (silver)",
    "podium.third": "3rd place (bronze)",
    "podium.notSet": "— not set —",

    // --- Manual round dialog -------------------------------------------------------
    "manualRound.title": "Manual round draw",
    "manualRound.titleNumbered": "Manual draw for round {round}",
    "manualRound.description":
        "Pick pair against pair for every table. You can add or remove rows as needed. If the number of active pairs is odd, set one pair to \"Free table (bye)\".",
    "manualRound.noMatches": "No matches. Add the first one below.",
    "manualRound.table": "Table",
    "manualRound.removeMatch": "Remove match",
    "manualRound.selectPair": "— pick a pair —",
    "manualRound.byeOption": "Free table (bye)",
    "manualRound.vs": "vs",
    "manualRound.addMatch": "Add match",
    "manualRound.generate": "Generate",

    // --- Location autocomplete / map picker -----------------------------------------
    "location.fetchError": "Error fetching suggestions.",
    "location.searching": "Searching…",
    "location.noResults": "No results.",
    "location.clickHint": "Click the map to pick a location",
    "location.searchingAddress": "Looking up the address…",
    "location.reverseGeocodeError": "Error fetching the address.",
    "location.searchPlaceholder": "Search an address or venue name",
    "location.poweredByGoogle": "Powered by Google",

    // --- Clipboard feedback, shared by CalendarSubscribeButton & TournamentQrDialog --
    "clipboard.copyLink": "Copy link",
    "clipboard.copied": "Link copied",
    "clipboard.copyFailed": "Copying failed",

    // --- Calendar subscribe dialog -----------------------------------------------
    "calendar.subscribeButton": "Subscribe",
    "calendar.dialogTitle": "Subscribe to the tournament calendar",
    "calendar.description":
        "Subscribe once and the calendar keeps itself up to date — new and upcoming tournaments show up automatically, with no second download.",
    "calendar.subscribeWebcal": "Subscribe (webcal)",
    "calendar.manualHint":
        "If the calendar does not open by itself, add this link manually (\"Subscribe to calendar from URL\"):",
    "calendar.downloadIcs": "Download .ics",
    "calendar.copyFailedDescription": "You can copy the link manually from the box below.",

    // --- Tournament QR dialog -------------------------------------------------------
    "qr.dialogTitle": "Tournament QR code",
    "qr.scanHint":
        "Scanning it opens the list of pairs for the tournament \"{name}\". Show this code on a screen, or print it and put it up at the venue.",
    "qr.altText": "QR code for the tournament {name}",
    "qr.downloadButton": "Download QR",
    "qr.downloadSuccess": "QR code downloaded",
    "qr.downloadFailedTitle": "Download failed",
    "qr.downloadFailedDescription": "Try again in a few moments.",
    "qr.copyFailedDescription": "You can copy the link manually from the address bar.",

    // --- API toast messages -------------------------------------------------
    "toast.tournamentCreated": "Tournament created.",
    "toast.tournamentUpdated": "Tournament updated.",
    "toast.tournamentStarted": "Tournament started.",
    "toast.tournamentFinished": "Tournament finished.",
    "toast.tournamentReset": "Tournament reset.",
    "toast.tournamentDeleted": "Tournament deleted.",
    "toast.podiumSaved": "Podium saved.",
    "toast.registrationSent": "Registration sent.",
    "toast.pairApproved": "Pair approved.",
    "toast.pairDeleted": "Pair deleted.",
    "toast.extraLifeBought": "Extra life bought.",
    "toast.cjenikSaved": "Price list saved",
    "toast.templateSavedAs": "Saved to the template \"{name}\"",
    "toast.templateImported": "Template \"{name}\" loaded",
    "toast.templateSaved": "Template \"{name}\" saved",
    "toast.templateRenamed": "Template renamed",
    "toast.templateDeletedNamed": "Template \"{name}\" deleted",
    "toast.matchPaid": "Paid",
    "toast.matchUnpaid": "Marked as unpaid",
    "toast.pairHidden": "Pair hidden from others",
    "toast.pairVisible": "Pair visible to everyone",
    "toast.archiveRequestSent": "Request sent — waiting for your partner's answer.",
    "toast.presetArchived": "Pair deleted.",
    "toast.archiveCancelled": "Request canceled.",
    "toast.profileSaved": "Profile saved.",
    "toast.avatarSaved": "Profile picture saved.",
    "toast.avatarRemoved": "Profile picture removed.",
    "toast.pairAttached": "Pair linked to the user.",
    "toast.tournamentTransferred": "Tournament transferred to the new owner.",
    "toast.tournamentStatusUpdated": "Tournament status updated.",
    "toast.roundGenerated": "Round generated.",
    "toast.roundFinished": "Round finished.",
    "toast.pairClaimed": "Pair claimed — it will show up on your profile.",

    // --- Drink preset categories -----------------------------------------
    "drinkCategory.beer": "Beer",
    "drinkCategory.spritzer": "Spritzer",
    "drinkCategory.juice": "Juice",
    "drinkCategory.wine": "Wine",
    "drinkCategory.water": "Water",
    "drinkCategory.spirits": "Spirits",

    // --- Service-worker update toast (components/SwUpdateToast.tsx) --------
    "swUpdate.title": "A new version is available",
    "swUpdate.description": "Refresh the page to see the latest changes.",
    "swUpdate.reload": "Refresh",

    // --- Cookie/analytics consent (components/CookieConsent.tsx) -----------
    "cookieConsent.description":
        "We use cookies for visit analytics and to improve the site.",
    "cookieConsent.privacyLink": "Privacy policy",
    "cookieConsent.accept": "Accept",
    "cookieConsent.decline": "Decline",

    // --- SiteFooter (rendered once in App.tsx under every routed page) -----
    "footer.contactLink": "Contact",
    "footer.privacyLink": "Privacy",
    "footer.termsLink": "Terms",
    "footer.copyright": "© {year} {domain}",

    // --- Deleted-account guard (auth/AuthContext.tsx) ----------------------
    "account.deleted": "This account has been deleted.",

    // --- Native push (platform/NativeShell.tsx) -----------------------------
    "push.fallbackTitle": "{site}",
    "push.channelName": "Notifications",
}
