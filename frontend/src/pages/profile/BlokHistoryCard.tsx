import React from "react"
import { Box, Button, Card, Dialog, Heading, HStack, IconButton, Skeleton, Text, VStack } from "@chakra-ui/react"
import { FiBookOpen, FiTrash2 } from "react-icons/fi"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
    deleteBlokHistory,
    fetchBlokHistoryDetail,
    fetchBlokHistoryList,
    type BlokHistoryEndRule,
    type BlokHistorySide,
    type BlokHistorySummary,
} from "../../api/blokHistory"
import { BlokGamesList } from "../../components/BlokGamesList"
import ConfirmDialog from "../../components/ConfirmDialog"
import EmptyState from "../../components/EmptyState"
import { qk } from "../../queryClient"
import { formatDate } from "../../utils/format"
import { useTranslation, usePlural, type TParams } from "../../i18n"

/* ──────────────────────────────────────────────────────────────────────────
   "Blok" — private scorepad history (BLOK-HISTORY.md §4). Owner-only, never
   rendered on a visitor's view of the profile (gated upstream in
   PublicProfilePage, same mechanism as "predlosci" / "racuni").

   The list ("sažeci") never carries deals — only opening a session fetches
   its full record (`fetchBlokHistoryDetail`), a second `useQuery` keyed by
   the open session's uuid.

   The games and deals inside an opened session are drawn by
   `components/BlokGamesList.tsx` — the same component the public share page
   (§5.2) uses, so the two views of one record cannot drift apart in
   typography, collapse behaviour or surface opacity. It also owns the deal
   scoring: per-deal points run through the SAME `scoreManualDeal` the live
   blok uses, so a session that ended with a fallen call renders the fall
   instead of the raw card split, and declarations stay individual
   ("20 + 50", never summed — the one thing a recomputed total cannot
   recover).
   ────────────────────────────────────────────────────────────────────── */

type Translator = (key: string, params?: TParams) => string

/** `names.us`/`names.them` is `""` when the player never renamed a side —
 *  BLOK-HISTORY.md §2.3 says that means "use the translated MI / VI". */
function sideName(names: { us: string; them: string }, side: BlokHistorySide, t: Translator): string {
    const raw = names[side]
    return raw && raw.trim() ? raw : t(side === "us" ? "blok.side.us" : "blok.side.them")
}

/** The end-of-game rule as a label. Anything other than an explicit
 *  `"dosta"` — including a session saved before the field existed — reads as
 *  `"prolaz"`, the documented default (BLOK-HISTORY.md §5.5). */
function endRuleLabel(rule: BlokHistoryEndRule | null | undefined, t: Translator): string {
    return t(rule === "dosta" ? "profile.blok.rule.dosta" : "profile.blok.rule.prolaz")
}

