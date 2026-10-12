import { Box, Flex, Text, chakra } from "@chakra-ui/react"
import { useTranslation } from "../../i18n"
import { useTurnCountdown } from "../hooks/useTurnCountdown"
import { INK, TEAM } from "./tableStyles"

/* ──────────────────────────────────────────────────────────────────────────
   DeclarePrompt — "Želiš li prijaviti zvanja?", the opt-out window.

   After trump is called the engine pauses the deal for four seconds
   (`DECLARING`, game/README.md §1.4) before it works out and reveals the
   declarations. In that window every seated human may switch their OWN
   declarations off: the deal then treats that seat as holding none, and
   everybody else's count as usual. Why anyone would: on a deal the calling
   pair is going to lose, every point of it goes to the opponents — a terca
   revealed now is 20 points handed to the other side, exactly the bela
   calculus (`BelaPrompt`), only asked once per deal instead of per card.

   DEFAULT = DECLARE. The switch starts ON, silence declares, and the window
   closes on the server's clock whatever anybody does — there is nothing to
   confirm and no button. Toggling sends `game.declare {declare}` at once;
   the last answer before the deadline counts, so off-and-on-again is fine.

   Shown ONLY to a seat that actually holds a declaration (the page checks
   its own hand with `findDeclarations`); everyone else keeps the reactions
   bar, since a switch for nothing would be noise four seconds long. It
   takes the reactions bar's slot under the hand — the one row that is
   always there — rather than floating over the felt like `BelaPrompt`: the
   trump banner and the talon reveal are playing out over the table at this
   very moment and the question must not cover them.

   The bar under the row is the server's deadline (`declaringUntil`,
   absolute epoch ms like `turnDeadline`, through the same `useTurnCountdown`
   that drives the turn ring) draining from full to empty over
   `DEFAULTS.declarePromptMs`. A throttled tab therefore shows the truth the
   instant it wakes, and the bar can never run longer than the window.
   ────────────────────────────────────────────────────────────────────── */

