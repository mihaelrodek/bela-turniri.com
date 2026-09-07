import { Box, chakra, HStack, Text, VStack } from "@chakra-ui/react"
import { FiCheck } from "react-icons/fi"

/* ──────────────────────────────────────────────────────────────────────────
   WizardStepper — the numbered progress strip that sits above a multi-step
   form (today: the create-tournament wizard).

   The step count is whatever `steps.length` says — today the create form
   passes three (Osnovno → Kotizacija i nagrade → Pregled), and nothing here
   assumes a number. Two layouts from one source of truth:

   • md and up — one chip per step, each carrying its number (or a ✓ once
     passed) and its label, so the whole route is readable at a glance. The
     chips share the row evenly (`flex 1`) and a label too long for its share
     truncates rather than wrapping, which is what keeps a long name like
     „Kotizacija i nagrade“ on one line at every width.
   • base (phones) — full labels crushed side by side are unreadable at
     390px, so the compact layout shows the CURRENT step's name plus a
     "2 / 3" counter on one row, and a row of bare numbered dots under it.
     Every dot is still tappable, so backwards navigation survives.

   Navigation policy lives in the parent: this component only reports which
   step was tapped through `onSelect`, and the parent decides whether the
   move is allowed (the create form validates every step in between before
   letting the user jump forward).

   Colours are semantic only — `colorPalette.*` for the active/done states
   and `bg.subtle` / `fg.muted` for the ones not reached yet — so the strip
   follows the theme in both light and dark mode.
   ────────────────────────────────────────────────────────────────────── */

export type WizardStepperProps = {
    /** Human labels, one per step. Length defines the step count. */
    steps: string[]
    /** 1-based index of the step currently being edited. */
    current: number
    /** Called with the 1-based index of a tapped step. */
    onSelect: (step: number) => void
    /** Accessible name for the strip, e.g. "Koraci kreiranja turnira". */
    ariaLabel: string
    /** Pre-formatted compact counter for phones, e.g. "2 / 3". */
    progressLabel: string
    /** Accessible per-chip name builder, e.g. `Korak 2 od 3: Kotizacija i nagrade`. */
    stepAriaLabel: (step: number, label: string) => string
}

/** The circular number badge shared by both layouts. */
function StepDot({
    n,
    state,
    size,
}: {
    n: number
    state: "done" | "active" | "todo"
    size: string
}) {
    return (
        <Box
            w={size}
            h={size}
            rounded="full"
            display="grid"
            flexShrink={0}
            fontSize="xs"
            fontWeight="bold"
            lineHeight="1"
            bg={
                state === "active"
                    ? "colorPalette.contrast"
                    : state === "done"
                      ? "colorPalette.solid"
                      : "bg.emphasized"
            }
            color={
                state === "active"
                    ? "colorPalette.solid"
                    : state === "done"
                      ? "colorPalette.contrast"
                      : "fg.muted"
            }
            css={{ placeItems: "center" }}
        >
            {state === "done" ? <FiCheck aria-hidden /> : n}
        </Box>
    )
}

export default function WizardStepper({
    steps,
    current,
    onSelect,
    ariaLabel,
    progressLabel,
    stepAriaLabel,
}: WizardStepperProps) {
    const stateOf = (n: number): "done" | "active" | "todo" =>
        n === current ? "active" : n < current ? "done" : "todo"

    return (
        <Box
            as="nav"
            aria-label={ariaLabel}
            colorPalette="blue"
            bg="bg.panel"
            borderWidth="1px"
            borderColor="border.emphasized"
            rounded="xl"
            shadow="sm"
            px="3"
            py={{ base: "2", md: "1.5" }}
        >
            {/* ── Desktop: number + label chips ─────────────────────── */}
            <HStack display={{ base: "none", md: "flex" }} gap="1" justify="space-between">
                {steps.map((label, i) => {
                    const n = i + 1
                    const state = stateOf(n)
                    return (
                        <chakra.button
                            key={label}
                            // Inside a <form> a button with no explicit type
                            // defaults to type="submit" — tapping a chip would
                            // publish the tournament instead of navigating.
                            type="button"
                            onClick={() => onSelect(n)}
                            aria-current={state === "active" ? "step" : undefined}
                            aria-label={stepAriaLabel(n, label)}
                            display="flex"
                            alignItems="center"
                            gap="2"
                            flex="1"
                            minW="0"
                            px="3"
                            py="1.5"
                            rounded="full"
                            cursor="pointer"
                            transition="background 0.15s ease, color 0.15s ease"
                            bg={
                                state === "active"
                                    ? "colorPalette.solid"
                                    : state === "done"
                                      ? "colorPalette.subtle"
                                      : "transparent"
                            }
                            color={
                                state === "active"
                                    ? "colorPalette.contrast"
                                    : state === "done"
                                      ? "colorPalette.fg"
                                      : "fg.muted"
                            }
                            _hover={{ bg: state === "active" ? "colorPalette.solid" : "bg.subtle" }}
                            fontSize="sm"
                            fontWeight="semibold"
                        >
                            <StepDot n={n} state={state} size="20px" />
                            <Box truncate>{label}</Box>
                        </chakra.button>
                    )
                })}
            </HStack>

            {/* ── Phones: current step name + counter, dots underneath ── */}
            <VStack display={{ base: "flex", md: "none" }} align="stretch" gap="2">
                <HStack justify="space-between" gap="2">
                    <Text fontSize="sm" fontWeight="semibold" truncate>
                        {steps[current - 1]}
                    </Text>
                    <Text fontSize="xs" color="fg.muted" flexShrink={0} fontVariantNumeric="tabular-nums">
                        {progressLabel}
                    </Text>
                </HStack>
                <HStack gap="2">
                    {steps.map((label, i) => {
                        const n = i + 1
                        const state = stateOf(n)
                        return (
                            <chakra.button
                                key={label}
                                type="button"
                                onClick={() => onSelect(n)}
                                aria-current={state === "active" ? "step" : undefined}
                                aria-label={stepAriaLabel(n, label)}
                                flex="1"
                                display="flex"
                                alignItems="center"
                                justifyContent="center"
                                gap="2"
                                py="1"
                                rounded="full"
                                cursor="pointer"
                                bg={state === "active" ? "colorPalette.solid" : "bg.subtle"}
                            >
                                <StepDot n={n} state={state} size="18px" />
                            </chakra.button>
                        )
                    })}
                </HStack>
            </VStack>
        </Box>
    )
}
