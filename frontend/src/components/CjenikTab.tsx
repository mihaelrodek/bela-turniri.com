import { useEffect, useMemo, useRef, useState } from "react"
import {
    Badge,
    Box,
    Button,
    Dialog,
    HStack,
    IconButton,
    Input,
    Menu,
    Portal,
    Text,
    VStack,
} from "@chakra-ui/react"
import {
    FiCheck,
    FiChevronDown,
    FiCoffee,
    FiEdit2,
    FiFolder,
    FiPlus,
    FiTrash2,
} from "react-icons/fi"
import {
    type DrinkPriceDto,
    fetchTournamentCjenik,
    saveTournamentCjenik,
    saveCjenikAsTemplate,
    importCjenikTemplate,
    fetchMyTemplateNames,
} from "../api/cjenik"
import { fmtL, groupedPresets } from "../utils/drinkPresets"
import { formatEur, moneyToNumber, sanitizeMoney } from "../utils/format"
import { usePlural, useTranslation } from "../i18n"
import { waiterErrorText } from "../api/waiterAccess"
import { showError } from "../toaster"
import ConfirmDialog from "./ConfirmDialog"
import EmptyState from "./EmptyState"
import SuffixInput from "./SuffixInput"
import { CounterChip } from "./PairsSection"
import { CONTENT_STICKY_TOP } from "./navChrome"

type Props = {
    /** Tournament uuid OR slug — both resolve on backend. */
    tournamentRef: string
    /** Whether the current user can edit. False → read-only menu view. */
    canEdit: boolean
    /**
     * Set only for a "head waiter" — a waiter credential invited with
     * cjenik rights — sent as `X-Waiter-Token` on save. Null/omitted for
     * the organiser, whose ordinary Firebase bearer is authorisation
     * enough. See `WaiterAccessService#authorizeCjenikAccess`.
     */
    waiterToken?: string | null
    /**
     * Hide the "Predlošci" menu (load / save-as). Both actions key a
     * per-USER reusable template on the caller's own uid — a waiter has no
     * account to key one to, so for that caller the menu would only ever
     * 401. Defaults to true (the organiser).
     */
    canUseTemplates?: boolean
}

/* ──────────────────────────────────────────────────────────────────────────
   Cjenik (drink price list) tab on the tournament page.

   LAYOUT. The price list is the subject of this screen and is the first
   thing under the toolbar; "Brzo dodaj" is a TOOL and sits beside it (a
   300px aside at lg, a card under the list below that), which is also what
   fills the width a single narrow column used to leave empty. One CSS grid
   holds both, so the aside is the same DOM node at every breakpoint.

   All four organiser actions live in ONE sticky strip pinned under the
   navbar instead of three different corners: the two TEMPLATE actions are
   folded into a "Predlošci" menu, and "Dodaj piće" / "Spremi" sit beside it
   as the two list actions. Left of them is the Parovi tab's counter chip
   plus an unsaved badge, so this tab reads as that tab's twin.

   WHY "SPREMI" IS STILL HERE (it is not a leftover):
     • PUT /tournaments/{ref}/cjenik is a whole-list REPLACE.
       `CjenikService.replaceTournamentCjenik` deletes every stored row whose
       id is absent from the payload, and `match_drinks.price_id` is
       ON DELETE SET NULL — so a delete permanently unlinks that drink from
       every bill already recorded against it.
     • This component filters rows with a blank name out of the payload. An
       autosave that fired while a name was momentarily empty (the organiser
       clearing it to retype) would therefore delete a priced row and cut it
       loose from its bills. That is money, and it is not undoable.
     • The save response re-keys every row (`dtoToRow` → `srv-<id>`), which
       remounts the inputs. A save landing mid-edit would drop the caret.
     • `saveTournamentCjenik` carries `successMessage`, so every PUT toasts.
   The button therefore stays, and the risk it guards against is made
   visible instead: the strip shows a "Nespremljeno" badge while `dirty`,
   "Odbaci" reverts to the last server-confirmed rows, and a `beforeunload`
   guard catches a reload with money still unsaved.

   Non-owners just see the read-only menu so anyone can check prices.
   ────────────────────────────────────────────────────────────────────── */
