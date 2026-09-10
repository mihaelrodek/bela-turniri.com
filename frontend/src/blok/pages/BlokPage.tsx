import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Box, Button, HStack, IconButton, Text, VStack } from "@chakra-ui/react"
import { FiArrowRight, FiPlus, FiRotateCcw, FiShare2 } from "react-icons/fi"

import ConfirmDialog from "../../components/ConfirmDialog"
import { CONTENT_STICKY_TOP, NAVBAR_H } from "../../components/navChrome"
import { useAuth } from "../../auth/authContextValue"
import { useDocumentHead } from "../../hooks/useDocumentHead"
import { usePlural, useTranslation } from "../../i18n"
import { showError, showSuccess, toaster } from "../../toaster"
import { linkWriteToken, revokeMyBlokLink } from "../blokLinkApi"
import { blokShareUrl, createBlokShare, revokeBlokShare } from "../blokHistoryApi"
import { ACTION_BAR_BOTTOM, ACTION_BAR_GAP, ACTION_BAR_RESERVE } from "../actionBar"
import { isRecordableGame, useBlok } from "../store"
import { BLOK_SIDES, type BlokRound, type BlokSide } from "../types"
import BelotCelebration from "../components/BelotCelebration"
import BlokHeader from "../components/BlokHeader"
import BlokLinkDialog from "../components/BlokLinkDialog"
import BlokLinkStrip from "../components/BlokLinkStrip"
import BlokLinkSuggestion from "../components/BlokLinkSuggestion"
import BlokMenu, { RenameDialog, TargetDialog } from "../components/BlokMenu"
import BlokSeriesGames from "../components/BlokSeriesGames"
import BlokSummary from "../components/BlokSummary"
import DealerTracker from "../components/DealerTracker"
import RoundEntrySheet from "../components/RoundEntrySheet"
import RoundsList from "../components/RoundsList"
import { saveSessionNow } from "../components/useBlokHistoryUpload"
import { useBlokLiveUpload } from "../components/useBlokLiveUpload"
import { finalizeBlokLink, useBlokLinkSync } from "../components/useBlokLinkSync"
import { sidePalette, useSideNames } from "../components/blokSide"

/* ──────────────────────────────────────────────────────────────────────────
   BlokPage (/blok) — the scorepad's only screen.

   Everything about this page assumes the phone is lying flat on a table next
   to the cards, in a bar, at night, and that the person tapping it is also
   playing. That is the whole rationale for the layout:

     - The two "who called this deal" buttons are pinned to the bottom of the
       viewport on mobile and are the largest targets on screen. Adding a deal
       is the ONLY thing this page is for; it must never require a scroll.
     - Those buttons are `position: fixed` rather than sticky-in-grid. A
       sticky grid item cannot travel, because its grid area is exactly as
       tall as it is — it would simply sit at the end of the list. Fixed costs
       a reserved `pb` on the scroller (below) and buys a bar that is always
       under the thumb. On md+ the bar is gone and the desktop layout puts
       the same buttons in the left column, in flow, where a mouse is.
     - `/blok` hides the mobile tab bar (routing's hidden-list), so this bar
       reaches the viewport bottom itself. The home-indicator safe area and a
       small breathing gap are padding INSIDE its painted surface. Z-index 940
       still sits below the cookie banner (950) and the navbar (1000), the
       ladder the rest of the app already uses.
     - ON A PHONE THE PAGE ITSELF DOES NOT SCROLL — DECISION (2026-09-08),
       user report. The score card used to be `position: sticky` inside a page
       that scrolled as a whole, which on a real phone meant deal rows sliding
       UNDER a translucent card and the end-of-game panel arriving on top of
       the link strip. Sticky is a compromise between "pinned" and "scrolls
       away", and this screen wants neither halfway. So the mobile column is
       given an exact height (`100dvh` minus the chrome above it and minus the
       fixed action bar below it) and made a two-row grid: the score card in
       row one, and a row-two box that is the ONLY scroller on the page
       (`minmax(0, 1fr)` + `minH="0"` + `overflowY="auto"` — a `1fr` track
       whose item has a min-content floor grows instead of scrolling, which is
       the whole trick). `overscroll-behavior: contain` stops a flick at the
       end of the list from dragging the document behind it.

       What is INSIDE that scroller is a deliberate choice, not an accident of
       markup: the deal list and the end-of-game summary scroll together, the
       score card and the link strip stay pinned. The strip is one line and
       lives in the card because a link is a fact about the board; the summary
       is a verdict, an undo, a three-row breakdown and a full-width button —
       roughly a third of a phone screen — and pinning it would leave the deal
       list a couple of rows tall at exactly the moment there is most of it to
       read back. Pinning everything is what the user's screenshot was of.

   The desktop layout is not the phone stretched: on md+ the page becomes two
   columns — a fixed-width scoreboard rail (totals, actions, verdict) beside a
   wide deal history. A 6xl-wide row of two 7xl numbers with a 20-row list
   underneath would be unreadable, and the history is the part that actually
   wants the extra width. There the page scrolls normally and the score card
   goes back to being `position: sticky` at `CONTENT_STICKY_TOP` — a mouse has
   a wheel, a desktop window is tall, and nothing about that layout was broken.

   State: everything comes from `useBlok()` (localStorage, no network, no
   auth). Anything derivable is derived HERE and never stored — see BLOK.md §2
   — which is why the declaration and štiglja tallies below are `useMemo` over
   `game.rounds` rather than fields on the game.
   ────────────────────────────────────────────────────────────────────── */

/** Navbar + the app Container's own `py={6}`, so the mobile column can be
 *  told to fill exactly the space that is left. */
const PAGE_CHROME = `calc(${NAVBAR_H.base}px + 48px + env(safe-area-inset-top, 0px))`

/* The fixed action bar's geometry now lives in `../actionBar` — the active-game
   dock has to clear it too, and two components guessing the same number is how
   they end up on top of each other. */

type EntryState =
    | { mode: "closed" }
    | { mode: "add"; caller: BlokSide }
    | { mode: "edit"; round: BlokRound }

const EMPTY_TALLY: Record<BlokSide, number> = { us: 0, them: 0 }

