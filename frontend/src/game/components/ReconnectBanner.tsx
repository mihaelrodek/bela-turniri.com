import { useEffect, useRef, useState } from "react"
import { Box, HStack, Spinner, Text } from "@chakra-ui/react"
import { FiCheckCircle } from "react-icons/fi"
import { useTranslation } from "../../i18n"
import { formatCountdown, useHoldCountdown } from "../hooks/useHoldCountdown"
import type { GameConnectionStatus } from "../types"

/* ──────────────────────────────────────────────────────────────────────────
   ReconnectBanner — "veza je pala, sjedalo ti se čuva još 1:47" strip shown
   over the table while the socket is down but the seat is still held.

   The server holds a seat for `reconnectGraceMs` (README §3 "Timeri") and
   reports the deadline as an absolute epoch ms; the countdown itself lives in
   `hooks/useHoldCountdown.ts` because the lobby's "active game" card shows the
   very same number.

   The table mounts it unconditionally. Connection status controls whether it
   is visible; `holdUntil` enriches the reconnect message with a countdown
   when the player has a held seat.
   ────────────────────────────────────────────────────────────────────── */

export default function ReconnectBanner({
    holdUntil,
    status,
}: {
    holdUntil?: number | null
    status: GameConnectionStatus
}) {
    const { t } = useTranslation()
    const remaining = useHoldCountdown(holdUntil)
    const interrupted = useRef(false)
    const [restored, setRestored] = useState(false)

    useEffect(() => {
        if (status !== "open") {
            interrupted.current = true
            setRestored(false)
            return
        }
        if (!interrupted.current) return
        interrupted.current = false
        setRestored(true)
        const id = window.setTimeout(() => setRestored(false), 2400)
        return () => window.clearTimeout(id)
    }, [status])

    if (status === "open" && !restored) return null

    const rejoining = status !== "open"

    return (
        <Box
            role="status"
            aria-live="polite"
            aria-atomic="true"
            rounded="l2"
            borderWidth="1px"
            borderColor={rejoining ? "orange.400" : "brand.300"}
            bg="bg.panel"
            px="3"
            py="2"
            shadow="md"
        >
            <HStack gap="2.5" align="center">
                {rejoining
                    ? <Spinner size="xs" color="orange.400" borderWidth="2px" />
                    : <FiCheckCircle color="var(--chakra-colors-brand-500)" aria-hidden="true" />}
                <Box minW="0">
                    <Text fontSize="sm" fontWeight="semibold" lineClamp={1}>
                        {t(rejoining ? "game.reconnect.title" : "game.reconnect.restored")}
                    </Text>
                    {rejoining && (
                        <Text fontSize="xs" color="fg.muted" lineClamp={1}>
                            {remaining !== null && remaining > 0
                                ? t("game.reconnect.hold", { time: formatCountdown(remaining) })
                                : t("game.reconnect.retrying")}
                        </Text>
                    )}
                </Box>
            </HStack>
        </Box>
    )
}
