import { useEffect, useState } from "react"
import {
    Box,
    Button,
    HStack,
    IconButton,
    Input,
    Stack,
    Text,
    VStack,
} from "@chakra-ui/react"
import {
    type DrinkPriceDto,
    fetchTournamentCjenik,
    saveTournamentCjenik,
    saveCjenikAsTemplate,
    importCjenikTemplate,
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

    const handleSaveAsTemplate = async () => {
        setSaving(true)
        try {
            await saveCjenikAsTemplate(tournamentRef)
        } finally {
            setSaving(false)
        }
    }

    const handleImportTemplate = async () => {
        if (
            items.length > 0 &&
            !window.confirm(
                "Učitavanje predloška će zamijeniti trenutni cjenik. Nastaviti?",
            )
        ) {
            return
        }
        setSaving(true)
        try {
            const fresh = await importCjenikTemplate(tournamentRef)
            setItems(fresh.map(dtoToRow))
            setDirty(false)
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return <Text color="gray.500">Učitavanje cjenika…</Text>
    }

    if (!canEdit) {
        // Read-only menu view.
        if (items.length === 0) {
            return <Text color="gray.500">Cjenik nije postavljen.</Text>
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
                        onClick={handleImportTemplate}
                        disabled={saving}
                    >
                        Učitaj predložak
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={handleSaveAsTemplate}
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
