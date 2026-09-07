import React, { useEffect, useRef } from "react"
import { Box, Button, HStack, IconButton, Input, Skeleton, Text, VStack } from "@chakra-ui/react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { FiCheck, FiEdit2, FiPlus, FiTrash2, FiX } from "react-icons/fi"
import {
    deleteMyTemplate,
    fetchMyTemplate,
    renameMyTemplate,
    saveMyTemplate,
    type DrinkPriceDto,
} from "../../api/cjenik"
import ConfirmDialog from "../../components/ConfirmDialog"
import { showError } from "../../toaster"
import { qk } from "../../queryClient"
import { fmtL, groupedPresets } from "../../utils/drinkPresets"
import { useTranslation } from "../../i18n"

type DrinkTemplateRow = {
    _key: string
    id: number | null
    name: string
    price: string
}

let _drinkTplKey = 0
function nextDrinkTplKey(): string {
    _drinkTplKey += 1
    return `dt-${_drinkTplKey}-${Math.random().toString(36).slice(2, 6)}`
}

function rowFromDto(d: DrinkPriceDto): DrinkTemplateRow {
    return {
        _key: d.id != null ? `srv-${d.id}` : nextDrinkTplKey(),
        id: d.id ?? null,
        name: d.name,
        price: d.price == null ? "" : String(d.price),
    }
}

/**
 * Editor for one named template. Loads items from the server, lets the
 * user edit the row list (with preset chips), and supports rename +
 * delete via the header controls.
 *
 * `rows` is local, editable draft state — the server truth lives in
 * `qk.myDrinkTemplate(templateName)`. The seeding effect below latches once
 * per `templateName` (mirroring `EditProfileDialog`'s seeded-refs pattern)
 * so in-progress edits are never clobbered by a background refetch, but a
 * genuine switch to a different template re-seeds from its own query.
 */
