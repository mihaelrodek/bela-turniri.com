import { useEffect, useState } from "react"
import {
    Button,
    Dialog,
    Field,
    HStack,
    IconButton,
    Input,
    Menu,
    Portal,
    Separator,
    Switch,
    Text,
    VStack,
} from "@chakra-ui/react"
import {
    FiLink2,
    FiMoreVertical,
    FiPlusCircle,
    FiSettings,
    FiTrash2,
} from "react-icons/fi"

import { usePlural, useTranslation } from "../../i18n"
import {
    BLOK_SIDES,
    SERIES_TARGETS,
    TARGETS,
    type BlokDealDirection,
    type BlokGameEndRule,
    type BlokSide,
} from "../types"
import { sideNameKey } from "./blokSide"

/* ──────────────────────────────────────────────────────────────────────────
   BlokMenu — the overflow menu in the scoreboard's top-right corner, plus the
   two dialogs it opens.

   The menu itself is deliberately dumb: it renders its items and calls back.
   The DIALOGS are exported alongside it because the page has to be able to
   open them from elsewhere too — the side name in the header is a rename
   trigger, which is where a rename actually starts nine times out of ten —
   so their `open` state lives on the page and is passed in, rather than being
   hidden inside a menu the header cannot reach.

   Nothing here mutates the store directly and nothing here confirms anything:
   the items that clear something (delete game, close the series) call back to
   the page, which owns the `ConfirmDialog` for both of them. `window.confirm` is banned
   project-wide, and keeping the confirmations next to each other keeps their
   wording and their consequences visible in one place.

   ── THE MENU SHRANK — 2026-09-08, BLOK-HISTORY.md §5.3 ────────────────────
   Three items left, and none of them was deleted as a feature — each one moved
   somewhere it is easier to reach:

     "Preimenuj strane"  → the pencil under each score already did this, and a
                           second door onto the same dialog was only a longer
                           way round to it.
     "Odigrane partije"  → into the score card, behind the chevron (§5.4). As a
                           dialog it read as the profile's archive; as part of
                           the card it can only read as the current series.
     "Podijeli sažetak"  → the card's top-left corner (§5.2), and it now shares
                           a LINK rather than a line of text.

   What is left is what a menu is for: things you set once ("Postavke" — the
   points target, dosta/prolaz, how long the series is, and since 2026-09-08
   whether this blok offers sharing at all), the tournament link, and the two
   endings. "Promijeni cilj" is called "Postavke" for the same reason: it
   stopped being about one number two settings ago.

   ── AND IT SHRANK AGAIN — 2026-09-08, BLOK-HISTORY.md §5.6 ────────────────
   "Resetiraj" is GONE, and nothing replaced it: it and "Nova igra" were two
   names for one act, so "Nova igra" now IS the one that closes the series —
   files it to the profile, puts the series score back to 0:0, leaves an empty
   pad. Continuing a series moved to where it is meant: the summary's "Sljedeća
   partija", under a game that has actually been won.

   "Prekini dijeljenje" left too, in the other direction: it is now the OFF
   position of a switch in "Postavke" ("Omogući dijeljenje"), because a menu
   item that only appears once a link exists is a feature you can only find by
   already having used it.
   ────────────────────────────────────────────────────────────────────── */

