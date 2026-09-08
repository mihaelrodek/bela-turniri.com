import { useEffect, useState } from "react"
import { Box, Button, chakra, Drawer, Grid, HStack, IconButton, Portal, Text, VStack } from "@chakra-ui/react"
import { FiTrash2 } from "react-icons/fi"
import { scoreManualDeal, type RoundOutcome } from "@bela/engine"
import ConfirmDialog from "../../components/ConfirmDialog"
import { useTranslation } from "../../i18n"
import SuitGlyph from "../../game/components/SuitGlyph"
import { SUITS, suitKey } from "../../game/util/cards"
import {
    BLOK_SIDES,
    DEAL_CARD_POINTS,
    STIGLJA_POINTS,
    type BlokRound,
    type BlokSide,
    type BlokSuit,
} from "../types"
import { sidePalette, useSideNames } from "./blokSide"
import DeclarationChips from "./DeclarationChips"
import Keypad from "./Keypad"

/* ──────────────────────────────────────────────────────────────────────────
   RoundEntrySheet — the "upis podjele" bottom sheet (BLOK.md §3.2).

   One screen, one thumb. Top to bottom it is: the two side cards (what you
   are about to write down), the zvanja block, the trump picker, and the pad.
   The cards and the pad are PINNED — only the middle scrolls — because the
   two of them are the loop the person at the table is actually in: tap a
   digit, look up, check the number.

   ── Why the fall is rendered, not just saved ──────────────────────────────
   The one thing a paper blok cannot do is tell you the caller went down. So
   this sheet shows the deal AFTER the pad rule, live: the moment the entered
   points make `C > O` false, the caller's Σ drops to 0, it gets the PAD mark,
   and the opponent's Σ jumps to the whole deal. That is the feature. It is
   also why the arithmetic is NOT in this file — `scoreManualDeal` in
   `@bela/engine` (BLOK.md §5, tested there) computes both what is shown and
   what is saved, so the preview and the stored round cannot disagree.

   ── Belot: the deal that is not played — ADDED 2026-09-08 ─────────────────
   The `Štiglja` control is now two halves, `Štiglja` and `Belot` (BLOK.md
   §1.2) — and since 2026-09-08 those two halves share ONE cell of the
   declarations grid, so the block is 3 × 2 and the pair no longer takes a row
   of its own (`DeclarationChips`, where the type-size trade is spelled out).
   A belot is eight cards of one suit: the hand is never played and the
   side that showed it takes the GAME, so the sheet fixes the card points at
   0/0, disables the pad and the declaration buttons, and shows the game's
   TARGET as that side's Σ — 1001 on the default game, 501 on a game to 501,
   which is why `target` is a prop here at all. Štiglja and belot clear each
   other: `scoreManualDeal` refuses a deal carrying both, and it is right to.

   ── One number, two cards ─────────────────────────────────────────────────
   Only ONE card-points number is ever typed. The other side is `162 − x` by
   definition (252/0 with a štiglja), so the sheet keeps a single string of
   digits plus which side it belongs to. Tapping the other card moves the
   entry there and seeds it with the value that side was already showing; the
   next digit REPLACES that seed rather than appending to it (`pristine`),
   which is how a calculator behaves and is the only reading that does not
   silently produce "725" from a tap and a keystroke.

   ── State lives in `EntryForm`, not here ──────────────────────────────────
   The form is `lazyMount`/`unmountOnExit` under the drawer, so every open
   mounts it fresh and `useState` initialisers ARE the reset. No effect has to
   watch `open`/`initial` and copy props into state, which is where this kind
   of component usually grows its stale-value bugs. `handleClear` (the Očisti
   key) is the same initialisers written out once more — see it there.

   ── Deleting the deal from in here ────────────────────────────────────────
   `onDelete` is passed only when `initial` is set, i.e. only while editing an
   existing deal, and it renders a trash action in the footer. The deal list
   also offers a long-press shortcut on the row, but a long-press has no
   keyboard and no screen-reader equivalent, so this button is the accessible
   route and not a duplicate.

   THE CONFIRMATION IS OWNED HERE, OVER THE OPEN SHEET — FIXED 2026-09-08.
   It used to close the sheet and hand the intent to the page's own
   ConfirmDialog, which meant tapping "Odustani" on that dialog threw the
   person out of the deal they were editing: the cancel button undid their
   edit session instead of undoing the delete. So the sheet renders its own
   `ConfirmDialog` (never `confirm()` — project rule) and calls `onDelete()`
   only once the user has confirmed; `onDelete` therefore now means "already
   confirmed, just delete".

   Nesting a Dialog inside a Drawer is safe in Chakra v3 and this is why:
   both are the SAME Ark/zag dialog machine, so opening the confirm pushes it
   onto the shared dismissable layer stack above the drawer. That stack does
   three things we depend on. (1) It writes `--layer-index: 1` on the confirm
   and the dialog recipe's z-index is `calc(zIndex.modal + var(--layer-index))`
   — so the confirm paints above the drawer, whose recipe is a flat
   `zIndex.modal`, without anyone hard-coding a number. (2) Escape is handled
   `if (!layerStack.isTopMost(node)) return`, so it dismisses only the confirm
   and leaves the sheet standing. (3) The drawer's interact-outside excludes
   targets `isInNestedLayer`, and every layer below a pointer-blocking one
   gets `pointer-events: none`, so neither the confirm's backdrop nor its
   buttons can close the drawer underneath.
   ────────────────────────────────────────────────────────────────────── */

