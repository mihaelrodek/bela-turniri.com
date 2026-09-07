import { useEffect, useRef, useState } from "react"
import { Box, Flex, HStack, IconButton, Input, Text, VStack } from "@chakra-ui/react"
import { FiMessageSquare, FiSend, FiX } from "react-icons/fi"
import { LIMITS } from "@bela/protocol"
import type { ChatMessage } from "@bela/protocol"
import { usePlural, useTranslation } from "../../i18n"
import { GLASS_STRONG, INK, INK_MUTED } from "./tableStyles"

/* ──────────────────────────────────────────────────────────────────────────
   Chat — a bottom SHEET over the felt, not a column beside it.

   On a phone the table already owns the viewport; a permanent chat panel
   would either cover the trick or eat the hand. So it is closed by default,
   slides up over the bottom third when asked for, and its toggle carries an
   unread count so nobody has to open it to find out whether anything was
   said. The protocol's 300-character ceiling is enforced here too, so a long
   paste is trimmed rather than bounced.
   ────────────────────────────────────────────────────────────────────── */

export function ChatToggle({
    open,
    unread,
    onToggle,
}: {
    open: boolean
    unread: number
    onToggle: () => void
}) {
    const { t } = useTranslation()
    const plural = usePlural()
    const label = open
        ? t("game.chat.close")
        : unread > 0
            ? plural("game.chat.unread", unread)
            : t("game.chat.open")

    return (
        <Box position="relative">
            <IconButton
                size="xs"
                variant="ghost"
                color={INK}
                _hover={{ bg: "brand.700" }}
                aria-label={label}
                title={label}
                onClick={onToggle}
            >
                {open ? <FiX /> : <FiMessageSquare />}
            </IconButton>
            {!open && unread > 0 && (
                <Flex
                    position="absolute"
                    top="-2px"
                    right="-2px"
                    minW="15px"
                    h="15px"
                    px="1"
                    align="center"
                    justify="center"
                    rounded="full"
                    bg="brand.300"
                    color="brand.950"
                    fontSize="9px"
                    fontWeight="bold"
                    pointerEvents="none"
                >
                    {unread > 9 ? "9+" : unread}
                </Flex>
            )}
        </Box>
    )
}

export default function Chat({
    open,
    messages,
    disabled = false,
    onSend,
    onClose,
}: {
    open: boolean
    messages: ChatMessage[]
    disabled?: boolean
    onSend: (text: string) => void
    onClose: () => void
}) {
    const { t } = useTranslation()
    const [text, setText] = useState("")
    const listRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        if (!open) return
        const node = listRef.current
        if (node) node.scrollTop = node.scrollHeight
    }, [open, messages])

    if (!open) return null

    const submit = () => {
        const trimmed = text.trim().slice(0, LIMITS.chatMax)
        if (!trimmed) return
        onSend(trimmed)
        setText("")
    }

    return (
        <Flex
            position="absolute"
            insetX="0"
            bottom="0"
            direction="column"
            zIndex={12}
            {...GLASS_STRONG}
            roundedTop="l3"
            borderBottomWidth="0"
            boxShadow="0 -12px 32px rgba(0,0,0,0.5)"
            css={{
                ...GLASS_STRONG.css,
                paddingBottom: "calc(8px + env(safe-area-inset-bottom, 0px))",
                animation: "belaChatUp 180ms cubic-bezier(0.22, 0.61, 0.36, 1)",
                "@keyframes belaChatUp": {
                    from: { transform: "translateY(24px)", opacity: 0 },
                    to: { transform: "translateY(0)", opacity: 1 },
                },
            }}
        >
            <HStack justify="space-between" px="3" pt="2" pb="1">
                <Text fontSize="xs" fontWeight="bold" color={INK} textTransform="uppercase" letterSpacing="wide">
                    {t("game.chat.title")}
                </Text>
                <IconButton
                    size="2xs"
                    variant="ghost"
                    color={INK_MUTED}
                    _hover={{ bg: "brand.700", color: INK }}
                    aria-label={t("game.chat.close")}
                    onClick={onClose}
                >
                    <FiX />
                </IconButton>
            </HStack>

            <VStack gap="2" align="stretch" px="3" pb="2">
                <Box ref={listRef} maxH="min(38dvh, 190px)" overflowY="auto">
                    {messages.length === 0 ? (
                        <Text fontSize="xs" color={INK_MUTED}>{t("game.chat.empty")}</Text>
                    ) : (
                        messages.map((msg) => (
                            <Text key={msg.id} fontSize="xs" mb="1" color={INK}>
                                <Box as="span" fontWeight="bold" color="brand.200">{msg.from.name}: </Box>
                                <Box as="span" color={INK_MUTED}>{msg.text}</Box>
                            </Text>
                        ))
                    )}
                </Box>

                <HStack gap="2">
                    <Input
                        size="sm"
                        value={text}
                        maxLength={LIMITS.chatMax}
                        placeholder={t("game.chat.placeholder")}
                        aria-label={t("game.chat.placeholder")}
                        disabled={disabled}
                        bg="brand.950/62"
                        borderColor="brand.700"
                        color={INK}
                        _placeholder={{ color: INK_MUTED }}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault()
                                submit()
                            }
                        }}
                    />
                    <IconButton
                        size="sm"
                        colorPalette="brand"
                        aria-label={t("game.chat.send")}
                        disabled={disabled || text.trim().length === 0}
                        onClick={submit}
                    >
                        <FiSend />
                    </IconButton>
                </HStack>
            </VStack>
        </Flex>
    )
}