export default function DeclarePrompt({
    checked,
    onChange,
    deadline,
    durationMs,
    disabled = false,
    reducedMotion = false,
    compact = false,
}: {
    /** `true` = my declarations will be announced (the default). */
    checked: boolean
    onChange: (declare: boolean) => void
    /** Epoch ms when the window closes, or null when unknown (no bar then). */
    deadline: number | null
    /** The whole window, i.e. what a full bar means. */
    durationMs: number
    disabled?: boolean
    reducedMotion?: boolean
    /** The landscape table (2026-10-12, sixth pass): a small CARD, never the
     *  edge-to-edge phone sheet — the question at `sm` bold over a 30 px
     *  Ne | Da segment (48 px a side), px 3 / py 2, the countdown as an
     *  inset capsule inside it. It fills the width its parent gives it: the
     *  page measures the fan and sizes / places that parent so the card
     *  never covers a card. */
    compact?: boolean
}) {
    const { t } = useTranslation()
    const countdown = useTurnCountdown(deadline, durationMs)
    const percent = Math.round(countdown.fraction * 100)
    const barActive = deadline !== null && durationMs > 0
    const bar = (
        <Box
            h={compact ? "4px" : "3px"}
            bg="border.subtle"
            // Compact: an inset capsule inside the card's padding, full
            // inner width (fifth pass). The old 3 px strip flush with the
            // card's top edge was clipped by its 12 px rounded corners, so
            // as it drained toward the left only a sliver curving away at
            // the top-left corner was left — it read as a green fragment
            // sitting OUTSIDE the card.
            rounded={compact ? "full" : undefined}
            overflow={compact ? "hidden" : undefined}
            alignSelf={compact ? "stretch" : undefined}
            role={barActive ? "progressbar" : undefined}
            aria-valuemin={barActive ? 0 : undefined}
            aria-valuemax={barActive ? 100 : undefined}
            aria-valuenow={barActive ? percent : undefined}
            aria-label={barActive ? t("game.declaring.timeLeft", { seconds: countdown.seconds }) : undefined}
        >
            <Box
                h="100%"
                bg={TEAM.us}
                rounded={compact ? "full" : undefined}
                style={{ width: barActive ? `${percent}%` : "0%" }}
                transition={reducedMotion ? "none" : "width 250ms linear"}
            />
        </Box>
    )

    return (
        <Flex
            role="group"
            aria-label={t("game.declaring.ask")}
            direction="column"
            w={compact ? "100%" : { base: "auto", sm: "auto" }}
            minW={compact ? "0" : { sm: "360px" }}
            maxW={compact ? "none" : { base: "none", sm: "480px" }}
            // On a phone it is a SHEET, not a card (2026-10-08, owner): it
            // bleeds past the slot's `px="2"` to both screen edges and down
            // through the slot's bottom inset to the very edge, paying the
            // home-indicator inset itself. From `sm` up it is a centred
            // card again.
            mx={compact ? "0" : { base: "-2", sm: "auto" }}
            mb={compact ? "0" : { base: "calc(-4px - var(--safe-bottom))", sm: "0" }}
            pb={compact ? "0" : { base: "var(--safe-bottom)", sm: "0" }}
            // Opaque and raised, not the outlined glass of the first cut
            // (2026-10-08, owner: too faint to read as a question): it is
            // the one thing to act on for four seconds, so it sits ON the
            // table like a card, with a shadow instead of a frame.
            bg="bg.panel"
            shadow="raised"
            roundedTop="l3"
            roundedBottom={compact ? "l3" : { base: "0", sm: "l3" }}
            overflow="hidden"
            css={{
                animation: reducedMotion ? undefined : "declareAskIn 160ms cubic-bezier(0.22, 1.2, 0.36, 1)",
                "@keyframes declareAskIn": {
                    from: { transform: "translateY(6px)", opacity: 0 },
                    to: { transform: "translateY(0)", opacity: 1 },
                },
            }}
        >
            {!compact && bar}
            {/* Compact (2026-10-08, owner): one 52 px row, the question in
                `md`, a medium switch — the sheet's width and its drop to the
                screen edge already make it the one thing on screen. */}
            <Flex
                direction={compact ? "column" : "row"}
                align="center"
                gap={compact ? "1.5" : "3"}
                px={compact ? "3" : "4"}
                py={compact ? "2" : "2.5"}
                minH={compact ? "0" : "52px"}
            >
                {compact && bar}
                <Text
                    flex={compact ? undefined : "1"}
                    fontSize={compact ? "sm" : "md"}
                    fontFamily="heading"
                    fontWeight="bold"
                    color={INK}
                    lineHeight="1.2"
                    textAlign={compact ? "center" : undefined}
                >
                    {t("game.declaring.ask")}
                </Text>
                {/* A two-way segment, "Ne | Da", instead of a stock switch
                    (2026-10-08, owner): the answer is readable as a WORD, and
                    the filled half slides between the two. A radiogroup for
                    assistive tech — two states, one chosen. */}
                <Flex
                    role="radiogroup"
                    aria-label={t("game.declaring.switch")}
                    position="relative"
                    flexShrink={0}
                    h={compact ? "30px" : "34px"}
                    p="3px"
                    rounded="full"
                    bg="bg.muted"
                    borderWidth="1px"
                    borderColor="border.subtle"
                    opacity={disabled ? 0.6 : 1}
                >
                    <Box
                        aria-hidden="true"
                        position="absolute"
                        top="3px"
                        bottom="3px"
                        left="3px"
                        w="calc(50% - 3px)"
                        rounded="full"
                        bg={checked ? "brand.solid" : "bg.panel"}
                        boxShadow="0 1px 3px rgba(0,0,0,0.18)"
                        transform={checked ? "translateX(100%)" : "translateX(0)"}
                        transition={reducedMotion ? "none" : "transform 180ms cubic-bezier(0.22, 1, 0.36, 1), background-color 180ms ease"}
                    />
                    {([false, true] as const).map((value) => (
                        <chakra.button
                            key={String(value)}
                            type="button"
                            role="radio"
                            aria-checked={checked === value}
                            disabled={disabled}
                            onClick={() => onChange(value)}
                            position="relative"
                            zIndex={1}
                            minW={compact ? "48px" : "52px"}
                            px="3"
                            rounded="full"
                            fontSize="sm"
                            fontWeight="bold"
                            lineHeight="1"
                            color={checked === value ? (value ? "brand.contrast" : INK) : "fg.muted"}
                            cursor={disabled ? "default" : "pointer"}
                            transition={reducedMotion ? "none" : "color 180ms ease"}
                            _focusVisible={{ outline: "2px solid", outlineColor: "brand.300", outlineOffset: "2px" }}
                        >
                            {t(value ? "game.bela.askYes" : "game.bela.askNo")}
                        </chakra.button>
                    ))}
                </Flex>
            </Flex>
        </Flex>
    )
}
