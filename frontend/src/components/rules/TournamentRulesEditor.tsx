import { useState, type ReactNode } from "react"
import { Badge, Box, Button, chakra, Dialog, Field, HStack, IconButton, NativeSelect, Portal, Text, Textarea, VStack } from "@chakra-ui/react"
import {
    FiAlertTriangle,
    FiAward,
    FiChevronDown,
    FiChevronRight,
    FiClock,
    FiEdit2,
    FiLock,
    FiFlag,
    FiLayers,
    FiPlus,
    FiRotateCcw,
    FiSettings,
    FiShuffle,
    FiTrash2,
    FiUsers,
} from "react-icons/fi"
import { usePlural, useTranslation } from "../../i18n"
import { sanitizeInt } from "../../utils/format"
import {
    DEFAULT_MATCH_GAMES,
    DEFAULT_ROUND_MINUTES,
    PENALTY_CODES,
    PENALTY_LABEL_KEY,
    PENALTY_TONE,
    RULES_LIMITS,
    addCustomFoul,
    addCustomItem,
    countCustomisations,
    defaultFoulText,
    defaultItemText,
    removeFoul,
    removeItem,
    resolveRules,
    restoreFoul,
    restoreItem,
    setFoulPenalty,
    setFoulText,
    setItemText,
    setMatchGames,
    setNextDealer,
    setRoundMinutes,
    type ItemSection,
    type PenaltyCode,
    type ResolvedItem,
    type RuleSectionKey,
    type StoredRules,
} from "../../utils/tournamentRules"
import type { TournamentForm } from "../../utils/tournamentForm"
import ConfirmDialog from "../ConfirmDialog"
import SuffixInput from "../SuffixInput"

/* ──────────────────────────────────────────────────────────────────────────
   TournamentRulesEditor — the "Pravila turnira" step of the create wizard and
   the matching card of the edit form (2026-10-03, owner request). ONE
   component for both, driven by the same two props the forms already have:
   the form's `rules` (sparse stored document, null = defaults) and its five
   game-parameter fields.

   Top: the five game-rule controls, moved here from the pricing step / fees
   card (their columns stay the source of truth). Below: one collapsible group
   per rulebook section. Rules are applied automatically — a fresh tournament
   has `rules = null` and shows the full global rulebook; nothing to click.
   Each rule's text is edited inline, can be deleted, and a foul carries its
   own penalty dropdown; "Dodaj pravilo" appends a custom one; "Vrati zadana
   pravila" (confirmed) drops every change. Every operation is a pure
   function of `utils/tournamentRules`, which keeps the document pruned, so
   the state here is always the minimal document that will be saved.
   ────────────────────────────────────────────────────────────────────── */

/** The five game-rule columns, typed as the form holds them; `onGameChange`
 *  takes a partial patch of them. Structurally a GameParams. */
type GameFields = Pick<TournamentForm, "targetScore" | "gameEndRule" | "dealDirection" | "declarationsEnabled" | "allowBela">

const GROUPS: { key: RuleSectionKey; icon: ReactNode }[] = [
    { key: "game", icon: <FiFlag /> },
    { key: "deal", icon: <FiShuffle /> },
    { key: "trump", icon: <FiLayers /> },
    { key: "decl", icon: <FiAward /> },
    { key: "foul", icon: <FiAlertTriangle /> },
    { key: "tour", icon: <FiClock /> },
    { key: "conduct", icon: <FiUsers /> },
]

/** The segmented "pick one" box used for each of the five game rules. */
function ChoiceField<V extends string | number | boolean>({
    label,
    value,
    options,
    onPick,
    mono,
    wide,
}: {
    label: string
    value: V
    options: { value: V; label: string }[]
    onPick: (v: V) => void
    mono?: boolean
    wide?: boolean
}) {
    return (
        <Field.Root
            gridColumn={wide ? { base: "auto", md: "1 / -1" } : undefined}
            borderWidth="1px"
            borderColor="border.subtle"
            bg="bg.subtle"
            rounded="l2"
            // Compact (2026-10-03, owner): from md up the label and its buttons
            // share ONE line instead of stacking, and the box is tighter.
            px="3"
            py="2"
            display="flex"
            flexDirection={{ base: "column", md: "row" }}
            alignItems={{ base: "stretch", md: "center" }}
            gap={{ base: "1.5", md: "3" }}
        >
            <Field.Label whiteSpace="nowrap" minW={{ md: "7.5rem" }} m="0">{label}</Field.Label>
            <HStack gap="1.5" maxW={wide ? { base: "full", md: "260px" } : undefined} w="full" flex="1">
                {options.map((o) => (
                    <Button
                        key={String(o.value)}
                        flex="1"
                        size="xs"
                        h="8"
                        colorPalette="brand"
                        fontFamily={mono ? "mono" : undefined}
                        fontVariantNumeric={mono ? "tabular-nums" : undefined}
                        variant={value === o.value ? "solid" : "outline"}
                        aria-pressed={value === o.value}
                        onClick={() => onPick(o.value)}
                    >
                        {o.label}
                    </Button>
                ))}
            </HStack>
        </Field.Root>
    )
}

