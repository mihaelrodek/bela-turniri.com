import { useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
    Badge,
    Box,
    Button,
    HStack,
    Spinner,
    Stack,
    Text,
} from "@chakra-ui/react"
import { FiMail, FiMessageSquare } from "react-icons/fi"
import {
    listContactMessages,
    markContactMessageHandled,
    type ContactMessageDto,
} from "../api/admin"
import { qk } from "../queryClient"
import { useTranslation, usePlural } from "../i18n"
import { formatDateTime } from "../utils/format"
import SectionCard from "./SectionCard"
import EmptyState from "./EmptyState"

/**
 * Admin-only "Poruke" tab on the profile page — the triage inbox for
 * /kontakt submissions (see backend AdminContactController). The row is the
 * durable copy of a form submission; the reply itself happens off-platform
 * by e-mail, so all this view does is let an admin see what came in and mark
 * it answered.
 *
 * Sister tab to {@link AdminPlayersListTab}: same "load once client-side,
 * filter locally" shape, since the inbox is capped at 100 rows server-side.
 */
export default function AdminContactMessagesTab() {
    const { t } = useTranslation()
    const plural = usePlural()
    const queryClient = useQueryClient()
    const [filter, setFilter] = useState<"open" | "all">("open")
    const [pendingId, setPendingId] = useState<number | null>(null)

    const { data: messages, isPending, isError } = useQuery({
        queryKey: qk.adminContactMessages,
        queryFn: listContactMessages,
    })

    const unhandledCount = useMemo(
        () => (messages ?? []).filter((m) => !m.handled).length,
        [messages],
    )

    const visible = useMemo(() => {
        if (!messages) return []
        return filter === "open" ? messages.filter((m) => !m.handled) : messages
    }, [messages, filter])

    async function toggleHandled(msg: ContactMessageDto) {
        setPendingId(msg.id)
        try {
            const updated = await markContactMessageHandled(msg.id, !msg.handled)
            queryClient.setQueryData<ContactMessageDto[]>(
                qk.adminContactMessages,
                (rows) => (rows ?? []).map((r) => (r.id === updated.id ? updated : r)),
            )
        } catch {
            // http interceptor surfaces the toast
        } finally {
            setPendingId(null)
        }
    }

    return (
        <SectionCard
            icon={<FiMessageSquare />}
            title={t("admin.contactMessages.heading")}
            description={t("admin.contactMessages.description")}
            action={
                unhandledCount > 0 ? (
                    <Badge size="sm" variant="subtle" colorPalette="orange">
                        {plural("admin.contactMessages.unhandledCount", unhandledCount)}
                    </Badge>
                ) : undefined
            }
        >
            <Stack gap="4">
                {/* Two-way toggle, not a select — there are only ever two
                    states and both should be visible at a glance. */}
                <HStack
                    gap="1"
                    p="1"
                    bg="bg.subtle"
                    borderWidth="1px"
                    borderColor="border.subtle"
                    rounded="lg"
                    role="group"
                    alignSelf="flex-start"
                >
                    <Button
                        size="sm"
                        minH="11"
                        variant={filter === "open" ? "solid" : "ghost"}
                        colorPalette="blue"
                        onClick={() => setFilter("open")}
                    >
                        {t("admin.contactMessages.filterOpen")}
                    </Button>
                    <Button
                        size="sm"
                        minH="11"
                        variant={filter === "all" ? "solid" : "ghost"}
                        colorPalette="blue"
                        onClick={() => setFilter("all")}
                    >
                        {t("admin.contactMessages.filterAll")}
                    </Button>
                </HStack>

                {isPending ? (
                    <HStack py="4" justify="center"><Spinner size="sm" /></HStack>
                ) : isError ? (
                    <Text fontSize="sm" color="fg.muted">{t("admin.contactMessages.loading.error")}</Text>
                ) : visible.length === 0 ? (
                    <EmptyState
                        icon={FiMail}
                        title={t("admin.contactMessages.empty")}
                        compact
                    />
                ) : (
                    <Stack gap="3">
                        {visible.map((msg) => (
                            <ContactMessageRow
                                key={msg.id}
                                message={msg}
                                pending={pendingId === msg.id}
                                onToggleHandled={() => toggleHandled(msg)}
                            />
                        ))}
                    </Stack>
                )}
            </Stack>
        </SectionCard>
    )
}

function ContactMessageRow({
    message,
    pending,
    onToggleHandled,
}: {
    message: ContactMessageDto
    pending: boolean
    onToggleHandled: () => void
}) {
    const { t } = useTranslation()
    const subject = message.subject?.trim() || t("admin.contactMessages.subjectFallback")
    const mailtoSubject = encodeURIComponent(`${t("admin.contactMessages.mailSubjectPrefix")}${subject}`)
    const mailtoHref = `mailto:${message.email}?subject=${mailtoSubject}`

    return (
        <Box
            p="3"
            borderWidth="1px"
            borderColor="border.subtle"
            rounded="md"
            bg={message.handled ? "bg.panel" : "bg.muted"}
        >
            <Stack gap="2">
                <HStack justify="space-between" align="start" gap="3" wrap="wrap">
                    <Box minW="0">
                        <Text fontWeight="semibold" fontSize="sm" truncate>{message.name}</Text>
                        <Text fontSize="xs" color="fg.muted" truncate asChild>
                            <a href={mailtoHref}>{message.email}</a>
                        </Text>
                    </Box>
                    <HStack gap="2" flexShrink={0} wrap="wrap">
                        {message.locale && (
                            <Badge size="sm" variant="outline">{message.locale}</Badge>
                        )}
                        <Badge size="sm" variant="subtle" colorPalette={message.handled ? "green" : "orange"}>
                            {message.handled
                                ? t("admin.contactMessages.statusHandled")
                                : t("admin.contactMessages.statusOpen")}
                        </Badge>
                    </HStack>
                </HStack>

                <Text fontSize="xs" color="fg.muted">{formatDateTime(message.createdAt)}</Text>

                <Text fontSize="sm" fontWeight="medium">{subject}</Text>
                <Text fontSize="sm" whiteSpace="pre-wrap">{message.message}</Text>

                <HStack justify="flex-end">
                    <Button
                        size="sm"
                        minH="11"
                        variant={message.handled ? "outline" : "solid"}
                        colorPalette="blue"
                        loading={pending}
                        onClick={onToggleHandled}
                    >
                        {message.handled
                            ? t("admin.contactMessages.unmarkHandled")
                            : t("admin.contactMessages.markHandled")}
                    </Button>
                </HStack>
            </Stack>
        </Box>
    )
}