/** 52 px — the keypad's 56 px is the floor for the most-used control; the
 *  ones you touch a few times a deal sit one step under it. */
const CONTROL_H = "52px"

function sum(values: number[]): number {
    return values.reduce((total, value) => total + value, 0)
}

export default function RoundEntrySheet({
    open,
    caller,
    names,
    target,
    initial,
    onCancel,
    onSave,
    onDelete,
}: {
    open: boolean
    /** Who called this deal, as the sheet was OPENED — the "MI +" / "VI +"
     *  button for a new deal, the stored `caller` when editing one. It only
     *  seeds the toggle in the header; from there the user owns it. */
    caller: BlokSide
    names: Record<BlokSide, string>
    /** The game's points target — what a belot awards (BLOK.md §1.2). Read
     *  only on a belot deal, but always passed: the sheet does not get to
     *  guess 1001 on a game played to 501. */
    target: number
    /** An existing round when editing, `null` when adding. */
    initial: BlokRound | null
    onCancel: () => void
    onSave: (round: Omit<BlokRound, "id">) => void
    /** Provided only when editing an existing deal. Renders the delete action
     *  in the footer. Called ONLY after the user confirmed in the sheet's own
     *  ConfirmDialog — it means "delete now", not "ask about deleting". */
    onDelete?: () => void
}) {
    return (
        <Drawer.Root
            open={open}
            placement="bottom"
            lazyMount
            unmountOnExit
            onOpenChange={(details) => {
                // Backdrop click and Escape both land here; the sheet has no
                // draft worth keeping, so they mean the same thing as Odustani.
                if (!details.open) onCancel()
            }}
        >
            <Portal>
                <Drawer.Backdrop backdropFilter="blur(4px)" />
                <Drawer.Positioner>
                    <Drawer.Content
                        /* The drawer recipe is NOT in system.ts's glass
                           slot-recipe overrides (dialog/menu/popover are), and
                           its stock `bg.panel` is 61% translucent with no blur
                           — the page would read straight through the scores.
                           The layer style is the same treatment every dialog
                           in the app already gets. */
                        layerStyle="glass.panel"
                        h={{ base: "100dvh", md: "auto" }}
                        maxH="100dvh"
                        maxW={{ base: "100%", md: "520px" }}
                        mx="auto"
                        roundedTop={{ base: "0", md: "l3" }}
                    >
                        <EntryForm
                            caller={caller}
                            names={names}
                            target={target}
                            initial={initial}
                            onCancel={onCancel}
                            onSave={onSave}
                            onDelete={onDelete}
                        />
                    </Drawer.Content>
                </Drawer.Positioner>
            </Portal>
        </Drawer.Root>
    )
}

