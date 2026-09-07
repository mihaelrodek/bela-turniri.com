import { useState } from "react"
import {
    Box,
    Button,
    Dialog,
    HStack,
    IconButton,
    Input,
    Portal,
    Text,
    VStack,
    chakra,
} from "@chakra-ui/react"
import { FiCheck, FiCopy, FiUserPlus, FiX } from "react-icons/fi"
import { type WaiterDto, inviteWaiter, waiterErrorText } from "../api/waiterAccess"
import { useTranslation } from "../i18n"
import { showSuccess } from "../toaster"

/* ──────────────────────────────────────────────────────────────────────────
   WaiterInviteDialog — "Pozovi osobu": name a new waiter, get their code.

   Two steps in one dialog rather than two screens, because the whole point
   is speed at a noisy bar: type a name, hit enter, read (or copy) the code
   that comes back. Closing after "name" discards nothing server-side — the
   invite already happened the moment the request succeeds — so the "done"
   step is purely "here is what you just created", not a second confirm.

   Remounted per open (`key={open ? 1 : 0}` at the call site is NOT needed:
   `open` flipping to false unmounts nothing on its own in Chakra's Dialog,
   so this component resets its own local state in `onOpenChange` instead).
   ────────────────────────────────────────────────────────────────────── */

export default function WaiterInviteDialog({
    open,
    onClose,
    tournamentUuid,
    /** Builds the shareable join link for a freshly minted code. */
    linkFor,
    /** Fired once the invite succeeds, with the new row — the list appends it. */
    onInvited,
}: {
    open: boolean
    onClose: () => void
    tournamentUuid: string
    linkFor: (code: string) => string
    onInvited: (w: WaiterDto) => void
}) {
    const { t } = useTranslation()
    const [name, setName] = useState("")
    const [canEditCjenik, setCanEditCjenik] = useState(false)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [created, setCreated] = useState<WaiterDto | null>(null)

    function reset() {
        setName("")
        setCanEditCjenik(false)
        setBusy(false)
        setError(null)
        setCreated(null)
    }

    async function submit() {
        const trimmed = name.trim()
        if (!trimmed || busy) return
        setBusy(true)
        setError(null)
        try {
            const row = await inviteWaiter(tournamentUuid, trimmed, canEditCjenik)
            setCreated(row)
            onInvited(row)
        } catch (e) {
            setError(waiterErrorText(e, t("tournament.waiter.invite.failed")))
        } finally {
            setBusy(false)
        }
    }

    async function copy(value: string, okMessage: string) {
        try {
            await navigator.clipboard.writeText(value)
            showSuccess(okMessage)
        } catch {
            /* Clipboard denied — the value is still on screen to select by hand. */
        }
    }

    return (
        <Dialog.Root
            open={open}
            onOpenChange={(e) => {
                if (e.open || busy) return
                onClose()
                // After the close animation would be nicer, but the dialog
                // unmounts its content immediately in this library, so there
                // is no stale frame to protect against.
                reset()
            }}
            placement="center"
        >
            <Portal>
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content maxW={{ base: "92%", md: "sm" }}>
                        <Dialog.Header>
                            <HStack justify="space-between" align="start" w="full">
                                <Dialog.Title fontSize="md">
                                    {created
                                        ? t("tournament.waiter.invite.doneTitle", { name: created.name })
                                        : t("tournament.waiter.invite.title")}
                                </Dialog.Title>
                                <Dialog.CloseTrigger asChild>
                                    <IconButton aria-label={t("common.close")} variant="ghost" size="sm" disabled={busy}>
                                        <FiX />
                                    </IconButton>
                                </Dialog.CloseTrigger>
                            </HStack>
                        </Dialog.Header>

                        <Dialog.Body>
                            {created ? (
                                <VStack align="stretch" gap="3">
                                    <Text fontSize="sm" color="fg.muted">
                                        {t("tournament.waiter.invite.doneDescription")}
                                    </Text>
                                    {created.canEditCjenik && (
                                        <HStack
                                            gap="1.5"
                                            alignSelf="flex-start"
                                            px="2"
                                            py="1"
                                            rounded="full"
                                            bg="brand.subtle"
                                            color="brand.fg"
                                        >
                                            <FiCheck size={12} />
                                            <Text fontSize="xs" fontWeight="semibold">
                                                {t("tournament.waiter.invite.headWaiterLabel")}
                                            </Text>
                                        </HStack>
                                    )}
                                    <WaiterCodeChip code={created.code} />
                                    <Button
                                        variant="outline"
                                        onClick={() => void copy(
                                            linkFor(created.code),
                                            t("tournament.waiter.manage.linkCopied"),
                                        )}
                                    >
                                        <FiCopy /> {t("tournament.waiter.manage.copyLink")}
                                    </Button>
                                </VStack>
                            ) : (
                                <VStack align="stretch" gap="2">
                                    <chakra.label
                                        htmlFor="waiter-invite-name"
                                        fontSize="2xs"
                                        fontWeight="semibold"
                                        color="fg.muted"
                                        letterSpacing="wider"
                                        textTransform="uppercase"
                                    >
                                        {t("tournament.waiter.invite.nameLabel")}
                                    </chakra.label>
                                    <Input
                                        id="waiter-invite-name"
                                        value={name}
                                        onChange={(e) => { setName(e.target.value); setError(null) }}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") { e.preventDefault(); void submit() }
                                        }}
                                        placeholder={t("tournament.waiter.invite.namePlaceholder")}
                                        maxLength={60}
                                        autoFocus
                                        disabled={busy}
                                        aria-invalid={error !== null}
                                    />
                                    {error && (
                                        <Text fontSize="sm" color="red.fg">{error}</Text>
                                    )}

                                    <chakra.button
                                        type="button"
                                        onClick={() => setCanEditCjenik((v) => !v)}
                                        disabled={busy}
                                        aria-pressed={canEditCjenik}
                                        display="flex"
                                        alignItems="flex-start"
                                        gap="2.5"
                                        mt="1"
                                        p="2.5"
                                        borderWidth="1px"
                                        borderColor={canEditCjenik ? "brand.solid" : "border.subtle"}
                                        rounded="lg"
                                        cursor="pointer"
                                        textAlign="left"
                                        bg={canEditCjenik ? "brand.subtle" : "transparent"}
                                    >
                                        <Box
                                            boxSize="18px"
                                            mt="0.5"
                                            rounded="sm"
                                            borderWidth="1.5px"
                                            borderColor={canEditCjenik ? "brand.solid" : "border.emphasized"}
                                            bg={canEditCjenik ? "brand.solid" : "transparent"}
                                            color="brand.contrast"
                                            display="flex"
                                            alignItems="center"
                                            justifyContent="center"
                                            flexShrink={0}
                                        >
                                            {canEditCjenik && <FiCheck size={13} />}
                                        </Box>
                                        <Box minW="0">
                                            <Text fontSize="sm" fontWeight="medium" color="fg.ink">
                                                {t("tournament.waiter.invite.headWaiterLabel")}
                                            </Text>
                                            <Text fontSize="xs" color="fg.muted">
                                                {t("tournament.waiter.invite.headWaiterHint")}
                                            </Text>
                                        </Box>
                                    </chakra.button>
                                </VStack>
                            )}
                        </Dialog.Body>

                        <Dialog.Footer gap="2">
                            {created ? (
                                <Button colorPalette="blue" w="full" onClick={onClose}>
                                    {t("tournament.waiter.invite.done")}
                                </Button>
                            ) : (
                                <>
                                    <Button variant="ghost" onClick={onClose} disabled={busy}>
                                        {t("common.cancel")}
                                    </Button>
                                    <Button
                                        colorPalette="blue"
                                        loading={busy}
                                        disabled={!name.trim() || busy}
                                        onClick={() => void submit()}
                                    >
                                        <FiUserPlus /> {t("tournament.waiter.invite.submit")}
                                    </Button>
                                </>
                            )}
                        </Dialog.Footer>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Portal>
        </Dialog.Root>
    )
}