export default function CjenikTab({
    tournamentRef,
    canEdit,
    waiterToken = null,
    canUseTemplates = true,
}: Props) {
    const { t } = useTranslation()
    const plural = usePlural()
    const [items, setItems] = useState<EditableRow[]>([])
    // groupedPresets() rebuilds the whole category tree on every call; it is
    // a pure function of a module-level constant, so compute it once.
    const presetGroups = useMemo(() => groupedPresets(), [])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [dirty, setDirty] = useState(false)
    // Owner/organiser lands read-only, same as any other visitor — the
    // editor (inputs, delete, save strip) only mounts once "Uredi" is
    // clicked, so a table full of glasses doesn't nudge an elbow into a
    // price field. "Gotovo" is disabled while `dirty`: leaving mid-edit
    // must go through Spremi/Odbaci, not silently drop the strip.
    const [editMode, setEditMode] = useState(false)
    // Two-phase confirmations that replaced the blocking window.confirm()
    // calls: the name of the template about to overwrite the current cjenik,
    // and the name of the saved template about to be overwritten.
    const [pendingImport, setPendingImport] = useState<string | null>(null)
    const [pendingOverwrite, setPendingOverwrite] = useState<string | null>(null)
    /** The last rows the server confirmed — what "Odbaci" reverts to. Rows are
     *  never mutated in place (patchRow rebuilds them), so this snapshot stays
     *  valid however much the editor is churned. */
    const baselineRef = useRef<EditableRow[]>([])

    /** Adopt a server response as both the visible list and the clean baseline. */
    const applyServerRows = (data: DrinkPriceDto[]) => {
        const rows = data.map(dtoToRow)
        baselineRef.current = rows
        setItems(rows)
        setDirty(false)
    }

    // Initial load.
    useEffect(() => {
        let cancelled = false
        ;(async () => {
            setLoading(true)
            try {
                const data = await fetchTournamentCjenik(tournamentRef)
                if (cancelled) return
                applyServerRows(data)
            } catch {
                if (!cancelled) {
                    baselineRef.current = []
                    setItems([])
                }
            } finally {
                if (!cancelled) setLoading(false)
            }
        })()
        return () => {
            cancelled = true
        }
    }, [tournamentRef])

    /* Reloading or closing the tab with unsaved prices loses them outright —
       nothing here is persisted client-side and the PUT is the only write
       path. The browser's own "leave site?" prompt is the one guard that
       does not require the parent page to know about this tab's state. It is
       registered only while there is actually something to lose. */
    useEffect(() => {
        if (!canEdit || !dirty) return
        const onBeforeUnload = (e: BeforeUnloadEvent) => {
            e.preventDefault()
            // Chrome still requires returnValue to be set; the string itself
            // has been ignored by every browser for years.
            e.returnValue = ""
        }
        window.addEventListener("beforeunload", onBeforeUnload)
        return () => window.removeEventListener("beforeunload", onBeforeUnload)
    }, [canEdit, dirty])

    const addRow = () => {
        setItems((rows) => [
            ...rows,
            { _localKey: nextKey(), id: null, name: "", price: "" },
        ])
        setDirty(true)
    }

    const addPresetRow = (label: string) => {
        // If the same preset is already in the list we skip silently rather
        // than dupe — the user can always edit prices on the existing row.
        if (items.some((r) => r.name.trim().toLowerCase() === label.toLowerCase())) {
            return
        }
        setItems((rows) => [
            ...rows,
            { _localKey: nextKey(), id: null, name: label, price: "" },
        ])
        setDirty(true)
    }

    const removeRow = (key: string) => {
        setItems((rows) => rows.filter((r) => r._localKey !== key))
        setDirty(true)
    }

    const patchRow = (key: string, patch: Partial<EditableRow>) => {
        setItems((rows) => rows.map((r) => (r._localKey === key ? { ...r, ...patch } : r)))
        setDirty(true)
    }

    /** Throw away every unsaved edit and go back to the server's rows. */
    const discardChanges = () => {
        setItems(baselineRef.current)
        setDirty(false)
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            const payload: DrinkPriceDto[] = items
                .filter((r) => r.name.trim() !== "")
                .map((r, idx) => ({
                    id: r.id ?? null,
                    name: r.name.trim(),
                    price: parsePrice(r.price),
                    sortOrder: idx,
                }))
            const fresh = await saveTournamentCjenik(tournamentRef, payload, waiterToken)
            applyServerRows(fresh)
        } catch (err) {
            // For the organiser the axios interceptor already toasted. A
            // waiter's save is `silent` (see `saveTournamentCjenik`), so
            // that path gets nothing unless this shows it. Either way,
            // `dirty` stays true so the caller can retry "Spremi" without
            // re-typing everything.
            if (waiterToken) {
                showError(t("admin.cjenik.saveFailed"), waiterErrorText(err, "") || undefined)
            }
            console.warn("Spremanje cjenika nije uspjelo", err)
        } finally {
            setSaving(false)
        }
    }

    // Template-picker dialog state.
    //   importOpen=true   → "Učitaj predložak" dialog (pick existing → load)
    //   saveAsOpen=true   → "Spremi kao predložak" dialog (pick existing to
    //                       overwrite OR enter new name)
    const [importOpen, setImportOpen] = useState(false)
    const [saveAsOpen, setSaveAsOpen] = useState(false)
    const [templateNames, setTemplateNames] = useState<string[]>([])
    const [templatesLoading, setTemplatesLoading] = useState(false)
    const [newTemplateName, setNewTemplateName] = useState("")

    // Lazy-load the template name list when either dialog opens. We
    // re-fetch on each open so a freshly-created template (from the
    // profile page in another tab) shows up.
    useEffect(() => {
        if (!importOpen && !saveAsOpen) return
        let cancelled = false
        ;(async () => {
            setTemplatesLoading(true)
            try {
                const names = await fetchMyTemplateNames()
                if (!cancelled) setTemplateNames(names)
            } catch {
                if (!cancelled) setTemplateNames([])
            } finally {
                if (!cancelled) setTemplatesLoading(false)
            }
        })()
        return () => {
            cancelled = true
        }
    }, [importOpen, saveAsOpen])

    /** Clicking a template name either imports straight away (empty cjenik,
     *  nothing to lose) or stages the overwrite for the ConfirmDialog. The
     *  picker closes as it stages: two stacked modal layers trap focus in the
     *  lower one and the backdrop click lands on the wrong dialog. Cancelling
     *  the confirmation reopens the picker so the owner keeps their place. */
    const requestImport = (name: string) => {
        if (items.length > 0) {
            setImportOpen(false)
            setPendingImport(name)
            return
        }
        void doImport(name)
    }

    const doImport = async (name: string) => {
        setSaving(true)
        try {
            const fresh = await importCjenikTemplate(tournamentRef, name)
            applyServerRows(fresh)
            setImportOpen(false)
            setPendingImport(null)
        } catch (err) {
            // Leave the picker open and the current cjenik untouched so the
            // owner can pick another template. Interceptor already toasted.
            console.warn("Učitavanje predloška nije uspjelo", err)
        } finally {
            setSaving(false)
        }
    }

    /** "Prepiši" on an existing template name — stage it for confirmation.
     *  Closes the "spremi kao" dialog first, same single-modal-layer rule as
     *  requestImport above. */
    const requestOverwrite = (name: string) => {
        const trimmed = name.trim()
        if (!trimmed) return
        setSaveAsOpen(false)
        setPendingOverwrite(trimmed)
    }

    const doSaveAs = async (name: string) => {
        const trimmed = name.trim()
        if (!trimmed) return
        setSaving(true)
        try {
            await saveCjenikAsTemplate(tournamentRef, trimmed)
            setSaveAsOpen(false)
            setNewTemplateName("")
            setPendingOverwrite(null)
        } catch (err) {
            // Keep the dialog open with the typed name intact for a retry.
            console.warn("Spremanje predloška nije uspjelo", err)
        } finally {
            setSaving(false)
        }
    }

    /** Row price by lower-cased row name — drives the preset chips, which show
     *  what a drink already costs instead of just repeating its volume. */
    const priceByName = useMemo(() => {
        const m = new Map<string, string>()
        for (const r of items) {
            const key = r.name.trim().toLowerCase()
            if (key) m.set(key, r.price)
        }
        return m
    }, [items])

    if (loading) {
        return <Text color="fg.muted">{t("admin.cjenik.loading")}</Text>
    }

    /* ── Read-only view ────────────────────────────────────────────────────
       Rendered for every visitor, AND for the owner/organiser until they
       click "Uredi" — the editor (inputs, delete, save strip) only mounts
       in `editMode`, so opening the tab never puts an active price field
       under a stray tap. */
    if (!canEdit || !editMode) {
        const editAction = canEdit ? (
            <Button size="xs" variant="outline" onClick={() => setEditMode(true)}>
                <FiEdit2 /> {t("admin.cjenik.editButton")}
            </Button>
        ) : null

        // When the cjenik hasn't been filled in yet, both visitors and an
        // owner who hasn't started editing get the shared EmptyState rather
        // than a bare one-liner — same component the Parovi and Ždrijeb
        // tabs use, so the page does not change visual language between
        // empty tabs. The owner's copy differs (invites them to start) and
        // carries the "Uredi" action instead of a plain message.
        if (items.length === 0) {
            return (
                <Box
                    borderWidth="1px"
                    borderColor="border.subtle"
                    borderStyle="dashed"
                    rounded="xl"
                    bg="bg.panel"
                >
                    <EmptyState
                        icon={FiCoffee}
                        title={t(canEdit ? "admin.cjenik.ownerEmpty.title" : "admin.cjenik.empty.title")}
                        description={t(
                            canEdit ? "admin.cjenik.ownerEmpty.description" : "admin.cjenik.empty.description",
                        )}
                        action={editAction ?? undefined}
                    />
                </Box>
            )
        }
        return (
            <Box
                borderWidth="1px"
                borderColor="border.subtle"
                rounded="xl"
                bg="bg.panel"
                p={{ base: "3", md: "4" }}
            >
                <HStack justify="space-between" align="center" gap="2" mb="2">
                    <HStack gap="2" align="center" minW="0">
                        <Box color="brand.fg" display="flex" aria-hidden>
                            <FiCoffee />
                        </Box>
                        <Text fontWeight="semibold" truncate>
                            {t("admin.cjenik.heading")}
                        </Text>
                    </HStack>
                    <HStack gap="3" flexShrink={0}>
                        <Text fontSize="xs" color="fg.muted">
                            {items.length} {plural("admin.cjenik.drinkCount", items.length)}
                        </Text>
                        {editAction}
                    </HStack>
                </HStack>
                {/* Two columns from md up: a venue menu is a long list of very
                    short rows, and one column of them down a 6xl page is the
                    "vast empty space" this tab was reported for. */}
                <Box
                    display="grid"
                    gridTemplateColumns={{ base: "1fr", md: "1fr 1fr" }}
                    columnGap="6"
                >
                    {items.map((r) => (
                        <HStack
                            key={r._localKey}
                            justify="space-between"
                            gap="3"
                            borderBottomWidth="1px"
                            borderColor="border.subtle"
                            py="2"
                        >
                            <Text fontSize="sm" minW="0" truncate>
                                {r.name}
                            </Text>
                            <Text fontSize="sm" fontWeight="semibold" flexShrink={0}>
                                {formatEur(r.price)}
                            </Text>
                        </HStack>
                    ))}
                </Box>
            </Box>
        )
    }

    /* ── Organiser view ────────────────────────────────────────────────── */
    return (
        <Box>
            {/* One strip, all four actions, pinned under the navbar (offset from
                navChrome, never a literal) so "Spremi" is reachable from the
                bottom of a long list on a phone. */}
            <HStack
                position="sticky"
                top={CONTENT_STICKY_TOP}
                zIndex={5}
                justify="space-between"
                align="center"
                gap="2"
                rowGap="2"
                wrap="wrap"
                bg="bg.panel"
                borderWidth="1px"
                borderColor={dirty ? "yellow.muted" : "border.subtle"}
                rounded="xl"
                shadow="sm"
                px="3"
                py="2"
                mb="4"
            >
                <HStack gap="2" wrap="wrap" minW="0" flex="1">
                    <CounterChip
                        icon={<FiCoffee size={13} />}
                        value={items.length}
                        label={plural("admin.cjenik.drinkCount", items.length)}
                    />
                    {dirty && (
                        <Badge variant="subtle" colorPalette="yellow">
                            {t("admin.cjenik.unsavedBadge")}
                        </Badge>
                    )}
                </HStack>
                <HStack gap="2" wrap="wrap" justify="flex-end" flexShrink={0}>
                    {/* Both template actions, together, behind one trigger —
                        they were the two buttons in the far corner. Hidden
                        for a waiter (`canUseTemplates=false`): both key a
                        per-USER template to `currentUser.requireUid()`, and
                        a waiter has no account to key one to — the menu
                        would only ever 401. */}
                    {canUseTemplates && (
                        <Menu.Root>
                            <Menu.Trigger asChild>
                                <Button size="xs" variant="outline" disabled={saving}>
                                    <FiFolder /> {t("admin.cjenik.templatesMenu")} <FiChevronDown />
                                </Button>
                            </Menu.Trigger>
                            <Portal>
                                <Menu.Positioner>
                                    <Menu.Content minW="240px">
                                        <Menu.Item value="load" onSelect={() => setImportOpen(true)}>
                                            {t("admin.cjenik.loadTemplateButton")}
                                        </Menu.Item>
                                        {/* Disabled while dirty on purpose: the
                                            backend builds the template from the
                                            tournament's STORED rows
                                            (CjenikService.saveTournamentAsTemplate
                                            reads the repository), so with unsaved
                                            edits on screen it would quietly copy
                                            the previous list instead. */}
                                        <Menu.Item
                                            value="save-as"
                                            disabled={items.length === 0 || dirty}
                                            onSelect={() => setSaveAsOpen(true)}
                                        >
                                            {t("admin.cjenik.saveAsTemplateButton")}
                                        </Menu.Item>
                                        {dirty && (
                                            <Box px="2" py="1.5">
                                                <Text fontSize="xs" color="fg.muted">
                                                    {t("admin.cjenik.templatesMenu.saveFirst")}
                                                </Text>
                                            </Box>
                                        )}
                                    </Menu.Content>
                                </Menu.Positioner>
                            </Portal>
                        </Menu.Root>
                    )}
                    <Button size="xs" variant="outline" onClick={addRow} disabled={saving}>
                        <FiPlus /> {t("admin.cjenik.addButton")}
                    </Button>
                    {dirty && (
                        <Button
                            size="xs"
                            variant="ghost"
                            onClick={discardChanges}
                            disabled={saving}
                        >
                            {t("admin.cjenik.discardButton")}
                        </Button>
                    )}
                    <Button
                        size="xs"
                        colorPalette="blue"
                        onClick={handleSave}
                        disabled={!dirty || saving}
                        loading={saving}
                    >
                        {t("admin.cjenik.saveButton")}
                    </Button>
                    <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => setEditMode(false)}
                        disabled={dirty || saving}
                        title={dirty ? t("admin.cjenik.doneButton.dirtyHint") : undefined}
                    >
                        {t("admin.cjenik.doneButton")}
                    </Button>
                </HStack>
            </HStack>

            {/* The list first, the tool beside it. Below lg the aside simply
                falls under the list — same node, no second render tree. */}
            <Box
                display="grid"
                gridTemplateColumns={{ base: "1fr", lg: "minmax(0, 1fr) 300px" }}
                gap="4"
                alignItems="start"
            >
                <Box minW="0">
                    {items.length === 0 ? (
                        <Box
                            borderWidth="1px"
                            borderColor="border.subtle"
                            borderStyle="dashed"
                            rounded="xl"
                            bg="bg.panel"
                        >
                            <EmptyState
                                icon={FiCoffee}
                                title={t("admin.cjenik.ownerEmpty.title")}
                                description={t("admin.cjenik.ownerEmpty.description")}
                                action={
                                    <HStack gap="2" wrap="wrap" justify="center">
                                        <Button
                                            size="sm"
                                            colorPalette="blue"
                                            onClick={addRow}
                                            disabled={saving}
                                        >
                                            <FiPlus /> {t("admin.cjenik.addButton")}
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => setImportOpen(true)}
                                            disabled={saving}
                                        >
                                            {t("admin.cjenik.loadTemplateButton")}
                                        </Button>
                                    </HStack>
                                }
                            />
                        </Box>
                    ) : (
                        <VStack align="stretch" gap="2">
                            {items.map((row) => (
                                /* 390px: the name owns the first line with the
                                   delete button beside it, and the amount gets
                                   a full-width field of its own underneath —
                                   name + price + bin squeezed onto one phone
                                   line leaves a ~180px name field and a price
                                   target too small to hit at a bar. From md up
                                   it is one line again. */
                                <Box
                                    key={row._localKey}
                                    display="grid"
                                    gridTemplateAreas={{
                                        base: `"name remove" "price price"`,
                                        md: `"name price remove"`,
                                    }}
                                    gridTemplateColumns={{
                                        base: "minmax(0, 1fr) auto",
                                        md: "minmax(0, 1fr) 150px auto",
                                    }}
                                    gap="2"
                                    alignItems="center"
                                    borderWidth="1px"
                                    borderColor="border.subtle"
                                    rounded="lg"
                                    bg="bg.panel"
                                    px="2.5"
                                    py="2"
                                >
                                    <Box gridArea="name" minW="0">
                                        <Input
                                            placeholder={t("admin.cjenik.nameInput.placeholder")}
                                            value={row.name}
                                            onChange={(e) =>
                                                patchRow(row._localKey, { name: e.target.value })
                                            }
                                            aria-label={t("admin.cjenik.nameInput.placeholder")}
                                        />
                                    </Box>
                                    <Box gridArea="price" minW="0">
                                        <SuffixInput
                                            value={row.price}
                                            size="sm"
                                            placeholder={t("admin.cjenik.priceInput.placeholder")}
                                            suffix="€"
                                            // sanitizeMoney, not a bare comma
                                            // swap: inputMode="decimal" is only
                                            // a keyboard hint, so a desktop
                                            // keyboard (or a paste) could put
                                            // letters in here, which used to
                                            // parse to NaN and silently save 0.
                                            onChange={(v) =>
                                                patchRow(row._localKey, { price: sanitizeMoney(v) })
                                            }
                                        />
                                    </Box>
                                    <Box gridArea="remove">
                                        <IconButton
                                            aria-label={t("admin.cjenik.removeButton.aria")}
                                            title={t("admin.cjenik.removeButton.aria")}
                                            variant="ghost"
                                            colorPalette="red"
                                            onClick={() => removeRow(row._localKey)}
                                            disabled={saving}
                                        >
                                            <FiTrash2 />
                                        </IconButton>
                                    </Box>
                                </Box>
                            ))}
                        </VStack>
                    )}
                </Box>

                {/* Quick-pick: predefined drinks grouped by category. Clicking a
                    chip adds a row with that (persisted, Croatian) name filled
                    in; only the category HEADING is translated. A drink already
                    in the list shows its current price on the chip and is
                    disabled, so the panel answers "what does this cost?"
                    instead of listing bare volumes. */}
                <Box
                    borderWidth="1px"
                    borderColor="border.subtle"
                    rounded="xl"
                    bg="bg.subtle"
                    p="3"
                >
                    <Text fontSize="sm" fontWeight="semibold">
                        {t("admin.cjenik.presetSection.heading")}
                    </Text>
                    <Text fontSize="xs" color="fg.muted" mt="0.5" mb="3">
                        {t("admin.cjenik.presetSection.hint")}
                    </Text>
                    <VStack align="stretch" gap="2.5">
                        {presetGroups.map((g) => (
                            <Box key={g.categoryKey}>
                                <Text
                                    fontSize="2xs"
                                    color="fg.muted"
                                    fontWeight="semibold"
                                    letterSpacing="wider"
                                    textTransform="uppercase"
                                    mb="1"
                                >
                                    {t(`common.drinkCategory.${g.categoryKey}`)}
                                </Text>
                                <HStack gap="1.5" wrap="wrap">
                                    {g.items.map((p) => {
                                        const added = priceByName.has(p.label.toLowerCase())
                                        const price = priceByName.get(p.label.toLowerCase()) ?? ""
                                        return (
                                            <Button
                                                key={p.label}
                                                size="2xs"
                                                variant={added ? "subtle" : "outline"}
                                                colorPalette={added ? "green" : undefined}
                                                onClick={() => addPresetRow(p.label)}
                                                disabled={saving || added}
                                                title={
                                                    added
                                                        ? t("admin.cjenik.presetSection.alreadyAdded")
                                                        : p.label
                                                }
                                            >
                                                {added && <FiCheck />}
                                                {fmtL(p.sizeL)}
                                                {added && price !== "" && (
                                                    <Box as="span" color="fg.muted">
                                                        {formatEur(price)}
                                                    </Box>
                                                )}
                                            </Button>
                                        )
                                    })}
                                </HStack>
                            </Box>
                        ))}
                    </VStack>
                </Box>
            </Box>

            {/* === Učitaj predložak dialog ===
                Lists every template name the user has saved. Click one
                to load it into the current cjenik (with a confirm if
                the cjenik already has items). */}
            <Dialog.Root
                open={importOpen}
                onOpenChange={(e) => { if (!e.open) setImportOpen(false) }}
            >
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content maxW="md">
                        <Dialog.Header>
                            <Text fontWeight="semibold">{t("admin.dialog.loadTemplate.title")}</Text>
                        </Dialog.Header>
                        <Dialog.Body>
                            {templatesLoading ? (
                                <Text color="fg.muted">{t("admin.dialog.loadTemplate.loading")}</Text>
                            ) : templateNames.length === 0 ? (
                                <Text color="fg.muted" fontSize="sm">
                                    {t("admin.dialog.loadTemplate.empty")}
                                </Text>
                            ) : (
                                <VStack align="stretch" gap="2">
                                    {templateNames.map((n) => (
                                        <Button
                                            key={n}
                                            variant="outline"
                                            onClick={() => requestImport(n)}
                                            disabled={saving}
                                            justifyContent="flex-start"
                                        >
                                            {n}
                                        </Button>
                                    ))}
                                </VStack>
                            )}
                        </Dialog.Body>
                        <Dialog.Footer>
                            <Button variant="ghost" onClick={() => setImportOpen(false)}>
                                {t("admin.dialog.loadTemplate.closeButton")}
                            </Button>
                        </Dialog.Footer>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Dialog.Root>

            {/* === Spremi kao predložak dialog ===
                Two options: overwrite an existing template (click one to
                confirm-and-save) OR type a new name and create. */}
            <Dialog.Root
                open={saveAsOpen}
                onOpenChange={(e) => {
                    if (!e.open) {
                        setSaveAsOpen(false)
                        setNewTemplateName("")
                    }
                }}
            >
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content maxW="md">
                        <Dialog.Header>
                            <Text fontWeight="semibold">{t("admin.dialog.saveAsTemplate.title")}</Text>
                        </Dialog.Header>
                        <Dialog.Body>
                            <VStack align="stretch" gap="4">
                                <Box>
                                    <Text fontSize="sm" color="fg.muted" mb="2">
                                        {t("admin.dialog.saveAsTemplate.newTemplate.label")}
                                    </Text>
                                    <HStack gap="2">
                                        <Input
                                            size="sm"
                                            placeholder={t("admin.dialog.saveAsTemplate.newTemplate.placeholder")}
                                            value={newTemplateName}
                                            onChange={(e) => setNewTemplateName(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (
                                                    e.key === "Enter" &&
                                                    newTemplateName.trim() &&
                                                    !templateNames.includes(newTemplateName.trim())
                                                ) {
                                                    e.preventDefault()
                                                    void doSaveAs(newTemplateName)
                                                }
                                            }}
                                        />
                                        <Button
                                            size="sm"
                                            colorPalette="blue"
                                            onClick={() => doSaveAs(newTemplateName)}
                                            disabled={
                                                saving ||
                                                !newTemplateName.trim() ||
                                                templateNames.includes(newTemplateName.trim())
                                            }
                                        >
                                            {t("admin.dialog.saveAsTemplate.newTemplate.createButton")}
                                        </Button>
                                    </HStack>
                                    {!!newTemplateName.trim() &&
                                        templateNames.includes(newTemplateName.trim()) && (
                                            <Text color="fg.error" fontSize="xs" mt="1">
                                                {t("admin.dialog.saveAsTemplate.newTemplate.alreadyExists")}
                                            </Text>
                                        )}
                                </Box>

                                {templateNames.length > 0 && (
                                    <Box>
                                        <Text fontSize="sm" color="fg.muted" mb="2">
                                            {t("admin.dialog.saveAsTemplate.existingTemplates.label")}
                                        </Text>
                                        {templatesLoading ? (
                                            <Text color="fg.muted" fontSize="sm">
                                                {t("admin.dialog.saveAsTemplate.existingTemplates.loading")}
                                            </Text>
                                        ) : (
                                            <VStack align="stretch" gap="2">
                                                {templateNames.map((n) => (
                                                    <Button
                                                        key={n}
                                                        variant="outline"
                                                        onClick={() => requestOverwrite(n)}
                                                        disabled={saving}
                                                        justifyContent="flex-start"
                                                    >
                                                        {n}
                                                    </Button>
                                                ))}
                                            </VStack>
                                        )}
                                    </Box>
                                )}
                            </VStack>
                        </Dialog.Body>
                        <Dialog.Footer>
                            <Button variant="ghost" onClick={() => setSaveAsOpen(false)}>
                                {t("admin.dialog.saveAsTemplate.closeButton")}
                            </Button>
                        </Dialog.Footer>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Dialog.Root>

            <ConfirmDialog
                open={pendingImport !== null}
                title={t("admin.confirm.importTemplate.title")}
                description={t("admin.confirm.importTemplate.description", { templateName: pendingImport ?? "" })}
                confirmLabel={t("admin.confirm.importTemplate.confirmButton")}
                destructive
                busy={saving}
                onConfirm={() => { if (pendingImport) void doImport(pendingImport) }}
                onCancel={() => { setPendingImport(null); setImportOpen(true) }}
            />

            <ConfirmDialog
                open={pendingOverwrite !== null}
                title={t("admin.confirm.overwriteTemplate.title")}
                description={t("admin.confirm.overwriteTemplate.description", { templateName: pendingOverwrite ?? "" })}
                confirmLabel={t("admin.confirm.overwriteTemplate.confirmButton")}
                destructive
                busy={saving}
                onConfirm={() => { if (pendingOverwrite) void doSaveAs(pendingOverwrite) }}
                onCancel={() => { setPendingOverwrite(null); setSaveAsOpen(true) }}
            />
        </Box>
    )
}

/* ============================================================
   Local types + helpers
   ============================================================ */

type EditableRow = {
    /** Stable React key — separate from server id so freshly-added rows render properly. */
    _localKey: string
    id: number | null
    name: string
    /** Free-text while editing; parsed on save. */
    price: string
}

let _keyCounter = 0
function nextKey(): string {
    _keyCounter += 1
    return `local-${_keyCounter}-${Math.random().toString(36).slice(2, 7)}`
}

function dtoToRow(d: DrinkPriceDto): EditableRow {
    return {
        _localKey: d.id != null ? `srv-${d.id}` : nextKey(),
        id: d.id ?? null,
        name: d.name ?? "",
        price: d.price == null ? "" : String(d.price),
    }
}

/** Edit-input string → price. Shares the app-wide money parser; anything
 *  unparseable (or an empty field) becomes 0, which is what the backend
 *  stores for a "free" item. */
function parsePrice(s: string): number {
    return moneyToNumber(s) ?? 0
}
