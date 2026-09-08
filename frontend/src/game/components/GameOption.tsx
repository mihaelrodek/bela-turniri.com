import { Box, Switch, Text } from "@chakra-ui/react"

/** A labelled setting with one generous tap target — the whole row toggles,
    not just the switch, so a `compact` instance packed into half a row
    (RoomPanel.tsx's "Privatna igra" + "Spreman" row) stays ≥44px tall. */
export default function GameOption({ label, shortLabel, hint, checked, disabled, onChange, compact = false }: {
    label: string
    /** Shown instead of `label` below the `sm` breakpoint — for a `compact`
        instance sharing a row where the full label would wrap. */
    shortLabel?: string
    hint?: string
    checked: boolean
    disabled?: boolean
    onChange: (value: boolean) => void
    /** Tighter padding/gap + smaller switch for two-per-row layouts. */
    compact?: boolean
}) {
    return (
        <Switch.Root checked={checked} disabled={disabled} onCheckedChange={(e) => onChange(e.checked)}
            colorPalette="brand" size={compact ? "sm" : "md"} display="flex" justifyContent="space-between"
            gap={compact ? "2" : "4"} w="full" minH="44px" alignItems="center"
            px={compact ? "2.5" : "3"} py={compact ? "2" : "2.5"} rounded="lg" bg="bg.subtle" borderWidth="1px" borderColor="border.subtle">
            <Switch.HiddenInput />
            <Switch.Label flex="1" minW="0">
                <Box fontWeight="semibold" fontSize={compact ? "xs" : "sm"} whiteSpace="nowrap" overflow="hidden" textOverflow="clip">
                    {shortLabel ? (
                        <>
                            <Box as="span" display={{ base: "inline", sm: "none" }}>{shortLabel}</Box>
                            <Box as="span" display={{ base: "none", sm: "inline" }}>{label}</Box>
                        </>
                    ) : label}
                </Box>
                {hint && <Text fontSize="xs" color="fg.muted" mt="1">{hint}</Text>}
            </Switch.Label>
            <Switch.Control flexShrink={0}><Switch.Thumb /></Switch.Control>
        </Switch.Root>
    )
}
