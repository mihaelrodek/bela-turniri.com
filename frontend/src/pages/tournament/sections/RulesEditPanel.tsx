import { Suspense } from "react"
import { Box, Button, HStack, Text, VStack } from "@chakra-ui/react"
import { FiAward } from "react-icons/fi"
import { TournamentRulesEditorLazy } from "../../../components/rules/lazyRules"
import SectionCard from "../../../components/SectionCard"
import { MOBILE_TABBAR_CLEARANCE } from "../../../components/navChrome"
import { useTranslation } from "../../../i18n"
import type { TournamentForm } from "../../../utils/tournamentForm"

/* ──────────────────────────────────────────────────────────────────────────
   RulesEditPanel — "Uredi" on the Pravila tab (2026-10-03, owner): a form of
   its OWN that edits ONLY the rules — the five game settings, the round
   length, "tko dijeli", the rulebook — and nothing else about the tournament
   (name, date, place, poster, fees, prizes stay as they are).

   It is a thin shell over the same state the full edit form uses: `editForm`
   is the page's one `useTournamentEditForm` state, so saving goes through the
   one save routine (`saveDetailsEdit`), which sends the whole payload with
   every untouched field exactly as it was loaded. That keeps a single write
   path and a single unsaved-changes guard (`editDirty`) instead of a second
   save that could drift from the first.
   ────────────────────────────────────────────────────────────────────── */
export default function RulesEditPanel({
    editForm,
    patchEdit,
    saving,
    dirty,
    onCancel,
    onSave,
}: {
    editForm: TournamentForm
    patchEdit: <K extends keyof TournamentForm>(key: K, value: TournamentForm[K]) => void
    saving: boolean
    dirty: boolean
    onCancel: () => void
    onSave: () => void
}) {
    const { t: tr } = useTranslation()
    return (
        <VStack align="stretch" gap="4">
            <SectionCard icon={<FiAward />} title={tr("tournament.edit.sectionRules")}>
                <Suspense fallback={<Text fontSize="sm" color="fg.muted">{tr("forms.createTournament.rules.loading")}</Text>}>
                    <TournamentRulesEditorLazy
                        rules={editForm.rules}
                        onRulesChange={(next) => patchEdit("rules", next)}
                        game={editForm}
                        onGameChange={(patch) => {
                            for (const [key, value] of Object.entries(patch)) patchEdit(key as keyof TournamentForm, value as never)
                        }}
                    />
                </Suspense>
            </SectionCard>

            {/* Same pinned save bar as the full edit form, above the phone tab bar. */}
            <Box
                position="sticky"
                bottom={{ base: `calc(${MOBILE_TABBAR_CLEARANCE} + 8px)`, md: "3" }}
                zIndex="1"
                layerStyle="glass.panel"
                borderWidth="1px"
                borderColor="border.glass"
                rounded="xl"
                shadow="raised"
                px={{ base: "3", md: "4" }}
                py="2.5"
            >
                <HStack justify="flex-end" gap="2">
                    <Button variant="ghost" onClick={onCancel} disabled={saving}>
                        {tr("common.cancel")}
                    </Button>
                    <Button
                        colorPalette="blue"
                        onClick={onSave}
                        loading={saving}
                        disabled={!dirty || saving}
                    >
                        {tr("tournament.edit.saveChanges")}
                    </Button>
                </HStack>
            </Box>
        </VStack>
    )
}
