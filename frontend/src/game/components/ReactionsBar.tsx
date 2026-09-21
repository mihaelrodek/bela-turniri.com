import { useEffect, useState } from "react"
import { Box, Flex, chakra } from "@chakra-ui/react"
import { FiSmile } from "react-icons/fi"
import { LIMITS, REACTIONS } from "@bela/protocol"
import type { Reaction } from "@bela/protocol"
import { useTranslation } from "../../i18n"
import { REACTION_TEXT_KEYS } from "../util/reactions"
import { GLASS, INK_MUTED } from "./tableStyles"

/* ──────────────────────────────────────────────────────────────────────────
   ReactionsBar — six quick phrases under the hand (game/DESIGN.md §2.8).

   The whole social surface of a table where three of the four players may
   be bots: no typing, no thinking, one tap. The protocol's own
   `reactionCooldownMs` is enforced HERE as well as on the server, and the
   buttons visibly grey out for those three seconds — a tap that silently
   does nothing reads as a broken button, while a button that is obviously
   resting reads as a rule.

   SIX SEPARATE RINGS in a row under the hand (2026-09-18, user request —
   reverted the fused segmented-capsule look: each reaction is its own glass
   circle with its own border, gapped from its neighbours, not one long box
   with hairline dividers).

   The FIRST circle is a plain, colourless smile icon (`FiSmile`, not an
   emoji) that shows or hides the other six. Expanded by default: collapsing
   is for a player who wants the row out of the way, not a hoop to jump
   through before the row is ever useful.

   The six reaction circles stay MOUNTED and reserve their layout space even
   while collapsed — only `opacity`/`pointerEvents` toggle. The row is
   `justify="center"`, so if they were removed from the DOM instead, the row
   would shrink to just the toggle and RE-CENTRE around it alone, visibly
   jumping the toggle from "first circle of a six-circle row" to "the only
   thing in the row" (bug reported 2026-09-18). Reserving the space keeps the
   toggle's own position fixed regardless of expanded state.

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
    const [expanded, setExpanded] = useState(true)

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

    /* 34 px on a phone (2026-09-20, user request), 44 px from `sm` up. The
       strip sits under the hand and is the last thing on the screen; in a
       browser tab, where the URL bar and the toolbar are also on screen, its
       old 40 px row was height the trick needed more. It stays a comfortable
       target: the buttons are round, spaced, and hit nothing if missed.

       On a phone the strip spans the whole row (2026-09-21, user request):
       the seven buttons share the width (`flex: 1 1 0`, capped at 56 px) and
       become pills instead of a small cluster in the middle. From `sm` up
       they are the fixed 44 px circles they always were. */
    return (
        <Flex
            justify="center"
            align="center"
            gap={{ base: "1.5", sm: "1.5" }}
            w={{ base: "full", sm: "auto" }}
            px="2"
            aria-label={t("game.table.reactions")}
            role="group"
        >
            <chakra.button
                type="button"
                {...GLASS}
                w={{ base: "auto", sm: "44px" }}
                flex={{ base: "1 1 0", sm: "none" }}
                minW="34px"
                maxW={{ base: "56px", sm: "44px" }}
                h={{ base: "34px", sm: "44px" }}
                rounded="full"
                display="flex"
                alignItems="center"
                justifyContent="center"
                fontSize={{ base: "16px", sm: "18px" }}
                lineHeight="1"
                color={INK_MUTED}
                cursor="pointer"
                _hover={{ bg: "bg.muted" }}
                _active={{ bg: "bg.muted" }}
                _focusVisible={{ outline: "2px solid", outlineColor: "brand.300", outlineOffset: "2px" }}
                transition="background 0.12s ease"
                aria-label={t("game.table.reactionsToggle")}
                aria-expanded={expanded}
                onClick={() => setExpanded((v) => !v)}
            >
                <FiSmile aria-hidden="true" />
            </chakra.button>

            {REACTIONS.map((reaction) => (
                <chakra.button
                    type="button"
                    key={reaction}
                    {...GLASS}
                    w={{ base: "auto", sm: "44px" }}
                    flex={{ base: "1 1 0", sm: "none" }}
                    minW="34px"
                    maxW={{ base: "56px", sm: "44px" }}
                    h={{ base: "34px", sm: "44px" }}
                    rounded="full"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    fontSize={{ base: "16px", sm: "18px" }}
                    lineHeight="1"
                    opacity={!expanded ? 0 : resting ? 0.45 : 1}
                    pointerEvents={expanded ? "auto" : "none"}
                    aria-hidden={!expanded}
                    tabIndex={expanded ? undefined : -1}
                    cursor={disabled || resting ? "default" : "pointer"}
                    disabled={disabled || resting || !expanded}
                    _hover={disabled || resting ? undefined : { bg: "bg.muted" }}
                    _active={disabled || resting ? undefined : { bg: "bg.muted" }}
                    _focusVisible={{ outline: "2px solid", outlineColor: "brand.300", outlineOffset: "2px" }}
                    transition="background 0.12s ease, opacity 0.16s ease"
                    aria-label={t("game.table.sendReaction", {
                        reaction: t(REACTION_TEXT_KEYS[reaction]),
                    })}
                    title={t(REACTION_TEXT_KEYS[reaction])}
                    onClick={() => send(reaction)}
                >
                    <Box as="span" aria-hidden="true">{reaction}</Box>
                </chakra.button>
            ))}
        </Flex>
    )
}
