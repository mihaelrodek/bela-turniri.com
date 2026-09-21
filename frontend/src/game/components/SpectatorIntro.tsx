import { useEffect, useState } from "react"
import { Flex, HStack, Text } from "@chakra-ui/react"
import { keyframes } from "@emotion/react"
import { FiEye } from "react-icons/fi"
import { useTranslation } from "../../i18n"
import { GLASS_STRONG, INK } from "./tableStyles"

/* Module-scope emotion keyframes — a nested "@keyframes" inside Chakra's `css`
   prop silently does not run (learned on BelotShowcase, game/DESIGN.md). */
const introInOut = keyframes`
    0%   { opacity: 0; transform: translateY(10px) scale(0.96); }
    14%  { opacity: 1; transform: translateY(0) scale(1); }
    80%  { opacity: 1; transform: translateY(0) scale(1); }
    100% { opacity: 0; transform: translateY(-6px) scale(0.98); }
`
const eyeBlink = keyframes`
    0%, 38%, 50%, 100% { transform: scaleY(1); }
    44%                { transform: scaleY(0.15); }
`

const DURATION_MS = 2200
const REDUCED_DURATION_MS = 1400

/**
 * "Gledaš igru" — a short card over the felt when somebody walks into a
 * running game as a spectator (2026-09-21, user request). It replaces the
 * permanent header chip: being a spectator is news once, on the way in, and
 * is obvious afterwards (no hand, no turn). Never blocks a tap.
 */
export default function SpectatorIntro({ reducedMotion }: { reducedMotion: boolean }) {
    const { t } = useTranslation()
    const [visible, setVisible] = useState(true)
    const duration = reducedMotion ? REDUCED_DURATION_MS : DURATION_MS

    useEffect(() => {
        const timer = window.setTimeout(() => setVisible(false), duration)
        return () => window.clearTimeout(timer)
    }, [duration])

    if (!visible) return null
    return (
        <Flex position="absolute" inset="0" align="center" justify="center" pointerEvents="none" zIndex={8} role="status">
            <HStack
                {...GLASS_STRONG}
                gap="2.5"
                px="5"
                py="3"
                rounded="full"
                color={INK}
                // Resting style = the visible frame, so a dead animation can
                // never leave the card invisible (same rule as BelotShowcase).
                opacity={1}
                animation={reducedMotion ? undefined : `${introInOut} ${DURATION_MS}ms ease both`}
            >
                <Flex
                    align="center"
                    justify="center"
                    animation={reducedMotion ? undefined : `${eyeBlink} 1600ms ease 300ms 1 both`}
                >
                    <FiEye size={20} aria-hidden="true" />
                </Flex>
                <Text fontWeight="semibold" fontSize="md">{t("game.table.spectatingIntro")}</Text>
            </HStack>
        </Flex>
    )
}