export default function BlokMenu({
    onNewGame,
    onTarget,
    onDelete,
    onLink,
    canDelete,
    canNewGame,
    canLink,
}: {
    /**
     * Close the whole SERIES — the menu's "Nova igra" (BLOK-HISTORY.md §5.6).
     * It files the finished games to the profile, resets the series score to
     * 0:0 and leaves an empty scorepad; a game that was never won is discarded
     * with the rest. It sits beside the item it must not be confused with —
     * "Obriši igru", which throws away one game's deals and keeps the series —
     * and, like it, only calls back: the page owns the confirmation.
     */
    onNewGame: () => void
    /** "Postavke": the points target, how one game ends, how long the series
     *  runs. One dialog, because they are one conversation at the table. */
    onTarget: () => void
    onDelete: () => void
    /**
     * Open the "link this blok to a table" flow (BLOK-LINK.md §3.4). Offered
     * to signed-OUT users too: the dialog then explains why signing in is
     * needed and offers the way there, which is the only place in the blok
     * that ever mentions an account (§3.1). Hiding it from guests would make
     * the feature undiscoverable for exactly the people who have not used it.
     */
    onLink: () => void
    /** False on a game with no deals — there is nothing to throw away. */
    canDelete: boolean
    /** False when the series holds no deals at all — nothing to file, nothing
     *  to clear, and a "Nova igra" that would only mint a new id. */
    canNewGame: boolean
    /**
     * False once a link is live (PENDING or APPROVED). The status strip in
     * the header then owns everything about it — including breaking it — so a
     * second entry point here would either duplicate that or sit greyed out
     * with no explanation.
     */
    canLink: boolean
}) {
    const { t } = useTranslation()

    return (
        <Menu.Root>
            <Menu.Trigger asChild>
                <IconButton
                    aria-label={t("blok.menu.title")}
                    title={t("blok.menu.title")}
                    size="sm"
                    variant="ghost"
                    rounded="full"
                >
                    <FiMoreVertical />
                </IconButton>
            </Menu.Trigger>
            <Portal>
                <Menu.Positioner>
                    <Menu.Content minW="220px">
                        {/* The one item that ends the evening (§5.6). Not
                            painted red: it SAVES before it clears, which is the
                            opposite of what red promises here — the
                            confirmation says what goes where and that the
                            series score returns to 0:0. */}
                        <Menu.Item value="new" disabled={!canNewGame} onSelect={onNewGame}>
                            <FiPlusCircle /> {t("blok.menu.newGame")}
                        </Menu.Item>
                        {/* A gear, not a target: this dialog stopped being
                            about one number when "dosta / prolaz" and "igra se
                            do" joined the points target inside it (§5.3). */}
                        <Menu.Item value="target" onSelect={onTarget}>
                            <FiSettings /> {t("blok.menu.target")}
                        </Menu.Item>
                        {canLink ? (
                            <Menu.Item value="link" onSelect={onLink}>
                                <FiLink2 /> {t("blok.link.menu")}
                            </Menu.Item>
                        ) : null}
                        <Menu.Item
                            value="delete"
                            color="red.fg"
                            disabled={!canDelete}
                            onSelect={onDelete}
                        >
                            <FiTrash2 /> {t("blok.menu.delete")}
                        </Menu.Item>
                    </Menu.Content>
                </Menu.Positioner>
            </Portal>
        </Menu.Root>
    )
}

/* ─────────────────────────── rename ─────────────────────────── */

/**
 * Both names at once. Renaming one side almost always means renaming the
 * other in the same breath ("Ivan i Marko" vs "Ana i Petra"), and two fields
 * in one dialog is one round trip instead of two.
 *
 * `focusSide` only decides which field is focused on open — the header's
 * per-side trigger passes the side that was tapped.
 */
export function RenameDialog({
    open,
    names,
    focusSide,
    onSave,
    onCancel,
}: {
    open: boolean
    names: Record<BlokSide, string>
    focusSide: BlokSide
    onSave: (next: Record<BlokSide, string>) => void
    onCancel: () => void
}) {
    const { t } = useTranslation()
    const [draft, setDraft] = useState(names)

    // Reset every time the dialog opens, not on every `names` change: a
    // half-typed name must survive a re-render of the page underneath.
    useEffect(() => {
        if (open) setDraft(names)
    }, [open, names])

    // No validity check: an EMPTY name is a legal value — it is how a side is
    // reset to its translated default (`rename(side, "")`), so clearing the
    // field must stay clearable and savable. The placeholder shows what the
    // side will be called if it is left blank.
    return (
        <Dialog.Root
            open={open}
            onOpenChange={(e) => { if (!e.open) onCancel() }}
            placement="center"
        >
            <Portal>
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content maxW={{ base: "92%", md: "sm" }}>
                        <Dialog.Header>
                            <Dialog.Title>{t("blok.side.renameTitle")}</Dialog.Title>
                        </Dialog.Header>
                        <Dialog.Body>
                            <VStack gap="3" align="stretch">
                                {BLOK_SIDES.map((side) => (
                                    <Field.Root key={side}>
                                        <Field.Label>{t(sideNameKey(side))}</Field.Label>
                                        <Input
                                            value={draft[side]}
                                            placeholder={t(sideNameKey(side))}
                                            // 40, not 24 — "Perhaj i Galinec"
                                            // fits either way, but two full
                                            // surnames did not, and the header
                                            // and the action bar now wrap a
                                            // name to two lines instead of
                                            // cutting it. Still far inside the
                                            // backend's varchar(60) for
                                            // `name_us` / `name_them`
                                            // (BLOK-HISTORY.md §3.1), which is
                                            // the real ceiling.
                                            maxLength={40}
                                            autoFocus={side === focusSide}
                                            onChange={(e) =>
                                                setDraft((d) => ({ ...d, [side]: e.target.value }))
                                            }
                                        />
                                    </Field.Root>
                                ))}
                            </VStack>
                        </Dialog.Body>
                        <Dialog.Footer gap="2">
                            <Button variant="ghost" onClick={onCancel}>
                                {t("common.cancel")}
                            </Button>
                            <Button
                                colorPalette="brand"
                                onClick={() =>
                                    onSave({ us: draft.us.trim(), them: draft.them.trim() })
                                }
                            >
                                {t("common.save")}
                            </Button>
                        </Dialog.Footer>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Portal>
        </Dialog.Root>
    )
}