/**
 * A waiter's code as one compact control — the four letters and a copy
 * icon fused into a single pill, rather than a code box next to a separate
 * "Kopiraj kod" button. Shared between this dialog's success step (`"md"`,
 * plenty of room) and the waiter list row (`"sm"`) — that row also has to
 * fit the person's name next to it, and the full-size chip left almost
 * nothing for a name before it started truncating.
 */
export function WaiterCodeChip({ code, size = "md" }: { code: string; size?: "sm" | "md" }) {
    const { t } = useTranslation()
    const compact = size === "sm"
    return (
        <chakra.button
            type="button"
            onClick={() => {
                void navigator.clipboard.writeText(code).then(
                    () => showSuccess(t("tournament.waiter.manage.codeCopied")),
                    () => { /* denied — the code is still readable on the button */ },
                )
            }}
            aria-label={t("tournament.waiter.manage.copyCode")}
            title={t("tournament.waiter.manage.copyCode")}
            display="inline-flex"
            alignItems="center"
            flexShrink={0}
            gap={compact ? "1.5" : "2.5"}
            bg="bg.subtle"
            borderWidth="1px"
            borderColor="border.emphasized"
            rounded={compact ? "md" : "lg"}
            pl={compact ? "2" : "3"}
            pr={compact ? "1.5" : "2"}
            py={compact ? "1" : "1.5"}
            cursor="pointer"
            _hover={{ borderColor: "border.emphasized", bg: "bg.muted" }}
        >
            <Box
                fontFamily="mono"
                fontSize={compact ? "sm" : "lg"}
                fontWeight="bold"
                letterSpacing={compact ? "0.12em" : "0.3em"}
                textIndent={compact ? "0.12em" : "0.3em"}
                color="fg.ink"
            >
                {code}
            </Box>
            <Box color="fg.muted" display="flex" alignItems="center">
                <FiCopy size={compact ? 11 : 14} />
            </Box>
        </chakra.button>
    )
}
