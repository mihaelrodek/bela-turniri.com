import { Box, Button, HStack, Spinner, Text } from "@chakra-ui/react"
import { useOfflineQueue } from "../hooks/useOfflineQueue"
import { usePlural, useTranslation } from "../i18n"

/* ──────────────────────────────────────────────────────────────────────────
   SyncIndicator — the single, quiet piece of feedback for the offline queue.

   The organiser types results at the table on a phone. Ten saved scores must
   not mean ten green toasts, and a save that has NOT reached the server yet
   must not look identical to one that has. So the queued writes are silent
   and this pill carries the whole story instead: nothing pending, N waiting,
   sending right now, or no connection at all.

   Semantic tokens only (bg.panel / fg.muted / border.subtle) — see
   src/system.ts. Raw gray.* would look right in one colour mode and wrong in
   the other.
   ────────────────────────────────────────────────────────────────────── */

/* The pill is read at a glance, so "2 promjene čekaju" must not come out as
   "2 promjena čeka" — and Slovenian needs a dual form Croatian does not have.
   The category rules for both live in `i18n/index.ts`; the wording lives in
   the `tournament.sync.pending.*` family. */

type Props = {
    /** Scopes nothing on its own — the pill counts the whole tab's queue. */
    tournamentUuid?: string
    /**
     * Hide the pill entirely when there is nothing to say. Spectators never
     * queue anything, so the organiser-only views pass false and everyone
     * else gets no chrome at all.
     */
    hideWhenIdle?: boolean
}

export default function SyncIndicator({ tournamentUuid, hideWhenIdle = false }: Props) {
    const { pendingCount, syncing, online, stuck, retryNow } = useOfflineQueue(tournamentUuid)
    const { t } = useTranslation()
    const plural = usePlural()

    const idle = pendingCount === 0 && online && !syncing
    if (idle && hideWhenIdle) return null

    let dot = "green.solid"
    let label = t("tournament.sync.allSaved")
    if (stuck) {
        dot = "red.solid"
        label = t("tournament.sync.stuck")
    } else if (!online) {
        dot = "orange.solid"
        label = pendingCount > 0
            ? t("tournament.sync.offlineWithPending", {
                pending: plural("tournament.sync.pending", pendingCount),
            })
            : t("tournament.sync.offline")
    } else if (syncing) {
        dot = "blue.solid"
        label = t("tournament.sync.saving")
    } else if (pendingCount > 0) {
        dot = "orange.solid"
        label = plural("tournament.sync.pending", pendingCount)
    }

    return (
        <HStack
            gap="2"
            px="2.5"
            py="1"
            rounded="full"
            bg="bg.panel"
            borderWidth="1px"
            borderColor="border.subtle"
            maxW="100%"
            role="status"
            aria-live="polite"
        >
            {syncing && !stuck ? (
                <Spinner size="xs" color="fg.muted" />
            ) : (
                <Box w="2" h="2" rounded="full" bg={dot} flexShrink="0" />
            )}
            <Text fontSize="xs" color="fg.muted" lineClamp={1}>
                {label}
            </Text>
            {stuck && (
                <Button size="2xs" variant="ghost" colorPalette="blue" onClick={retryNow}>
                    {t("tournament.sync.retry")}
                </Button>
            )}
        </HStack>
    )
}
