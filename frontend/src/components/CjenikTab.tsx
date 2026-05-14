import { useEffect, useState } from "react"
import {
    Box,
    Button,
    Dialog,
    HStack,
    IconButton,
    Input,
    Stack,
    Text,
    VStack,
} from "@chakra-ui/react"
import { FiCoffee } from "react-icons/fi"
import {
    type DrinkPriceDto,
    fetchTournamentCjenik,
    saveTournamentCjenik,
    saveCjenikAsTemplate,
    importCjenikTemplate,
    fetchMyTemplateNames,
} from "../api/cjenik"
import { groupedPresets } from "../utils/drinkPresets"

type Props = {
    /** Tournament uuid OR slug — both resolve on backend. */
    tournamentRef: string
    /** Whether the current user can edit. False → read-only menu view. */
    canEdit: boolean
}

/**
 * Cjenik (drink price list) tab on the tournament page.
 *
 * Owner edits the price list inline (add row / change name / change price /
 * remove row). "Spremi" PUTs the whole list, "Spremi kao predložak" copies
 * the current list to the user's reusable template, "Učitaj predložak"
 * overwrites the cjenik with the template (useful when starting a new
 * tournament at the same venue).
 *
 * Non-owners just see the read-only menu so anyone can check prices.
 */
export default function CjenikTab({ tournamentRef, canEdit }: Props) {
    const [items, setItems] = useState<EditableRow[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [dirty, setDirty] = useState(false)

    // Initial load.
    useEffect(() => {
        let cancelled = false
        ;(async () => {
            setLoading(true)
            try {
                const data = await fetchTournamentCjenik(tournamentRef)
                if (cancelled) return
                setItems(data.map(dtoToRow))
                setDirty(false)
            } catch {
                if (!cancelled) setItems([])
            } finally {
                if (!cancelled) setLoading(false)
            }
        })()
        return () => {
            cancelled = true
        }
    }, [tournamentRef])

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
            const fresh = await saveTournamentCjenik(tournamentRef, payload)
            setItems(fresh.map(dtoToRow))
            setDirty(false)
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

    const doImport = async (name: string) => {
        if (
            items.length > 0 &&
            !window.confirm(
                `Učitavanje predloška "${name}" će zamijeniti trenutni cjenik. Nastaviti?`,
            )
        ) {
            return
        }
        setSaving(true)
        try {
            const fresh = await importCjenikTemplate(tournamentRef, name)
            setItems(fresh.map(dtoToRow))
            setDirty(false)
            setImportOpen(false)
        } finally {
            setSaving(false)
        }
    }

    const doSaveAs = async (name: string, overwrite: boolean) => {
        const trimmed = name.trim()
        if (!trimmed) return
        if (
            overwrite &&
            !window.confirm(
                `Predložak "${trimmed}" će biti prepisan. Nastaviti?`,
            )
        ) {
            return
        }
        setSaving(true)
        try {
            await saveCjenikAsTemplate(tournamentRef, trimmed)
            setSaveAsOpen(false)
            setNewTemplateName("")
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return <Text color="gray.500">Učitavanje cjenika…</Text>
    }

    if (!canEdit) {
        // Read-only menu view. When the owner hasn't filled in the cjenik
        // yet, regular visitors see a friendly "still being prepared"
        // card instead of a bare one-liner. Matches the empty-state
        // pattern the Parovi / Ždrijeb tabs use elsewhere, so the page
        // doesn't suddenly switch visual styles between empty tabs.
        if (items.length === 0) {
            return (
                <Box
                    borderWidth="1px"
                    borderColor="border.emphasized"
                    borderStyle="dashed"
                    rounded="xl"
                    py="10"
                    px="6"
                >
                    <VStack gap="2">
                        <Box color="fg.muted"><FiCoffee size={28} /></Box>
                        <Text fontWeight="medium">Cjenik još nije napravljen</Text>
                        <Text color="fg.muted" fontSize="sm" textAlign="center">
                            Organizator još radi na cjeniku — provjerite kasnije.
                        </Text>
                    </VStack>
                </Box>
            )
        }
        return (
            <Box>
                <Text mb="3" fontWeight="semibold">
                    Cjenik pića
                </Text>
                <VStack align="stretch" gap="2">
                    {items.map((r) => (
                        <HStack
                            key={r._localKey}
                            justify="space-between"
                            borderBottomWidth="1px"
                            borderColor="gray.100"
                            pb="2"
                        >
                            <Text>{r.name}</Text>
                            <Text fontWeight="medium">{formatEur(r.price)}</Text>
                        </HStack>
                    ))}
                </VStack>
            </Box>
        )
    }

    return (
        <Box>
            <HStack justify="space-between" mb="3" wrap="wrap" gap="2">
                <Text fontWeight="semibold">Cjenik pića</Text>
                <HStack gap="2" wrap="wrap">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setImportOpen(true)}
                        disabled={saving}
                    >
                        Učitaj predložak
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSaveAsOpen(true)}
                        disabled={saving || items.length === 0}
                    >
                        Spremi kao predložak
                    </Button>
                </HStack>
            </HStack>

            {/* Quick-pick: predefined drinks grouped by category. Clicking a
                size chip adds a row with that name pre-filled — the owner
                just enters the price. Duplicates are ignored. */}
            <Box
                mb="3"
                p="3"
                rounded="md"
                borderWidth="1px"
                borderColor="gray.200"
                bg="gray.50"
                _dark={{ bg: "gray.900", borderColor: "gray.700" }}
            >
                <Text fontSize="sm" fontWeight="medium" mb="2">
                    Brzo dodaj iz predloška:
                </Text>
                <VStack align="stretch" gap="1.5">
                    {groupedPresets().map((g) => (
                        <HStack key={g.category} gap="2" wrap="wrap">
                            <Text fontSize="xs" color="gray.600" minW="92px">
                                {g.category}:
                            </Text>
                            {g.items.map((p) => (
                                <Button
                                    key={p.label}
                                    size="2xs"
                                    variant="outline"
                                    onClick={() => addPresetRow(p.label)}
                                    disabled={saving}
                                >
                                    {/* Show only the size on the chip — the
                                        category is already in the row label. */}
                                    {p.label.slice(g.category.length + 1)}
                                </Button>
                            ))}
                        </HStack>
                    ))}
                </VStack>
            </Box>

            <Stack gap="2">
                {items.length === 0 && (
                    <Text color="gray.500">
                        Cjenik je prazan. Dodaj pića ispod.
                    </Text>
                )}

                {items.map((row) => (
                    <HStack key={row._localKey} gap="2" align="center">
                        <Input
                            placeholder="Naziv (npr. Pivo)"
                            value={row.name}
                            onChange={(e) => patchRow(row._localKey, { name: e.target.value })}
                            size="sm"
                            flex="1"
                        />
                        <Input
                            placeholder="Cijena"
                            value={row.price}
                            onChange={(e) =>
                                patchRow(row._localKey, {
                                    price: e.target.value.replace(",", "."),
                                })
                            }
                            inputMode="decimal"
                            size="sm"
                            w="100px"
                        />
                        <Text fontSize="sm" color="gray.500" minW="20px">
                            €
                        </Text>
                        <IconButton
                            aria-label="Ukloni"
                            size="sm"
                            variant="ghost"
                            colorPalette="red"
                            onClick={() => removeRow(row._localKey)}
                        >
                            ×
                        </IconButton>
                    </HStack>
                ))}

                <HStack mt="2" justify="space-between">
                    <Button size="sm" variant="outline" onClick={addRow} disabled={saving}>
                        + Dodaj piće
                    </Button>
                    <Button
                        size="sm"
                        colorPalette="blue"
                        onClick={handleSave}
                        disabled={!dirty || saving}
                        loading={saving}
                    >
                        Spremi
                    </Button>
                </HStack>
            </Stack>

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
                            <Text fontWeight="semibold">Učitaj predložak</Text>
                        </Dialog.Header>
                        <Dialog.Body>
                            {templatesLoading ? (
                                <Text color="gray.500">Učitavanje predložaka…</Text>
                            ) : templateNames.length === 0 ? (
                                <Text color="gray.500" fontSize="sm">
                                    Nemaš spremljenih predložaka. Idi na svoj profil
                                    pa stvori jedan, ili koristi "Spremi kao
                                    predložak" za trenutni cjenik.
                                </Text>
                            ) : (
                                <VStack align="stretch" gap="2">
                                    {templateNames.map((n) => (
                                        <Button
                                            key={n}
                                            variant="outline"
                                            onClick={() => doImport(n)}
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
                                Odustani
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
                            <Text fontWeight="semibold">Spremi kao predložak</Text>
                        </Dialog.Header>
                        <Dialog.Body>
                            <VStack align="stretch" gap="4">
                                <Box>
                                    <Text fontSize="sm" color="gray.600" mb="2">
                                        Novi predložak:
                                    </Text>
                                    <HStack gap="2">
                                        <Input
                                            size="sm"
                                            placeholder="npr. Pivo bar"
                                            value={newTemplateName}
                                            onChange={(e) => setNewTemplateName(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (
                                                    e.key === "Enter" &&
                                                    newTemplateName.trim() &&
                                                    !templateNames.includes(newTemplateName.trim())
                                                ) {
                                                    e.preventDefault()
                                                    void doSaveAs(newTemplateName, false)
                                                }
                                            }}
                                        />
                                        <Button
                                            size="sm"
                                            colorPalette="blue"
                                            onClick={() => doSaveAs(newTemplateName, false)}
                                            disabled={
                                                saving ||
                                                !newTemplateName.trim() ||
                                                templateNames.includes(newTemplateName.trim())
                                            }
                                        >
                                            Stvori
                                        </Button>
                                    </HStack>
                                    {!!newTemplateName.trim() &&
                                        templateNames.includes(newTemplateName.trim()) && (
                                            <Text color="red.500" fontSize="xs" mt="1">
                                                Predložak s tim nazivom već postoji.
                                            </Text>
                                        )}
                                </Box>

                                {templateNames.length > 0 && (
                                    <Box>
                                        <Text fontSize="sm" color="gray.600" mb="2">
                                            …ili prepiši postojeći:
                                        </Text>
                                        {templatesLoading ? (
                                            <Text color="gray.500" fontSize="sm">
                                                Učitavanje…
                                            </Text>
                                        ) : (
                                            <VStack align="stretch" gap="2">
                                                {templateNames.map((n) => (
                                                    <Button
                                                        key={n}
                                                        variant="outline"
                                                        onClick={() => doSaveAs(n, true)}
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
                                Odustani
                            </Button>
                        </Dialog.Footer>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Dialog.Root>
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

function parsePrice(s: string): number {
    const n = Number((s || "0").replace(",", "."))
    return Number.isFinite(n) ? n : 0
}

export function formatEur(value: number | string | null | undefined): string {
    if (value == null || value === "") return "—"
    const n = typeof value === "string" ? Number(value.replace(",", ".")) : value
    if (!Number.isFinite(n)) return "—"
    return new Intl.NumberFormat("hr-HR", {
        style: "currency",
        currency: "EUR",
    }).format(n as number)
}
