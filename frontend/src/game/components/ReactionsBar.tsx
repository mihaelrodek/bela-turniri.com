import { useEffect, useState } from "react"
import { Box, Flex, chakra } from "@chakra-ui/react"
import { LIMITS, REACTIONS } from "@bela/protocol"
import type { Reaction } from "@bela/protocol"
import { useTranslation } from "../../i18n"

/* ──────────────────────────────────────────────────────────────────────────
   ReactionsBar — the six emoji under the hand (game/DESIGN.md §2.8).

   The whole social surface of a table where three of the four players may
   be bots: no typing, no thinking, one tap. The protocol's own
   `reactionCooldownMs` is enforced HERE as well as on the server, and the
   buttons visibly grey out for those three seconds — a tap that silently
   does nothing reads as a broken button, while a button that is obviously
   resting reads as a rule.

   The other half of the feature — which seat is currently showing which
   emoji — is `useReactionBubbles` in `reactionBubbles.ts`, kept in its own
   module so this one exports nothing but a component (fast refresh).
   ────────────────────────────────────────────────────────────────────── */

export default function ReactionsBar({
    disabled = false,
    onReact,
}: {
    disabled?: boolean
    onReact: (reaction: Reaction) => void
}) {
    const { t } = useTranslation()
    const [restingUntil, setRestingUntil] = useState(0)
    const [now, setNow] = useState(() => Date.now())

    // One timer, and only while the bar is actually cooling down.
    useEffect(() => {
        if (restingUntil <= Date.now()) return
        const id = setInterval(() => setNow(Date.now()), 200)
        return () => clearInterval(id)
    }, [restingUntil])

    const resting = restingUntil > now
    const send = (reaction: Reaction) => {
        const at = Date.now()
        if (at < restingUntil) return
        setRestingUntil(at + LIMITS.reactionCooldownMs)
        setNow(at)
        onReact(reaction)
    }

    return (
        <Flex
            justify="center"
            gap="1"
            px="2"
            aria-label={t("game.table.reactions")}
            role="group"
            opacity={resting ? 0.45 : 1}
            transition="opacity 0.2s ease"
        >
            {REACTIONS.map((reaction) => (
                <chakra.button
                    type="button"
                    key={reaction}
                    w="36px"
                    h="30px"
                    rounded="full"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    fontSize="17px"
                    lineHeight="1"
                    bg="brand.950/62"
                    borderWidth="1px"
                    borderColor="brand.700/70"
                    cursor={disabled || resting ? "default" : "pointer"}
                    disabled={disabled || resting}
                    _hover={disabled || resting ? undefined : { bg: "brand.700", transform: "translateY(-2px)" }}
                    _focusVisible={{ outline: "2px solid", outlineColor: "brand.300", outlineOffset: "2px" }}
                    transition="transform 0.12s ease, background 0.12s ease"
                    aria-label={t("game.table.sendReaction", { emoji: reaction })}
                    title={t("game.table.sendReaction", { emoji: reaction })}
                    onClick={() => send(reaction)}
                >
                    <Box as="span" aria-hidden="true">{reaction}</Box>
                </chakra.button>
            ))}
        </Flex>
    )
}