/* ── FINISHING AN ACTION ON THE OTHER SIDE OF A LOGIN ──────────────────────
   ONE action on this page needs an account: "Podijeli" (BLOK-HISTORY.md §5.2).
   A guest who taps it is sent to `/prijava` — through the app's own mechanism,
   `?next=<same-origin path>`, which `LoginPage` validates with `pickSafeNext`
   and navigates back to — and the intent rides along IN that path as a query
   parameter.

   "Nova igra" is NOT one of them any more (§5.6): it closes the series, and a
   guest's close works locally and says once, quietly, that history is kept for
   signed-in players. Sending somebody to a login screen at the moment they are
   putting their phone away is exactly what that sentence exists instead of.

   Why in the path rather than in localStorage or in router state: the login
   round trip can involve a Google popup, a page reload, a password reset in a
   second tab. The URL is the only carrier that survives all of them and that
   cannot leak into an unrelated visit — and `pickSafeNext` already guarantees
   it is our own path. The value is consumed and stripped on arrival (below),
   so a reload or a back button never fires the action a second time.

   These are internal route vocabulary, not user-facing strings, so they are
   Croatian in code exactly like `/turniri` and `/prijava` are. */
const RESUME_PARAM = "radnja"
const RESUME_SHARE = "podijeli"

export default function BlokPage() {
    const { t } = useTranslation()
    const tp = usePlural()
    const {
        game,
        totals,
        perRound,
        winner,
        seriesWins,
        seriesWinner,
        addRound,
        updateRound,
        removeRound,
        undoLast,
        rename,
        setTarget,
        setSeriesTarget,
        setGameEndRule,
        setDealerSetup,
        setDealDirection,
        setNewGameDealer,
        setShowDealer,
        setShareEnabled,
        newGame,
        discardCurrent,
        archive,
        resetSession,
        pendingSessions,
        rejectedSessions,
        link,
        setLink,
        clearLink,
        share,
        setShare,
    } = useBlok()

    /* Auth touches three things on this page and nothing else: linking to a
       table (BLOK-LINK.md §3.1), saving the series to the profile and sharing
       a link to it (BLOK-HISTORY.md §5.1/§5.2). Everything a blok is FOR —
       typing deals, reading the score, starting the next game — works signed
       out, which is the whole point of it.

       `loading` matters because of the resume-after-login effect below: for a
       frame or two after a real sign-in the SDK has not restored the user yet,
       and acting on `signedIn === false` in that window would silently skip
       the very action the login was for. */
    const { user, loading: authLoading } = useAuth()
    const signedIn = user !== null
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()

    // `game.names` starts empty and a rename can reset it back to empty — an
    // empty name means "use the translated default", so every DISPLAY of a
    // name goes through this, and only the rename dialog sees the raw values.
    const names = useSideNames(game.names)

    useDocumentHead({
        title: t("blok.seo.title"),
        description: t("blok.seo.description"),
        canonical: "https://bela-turniri.com/blok",
    })

    const [entry, setEntry] = useState<EntryState>({ mode: "closed" })
    const [renameOpen, setRenameOpen] = useState(false)
    const [renameFocus, setRenameFocus] = useState<BlokSide>("us")
    const [targetOpen, setTargetOpen] = useState(false)
    const [linkOpen, setLinkOpen] = useState(false)

    /* How much room the fixed action bar actually takes, measured. The bar's
       height is not a constant we control: it holds two localised labels and
       gained a whole second row, and every pixel of error here becomes a
       phantom scroll in the deal list — the list scrolled even with a screen
       to spare, because the reserve below it was bigger than the bar. */
    /* Whether the score card's games panel is open. It lives HERE rather than
       in `BlokHeader` because opening it makes the score card taller, and the
       verdict card below has to give the room back — see `compact` on
       `BlokSummary` (2026-09-09, user request). */
    const [gamesOpen, setGamesOpen] = useState(false)
    const actionBarRef = useRef<HTMLDivElement | null>(null)
    const [barReserve, setBarReserve] = useState<string>(ACTION_BAR_RESERVE)
    useEffect(() => {
        const el = actionBarRef.current
        if (!el || typeof ResizeObserver === "undefined") return
        const apply = () => {
            // The bar's own bottom offset is CSS (safe-area inset + gap), so
            // it stays symbolic; only its height is measured.
            setBarReserve(`calc(${ACTION_BAR_BOTTOM} + ${Math.ceil(el.getBoundingClientRect().height)}px)`)
        }
        apply()
        const observer = new ResizeObserver(apply)
        observer.observe(el)
        return () => observer.disconnect()
    }, [])
    /** A request to the profile is in flight — the save, or the save that a
     *  share has to do first. One flag, because they are never both running:
     *  every entry point checks it before starting. */
    const [busy, setBusy] = useState(false)
    // Read inside async callbacks, where the `busy` closure is a frame old and
    // two fast taps would otherwise both get past the check.
    const busyRef = useRef(false)

    // One slot for whichever destructive action is awaiting a "Potvrdi".
    // Kept as a discriminated union rather than four booleans so two
    // confirmations can never be open at once.
    const [pending, setPending] = useState<
        | { kind: "deleteRound"; round: BlokRound }
        | { kind: "deleteGame" }
        | { kind: "unlink"; uuid: string }
        | { kind: "newGame" }
        | null
    >(null)

    /* The score push (BLOK-LINK.md §3.3, §6.1). What travels is the SERIES
       score — the same "2 : 0" the card shows above the point totals, because
       a tournament match is scored in games — read one layer above the store,
       so nothing in the deal path can ever wait on it. A deal is saved and
       painted, and only then does this notice a game was won. With no approved
       link it starts no timers and opens no sockets. */
    useBlokLinkSync({
        link,
        seriesWins,
        seriesDecided: seriesWinner !== null,
        sessionId: game.sessionId,
        // NOT a switch that silences the hook any more (BLOK-LINK.md §7): a
        // link can be made and driven with no account, and what keeps a
        // kitchen-table blok off the network is simply having no link. Sign-in
        // still decides the two things it is genuinely needed for — saving the
        // series to the profile, and reading status through `/blok-links/mine`.
        signedIn,
    })

    /* The history upload is NOT mounted here any more — `src/blok/BlokOutbox.tsx`
       runs it app-wide (wired in `App.tsx`), because "retry when the blok is
       next opened" is the wrong trigger for a queue whose whole purpose is to
       survive evenings offline: the network returning and the account signing
       in both happen somewhere else in the app. This page only READS the queue
       now, to say how many series are waiting (`pendingSessions` /
       `rejectedSessions` below). Two mounts would be worse than one — see that
       file. */

    /* Keeping the shared record CURRENT (BLOK-HISTORY.md §5.7). The record used
       to move twice — at "Nova igra" and, for a linked table, once a game — so
       anyone reading `/blok/z/{token}` was watching a snapshot. While somebody
       could be reading, every change goes up, debounced.

       "Could be reading" is: a live share token, or an approved table link
       (whose organiser reads the very same record under the same token —
       BLOK-LINK.md §6.2). Plus an account, because the endpoint writes to a
       profile. With none of that this hook is inert and the blok makes exactly
       as many requests as it did before: none. */
    useBlokLiveUpload({
        game,
        archive,
        enabled: signedIn && (share?.token != null || link?.status === "APPROVED"),
    })

    /* Derived tallies — never stored (BLOK.md §2). */
    const declarations = useMemo(() => {
        const acc: Record<BlokSide, number> = { ...EMPTY_TALLY }
        for (const round of game.rounds) {
            for (const side of BLOK_SIDES) {
                acc[side] += (round.declarations?.[side] ?? []).reduce((a, b) => a + b, 0)
            }
        }
        return acc
    }, [game.rounds])

    const stiglje = useMemo(() => {
        const acc: Record<BlokSide, number> = { ...EMPTY_TALLY }
        for (const round of game.rounds) {
            if (round.stiglja) acc[round.stiglja] += 1
        }
        return acc
    }, [game.rounds])

    /* What closing this series would actually file — the number "Nova igra"
       has to name, because a promise the player cannot check is not a
       confirmation (§5.6).

       `filedGames` counts only games with a WINNER, through the very predicate
       the payload builder uses, so the sentence and the upload can never
       disagree. `unfinishedCurrent` is the other half of the same truth: a
       game being played right now is thrown away rather than filed, and that
       has to be said before the tap, not discovered afterwards. */
    const filedGames = useMemo(() => {
        let count = isRecordableGame(game) ? 1 : 0
        for (const archived of archive) {
            if (archived.sessionId === game.sessionId && isRecordableGame(archived)) count += 1
        }
        return count
        // `game` whole, not `game.rounds.length` + `game.sessionId`: the
        // predicate reads the deals, the target and the end rule, and an edit
        // to any of them can move this number.
    }, [game, archive])

    const unfinishedCurrent = game.rounds.length > 0 && !isRecordableGame(game)

    /* Enabled whenever there is anything at all to close — including a game
       still in progress, which "Nova igra" discards. On a pad with nothing on
       it the item would only mint a new session id, which is not a thing
       anybody asked for. */
    const canNewGame = filedGames > 0 || unfinishedCurrent

    /* The FINISHED games of this series, oldest first — what the chevron under
       the divider opens (§5.4). Filtered by `sessionId` on purpose: the archive
       can still hold games of a previous series that is waiting to upload, and
       those belong to a different evening. The game in progress is deliberately
       absent — it is the scoreboard directly above this panel. */
    const seriesGames = useMemo(
        () =>
            archive
                .filter((g) => g.sessionId === game.sessionId && g.rounds.length > 0)
                .sort((a, b) => a.createdAt - b.createdAt),
        [archive, game.sessionId],
    )

    /* As soon as a game is won, its deals leave the active list and appear
       behind the score card's history chevron. The game remains current in
       storage until "Sljedeća partija", which keeps undo exact: correcting
       the deciding deal simply makes it active again. */
    const visibleSeriesGames = useMemo(
        () => winner ? [...seriesGames, game] : seriesGames,
        [seriesGames, winner, game],
    )

    const openAdd = useCallback((caller: BlokSide) => {
        setEntry({ mode: "add", caller })
    }, [])

    /* The belot burst (BLOK.md §1.2). Fired on SAVE, not on the tap that
       selects the belot: until Spremi nothing has happened yet — the sheet
       writes nothing before it, and Odustani is one tap away — and a burst
       over a deal that was then cancelled would be celebrating a game that is
       still being played. `BelotCelebration` itself is what decides whether
       there is any motion at all (reduced motion renders nothing). */
    const [celebrateBelot, setCelebrateBelot] = useState(false)
    const stopCelebrating = useCallback(() => setCelebrateBelot(false), [])

    const onEntrySave = useCallback(
        (round: Omit<BlokRound, "id">) => {
            if (entry.mode === "edit") updateRound(entry.round.id, round)
            else addRound(round)
            setEntry({ mode: "closed" })
            // An edit that ADDS a belot celebrates too: the game has just been
            // won, whichever way the deal got there.
            if (round.belot !== null) setCelebrateBelot(true)
        },
        [entry, addRound, updateRound],
    )

    /* Delete-from-inside-the-sheet: the long press that deletes a row from
       `RoundsList` has no keyboard or screen-reader equivalent, so this is
       what makes deletion reachable at all without a pointer.

       `onDelete` means "the user has ALREADY confirmed" — `RoundEntrySheet`
       holds its own `ConfirmDialog` and only calls back after it (BLOK.md
       §3.2, ISPRAVAK). So this deletes straight away. Staging the page's own
       `deleteRound` confirmation here asked twice, and the second prompt's
       "Odustani" cancelled the DELETE while the sheet was already gone —
       which read as the delete having silently failed. The page-level
       confirmation still exists for the deal list's long press, where there
       is no sheet to hold a dialog. */
    const onEntryDelete = useCallback(() => {
        if (entry.mode !== "edit") return
        removeRound(entry.round.id)
        setEntry({ mode: "closed" })
    }, [entry, removeRound])

    /* Breaking a link is two things that must not be conflated: telling the
       server (so the organiser stops seeing an approved phone that is gone)
       and forgetting it locally. The local half runs unconditionally —
       `revokeMyBlokLink` silences 404/409 because both mean "already gone",
       and a network failure must not leave the player stuck with a strip they
       cannot dismiss. The server half is fire-and-forget for the same reason. */
    const unlink = useCallback(
        (uuid: string) => {
            // The write token goes with it when there is one: with no account
            // it is the only thing that identifies this phone as the one that
            // asked (BLOK-LINK.md §7.1), and without it the server would have
            // to refuse — leaving the organiser looking at an approved table
            // whose phone has walked away.
            const token = link !== null && link.uuid === uuid ? linkWriteToken(link) : null
            void revokeMyBlokLink(uuid, token).catch(() => { /* already gone, or offline */ })
            clearLink()
        },
        [link, clearLink],
    )

    /* ── SIGN-IN, AND COMING BACK TO FINISH ───────────────────────────────
       The app's own handoff, not a private one: `/prijava?next=<path>`, which
       `RequireAuth` and the axios 401 interceptor both emit and which
       `LoginPage` validates through `pickSafeNext` before navigating back. The
       only thing added here is the action, carried inside that same path. */
    const goSignIn = useCallback(
        (action: string) => {
            navigate(`/prijava?next=${encodeURIComponent(`/blok?${RESUME_PARAM}=${action}`)}`)
        },
        [navigate],
    )

    /* Hand a URL to the OS share sheet where there is one — that is the phone
       lying on the table — and to the clipboard everywhere else. What is shared
       is a LINK now, not a line of text (§5.2): a scoreline pasted into a chat
       is a dead number, while `/blok/z/{token}` opens the whole logbook, deals
       and declarations and all, for somebody who was not at the table. */
    const shareUrl = useCallback(
        async (url: string) => {
            // `navigator.share` is not in every DOM lib build — narrow through a
            // minimal local shape instead of casting to `any` (same trick as
            // pages/tournament/ShareActions.tsx).
            const nav =
                typeof navigator !== "undefined"
                    ? (navigator as Navigator & {
                        share?: (d: { title: string; url: string }) => Promise<void>
                    })
                    : null
            if (nav?.share) {
                try {
                    await nav.share({ title: t("blok.title"), url })
                } catch {
                    /* user dismissed the sheet — not an error */
                }
                return
            }
            try {
                await navigator.clipboard.writeText(url)
                showSuccess(t("common.clipboard.copied"))
            } catch {
                showError(t("common.clipboard.copyFailed"))
            }
        },
        [t],
    )

    /* ── "Podijeli" — §5.2 ────────────────────────────────────────────────
       Save, then token, then the share sheet. The save is not optional: a link
       to a record that does not exist yet is a 404, and the whole point of the
       link is that it shows what is on the pad right now.

       The token is asked for separately from the record's `uuid` and is never
       derived from it: records exist without their owner ever agreeing to
       publish them, so guessing a `uuid` must reveal nothing. If the save
       already carried a token back, that one is used and no second request is
       made. */
    const shareSeries = useCallback(async () => {
        if (busyRef.current) return
        busyRef.current = true
        setBusy(true)
        try {
            const record = await saveSessionNow(game.sessionId)
            if (record === null) {
                toaster.create({
                    id: "blok-share-empty",
                    type: "info",
                    title: t("blok.share.nothing"),
                    duration: 4000,
                })
                return
            }
            const token = record.shareToken ?? (await createBlokShare(record.uuid))
            if (token === null) {
                showError(t("blok.share.failed"))
                return
            }
            setShare({ sessionId: game.sessionId, uuid: record.uuid, token })
            await shareUrl(blokShareUrl(token))
        } catch {
            showError(t("blok.share.failed"))
        } finally {
            busyRef.current = false
            setBusy(false)
        }
    }, [game.sessionId, setShare, shareUrl, t])

    /**
     * Stop sharing: the token dies, the record on the profile does not.
     *
     * Reached only by turning "Omogući dijeljenje" OFF in "Postavke" (§3.3.3);
     * the menu item this used to hang off is gone. The caller is what enforces
     * the exception — a LINKED series is published for the organiser under this
     * same token (BLOK-LINK.md §6.2) and is never revoked here.
     */
    const unshare = useCallback(async () => {
        if (share === null) return
        try {
            await revokeBlokShare(share.uuid)
        } catch {
            showError(t("blok.share.stopFailed"))
            return
        }
        // The uuid is KEPT: the record is still there and still savable — only
        // the public door closed.
        setShare({ ...share, token: null })
        showSuccess(t("blok.share.stopped"))
    }, [share, setShare, t])

    /* A guest gets sent to sign in and comes back to the same tap. */
    const onShareTap = useCallback(() => {
        if (!signedIn) {
            goSignIn(RESUME_SHARE)
            return
        }
        void shareSeries()
    }, [signedIn, goSignIn, shareSeries])

    /* ── Back from the login page ─────────────────────────────────────────
       The parameter is consumed exactly once and stripped from the URL in the
       same pass — before the action runs, so a reload mid-upload cannot fire a
       second one — and `replace` keeps it out of the back stack. A guest who
       lands here with the parameter (they cancelled the sign-in) simply gets a
       clean `/blok`: no toast, no nagging, which is the rule for everything
       account-shaped in this screen. */
    const resumedRef = useRef(false)
    useEffect(() => {
        if (authLoading || resumedRef.current) return
        const action = searchParams.get(RESUME_PARAM)
        if (action === null) return
        resumedRef.current = true
        navigate("/blok", { replace: true })
        if (!signedIn) return
        if (action === RESUME_SHARE) void shareSeries()
    }, [authLoading, signedIn, searchParams, navigate, shareSeries])

    /* ── "NOVA IGRA" — it CLOSES the series (BLOK-HISTORY.md §2.2, §5.6) ───
       Three lines, and the shape of them is the feature:

         - the local close runs FIRST and unconditionally. It is one
           localStorage write; the screen is empty in the same frame whether
           the phone is on Wi-Fi, on a dying 3G cell, or in a cellar. Nothing
           here is awaited, because a scorepad that waits on a server to clear
           itself is not the scorepad this app promised.
         - `signedIn` decides only whether the series is KEPT for upload. For a
           guest nothing is kept, nothing is queued and not one request leaves
           the device — the one quiet line below is the whole difference, and
           it is a statement, not a login prompt: BLOK.md's "works without an
           account" is not something to nag about at the moment somebody is
           putting their phone away.
         - a game that was never won goes in the bin with everything else, and
           the confirmation said so before this ran (§5.6, `resetSession`).

       The upload itself belongs to `useBlokHistoryUpload`, mounted app-wide by
       `BlokOutbox`, which sees the new `pendingSessions` entry on the very next
       render — this page is a subscriber to the same module store, so that is
       true whether or not the player stays on /blok. A failure there deletes
       nothing and retries; that is why the local half can be unconditional.

       The one thing that has to happen BEFORE the close is the final score
       (BLOK-LINK.md §6.1): closing the series is one of the two ways a linked
       match becomes final, and the same write that closes it drops the link, so
       afterwards there is nothing left to send from. `finalizeBlokLink` is
       fire-and-forget and no-ops when there is no approved link, so the close
       itself is as instantaneous offline as it ever was. */
    const onCloseSeries = useCallback(() => {
        finalizeBlokLink(link, seriesWins, game.sessionId, signedIn)
        resetSession(signedIn)
        if (!signedIn) {
            toaster.create({
                // A stable id so a second close refreshes the same toast
                // instead of stacking another copy of the same sentence.
                id: "blok-history-signed-out",
                type: "info",
                title: t("blok.newGame.signedOutNote"),
                duration: 5000,
            })
        }
    }, [link, seriesWins, game.sessionId, resetSession, signedIn, t])

    const confirmPending = useCallback(() => {
        if (!pending) return
        switch (pending.kind) {
            case "deleteRound":
                removeRound(pending.round.id)
                break
            case "deleteGame":
                // Not `newGame()`: that one ARCHIVES, which is the opposite of
                // what "obriši igru" promises. One write, names and target kept.
                discardCurrent()
                break
            case "unlink":
                unlink(pending.uuid)
                break
            case "newGame":
                onCloseSeries()
                break
        }
        setPending(null)
    }, [pending, removeRound, discardCurrent, unlink, onCloseSeries])

    const confirmCopy = useMemo(() => {
        switch (pending?.kind) {
            case "deleteRound":
                return { title: t("blok.round.delete"), body: t("blok.confirm.deleteRound") }
            case "deleteGame":
                return { title: t("blok.menu.delete"), body: t("blok.confirm.deleteGame") }
            case "unlink":
                return { title: t("blok.link.unlink"), body: t("blok.link.confirmUnlink") }
            case "newGame": {
                /* WHAT IS SAVED, AND THAT THE SERIES GOES BACK TO 0:0 — both
                   said plainly, because both are what the tap does (§5.6).

                   Three sentences rather than one that hedges. Nothing to file
                   is its own case: "serija (0 igara) sprema se…" would be a
                   lie told by a template. Signed in versus guest is a real
                   difference, not a nuance — one files, the other only clears.
                   And the unfinished game is a fourth fact appended only when
                   it exists, which is why it is a sentence of its own rather
                   than a clause welded into the other three: joining two whole
                   translated sentences with a space builds no grammar in
                   either language, while a clause would have. The count goes
                   through the plural family — Slovenian has a dual, so "2 igri"
                   and "5 iger" are different words. */
                const body =
                    filedGames === 0
                        ? t("blok.newGame.confirmNothing")
                        : t(
                            signedIn
                                ? "blok.newGame.confirmSignedIn"
                                : "blok.newGame.confirmSignedOut",
                            { games: tp("blok.newGame.games", filedGames) },
                        ) + (unfinishedCurrent ? ` ${t("blok.newGame.confirmUnfinished")}` : "")
                return { title: t("blok.menu.newGame"), body }
            }
            default:
                return { title: "", body: "" }
        }
    }, [pending, t, tp, signedIn, filedGames, unfinishedCurrent])

    /* The two big buttons carry the side NAMES, and a renamed side is the
       whole reason anyone renames one — "Perhaj i G…" defeats the feature.
       So the label wraps to a second line and the type steps down once the
       longer of the two names gets long — the same idea as `BlokHeader`'s
       name label, stepped on the same number but with sizes of its own,
       because these buttons are much wider than a header column. A single
       word too long even for two lines breaks and then clamps with an
       ellipsis; the full name is still spoken (`aria-label`) and still in the
       tooltip. */
    const nameLength = Math.max(names.us.length, names.them.length)
    const actionFontSize =
        nameLength > 18
            ? { base: "sm", md: "xs" }
            : nameLength > 11
                ? { base: "md", md: "sm" }
                : { base: "lg", md: "md" }

    const actionBar = (
        <VStack gap="2" w="100%">
            {/* Optional since 2026-09-08 (BLOK.md §3.3.2), ON by default. The
                bar's height is MEASURED (see `barReserve` above), so dropping
                the strip shrinks the reserve under the deal list by itself —
                there is no constant here to keep in step. */}
            {game.showDealer ? (
                <DealerTracker
                    setup={game.dealer}
                    direction={game.dealDirection}
                    roundCount={game.rounds.length}
                    onChange={setDealerSetup}
                    onDirectionChange={setDealDirection}
                />
            ) : null}
            {/* WHEN THE GAME IS WON THE BAR CHANGES WHAT IT OFFERS
                (2026-09-09, user request).

                MI / VI type the next deal, and once a side has won there is no
                next deal to type — the two things anybody wants are "go back"
                and "go on". They take the same two boxes, in the same two
                places, so the thumb does not have to move: undo where MI was,
                the next game where VI was. It is also what finally makes the
                arrow under the summary point at something. */}
            {winner ? (
                <HStack gap={{ base: "2.5", md: "3" }} w="100%">
                    <Button
                        flex="1"
                        minW="0"
                        size="lg"
                        h={{ base: "3.5rem", md: "3.25rem" }}
                        px={{ base: "2", md: "3" }}
                        fontSize={actionFontSize}
                        fontWeight="bold"
                        lineHeight="1.15"
                        whiteSpace="normal"
                        variant="outline"
                        colorPalette="gray"
                        /* Spelled out rather than left to the recipe
                           (2026-09-09, reported): on the light theme the grey
                           outline all but vanished against the page and the
                           button read as loose text beside a solid one. A
                           panel fill and an explicit border make it a box in
                           both themes. */
                        bg="bg.panel"
                        borderColor="border.emphasized"
                        disabled={game.rounds.length === 0}
                        onClick={undoLast}
                    >
                        <FiRotateCcw />
                        <Box as="span" minW="0" textAlign="center" wordBreak="break-word" lineClamp={2}>
                            {t("blok.round.undoLast")}
                        </Box>
                    </Button>
                    <Button
                        flex="1"
                        minW="0"
                        size="lg"
                        h={{ base: "3.5rem", md: "3.25rem" }}
                        px={{ base: "2", md: "3" }}
                        fontSize={actionFontSize}
                        fontWeight="bold"
                        lineHeight="1.15"
                        whiteSpace="normal"
                        colorPalette="brand"
                        onClick={seriesWinner !== null ? () => setPending({ kind: "newGame" }) : newGame}
                    >
                        <Box as="span" minW="0" textAlign="center" wordBreak="break-word" lineClamp={2}>
                            {t(seriesWinner !== null ? "blok.menu.newGame" : "blok.winner.nextGame")}
                        </Box>
                        <FiArrowRight />
                    </Button>
                </HStack>
            ) : (
            <HStack gap={{ base: "2.5", md: "3" }} w="100%">
                {BLOK_SIDES.map((side) => (
                    <Button
                    key={side}
                    flex="1"
                    minW="0"
                    size="lg"
                    h={{ base: "3.5rem", md: "3.25rem" }}
                    px={{ base: "2", md: "3" }}
                    fontSize={actionFontSize}
                    fontWeight="bold"
                    lineHeight="1.15"
                    // The button recipe is `white-space: nowrap`; without this
                    // the label below can never take a second line.
                    whiteSpace="normal"
                    colorPalette={sidePalette(side)}
                    onClick={() => openAdd(side)}
                    // The face of the button is just the side's name; what it
                    // MEANS is "this side called the next deal", which is the
                    // one fact the two words on it cannot carry on their own.
                    aria-label={t("blok.round.addFor", { side: names[side] })}
                    title={t("blok.round.calledBy", { side: names[side] })}
                >
                    <Box
                        as="span"
                        minW="0"
                        textAlign="center"
                        wordBreak="break-word"
                        lineClamp={2}
                    >
                        {names[side]}
                    </Box>
                    <FiPlus />
                    </Button>
                ))}
            </HStack>
            )}
        </VStack>
    )

    return (
        <>
            <Box
                display="grid"
                gap={{ base: "3", md: "5" }}
                // Base STRETCHES: the scroller is a `1fr` row and has to fill
                // it. `start` would collapse the row back to its content and
                // there would be nothing to scroll inside.
                alignItems={{ base: "stretch", md: "start" }}
                gridTemplateColumns={{ base: "1fr", md: "minmax(0, 23rem) minmax(0, 1fr)" }}
                // Mobile: two rows — the fixed score card, then everything
                // that scrolls. `minmax(0, 1fr)` (not plain `1fr`) is what
                // lets that row be SHORTER than its content, which is the
                // precondition for the box inside it to scroll at all.
                // Desktop keeps the scoreboard, the buttons and the verdict
                // together in the left rail, because there the history is a
                // column of its own rather than the thing you scroll past.
                /* On md the verdict sits BETWEEN the score and the controls
                   (2026-09-09, user request). It used to come after them, and
                   with the buttons now in the action bar its two arrows —
                   "prethodne partije" up at the score card, "započni novu
                   igru" down at the controls — both pointed the wrong way. */
                gridTemplateAreas={{
                    base: `"head" "list"`,
                    md: `"head list" "summary list" "actions list"`,
                }}
                gridTemplateRows={{ base: "auto minmax(0, 1fr)", md: "none" }}
                // EXACT height on a phone, not a minimum: the page must not
                // scroll, only the box inside it. `pb` is inside that height
                // (border-box), so it reserves the fixed action bar's strip
                // at the bottom exactly as it did before.
                h={{ base: `calc(100dvh - ${PAGE_CHROME})`, md: "auto" }}
                /* MEASURED, not assumed. `ACTION_BAR_RESERVE` is a constant
                   guess at the bar's height, and the bar has since grown a
                   second row ("Sljedeći dijeli"), so the guess was too small
                   one day and too big the next — and either way the deal list
                   scrolled by exactly the difference even when everything fit
                   on screen. `barReserve` is the bar's real height plus its
                   offset, updated by a ResizeObserver, with the constant kept
                   only as the value used for the first paint. */
                pb={{ base: barReserve, md: "0" }}
            >
                {/* The score stays under the navbar even if mobile Safari
                    scrolls the document chrome in addition to the intended
                    inner list. The fixed-height mobile grid already keeps it
                    out of that list's scroll flow; sticky also covers the
                    outer document scroll seen on real devices. */}
                <Box
                    gridArea="head"
                    position="sticky"
                    top={CONTENT_STICKY_TOP}
                    zIndex={5}
                >
                    <BlokHeader
                        names={names}
                        totals={totals}
                        target={game.target}
                        seriesTarget={game.seriesTarget}
                        gameEndRule={game.gameEndRule}
                        seriesWins={seriesWins}
                        onRename={(side) => {
                            setRenameFocus(side)
                            setRenameOpen(true)
                        }}
                        /* Top-LEFT, opposite the menu (§5.2). Painted in the
                           brand palette once a link exists, so "is this shared"
                           is answerable at a glance instead of by tapping —
                           and the title says which state it is in, because
                           colour alone must never be the carrier.

                           Offered only while "Omogući dijeljenje" is on
                           (§3.3.3). Off, the corner is simply empty — the card
                           draws nothing at all for an absent slot — rather than
                           holding a disabled button that advertises a feature
                           by refusing it. */
                        share={
                            game.shareEnabled ? (
                                <IconButton
                                    aria-label={t(share?.token ? "blok.share.again" : "blok.share.action")}
                                    title={t(share?.token ? "blok.share.again" : "blok.share.action")}
                                    size="sm"
                                    variant="ghost"
                                    rounded="full"
                                    colorPalette={share?.token ? "brand" : undefined}
                                    color={share?.token ? "brand.fg" : undefined}
                                    loading={busy}
                                    onClick={onShareTap}
                                >
                                    <FiShare2 />
                                </IconButton>
                            ) : null
                        }
                        /* The chevron exists only when there is something
                           behind it: on the first game of a series there are no
                           finished games and a control pointing at an empty
                           panel is worse than no control. */
                        openGames={gamesOpen}
                        onGamesOpenChange={setGamesOpen}
                        games={
                            visibleSeriesGames.length > 0 ? (
                                <BlokSeriesGames games={visibleSeriesGames} />
                            ) : null
                        }
                        strip={
                            link ? (
                                <BlokLinkStrip
                                    link={link}
                                    usName={names.us}
                                    themName={names.them}
                                    onUnlink={() => setPending({ kind: "unlink", uuid: link.uuid })}
                                    // A dead link has nothing left to lose, so
                                    // dismissing it needs no confirmation.
                                    onDismiss={clearLink}
                                />
                            ) : (
                                /* No link — then, and only then, the blok may
                                   offer the table the player is already sitting
                                   at (BLOK-LINK.md §8). It renders nothing
                                   whenever the offer does not apply, which is
                                   almost always, and makes no request at all
                                   without an account. */
                                <BlokLinkSuggestion
                                    signedIn={signedIn}
                                    sessionId={game.sessionId}
                                    onLinked={setLink}
                                />
                            )
                        }
                        menu={
                            <BlokMenu
                                canDelete={game.rounds.length > 0}
                                canLink={link === null || link.status === "REJECTED" || link.status === "REVOKED"}
                                onLink={() => setLinkOpen(true)}
                                canNewGame={canNewGame}
                                onNewGame={() => setPending({ kind: "newGame" })}
                                onTarget={() => setTargetOpen(true)}
                                onDelete={() => setPending({ kind: "deleteGame" })}
                            />
                        }
                    />
                </Box>

                {/* THE ONLY SCROLLER ON A PHONE.
                    On base this is the "list" row: a flex column holding the
                    deals and, once a game is over, the summary under them —
                    BLOK.md §3.1's order, and both of them scroll together
                    (see the file header for why the summary is not pinned).
                    On md+ it becomes `display: contents`, which dissolves the
                    wrapper entirely so its two children go back to being
                    direct items of the page grid and land in their own
                    "list" / "summary" areas. One render tree, two layouts, no
                    duplicated markup. */}
                <Box
                    gridArea="list"
                    minW="0"
                    display={{ base: "flex", md: "contents" }}
                    flexDirection="column"
                    gap="3"
                    minH="0"
                    overflowY="auto"
                    overflowX="hidden"
                    // A flick past the end of the deals must not start
                    // dragging the document (or the PWA's pull-to-refresh)
                    // behind it.
                    overscrollBehavior="contain"
                >
                    {/* `flexShrink="0"` so the two of them stack to their full
                        height and the wrapper scrolls, instead of the flex
                        column squeezing them to fit. A no-op on md, where
                        these are grid items. */}
                    <Box gridArea="list" minW="0" flexShrink="0">
                        {/* THE OUTBOX, SAID ONCE AND QUIETLY.

                            Two facts, at most two lines, at the top of the deal
                            list — where the eye already is and where nothing
                            has to move to make room. Not a toast: a toast is an
                            event, and "still waiting" is a state that can last
                            three days; not a banner either, because the thing
                            it describes needs no decision from anybody.

                            It lives HERE rather than in `BlokSeriesGames` (its
                            old home), which is behind the chevron AND only
                            rendered once the series has a finished game — so
                            immediately after "Nova igra", the one moment the
                            queue is guaranteed to be full, the line could not
                            be seen at all.

                            The second line is the one nobody wants to write:
                            the server refused those series for good, they are
                            not being retried, and their games are still on this
                            phone. Saying so is the alternative to a spinner
                            that never ends or an evening that quietly
                            evaporates. */}
                        {pendingSessions.length > 0 ? (
                            <Text fontSize="2xs" color="fg.muted" mb="2">
                                {tp("blok.archive.pending", pendingSessions.length)}
                            </Text>
                        ) : null}
                        {rejectedSessions.length > 0 ? (
                            <Text fontSize="2xs" color="orange.fg" mb="2">
                                {tp("blok.archive.rejected", rejectedSessions.length)}
                            </Text>
                        ) : null}
                        {!winner ? (
                            <RoundsList
                                rounds={game.rounds}
                                outcomes={perRound}
                                names={names}
                                target={game.target}
                                onEdit={(round) => setEntry({ mode: "edit", round })}
                                onDelete={(round) => setPending({ kind: "deleteRound", round })}
                            />
                        ) : null}
                    </Box>

                    {winner ? (
                        /* THE CARD FILLS WHAT IS LEFT (2026-09-09, user
                           request). Content-sized, it ended halfway up the
                           screen with a field of empty page under it, and the
                           "započni novu igru" arrow pointed into that nothing
                           instead of at the buttons in the bar. `flex="1"`
                           here plus `h="100%"` inside stretches it to the
                           floor of the scroller — which is exactly where the
                           action bar begins — so the arrow lands on the thing
                           it names and nothing has to scroll to see it.
                           `minH="0"` keeps the flex child able to shrink on a
                           short phone rather than forcing the scrollbar back. */
                        <Box gridArea="summary" flex="1" minH="0" display="flex">
                            <BlokSummary
                                winner={winner}
                                names={names}
                                totals={totals}
                                declarations={declarations}
                                stiglje={stiglje}
                                seriesWinner={seriesWinner}
                                /* The score card above just grew by three
                                   rows; this gives the height back so the
                                   whole screen still fits without scrolling. */
                                compact={gamesOpen}
                                /* The same list the score card's chevron
                                   opens, so the arrow can only point up at
                                   something that is actually there. */
                                reviewableGames={visibleSeriesGames.length}
                            />
                        </Box>
                    ) : null}
                </Box>

                {/* Desktop: the same buttons, in flow, in the scoreboard rail.
                    Hidden on base, where the fixed bar below takes over. */}
                <Box gridArea="actions" display={{ base: "none", md: "block" }}>
                    {actionBar}
                </Box>
            </Box>

            {/* Mobile: the painted surface reaches the screen edge. Its
                internal bottom padding clears the home indicator and keeps
                the controls at the same comfortable height. */}
            <Box
                display={{ base: "block", md: "none" }}
                ref={actionBarRef}
                position="fixed"
                left="0"
                right="0"
                bottom={ACTION_BAR_BOTTOM}
                zIndex={940}
                layerStyle="glass.bar"
                borderTopWidth="1px"
                borderColor="border.glass"
                boxShadow="sticky"
                px="3"
                pt="2.5"
                css={{
                    paddingBottom: `calc(var(--chakra-spacing-3) + ${ACTION_BAR_GAP} + env(safe-area-inset-bottom, 0px))`,
                }}
            >
                {actionBar}
            </Box>

            <BelotCelebration open={celebrateBelot} onDone={stopCelebrating} />

            <RoundEntrySheet
                open={entry.mode !== "closed"}
                caller={entry.mode === "edit" ? entry.round.caller : entry.mode === "add" ? entry.caller : "us"}
                names={game.names}
                // A belot is worth THIS game's target, so the sheet has to know
                // it to draw the Σ it is about to save (BLOK.md §1.2).
                target={game.target}
                initial={entry.mode === "edit" ? entry.round : null}
                onCancel={() => setEntry({ mode: "closed" })}
                onSave={onEntrySave}
                // Only when editing an existing deal — adding one has nothing
                // to delete yet.
                onDelete={entry.mode === "edit" ? onEntryDelete : undefined}
            />

            <RenameDialog
                open={renameOpen}
                names={game.names}
                focusSide={renameFocus}
                onCancel={() => setRenameOpen(false)}
                onSave={(next) => {
                    for (const side of BLOK_SIDES) {
                        if (next[side] !== game.names[side]) rename(side, next[side])
                    }
                    setRenameOpen(false)
                }}
            />

            {/* One dialog, six settings: the points target, how a single game
                ends ("dosta" / "prolaz"), how many won games take the series,
                whether the "Sljedeći dijeli" strip shows, which way the deal
                goes round the table, and whether this blok offers sharing at
                all. All six are written on the CURRENT game, and all six are
                then inherited by every following game of the session — see
                `store.ts`. */}
            <TargetDialog
                open={targetOpen}
                target={game.target}
                seriesTarget={game.seriesTarget}
                gameEndRule={game.gameEndRule}
                showDealer={game.showDealer}
                newGameDealer={game.newGameDealer}
                dealDirection={game.dealDirection}
                shareEnabled={game.shareEnabled}
                // Drives one sentence only: the record of a linked table stays
                // public whatever the switch says (BLOK-LINK.md §6.2).
                linked={link !== null}
                onClose={() => setTargetOpen(false)}
                /* SAVED ON THE TAP, not on a button (2026-09-09, user
                   request). The dialog has no "Spremi": every control writes
                   through here the moment it is touched, and the X is only a
                   way out of a screen whose work is already done.

                   That is safe here because the blok's store IS the save —
                   `localStorage`, synchronously, with no network in the path.
                   A phone with no signal keeps every setting; the series is
                   pushed to the profile later by the outbox
                   (`useBlokHistoryUpload`) and to a linked table by
                   `useBlokLinkSync`, exactly as the deals already are. */
                onChange={(next) => {
                    if (next.target !== undefined) setTarget(next.target)
                    if (next.seriesTarget !== undefined) setSeriesTarget(next.seriesTarget)
                    if (next.gameEndRule !== undefined) setGameEndRule(next.gameEndRule)
                    if (next.showDealer !== undefined) setShowDealer(next.showDealer)
                    // Through the store rather than as a plain field write: it
                    // is the one setting here whose change can move something
                    // else (who deals now), and `setDealDirection` is where
                    // that decision lives — BLOK.md §3.3.2.
                    if (next.dealDirection !== undefined) setDealDirection(next.dealDirection)
                    // Only read when the NEXT game is built, so unlike the
                    // direction it has no sequence to re-derive here.
                    if (next.newGameDealer !== undefined) setNewGameDealer(next.newGameDealer)
                    if (next.shareEnabled !== undefined) {
                        setShareEnabled(next.shareEnabled)
                        /* TURNING SHARING OFF REVOKES THE TOKEN — with ONE
                           exception, and it is the whole reason this is a
                           condition rather than a line (§3.3.3).

                           A series linked to a tournament table is published
                           for the organiser under this very token
                           (BLOK-LINK.md §6.2): the bracket's "vidi zapisnik"
                           is `/blok/z/{token}`, the same string. Revoking it
                           here would break a link the player agreed to when
                           they asked for the table, and would break it for
                           somebody who is not even in this room. So a live
                           `game.link` spares the token; the switch then only
                           hides the button, and the dialog says so. */
                        if (!next.shareEnabled && share?.token != null && link === null) {
                            void unshare()
                        }
                    }
                }}
            />

            <BlokLinkDialog
                open={linkOpen}
                signedIn={signedIn}
                usName={names.us}
                themName={names.them}
                sessionId={game.sessionId}
                onClose={() => setLinkOpen(false)}
                onLinked={setLink}
            />

            <ConfirmDialog
                open={pending !== null}
                title={confirmCopy.title}
                description={confirmCopy.body}
                /* Red for the ones that only take something away. "Nova igra"
                   SAVES before it clears (§5.6), and a red button on the action
                   that files an evening would be telling the player the
                   opposite of what it does — the sentence above it is what
                   carries the consequence there. */
                destructive={pending?.kind !== "newGame"}
                confirmLabel={
                    pending?.kind === "unlink"
                        ? t("blok.link.unlink")
                        : pending?.kind === "newGame"
                            ? t("blok.menu.newGame")
                            : t("common.delete")
                }
                onConfirm={confirmPending}
                onCancel={() => setPending(null)}
            />
        </>
    )
}