/**
 * A setting with exactly TWO named readings, as one switch row.
 *
 * "Igra se na prolaz / dosta" and "smjer kartanja desno / lijevo" were two
 * full-width buttons each, which is four buttons and two more sections in a
 * dialog a phone already scrolls. A switch is the right control for a pair
 * where one side is the default — but a bare switch would leave the user
 * guessing which of the two words "on" stands for, so the ACTIVE word is
 * printed next to it and changes as it is flipped. Same one-row shape and the
 * same heading styling as the plain switches around it, so the dialog still
 * reads as one list of settings.
 */
function ChoiceSwitchRow({
    label,
    value,
    checked,
    onCheckedChange,
}: {
    label: string
    /** The reading that is active RIGHT NOW, spelled out. */
    value: string
    checked: boolean
    onCheckedChange: (checked: boolean) => void
}) {
    return (
        <Switch.Root
            checked={checked}
            onCheckedChange={(e) => onCheckedChange(e.checked)}
            colorPalette="brand"
            display="flex"
            alignItems="center"
            justifyContent="space-between"
            gap="4"
            w="full"
            minH="44px"
        >
            <Switch.HiddenInput />
            <Switch.Label
                flex="1"
                minW="0"
                fontSize="2xs"
                fontWeight="bold"
                textTransform="uppercase"
                letterSpacing="0.08em"
                color="fg.subtle"
            >
                {label}
            </Switch.Label>
            {/* Part of the label for a screen reader — it is read with the
                heading, not as a stray word between the two. */}
            <Switch.Label fontSize="sm" fontWeight="semibold" color="fg" flexShrink={0}>
                {value}
            </Switch.Label>
            <Switch.Control flexShrink={0}>
                <Switch.Thumb />
            </Switch.Control>
        </Switch.Root>
    )
}


/* ─────────────────────────── target ─────────────────────────── */

/**
 * Everything that defines how a table is playing, in one dialog: how many
 * POINTS a game goes to, how a single game ENDS, and how many won games take
 * the series.
 *
 * The points target (501 / 701 / 1001) was always here. The other two joined it
 * because they are the same kind of decision, made in the same breath at the
 * same moment, and a menu item per half-sentence is how a menu turns into a
 * list nobody reads. Order on screen follows the order the decisions are made
 * in: the points, then how that one game finishes, then how many such games
 * make an evening.
 *
 * ── NO FREE FIELDS LEFT — DECISION (2026-09-08, user request) ──────────────
 * The series length lost its "Vlastiti broj igara" field first: the chips only
 * WROTE into it, it could then be edited to something else, and the same
 * setting had two controls that could disagree in front of you. The points
 * target has now lost "Vlastiti broj" for the same reason — the three chips are
 * the whole choice on this screen. The BACKEND still accepts any target; this
 * is the UI narrowing, not a new rule.
 *
 * ── AND A STORED TARGET IS NEVER SILENTLY REWRITTEN ────────────────────────
 * A game already playing to 900 keeps 900. The dialog seeds itself from the
 * stored value, and if that value is not one of the three chips then NO chip is
 * pressed — an honest "none of these" rather than a highlighted 1001 that
 * nobody chose. Saving without touching a chip therefore saves the number that
 * was already there. Removing a field must not be able to move a score.
 *
 * The series is OPEN-ENDED by default, and that is a first-class choice in
 * here, not the absence of one: an explicit "Otvorena" button sits in front of
 * 1 / 2 / 3. Open-ended is what a blok has always been — games keep coming
 * until somebody taps "Resetiraj" — so the way back to it must be as visible
 * as the way out of it. The same is true one section up: "Prolaz" is the
 * default (BLOK-HISTORY.md §5.5), so it is first.
 *
 * The preset buttons are `aria-pressed` toggles rather than a radio group so
 * the current value is announced without a fieldset wrapper around four
 * one-word labels.
 *
 * ── AND TWO AGREEMENTS ABOUT THE DEAL — 2026-09-08, user request ───────────
 * "Sljedeći dijeli" (does the tracker strip show at all — ON by default) and
 * "Smjer kartanja" (which way the deal goes round — "desno" by default) join
 * them, for the reason everything else in here joined: they are settled once,
 * out loud, before the first deal, in the same breath as "do 1001, na prolaz".
 *
 * Six sections is more than a small phone holds, so each switch carries its own
 * heading INSTEAD of one — label left, control right, one row for the whole
 * setting — and the body has scrolled since the third section arrived
 * (`scrollBehavior="inside"`). Nothing else was made shorter; the dialog is a
 * list of agreements, and shrinking the ones that were already here to fit new
 * ones would be paying for the new settings with the old.
 *
 * ── AND SHARING IS ONE OF THE AGREEMENTS — 2026-09-08, user request ────────
 * "Omogući dijeljenje", ON by default. It used to be a menu item ("Prekini
 * dijeljenje") that only appeared once a link existed — a control you could
 * only find by having already used the thing it turns off. As a switch it says
 * what the state IS, before anybody taps anything: off, the share button is not
 * offered and a token the player issued is revoked (the page does that half —
 * this dialog never talks to a server).
 *
 * `linked` is the exception, and it is stated on screen rather than hidden in a
 * comment: a series linked to a tournament table is published for the organiser
 * under the same token (BLOK-LINK.md §6.2), so turning sharing off can hide the
 * button but must never pull that record out from under the bracket.
 */
