import { Box, HStack, Spinner, Text } from "@chakra-ui/react"
import { useTranslation } from "../../i18n"
import { formatCountdown, useHoldCountdown } from "../hooks/useHoldCountdown"

/* ──────────────────────────────────────────────────────────────────────────
   ReconnectBanner — "veza je pala, sjedalo ti se čuva još 1:47" strip shown
   over the table while the socket is down but the seat is still held.

   The server holds a seat for `reconnectGraceMs` (README §3 "Timeri") and
   reports the deadline as an absolute epoch ms; the countdown itself lives in
   `hooks/useHoldCountdown.ts` because the lobby's "active game" card shows the
   very same number.

   Props are optional so the table can mount it unconditionally: with no
   `holdUntil` — or one already in the past — it renders nothing.
   ────────────────────────────────────────────────────────────────────── */

export default function ReconnectBanner({ holdUntil }: { holdUntil?: number | null } = {}) {
    const { t } = useTranslation()
    const remaining = useHoldCountdown(holdUntil)

    if (remaining === null || remaining <= 0) return null

    return (
        <Box
            role="status"
            aria-live="polite"
            rounded="l2"
            borderWidth="1px"
            borderColor="orange.400"
            bg="bg.panel"
            px="3"
            py="2"
            shadow="md"
        >
            <HStack gap="2.5" align="center">
                <Spinner size="xs" color="orange.400" borderWidth="2px" />
                <Box minW="0">
                    <Text fontSize="sm" fontWeight="semibold" lineClamp={1}>
                        {t("game.reconnect.title")}
                    </Text>
                    <Text fontSize="xs" color="fg.muted" lineClamp={1}>
                        {t("game.reconnect.hold", { time: formatCountdown(remaining) })}
                    </Text>
                </Box>
            </HStack>
        </Box>
    )
}