export function BlokHistoryCard() {
    const { t } = useTranslation()
    const plural = usePlural()
    const queryClient = useQueryClient()

    const { data: sessionsData, isLoading, error } = useQuery({
        queryKey: qk.blokHistory,
        queryFn: fetchBlokHistoryList,
        // The interceptor already toasts a failed fetch — a client-wide
        // retry would toast the same failure twice for one real error.
        retry: false,
    })
    const sessions = sessionsData ?? []

    const [openUuid, setOpenUuid] = React.useState<string | null>(null)
    const {
        data: detail,
        isLoading: detailLoading,
        isError: detailFailed,
    } = useQuery({
        queryKey: qk.blokHistoryDetail(openUuid ?? ""),
        queryFn: () => fetchBlokHistoryDetail(openUuid as string),
        enabled: openUuid != null,
    })

    const [pendingDelete, setPendingDelete] = React.useState<BlokHistorySummary | null>(null)
    const [deleting, setDeleting] = React.useState(false)

    async function confirmDelete() {
        if (!pendingDelete) return
        setDeleting(true)
        try {
            await deleteBlokHistory(pendingDelete.uuid)
            queryClient.setQueryData<BlokHistorySummary[]>(
                qk.blokHistory,
                (old) => (old ?? []).filter((s) => s.uuid !== pendingDelete.uuid),
            )
            if (openUuid === pendingDelete.uuid) setOpenUuid(null)
            setPendingDelete(null)
        } catch {
            // Interceptor already toasted the reason.
        } finally {
            setDeleting(false)
        }
    }

    return (
        <Card.Root variant="outline" rounded="xl" borderColor="border.emphasized" shadow="sm">
            <Card.Body p={{ base: "4", md: "5" }}>
                <VStack align="stretch" gap="3">
                    <Box>
                        <Heading size="sm">{t("profile.blok.title")}</Heading>
                        <Text fontSize="xs" color="fg.muted">
                            {t("profile.blok.description")}
                        </Text>
                    </Box>

                    {isLoading ? (
                        <VStack align="stretch" gap="2">
                            <Skeleton h="16" /><Skeleton h="16" />
                        </VStack>
                    ) : error ? (
                        <Text fontSize="sm" color="fg.muted">
                            {t("profile.blok.loadFailed")}
                        </Text>
                    ) : sessions.length === 0 ? (
                        <EmptyState
                            icon={FiBookOpen}
                            title={t("profile.blok.empty")}
                            description={t("profile.blok.emptyHint")}
                            compact
                        />
                    ) : (
                        <VStack align="stretch" gap="2">
                            {sessions.map((s) => {
                                const us = sideName(s.names, "us", t)
                                const them = sideName(s.names, "them", t)
                                return (
                                    <Box
                                        key={s.uuid}
                                        borderWidth="1px"
                                        borderColor="border.emphasized"
                                        rounded="md"
                                        p="3"
                                        cursor="pointer"
                                        onClick={() => setOpenUuid(s.uuid)}
                                        _hover={{ borderColor: "blue.emphasized", bg: "bg.subtle" }}
                                    >
                                        <HStack justify="space-between" align="start" gap="2">
                                            <Box flex="1" minW="0">
                                                <Text fontSize="xs" color="fg.muted">
                                                    {formatDate(s.finishedAt || s.startedAt)}
                                                </Text>
                                                <Text fontSize="sm" mt="1" truncate>
                                                    {us}{" "}
                                                    <Text as="span" color="fg.muted">{t("profile.vs")}</Text>{" "}
                                                    {them}
                                                </Text>
                                                {/* "Do 1001 · prolaz · 3 partije"
                                                    (BLOK-HISTORY.md §5.5). The count
                                                    stays HERE, unlike on the share
                                                    page: this row does not list the
                                                    games below it — they are one tap
                                                    away in the dialog — so the number
                                                    is the only place it is said. */}
                                                <Text fontSize="xs" color="fg.muted" mt="1">
                                                    {t("profile.blok.meta", {
                                                        target: s.target,
                                                        rule: endRuleLabel(s.gameEndRule, t),
                                                    })}
                                                    {" · "}
                                                    {plural("profile.blok.gamesCount", s.gamesCount)}
                                                </Text>
                                            </Box>
                                            <VStack align="end" gap="2" flexShrink={0}>
                                                <Text
                                                    fontWeight="bold"
                                                    fontSize="lg"
                                                    css={{ fontVariantNumeric: "tabular-nums" }}
                                                >
                                                    {s.gamesUs} : {s.gamesThem}
                                                </Text>
                                                <IconButton
                                                    aria-label={t("common.delete")}
                                                    size="xs"
                                                    variant="ghost"
                                                    colorPalette="red"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        setPendingDelete(s)
                                                    }}
                                                >
                                                    <FiTrash2 />
                                                </IconButton>
                                            </VStack>
                                        </HStack>
                                    </Box>
                                )
                            })}
                        </VStack>
                    )}
                </VStack>
            </Card.Body>

            {/* Opened session — its games in order, and every deal within each. */}
            <Dialog.Root
                open={openUuid != null}
                onOpenChange={(e) => { if (!e.open) setOpenUuid(null) }}
            >
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content maxW="lg">
                        <Dialog.Header>
                            <Text fontWeight="semibold" truncate>
                                {detail
                                    ? `${sideName(detail.names, "us", t)} ${detail.gamesUs} : ${detail.gamesThem} ${sideName(detail.names, "them", t)}`
                                    : t("profile.blok.detailTitleFallback")}
                            </Text>
                        </Dialog.Header>
                        <Dialog.Body maxH="70vh" overflowY="auto">
                            {detailLoading ? (
                                <VStack align="stretch" gap="2">
                                    <Skeleton h="10" /><Skeleton h="10" />
                                </VStack>
                            ) : detailFailed || !detail ? (
                                <Text fontSize="sm" color="fg.muted">
                                    {t("profile.blok.detailLoadFailed")}
                                </Text>
                            ) : (
                                /* One record, one renderer: the same component
                                   the public share page uses (§5.2), keyed by
                                   the record so opening a different session
                                   starts from its own default collapse state
                                   (single game open, longer series closed). */
                                <BlokGamesList
                                    key={detail.uuid}
                                    games={detail.games}
                                    nameUs={sideName(detail.names, "us", t)}
                                    nameThem={sideName(detail.names, "them", t)}
                                />
                            )}
                        </Dialog.Body>
                        <Dialog.Footer>
                            <Button variant="ghost" onClick={() => setOpenUuid(null)}>
                                {t("common.close")}
                            </Button>
                        </Dialog.Footer>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Dialog.Root>

            <ConfirmDialog
                open={!!pendingDelete}
                title={t("profile.blok.deleteDialogTitle")}
                description={
                    pendingDelete
                        ? t("profile.blok.deleteBody", {
                            result: `${pendingDelete.gamesUs} : ${pendingDelete.gamesThem}`,
                        })
                        : undefined
                }
                destructive
                busy={deleting}
                onConfirm={confirmDelete}
                onCancel={() => setPendingDelete(null)}
            />
        </Card.Root>
    )
}
