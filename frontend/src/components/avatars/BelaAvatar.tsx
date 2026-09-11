import { Box } from "@chakra-ui/react"
import type { BoxProps } from "@chakra-ui/react"
import { buildAvatarSvg, isAvatarId, type AvatarId } from "./avatarArt"

/* ──────────────────────────────────────────────────────────────────────────
   One picked avatar, rendered.

   `dangerouslySetInnerHTML` is deliberate and is safe HERE ONLY: the markup
   comes from `buildAvatarSvg`, which interpolates nothing but values from the
   frozen table in `avatarArt.ts`. `id` is narrowed through `isAvatarId`
   before it is used, so even a value read straight out of the database or a
   WebSocket frame cannot reach the builder unless it names a real preset.
   Never widen this to accept caller-supplied markup.

   The SVG carries no width/height of its own — it fills whatever box the
   caller sizes, which is what lets the same drawing be a 24 px chip and a
   96 px profile portrait without a second asset.
   ────────────────────────────────────────────────────────────────────── */

export interface BelaAvatarProps extends Omit<BoxProps, "children"> {
    /** Preset id. Anything unrecognised renders nothing — see `AvatarFace`. */
    id: string
    /** Any CSS length; defaults to filling the parent. */
    size?: BoxProps["boxSize"]
}

export default function BelaAvatar({ id, size, ...rest }: BelaAvatarProps) {
    if (!isAvatarId(id)) return null
    return (
        <Box
            boxSize={size}
            rounded="full"
            overflow="hidden"
            flexShrink={0}
            css={{ "& svg": { width: "100%", height: "100%", display: "block" } }}
            dangerouslySetInnerHTML={{ __html: buildAvatarSvg(id as AvatarId) }}
            {...rest}
        />
    )
}
