import { Box, Button, HStack, Text } from "@chakra-ui/react"
import { useTranslation } from "../../i18n"

/**
 * A labelled setting answered with NE / DA rather than a switch — 2026-09-09,
 * user request ("logika i sve ostaje isto samo da je lakše za popratiti").
 *
 * A switch asks you to know which side means on, and to read a colour to find
 * out where it currently is. Two words say it. It also makes this row the same
 * shape as the settings beside it that were always two named choices ("Igra se
 * na: Prolaz / Dosta"), so a dialog of six agreements reads as one list rather
 * than two kinds of control.
 *
 * The API is unchanged — `checked` / `onChange(boolean)` — so every call site
 * keeps working and nothing about what these settings MEAN moved.
 */
export default function GameOption({ label, shortLabel, hint, checked, disabled, onChange, compact = false }: {
    label: string
    /** Shown instead of `label` below the `sm` breakpoint — for a `compact`
        instance sharing a row where the full label would wrap. */
    shortLabel?: string
    hint?: string
    checked: boolean
    disabled?: boolean
    onChange: (value: boolean) => void
    /** Tighter padding/gap for two-per-row layouts. */
    compact?: boolean
}) {
    const { t } = useTranslation()
    return (
        <HStack
            gap={compact ? "2" : "4"} w="full" minH="44px" alignItems="center" justifyContent="space-between"
            px={compact ? "2.5" : "3"} py={compact ? "2" : "2.5"} rounded="lg"
            bg="bg.subtle" borderWidth="1px" borderColor="border.subtle"
            opacity={disabled ? 0.6 : 1}
        >
            <Box flex="1" minW="0">
                <Box fontWeight="semibold" fontSize={compact ? "xs" : "sm"} whiteSpace="nowrap" overflow="hidden" textOverflow="clip">
                    {shortLabel ? (
                        <>
                            <Box as="span" display={{ base: "inline", sm: "none" }}>{shortLabel}</Box>
                            <Box as="span" display={{ base: "none", sm: "inline" }}>{label}</Box>
                        </>
                    ) : label}
                </Box>
                {hint && <Text fontSize="xs" color="fg.muted" mt="1">{hint}</Text>}
            </Box>
            {/* One group, named by the setting it answers, so a screen reader
                hears "Privatna igra: Ne / Da" rather than two loose buttons. */}
            <HStack role="group" aria-label={label} gap="1" flexShrink={0}>
                {([false, true] as const).map((value) => (
                    <Button
                        key={String(value)}
                        type="button"
                        size="xs"
                        px="3"
                        minW="2.75rem"
                        colorPalette="brand"
                        variant={checked === value ? "solid" : "outline"}
                        aria-pressed={checked === value}
                        disabled={disabled}
                        onClick={() => onChange(value)}
                    >
                        {t(value ? "common.yes" : "common.no")}
                    </Button>
                ))}
            </HStack>
        </HStack>
    )
}
