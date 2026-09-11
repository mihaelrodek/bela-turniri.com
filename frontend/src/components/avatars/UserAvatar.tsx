import { Box, Image } from "@chakra-ui/react"
import type { BoxProps } from "@chakra-ui/react"
import { isAvatarId } from "./avatarArt"
import BelaAvatar from "./BelaAvatar"
import { initialsOf } from "../listingShared"

/* ──────────────────────────────────────────────────────────────────────────
   ONE place that decides what a user's avatar circle looks like, used by
   every site that used to hand-roll its own photo/initials fallback (navbar
   pill, public profile header, "Moji podaci").

   WHICHEVER THE USER CHOSE LAST is what shows. Neither kind has priority of
   its own; the ordering here plus one rule on the server produce that:

     • picking a character STORES the preset, leaving the photo file alone;
     • uploading a photo CLEARS the preset (`UserMeController.uploadAvatar`).

   So a stored preset can only mean "the character was chosen after the photo",
   which is why it is checked first, then the photo, then initials. It read the
   other way round until 2026-09-11, and then picking a character while a photo
   was up appeared to do nothing at all.

   `isAvatarId` re-validates `avatarPreset` before handing it to `BelaAvatar`
   rather than trusting the caller. Every value that reaches here has come
   over the wire at some point (profile GET, a WebSocket-refreshed query…),
   and a preset id the client's `avatarArt.ts` doesn't know how to draw must
   fall back to initials rather than render nothing — the app can ship a new
   avatar set without a stale client going blank-circle on an old user.
   ────────────────────────────────────────────────────────────────────── */

export interface UserAvatarProps extends Omit<BoxProps, "children"> {
    /** Proxied photo URL, or null/undefined when the user has none. */
    avatarUrl?: string | null
    /** Picked character id, or null/undefined. WINS over `avatarUrl`. */
    avatarPreset?: string | null
    /** Display name, used for the initials fallback and as a default alt text. */
    name?: string | null
    /** Alt text for the photo path. Defaults to `name`. */
    alt?: string
    /** Edge of the circle. Required — there is no sane one-size-fits-all default
     *  across a 28 px nav pill and a 56 px profile header. */
    size: BoxProps["boxSize"]
    fontSize?: BoxProps["fontSize"]
}

export default function UserAvatar({
    avatarUrl,
    avatarPreset,
    name,
    alt,
    size,
    fontSize = "sm",
    ...rest
}: UserAvatarProps) {
    const altText = alt ?? name ?? ""

    if (isAvatarId(avatarPreset)) {
        return <BelaAvatar id={avatarPreset} size={size} {...rest} />
    }

    if (avatarUrl) {
        return (
            <Box
                boxSize={size}
                rounded="full"
                overflow="hidden"
                bg="blue.subtle"
                color="blue.fg"
                display="flex"
                alignItems="center"
                justifyContent="center"
                fontWeight="bold"
                fontSize={fontSize}
                flexShrink={0}
                {...rest}
            >
                <Image
                    src={avatarUrl}
                    alt={altText}
                    w="100%"
                    h="100%"
                    objectFit="cover"
                    // A user's own avatar is rarely the page's LCP element —
                    // safe to defer everywhere this component is used.
                    loading="lazy"
                    decoding="async"
                />
            </Box>
        )
    }

    return (
        <Box
            boxSize={size}
            rounded="full"
            overflow="hidden"
            bg="blue.subtle"
            color="blue.fg"
            display="flex"
            alignItems="center"
            justifyContent="center"
            fontWeight="bold"
            fontSize={fontSize}
            flexShrink={0}
            {...rest}
        >
            {initialsOf(name ?? "")}
        </Box>
    )
}
