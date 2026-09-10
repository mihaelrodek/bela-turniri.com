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
    Text,
    VStack,
} from "@chakra-ui/react"
import {
    FiLink2,
    FiMoreVertical,
    FiPlusCircle,
    FiSettings,
    FiTrash2,
    FiX,
} from "react-icons/fi"

import { usePlural, useTranslation } from "../../i18n"
import {
    BLOK_SIDES,
    MAX_SIDE_NAME,
    SERIES_TARGETS,
    TARGETS,
    type BlokDealDirection,
    type BlokNewGameDealer,
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
                    {/* Wider than "sm" (2026-09-09, user request): six rows of
                        label-plus-control need room, and "NOVU PARTIJU MIJEŠA"
                        beside two words was wrapping to two lines. */}
                    <Dialog.Content maxW={{ base: "95%", md: "md" }}>
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
                                            maxLength={MAX_SIDE_NAME}
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
 * A two-way setting, on ONE ROW: heading left, the two faces right.
 *
 * It used to be a heading with a full-width segment under it — three rows of
 * dialog for one word of meaning, three times over. The switches beside it
 * ("Sljedeći dijeli", "Omogući dijeljenje") had always been one row each, so
 * the dialog read as two different kinds of setting when it holds only one:
 * table agreements, each a label and a control. Now all six line up
 * (2026-09-09, user request).
 *
 * The label is allowed to WRAP rather than truncate — "NOVU PARTIJU MIJEŠA"
 * beside "Sljedeći / Pobjednik" is the tightest row in here, and a clipped
 * heading is worse than a two-line one. The segment never shrinks.
 */
function SegmentedChoice<T extends string>({
    label,
    value,
    options,
    onValueChange,
}: {
    label: string
    value: T
    options: readonly { value: T; label: string }[]
    onValueChange: (value: T) => void
}) {
    return (
        <HStack gap="3" w="full" minH="44px" align="center" justify="space-between">
            <Text
                flex="1"
                minW="0"
                fontSize="2xs"
                fontWeight="bold"
                textTransform="uppercase"
                letterSpacing="0.08em"
                color="fg.subtle"
            >
                {label}
            </Text>
            <HStack
                role="group"
                aria-label={label}
                gap="1"
                p="1"
                flexShrink={0}
                rounded="xl"
                bg="bg.subtle"
                borderWidth="1px"
                borderColor="border.subtle"
            >
                {options.map((option) => {
                    const selected = option.value === value
                    return (
                        <Button
                            key={option.value}
                            type="button"
                            size="sm"
                            px="3"
                            rounded="lg"
                            colorPalette="brand"
                            variant={selected ? "solid" : "ghost"}
                            aria-pressed={selected}
                            onClick={() => onValueChange(option.value)}
                        >
                            {option.label}
                        </Button>
                    )
                })}
            </HStack>
        </HStack>
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
/** What one tap in "Postavke" changes. Every field optional: a control sends
 *  only its own, and everything else is left where it was. */
export interface BlokSettingsPatch {
    target?: number
    seriesTarget?: number | null
    gameEndRule?: BlokGameEndRule
    showDealer?: boolean
    dealDirection?: BlokDealDirection
    newGameDealer?: BlokNewGameDealer
    shareEnabled?: boolean
}

export function TargetDialog({
    open,
    target,
    seriesTarget,
    gameEndRule,
    showDealer,
    dealDirection,
    newGameDealer,
    shareEnabled,
    linked,
    onChange,
    onClose,
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
    /** Who deals the first deal of the NEXT game — BLOK.md §3.3.4. */
    newGameDealer: BlokNewGameDealer
    /** Is the share control offered at all? True by default — BLOK.md §3.3.3. */
    shareEnabled: boolean
    /** True while this series is linked to a tournament table. Only adds the
     *  sentence saying that record stays public whatever this switch says. */
    linked: boolean
    /** Applied the moment a control is touched — see the header note. */
    onChange: (patch: BlokSettingsPatch) => void
    onClose: () => void
}) {
    const { t } = useTranslation()
    const tp = usePlural()

    return (
        <Dialog.Root
            open={open}
            onOpenChange={(e) => { if (!e.open) onClose() }}
            placement="center"
            scrollBehavior="inside"
        >
            <Portal>
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    {/* Wider than "sm" (2026-09-09, user request): six rows of
                        label-plus-control need room, and "NOVU PARTIJU MIJEŠA"
                        beside two words was wrapping to two lines. */}
                    <Dialog.Content maxW={{ base: "95%", md: "md" }}>
                        <Dialog.Header>
                            <Dialog.Title>{t("blok.target.title")}</Dialog.Title>
                            {/* The only way out, and there is nothing to
                                confirm on the way (see the header note). */}
                            <Dialog.CloseTrigger asChild>
                                <IconButton
                                    size="sm"
                                    variant="ghost"
                                    aria-label={t("common.close")}
                                    onClick={onClose}
                                >
                                    <FiX />
                                </IconButton>
                            </Dialog.CloseTrigger>
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
                                        variant={target === preset ? "solid" : "outline"}
                                        colorPalette="brand"
                                        // Nothing is pressed when the game is
                                        // playing to a number that is not one
                                        // of the three — a stored 900 must not
                                        // be shown, or saved, as 1001.
                                        aria-pressed={target === preset}
                                        onClick={() => onChange({ target: preset })}
                                    >
                                        {preset}
                                    </Button>
                                ))}
                            </HStack>

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
                            {/* No sentence under the chips (2026-09-09, user
                                request). "Seriju dobiva strana koja prva skupi
                                1 dobivenu igru" is the pressed button read back
                                as a paragraph, and it moved every time somebody
                                tapped — noise where a choice had just been made. */}
                            <HStack gap="2">
                                {/* First, and wider than the digits: this is
                                    what a blok does by default and what the
                                    other three opt OUT of. */}
                                {/* The word takes whatever the digits do not
                                    (2026-09-09: "Neograničeno" was overflowing
                                    its box). `flex="1" minW="0"` plus a step
                                    down in type keeps it on one line; the
                                    three digits stop stretching and become as
                                    wide as a digit needs. */}
                                <Button
                                    flex="1"
                                    minW="0"
                                    px="2"
                                    size="lg"
                                    fontSize={{ base: "sm", md: "md" }}
                                    variant={seriesTarget === null ? "solid" : "outline"}
                                    colorPalette="brand"
                                    aria-pressed={seriesTarget === null}
                                    onClick={() => onChange({ seriesTarget: null })}
                                >
                                    {t("blok.series.open")}
                                </Button>
                                {SERIES_TARGETS.map((preset) => (
                                    <Button
                                        key={preset}
                                        flex="0 0 auto"
                                        minW="2.75rem"
                                        px="0"
                                        size="lg"
                                        variant={seriesTarget === preset ? "solid" : "outline"}
                                        colorPalette="brand"
                                        aria-pressed={seriesTarget === preset}
                                        // The face is a bare digit; what it
                                        // MEANS is "the series goes to N won
                                        // games", and that goes through the
                                        // plural family.
                                        aria-label={tp("blok.series.games", preset)}
                                        onClick={() => onChange({ seriesTarget: preset })}
                                    >
                                        {preset}
                                    </Button>
                                ))}
                            </HStack>

                            <Separator my="4" />

                            <SegmentedChoice
                                label={t("blok.rule.title")}
                                value={gameEndRule}
                                options={[
                                    { value: "prolaz", label: t("blok.rule.prolaz") },
                                    { value: "dosta", label: t("blok.rule.dosta") },
                                ]}
                                onValueChange={(rule) => onChange({ gameEndRule: rule })}
                            />

                            <Separator my="4" />

                            {/* Kept visible even when the strip is off: the
                                direction is what the table agreed, not what the
                                tracker displays, and hiding a setting behind
                                another setting is how people stop finding it. */}
                            <SegmentedChoice
                                label={t("blok.dealer.direction")}
                                value={dealDirection}
                                options={[
                                    { value: "left", label: t("blok.dealer.left") },
                                    { value: "right", label: t("blok.dealer.right") },
                                ]}
                                onValueChange={(direction) => onChange({ dealDirection: direction })}
                            />

                            <Separator my="4" />

                            {/* Where the deal picks up for the NEXT game
                                (BLOK.md §3.3.4). It sits directly under the
                                direction because it does not replace it — the
                                rotation still moves the same way, "Pobjednik"
                                only keeps it stepping until it reaches the
                                pair that won. */}
                            <SegmentedChoice
                                label={t("blok.dealer.newGame")}
                                value={newGameDealer}
                                options={[
                                    { value: "next", label: t("blok.dealer.newGameNext") },
                                    { value: "winner", label: t("blok.dealer.newGameWinner") },
                                ]}
                                onValueChange={(mode) => onChange({ newGameDealer: mode })}
                            />

                            <Separator my="4" />

                            {/* SECOND FROM LAST (2026-09-09, user request):
                                whether the tracker strip shows is the smallest
                                of these agreements and the one changed least
                                often, so it sits at the end of the list rather
                                than in the middle of the ones about how the
                                deal actually goes round. */}
                            {/* NE / DA rather than a switch (2026-09-09, user request): a
                                switch asks you to know which side means on. Two
                                words say it, and the row now has the same shape as
                                the settings above it. */}
                            <SegmentedChoice
                                label={t("blok.dealer.next")}
                                value={showDealer ? "yes" : "no"}
                                options={[
                                    { value: "no", label: t("common.no") },
                                    { value: "yes", label: t("common.yes") },
                                ]}
                                onValueChange={(v) => onChange({ showDealer: v === "yes" })}
                            />

                            <Separator my="4" />

                            {/* Off means the share button is not offered and a
                                token this player issued is revoked — the page
                                does the revoking. */}
                            {/* Same NE / DA shape. Off means the share button is not
                                offered and a token this player issued is revoked —
                                the page does the revoking. */}
                            <SegmentedChoice
                                label={t("blok.share.enable")}
                                value={shareEnabled ? "yes" : "no"}
                                options={[
                                    { value: "no", label: t("common.no") },
                                    { value: "yes", label: t("common.yes") },
                                ]}
                                onValueChange={(v) => onChange({ shareEnabled: v === "yes" })}
                            />
                            {/* Only while a table link exists: the organiser
                                opens this series' logbook from the bracket
                                under the very same token (BLOK-LINK.md §6.2),
                                so this switch can hide the button but will not
                                take that record away. */}
                            {linked ? (
                                <Text mt="2" fontSize="xs" color="fg.muted">
                                    {t("blok.share.linkedNote")}
                                </Text>
                            ) : null}
                        </Dialog.Body>
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
