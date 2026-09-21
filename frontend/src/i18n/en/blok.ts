import type { BlokDict } from "../hr/blok"

/* English `blok`. Typed against the Croatian namespace, so a missing or
   mistyped key fails `tsc` rather than showing up at runtime.

   Domain words follow `en/game.ts`: declarations (zvanja), deal (podjela),
   trump (adut), capot (štiglja), fell/went down (pad) — see BLOK.md §1 and
   the root CLAUDE.md i18n invariants. Trump-suit names and their icon come
   from the `game` namespace (`suit.*` + `SuitGlyph`) — not duplicated here.

   Counted families carry `.one/.two/.few/.other` branches (`.two` exists
   for the Slovenian dual; Croatian never selects it). Here that's
   `entry.added`, `archive.pending`, `archive.rejected` and `newGame.games`. */

export const blok: BlokDict = {
    /* ─── Title, navigation, SEO ──────────────────────────────────────── */
    title: "Bela Score Pad",
    "seo.title": "Bela score pad — bela-turniri.com",
    "seo.description":
        "A digital score pad for Bela at the table — log points, declarations and capots without signing in or being online.",

    /* ─── Sides (US / THEM, renamable) ────────────────────────────────── */
    "side.us": "US",
    "side.them": "THEM",
    "side.rename": "Rename",
    "side.renameTitle": "Rename sides",

    /* ─── Game settings (target, end rule, series length) ────────────── */
    // First part of the line above the totals in the card: "To 1001 · play out"
    // (BLOK-HISTORY.md §5.5). Was "Target" until 2026-09-08.
    "target.label": "TO",
    // `target.custom` ("Custom number") was removed 2026-09-08 along with the
    // field: only the 501 / 701 / 1001 chips remain in the dialog. The
    // backend still accepts any target — the UI narrowed, not the rule.
    // Dialog title. Used to be "Change target" while it held a single
    // number; since it also holds "play out/cutoff" and "play to", it's
    // named for what it is (BLOK-HISTORY.md §5.3). The same text is on the
    // menu item too.
    "target.title": "Settings",

    /* ─── Deal list (main screen) ─────────────────────────────────────── */
    "round.addFor": "Add a deal for {side}",
    // Full form: title of the US/THEM button in the list header and the label
    // of the dot in the deal list. The bare word without a side is `entry.caller` below.
    "round.calledBy": "{side} called",
    "round.runningTotal": "total {points}",
    "round.toGo": "to go",
    "round.difference": "difference",
    "dealer.first": "Deals first",
    "dealer.next": "Deals next",
    "dealer.self": "Me",
    "dealer.rightOpponent": "Right opponent",
    "dealer.partner": "Partner",
    "dealer.leftOpponent": "Left opponent",
    // `dealer.clockwise`/`dealer.counterclockwise` were removed 2026-09-08:
    // direction is no longer named by rotation but the way it's said at the
    // table — "Right"/"Left" (`dealer.right`/`dealer.left` at the end).
    // `round.empty` was removed 2026-09-08: an empty list under the two
    // obvious "US +"/"THEM +" buttons explains itself, so the empty state
    // no longer exists.
    "round.edit": "Edit deal",
    "round.delete": "Delete deal",
    "round.undoLast": "Undo last round",

    /* ─── Deal entry (bottom sheet) ────────────────────────────────────── */
    // `entry.cards` is no longer a label above the keypad (see BLOK.md §3.2)
    // — it stays as its accessible name (`role="group"`).
    "entry.cards": "Points from cards",
    // Sheet title and the label above the US/THEM switch that picks who called.
    // The buttons themselves carry the full `round.calledBy` ("US called") as their accessible name.
    "entry.caller": "Called",
    "entry.declarations": "Declarations",
    "entry.stiglja": "Capot",
    // Belot — the button is the other half of "Capot" (BLOK.md §1.2), and the
    // same word is the badge on the card in the list and in the deal row. The
    // hint is a sentence explaining what the button does: it feeds the
    // button's accessible name and prints below the big banner in the
    // congratulations screen.
    "entry.belot": "Belot",
    "entry.belotHint": "Eight cards of one suit — the game is over",
    "entry.belotCongrats": "Congratulations!",
    "entry.fell": "DOWN",
    // Visibly reads "Σ 297"; this word is the sr-only name of that number,
    // since a screen reader would otherwise read "n-ary summation" or nothing.
    "entry.sum": "Total",
    "entry.save": "Save",
    "entry.cancel": "Cancel",
    "entry.clearChip": "Remove declaration {value}",
    // How many times the declaration was added — feeds the button's name
    // since the "×2" badge is only a mark. Plural, never a ternary
    // (Slovenian has a dual).
    "entry.added.one": "added {n} time",
    "entry.added.two": "added {n} times",
    "entry.added.few": "added {n} times",
    "entry.added.other": "added {n} times",
    "entry.clearAll": "Clear",
    "entry.trump": "Trump",
    "entry.backspace": "Delete last digit",

    /* ─── End of game ──────────────────────────────────────────────────── */
    "winner.us": "We won",
    "winner.them": "They won",
    // `winner.newGame` ("Start new game") was removed 2026-09-08 with §5.6:
    // the words "new game" belong to the menu from then on, which CLOSES the
    // series, so the button that continues the series can't carry them.
    // Replaced by `winner.nextGame` ("Next game") at the end of the file.

    /* ─── Summary (end of game) ───────────────────────────────────────── */
    "summary.total": "Total",
    "summary.points": "Points",
    "summary.declarations": "Declarations",
    "summary.stiglje": "Capots",

    /* ─── Menu ───────────────────────────────────────────────────────── */
    // Shortened 2026-09-08 (BLOK-HISTORY.md §5.3). Removed because it moved,
    // not because it's gone: `menu.rename` (the pencil under each score
    // already does this), `menu.archive` (games are now in the card, behind
    // the arrow — §5.4) and `menu.share` (button in the card's top-left
    // corner, and it shares a link instead of text — §5.2, `share.*` keys at
    // the end of the file).
    "menu.title": "Menu",
    "menu.newGame": "New game",
    "menu.target": "Settings",
    "menu.delete": "Delete game",

    /* ─── Archive of played games ──────────────────────────────────────── */
    // NOT an archive — that's the profile. These are games from the CURRENT
    // series: "New game" fills it, and "Reset" saves the whole series to the
    // profile and empties this list. Two levels with the same name were
    // confusing (2026-09-08).
    "archive.empty": "No games played in this series yet.",
    // Series that are finished but haven't reached the profile yet (offline,
    // or the player wasn't signed in at the time). Plural, not a ternary —
    // Slovenian has a dual.
    "archive.pending.one": "{n} earlier series is still waiting to be sent to your profile.",
    "archive.pending.two": "{n} earlier series are still waiting to be sent to your profile.",
    "archive.pending.few": "{n} earlier series are still waiting to be sent to your profile.",
    "archive.pending.other": "{n} earlier series are still waiting to be sent to your profile.",
    // Series the server rejected and NO LONGER retries sending
    // (see `store.ts → rejectSessionUpload`). The sentence must say both:
    // that they weren't saved and that the games are still on the device —
    // otherwise it sounds like the evening vanished. Plural, not a ternary —
    // Slovenian has a dual.
    "archive.rejected.one":
        "{n} series wasn't saved to your profile. Its games are still on this device.",
    "archive.rejected.two":
        "{n} series weren't saved to your profile. Their games are still on this device.",
    "archive.rejected.few":
        "{n} series weren't saved to your profile. Their games are still on this device.",
    "archive.rejected.other":
        "{n} series weren't saved to your profile. Their games are still on this device.",

    /* ─── Confirmations (ConfirmDialog, never confirm()) ──────────────── */
    // `confirm.newGame` was removed 2026-09-08: "New game" is no longer a
    // confirmation but a choice between two actions (`newGame.*` at the end
    // of the file, §5.1). `share.text` went with it — a link is shared, not
    // a sentence with the score (§5.2).
    "confirm.deleteRound": "Delete this deal? This can't be undone.",
    "confirm.deleteGame": "Delete this game? This can't be undone.",

    /* ═══════════════════════════════════════════════════════════════════
       LINKING TO A TABLE AT A TOURNAMENT — `BLOK-LINK.md`
       ═══════════════════════════════════════════════════════════════════
       The only part of the score pad that requires signing in at all, and
       the only part that calls the server. A score pad without a link works
       exactly as before — so none of these strings appear on an unlinked
       score pad.

       Error codes (`LINK_EXISTS`, `ROUND_COMPLETED`, …) are machine codes and
       are NEVER translated (root CLAUDE.md); what's translated is the
       sentence the user sees instead of the code. The key carries the code
       in its name so `hasTranslation()` can ask whether a sentence exists for
       the code the server sent — if not, the general text is shown, never
       the bare code on screen. */

    /* ─── Entry (menu) and sign-in ────────────────────────────────────── */
    "link.menu": "Link to a table",
    "link.title": "Link the score pad to a table",
    "link.signIn": "Sign in",

    /* ─── Three steps (tournament → table → which side is which pair) ─── */
    "link.step.tournament": "Choose the tournament you're playing at.",
    "link.step.table": "Choose your table in the active round.",
    "link.step.side": "Tell us which pair you are — without it, the organizer gets a number with no name attached.",
    "link.noTournaments": "No tournaments are running or upcoming.",
    "link.noTables": "No table in the active round can be linked.",
    "link.loadFailed": "Couldn't load this.",
    "link.retry": "Try again",
    "link.back": "Back",
    "link.send": "Send request",

    /* ─── Table and round (labels, not countable terms) ───────────────── */
    "link.round": "Round {n}",
    "link.table": "Table {n}",
    "link.tableUnknown": "No table number",

    /* ─── Mapping sides to pairs ───────────────────────────────────────── */
    "link.sideQuestion": "Which pair is playing as \"{side}\"?",
    // The same key is used for the step-3 preview and the header bar row:
    // both sides are named with values (`{us}`/`{them}`), never text in a
    // sentence — sides are renamable, so a frozen "US"/"THEM" would be wrong
    // the moment someone renames them to "Ivan and Marko".
    "link.sideMapping": "{us} = {usPair} · {them} = {themPair}",

    /* ─── Status bar in the header ─────────────────────────────────────── */
    "link.status.pending": "Waiting for the organizer's approval",
    "link.status.approved": "Linked to the table",
    "link.status.rejected": "The organizer declined the link",
    "link.status.revoked": "The table link was removed",
    "link.pendingSend": "The latest result hasn't been sent yet — we'll try again.",
    "link.unlink": "Unlink",
    "link.dismiss": "Dismiss notification",
    "link.confirmUnlink": "Unlink from the table? The result will no longer reach the organizer.",

    /* ─── Messages after successful actions (toast) ────────────────────── */
    "link.requested": "Request sent to the organizer.",
    "link.unlinked": "The table link was removed.",

    /* ─── Why a table can't be selected (`targets[].reason`) ───────────── */
    "link.notLinkable": "This table can't be linked.",
    "link.reason.MATCH_HAS_BYE": "This table has a bye — there's no opponent.",
    "link.reason.LINK_EXISTS": "Someone already requested this table.",

    /* ─── Why the request failed ───────────────────────────────────────── */
    "link.error.generic": "The request wasn't sent. Try again.",
    "link.error.LINK_EXISTS": "Someone already requested this table.",
    "link.error.MATCH_HAS_BYE": "This table has a bye — there's no opponent.",
    "link.error.PAIR_NOT_IN_MATCH": "The selected pair isn't playing at this table.",
    "link.error.ROUND_COMPLETED": "The round has since finished.",
    "link.error.TOURNAMENT_FINISHED": "The tournament has finished.",

    /* ─── Why the link ended (409 when sending a result) ───────────────── */
    "link.ended.roundCompleted": "The round has finished — the table link was removed.",
    "link.ended.tournamentFinished": "The tournament has finished — the table link was removed.",
    "link.ended.notApproved": "The table link is no longer approved.",

    /* ═══════════════════════════════════════════════════════════════════
       SCORE PAD HISTORY ON THE PROFILE — `BLOK-HISTORY.md`
       ═══════════════════════════════════════════════════════════════════
       "Reset" closes the series: every game played at the same table is
       saved to the profile as ONE record, then wiped from the device.

       THE WHOLE `reset.*` BLOCK WAS REMOVED 2026-09-08 (BLOK-HISTORY.md §5.6):
       "Reset" and "New game" were two words for the same action, so the
       "Reset" item was dropped and "New game" took over its meaning. Gone:
       `menu.reset`, `reset.title`, `reset.confirm`, `reset.games.*`,
       `reset.confirmSignedIn`, `reset.confirmSignedOut`, `reset.signedOutNote`
       and `reset.saved`; replaced by the `newGame.*` keys at the end of the
       file, which also explain what each one says. */

    /* ═══════════════════════════════════════════════════════════════════
       A SERIES OF GAMES WITHIN ONE SCORE PAD — added 2026-09-08
       ═══════════════════════════════════════════════════════════════════
       The score pad IS a series: games run at the same table, the score goes
       1 : 0, 2 : 1, 3 : 1, and only "Reset" closes it. The series score sits
       in the header as soon as the first game is finished.

       DEFAULT is an open series — no game count ends it. Optionally, the
       "Change target" dialog can say "play to 2" and the series then has an
       end it can declare on its own.

       `series.games` is a countable family (`usePlural()`): 1 game won,
       2-plus games won. `.two` exists for the Slovenian dual; Croatian
       never selects it. */
    // Label above the 501/701/1001 row — since the dialog now carries TWO
    // numbers, each needs its own name or it's unclear which is which.
    // Shortened from "Point target" to "Points" 2026-09-08 (user request):
    // the word "target" left the screen along with the "Target 1001" row.
    "target.points": "Points",
    // `series.title` ("Series") was removed 2026-09-08: the section is now
    // called "Play to" (`series.playTo` at the end of the file). `series.custom`
    // ("Custom number of games") was removed with the field it named — chips
    // are the whole choice (see `TargetDialog`).
    "series.open": "Unlimited",
    "series.games.one": "{n} game won",
    "series.games.two": "{n} games won",
    "series.games.few": "{n} games won",
    "series.games.other": "{n} games won",
    // `series.hintOpen` was removed 2026-09-08 (user request): the sentence
    // explained the "Open" button that sat right above it — the same noise
    // as `rule.dostaHint`/`rule.prolazHint`. Under "Open" there's now
    // nothing below the chips.
    // `badgeTarget` is now an add-on in the header's target row ("Target
    // 1001 · to 2 games won"). `series.score` and `series.scoreAria` were
    // removed 2026-09-08 along with the centered "SERIES 2 : 1" pill — the
    // series score is now two small numbers above the totals
    // (`series.sideAria` at the end).
    "series.badgeTarget": "to {games}",
    "series.running": "Series {usWins} : {themWins}",
    "series.progress": "Series {usWins} : {themWins} — play to {games}",
    "series.won.us": "We won the series",
    "series.won.them": "They won the series",
    "series.finish": "The series is done. \"New game\" saves it and clears the pad for the next one.",

    /* ═══════════════════════════════════════════════════════════════════
       END OF GAME ("cutoff" / "play out") AND "PLAY TO" — added 2026-09-08
       ═══════════════════════════════════════════════════════════════════
       Two things agreed before the first deal, in the same dialog
       ("Change target"), and at two different levels:

       - `rule.*` describes how ONE game ends (to 1001). "Play out" has been
         the DEFAULT since 2026-09-08 (user decision, BLOK-HISTORY.md §5.5):
         the target has to be passed by the side that CALLED that deal and
         MADE IT. "Cutoff" (the game ends the instant someone passes the
         target) is now the alternative choice. `rule.dostaHint` and
         `rule.prolazHint` were removed 2026-09-08 (user request): "play out"
         is a sentence everyone at the table already knows, and the paragraph
         under the chips was explaining it to people who'd just said it.
       - `series.playTo` is the section heading for series length; it
         replaced `series.title` ("Series"), which didn't say what was
         being chosen.

       `series.sideAria` is the accessible name of the small number above one
       side's total — the "SERIES 2 : 1" pill that used to say this is gone,
       so each number now speaks for itself. The number goes through
       `series.games` (`usePlural()`), never as a bare digit in a sentence. */
    "series.playTo": "Play to",
    "series.sideAria": "Series — {side}: {games}",
    // Label above the Play out / Cutoff chips. Used to be "End rule"; now it
    // reads as a sentence the chips complete ("play on play out").
    "rule.title": "Play on",
    "rule.dosta": "Cutoff",
    "rule.prolaz": "Play out",

    /* ═══════════════════════════════════════════════════════════════════
       REVISION 2026-09-08 — SAVING, PLAYED GAMES, SHARING
       BLOK-HISTORY.md §5.1, §5.2, §5.4
       ═══════════════════════════════════════════════════════════════════
       Three changes from the user's own words after using the score pad on
       a phone:

       `newGame.*` — "New game" no longer says something gets "saved to an
       archive", it OFFERS: save the series to the profile then start a new
       game in the same series, or start without saving. A signed-out player
       who picks saving goes to sign in and returns to finish the action;
       "without saving" always works, no account needed. So there's no
       sentence here pushing sign-in — `newGame.signedOutNote` is a statement,
       not an invitation.

       `games.*` — the arrow below the line in the score card and each
       finished game's row. Short labels for controls, not sentences: the
       card is a screen where every pixel holds a number. The list that opens
       reuses the existing `archive.*` keys — they've always talked about
       games in the CURRENT series, which is exactly what the panel shows.

       `share.*` — a LINK to the record (`/blok/z/{token}`) is shared, not
       text with the score, so there's no label with numbers here. The series
       is saved first (same path as §5.1). "Stop sharing" is the only
       irreversible action here, so it goes through `ConfirmDialog` and lives
       in the menu, not next to the button that issues the link. */
    // `newGame.body`, `newGame.saveAndStart`, `newGame.startOnly` and
    // `newGame.saveFailed` were removed 2026-09-08 (§5.6): the three-outcome
    // dialog is gone — "New game" closes the series and is confirmed through
    // `ConfirmDialog`. `newGame.saved` and `newGame.signedOutNote` moved to
    // the end of the file, with the rest of that action's keys.

    "games.show": "Show played games",
    "games.hide": "Hide played games",
    "games.showDeals": "Show this game's deals",
    "games.hideDeals": "Hide this game's deals",

    "share.action": "Share the record",
    // When a link already exists: same button, but it's clear a new one isn't being issued.
    "share.again": "Share the record (link is active)",
    // What's shared is the RECORD, and a record can't hold half a game
    // (§5.6) — so until a game is finished, there's nothing to share.
    "share.nothing": "No finished games to share yet.",
    "share.failed": "The link wasn't issued. Try again.",
    // `share.stop` and `share.confirmStop` were removed 2026-09-08 (user
    // request): the menu item "Stop sharing" was replaced by an "Enable
    // sharing" switch in "Settings" (`share.enable` at the end of the file).
    // Turning the switch off revokes the token, and the confirmation is the
    // "Save" in the dialog itself — so there's no separate confirmation sentence.
    "share.stopped": "Sharing stopped.",
    "share.stopFailed": "Couldn't stop sharing. Try again.",

    /* ═══════════════════════════════════════════════════════════════════
       REVISION 2026-09-08 (second) — "TO 1001 · PLAY OUT"
       BLOK-HISTORY.md §5.5
       ═══════════════════════════════════════════════════════════════════
       The line above the totals no longer says "Target 1001" but "TO 1001",
       and the game-end rule ALWAYS sits next to it — not only when it isn't
       the default. The reason is that the same deals can produce a different
       winner depending on the rule: the line that says what you're playing
       to must also say by what.

       Separate keys `rule.prolazInline`/`rule.dostaInline` keep this summary
       independent of the chip labels in the dialog. */
    "rule.prolazInline": "PLAY OUT",
    "rule.dostaInline": "CUTOFF",

    /* ═══════════════════════════════════════════════════════════════════
       REVISION 2026-09-08 — LINKING MEANS A PUBLIC RECORD
       BLOK-LINK.md §6.2
       ═══════════════════════════════════════════════════════════════════
       Sits in the last step of the dialog, ABOVE the button that sends the
       request, since that's the only point where consent can still be
       withheld. After that this series' record sits next to the match in
       the draw and opens for anyone who gets the link. */
    "link.publicNote":
        "By linking, you agree that this series' record becomes public: the organizer sees it next to the table in the draw, and anyone with the link can open it — even after the tournament.",

    /* ═══════════════════════════════════════════════════════════════════
       REVISION 2026-09-08 (second) — LINKING NO LONGER REQUIRES SIGN-IN
       BLOK-LINK.md §7
       ═══════════════════════════════════════════════════════════════════
       The dialog now opens straight into the tournament picker. The
       sign-in wall is gone, so `link.signInTitle` and `link.signInBody`
       above are left with no caller — deliberately not removed here, since
       "bela" keys are being added to the same file at the same time; removal
       goes in a separate pass.

       Three new things the user sees:
         1. a sentence at the top — this is a tool for tournaments, not for a
            table at home. Without it, the menu item is a promise it can't
            keep;
         2. a name, when there's no account. The organizer approves a
            PERSON, and "someone at some table" isn't a person (§7.1);
         3. what signing in also gets you — a public record and a link in
            the draw (§7.2). Said once, as a bonus, next to a secondary
            action. */
    "link.tournamentsOnly":
        "This is only used at tournaments: the score pad links to a table in the active round and the result goes to the organizer.",
    "link.nameLabel": "Your name",
    "link.namePlaceholder": "First and last name",
    "link.nameHelp": "The organizer approves a person, so they need to see who's requesting the table.",
    "link.nameTooShort": "Enter a name, at least two characters.",
    // The server rejects a request with no signature (400 `NAME_REQUIRED`).
    // The key carries the code in its name because `codeMessage()` looks up
    // a sentence by exactly that code.
    "link.error.NAME_REQUIRED": "Enter a name — the organizer can't approve a request with no signature.",
    "link.signedOutGain":
        "The result reaches the organizer even without signing in. Signing in also gets you a public record of the series, with a link in the draw.",

    /* ═══════════════════════════════════════════════════════════════════
       REVISION 2026-09-08 (third) — THE SCORE PAD OFFERS A TABLE ITSELF
       BLOK-LINK.md §8
       ═══════════════════════════════════════════════════════════════════
       A banner at the top when the server recognizes that a signed-in
       player is sitting at a table in the active round. An offer, not a
       notice — hence "Keep the record?" with two actions, and declining is
       remembered for that match.

       `offer.pairs` names both sides with values — a pair isn't inflected by
       number in a sentence, and tournament pair names are proper names too. */
    "link.offer.title": "You're playing at {tournament}",
    "link.offer.pairs": "{pair} vs {opponent}",
    "link.offer.action": "Keep the record",
    "link.offer.dismiss": "No thanks",

    /* ═══════════════════════════════════════════════════════════════════
       SETTINGS: DEALING AGREEMENTS — 2026-09-08, user request
       BLOK.md §3.3.2
       ═══════════════════════════════════════════════════════════════════
       Two new items in the "Settings" dialog, alongside the point target,
       "play on" and "play to":

         1. "Deals next" switch — the bar above the US/THEM buttons becomes
            optional. The switch's label does NOT get its own key: it's
            carried by `dealer.next`, the same one printed on the bar itself,
            so the setting and what it turns on can't end up with different names;
         2. "Deal direction" — which way dealing moves around the table.

       Direction is named the way it's said at the table ("deals to the
       right"), not by rotation — so `dealer.clockwise`/`dealer.counterclockwise`
       are removed. The same two keys carry both the dialog's chips and the
       middle button in the dealer list — one value, one name. */
    "dealer.direction": "Deal direction",
    /* Who shuffles for the FIRST deal of the NEXT game — BLOK.md §3.3.4.
       Doesn't touch deals WITHIN a game; those still follow
       `dealer.direction`. "Next" = rotation keeps going around the table;
       "Winner" = rotation keeps going the same direction but skips the pair
       that lost. */
    /* Two hints on the game-summary card — the arrow points at what's
       already on screen (the series' games above, behind the chevron; the
       button below). */
    /* Once a team has entered its own name, it's called by that name; US/THEM
       is what an unnamed side falls back to. */
    "winner.named": "{name} won",
    "series.wonNamed": "{name} won the series",
    "summary.reviewGames": "view previous games",
    "summary.startNextGame": "start a new game",
    "summary.startNewSeries": "start a new series",
    "dealer.newGame": "Shuffles the next game",
    "dealer.newGameNext": "Next",
    "dealer.newGameWinner": "Winner",
    "dealer.right": "Right",
    "dealer.left": "Left",

    /* ═══════════════════════════════════════════════════════════════════
       REVISION 2026-09-08 (third) — "NEW GAME" CLOSES THE SERIES
       BLOK-HISTORY.md §5.6, and the "Enable sharing" switch
       ═══════════════════════════════════════════════════════════════════
       User: "New game should reset the score to 0:0 and save the games in
       progress (unless a game isn't finished, in which case it isn't saved)".

       Three labels and three actions, and each has to say which is which:

         `menu.newGame`      menu — CLOSES the series: finished games go to
                             the profile, the series score returns to 0:0,
                             the pad stays empty;
         `winner.nextGame`   summary, below the finished game — the NEXT
                             GAME within the same series, the running 2 : 1
                             continues. Hence "game", not "series": the same
                             word would bring back the confusion this
                             revision removed;
         `menu.delete`       "Delete game" — discards the current game's
                             deals, the series stays. Unchanged.

       The confirmation for "New game" goes through `ConfirmDialog` and has to
       say BOTH: what gets saved and that the series score goes to 0:0. Three
       sentences instead of one with a caveat, because they genuinely differ:
       a signed-in player gets the series saved (`confirmSignedIn`), a
       signed-out one just gets it deleted (`confirmSignedOut`), and when no
       game is finished there's nothing to save (`confirmNothing`) — "series
       (0 games) is being saved…" would be a lie the template would print.
       `confirmUnfinished` is appended as a separate sentence when an
       unfinished current game sits alongside finished ones; the sentences
       join with a space, so nothing is grammatically composed in any language.

       `newGame.games` is a countable family (`usePlural()`): 1 finished
       game, 2-plus finished games. `.two` exists for the Slovenian dual;
       Croatian never selects it.

       `share.enable` is a switch in "Settings" that replaced the menu item
       "Stop sharing" — default ON. Switched off: the share button isn't
       offered, and the token the user issued is revoked.
       `share.linkedNote` is the one exception and prints only while a table
       link exists: that record is opened by the organizer from the draw
       (BLOK-LINK.md §6.2) and stays public regardless of the switch. */
    "winner.nextGame": "Next game",
    "newGame.games.one": "{n} finished game",
    "newGame.games.two": "{n} finished games",
    "newGame.games.few": "{n} finished games",
    "newGame.games.other": "{n} finished games",
    "newGame.confirmSignedIn":
        "Choose whether to save {games} to Score Pad on your profile before starting a new game.",
    "newGame.confirmSignedOut":
        "Sign in to save {games}. You can also continue without saving.",
    "newGame.confirmNothing":
        "No finished games to save. You can start a new game right away.",
    "newGame.confirmUnfinished": "The unfinished game won't be saved.",
    "newGame.saveAndContinue": "Save and continue",
    "newGame.continueWithoutSaving": "Continue without saving",
    "newGame.signedOutNote": "Score pad history is kept only for signed-in players.",
    "newGame.saved": "Your played games have been saved to Score Pad on your profile.",
    "share.enable": "Enable sharing the game by link",
    "share.linkedNote":
        "The linked table's record stays public — the organizer opens it from the draw.",
}