export function TargetDialog({
    open,
    target,
    seriesTarget,
    gameEndRule,
    showDealer,
    dealDirection,
    shareEnabled,
    linked,
    onSave,
    onCancel,
}: {
    open: boolean
    target: number
    /** null = open-ended, the default. */
    seriesTarget: number | null
    /** How ONE game ends — "dosta" (default) or "prolaz", BLOK.md §3.5. */
    gameEndRule: BlokGameEndRule
    /** Is the "Sljedeći dijeli" strip shown? True by default — BLOK.md §3.3.2. */
    showDealer: boolean
    /** Which way the deal goes round the table — "right" (default) or "left". */
    dealDirection: BlokDealDirection
    /** Is the share control offered at all? True by default — BLOK.md §3.3.3. */
    shareEnabled: boolean
    /** True while this series is linked to a tournament table. Only adds the
     *  sentence saying that record stays public whatever this switch says. */
    linked: boolean
    /** One object, not seven positional arguments: this dialog saves a whole
     *  agreement at once, and a call site of seven bare values is where the
     *  wrong two get swapped. */
    onSave: (next: {
        target: number
        seriesTarget: number | null
        gameEndRule: BlokGameEndRule
        showDealer: boolean
        dealDirection: BlokDealDirection
        shareEnabled: boolean
    }) => void
    onCancel: () => void
}) {
    const { t } = useTranslation()
    const tp = usePlural()
    /** The points target as a NUMBER, seeded from the game. With the free field
     *  gone there is no text to parse, and — the point of it being seeded
     *  rather than defaulted — a stored 900 stays 900 unless a chip is tapped. */
    const [value, setValue] = useState<number>(target)
    /** null = open-ended. A number, not a string: with the free field gone the
     *  only values that exist are the four chips. */
    const [series, setSeries] = useState<number | null>(seriesTarget)
    const [rule, setRule] = useState<BlokGameEndRule>(gameEndRule)
    /** Does the "Sljedeći dijeli" strip show — on by default. */
    const [tracker, setTracker] = useState<boolean>(showDealer)
    const [direction, setDirection] = useState<BlokDealDirection>(dealDirection)
    /** Is the share control offered — on by default. */
    const [sharing, setSharing] = useState<boolean>(shareEnabled)

    useEffect(() => {
        if (open) {
            setValue(target)
            setSeries(seriesTarget)
            setRule(gameEndRule)
            setTracker(showDealer)
            setDirection(dealDirection)
            setSharing(shareEnabled)
        }
    }, [open, target, seriesTarget, gameEndRule, showDealer, dealDirection, shareEnabled])

    return (
        <Dialog.Root
            open={open}
            onOpenChange={(e) => { if (!e.open) onCancel() }}
            placement="center"
            // Three sections of chips no longer fit a small phone in landscape
            // — scroll the body rather than the page behind the dialog.
            scrollBehavior="inside"
        >
            <Portal>
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content maxW={{ base: "92%", md: "sm" }}>
                        <Dialog.Header>
                            <Dialog.Title>{t("blok.target.title")}</Dialog.Title>
                        </Dialog.Header>
                        <Dialog.Body>
                            <Text
                                fontSize="2xs"
                                fontWeight="bold"
                                textTransform="uppercase"
                                letterSpacing="0.08em"
                                color="fg.subtle"
                                mb="2"
                            >
                                {t("blok.target.points")}
                            </Text>
                            <HStack gap="2" mb="3">
                                {TARGETS.map((preset) => (
                                    <Button
                                        key={preset}
                                        flex="1"
                                        size="lg"
                                        variant={value === preset ? "solid" : "outline"}
                                        colorPalette="brand"
                                        // Nothing is pressed when the game is
                                        // playing to a number that is not one of
                                        // the three. That is deliberate: see the
                                        // header note — a stored 900 must not be
                                        // shown, or saved, as 1001.
                                        aria-pressed={value === preset}
                                        onClick={() => setValue(preset)}
                                    >
                                        {preset}
                                    </Button>
                                ))}
                            </HStack>

                            <Separator my="4" />

                            <Separator my="4" />

                            <Text
                                fontSize="2xs"
                                fontWeight="bold"
                                textTransform="uppercase"
                                letterSpacing="0.08em"
                                color="fg.subtle"
                                mb="2"
                            >
                                {t("blok.series.playTo")}
                            </Text>
                            <HStack gap="2" mb="2">
                                {/* First, and wider than the digits: this is
                                    what a blok does by default and what the
                                    other three opt OUT of. */}
                                <Button
                                    flex="1.6"
                                    size="lg"
                                    variant={series === null ? "solid" : "outline"}
                                    colorPalette="brand"
                                    aria-pressed={series === null}
                                    onClick={() => setSeries(null)}
                                >
                                    {t("blok.series.open")}
                                </Button>
                                {SERIES_TARGETS.map((preset) => (
                                    <Button
                                        key={preset}
                                        flex="1"
                                        size="lg"
                                        variant={series === preset ? "solid" : "outline"}
                                        colorPalette="brand"
                                        aria-pressed={series === preset}
                                        // The face is a bare digit; what it MEANS
                                        // is "the series goes to N won games", and
                                        // that goes through the plural family.
                                        aria-label={tp("blok.series.games", preset)}
                                        onClick={() => setSeries(preset)}
                                    >
                                        {preset}
                                    </Button>
                                ))}
                            </HStack>
                            {/* Only the sentence that says where a series with
                                a TARGET ends. `series.hintOpen` — "Serija traje
                                dok je ne zatvoriš „Resetiraj”…" — is deleted
                                from both dictionaries (user request,
                                2026-09-08): "Otvorena" is already pressed right
                                above it, and a paragraph explaining the button
                                you just chose is the same kind of noise the
                                rule hints were. */}
                            {series === null ? null : (
                                <Text fontSize="xs" color="fg.muted">
                                    {t("blok.series.hint", {
                                        games: tp("blok.series.games", series),
                                    })}
                                </Text>
                            )}

                            <Separator my="4" />

                            {/* AFTER the series, not before it — the two
                                numbers ("do 1001", "do 2 dobivene") belong
                                together, and this is the qualifier on the first
                                of them. Swapped 2026-09-08 at the user's
                                request.

                                A SWITCH, not two buttons: there are exactly two
                                readings and one is the default, which is what a
                                switch is for. The active word is printed beside
                                it, so nobody has to work out what "on" means —
                                which is the one real risk of using a switch for
                                a named pair. */}
                            <ChoiceSwitchRow
                                label={t("blok.rule.title")}
                                value={t(rule === "prolaz" ? "blok.rule.prolaz" : "blok.rule.dosta")}
                                checked={rule === "prolaz"}
                                onCheckedChange={(next) => setRule(next ? "prolaz" : "dosta")}
                            />

                            <Separator my="4" />

                            {/* The switch carries its own heading rather than
                                sitting under one: label left, control right,
                                44px of row — one line for a setting that would
                                otherwise cost three on a phone that is already
                                scrolling. Styled like the headings around it so
                                the sections still read as a list. */}
                            <Switch.Root
                                checked={tracker}
                                onCheckedChange={(e) => setTracker(e.checked)}
                                colorPalette="brand"
                                display="flex"
                                alignItems="center"
                                justifyContent="space-between"
                                gap="4"
                                w="full"
                                minH="44px"
                            >
                                <Switch.HiddenInput />
                                <Switch.Label
                                    flex="1"
                                    minW="0"
                                    fontSize="2xs"
                                    fontWeight="bold"
                                    textTransform="uppercase"
                                    letterSpacing="0.08em"
                                    color="fg.subtle"
                                >
                                    {/* The same words the strip itself uses —
                                        one key, so the switch can never end up
                                        naming something the screen does not
                                        call by that name. */}
                                    {t("blok.dealer.next")}
                                </Switch.Label>
                                <Switch.Control flexShrink={0}>
                                    <Switch.Thumb />
                                </Switch.Control>
                            </Switch.Root>

                            <Separator my="4" />

                            {/* Kept visible even when the strip is off: the
                                direction is what the table agreed, not what the
                                tracker displays, and hiding a setting behind
                                another setting is how people stop finding it. */}
                            <ChoiceSwitchRow
                                label={t("blok.dealer.direction")}
                                value={t(direction === "right" ? "blok.dealer.right" : "blok.dealer.left")}
                                checked={direction === "right"}
                                onCheckedChange={(next) => setDirection(next ? "right" : "left")}
                            />

                            <Separator my="4" />

                            {/* Same one-row shape as the tracker switch above:
                                the label IS the heading. Off means the share
                                button is not offered and a token this player
                                issued is revoked — the page does the revoking,
                                on save. */}
                            <Switch.Root
                                checked={sharing}
                                onCheckedChange={(e) => setSharing(e.checked)}
                                colorPalette="brand"
                                display="flex"
                                alignItems="center"
                                justifyContent="space-between"
                                gap="4"
                                w="full"
                                minH="44px"
                            >
                                <Switch.HiddenInput />
                                <Switch.Label
                                    flex="1"
                                    minW="0"
                                    fontSize="2xs"
                                    fontWeight="bold"
                                    textTransform="uppercase"
                                    letterSpacing="0.08em"
                                    color="fg.subtle"
                                >
                                    {t("blok.share.enable")}
                                </Switch.Label>
                                <Switch.Control flexShrink={0}>
                                    <Switch.Thumb />
                                </Switch.Control>
                            </Switch.Root>
                            {/* Only while a table link exists, and only then:
                                the organiser opens this series' logbook from
                                the bracket under the very same token
                                (BLOK-LINK.md §6.2), so this switch can hide the
                                button but will not take that record away.
                                Saying it here, where the choice is made, rather
                                than in a toast after it. */}
                            {linked ? (
                                <Text mt="2" fontSize="xs" color="fg.muted">
                                    {t("blok.share.linkedNote")}
                                </Text>
                            ) : null}
                        </Dialog.Body>
                        <Dialog.Footer gap="2">
                            <Button variant="ghost" onClick={onCancel}>
                                {t("common.cancel")}
                            </Button>
                            {/* No `disabled` guard any more: with the free field
                                gone the value can only be a chip or the number
                                the game already had, and both are valid by
                                construction. */}
                            <Button
                                colorPalette="brand"
                                onClick={() =>
                                    onSave({
                                        target: value,
                                        seriesTarget: series,
                                        gameEndRule: rule,
                                        showDealer: tracker,
                                        dealDirection: direction,
                                        shareEnabled: sharing,
                                    })
                                }
                            >
                                {t("common.save")}
                            </Button>
                        </Dialog.Footer>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Portal>
        </Dialog.Root>
    )
}

/* The games of this series used to live here as `ArchiveDialog` — a dialog off
   a menu item called "Odigrane partije". Both are gone (BLOK-HISTORY.md §5.3,
   §5.4): the list now lives inside the score card, behind the chevron under the
   divider, as `components/BlokSeriesGames.tsx`.

   The reason is the one the user gave. A dialog is a place of its own, and a
   place of its own invited the comparison that confused him: he opened this
   list and the profile's "Blok" section side by side and asked why one had rows
   and the other was empty. They are two levels of the same thing — this device
   holds the games of the CURRENT series, the profile holds SAVED series — and
   nothing about a modal said so. Under the score, it can only be read as more
   of the scoreboard.

   The `archive.*` i18n keys survive the move and are read by the new component:
   they were always about "the games of this series", which is exactly what the
   panel still shows. */