function EntryForm({
    caller,
    names,
    target,
    initial,
    onCancel,
    onSave,
    onDelete,
}: {
    caller: BlokSide
    names: Record<BlokSide, string>
    target: number
    initial: BlokRound | null
    onCancel: () => void
    onSave: (round: Omit<BlokRound, "id">) => void
    onDelete?: () => void
}) {
    const { t } = useTranslation()
    /* `BlokGame.names` starts EMPTY and `rename(side, "")` resets it back —
       empty means "no name of its own", so the label is a translation. One
       shared helper (`blokSide.ts`) does it for every screen in the feature. */
    const sideNames = useSideNames(names)

    /** Who called this deal. A REAL input, not a caption — FIXED 2026-09-08.
     *  It used to be frozen at whatever the `caller` prop said (the bottom
     *  button that opened the sheet) and merely printed as "Zvao MI", so the
     *  single most common mis-tap at the table could only be undone by
     *  cancelling and starting the deal over. The prop now just seeds this,
     *  the two chips in the header change it, and because it is fed straight
     *  into `scoreManualDeal` below, flipping it re-runs the pad rule and the
     *  Σ figures and the PAD mark move on the same tap. */
    const [callerSide, setCallerSide] = useState<BlokSide>(caller)
    /** Which side the pad and the zvanja buttons write into. Starts on the
     *  caller: that is the side whose points decide the deal. Independent of
     *  `callerSide` afterwards — correcting who called must not yank the pad
     *  out from under someone mid-number. */
    const [active, setActive] = useState<BlokSide>(caller)
    /** The typed card points of `active`, as digits. Never a number — "" and
     *  "0" are different states and only a string keeps them apart. */
    const [text, setText] = useState<string>(() =>
        // A štiglja's 252 and a belot's 0 are not typed numbers, so neither
        // seeds the buffer: an edited belot that gets switched back off must
        // ask for a real card split, not offer a plausible "0".
        initial && initial.stiglja === null && initial.belot === null
            ? String(initial.cards[caller])
            : "",
    )
    /** True while `text` is a value the user has not typed themselves (the
     *  seed after a side switch, or an edited round's stored points), so the
     *  next digit starts over instead of appending. */
    const [pristine, setPristine] = useState(true)
    const [declarations, setDeclarations] = useState<Record<BlokSide, number[]>>(() =>
        initial ? { us: [...initial.declarations.us], them: [...initial.declarations.them] } : { us: [], them: [] },
    )
    const [stiglja, setStiglja] = useState<BlokSide | null>(initial?.stiglja ?? null)
    /** The side that showed a belot, or null. Exclusive with `stiglja`. */
    const [belot, setBelot] = useState<BlokSide | null>(initial?.belot ?? null)
    const [trump, setTrump] = useState<BlokSuit | null>(initial?.trump ?? null)
    /** The delete confirmation, which lives HERE rather than on the page so
     *  that cancelling it returns to the deal being edited. */
    const [confirmDelete, setConfirmDelete] = useState(false)

    const typed = (() => {
        if (text === "") return null
        const value = Number(text)
        if (!Number.isFinite(value) || value < 0 || value > DEAL_CARD_POINTS) return null
        return value
    })()

    /** The pad and the declaration buttons write nothing on a belot or a
     *  štiglja — both fix the whole deal on their own. */
    const padLocked = stiglja !== null || belot !== null

    /** The deal's card points, or `null` while there is nothing valid to
     *  score. A štiglja fixes both sides outright and makes the pad moot; a
     *  belot means the deal was never played, so nobody took anything. */
    const cards: Record<BlokSide, number> | null = belot
        ? { us: 0, them: 0 }
        : stiglja
            ? {
                us: stiglja === "us" ? STIGLJA_POINTS : 0,
                them: stiglja === "them" ? STIGLJA_POINTS : 0,
            }
            : typed === null
                ? null
                : active === "us"
                    ? { us: typed, them: DEAL_CARD_POINTS - typed }
                    : { us: DEAL_CARD_POINTS - typed, them: typed }

    /* The single source of truth for every number below — and for the round
       that gets saved. See the header note.

       `scoreManualDeal` THROWS on a deal that cannot exist (BLOK.md §1.1) —
       deliberately, so a half-typed form can never be shown a confident wrong
       total. A live preview runs on every keystroke, so the throw is expected
       traffic here rather than an error: it simply means "not a deal yet",
       which is exactly the state that greys out
       Spremi. Hence catch-and-null rather than an error boundary. */
    let outcome: RoundOutcome | null = null
    if (cards) {
        try {
            outcome = scoreManualDeal({
                caller: callerSide,
                cards,
                declarations,
                stiglja,
                belot,
                // Only a belot reads it, but it always travels: the sheet must
                // not decide that "the target" means 1001.
                target,
            })
        } catch {
            outcome = null
        }
    }

    const declarationTotals: Record<BlokSide, number> = {
        us: sum(declarations.us),
        them: sum(declarations.them),
    }

    /* The engine, not the form, decides what is enterable: if it would refuse
       to score this deal, there is nothing worth saving. */
    const canSave = outcome !== null

    /* CLAMP, never refuse — DECISION 2026-09-08 (BLOK.md §3.2).
       A keystroke that would overshoot 162 used to be dropped on the floor,
       which on a phone is indistinguishable from a key that did not register:
       type "25" then "5" and the pad simply appeared dead. Clamping instead
       means every tap does something visible, and 162 is the only value the
       overshoot could have been heading for anyway — the deal cannot hold
       more. The result is also self-limiting: once the buffer reads "162",
       further digits clamp back to "162", so it can never grow past 3 digits
       and no separate length guard is needed. */
    function handleDigit(digit: string) {
        const base = pristine ? "" : text
        // Leading zeros are dropped so "0" then "9" reads as 9, not 09.
        const candidate = `${base}${digit}`.replace(/^0+(?=\d)/, "")
        const value = Number(candidate)
        setText(String(Math.min(value, DEAL_CARD_POINTS)))
        setPristine(false)
    }

    function handleBackspace() {
        setText(text.slice(0, -1))
        setPristine(false)
    }

    /* A REAL KEYBOARD DRIVES THE PAD — 2026-09-08, user request.
       On a desktop the sheet is the same on-screen pad, and someone with a
       keyboard in front of them types the number instead of clicking nine
       times. The pad stays the source of truth: the physical keys call the
       exact same handlers, including the clamp, so a typed "255" lands on 162
       just as a tapped one does. The number row and the numeric keypad both
       work (`e.key` is the digit either way).

       Deliberately NOT bound: Enter. `Spremi` is one tab away and a stray
       Enter while somebody is still typing would file a half-entered deal.
       Escape is left to the drawer, which already closes on it.

       The listener ignores anything typed into a real field, and any
       combination with a modifier, so browser shortcuts (⌘R, ⌘L…) are
       untouched. */
    useEffect(() => {
        function onKeyDown(e: KeyboardEvent) {
            if (e.metaKey || e.ctrlKey || e.altKey) return
            const target = e.target as HTMLElement | null
            const tag = target?.tagName
            if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return

            if (e.key >= "0" && e.key <= "9") {
                if (padLocked) return // the pad is disabled in that mode
                e.preventDefault()
                handleDigit(e.key)
                return
            }
            if (e.key === "Backspace" || e.key === "Delete") {
                if (padLocked) return
                e.preventDefault()
                handleBackspace()
            }
        }
        window.addEventListener("keydown", onKeyDown)
        return () => window.removeEventListener("keydown", onKeyDown)
    })

    /* Očisti — the pad's bottom-left key. Empties the WHOLE sheet: both sides'
       card points, every zvanje, the štiglja, the belot, the trump, and the
       active side. These are literally the `useState` initialisers of a NEW
       deal.

       EDITING AN EXISTING DEAL, "clear" MEANS EMPTY, NOT REVERT — DECISION
       2026-09-08. A control whose label says "clear" but which sometimes
       restores values is two controls sharing one word, and the reason to
       reach for it while editing is usually that the saved numbers are the
       wrong ones. Nothing can be lost by surprise either way: the sheet writes
       nothing until Spremi, so Odustani still brings the saved deal back
       untouched in a single tap — which is the revert.

       `Očisti` is also the only key a locked pad does not disable, which now
       matters twice over: it is the way back off a štiglja AND off a belot.

       ONE THING OČISTI DOES NOT TOUCH: the caller chips — DECISION
       2026-09-08. Every other initialiser here is a NUMBER the person is
       about to retype, which is why "clear" is the right word for them. Who
       called is not: it is a fact about the hand that was just played, it is
       usually still correct when the numbers are not, and flipping it back
       would silently re-run the pad rule on a sheet whose whole job is to
       show that rule honestly. `active` therefore resets to the CURRENT
       caller, not to the prop. */
    function handleClear() {
        setActive(callerSide)
        setText("")
        setPristine(true)
        setDeclarations({ us: [], them: [] })
        setStiglja(null)
        setBelot(null)
        setTrump(null)
    }

    function activate(side: BlokSide) {
        if (side === active) return
        setActive(side)
        // With a štiglja (or a belot) the points are not typed at all, so
        // leave the buffer alone rather than seeding it with 252 or with a
        // belot's 0 — neither is a legal entry, and both would read as garbage
        // the moment the toggle came back off.
        if (!padLocked) setText(cards ? String(cards[side]) : "")
        setPristine(true)
    }

    function addDeclaration(value: number) {
        setDeclarations((prev) => ({
            us: active === "us" ? [...prev.us, value] : prev.us,
            them: active === "them" ? [...prev.them, value] : prev.them,
        }))
    }

    /* Remove by VALUE, not by index: the ✕ now lives on the value's own button
       (BLOK.md §3.2) and so points at a value, never at a position. Dropping
       the LAST entry of it is the undo reading — the one just added goes back
       first — and since the entries of a value are identical in
       `BlokRound.declarations`, which one actually leaves is unobservable. */
    function removeDeclaration(value: number) {
        setDeclarations((prev) => {
            const list = prev[active]
            const index = list.lastIndexOf(value)
            if (index === -1) return prev
            const next = list.filter((_, i) => i !== index)
            return {
                us: active === "us" ? next : prev.us,
                them: active === "them" ? next : prev.them,
            }
        })
    }

    function toggleStiglja() {
        const next = stiglja === active ? null : active
        setStiglja(next)
        // A deal cannot be both: eight cards of one suit ends it before a
        // trick is led, so nobody can also have taken all eight of them. The
        // engine refuses the pair outright (BLOK.md §1.1) — turning the other
        // one off here is what stops the sheet from ever building it.
        if (next !== null) setBelot(null)
        // Leaving a štiglja: whatever is in the buffer predates it and may be
        // out of range (252). Clear it so the sheet asks for a real number.
        if (next === null && Number(text) > DEAL_CARD_POINTS) {
            setText("")
            setPristine(true)
        }
    }

    /** Belot — eight cards of one suit, the deal that is not played (BLOK.md
     *  §1.2). Mirrors `toggleStiglja` down to the buffer clean-up, and clears
     *  the štiglja for the same reason it is cleared there. */
    function toggleBelot() {
        const next = belot === active ? null : active
        setBelot(next)
        if (next !== null) setStiglja(null)
        if (next === null && Number(text) > DEAL_CARD_POINTS) {
            setText("")
            setPristine(true)
        }
    }

    function handleSave() {
        // `cards` already carries the štiglja's +90 (252/0, `STIGLJA_POINTS`)
        // or the belot's 0/0, which is what BlokRound.cards stores and what
        // the engine validates.
        if (!cards || !canSave) return
        onSave({ caller: callerSide, cards, declarations, stiglja, belot, trump })
    }

    return (
        <>
            {/* Who called — the WHOLE header, and now a CONTROL — FIXED
                2026-09-08. The big "Nova podjela" / "Uredi podjelu" line is
                still gone (a caption on a sheet whose contents already say
                what it is, costing a row the two side cards need), but the
                "Zvao MI" that replaced it was read-only: the caller was fixed
                by whichever bottom button opened the sheet, so the commonest
                mis-tap at the table cost a full cancel-and-retype. Two chips
                instead, seeded from that button (or from the edited deal's
                stored caller), both live inputs to `scoreManualDeal`.

                The word alone is the `Drawer.Title` — it is what names the
                dialog — and each chip carries the full "Zvao MI" sentence as
                its accessible name, so `round.calledBy` still does the
                speaking and nothing announces a bare side name. */}
            <Drawer.Header px="4" pt="4" pb="2" display="block">
                <Drawer.Title
                    fontSize="xs"
                    fontWeight="bold"
                    color="fg.muted"
                    textTransform="uppercase"
                    letterSpacing="wide"
                    mb="1.5"
                >
                    {t("blok.entry.caller")}
                </Drawer.Title>
                {/* Each chip takes half the width and sits directly above its
                    own side card (same `px`, same `gap`, `flex="1"`), so "who
                    called" is answered in the same column the points are typed
                    into. The chips used to be a pair huddled to the right of
                    the label, which put MI above the gap between the cards.
                    `BLOK_SIDES` order, never caller-first: a side's left/right
                    position is part of how it is identified. */}
                <HStack gap="2" align="center">
                    {BLOK_SIDES.map((side) => {
                        const selected = side === callerSide
                        return (
                            <Button
                                key={side}
                                h="36px"
                                minW="0"
                                flex="1"
                                px="4"
                                rounded="full"
                                variant="outline"
                                colorPalette={sidePalette(side)}
                                aria-pressed={selected}
                                aria-label={t("blok.round.calledBy", { side: sideNames[side] })}
                                /* Solid when chosen: this is a two-way switch
                                   where one side is always on, so "outline vs
                                   outline-with-a-tint" would not read at a
                                   glance across the table. `solid`/`contrast`
                                   is the pair Chakra keeps legible in both
                                   themes, and `aria-pressed` carries the state
                                   for anyone the colour does not reach. */
                                bg={selected ? "colorPalette.solid" : "bg.subtle"}
                                color={selected ? "colorPalette.contrast" : "fg.muted"}
                                borderColor={selected ? "colorPalette.solid" : "border.subtle"}
                                fontSize="sm"
                                fontWeight="bold"
                                _hover={{ bg: selected ? "colorPalette.solid" : "bg.muted" }}
                                onClick={() => setCallerSide(side)}
                            >
                                {/* Names are renameable and can be long, so
                                    the chip truncates rather than pushing its
                                    neighbour off the header. */}
                                <Text as="span" truncate>{sideNames[side]}</Text>
                            </Button>
                        )
                    })}
                </HStack>
            </Drawer.Header>

            {/* Pinned: the two cards never scroll out from under the pad.
                `BLOK_SIDES` order, never caller-first — the side's position is
                one of the three things (with its colour and its name) that
                identify it across every screen of the blok, so it must not
                shuffle between deals. */}
            <HStack px="4" pb="3" gap="2" align="stretch" flex="0 0 auto">
                {BLOK_SIDES.map((side) => (
                    <SideCard
                        key={side}
                        name={sideNames[side]}
                        palette={sidePalette(side)}
                        isActive={side === active}
                        points={cards ? cards[side] : null}
                        declarationTotal={declarationTotals[side]}
                        total={outcome ? outcome.total[side] : null}
                        fell={outcome !== null && outcome.fell && side === callerSide}
                        hasStiglja={stiglja === side}
                        hasBelot={belot === side}
                        onActivate={() => activate(side)}
                    />
                ))}
            </HStack>

            <Drawer.Body px="4" py="2">
                <VStack align="stretch" gap="4">
                    <DeclarationChips
                        added={declarations[active]}
                        // Both sides: the per-deal caps are about the deck, not
                        // about a side — one 200 exists per deal whoever holds
                        // it (BLOK.md §3.2).
                        dealAdded={[...declarations.us, ...declarations.them]}
                        onAdd={addDeclaration}
                        onRemove={removeDeclaration}
                        stiglja={stiglja === active}
                        onToggleStiglja={toggleStiglja}
                        belot={belot === active}
                        // The DEAL's belot, not this side's: a belot on the
                        // opponents' card makes this side's declarations just
                        // as unscorable, so it is what locks the five values.
                        dealBelot={belot !== null}
                        onToggleBelot={toggleBelot}
                        palette={sidePalette(active)}
                    />

                    <VStack align="stretch" gap="2">
                        <Text
                            fontSize="xs"
                            fontWeight="bold"
                            color="fg.muted"
                            textTransform="uppercase"
                            letterSpacing="wide"
                        >
                            {t("blok.entry.trump")}
                        </Text>
                        <Grid templateColumns="repeat(4, 1fr)" gap="2">
                            {SUITS.map((suit) => {
                                const selected = trump === suit
                                return (
                                    <Button
                                        key={suit}
                                        h={CONTROL_H}
                                        rounded="l2"
                                        variant="outline"
                                        flexDirection="column"
                                        gap="0.5"
                                        px="0"
                                        aria-pressed={selected}
                                        bg={selected ? "brand.subtle" : "bg.subtle"}
                                        borderColor={selected ? "brand.solid" : "border.subtle"}
                                        color={selected ? "brand.fg" : "fg.soft"}
                                        _hover={{ bg: selected ? "brand.muted" : "bg.muted" }}
                                        /* Tapping the chosen suit again clears
                                           it — trump is optional (display
                                           only), so the picker needs an "off"
                                           and a sixth "none" button would be a
                                           control that means nothing. */
                                        onClick={() => setTrump(selected ? null : suit)}
                                    >
                                        <SuitGlyph suit={suit} size={18} />
                                        {/* The name, not just the pip: with the
                                            French deck the black suits paint in
                                            card ink, which is nearly invisible
                                            on a dark panel. Same belt-and-braces
                                            as the game's own BiddingPanel. */}
                                        <Text
                                            fontSize="2xs"
                                            fontWeight="semibold"
                                            textTransform="capitalize"
                                            lineHeight="1"
                                        >
                                            {t(suitKey(suit))}
                                        </Text>
                                    </Button>
                                )
                            })}
                        </Grid>
                    </VStack>
                </VStack>
            </Drawer.Body>

            <Drawer.Footer px="4" pt="2" pb="4" display="block">
                {/* NOTHING sits between the pad and the trump grid — FIXED
                    2026-09-08. First the "BODOVI IZ KARATA" caption went (a
                    0-9 pad under a sheet whose only number is card points did
                    not need telling apart from anything), and now the active
                    side's name that had been left facing it: alone in the
                    corner it read as a stray word rather than as a label, and
                    the two side cards a thumb's length above already say which
                    side is being edited — one of them is ringed, tinted and
                    `aria-pressed`. `entry.cards` survives as the pad's
                    accessible group name, where a label does real work. */}
                <Keypad
                    onDigit={handleDigit}
                    onBackspace={handleBackspace}
                    onClear={handleClear}
                    disabled={padLocked}
                    label={t("blok.entry.cards")}
                    clearLabel={t("blok.entry.clearAll")}
                    backspaceLabel={t("blok.entry.backspace")}
                />
                {/* No "check your input" line here (removed 2026-09-08): the
                    disabled Spremi already says it, and the side cards show
                    exactly which figure is missing. A sentence under the pad
                    only repeated that, one thumb-width from the buttons. */}
                <HStack gap="2" mt="3">
                    {onDelete && (
                        <IconButton
                            /* Leftmost and icon-only, so it is one control wide
                               and the full width of Odustani sits between it
                               and Spremi — the two buttons a thumb aims at. Red
                               says destructive, the trash glyph says which
                               destruction, and `round.delete` is the accessible
                               name; the confirmation below catches a mis-tap. */
                            aria-label={t("blok.round.delete")}
                            h={CONTROL_H}
                            w={CONTROL_H}
                            flexShrink="0"
                            rounded="l2"
                            variant="outline"
                            colorPalette="red"
                            color="colorPalette.fg"
                            borderColor="colorPalette.emphasized"
                            _hover={{ bg: "colorPalette.subtle" }}
                            onClick={() => setConfirmDelete(true)}
                        >
                            <FiTrash2 />
                        </IconButton>
                    )}
                    <Button flex="1" h={CONTROL_H} rounded="l2" variant="outline" onClick={onCancel}>
                        {t("blok.entry.cancel")}
                    </Button>
                    <Button
                        flex="1"
                        h={CONTROL_H}
                        rounded="l2"
                        colorPalette="brand"
                        disabled={!canSave}
                        onClick={handleSave}
                    >
                        {t("blok.entry.save")}
                    </Button>
                </HStack>

                {/* Over the sheet, not instead of it — see the header note.
                    Rendered inside the drawer so it can only ever exist while
                    the drawer does, which is also what puts it ABOVE the
                    drawer on the shared layer stack. `onDelete` fires only
                    from here, so the page never has to ask a second time. */}
                {onDelete && (
                    <ConfirmDialog
                        open={confirmDelete}
                        title={t("blok.round.delete")}
                        description={t("blok.confirm.deleteRound")}
                        destructive
                        onCancel={() => setConfirmDelete(false)}
                        onConfirm={() => {
                            setConfirmDelete(false)
                            onDelete()
                        }}
                    />
                )}
            </Drawer.Footer>
        </>
    )
}

