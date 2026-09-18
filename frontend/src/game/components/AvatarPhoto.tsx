import { useEffect, useState, type ReactNode } from "react"
import { Image } from "@chakra-ui/react"

/* ──────────────────────────────────────────────────────────────────────────
   AvatarPhoto — a photo that can fail, and knows what to show when it does.

   A signed-in player's `avatarUrl` is very often the Google account picture
   the token carried (`picture` claim). Those URLs are hotlinks to Google's
   CDN and refuse to load surprisingly often — rate-limited, expired, or
   blocked by a content blocker — and a plain `<img>` then paints the
   browser's broken-image glyph inside a 44 px circle at the table. That was
   "my avatar sometimes doesn't show up when the game loads". The `onError`
   here swaps in the caller's `fallback` (initials) instead, and the photo is
   loaded EAGERLY: a seat is on screen the moment the table is, so lazy
   loading only ever delayed it.
   ────────────────────────────────────────────────────────────────────── */

export default function AvatarPhoto({ src, fallback }: { src: string; fallback: ReactNode }) {
    const [failed, setFailed] = useState(false)
    // A new URL gets a fresh chance — a profile edit must not stay stuck on
    // the initials because the previous picture had failed.
    useEffect(() => setFailed(false), [src])
    if (failed) return <>{fallback}</>
    return (
        <Image
            src={src}
            alt=""
            w="100%"
            h="100%"
            objectFit="cover"
            decoding="async"
            onError={() => setFailed(true)}
        />
    )
}