function PenaltySelect({ value, onChange }: { value: PenaltyCode; onChange: (p: PenaltyCode) => void }) {
    const { t } = useTranslation()
    const tone = PENALTY_TONE[value]
    return (
        <NativeSelect.Root size="sm" w={{ base: "full", md: "240px" }} flexShrink={0}>
            <NativeSelect.Field
                aria-label={t("forms.createTournament.rules.penaltyLabel")}
                value={value}
                onChange={(e) => onChange(e.target.value as PenaltyCode)}
                bg={tone.bg}
                color={tone.fg}
                fontWeight="semibold"
            >
                {PENALTY_CODES.map((code) => (
                    <option key={code} value={code}>
                        {t(`legal.rules.foul.penalty.${PENALTY_LABEL_KEY[code]}`)}
                    </option>
                ))}
            </NativeSelect.Field>
            <NativeSelect.Indicator />
        </NativeSelect.Root>
    )
}

/** Inline text editor: a textarea with Spremi / Odustani. Esc cancels, Ctrl/Cmd+Enter saves. */
function TextEditor({
    initial,
    placeholder,
    submitLabel,
    onSubmit,
    onCancel,
    extra,
}: {
    initial: string
    placeholder?: string
    submitLabel: string
    onSubmit: (text: string) => void
    onCancel: () => void
    extra?: ReactNode
}) {
    const { t } = useTranslation()
    const [draft, setDraft] = useState(initial)
    const empty = draft.trim() === ""
    return (
        <VStack align="stretch" gap="2" flex="1" minW="0">
            <Textarea
                autoFocus
                size="sm"
                rows={3}
                maxLength={RULES_LIMITS.maxText}
                value={draft}
                placeholder={placeholder}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Escape") {
                        e.preventDefault()
                        onCancel()
                    } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !empty) {
                        e.preventDefault()
                        onSubmit(draft)
                    }
                }}
            />
            <HStack gap="2" wrap="wrap" justify="space-between">
                <HStack gap="2">
                    <Button size="xs" colorPalette="brand" disabled={empty} onClick={() => onSubmit(draft)}>
                        {submitLabel}
                    </Button>
                    <Button size="xs" variant="ghost" onClick={onCancel}>
                        {t("common.cancel")}
                    </Button>
                </HStack>
                <Text fontSize="2xs" color="fg.muted" fontFamily="mono">
                    {draft.length}/{RULES_LIMITS.maxText}
                </Text>
            </HStack>
            {extra}
        </VStack>
    )
}

/** Has the intro popup been confirmed during this page load? Module-level so
 *  it survives the editor unmounting between wizard steps. */
let introAcknowledged = false

