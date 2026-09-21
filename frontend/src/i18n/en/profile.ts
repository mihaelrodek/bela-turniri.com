import type { ProfileDict } from "../hr/profile"

/* English `profile`. Typed as the Croatian namespace, so a dropped or
   misspelled key fails `tsc` instead of silently falling back at runtime.
   Register: plain, friendly, informal second person ("you"), matching the
   Croatian copy — see EN-CONTRACT.md for voice and glossary. */

export const profile: ProfileDict = {
    // --- Document head / SEO -------------------------------------------------
    "seo.title": "{name} — Bela player | bela-turniri.com",
    "seo.titleFallback": "Bela player — bela-turniri.com",
    "seo.description": "{name} — tournament history at Bela tournaments. {tournaments}, {wins}.",
    "seo.ogDescription": "Tournament history at Bela tournaments — {tournaments}, {wins}.",
    "seo.knowsAboutCardGames": "Card games",
    "seo.breadcrumbPlayers": "Players",

    // --- Counts ---------------------------------------------------------------
    // English only distinguishes one/other, so `.two`/`.few` repeat `.other`.
    "tournamentsCount.one": "{n} tournament",
    "tournamentsCount.two": "{n} tournaments",
    "tournamentsCount.few": "{n} tournaments",
    "tournamentsCount.other": "{n} tournaments",
    "winsCount.one": "{n} win",
    "winsCount.two": "{n} wins",
    "winsCount.few": "{n} wins",
    "winsCount.other": "{n} wins",

    // --- Load / error states ---------------------------------------------------
    notFound: "Profile not found.",
    loadFailed: "Failed to load profile.",
    unavailable: "Profile unavailable.",
    back: "Back",
    toTournaments: "To tournaments",
    toHome: "To home",

    // --- Section nav ------------------------------------------------------------
    "tab.tournaments": "Tournaments",
    "tab.presets": "Presets",
    "tab.invoices": "Bills",
    "tab.dashboard": "Dashboard",
    "tab.gameAnalytics": "Game analytics",
    "tab.playersList": "Player list",
    "tab.contactMessages": "Messages",
    "tab.gameStats": "Stats",

    // --- Turniri tab (the one view visitors also get) --------------------------
    "tournaments.heading": "Tournaments",
    "tournaments.emptyNoPairs": "This player hasn't played any tournaments.",
    "tournaments.partnerLabel": "Co-owner:",
    "tournaments.searchPlaceholder": "Search: tournament name or location…",
    "tournaments.emptyFiltered": "No tournaments match the selected filters.",

    // --- Profile header: avatar, name, phone ------------------------------------
    "nav.sectionsAria": "Profile sections",
    "avatar.alt": "Profile picture",
    "avatar.change": "Change profile picture",
    "avatar.upload": "Upload profile picture",
    "avatar.uploadFailed": "Failed to upload picture",
    "avatar.cropTitle": "Crop profile picture",
    "avatar.cropHint": "Drag and resize the frame — the circle shows what will be visible.",
    "avatar.cropConfirm": "Save",
    "avatar.remove": "Remove profile picture",
    "avatar.removeConfirmTitle": "Remove profile picture?",
    "avatar.removeConfirmBody": "Your profile will show your initials again.",
    "avatar.removeConfirmLabel": "Remove",
    unnamedPlayer: "Unnamed player",
    "phone.loginToSee": "Sign in to see the number",
    "phone.loginHint": "(sign in)",

    // --- Postavke › Moji podaci (owner) -----------------------------------------
    "details.title": "My details",
    "details.description": "Profile picture, name, username and phone number.",
    "details.edit": "Edit",
    "details.nameLabel": "Name",
    "details.usernameLabel": "Username",
    "details.phoneLabel": "Phone number",
    "details.notSet": "Not set",

    // --- Edit-profile dialog (owner) --------------------------------------------
    "edit.title": "Edit profile",
    "edit.nameLabel": "Name",
    "edit.namePlaceholder": "e.g. John Smith",
    "edit.nameRequired": "Name can't be empty.",
    "edit.phoneLabel": "Phone number",
    "edit.phoneOptional": "(optional)",
    /* ─── Avatars (characters instead of a photo) ─────────────── */
    "avatar.pickerLabel": "Choose a character",
    "avatar.dialogTitle": "Profile picture",
    "avatar.usePhotoAgain": "Use this photo",
    "avatar.photoHint": "Upload your own picture and crop it to a circle.",
    "avatar.chooseTitle": "Character",
    "avatar.chooseHint": "Choose a character or upload your own picture.",
    "avatar.usePhoto": "Use photo",
    "avatar.useCharacter": "Use character",
    "avatar.name.kralj": "King",
    "avatar.name.baba": "Granny",
    "avatar.name.decko": "Boy",
    "avatar.name.dida": "Grandpa",
    "avatar.name.baka": "Grandma",
    "avatar.name.gazda": "Boss",
    "avatar.name.konobar": "Waiter",
    "avatar.name.cura": "Girl",
    "avatar.name.momak": "Guy",
    "avatar.name.kibic": "Kibitzer",
    "avatar.name.gospon": "Sir",
    "avatar.name.sudac": "Judge",
    "avatar.name.teta": "Auntie",
    "avatar.name.profa": "Prof",
    "avatar.name.mornar": "Sailor",
    "avatar.name.seka": "Sis",
    // Photo always wins over a picked character while both exist
    // (AvatarPresetService.presetFor) — shown only when the user has a photo,
    // so a picked face that doesn't visibly apply isn't a silent no-op.
    "avatar.choosePhotoNotice": "You're currently showing a photo — it takes priority. The character you picked will show once you remove the photo.",
    "avatar.pickFailed": "Failed to save character",
    // Bare wire code INVALID_AVATAR_PRESET (services/AvatarPresetService) —
    // unreachable from this picker (it only ever sends AVATAR_IDS), kept for
    // a stale client that still knows an id this backend no longer accepts.
    "avatar.invalidPreset": "That character no longer exists. Refresh the page and try again.",
    "edit.gameNameLabel": "Game name",
    "edit.gameNameEmpty": "Not set",
    "edit.gameNameHint": "The name other players see at the table. Change it in the game settings.",
    "edit.phonePlaceholder": "91 234 5678",
    "edit.saveFailed": "Failed to save.",

    // --- Pair chips ---------------------------------------------------------------
    "pair.sharedTitle": "Shared with partner",

    // --- Tournament row: status badge + expanded match list ------------------------
    "status.winner": "Winner",
    "status.pendingApproval": "Pending approval",
    "status.eliminated": "Eliminated",
    "status.active": "Active",
    "status.finished": "Finished",
    "status.announced": "Announced",
    record: "{wins}W – {losses}L",
    extraLife: "Extra life",
    openTournament: "Open tournament",
    "matches.loadFailed": "Failed to load matches.",
    "matches.empty": "No matches played yet.",
    "match.bye": "Bye",
    "match.won": "Won",
    "match.lost": "Lost",
    "match.resolved": "Resolved",
    "match.inProgress": "In progress",
    "match.round": "Round {n}",
    "match.table": "Table {n}",
    vs: "vs",

    // --- Predlošci tab › Moji parovi (owner) ---------------------------------------
    "pairs.title": "My pairs",
    "pairs.description": "Save your pairs here. Share a pair with your partner so it also shows up on their profile, or hide it from others if you don't want it shown publicly.",
    "pairs.namePlaceholder": "e.g. John & Mike",
    "pairs.add": "Add",
    "pairs.empty": "You don't have any saved pairs.",
    "pairs.hidden": "Hidden",
    "pairs.show": "Show",
    "pairs.hide": "Hide",
    "pairs.showTitle": "Show to others",
    "pairs.hideTitle": "Hide from others",
    "pairs.edit": "Edit",
    // Owner-side label for a preset the partner has already claimed.
    "pairs.roleCoOwnerLabel": "Co-owner:",
    "pairs.roleOwnerLabel": "Owner:",
    "pairs.notShared": "Not shared",
    "pairs.share": "Share with partner",
    "pairs.linkCopiedTitle": "Link copied",
    "pairs.linkCopiedBody": "Send it to your partner.",
    "pairs.copyFailedTitle": "Couldn't copy to clipboard",
    "pairs.copyFailedBody": "Copy it manually: {url}",
    // Archive (delete) request flow for a co-owned pair.
    "pairs.requestDeleteAria": "Send delete request",
    "pairs.requestDeleteTitle": "Send your partner a delete request",
    "pairs.partnerRequestedDelete": "Partner requested deletion",
    "pairs.accept": "Accept",
    "pairs.reject": "Decline",
    "pairs.requestSent": "Request sent — awaiting response",
    "pairs.cancelRequest": "Cancel",
    "pairs.deleteRequestDialogTitle": "Send delete request?",
    "pairs.deleteRequestBody": "The pair {name} is shared with {partner}. A request will be sent to your partner — the pair is only deleted once they accept it.",
    "pairs.sendRequest": "Send request",
    "pairs.deleteDialogTitle": "Delete pair?",
    "pairs.deleteBody": "Are you sure you want to delete {name}? This action can't be undone.",
    "pairs.deleted": "Pair deleted",
    "pairs.deleteBlockedTitle": "Can't be deleted",
    "pairs.deleteBlockedBody": "Try sending a request to your partner instead.",
    "pairs.deleteFailed": "Delete failed",
    "pairs.cancelFailed": "Cancel failed",
    "pairs.confirmFailed": "Confirmation failed",
    "pairs.rejectFailed": "Decline failed",

    // --- Predlošci tab › Moji cjenici (owner) ---------------------------------------
    "templates.title": "My price lists",
    "templates.description": "Organizing a tournament? Save drink price lists you can load into your tournament with one click.",
    "templates.empty": "You don't have any saved presets.",
    "templates.newNamePlaceholder": "New preset name",
    "templates.create": "Create",
    "templates.duplicateName": "A preset with that name already exists.",
    "templates.back": "Back",
    "templates.saveName": "Save name",
    "templates.rename": "Rename",
    "templates.deleteAria": "Delete preset",
    "templates.quickAdd": "Quick add:",
    "templates.emptyRows": "The preset is empty. Add drinks below.",
    "templates.rowNamePlaceholder": "Name (e.g. Beer)",
    "templates.rowPricePlaceholder": "Price",
    "templates.rowRemove": "Remove",
    "templates.addRow": "Add",
    "templates.save": "Save preset",
    "templates.deleteDialogTitle": "Delete preset?",
    "templates.deleteBody": "The preset \"{name}\" and all its prices will be permanently deleted.",

    // --- Postavke tab (owner) ---------------------------------------------------
    "settings.title": "Settings",
    "settings.description": "Personalized app and profile settings.",
    "settings.theme": "Theme",
    "settings.light": "Light",
    "settings.dark": "Dark",
    "settings.themeHint": "Your choice is saved with your account, so it follows you across devices.",
    "settings.language": "Language",
    "settings.languageHint": "Changes the interface and server message language. Saved with your account.",

    // --- Računi tab (owner) -------------------------------------------------------
    "invoices.title": "Bills",
    "invoices.description": "Bills by table for the tournaments you've played.",
    "invoices.empty": "You don't have any bills yet.",
    "invoices.round": "Round {n}",
    "invoices.table": "Table {n}",
    "invoices.paid": "Paid",
    "invoices.yourBill": "Your bill",
    "invoices.open": "Open",
    "invoices.win": "Win",
    "invoices.dialogTitleFallback": "Bill",
    "invoices.noDrinks": "No drinks added.",
    "invoices.total": "Total",

    // --- Turniri tab › Statistika igranja (owner) -----------------------------
    "gameStats.title": "Game stats",
    "gameStats.loadFailed": "Failed to load stats.",
    "gameStats.emptyNoGames": "No games played yet.",
    "gameStats.games.one": "{n} game",
    "gameStats.games.two": "{n} games",
    "gameStats.games.few": "{n} games",
    "gameStats.games.other": "{n} games",
    "gameStats.wins.one": "{n} win",
    "gameStats.wins.two": "{n} wins",
    "gameStats.wins.few": "{n} wins",
    "gameStats.wins.other": "{n} wins",
    "gameStats.losses.one": "{n} loss",
    "gameStats.losses.two": "{n} losses",
    "gameStats.losses.few": "{n} losses",
    "gameStats.losses.other": "{n} losses",
    "gameStats.winRate": "Win rate",
    "gameStats.karma": "Karma",
    /* Karma redesign (2026-09-21, KARMA-CONTRACT.md) — no more retroactive
       points for games played. `{window}` arrives pre-formatted, built via
       `usePlural()` with `gameStats.daysDuration` below — never a bare number
       glued to a fixed noun. */
    "gameStats.karmaHint": "Everyone starts at {max}/{max}. Abandoning a game with at least one other player still in it costs 1 point for {window}, then it just falls off. Playing never gives points back.",
    "gameStats.abandons": "Abandons",
    /* Same "X of Y in the last Z days" line as in the room (`game.karma.*` in
       the lazy-loaded `game` namespace) — duplicated here under `profile` on
       purpose: the profile page doesn't load the `game` namespace (only
       /igra does, via `loadNamespace`), so a reference to `game.karma.*` from
       here would show a raw key until the first visit to /igra. */
    "gameStats.abandonedLine": "Abandoned {abandoned} of {games} in {window}",
    "gameStats.noAbandonsLine": "No abandoned games in {window}",
    "gameStats.gamesOf.one": "{n} game",
    "gameStats.gamesOf.two": "{n} games",
    "gameStats.gamesOf.few": "{n} games",
    "gameStats.gamesOf.other": "{n} games",
    "gameStats.lastDays.one": "last {n} day",
    "gameStats.lastDays.two": "last {n} days",
    "gameStats.lastDays.few": "last {n} days",
    "gameStats.lastDays.other": "last {n} days",
    "gameStats.daysDuration.one": "{n} day",
    "gameStats.daysDuration.two": "{n} days",
    "gameStats.daysDuration.few": "{n} days",
    "gameStats.daysDuration.other": "{n} days",
    "gameStats.categoryStats": "{wins}/{n} ({winRate}%)",
    "gameStats.targetScore.163": "Quick 163",
    "gameStats.targetScore.501": "To 501",
    "gameStats.targetScore.701": "To 701",
    "gameStats.targetScore.1001": "To 1001",

    /* ═══════════════════════════════════════════════════════════════════
       BLOK TAB — private history of played score pads (BLOK-HISTORY.md §4)
       ═══════════════════════════════════════════════════════════════════
       Visible only to the profile owner, same mechanism as "predlosci" /
       "racuni" (see pages/profile/sections.ts and PublicProfilePage.tsx).
       Declaration/capot/failed-contract/trump/game terms come from the
       `blok` namespace (`blok.entry.*`, `blok.side.*`) — deliberately not
       duplicated here. */
    "tab.blok": "Score pad",
    "blok.title": "Score pad",
    "blok.description": "History of played score pads — series of games saved from your device.",
    "blok.loadFailed": "Failed to load history.",
    "blok.empty": "No saved series yet.",
    // NOTE: this mirrors the exact wording hr/sl kept for this hint after the
    // "Resetiraj"/"Ponastavi" button was renamed to "Nova igra" in blok.ts
    // (BLOK-HISTORY.md §5.6) — the hr string itself was never updated to
    // match, so this translation reproduces that as-is rather than fixing it.
    "blok.emptyHint": "A series is saved when you choose \"Reset\" on the score pad.",
    "blok.gamesCount.one": "{n} game",
    "blok.gamesCount.two": "{n} games",
    "blok.gamesCount.few": "{n} games",
    "blok.gamesCount.other": "{n} games",
    "blok.detailTitleFallback": "Series",
    "blok.detailLoadFailed": "Failed to load series.",
    "blok.deleteDialogTitle": "Delete series?",
    "blok.deleteBody": "Are you sure you want to delete the series {result}? This action can't be undone.",
    "blok.deleted": "Series deleted",

    /* ═══════════════════════════════════════════════════════════════════
       REVISION 2026-09-08 (second) — "To 1001 · play out"
       BLOK-HISTORY.md §5.5
       ═══════════════════════════════════════════════════════════════════
       Same caption as on the shared scoresheet and the score-pad card.
       Game-end rule words below MUST match `en/game.ts` and `en/blok.ts`
       (`lobby.form.endRule.*` / `rule.*`): "Play out" / "Cutoff". */
    "blok.meta": "To {target} · {rule}",
    "blok.rule.dosta": "cutoff",
    "blok.rule.prolaz": "play out",

    /* ═══════════════════════════════════════════════════════════════════
       USER SAFETY — content reporting, blocking, account deletion
       ═══════════════════════════════════════════════════════════════════
       Three features the App Store requires for an app with user content.
       All three live in this dictionary as one family, though the report
       dialog also opens from the tournament page — ENTRY POINT captions
       ("Report tournament", "Report pair") live in `tournament`, everything
       else is here. Machine codes (`SPAM`, `CANNOT_REPORT_SELF`…) are never
       translated; the keys below just give each one readable text. */

    // --- Content reporting (components/ReportDialog.tsx) -------------------------
    "actions.more": "More options",
    "report.title": "Report content",
    "report.body": "You're reporting: {target}. An admin reviews the report.",
    "report.profileItem": "Report profile",
    "report.reason.SPAM": "Unwanted content (spam)",
    "report.reason.OFFENSIVE": "Offensive or inappropriate content",
    "report.reason.PERSONAL_DATA": "Someone else's personal data",
    "report.reason.OTHER": "Something else",
    "report.messageLabel": "Description (optional)",
    "report.messagePlaceholder": "Briefly describe what's wrong…",
    "report.submit": "Submit report",
    "report.success": "Thanks, your report has been received.",
    "report.error.rateLimited": "Too many reports, try again later",
    "report.error.self": "You can't report your own content",
    "report.error.notFound": "This content no longer exists",
    "report.error.generic": "Failed to submit report",

    // --- Blocking ------------------------------------------------------------------
    "blocks.blockItem": "Block user",
    "blocks.confirmTitle": "Block this user?",
    "blocks.confirmBody":
        "{name} will no longer see your profile, and you won't see theirs. Tournaments this user organized disappear from your list. You can undo the block in your profile settings.",
    "blocks.blocked": "{name} is blocked",
    "blocks.failed": "Failed to block",
    "blocks.heading": "Blocked users",
    "blocks.description": "Users you've blocked — their profile and tournaments are hidden from you.",
    "blocks.loadFailed": "Couldn't load the list of blocked users.",
    "blocks.empty": "You don't have any blocked users.",
    "blocks.unblock": "Unblock",
    "blocks.unblocked": "Block removed",

    // --- Account deletion (pages/profile/DeleteAccountCard.tsx) --------------------
    /* The word the user has to type. Compared UPPERCASE and diacritic-
       insensitive — a phone keyboard auto-capitalizes anyway, so the
       comparison is case-insensitive. */
    "deleteAccount.confirmWord": "DELETE",
    "deleteAccount.heading": "Delete account",
    "deleteAccount.what":
        "Deleting your account removes your profile, profile picture, phone number and all settings.",
    "deleteAccount.keeps":
        "Tournaments you organized and results other people played stay, but \"Deleted user\" is shown instead of your name.",
    "deleteAccount.button": "Delete account",
    "deleteAccount.dialogTitle": "Delete account?",
    "deleteAccount.dialogBody": "This action can't be undone.",
    "deleteAccount.typePrompt": "To confirm, type {word}:",
    "deleteAccount.confirmButton": "Delete account",
    "deleteAccount.done": "Account deleted",
    "deleteAccount.failed": "Failed to delete account",
    "deleteAccount.recentLogin": "Sign in again and try again",
    /* Shown only when revoking the Apple token failed (cancelled sign-in,
       blocked pop-up). At this point the account is ALREADY deleted, so the
       text says what the user has left to do, not that something failed. */
    "deleteAccount.appleRevokeFailed":
        "Your account has been deleted, but we couldn't revoke access from Sign in with Apple. Remove the app in Settings → Apple ID → Sign in with Apple.",
    "deleteAccount.moreInfo": "Details: what's deleted and what stays",
}
