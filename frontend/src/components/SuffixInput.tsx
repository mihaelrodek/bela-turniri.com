import { Box, Input } from "@chakra-ui/react"

/* ──────────────────────────────────────────────────────────────────────────
   SuffixInput — a text field with a fixed unit painted inside its right edge
   ("€", "%", "parova"), so the value and its unit read as one control.

   The suffix is absolutely positioned and `pointerEvents="none"`, which keeps
   the whole width clickable and the caret unaffected; `pr="9"` reserves the
   room so a long value never slides under it.

   Consolidated from the two private copies in CreateTournamentPage and
   TournamentDetailsPage — the only real difference was that the edit form's
   copy supported `disabled`, which is kept here.
   ────────────────────────────────────────────────────────────────────── */

export default function SuffixInput({
    value,
    onChange,
    placeholder,
    suffix,
    inputMode = "decimal",
    disabled,
    size,
    onEnter,
    onBlur,
}: {
    value: string
    onChange: (v: string) => void
    placeholder?: string
    suffix: string
    inputMode?: "decimal" | "numeric" | "text"
    disabled?: boolean
    /** Chakra input size — defaults to the field's own default ("md"). */
    size?: "xs" | "sm" | "md" | "lg"
    /** Called when Enter is pressed in the field (default Enter does nothing). */
    onEnter?: () => void
    /** Called when the field loses focus (2026-10-03: the rules editor commits the round length on blur). */
    onBlur?: () => void
}) {
    return (
        <Box position="relative" w="full">
            <Input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                inputMode={inputMode}
                size={size}
                onBlur={onBlur}
                pr="9"
                disabled={disabled}
                onKeyDown={
                    onEnter
                        ? (e) => {
                              if (e.key !== "Enter") return
                              e.preventDefault()
                              onEnter()
                          }
                        : undefined
                }
            />
            <Box
                position="absolute"
                right="3"
                top="50%"
                style={{ transform: "translateY(-50%)" }}
                color="fg.muted"
                fontSize={size === "sm" || size === "xs" ? "xs" : "sm"}
                pointerEvents="none"
            >
                {suffix}
            </Box>
        </Box>
    )
}