export default function TournamentRulesEditor({
    rules,
    onRulesChange,
    game,
    onGameChange,
    introPopup = false,
}: {
    rules: StoredRules | null
    onRulesChange: (next: StoredRules | null) => void
    game: GameFields
    onGameChange: (patch: Partial<GameFields>) => void
    /** Open the explanation as a popup that must be confirmed ("U redu") the
     *  moment the editor appears — the create wizard's step. Once per page
     *  load (`introAcknowledged`), so stepping back and forth does not nag. */
    introPopup?: boolean
}) {
    const { t } = useTranslation()
    const plural = usePlural()
    const [introOpen, setIntroOpen] = useState(introPopup && !introAcknowledged)
    const r = (key: string, params?: Record<string, string | number>) => t(`forms.createTournament.rules.${key}`, params)

    // The editor shows EVERY default rule, even the declaration ones a "no
    // declarations" tournament hides in the public document: the organiser may
    // flip that switch back.
    const resolved = resolveRules(rules, t, game, { includeRemoved: true, plural })
    const changed = countCustomisations(rules)

    const [open, setOpen] = useState<Set<RuleSectionKey>>(() => new Set<RuleSectionKey>(["foul"]))
    const [editing, setEditing] = useState<string | null>(null) // `${group}:${id}`
    const [adding, setAdding] = useState<RuleSectionKey | null>(null)
    const [addPenalty, setAddPenalty] = useState<PenaltyCode>("WARNING")
    const [resetOpen, setResetOpen] = useState(false)
    // Draft of the round-length field; null = mirror the stored value.
    const [minutesDraft, setMinutesDraft] = useState<string | null>(null)

    const toggle = (key: RuleSectionKey) =>
        setOpen((prev) => {
            const next = new Set(prev)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
        })

    const itemsOf = (key: RuleSectionKey): (ResolvedItem & { penalty?: PenaltyCode; penaltyChanged?: boolean })[] =>
        key === "foul" ? resolved.fouls : resolved.sections[key]

    const customCount = (key: RuleSectionKey) => itemsOf(key).filter((i) => !i.isDefault).length

    const commitMinutes = () => {
        if (minutesDraft == null) return
        const n = minutesDraft.trim() === "" ? null : parseInt(minutesDraft, 10)
        onRulesChange(setRoundMinutes(rules, n))
        setMinutesDraft(null)
    }

    function renderRow(group: RuleSectionKey, item: ResolvedItem & { penalty?: PenaltyCode; penaltyChanged?: boolean }, index: number, shownNumber: number) {
        const rowKey = `${group}:${item.id}`
        const isFoul = group === "foul"
        const defaultText = !item.isDefault
            ? null
            : isFoul
              ? defaultFoulText(item.id, t)
              : defaultItemText(item.id, t, game, { ...resolved, plural })
        const edited = item.edited || !!item.penaltyChanged

        // Rules derived from the settings above (2026-10-03, owner): shown with
        // a lock and an "Iz postavki" badge, no edit, no delete, nothing to
        // restore. To change one, change the setting it comes from.
        if (item.fixed) {
            return (
                <HStack key={item.id} align="start" gap="2.5" py="2" borderTopWidth={index === 0 ? "0" : "1px"} borderColor="border.subtle">
                    <Box
                        flexShrink={0}
                        boxSize="22px"
                        rounded="full"
                        bg="brand.subtle"
                        color="brand.fg"
                        fontSize="xs"
                        fontWeight="bold"
                        fontFamily="mono"
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        mt="1px"
                        aria-hidden="true"
                    >
                        {shownNumber + 1}
                    </Box>
                    <Text flex="1" minW="0" fontSize="sm" lineHeight="1.5" color="fg.soft" whiteSpace="pre-line" overflowWrap="anywhere">
                        {item.text}
                        <Badge ml="2" size="xs" colorPalette="gray" variant="subtle" verticalAlign="middle">
                            <FiLock /> {r("fromSettings")}
                        </Badge>
                    </Text>
                </HStack>
            )
        }

        // A deleted default rule stays in its place, greyed out and struck
        // through, with a single "Vrati" — so one wrong click is one click to
        // undo, without resetting everything to the defaults (2026-10-03, owner).
        if (item.removed) {
            return (
                <HStack key={item.id} align="center" gap="2.5" py="2" borderTopWidth={index === 0 ? "0" : "1px"} borderColor="border.subtle" opacity={0.6}>
                    <Box flexShrink={0} boxSize="22px" aria-hidden="true" />
                    <Text flex="1" minW="0" fontSize="sm" lineHeight="1.5" color="fg.muted" textDecoration="line-through" whiteSpace="pre-line" overflowWrap="anywhere">
                        {item.text}
                    </Text>
                    <Button
                        size="xs"
                        variant="outline"
                        flexShrink={0}
                        onClick={() => onRulesChange(isFoul ? restoreFoul(rules, item.id) : restoreItem(rules, group as ItemSection, item.id))}
                    >
                        <FiRotateCcw /> {r("restore")}
                    </Button>
                </HStack>
            )
        }

        return (
            <HStack key={item.id} align="start" gap="2.5" py="2" borderTopWidth={index === 0 ? "0" : "1px"} borderColor="border.subtle">
                <Box
                    flexShrink={0}
                    boxSize="22px"
                    rounded="full"
                    bg="brand.subtle"
                    color="brand.fg"
                    fontSize="xs"
                    fontWeight="bold"
                    fontFamily="mono"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    mt="1px"
                    aria-hidden="true"
                >
                    {shownNumber + 1}
                </Box>

                {editing === rowKey ? (
                    <TextEditor
                        initial={item.text}
                        submitLabel={t("common.save")}
                        onCancel={() => setEditing(null)}
                        onSubmit={(text) => {
                            onRulesChange(
                                isFoul
                                    ? setFoulText(rules, item.id, text, defaultText, item.penalty ?? "WARNING")
                                    : setItemText(rules, group as ItemSection, item.id, text, defaultText),
                            )
                            setEditing(null)
                        }}
                    />
                ) : (
                    <>
                        <VStack align="stretch" gap="1.5" flex="1" minW="0">
                            <chakra.button
                                type="button"
                                textAlign="left"
                                fontSize="sm"
                                lineHeight="1.5"
                                color="fg.soft"
                                whiteSpace="pre-line"
                                overflowWrap="anywhere"
                                cursor="text"
                                rounded="md"
                                _hover={{ bg: "bg.subtle" }}
                                _focusVisible={{ outline: "2px solid", outlineColor: "brand.solid" }}
                                aria-label={`${r("edit")}: ${item.text}`}
                                onClick={() => setEditing(rowKey)}
                            >
                                {item.text}
                                {edited && (
                                    <Badge ml="2" size="xs" colorPalette="orange" variant="subtle" verticalAlign="middle">
                                        {r("edited")}
                                    </Badge>
                                )}
                                {!item.isDefault && (
                                    <Badge ml="2" size="xs" colorPalette="brand" variant="subtle" verticalAlign="middle">
                                        {r("added")}
                                    </Badge>
                                )}
                            </chakra.button>
                            {isFoul && item.penalty && (
                                <PenaltySelect
                                    value={item.penalty}
                                    onChange={(p) => onRulesChange(setFoulPenalty(rules, item.id, p))}
                                />
                            )}
                        </VStack>
                        <HStack gap="0.5" flexShrink={0}>
                            <IconButton
                                size="xs"
                                variant="ghost"
                                aria-label={r("edit")}
                                onClick={() => setEditing(rowKey)}
                            >
                                <FiEdit2 />
                            </IconButton>
                            <IconButton
                                size="xs"
                                variant="ghost"
                                colorPalette="red"
                                aria-label={r("delete")}
                                onClick={() =>
                                    onRulesChange(isFoul ? removeFoul(rules, item.id) : removeItem(rules, group as ItemSection, item.id))
                                }
                            >
                                <FiTrash2 />
                            </IconButton>
                        </HStack>
                    </>
                )}
            </HStack>
        )
    }

    return (
        <VStack align="stretch" gap="4">
            {/* The explanation is a popup, not text on the page (2026-10-03,
                owner): it appears when the step opens and must be confirmed. */}
            <Dialog.Root
                open={introOpen}
                onOpenChange={(e) => {
                    if (!e.open) {
                        introAcknowledged = true
                        setIntroOpen(false)
                    }
                }}
                placement="center"
                closeOnInteractOutside={false}
                closeOnEscape={false}
                role="alertdialog"
            >
                <Portal>
                    <Dialog.Backdrop />
                    <Dialog.Positioner>
                        <Dialog.Content maxW="md" mx="4">
                            <Dialog.Header>
                                <Dialog.Title>{r("introTitle")}</Dialog.Title>
                            </Dialog.Header>
                            <Dialog.Body>
                                <Text color="fg.muted">{r("intro")}</Text>
                            </Dialog.Body>
                            <Dialog.Footer>
                                <Button
                                    colorPalette="brand"
                                    onClick={() => {
                                        introAcknowledged = true
                                        setIntroOpen(false)
                                    }}
                                >
                                    {r("introOk")}
                                </Button>
                            </Dialog.Footer>
                        </Dialog.Content>
                    </Dialog.Positioner>
                </Portal>
            </Dialog.Root>

            {/* ── The five game rules (moved here from the pricing step) ── */}
            <HStack gap="2" fontSize="sm" fontWeight="medium" color="fg">
                <Box color="brand.fg" display="flex" alignItems="center">
                    <FiSettings />
                </Box>
                <Text>{r("gameParams")}</Text>
            </HStack>
            <Box display="grid" gridTemplateColumns={{ base: "1fr", md: "repeat(2, minmax(0, 1fr))" }} gap="2" alignItems="start">
                <ChoiceField
                    label={t("forms.createTournament.targetScore.label")}
                    value={game.targetScore}
                    mono
                    options={([501, 701, 1001] as const).map((s) => ({ value: s, label: String(s) }))}
                    onPick={(v) => onGameChange({ targetScore: v })}
                />
                <ChoiceField
                    label={t("forms.createTournament.gameEndRule.label")}
                    value={game.gameEndRule}
                    options={(["prolaz", "dosta"] as const).map((v) => ({ value: v, label: t(`forms.createTournament.gameEndRule.${v}`) }))}
                    onPick={(v) => onGameChange({ gameEndRule: v })}
                />
                {/* Games a pair must win to take the match (rules.matchGames, default 2).
                    Stored in the rules document, not a column; lives with the other
                    game settings so the rulebook groups below only hold rules. */}
                <ChoiceField
                    label={r("matchGames.label")}
                    value={resolved.matchGames}
                    mono
                    options={Array.from(
                        { length: RULES_LIMITS.maxMatchGames - RULES_LIMITS.minMatchGames + 1 },
                        (_, i) => RULES_LIMITS.minMatchGames + i,
                    ).map((n) => ({ value: n, label: String(n) }))}
                    onPick={(n) => onRulesChange(setMatchGames(rules, n === DEFAULT_MATCH_GAMES ? null : n))}
                />
                <ChoiceField
                    label={t("forms.createTournament.dealDirection.label")}
                    value={game.dealDirection}
                    options={(["right", "left"] as const).map((v) => ({ value: v, label: t(`forms.createTournament.dealDirection.${v}`) }))}
                    onPick={(v) => onGameChange({ dealDirection: v })}
                />
                {/* Who deals the next game (rules.nextDealer) — drives the fixed
                    "nova partija" rule and the blok's newGameDealer when linked. */}
                <ChoiceField
                    label={r("nextDealer.label")}
                    value={resolved.nextDealer}
                    options={[
                        { value: "NEXT" as const, label: r("nextDealer.next") },
                        { value: "WINNER" as const, label: r("nextDealer.winner") },
                    ]}
                    onPick={(v) => onRulesChange(setNextDealer(rules, v))}
                />
                {/* Round length (rules.roundMinutes, default 70) — drives the fixed
                    round-duration rule and the glance strip. Commits on blur / Enter. */}
                <Field.Root borderWidth="1px" borderColor="border.subtle" bg="bg.subtle" rounded="l2" px="3" py="2">
                    <HStack w="full" gap="3" justify="space-between">
                        <Field.Label m="0">{r("roundMinutes.label")}</Field.Label>
                        <Box w="110px" flexShrink={0}>
                            <SuffixInput
                                size="sm"
                                inputMode="numeric"
                                suffix="min"
                                placeholder={String(DEFAULT_ROUND_MINUTES)}
                                value={minutesDraft ?? String(resolved.roundMinutes)}
                                onChange={(v) => setMinutesDraft(sanitizeInt(v))}
                                onEnter={commitMinutes}
                                onBlur={commitMinutes}
                            />
                        </Box>
                    </HStack>
                </Field.Root>
                <ChoiceField
                    label={t("forms.createTournament.declarations.label")}
                    value={game.declarationsEnabled}
                    options={[
                        { value: true, label: t("forms.createTournament.declarations.enabled") },
                        { value: false, label: t("forms.createTournament.declarations.disabled") },
                    ]}
                    onPick={(v) => onGameChange({ declarationsEnabled: v })}
                />
                {/* Declarations and bela are the LAST two boxes (owner, 2026-10-03):
                    bela sits beside the declarations box when they are off. */}
                {!game.declarationsEnabled ? (
                    <ChoiceField
                        label={t("forms.createTournament.allowBela.label")}
                        value={game.allowBela}
                        options={[
                            { value: true, label: t("forms.createTournament.allowBela.yes") },
                            { value: false, label: t("forms.createTournament.allowBela.no") },
                        ]}
                        onPick={(v) => onGameChange({ allowBela: v })}
                    />
                ) : null}
            </Box>

            {/* ── Rulebook groups ── */}
            <HStack justify="space-between" gap="2" wrap="wrap">
                <HStack gap="2" fontSize="sm" fontWeight="medium" color="fg">
                    <Box color="brand.fg" display="flex" alignItems="center">
                        <FiAward />
                    </Box>
                    <Text>{t("forms.createTournament.wizard.step.rules")}</Text>
                    {changed > 0 && (
                        <Badge colorPalette="orange" variant="subtle">
                            {r("changedCount", { count: changed })}
                        </Badge>
                    )}
                </HStack>
                <Button size="xs" variant="outline" disabled={changed === 0} onClick={() => setResetOpen(true)}>
                    <FiRotateCcw /> {r("reset")}
                </Button>
            </HStack>

            <VStack align="stretch" gap="2">
                {GROUPS.map(({ key, icon }) => {
                    const isOpen = open.has(key)
                    const items = itemsOf(key)
                    const heading = t(`legal.rules.${key}.heading`)
                    const limitReached = customCount(key) >= RULES_LIMITS.maxCustomPerSection
                    return (
                        <Box key={key} borderWidth="1px" borderColor="border.subtle" rounded="l2" bg="bg.panel" overflow="hidden">
                            <chakra.button
                                type="button"
                                w="full"
                                display="flex"
                                alignItems="center"
                                gap="2.5"
                                px="3"
                                py="2.5"
                                textAlign="left"
                                aria-expanded={isOpen}
                                onClick={() => toggle(key)}
                                _hover={{ bg: "bg.subtle" }}
                            >
                                <Box color="brand.fg" display="flex" alignItems="center">
                                    {icon}
                                </Box>
                                <Text flex="1" fontSize="sm" fontWeight="semibold">
                                    {heading}
                                </Text>
                                <Text fontSize="xs" color="fg.muted" fontFamily="mono">
                                    {items.filter((i) => !i.removed).length}
                                </Text>
                                {isOpen ? <FiChevronDown /> : <FiChevronRight />}
                            </chakra.button>

                            {isOpen && (
                                <VStack align="stretch" gap="0" px="3" pb="3" borderTopWidth="1px" borderColor="border.subtle">
                                    {(key === "trump" || key === "decl") && (
                                        <Text fontSize="xs" color="fg.muted" pt="2.5">
                                            {r("fixedNote")}
                                        </Text>
                                    )}

                                    {items.length === 0 && (
                                        <Text fontSize="sm" color="fg.muted" py="3">
                                            {r("empty")}
                                        </Text>
                                    )}
                                    {items.map((item, i) =>
                                        renderRow(key, item, i, items.slice(0, i).filter((x) => !x.removed).length),
                                    )}

                                    {/* ── Add a custom rule ── */}
                                    <Box pt="2" borderTopWidth={items.length > 0 ? "1px" : "0"} borderColor="border.subtle">
                                        {adding === key ? (
                                            <TextEditor
                                                initial=""
                                                placeholder={r("addPlaceholder")}
                                                submitLabel={r("addConfirm")}
                                                onCancel={() => setAdding(null)}
                                                onSubmit={(text) => {
                                                    onRulesChange(
                                                        key === "foul"
                                                            ? addCustomFoul(rules, text, addPenalty)
                                                            : addCustomItem(rules, key, text),
                                                    )
                                                    setAdding(null)
                                                }}
                                                extra={
                                                    key === "foul" ? (
                                                        <PenaltySelect value={addPenalty} onChange={setAddPenalty} />
                                                    ) : undefined
                                                }
                                            />
                                        ) : limitReached ? (
                                            <Text fontSize="xs" color="fg.muted">
                                                {r("limit")}
                                            </Text>
                                        ) : (
                                            <Button size="xs" variant="ghost" colorPalette="brand" onClick={() => setAdding(key)}>
                                                <FiPlus /> {r("add")}
                                            </Button>
                                        )}
                                    </Box>
                                </VStack>
                            )}
                        </Box>
                    )
                })}
            </VStack>

            <ConfirmDialog
                open={resetOpen}
                destructive
                title={r("reset.title")}
                description={r("reset.description")}
                confirmLabel={r("reset.confirm")}
                cancelLabel={t("common.cancel")}
                onConfirm={() => {
                    onRulesChange(null)
                    setEditing(null)
                    setAdding(null)
                    setMinutesDraft(null)
                    setResetOpen(false)
                }}
                onCancel={() => setResetOpen(false)}
            />
        </VStack>
    )
}