export function DrinkTemplateEditor({
    templateName,
    existingNames,
    onBack,
    onRenamed,
    onDeleted,
}: {
    templateName: string
    existingNames: string[]
    onBack: () => void | Promise<void>
    onRenamed: (newName: string) => void | Promise<void>
    onDeleted: () => void | Promise<void>
}) {
    const { t } = useTranslation()
    const queryClient = useQueryClient()
    const { data: templateData, isLoading: loading } = useQuery({
        queryKey: qk.myDrinkTemplate(templateName),
        queryFn: () => fetchMyTemplate(templateName),
    })
    const [rows, setRows] = React.useState<DrinkTemplateRow[]>([])
    const [saving, setSaving] = React.useState(false)
    const [dirty, setDirty] = React.useState(false)
    const [renaming, setRenaming] = React.useState(false)
    const [renameValue, setRenameValue] = React.useState(templateName)
    // Replaced window.confirm() — see the ConfirmDialog at the end of the tree.
    const [deleteOpen, setDeleteOpen] = React.useState(false)

    // Seed the draft rows once per template name — a later background
    // refetch of the same query must not overwrite an in-progress edit.
    const seededRef = useRef<string | null>(null)
    useEffect(() => {
        if (templateData === undefined) return
        if (seededRef.current === templateName) return
        seededRef.current = templateName
        setRows(templateData.map(rowFromDto))
        setDirty(false)
    }, [templateData, templateName])

    const addRow = () => {
        setRows((r) => [...r, { _key: nextDrinkTplKey(), id: null, name: "", price: "" }])
        setDirty(true)
    }
    const addPresetRow = (label: string) => {
        if (rows.some((r) => r.name.trim().toLowerCase() === label.toLowerCase())) return
        setRows((r) => [...r, { _key: nextDrinkTplKey(), id: null, name: label, price: "" }])
        setDirty(true)
    }
    const removeRow = (key: string) => {
        setRows((r) => r.filter((x) => x._key !== key))
        setDirty(true)
    }
    const patch = (key: string, p: Partial<DrinkTemplateRow>) => {
        setRows((r) => r.map((x) => (x._key === key ? { ...x, ...p } : x)))
        setDirty(true)
    }

    const onSave = async () => {
        setSaving(true)
        try {
            const items: DrinkPriceDto[] = rows
                .filter((r) => r.name.trim() !== "")
                .map((r, i) => ({
                    id: r.id ?? null,
                    name: r.name.trim(),
                    price: Number((r.price || "0").replace(",", ".")) || 0,
                    sortOrder: i,
                }))
            const fresh = await saveMyTemplate(templateName, items)
            queryClient.setQueryData(qk.myDrinkTemplate(templateName), fresh)
            setRows(fresh.map(rowFromDto))
            setDirty(false)
        } catch (e) {
            // Keep dirty=true so "Spremi" stays enabled and nothing typed
            // is lost; the interceptor already toasted the reason.
            console.warn("Spremanje predloška nije uspjelo", e)
        } finally {
            setSaving(false)
        }
    }

    const onRenameSubmit = async () => {
        const next = renameValue.trim()
        if (!next || next === templateName) {
            setRenaming(false)
            setRenameValue(templateName)
            return
        }
        if (existingNames.some((n) => n !== templateName && n === next)) {
            showError(t("profile.templates.duplicateName"))
            return
        }
        setSaving(true)
        try {
            await renameMyTemplate(templateName, next)
            queryClient.removeQueries({ queryKey: qk.myDrinkTemplate(templateName) })
            setRenaming(false)
            await onRenamed(next)
        } catch (e) {
            // Stay in rename mode with the typed value intact.
            console.warn("Preimenovanje predloška nije uspjelo", e)
        } finally {
            setSaving(false)
        }
    }

    /** Runs once the owner confirms in the delete-template ConfirmDialog. */
    const onDelete = async () => {
        setSaving(true)
        try {
            await deleteMyTemplate(templateName)
            queryClient.removeQueries({ queryKey: qk.myDrinkTemplate(templateName) })
            setDeleteOpen(false)
            await onDeleted()
        } catch (e) {
            // Template stays in the list — it also still exists server-side.
            console.warn("Brisanje predloška nije uspjelo", e)
        } finally {
            setSaving(false)
        }
    }

    return (
        <VStack align="stretch" gap="3">
            {/* Header — back button + name (editable on click) + delete */}
            <HStack gap="2" justify="space-between">
                <HStack gap="2" flex="1" minW="0">
                    <IconButton
                        aria-label={t("profile.templates.back")}
                        size="xs"
                        variant="ghost"
                        onClick={() => onBack()}
                        disabled={saving}
                    >
                        <FiX />
                    </IconButton>
                    {renaming ? (
                        <HStack gap="1" flex="1" minW="0">
                            <Input
                                size="sm"
                                autoFocus
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault()
                                        void onRenameSubmit()
                                    }
                                    if (e.key === "Escape") {
                                        e.preventDefault()
                                        setRenaming(false)
                                        setRenameValue(templateName)
                                    }
                                }}
                            />
                            <IconButton
                                aria-label={t("profile.templates.saveName")}
                                size="xs"
                                variant="solid"
                                colorPalette="green"
                                onClick={onRenameSubmit}
                                disabled={saving}
                            >
                                <FiCheck />
                            </IconButton>
                        </HStack>
                    ) : (
                        <HStack gap="1" flex="1" minW="0">
                            <Text fontWeight="semibold" truncate>
                                {templateName}
                            </Text>
                            <IconButton
                                aria-label={t("profile.templates.rename")}
                                size="xs"
                                variant="ghost"
                                onClick={() => {
                                    setRenameValue(templateName)
                                    setRenaming(true)
                                }}
                                disabled={saving}
                            >
                                <FiEdit2 />
                            </IconButton>
                        </HStack>
                    )}
                </HStack>
                <IconButton
                    aria-label={t("profile.templates.deleteAria")}
                    size="xs"
                    variant="ghost"
                    colorPalette="red"
                    onClick={() => setDeleteOpen(true)}
                    disabled={saving}
                >
                    <FiTrash2 />
                </IconButton>
            </HStack>

            {/* Predefined drinks — quick-add chips. */}
            {!loading && (
                <Box
                    p="3"
                    rounded="md"
                    borderWidth="1px"
                    borderColor="border.emphasized"
                    bg="bg.subtle"
                >
                    <Text fontSize="xs" color="fg.muted" mb="2">
                        {t("profile.templates.quickAdd")}
                    </Text>
                    <VStack align="stretch" gap="1.5">
                        {groupedPresets().map((g) => (
                            <HStack key={g.categoryKey} gap="2" wrap="wrap">
                                <Text fontSize="xs" color="fg.muted" minW="92px">
                                    {t(`common.drinkCategory.${g.categoryKey}`)}:
                                </Text>
                                {g.items.map((p) => (
                                    <Button
                                        key={p.label}
                                        size="2xs"
                                        variant="outline"
                                        onClick={() => addPresetRow(p.label)}
                                        disabled={saving}
                                    >
                                        {fmtL(p.sizeL)}
                                    </Button>
                                ))}
                            </HStack>
                        ))}
                    </VStack>
                </Box>
            )}

            {loading ? (
                <VStack align="stretch" gap="2"><Skeleton h="9" /><Skeleton h="9" /></VStack>
            ) : (
                <VStack align="stretch" gap="1.5">
                    {rows.length === 0 && (
                        <Text fontSize="sm" color="fg.muted">
                            {t("profile.templates.emptyRows")}
                        </Text>
                    )}
                    {rows.map((row) => (
                        <HStack key={row._key} gap="2" align="center" minW="0">
                            <Input
                                size="sm"
                                placeholder={t("profile.templates.rowNamePlaceholder")}
                                value={row.name}
                                onChange={(e) => patch(row._key, { name: e.target.value })}
                                flex="1"
                                minW="0"
                            />
                            <Input
                                size="sm"
                                placeholder={t("profile.templates.rowPricePlaceholder")}
                                value={row.price}
                                onChange={(e) =>
                                    patch(row._key, {
                                        price: e.target.value.replace(",", "."),
                                    })
                                }
                                inputMode="decimal"
                                w="90px"
                            />
                            <Text fontSize="sm" color="fg.muted">€</Text>
                            <IconButton
                                aria-label={t("profile.templates.rowRemove")}
                                size="xs"
                                variant="ghost"
                                colorPalette="red"
                                flexShrink={0}
                                onClick={() => removeRow(row._key)}
                            >
                                <FiTrash2 />
                            </IconButton>
                        </HStack>
                    ))}
                </VStack>
            )}

            <HStack justify="space-between">
                <Button size="sm" variant="outline" onClick={addRow} disabled={saving}>
                    <FiPlus /> {t("profile.templates.addRow")}
                </Button>
                <Button
                    size="sm"
                    colorPalette="blue"
                    onClick={onSave}
                    loading={saving}
                    disabled={!dirty || saving}
                >
                    {t("profile.templates.save")}
                </Button>
            </HStack>
            <ConfirmDialog
                open={deleteOpen}
                title={t("profile.templates.deleteDialogTitle")}
                description={t("profile.templates.deleteBody", { name: templateName })}
                confirmLabel={t("common.delete")}
                destructive
                busy={saving}
                onConfirm={onDelete}
                onCancel={() => setDeleteOpen(false)}
            />
        </VStack>
    )
}
