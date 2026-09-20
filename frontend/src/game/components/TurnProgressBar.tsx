import { Box, Flex } from "@chakra-ui/react"
import { useTranslation } from "../../i18n"
import type { TurnCountdown } from "../hooks/useTurnCountdown"
import { TEAM } from "./tableStyles"

/* A single shared turn clock under the table. It reads the same absolute
   server deadline as the avatar ring, so reconnects and throttled browser
   tabs cannot restart the visual timer locally. */
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
        <Flex
            w="100%"
            maxW="200px"
            minH="6px"
            mx="auto"
            px="2"
            align="center"
            flexShrink={0}
        >
            <Box
                flex="1"
                h="2px"
                rounded="full"
                bg="border.subtle"
                overflow="hidden"
                role={active ? "progressbar" : undefined}
                aria-valuemin={active ? 0 : undefined}
                aria-valuemax={active ? 100 : undefined}
                aria-valuenow={active ? percent : undefined}
                aria-label={active ? label : undefined}
            >
                <Box
                    h="100%"
                    bg={countdown.urgent ? "red.500" : TEAM.us}
                    style={{ width: active ? `${percent}%` : "0%" }}
                    transition={reducedMotion ? "none" : "width 250ms linear, background-color 150ms ease"}
                />
            </Box>
        </Flex>
    )
}