/* ──────────────────────────────────────────────────────────────────────────
   One team's card in the sheet's header.

   It is a real <button> (aria-pressed carries "this is where the pad writes",
   so the coloured ring is not the only thing saying so) and therefore contains
   ONLY spans — a <div> or a <p> inside a button is invalid HTML, which is why
   nothing here is a bare Text or HStack.

   Nothing is announced through colour alone: the štiglja and PAD marks are
   words, and the inactive side is muted AND unringed AND not pressed.
   ────────────────────────────────────────────────────────────────────── */
function SideCard({
    name,
    palette,
    isActive,
    points,
    declarationTotal,
    total,
    fell,
    hasStiglja,
    hasBelot,
    onActivate,
}: {
    name: string
    /** This side's colour, from the feature-wide mapping in `blokSide.ts` —
     *  the same hue the header total and the deal rows give it, so the card
     *  in the sheet is recognisably the same team. */
    palette: "green" | "red"
    isActive: boolean
    /** Card points, or `null` while nothing valid has been entered. */
    points: number | null
    declarationTotal: number
    /** The deal total for this side AFTER the pad rule — the whole point. */
    total: number | null
    fell: boolean
    hasStiglja: boolean
    /** This side showed the belot — the deal, and the game, are theirs. */
    hasBelot: boolean
    onActivate: () => void
}) {
    const { t } = useTranslation()

    return (
        <chakra.button
            /* `chakra.button`, not `<Box as="button">`: `as` does not retype
               props in Chakra v3, so the Box form has no `type` and would
               default to `submit` inside any future form. */
            type="button"
            onClick={onActivate}
            aria-pressed={isActive}
            colorPalette={palette}
            flex="1"
            minW="0"
            display="flex"
            flexDirection="column"
            alignItems="stretch"
            textAlign="start"
            px="3"
            py="2"
            rounded="l3"
            borderWidth="2px"
            borderColor={isActive ? "colorPalette.solid" : "border.subtle"}
            bg={isActive ? "colorPalette.subtle" : "bg.subtle"}
            transition="background-color 120ms, border-color 120ms"
            _focusVisible={{ outline: "2px solid", outlineColor: "colorPalette.focusRing", outlineOffset: "2px" }}
        >
            <Box as="span" display="flex" alignItems="center" justifyContent="space-between" gap="1" mb="1">
                <Text
                    as="span"
                    fontSize="xs"
                    fontWeight="bold"
                    lineClamp={1}
                    textTransform="uppercase"
                    letterSpacing="wide"
                    color={isActive ? "colorPalette.fg" : "fg.muted"}
                >
                    {name}
                </Text>
                {/* Never both: the two toggles clear each other, and the
                    engine refuses a deal that carries both anyway. */}
                {(hasStiglja || hasBelot) && (
                    <Box
                        as="span"
                        flexShrink="0"
                        px="1.5"
                        rounded="full"
                        bg="colorPalette.solid"
                        color="colorPalette.contrast"
                        fontSize="2xs"
                        fontWeight="bold"
                        lineHeight="18px"
                        textTransform="uppercase"
                    >
                        {t(hasBelot ? "blok.entry.belot" : "blok.entry.stiglja")}
                    </Box>
                )}
            </Box>

            <Box as="span" display="flex" alignItems="baseline" gap="1.5">
                <Text
                    as="span"
                    fontSize="4xl"
                    lineHeight="1"
                    fontWeight="bold"
                    fontVariantNumeric="tabular-nums"
                    color={isActive ? "fg.ink" : "fg.muted"}
                >
                    {points === null ? "–" : points}
                </Text>
                {declarationTotal > 0 && (
                    <Text
                        as="span"
                        fontSize="sm"
                        fontWeight="semibold"
                        fontVariantNumeric="tabular-nums"
                        color="fg.muted"
                    >
                        +{declarationTotal}
                    </Text>
                )}
            </Box>

            <Box as="span" display="flex" alignItems="center" gap="1.5" mt="1.5">
                <Text
                    as="span"
                    fontSize="md"
                    fontWeight="bold"
                    fontVariantNumeric="tabular-nums"
                    color={fell ? "red.fg" : "fg.soft"}
                >
                    {/* "Σ 297", not "Ukupno 297" — DECISION 2026-09-08. Both
                        cards sit side by side on a phone, where the word ate
                        the width the number needs and repeated itself twice
                        per sheet; Σ is the notation people already write on
                        the paper blok. The word stays as the SPOKEN form: a
                        screen reader would otherwise announce this card's
                        deciding number as "n-ary summation 297" or as nothing
                        at all, so `entry.sum` moves from the ink to sr-only. */}
                    <Box as="span" aria-hidden="true">Σ</Box>
                    <Box as="span" srOnly>{t("blok.entry.sum")}</Box>
                    {" "}
                    {total === null ? "–" : total}
                </Text>
                {fell && (
                    <Box
                        as="span"
                        /* A SOLID stamp, not a tinted chip: "them" already
                           wears red as its side colour (`blokSide.ts`), so a
                           `red.subtle` badge would vanish into that card. The
                           `solid`/`contrast` pair is the one Chakra guarantees
                           legible in both themes, and the word "PAD" carries
                           the meaning regardless of the colour. */
                        flexShrink="0"
                        px="1.5"
                        rounded="full"
                        bg="red.solid"
                        color="red.contrast"
                        fontSize="2xs"
                        fontWeight="bold"
                        lineHeight="18px"
                        textTransform="uppercase"
                        letterSpacing="wide"
                    >
                        {t("blok.entry.fell")}
                    </Box>
                )}
            </Box>
        </chakra.button>
    )
}
