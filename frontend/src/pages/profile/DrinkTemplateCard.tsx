import React from "react"
import { Box, Button, Card, Heading, HStack, Input, Skeleton, Text, VStack } from "@chakra-ui/react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { FiEdit2, FiPlus } from "react-icons/fi"
import { fetchMyTemplateNames } from "../../api/cjenik"
import { showError } from "../../toaster"
import { qk } from "../../queryClient"
import { useTranslation } from "../../i18n"
import { DrinkTemplateEditor } from "./DrinkTemplateEditor"

/* ============================================================
   Drink-price template card — saved cjenik for reuse on new
   tournaments. Mirrors the Presets pattern: load on mount,
   edit inline, save the whole list with one button.

   Two view modes:
     - "list":    show every saved template by name + a "+ Novi predložak"
                  button. Click a row to enter edit mode.
     - "edit":    inline editor for one named template (DrinkTemplateEditor)
                  — same row UI as the previous single-template version,
                  plus rename and delete affordances. Back button returns
                  to list.
   ============================================================ */
export function DrinkTemplateCard() {
    const { t } = useTranslation()
    const queryClient = useQueryClient()
    // Top-level: list of template names + which one (if any) is being edited.
    const { data: namesData, isLoading: loadingNames } = useQuery({
        queryKey: qk.myDrinkTemplateNames,
        queryFn: fetchMyTemplateNames,
    })
    const names = namesData ?? []
    const [editingName, setEditingName] = React.useState<string | null>(null)
    const [newNameInput, setNewNameInput] = React.useState("")

    const refreshNames = async () => {
        await queryClient.invalidateQueries({ queryKey: qk.myDrinkTemplateNames })
    }

    const startNewTemplate = () => {
        const trimmed = newNameInput.trim()
        if (!trimmed) return
        if (names.includes(trimmed)) {
            showError(t("profile.templates.duplicateName"))
            return
        }
        // Optimistically add to the cached name list and jump into edit
        // mode. The first save in the editor will create the row server-side.
        queryClient.setQueryData<string[]>(qk.myDrinkTemplateNames, (old) =>
            [...(old ?? []), trimmed].sort())
        setEditingName(trimmed)
        setNewNameInput("")
    }

    return (
        <Card.Root variant="outline" rounded="xl" borderColor="border.emphasized" shadow="sm">
            <Card.Body p={{ base: "4", md: "5" }}>
                <VStack align="stretch" gap="3">
                    <Box>
                        <Heading size="sm">{t("profile.templates.title")}</Heading>
                        <Text fontSize="xs" color="fg.muted">
                            {t("profile.templates.description")}
                        </Text>
                    </Box>

                    {editingName ? (
                        <DrinkTemplateEditor
                            templateName={editingName}
                            onBack={async () => {
                                setEditingName(null)
                                await refreshNames()
                            }}
                            onRenamed={async (newName) => {
                                setEditingName(newName)
                                await refreshNames()
                            }}
                            onDeleted={async () => {
                                setEditingName(null)
                                await refreshNames()
                            }}
                            existingNames={names}
                        />
                    ) : loadingNames ? (
                        <VStack align="stretch" gap="2"><Skeleton h="9" /><Skeleton h="9" /></VStack>
                    ) : (
                        <VStack align="stretch" gap="2">
                            {names.length === 0 ? (
                                <Text fontSize="sm" color="fg.muted">
                                    {t("profile.templates.empty")}
                                </Text>
                            ) : (
                                names.map((n) => (
                                    <Button
                                        key={n}
                                        variant="outline"
                                        size="sm"
                                        justifyContent="space-between"
                                        onClick={() => setEditingName(n)}
                                    >
                                        <Text>{n}</Text>
                                        <FiEdit2 />
                                    </Button>
                                ))
                            )}

                            {/* New template row */}
                            <HStack gap="2" mt="2">
                                <Input
                                    size="sm"
                                    placeholder={t("profile.templates.newNamePlaceholder")}
                                    value={newNameInput}
                                    onChange={(e) => setNewNameInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault()
                                            startNewTemplate()
                                        }
                                    }}
                                />
                                <Button
                                    size="sm"
                                    colorPalette="blue"
                                    onClick={startNewTemplate}
                                    disabled={
                                        !newNameInput.trim() ||
                                        names.includes(newNameInput.trim())
                                    }
                                >
                                    <FiPlus /> {t("profile.templates.create")}
                                </Button>
                            </HStack>
                        </VStack>
                    )}
                </VStack>
            </Card.Body>
        </Card.Root>
    )
}
