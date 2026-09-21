import { Box, Text } from "@chakra-ui/react"
import type { ReactNode } from "react"
import BelaAvatar from "../../components/avatars/BelaAvatar"
import { isAvatarId } from "../../components/avatars/avatarArt"
import AvatarPhoto from "./AvatarPhoto"

/* ──────────────────────────────────────────────────────────────────────────
   PlayerAvatar — one round avatar, shared by the lobby's room cards, the
   room's seat rows and its "2 vs 2" preview (game/DESIGN.md §1 "Lobby"/"Soba").

   Four states, in this order of preference: the picked face (`avatarPreset`,
   drawn by `BelaAvatar`), a photo (`avatarUrl`), initials from `name` when
   there is neither, or `empty` — a dashed circle with a "+" for a seat nobody
   has taken, the exact same visual `Seat.tsx` uses on the live table so the
   lobby list and the room preview never look like a different app from the
   felt.

   This matches `UserAvatar`: choosing a character leaves an older uploaded
   photo stored, so a valid preset must win until the user explicitly switches
   back to the photo. Initials remain the fallback for a face this build does
   not recognise.
   ────────────────────────────────────────────────────────────────────── */

const SIZES = {
    xs: { box: "28px", font: "2xs" },
    sm: { box: "36px", font: "xs" },
    md: { box: "44px", font: "sm" },
    lg: { box: "56px", font: "md" },
} as const

export type PlayerAvatarSize = keyof typeof SIZES

function initialsOf(name: string): string {
    return (
        name
            .split(/[\s@]+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase())
            .join("") || "?"
    )
}

export default function PlayerAvatar({
    name,
    avatarUrl = null,
    avatarPreset = null,
    size = "md",
    empty = false,
    emptyIcon,
    online = false,
    dimmed = false,
}: {
    /** Ignored when `empty`. */
    name?: string | null
    avatarUrl?: string | null
    /** Picked face id. A valid preset wins over an older `avatarUrl`. */
    avatarPreset?: string | null
    size?: PlayerAvatarSize
    /** A seat nobody has taken — dashed circle, no name/photo. */
    empty?: boolean
    /** Optional context-specific mark for an empty seat. */
    emptyIcon?: ReactNode
    /** Green dot (bottom-right) — the seat's player is currently connected. */
    online?: boolean
    /** Disconnected / not-yet-taken in a context where `empty` isn't quite right. */
    dimmed?: boolean
}) {
    const { box, font } = SIZES[size]
    const dotSize = size === "lg" ? "14px" : size === "xs" ? "8px" : "11px"

    return (
        <Box position="relative" display="inline-flex" flexShrink={0}>
            <Box
                w={box}
                h={box}
                rounded="full"
                overflow="hidden"
                display="flex"
                alignItems="center"
                justifyContent="center"
                bg={empty ? "transparent" : "bg.panel"}
                borderWidth={empty ? "2px" : "1px"}
                borderStyle={empty ? "dashed" : "solid"}
                borderColor={empty ? "border.emphasized" : "border.subtle"}
                color="fg"
                fontWeight="semibold"
                fontSize={font}
                opacity={dimmed ? 0.55 : 1}
            >
                {empty ? (
                    <Box color="fg.muted" display="flex" aria-hidden="true">
                        {emptyIcon ?? <Text>+</Text>}
                    </Box>
                ) : isAvatarId(avatarPreset) ? (
                    <BelaAvatar id={avatarPreset} boxSize="100%" />
                ) : avatarUrl ? (
                    <AvatarPhoto src={avatarUrl} fallback={initialsOf(name ?? "?")} />
                ) : (
                    initialsOf(name ?? "?")
                )}
            </Box>
            {online && !empty && (
                <Box
                    position="absolute"
                    bottom="0"
                    right="0"
                    boxSize={dotSize}
                    rounded="full"
                    bg="ok"
                    borderWidth="2px"
                    borderColor="bg.panel"
                />
            )}
        </Box>
    )
}
