import React from "react"
import { Badge, Box, Button, Card, Dialog, Field, Heading, HStack, IconButton, Input, Skeleton, Text, VStack } from "@chakra-ui/react"
import { Link as RouterLink } from "react-router-dom"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { FiCheck, FiEdit2, FiEye, FiEyeOff, FiPlus, FiShare2, FiTrash2, FiX } from "react-icons/fi"
import {
    cancelPresetArchive,
    confirmPresetArchive,
    createPreset,
    deletePreset,
    listPresets,
    requestPresetArchive,
    setPresetVisibility,
    updatePreset,
    type UserPairPreset,
} from "../../api/userPairPresets"
import { showError, showSuccess } from "../../toaster"
import { qk } from "../../queryClient"
import { useTranslation } from "../../i18n"

/**
 * Unified "Moji pari" card on the Predlošci tab.
 *
 * Each row is a saved pair name (UserPairPreset). Actions per row:
 *   - rename
 *   - hide/show on public profile
 *   - delete (blocked once shared + claimed)
 *   - "Podijeli sa partnerom" — copies the /claim-name/{token} URL
 *     so the partner can claim co-ownership and see this pair on
 *     their own profile too.
 *
 * Sharing is preset-level: when the partner claims, every tournament
 * pair the primary registered under this name (past and future) gets
 * backfilled with the partner's UID, propagating the equal-participant
 * view (profile listing + push + bill access).
 *
 * The list itself is `qk.myPairPresets` — one shared react-query entry so a
 * mutation's response can write straight back into the cache (`setQueryData`)
 * instead of a second round-trip, matching the previous `setPresets(...)`
 * optimistic-update behaviour exactly.
 */
