import { Box, Flex } from "@chakra-ui/react"
import { keyframes } from "@emotion/react"
import { useTranslation } from "../../i18n"
import type { TurnCountdown } from "../hooks/useTurnCountdown"
import { TEAM } from "./tableStyles"

/* A single shared turn clock under the table. It reads the same absolute
   server deadline as the avatar ring, so reconnects and throttled browser
   tabs cannot restart the visual timer locally. */
/* The last seconds blink (2026-10-08, owner): opacity only, so the fill's
   width keeps draining underneath and nothing around it moves. Off under
   reduced motion — the red alone says it then. */
const URGENT_BLINK = keyframes({
    "0%, 100%": { opacity: 1 },
    "50%": { opacity: 0.35 },
})

export default function TurnProgressBar({
    countdown,
    active,
    reducedMotion = false,
}: {
    countdown: TurnCountdown
    active: boolean
    reducedMotion?: boolean
}) {
    const { t } = useTranslation()
    const percent = Math.round(countdown.fraction * 100)
    const label = t("game.table.turnTimeLeft", { seconds: countdown.seconds })

    return (
        // The track is a capsule in the same voice as the turn pill under it
        // (2026-10-08, owner): a hairline in the brand green on the faint
        // tint while a clock runs, red for the last seconds; with no clock
        // it fades to the bare hairline track it used to be.
        <Flex
            w="100%"
            maxW="160px"
            minH="6px"
            mx="auto"
            px="2"
            align="center"
            flexShrink={0}
        >
            <Box
                flex="1"
                h="6px"
                rounded="full"
                borderWidth="1px"
                borderColor={active ? (countdown.urgent ? "danger" : "brand.300") : "border.subtle"}
                bg={active ? (countdown.urgent ? "red.subtle" : "brand.subtle") : "transparent"}
                overflow="hidden"
                transition={reducedMotion ? "none" : "border-color 150ms ease, background-color 150ms ease"}
                animation={active && countdown.urgent && !reducedMotion ? `${URGENT_BLINK} 0.8s ease-in-out infinite` : undefined}
                role={active ? "progressbar" : undefined}
                aria-valuemin={active ? 0 : undefined}
                aria-valuemax={active ? 100 : undefined}
                aria-valuenow={active ? percent : undefined}
                aria-label={active ? label : undefined}
            >
                <Box
                    h="100%"
                    rounded="full"
                    bg={countdown.urgent ? "danger" : TEAM.us}
                    style={{ width: active ? `${percent}%` : "0%" }}
                    transition={reducedMotion ? "none" : "width 250ms linear, background-color 150ms ease"}
                />
            </Box>
        </Flex>
    )
}
