import { Box, Image, Text } from "@chakra-ui/react"
import BelaAvatar from "../../components/avatars/BelaAvatar"
import { isAvatarId } from "../../components/avatars/avatarArt"

/* ──────────────────────────────────────────────────────────────────────────
   PlayerAvatar — one round avatar, shared by the lobby's room cards, the
   room's seat rows and its "2 vs 2" preview (game/DESIGN.md §1 "Lobby"/"Soba").

   Four states, in this order of preference: a photo (`avatarUrl`), the picked
   face (`avatarPreset`, drawn by `BelaAvatar`), initials from `name` when
   there is neither, or `empty` — a dashed circle with a "+" for a seat nobody
   has taken, the exact same visual `Seat.tsx` uses on the live table so the
   lobby list and the room preview never look like a different app from the
   felt.

   The photo wins over the preset because an uploaded photo is a deliberate,
   more specific statement of "this is me"; the preset is what everyone who
   never uploaded one gets, which is nearly everyone, and initials are now
   only the fallback for a seat whose face this build does not recognise.
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
    online = false,
    dimmed = false,
}: {
    /** Ignored when `empty`. */
    name?: string | null
    avatarUrl?: string | null
    /** Picked face id; used only when there is no `avatarUrl`. */
    avatarPreset?: string | null
    size?: PlayerAvatarSize
    /** A seat nobody has taken — dashed circle, no name/photo. */
    empty?: boolean
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
                    <Text color="fg.muted" aria-hidden="true">+</Text>
                ) : avatarUrl ? (
                    <Image src={avatarUrl} alt="" w="100%" h="100%" objectFit="cover" loading="lazy" />
                ) : isAvatarId(avatarPreset) ? (
                    <BelaAvatar id={avatarPreset} boxSize="100%" />
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
                    bg="green.solid"
                    borderWidth="2px"
                    borderColor="bg.panel"
                />
            )}
        </Box>
    )
}