export function MyPairsCard() {
    const { t } = useTranslation()
    const queryClient = useQueryClient()
    const { data: presetsData, isLoading: loading } = useQuery({
        queryKey: qk.myPairPresets,
        queryFn: listPresets,
        // `listPresets` isn't `silent` — the shared axios interceptor toasts
        // its own failure. The default client-wide retry would toast that
        // failure twice for one real error, so this query opts out.
        retry: false,
    })
    const presets = presetsData ?? []
    const setPresets = (updater: (xs: UserPairPreset[]) => UserPairPreset[]) => {
        queryClient.setQueryData<UserPairPreset[]>(qk.myPairPresets, (old) => updater(old ?? []))
    }

    const [draft, setDraft] = React.useState("")
    const [creating, setCreating] = React.useState(false)
    const [editingUuid, setEditingUuid] = React.useState<string | null>(null)
    const [editValue, setEditValue] = React.useState("")
    const [pendingDelete, setPendingDelete] = React.useState<UserPairPreset | null>(null)
    const [deleting, setDeleting] = React.useState(false)

    /* ----- Preset CRUD ----- */
    async function onAddPreset(e: React.FormEvent) {
        e.preventDefault()
        const name = draft.trim()
        if (!name) return
        try {
            setCreating(true)
            const fresh = await createPreset(name)
            setPresets((xs) => [...xs, fresh])
            setDraft("")
        } catch (e) {
            // Keep the typed name in the input so the user can retry;
            // the interceptor already toasted the reason.
            console.warn("Dodavanje para nije uspjelo", e)
        } finally {
            setCreating(false)
        }
    }

    async function commitRename(p: UserPairPreset) {
        const name = editValue.trim()
        if (!name || name === p.name) {
            setEditingUuid(null)
            setEditValue("")
            return
        }
        try {
            const updated = await updatePreset(p.uuid, name)
            setPresets((xs) => xs.map((x) => (x.uuid === p.uuid ? updated : x)))
            setEditingUuid(null)
            setEditValue("")
        } catch (e) {
            // Stay in edit mode with the typed name so nothing is lost;
            // the interceptor already toasted the reason.
            console.warn("Preimenovanje para nije uspjelo", e)
        }
    }

    async function toggleVisibility(p: UserPairPreset) {
        try {
            const updated = await setPresetVisibility(p.uuid, !p.hidden)
            setPresets((xs) => xs.map((x) => (x.uuid === p.uuid ? updated : x)))
        } catch (e) {
            // No optimistic flip to undo — the row keeps the server's
            // visibility. Interceptor already toasted.
            console.warn("Promjena vidljivosti para nije uspjela", e)
        }
    }

    async function confirmDelete() {
        if (!pendingDelete) return
        setDeleting(true)
        try {
            if (pendingDelete.partnerSlug) {
                // Co-owned preset: file an archive request instead of deleting.
                const fresh = await requestPresetArchive(pendingDelete.uuid)
                setPresets((xs) => xs.map((x) => (x.uuid === fresh.uuid ? fresh : x)))
            } else {
                // Unclaimed: instant delete.
                await deletePreset(pendingDelete.uuid)
                setPresets((xs) => xs.filter((x) => x.uuid !== pendingDelete.uuid))
                showSuccess(t("profile.pairs.deleted"))
            }
            setPendingDelete(null)
        } catch (e) {
            if ((e as { response?: { status?: number } })?.response?.status === 409) {
                showError(
                    t("profile.pairs.deleteBlockedTitle"),
                    t("profile.pairs.deleteBlockedBody"),
                )
            } else {
                showError(t("profile.pairs.deleteFailed"))
            }
        } finally {
            setDeleting(false)
        }
    }

    /** Cancel a request I previously sent. */
    async function cancelMyArchiveRequest(p: UserPairPreset) {
        try {
            await cancelPresetArchive(p.uuid)
            setPresets((xs) =>
                xs.map((x) =>
                    x.uuid === p.uuid ? { ...x, archiveRequestedByMe: false } : x,
                ),
            )
        } catch {
            showError(t("profile.pairs.cancelFailed"))
        }
    }

    /** Accept partner's request → preset goes away. */
    async function acceptPartnerArchiveRequest(p: UserPairPreset) {
        try {
            await confirmPresetArchive(p.uuid)
            setPresets((xs) => xs.filter((x) => x.uuid !== p.uuid))
        } catch {
            showError(t("profile.pairs.confirmFailed"))
        }
    }

    /** Reject partner's request → clear the pending flag. */
    async function rejectPartnerArchiveRequest(p: UserPairPreset) {
        try {
            await cancelPresetArchive(p.uuid)
            setPresets((xs) =>
                xs.map((x) =>
                    x.uuid === p.uuid ? { ...x, archiveRequestedByPartner: false } : x,
                ),
            )
        } catch {
            showError(t("profile.pairs.rejectFailed"))
        }
    }

    /* ----- Share-link copy (toaster, never alert/prompt) ----- */
    async function copyShareLink(token: string) {
        const url = `${window.location.origin}/claim-name/${token}`
        try {
            await navigator.clipboard.writeText(url)
            showSuccess(t("profile.pairs.linkCopiedTitle"), t("profile.pairs.linkCopiedBody"))
        } catch {
            // Older Safari / non-secure context — clipboard API blocked.
            showError(
                t("profile.pairs.copyFailedTitle"),
                t("profile.pairs.copyFailedBody", { url }),
            )
        }
    }

    return (
        <Card.Root variant="outline" rounded="xl" borderColor="border.emphasized" shadow="sm">
            <Card.Body p={{ base: "4", md: "5" }}>
                <VStack align="stretch" gap="3">
                    <Box>
                        <Heading size="sm">{t("profile.pairs.title")}</Heading>
                        <Text fontSize="xs" color="fg.muted">
                            {t("profile.pairs.description")}
                        </Text>
                    </Box>

                    <form onSubmit={onAddPreset}>
                        <HStack gap="2">
                            <Field.Root flex="1">
                                <Input
                                    size="sm"
                                    placeholder={t("profile.pairs.namePlaceholder")}
                                    value={draft}
                                    onChange={(e) => setDraft(e.target.value)}
                                />
                            </Field.Root>
                            <Button
                                type="submit"
                                size="sm"
                                variant="solid"
                                colorPalette="blue"
                                loading={creating}
                                disabled={!draft.trim() || creating}
                            >
                                <FiPlus /> {t("profile.pairs.add")}
                            </Button>
                        </HStack>
                    </form>

                    {loading ? (
                        <VStack align="stretch" gap="2"><Skeleton h="14" /><Skeleton h="14" /></VStack>
                    ) : presets.length === 0 ? (
                        <Text fontSize="sm" color="fg.muted">
                            {t("profile.pairs.empty")}
                        </Text>
                    ) : (
                        <VStack align="stretch" gap="2">
                            {presets.map((p) => {
                                const isClaimed = !!p.partnerSlug
                                const reqPending = p.archiveRequestedByMe || p.archiveRequestedByPartner
                                return (
                                    <Box
                                        key={p.uuid}
                                        borderWidth="1px"
                                        borderColor={p.archiveRequestedByPartner ? "orange.muted" : "border.emphasized"}
                                        rounded="md"
                                        p="3"
                                        bg={p.archiveRequestedByPartner ? "orange.subtle" : undefined}
                                    >
                                        {editingUuid === p.uuid ? (
                                            <HStack gap="2" align="center" minW="0">
                                                <Box flex="1" minW="0">
                                                    <Input
                                                        size="sm"
                                                        autoFocus
                                                        w="full"
                                                        value={editValue}
                                                        onChange={(e) => setEditValue(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === "Enter") { e.preventDefault(); void commitRename(p) }
                                                            if (e.key === "Escape") { e.preventDefault(); setEditingUuid(null); setEditValue("") }
                                                        }}
                                                    />
                                                </Box>
                                                <IconButton
                                                    aria-label={t("common.save")}
                                                    size="xs"
                                                    variant="solid"
                                                    colorPalette="green"
                                                    flexShrink={0}
                                                    onClick={() => commitRename(p)}
                                                >
                                                    <FiCheck />
                                                </IconButton>
                                                <IconButton
                                                    aria-label={t("common.cancel")}
                                                    size="xs"
                                                    variant="ghost"
                                                    flexShrink={0}
                                                    onClick={() => { setEditingUuid(null); setEditValue("") }}
                                                >
                                                    <FiX />
                                                </IconButton>
                                            </HStack>
                                        ) : (
                                            <>
                                                {/* Header row — name + action icons */}
                                                <HStack gap="2" align="center" minW="0" mb="2">
                                                    <Text flex="1" minW="0" fontWeight="medium" truncate>
                                                        {p.name}
                                                    </Text>
                                                    {p.hidden && (
                                                        <Badge size="sm" colorPalette="gray" variant="subtle">
                                                            {t("profile.pairs.hidden")}
                                                        </Badge>
                                                    )}
                                                    <IconButton
                                                        aria-label={p.hidden ? t("profile.pairs.show") : t("profile.pairs.hide")}
                                                        title={p.hidden ? t("profile.pairs.showTitle") : t("profile.pairs.hideTitle")}
                                                        size="xs"
                                                        variant="ghost"
                                                        flexShrink={0}
                                                        onClick={() => toggleVisibility(p)}
                                                    >
                                                        {p.hidden ? <FiEyeOff /> : <FiEye />}
                                                    </IconButton>
                                                    <IconButton
                                                        aria-label={t("profile.pairs.edit")}
                                                        size="xs"
                                                        variant="ghost"
                                                        flexShrink={0}
                                                        onClick={() => { setEditingUuid(p.uuid); setEditValue(p.name) }}
                                                    >
                                                        <FiEdit2 />
                                                    </IconButton>
                                                    {/* Trash button: for unclaimed presets, opens
                                                        the delete confirm. For claimed presets,
                                                        triggers the archive-request flow via the
                                                        same dialog (the dialog adapts copy). The
                                                        button is disabled when there's already a
                                                        pending request — the dedicated reply
                                                        controls take over below. */}
                                                    <IconButton
                                                        aria-label={isClaimed ? t("profile.pairs.requestDeleteAria") : t("common.delete")}
                                                        title={isClaimed ? t("profile.pairs.requestDeleteTitle") : t("common.delete")}
                                                        size="xs"
                                                        variant="ghost"
                                                        colorPalette="red"
                                                        flexShrink={0}
                                                        disabled={reqPending}
                                                        onClick={() => setPendingDelete(p)}
                                                    >
                                                        <FiTrash2 />
                                                    </IconButton>
                                                </HStack>

                                                {/* Status row — partner badge + share/archive controls */}
                                                <HStack gap="2" wrap="wrap" justify="space-between" align="center">
                                                    {isClaimed ? (
                                                        <Badge colorPalette="green" variant="subtle" size="sm">
                                                            {p.myRole === "PRIMARY"
                                                                ? t("profile.pairs.roleCoOwnerLabel")
                                                                : t("profile.pairs.roleOwnerLabel")}{" "}
                                                            <RouterLink
                                                                to={`/profil/${p.partnerSlug}`}
                                                                style={{ textDecoration: "underline" }}
                                                            >
                                                                {p.partnerName || p.partnerSlug}
                                                            </RouterLink>
                                                        </Badge>
                                                    ) : (
                                                        <Badge colorPalette="gray" variant="subtle" size="sm">
                                                            {t("profile.pairs.notShared")}
                                                        </Badge>
                                                    )}

                                                    {/* Right-side controls — three mutually-exclusive states. */}
                                                    {p.archiveRequestedByPartner ? (
                                                        <HStack gap="2" wrap="wrap">
                                                            <Text fontSize="xs" color="orange.fg">
                                                                {t("profile.pairs.partnerRequestedDelete")}
                                                            </Text>
                                                            <Button
                                                                size="xs"
                                                                colorPalette="red"
                                                                variant="solid"
                                                                onClick={() => acceptPartnerArchiveRequest(p)}
                                                            >
                                                                {t("profile.pairs.accept")}
                                                            </Button>
                                                            <Button
                                                                size="xs"
                                                                variant="outline"
                                                                onClick={() => rejectPartnerArchiveRequest(p)}
                                                            >
                                                                {t("profile.pairs.reject")}
                                                            </Button>
                                                        </HStack>
                                                    ) : p.archiveRequestedByMe ? (
                                                        <HStack gap="2" wrap="wrap">
                                                            <Text fontSize="xs" color="fg.muted">
                                                                {t("profile.pairs.requestSent")}
                                                            </Text>
                                                            <Button
                                                                size="xs"
                                                                variant="outline"
                                                                onClick={() => cancelMyArchiveRequest(p)}
                                                            >
                                                                {t("profile.pairs.cancelRequest")}
                                                            </Button>
                                                        </HStack>
                                                    ) : (
                                                        !isClaimed && p.claimToken && (
                                                            <Button
                                                                size="xs"
                                                                variant="outline"
                                                                colorPalette="blue"
                                                                onClick={() => copyShareLink(p.claimToken!)}
                                                            >
                                                                <FiShare2 /> {t("profile.pairs.share")}
                                                            </Button>
                                                        )
                                                    )}
                                                </HStack>
                                            </>
                                        )}
                                    </Box>
                                )
                            })}
                        </VStack>
                    )}
                </VStack>
            </Card.Body>

            {/* Confirm dialog — copy adapts based on whether the preset
                is co-owned. Co-owned presets file an archive request
                instead of an instant delete (handled in confirmDelete). */}
            <Dialog.Root
                open={!!pendingDelete}
                onOpenChange={(e) => { if (!e.open && !deleting) setPendingDelete(null) }}
            >
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content maxW="sm">
                        <Dialog.Header>
                            {pendingDelete?.partnerSlug
                                ? t("profile.pairs.deleteRequestDialogTitle")
                                : t("profile.pairs.deleteDialogTitle")}
                        </Dialog.Header>
                        <Dialog.Body>
                            {/* One sentence, one key: the pair and partner names are
                                parameters, because splitting the copy around them
                                would freeze Croatian's word order into every other
                                language. That costs the <b> emphasis the pre-i18n
                                markup had. */}
                            {pendingDelete?.partnerSlug ? (
                                <Text>
                                    {t("profile.pairs.deleteRequestBody", {
                                        name: pendingDelete?.name ?? "",
                                        partner: pendingDelete?.partnerName || pendingDelete?.partnerSlug || "",
                                    })}
                                </Text>
                            ) : (
                                <Text>
                                    {t("profile.pairs.deleteBody", { name: pendingDelete?.name ?? "" })}
                                </Text>
                            )}
                        </Dialog.Body>
                        <Dialog.Footer>
                            <Button variant="ghost" onClick={() => setPendingDelete(null)} disabled={deleting}>
                                {t("common.cancel")}
                            </Button>
                            <Button colorPalette="red" onClick={confirmDelete} loading={deleting}>
                                {pendingDelete?.partnerSlug ? t("profile.pairs.sendRequest") : t("common.delete")}
                            </Button>
                        </Dialog.Footer>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Dialog.Root>
        </Card.Root>
    )
}
